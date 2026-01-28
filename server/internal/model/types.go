package model

import (
	"time"
)

type User struct {
	ID          string    `gorm:"primaryKey;type:uuid;default:uuid_generate_v4()" json:"id"`
	GithubID    string    `gorm:"uniqueIndex;not null" json:"githubId"`
	Username    string    `gorm:"not null" json:"username"`
	AvatarURL   string    `json:"avatarUrl"`
	AccessToken string    `json:"-"` // Don't expose this in JSON
	IsActive    bool      `gorm:"default:false" json:"isActive"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	Projects    []Project `gorm:"foreignKey:OwnerID" json:"projects,omitempty"`
}

type Project struct {
	ID        string `gorm:"primaryKey;type:uuid;default:uuid_generate_v4()" json:"id"`
	Name      string `gorm:"not null" json:"name"`
	RepoURL   string `gorm:"not null" json:"repoUrl"`
	DeployURL string `json:"deployUrl"`
	Status    string `gorm:"default:'building'" json:"status"` // building, running, error
	OwnerID   string `gorm:"type:uuid;not null" json:"ownerId"`
	Owner     User   `gorm:"foreignKey:OwnerID" json:"owner"`
	
	ViewCount int `gorm:"default:0" json:"viewCount"`
	LikeCount int `gorm:"default:0" json:"likeCount"`
	
	// Dynamic fields (not in DB table, populated via joins/logic)
	IsLiked     bool `gorm:"-" json:"isLiked"`
	IsFavorited bool `gorm:"-" json:"isFavorited"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type InviteCode struct {
	ID         string `gorm:"primaryKey;type:uuid;default:uuid_generate_v4()"`
	Code       string `gorm:"uniqueIndex;not null"`
	MonthKey   string `gorm:"uniqueIndex;not null"` // YYYY-MM
	ValidUntil time.Time
	CreatedAt  time.Time
}

// DTOs

type CreateProjectRequest struct {
	Name    string `json:"name"`
	RepoURL string `json:"repoUrl"`
}

type ActivateRequest struct {
	InviteCode string `json:"inviteCode"`
}

type LoginResponse struct {
	User  User   `json:"user"`
	Token string `json:"token"` // Simple mock token for now
}
