package handler

import (
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
	var projects []model.Project
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

	// 2. Create Project Record (Transaction)
	project := model.Project{
		Name:    req.Name,
		RepoURL: req.RepoURL,
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
		if err := k8s.TriggerBuild(project.ID, req.RepoURL, branch, user.AccessToken, envMap); err != nil {
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
