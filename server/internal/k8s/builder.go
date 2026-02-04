package k8s

import (
	"context"
	"fmt"
	"foundry-server/internal/database"
	"foundry-server/internal/model"
	"os"
	"strings"
	"time"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// TriggerBuild creates a Kaniko Job to build the project and watches it
func TriggerBuild(projectID, ownerID, projectName, repoURL, branch, token string, envVars map[string]string, port int) error {
	if Client == nil {
		return fmt.Errorf("kubernetes client not initialized")
	}

	// sanitize project ID for k8s naming
	jobName := fmt.Sprintf("build-%s", projectID)
	namespace := "apps" // User requested 'apps' namespace
	
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
					NodeSelector: map[string]string{
						"role": "apps",
					},
					Volumes: []corev1.Volume{
						{
							Name: "docker-config",
							VolumeSource: corev1.VolumeSource{
								Secret: &corev1.SecretVolumeSource{
									SecretName: "regcred",
									Items: []corev1.KeyToPath{
										{
											Key:  ".dockerconfigjson",
											Path: "config.json",
										},
									},
								},
							},
						},
					},
					Containers: []corev1.Container{
						{
							Name:  "kaniko",
							Image: "gcr.io/kaniko-project/executor:latest",
							Args: []string{
								"--context=" + gitContext,
								"--destination=" + imageName,
								"--cache=true",
							},
							VolumeMounts: []corev1.VolumeMount{
								{
									Name:      "docker-config",
									MountPath: "/kaniko/.docker",
								},
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

	// Start Watcher Goroutine
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		timeout := time.After(20 * time.Minute) // 20 min timeout

		for {
			select {
			case <-timeout:
				fmt.Printf("[K8s] Build timed out for %s\n", jobName)
				updateProjectStatus(projectID, "error", "")
				return
			case <-ticker.C:
				j, err := Client.BatchV1().Jobs(namespace).Get(context.TODO(), jobName, metav1.GetOptions{})
				if err != nil {
					fmt.Printf("[K8s] Error getting job %s: %v\n", jobName, err)
					continue
				}

				if j.Status.Succeeded > 0 {
					fmt.Printf("[K8s] Build succeeded for %s. Deploying...\n", jobName)
					
					// Update status
					updateProjectStatus(projectID, "deploying", "")

					// Trigger Deployment
					deployURL, err := DeployProject(projectID, ownerID, projectName, envVars, port)
					
					if err != nil {
						fmt.Printf("[K8s] Deploy failed for %s: %v\n", projectName, err)
						updateProjectStatus(projectID, "error", "")
					} else {
						updateProjectStatus(projectID, "running", deployURL)
					}
					return
				}

				if j.Status.Failed > 0 {
					fmt.Printf("[K8s] Build failed for %s\n", jobName)
					updateProjectStatus(projectID, "error", "")
					return
				}
			}
		}
	}()

	return nil
}

func updateProjectStatus(projectID, status, deployURL string) {
	if database.DB != nil {
		updates := map[string]interface{}{"status": status}
		if deployURL != "" {
			updates["deploy_url"] = deployURL
		}
		database.DB.Model(&model.Project{}).Where("id = ?", projectID).Updates(updates)
	}
}
