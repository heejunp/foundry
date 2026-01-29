package database

import (
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	dsn := "host=localhost user=park password=1234 dbname=foundry port=5432 sslmode=disable"
	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Printf("Failed to connect to database: %v", err)
		// We don't panic here to allow running without DB for dev if handled
		return
	}

	log.Println("Connected to PostgreSQL")
	
	// AutoMigrate is useful for dev but user asked for SQL file. 
	// We will keep this commented or use it strictly for syncing if schema.sql isn't enough.
	// DB.AutoMigrate(&model.User{}, &model.Project{})
}
