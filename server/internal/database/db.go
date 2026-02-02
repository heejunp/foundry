package database

import (
	"fmt"
	"log"
	"os"

	"foundry-server/internal/model"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_SSLMODE"),
	)
	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Printf("Failed to connect to database: %v", err)
		// We don't panic here to allow running without DB for dev if handled
		return
	}

	log.Println("Connected to PostgreSQL")
	
	// AutoMigrate to sync schema
	if err := DB.AutoMigrate(&model.User{}, &model.Project{}, &model.ProjectEnv{}); err != nil {
		log.Printf("Failed to migrate database: %v", err)
	}
}
