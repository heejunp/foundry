package handler

import (
	"fmt"
	"foundry-server/internal/database"
	"foundry-server/internal/k8s"
	"foundry-server/internal/model"
	"net/http"

	"github.com/labstack/echo/v4"
)

// GetPublicProjects returns all projects with sorting and user context
func GetPublicProjects(c echo.Context) error {
	// Optional User Context
	userID := c.Request().Header.Get("X-User-ID")
	sortParam := c.QueryParam("sort") // "likes", "views", "latest"

	var projects []model.Project
	query := database.DB.Preload("Owner")

	// Custom Sorting Logic
	switch sortParam {
	case "likes":
		query = query.Order("like_count DESC")
	case "views":
		query = query.Order("view_count DESC")
	default:
		query = query.Order("created_at DESC")
	}

	if result := query.Find(&projects); result.Error != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch projects"})
	}

	// Post-processing for User Context (IsLiked, IsFavorited) & Favorites First Sort
	// While we could do complex SQL joins, iterating is acceptable for this scale MVP
	if userID != "" {
		// Fetch user's interactions
		var likedProjectIDs []string
		var favoritedProjectIDs []string

		database.DB.Raw("SELECT project_id FROM project_likes WHERE user_id = ?", userID).Scan(&likedProjectIDs)
		database.DB.Raw("SELECT project_id FROM project_favorites WHERE user_id = ?", userID).Scan(&favoritedProjectIDs)

		// Create maps for O(1) lookup
		likesMap := make(map[string]bool)
		for _, id := range likedProjectIDs {
			likesMap[id] = true
		}
		favsMap := make(map[string]bool)
		for _, id := range favoritedProjectIDs {
			favsMap[id] = true
		}

		// Populate fields
		for i := range projects {
			if likesMap[projects[i].ID] {
				projects[i].IsLiked = true
			}
			if favsMap[projects[i].ID] {
				projects[i].IsFavorited = true
			}
		}

		// Re-sort: Favorites always first
		// We use a stable sort or simple partition logic
		// Partition: Favorites | Others (already sorted by criteria)
		var favorites []model.Project
		var others []model.Project

		for _, p := range projects {
			if p.IsFavorited {
				favorites = append(favorites, p)
			} else {
				others = append(others, p)
			}
		}
		projects = append(favorites, others...)
	}

	return c.JSON(http.StatusOK, projects)
}

// GetMyProjects returns projects for the authenticated user
func GetMyProjects(c echo.Context) error {
	userID := c.Get("userID").(string)
	projects := []model.Project{} // Initialize as empty slice to return [] instead of null
	if result := database.DB.Where("owner_id = ?", userID).Find(&projects); result.Error != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch projects"})
	}
	return c.JSON(http.StatusOK, projects)
}

func CreateProject(c echo.Context) error {
	userID := c.Get("userID").(string)
	var req model.CreateProjectRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	// 1. Fetch User to get AccessToken
	var user model.User
	if result := database.DB.Select("access_token").Where("id = ?", userID).First(&user); result.Error != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "User not found"})
	}

	// Default branch to main if empty
	branch := req.Branch
	if branch == "" {
		branch = "main"
	}
	
	port := req.Port
	if port == 0 {
		port = 80
	}

	// 2. Create Project Record (Transaction)
	project := model.Project{
		Name:    req.Name,
		RepoURL: req.RepoURL,
		// Branch:  branch, // Not persisted in DB model yet
		Port:    port,
		OwnerID: userID,
		Status:  "building",
	}

	tx := database.DB.Begin()
	if err := tx.Create(&project).Error; err != nil {
		tx.Rollback()
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create project"})
	}

	// 3. Save Env Vars
	envMap := make(map[string]string)
	for _, env := range req.EnvVars {
		if env.Key == "" {
			continue
		}
		envRecord := model.ProjectEnv{
			ProjectID: project.ID,
			Key:       env.Key,
			Value:     env.Value,
		}
		if err := tx.Create(&envRecord).Error; err != nil {
			tx.Rollback()
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save env vars"})
		}
		envMap[env.Key] = env.Value
	}

	if err := tx.Commit().Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Transaction commit failed"})
	}

	// 4. Trigger K8s Build
	// Note: Verify k8s client is initialized before calling
	if k8s.Client != nil {
		if err := k8s.TriggerBuild(project.ID, project.Name, req.RepoURL, branch, user.AccessToken, envMap, project.Port); err != nil {
			// Log error but assume project is created. User can retry build later.
			// Or update status to error.
			database.DB.Model(&project).Update("status", "error")
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to trigger build: " + err.Error()})
		}
	} else {
		// If K8s is not connected (e.g. dev mode without k8s), we just log it
		// In production, this might be an error or handled gracefully
		database.DB.Model(&project).Update("status", "error")
		// return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "Kubernetes not connected"})
	}

	return c.JSON(http.StatusCreated, project)
}

func DeleteProject(c echo.Context) error {
	userID := c.Get("userID").(string)
	projectID := c.Param("id")

	var project model.Project
	if err := database.DB.Where("id = ? AND owner_id = ?", projectID, userID).First(&project).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Project not found or access denied"})
	}

	// Delete from Kubernetes
	if k8s.Client != nil {
		if err := k8s.DeleteProject(projectID); err != nil {
			// Log error but proceed to delete from DB? 
			// Or fail? Best to log and proceed (don't leave zombie DB records)
			fmt.Printf("Failed to delete K8s resources for %s: %v\n", projectID, err)
		}
	}

	// Delete from DB
	if err := database.DB.Delete(&project).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete project"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Project deleted successfully"})
}

// GetProject returns a single project details including env vars
func GetProject(c echo.Context) error {
	userID := c.Get("userID").(string)
	projectID := c.Param("id")

	var project model.Project
	if err := database.DB.Where("id = ? AND owner_id = ?", projectID, userID).First(&project).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Project not found or access denied"})
	}

	// Fetch Env Vars
	var envs []model.ProjectEnv
	if err := database.DB.Where("project_id = ?", projectID).Find(&envs).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch env vars"})
	}

	// Combine response
	response := map[string]interface{}{
		"project": project,
		"envVars": envs,
	}

	return c.JSON(http.StatusOK, response)
}

// UpdateProject handles updating settings (port, envs) or actions (start/stop)
func UpdateProject(c echo.Context) error {
	userID := c.Get("userID").(string)
	projectID := c.Param("id")

	var req model.UpdateProjectRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	var project model.Project
	if err := database.DB.Where("id = ? AND owner_id = ?", projectID, userID).First(&project).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Project not found"})
	}

	// 1. Handle Actions (Start/Stop)
	if req.Action != "" {
		if k8s.Client != nil {
			var replicas int32
			status := "running"
			if req.Action == "stop" {
				replicas = 0
				status = "stopped"
			} else if req.Action == "start" {
				replicas = 1
			} else {
				return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid action"})
			}

			if err := k8s.ScaleProject(projectID, replicas); err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to scale project"})
			}
			
			// Update Status in DB
			database.DB.Model(&project).Update("status", status)
			return c.JSON(http.StatusOK, map[string]string{"message": "Project " + status})
		}
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "Kubernetes not connected"})
	}

	// 2. Handle Configuration Update (Port / EnvVars) -> Requires Redeploy
	// We need to fetch existing env vars if not provided?
	// The user usually sends the FULL set of env vars if they edit them.
	// Assume: if req.EnvVars is provided, we replace all envs? Or merge?
	// Ideally: Replace all for simplicity.
	
	shouldRedeploy := false

	tx := database.DB.Begin()

	// Update Port
	if req.Port != 0 && req.Port != project.Port {
		project.Port = req.Port
		if err := tx.Save(&project).Error; err != nil {
			tx.Rollback()
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update project"})
		}
		shouldRedeploy = true
	}

	// Update Env Vars
	if req.EnvVars != nil {
		// Delete old
		if err := tx.Where("project_id = ?", projectID).Delete(&model.ProjectEnv{}).Error; err != nil {
			tx.Rollback()
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to clean old env vars"})
		}
		// Insert new
		for _, env := range req.EnvVars {
			if env.Key == "" { continue }
			newEnv := model.ProjectEnv{
				ProjectID: project.ID,
				Key:       env.Key,
				Value:     env.Value,
			}
			if err := tx.Create(&newEnv).Error; err != nil {
				tx.Rollback()
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save env vars"})
			}
		}
		shouldRedeploy = true
	}

	if err := tx.Commit().Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Commit failed"})
	}

	if shouldRedeploy && k8s.Client != nil {
		// Fetch current env vars map for deployment
		var currentEnvs []model.ProjectEnv
		database.DB.Where("project_id = ?", projectID).Find(&currentEnvs)
		envMap := make(map[string]string)
		for _, e := range currentEnvs {
			envMap[e.Key] = e.Value
		}

		// Redeploy
		if _, err := k8s.DeployProject(projectID, project.Name, envMap, project.Port); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to redeploy: " + err.Error()})
		}
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Project updated successfully"})
}

// GetProjectLogs returns the runtime logs of the project
func GetProjectLogs(c echo.Context) error {
	userID := c.Get("userID").(string)
	projectID := c.Param("id")

	// Verify ownership first
	var project model.Project
	if err := database.DB.Where("id = ? AND owner_id = ?", projectID, userID).First(&project).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Project not found or access denied"})
	}

	if k8s.Client == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "Kubernetes not connected"})
	}

	logs, err := k8s.GetPodLogs(projectID)
	if err != nil {
		// Just log error and return empty? Or return error
		// Often failure means pod is crashlooping or absent
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch logs: " + err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"logs": logs})
}
