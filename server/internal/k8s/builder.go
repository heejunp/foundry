package k8s

import (
	"context"
	"fmt"
	"os"
	"strings"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// TriggerBuild creates a Kaniko Job to build the project
func TriggerBuild(projectID, repoURL, branch, token string, envVars map[string]string) error {
	if Client == nil {
		return fmt.Errorf("kubernetes client not initialized")
	}

	// sanitize project ID for k8s naming
	jobName := fmt.Sprintf("build-%s", projectID)
	namespace := "default" // TODO: isolated namespace per user
	
	// Registry Config
	registry := os.Getenv("CONTAINER_REGISTRY")
	if registry == "" {
		registry = "foundry-local" // Local registry or fallback
	}
	imageName := fmt.Sprintf("%s/%s:latest", registry, projectID)

	// Prepare git context with auth
	// Format: git://token@github.com/user/repo.git#refs/heads/branch
	authRepoURL := strings.Replace(repoURL, "https://", "", 1)
	gitContext := fmt.Sprintf("git://oauth2:%s@%s#refs/heads/%s", token, authRepoURL, branch)

	// Kaniko Job Spec
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name: jobName,
			Labels: map[string]string{
				"foundry-app": projectID,
				"type":        "build",
			},
		},
		Spec: batchv1.JobSpec{
			Template: corev1.PodTemplateSpec{
				Spec: corev1.PodSpec{
					RestartPolicy: corev1.RestartPolicyNever,
					Containers: []corev1.Container{
						{
							Name:  "kaniko",
							Image: "gcr.io/kaniko-project/executor:latest",
							Args: []string{
								"--context=" + gitContext,
								"--destination=" + imageName,
								"--cache=true",
							},
							Env: []corev1.EnvVar{
								// Add any necessary env vars for credentials if pushing to external registry
							},
						},
					},
				},
			},
			TTLSecondsAfterFinished: func(i int32) *int32 { return &i }(3600), // Clean up after 1 hour
		},
	}

	// Delete existing job if any (simple cleanup)
	background := metav1.DeletePropagationBackground
	_ = Client.BatchV1().Jobs(namespace).Delete(context.TODO(), jobName, metav1.DeleteOptions{
		PropagationPolicy: &background,
	})

	// Create new Job
	_, err := Client.BatchV1().Jobs(namespace).Create(context.TODO(), job, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to create build job: %w", err)
	}

	fmt.Printf("[K8s] Triggered build job: %s for repo: %s\n", jobName, repoURL)
	return nil
}
