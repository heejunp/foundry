package main

import (
	"foundry-server/internal/database"
	"foundry-server/internal/handler"
	"log"

	"foundry-server/internal/k8s"

	"github.com/joho/godotenv"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Init Database
	database.InitDB() // Changed from Connect() to InitDB()

    // Init Kubernetes Client
    if err := k8s.InitK8s(); err != nil {
        log.Printf("Failed to init K8s: %v", err)
        // We don't fatal here, allowing server to run without K8s for now
    }

	e := echo.New()

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// Public Routes
	handler.InitOAuth()
	// Auth routes moved to /api/auth/...
	e.GET("/api/auth/login", handler.GithubLogin)             // Entry point
	e.GET("/api/auth/github/login", handler.GithubLogin)      // Alias
	e.GET("/api/auth/github/callback", handler.GithubCallback)
	e.GET("/api/projects/public", handler.GetPublicProjects)

	// Protected Routes
	api := e.Group("/api")
	api.Use(handler.AuthMiddleware)

	api.POST("/activate", handler.ActivateAccount)
	api.GET("/me", handler.GetMe)
	api.DELETE("/me", handler.DeleteAccount)
	
	api.GET("/projects/my", handler.GetMyProjects)
	api.POST("/projects", handler.CreateProject)
	
	api.POST("/projects/:id/like", handler.ToggleLike)
	api.POST("/projects/:id/favorite", handler.ToggleFavorite)
	api.POST("/projects/:id/view", handler.RegisterView)

	e.Logger.Fatal(e.Start(":8080")) // Frontend is 5173, Server 8080
}
