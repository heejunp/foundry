package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"foundry-server/internal/database"
	"foundry-server/internal/model"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
)

var oauthConfig *oauth2.Config

func InitOAuth() {
	clientID := os.Getenv("GITHUB_CLIENT_ID")
	clientSecret := os.Getenv("GITHUB_CLIENT_SECRET")
	
	// Default fallbacks for dev (User should provide these)
	if clientID == "" || clientSecret == "" {
		fmt.Println("Warning: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set.")
	}

	// Redirect URL from Env (Important for Prod/Dev separation)
	redirectURL := os.Getenv("GITHUB_REDIRECT_URL")
	if redirectURL == "" {
		redirectURL = "http://localhost:8080/api/auth/github/callback" // Fallback
	}

	oauthConfig = &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{"read:user"},
		Endpoint:     github.Endpoint,
	}
}

// AuthMiddleware - Simple check for UserID header
func AuthMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Request().Header.Get("X-User-ID")
		if userID == "" {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		}
		
		// Optional: Verify user exists in DB cheaply or use Redis
		// For now, we trust the ID exists
		
		c.Set("userID", userID)
		return next(c)
	}
}

// GithubLogin redirects user to GitHub
func GithubLogin(c echo.Context) error {
	url := oauthConfig.AuthCodeURL("foundry-state", oauth2.AccessTypeOnline)
	return c.Redirect(http.StatusTemporaryRedirect, url)
}

type GithubUserResponse struct {
	ID        int    `json:"id"`
	Login     string `json:"login"`
	AvatarURL string `json:"avatar_url"`
	Name      string `json:"name"`
}

// GithubCallback handles the code exchange and user sync
func GithubCallback(c echo.Context) error {
	code := c.QueryParam("code")
	if code == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Code not found"})
	}

	token, err := oauthConfig.Exchange(context.Background(), code)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to exchange token"})
	}

	client := oauthConfig.Client(context.Background(), token)
	resp, err := client.Get("https://api.github.com/user")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch user info"})
	}
	defer resp.Body.Close()

	var ghUser GithubUserResponse
	if err := json.NewDecoder(resp.Body).Decode(&ghUser); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to parse user info"})
	}

	// Sync with Database
	if database.DB == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database not connected"})
	}

	githubIDStr := strconv.Itoa(ghUser.ID)
	
	var user model.User
	// Check if user exists
	if err := database.DB.Where("github_id = ?", githubIDStr).First(&user).Error; err != nil {
		// Create new user
		user = model.User{
			GithubID:    githubIDStr,
			Username:    ghUser.Login,
			AvatarURL:   ghUser.AvatarURL,
			AccessToken: token.AccessToken,
			IsActive:    false,
		}
		if result := database.DB.Create(&user); result.Error != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create user"})
		}
	} else {
		// Update info (optional)
		user.AvatarURL = ghUser.AvatarURL
		user.Username = ghUser.Login
		user.AccessToken = token.AccessToken
		database.DB.Save(&user)
	}

	// Redirect to Frontend
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "/auth/callback" // Default to relative path for same-origin (Prod)
	} else {
		frontendURL = fmt.Sprintf("%s/auth/callback", frontendURL)
	}

	return c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("%s?token=%s", frontendURL, user.ID))
}

func GetMe(c echo.Context) error {
	userID := c.Get("userID").(string)
	var user model.User
	if result := database.DB.First(&user, "id = ?", userID); result.Error != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}
	return c.JSON(http.StatusOK, user)
}

func ActivateAccount(c echo.Context) error {
	userID := c.Get("userID").(string)
	var req model.ActivateRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	// Calculate Current Month Key (YYYY-MM)
	now := time.Now()
	monthKey := now.Format("2006-01")

	// Check if a code exists for this month. 
	// If not, we generate one for convenience (Auto-rotation logic).
	var inviteCode model.InviteCode
	err := database.DB.Where("month_key = ?", monthKey).First(&inviteCode).Error
	if err != nil {
		// Auto-generate logic for this month if missing (Engineer persona: automate boring stuff)
		// Code format: FOUNDRY-<MONTH>-<RANDOM> or just fixed rotation for simplicity
		// Let's make it simpler for the user: FOUNDRY-<MONTH-NAME> e.g., FOUNDRY-JAN
		monthName := now.Month().String() // "January"
		generatedCode := fmt.Sprintf("FOUNDRY-%s", monthName[0:3]) // FOUNDRY-JAN
		generatedCode = strings.ToUpper(generatedCode)

		inviteCode = model.InviteCode{
			Code:       generatedCode,
			MonthKey:   monthKey,
			ValidUntil: now.AddDate(0, 1, 0), // Valid for 1 month roughly
			CreatedAt:  now,
		}
		database.DB.Create(&inviteCode)
		fmt.Printf(" [INFO] New Invite Code Generated for %s: %s\n", monthKey, generatedCode)
	}

	// Validate Code
	// We allow the master code "FOUNDRY-VIP" for back-compat or admin, PLUS the monthly code
	if req.InviteCode != "FOUNDRY-VIP" && req.InviteCode != inviteCode.Code {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": fmt.Sprintf("Invalid invite code. Hint: The code for this month is %s", inviteCode.Code),
		})
	}

	if err := database.DB.Model(&model.User{}).Where("id = ?", userID).Update("is_active", true).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to activate"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Account activated"})
}

func DeleteAccount(c echo.Context) error {
	userID := c.Get("userID").(string)

	var user model.User
	if err := database.DB.First(&user, "id = ?", userID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}

	// 1. Revoke GitHub Grant (Remove from GitHub OAuth)
	// We need to use Basic Auth with Client ID and Secret to revoke the grant for this specific token
	// DELETE https://api.github.com/applications/{client_id}/grant
	// Body: {"access_token": "..."}
	if user.AccessToken != "" && oauthConfig != nil {
		clientID := oauthConfig.ClientID
		clientSecret := oauthConfig.ClientSecret
		
		reqBody := fmt.Sprintf(`{"access_token": "%s"}`, user.AccessToken)
		req, _ := http.NewRequest("DELETE", fmt.Sprintf("https://api.github.com/applications/%s/grant", clientID), strings.NewReader(reqBody))
		req.SetBasicAuth(clientID, clientSecret)
		req.Header.Set("Content-Type", "application/json")
		
		client := &http.Client{}
		resp, err := client.Do(req)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == 204 {
				fmt.Println("Successfully revoked GitHub grant for user")
			} else {
				fmt.Printf("Failed to revoke GitHub grant: %d\n", resp.StatusCode)
			}
		}
	}

	// 2. Delete User from DB
	// DB logic: cascading delete on projects is configured in schema if we used ON DELETE CASCADE
	// But GORM requires explicit setup or manual delete.
	// Our schema SQL says: owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
	// So deleting user should delete projects at DB level.
	if err := database.DB.Delete(&user).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete user"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Account deleted successfully"})
}
