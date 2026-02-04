package handler

import (
	"foundry-server/internal/database"
	"foundry-server/internal/model"
	"net/http"

	"github.com/labstack/echo/v4"
)

type CreateEnvironmentRequest struct {
	Name      string               `json:"name"`
	Variables []model.EnvVarRequest `json:"variables"`
}

// GetEnvironments returns all environments for the user
func GetEnvironments(c echo.Context) error {
	userID := c.Get("userID").(string)
	
	var envs []model.Environment
	if err := database.DB.Preload("Variables").Where("owner_id = ?", userID).Find(&envs).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch environments"})
	}

	return c.JSON(http.StatusOK, envs)
}

// CreateEnvironment creates a new reusable environment group
func CreateEnvironment(c echo.Context) error {
	userID := c.Get("userID").(string)
	var req CreateEnvironmentRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	tx := database.DB.Begin()

	env := model.Environment{
		Name:    req.Name,
		OwnerID: userID,
	}

	if err := tx.Create(&env).Error; err != nil {
		tx.Rollback()
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create environment"})
	}

	for _, v := range req.Variables {
		if v.Key == "" { continue }
		ev := model.EnvironmentVar{
			EnvironmentID: env.ID,
			Key:           v.Key,
			Value:         v.Value,
		}
		if err := tx.Create(&ev).Error; err != nil {
			tx.Rollback()
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save variables"})
		}
	}

	if err := tx.Commit().Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Commit failed"})
	}
	
	// Reload with variables
	database.DB.Preload("Variables").First(&env, "id = ?", env.ID)

	return c.JSON(http.StatusCreated, env)
}

// DeleteEnvironment deletes an environment group
func DeleteEnvironment(c echo.Context) error {
	userID := c.Get("userID").(string)
	id := c.Param("id")

	// Verify ownership
	var env model.Environment
	if err := database.DB.Where("id = ? AND owner_id = ?", id, userID).First(&env).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Environment not found"})
	}

	if err := database.DB.Delete(&env).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete environment"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Environment deleted"})
}
