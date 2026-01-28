package handler

import (
	"foundry-server/internal/database"
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

	project := model.Project{
		Name:    req.Name,
		RepoURL: req.RepoURL,
		OwnerID: userID,
		Status:  "building",
	}

	if result := database.DB.Create(&project); result.Error != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create project"})
	}

	return c.JSON(http.StatusCreated, project)
}
