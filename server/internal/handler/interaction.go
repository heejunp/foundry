package handler

import (
	"foundry-server/internal/database"
	"foundry-server/internal/model"
	"net/http"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

// ToggleLike toggles the like status for a project
func ToggleLike(c echo.Context) error {
	userID := c.Get("userID").(string)
	projectID := c.Param("id")

	// Check if already liked
	var exists bool
	err := database.DB.Raw("SELECT EXISTS(SELECT 1 FROM project_likes WHERE project_id = ? AND user_id = ?)", projectID, userID).Scan(&exists).Error
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}

	tx := database.DB.Begin()

	if exists {
		// Unlike
		if err := tx.Exec("DELETE FROM project_likes WHERE project_id = ? AND user_id = ?", projectID, userID).Error; err != nil {
			tx.Rollback()
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to unlike"})
		}
		// Decrement count
		if err := tx.Model(&model.Project{}).Where("id = ?", projectID).UpdateColumn("like_count", gorm.Expr("like_count - 1")).Error; err != nil {
			tx.Rollback()
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update count"})
		}
	} else {
		// Like
		if err := tx.Exec("INSERT INTO project_likes (project_id, user_id) VALUES (?, ?)", projectID, userID).Error; err != nil {
			tx.Rollback()
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to like"})
		}
		// Increment count
		if err := tx.Model(&model.Project{}).Where("id = ?", projectID).UpdateColumn("like_count", gorm.Expr("like_count + 1")).Error; err != nil {
			tx.Rollback()
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update count"})
		}
	}

	tx.Commit()
	return c.JSON(http.StatusOK, map[string]interface{}{"liked": !exists})
}

// ToggleFavorite toggles the favorite status
func ToggleFavorite(c echo.Context) error {
	userID := c.Get("userID").(string)
	projectID := c.Param("id")

	var exists bool
	err := database.DB.Raw("SELECT EXISTS(SELECT 1 FROM project_favorites WHERE project_id = ? AND user_id = ?)", projectID, userID).Scan(&exists).Error
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}

	if exists {
		// Unfavorite
		if err := database.DB.Exec("DELETE FROM project_favorites WHERE project_id = ? AND user_id = ?", projectID, userID).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to unfavorite"})
		}
	} else {
		// Favorite
		if err := database.DB.Exec("INSERT INTO project_favorites (project_id, user_id) VALUES (?, ?)", projectID, userID).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to favorite"})
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"favorited": !exists})
}

// RegisterView registers a unique view logic
func RegisterView(c echo.Context) error {
    userID := c.Get("userID").(string)
    projectID := c.Param("id")

    // Check availability
    var exists bool
    database.DB.Raw("SELECT EXISTS(SELECT 1 FROM project_views WHERE project_id = ? AND user_id = ?)", projectID, userID).Scan(&exists)

    if !exists {
        tx := database.DB.Begin()
        if err := tx.Exec("INSERT INTO project_views (project_id, user_id) VALUES (?, ?)", projectID, userID).Error; err != nil {
            tx.Rollback()
            return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to register view"})
        }
        if err := tx.Model(&model.Project{}).Where("id = ?", projectID).UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error; err != nil {
            tx.Rollback()
            return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update count"})
        }
        tx.Commit()
        return c.JSON(http.StatusOK, map[string]bool{"counted": true})
    }

    return c.JSON(http.StatusOK, map[string]bool{"counted": false})
}
