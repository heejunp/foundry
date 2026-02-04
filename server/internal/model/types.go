package model

import (
	"fmt"
	"time"

	"foundry-server/internal/crypto"

	"gorm.io/gorm"
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
	Port      int    `gorm:"default:80" json:"port"`
	DeployURL string `json:"deployUrl"`
	Status    string `gorm:"default:'building'" json:"status"` // building, running, error
	OwnerID   string `gorm:"type:uuid;not null" json:"ownerId"`
	Owner     User   `gorm:"foreignKey:OwnerID" json:"owner"`
	
	ViewCount int `gorm:"default:0" json:"viewCount"`
	LikeCount int `gorm:"default:0" json:"likeCount"`
	
	// Dynamic fields (not in DB table, populated via joins/logic)
	IsLiked     bool `gorm:"-" json:"isLiked"`
	IsFavorited bool `gorm:"-" json:"isFavorited"`

    // M2M Relation for Reusable Envs
    Environments []Environment `gorm:"many2many:project_environments;" json:"environments,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Environment struct {
    ID        string           `gorm:"primaryKey;type:uuid;default:uuid_generate_v4()" json:"id"`
    Name      string           `gorm:"not null" json:"name"`
    OwnerID   string           `gorm:"type:uuid;not null" json:"ownerId"`
    Variables []EnvironmentVar `gorm:"foreignKey:EnvironmentID" json:"variables"`
    CreatedAt time.Time        `json:"createdAt"`
    UpdatedAt time.Time        `json:"updatedAt"`
}

type EnvironmentVar struct {
    ID            uint   `gorm:"primaryKey" json:"id"`
    EnvironmentID string `gorm:"type:uuid;not null" json:"-"`
    Key           string `gorm:"not null" json:"key"`
    Value         string `gorm:"not null" json:"value"` // Stored encrypted in DB
}

// BeforeSave hook - encrypt value before saving to database
func (ev *EnvironmentVar) BeforeSave(tx *gorm.DB) error {
    if ev.Value == "" {
        return nil
    }
    
    encrypted, err := crypto.Encrypt(ev.Value)
    if err != nil {
        return fmt.Errorf("failed to encrypt environment variable: %v", err)
    }
    ev.Value = encrypted
    return nil
}

// AfterFind hook - decrypt value after loading from database
func (ev *EnvironmentVar) AfterFind(tx *gorm.DB) error {
    if ev.Value == "" {
        return nil
    }
    
    decrypted, err := crypto.Decrypt(ev.Value)
    if err != nil {
        // If decryption fails, it might be plaintext (migration scenario)
        // Log the error but don't fail - allows gradual migration
        fmt.Printf("[WARN] Failed to decrypt environment variable ID %d: %v\n", ev.ID, err)
        return nil
    }
    ev.Value = decrypted
    return nil
}

type InviteCode struct {
	ID         string `gorm:"primaryKey;type:uuid;default:uuid_generate_v4()"`
	Code       string `gorm:"uniqueIndex;not null"`
	MonthKey   string `gorm:"uniqueIndex;not null"` // YYYY-MM
	ValidUntil time.Time
	CreatedAt  time.Time
}

// ProjectEnv represents environment variables
type ProjectEnv struct {
    ID        uint      `gorm:"primaryKey" json:"id"`
    ProjectID string    `gorm:"not null;type:uuid" json:"projectId"`
    Key       string    `gorm:"not null" json:"key"`
    Value     string    `gorm:"not null" json:"value"` // Stored encrypted in DB
    CreatedAt time.Time `json:"createdAt"`
}

// BeforeSave hook - encrypt value before saving to database
func (pe *ProjectEnv) BeforeSave(tx *gorm.DB) error {
    if pe.Value == "" {
        return nil
    }
    
    encrypted, err := crypto.Encrypt(pe.Value)
    if err != nil {
        return fmt.Errorf("failed to encrypt project env variable: %v", err)
    }
    pe.Value = encrypted
    return nil
}

// AfterFind hook - decrypt value after loading from database
func (pe *ProjectEnv) AfterFind(tx *gorm.DB) error {
    if pe.Value == "" {
        return nil
    }
    
    decrypted, err := crypto.Decrypt(pe.Value)
    if err != nil {
        fmt.Printf("[WARN] Failed to decrypt project env variable ID %d: %v\n", pe.ID, err)
        return nil
    }
    pe.Value = decrypted
    return nil
}

// DTOs

type CreateProjectRequest struct {
	Name    string            `json:"name"`
	RepoURL string            `json:"repoUrl"`
	Port    int               `json:"port"`
    Branch  string            `json:"branch"`
    EnvVars []EnvVarRequest   `json:"envVars"`
    EnvironmentIDs []string   `json:"environmentIds"`
}

type UpdateProjectRequest struct {
	Action  string            `json:"action"` // "start", "stop"
	Port    int               `json:"port"`
	EnvVars []EnvVarRequest   `json:"envVars"`
}

type EnvVarRequest struct {
    Key   string `json:"key"`
    Value string `json:"value"`
}

type ActivateRequest struct {
	InviteCode string `json:"inviteCode"`
}

type LoginResponse struct {
	User  User   `json:"user"`
	Token string `json:"token"`
}
