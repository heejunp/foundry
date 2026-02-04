package k8s

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	netv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

// DeployProject creates Deployment, Service, and Ingress
// Note: This typically runs AFTER the build succeeds.
// For MVP, we might call this immediately assuming the image will exist,
// OR we should have a controller/poller checking build status.
// For now, let's just scaffolding it.
// DeployProject creates Deployment, Service, and Ingress with Secret-based EnvVars
// Updated: Uses CreateProjectSecret and EnvFrom for security.
func DeployProject(projectID, ownerID, name string, envVars map[string]string, targetPort int) (string, error) {
	if Client == nil {
		return "", fmt.Errorf("kubernetes client not initialized")
	}

	namespace := "apps"
	registry := os.Getenv("CONTAINER_REGISTRY")
	if registry == "" {
		registry = "foundry-local"
	}
	imageName := fmt.Sprintf("%s/%s:latest", registry, projectID)
	
	labels := map[string]string{
		"app":         "foundry-app",
		"project-id":  projectID,
		"owner-id":    ownerID,
	}

	// 1. Create/Update Secret
	secretName, err := CreateProjectSecret(namespace, projectID, ownerID, envVars)
	if err != nil {
		return "", fmt.Errorf("failed to create secret: %v", err)
	}

	// 2. Deployment
	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name: projectID,
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: func(i int32) *int32 { return &i }(1),
			Selector: &metav1.LabelSelector{
				MatchLabels: labels,
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: labels},
				Spec: corev1.PodSpec{
					NodeSelector: map[string]string{
						"role": "apps",
					},
					ImagePullSecrets: []corev1.LocalObjectReference{
						{Name: "regcred"},
					},
					Containers: []corev1.Container{
						{
							Name:  "app",
							Image: imageName,
							Ports: []corev1.ContainerPort{{ContainerPort: int32(targetPort)}},
							// Use EnvFrom to load all variables from the Secret
							EnvFrom: []corev1.EnvFromSource{
								{
									SecretRef: &corev1.SecretEnvSource{
										LocalObjectReference: corev1.LocalObjectReference{
											Name: secretName,
										},
									},
								},
							},
							ImagePullPolicy: corev1.PullAlways,
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse("1"),
									corev1.ResourceMemory: resource.MustParse("1Gi"),
								},
								Limits: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse("1"),
									corev1.ResourceMemory: resource.MustParse("1Gi"),
								},
							},
						},
					},
				},
			},
		},
	}

	// 3. Service
	service := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name: projectID,
		},
		Spec: corev1.ServiceSpec{
			Selector: labels,
			Ports: []corev1.ServicePort{
				{
					Protocol:   corev1.ProtocolTCP,
					Port:       80,
					TargetPort: intstr.FromInt(targetPort),
				},
			},
			Type: corev1.ServiceTypeClusterIP,
		},
	}

	// 4. Ingress
	ingressHost := fmt.Sprintf("%s-foundry.heejunp.com", projectID)
	pathType := netv1.PathTypePrefix
	ingressClassName := "nginx"

	ingress := &netv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{
			Name: projectID,
			Annotations: map[string]string{
				"cert-manager.io/cluster-issuer": "letsencrypt-prod",
			},
		},
		Spec: netv1.IngressSpec{
			IngressClassName: &ingressClassName,
			Rules: []netv1.IngressRule{
				{
					Host: ingressHost,
					IngressRuleValue: netv1.IngressRuleValue{
						HTTP: &netv1.HTTPIngressRuleValue{
							Paths: []netv1.HTTPIngressPath{
								{
									Path:     "/",
									PathType: &pathType,
									Backend: netv1.IngressBackend{
										Service: &netv1.IngressServiceBackend{
											Name: service.Name,
											Port: netv1.ServiceBackendPort{ Number: 80 },
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	// Apply Deployment
	_, err = Client.AppsV1().Deployments(namespace).Create(context.TODO(), deployment, metav1.CreateOptions{})
	if err != nil {
		if _, updateErr := Client.AppsV1().Deployments(namespace).Update(context.TODO(), deployment, metav1.UpdateOptions{}); updateErr != nil {
			fmt.Printf("[K8s] Deployment create/update error: %v\n", err)
		}
	}
	
	// Apply Service
	existingSvc, err := Client.CoreV1().Services(namespace).Get(context.TODO(), service.Name, metav1.GetOptions{})
	if err == nil {
		service.ResourceVersion = existingSvc.ResourceVersion
		service.Spec.ClusterIP = existingSvc.Spec.ClusterIP
		_, err = Client.CoreV1().Services(namespace).Update(context.TODO(), service, metav1.UpdateOptions{})
	} else {
		_, err = Client.CoreV1().Services(namespace).Create(context.TODO(), service, metav1.CreateOptions{})
	}
    if err != nil {
         fmt.Printf("[K8s] Service apply error: %v\n", err)
    }

	// Apply Ingress
	_, err = Client.NetworkingV1().Ingresses(namespace).Create(context.TODO(), ingress, metav1.CreateOptions{})
	if err != nil {
		if existingIngress, getErr := Client.NetworkingV1().Ingresses(namespace).Get(context.TODO(), ingress.Name, metav1.GetOptions{}); getErr == nil {
			ingress.ResourceVersion = existingIngress.ResourceVersion
			_, err = Client.NetworkingV1().Ingresses(namespace).Update(context.TODO(), ingress, metav1.UpdateOptions{})
		}
	}
	if err != nil {
		fmt.Printf("[K8s] Ingress apply error: %v\n", err)
	}

	fmt.Printf("[K8s] Deployed project %s with Secret %s\n", name, secretName)
	return fmt.Sprintf("http://%s", ingressHost), nil
}

// CreateProjectSecret creates or updates a Kubernetes Secret for the project
// Naming Convention: foundry-secret-{ownerID}-{projectID}
// This function implements proper upsert logic to ensure secrets are always up-to-date
func CreateProjectSecret(namespace, projectID, ownerID string, envVars map[string]string) (string, error) {
	secretName := fmt.Sprintf("foundry-secret-%s-%s", ownerID, projectID)

	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name: secretName,
			Labels: map[string]string{
				"project-id": projectID,
				"owner-id":   ownerID,
				"managed-by": "foundry",
				"type":       "project-secret",
			},
		},
		StringData: envVars, // StringData auto-encodes to Base64
		Type:       corev1.SecretTypeOpaque,
	}

	// Try to create the secret
	_, err := Client.CoreV1().Secrets(namespace).Create(context.TODO(), secret, metav1.CreateOptions{})
	if err != nil {
		// Secret already exists, fetch it to get ResourceVersion for update
		existingSecret, getErr := Client.CoreV1().Secrets(namespace).Get(context.TODO(), secretName, metav1.GetOptions{})
		if getErr != nil {
			return "", fmt.Errorf("failed to create or get existing secret: create_err=%v, get_err=%v", err, getErr)
		}

		// Update the secret with new data, preserving ResourceVersion
		secret.ResourceVersion = existingSecret.ResourceVersion
		_, updateErr := Client.CoreV1().Secrets(namespace).Update(context.TODO(), secret, metav1.UpdateOptions{})
		if updateErr != nil {
			return "", fmt.Errorf("failed to update secret %s: %v", secretName, updateErr)
		}
		fmt.Printf("[K8s] Updated project secret: %s (variables: %d)\n", secretName, len(envVars))
	} else {
		fmt.Printf("[K8s] Created project secret: %s (variables: %d)\n", secretName, len(envVars))
	}

	return secretName, nil
}

// CreateEnvironmentSecret creates or updates a Secret for a reusable environment group
// Naming Convention: foundry-env-{envID}
// This function implements proper upsert logic to ensure secrets are always up-to-date
func CreateEnvironmentSecret(envID, ownerID string, envVars map[string]string) error {
	if Client == nil {
		return fmt.Errorf("kubernetes client not initialized")
	}
	namespace := "apps"
	secretName := fmt.Sprintf("foundry-env-%s", envID)

	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name: secretName,
			Labels: map[string]string{
				"environment-id": envID,
				"owner-id":       ownerID,
				"type":           "environment-group",
				"managed-by":     "foundry",
			},
		},
		StringData: envVars,
		Type:       corev1.SecretTypeOpaque,
	}

	// Try to create the secret
	_, err := Client.CoreV1().Secrets(namespace).Create(context.TODO(), secret, metav1.CreateOptions{})
	if err != nil {
		// Secret already exists, fetch it to get ResourceVersion for update
		existingSecret, getErr := Client.CoreV1().Secrets(namespace).Get(context.TODO(), secretName, metav1.GetOptions{})
		if getErr != nil {
			return fmt.Errorf("failed to create or get existing secret: create_err=%v, get_err=%v", err, getErr)
		}

		// Update the secret with new data, preserving ResourceVersion
		secret.ResourceVersion = existingSecret.ResourceVersion
		_, updateErr := Client.CoreV1().Secrets(namespace).Update(context.TODO(), secret, metav1.UpdateOptions{})
		if updateErr != nil {
			return fmt.Errorf("failed to update secret %s: %v", secretName, updateErr)
		}
		fmt.Printf("[K8s] Updated environment secret: %s (variables: %d)\n", secretName, len(envVars))
	} else {
		fmt.Printf("[K8s] Created environment secret: %s (variables: %d)\n", secretName, len(envVars))
	}

	return nil
}

// DeleteEnvironmentSecret deletes the secret for an environment group
func DeleteEnvironmentSecret(envID string) error {
	if Client == nil {
		return nil
	}
	namespace := "apps"
	secretName := fmt.Sprintf("foundry-env-%s", envID)
	
	err := Client.CoreV1().Secrets(namespace).Delete(context.TODO(), secretName, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete secret %s: %v", secretName, err)
	}
	fmt.Printf("[K8s] Deleted environment secret: %s\n", secretName)
	return nil
}

// ScaleProject scales the deployment to the specified replicas
func ScaleProject(projectID string, replicas int32) error {
	if Client == nil {
		return fmt.Errorf("kubernetes client not initialized")
	}
	namespace := "apps"

	scale, err := Client.AppsV1().Deployments(namespace).GetScale(context.TODO(), projectID, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("failed to get scale for %s: %v", projectID, err)
	}

	scale.Spec.Replicas = replicas
	_, err = Client.AppsV1().Deployments(namespace).UpdateScale(context.TODO(), projectID, scale, metav1.UpdateOptions{})
	if err != nil {
		return fmt.Errorf("failed to update scale for %s: %v", projectID, err)
	}
	
	action := "started"
	if replicas == 0 {
		action = "stopped"
	}
	fmt.Printf("[K8s] Project %s %s (replicas: %d)\n", projectID, action, replicas)
	return nil
}

// DeleteProject deletes Deployment, Service, Ingress, and Secret
func DeleteProject(projectID string) error {
	if Client == nil {
		return fmt.Errorf("kubernetes client not initialized")
	}
	namespace := "apps"
	background := metav1.DeletePropagationBackground
	opts := metav1.DeleteOptions{PropagationPolicy: &background}
	var errs []string

	// 1. Delete Ingress
	if err := Client.NetworkingV1().Ingresses(namespace).Delete(context.TODO(), projectID, opts); err != nil {
		errs = append(errs, fmt.Sprintf("ingress: %v", err))
	}
	// 2. Delete Service
	if err := Client.CoreV1().Services(namespace).Delete(context.TODO(), projectID, opts); err != nil {
		errs = append(errs, fmt.Sprintf("service: %v", err))
	}
	// 3. Delete Deployment
	if err := Client.AppsV1().Deployments(namespace).Delete(context.TODO(), projectID, opts); err != nil {
		errs = append(errs, fmt.Sprintf("deployment: %v", err))
	}

	// 4. Delete Secret
	// We need to construct the secret name logic again or list secrets by label.
	// Since we delete by ProjectID, let's use LabelSelector to find the secret.
	secrets, err := Client.CoreV1().Secrets(namespace).List(context.TODO(), metav1.ListOptions{
		LabelSelector: fmt.Sprintf("project-id=%s", projectID),
	})
	if err == nil {
		for _, s := range secrets.Items {
			if err := Client.CoreV1().Secrets(namespace).Delete(context.TODO(), s.Name, opts); err != nil {
				errs = append(errs, fmt.Sprintf("secret %s: %v", s.Name, err))
			}
		}
	} else {
		errs = append(errs, fmt.Sprintf("list secrets: %v", err))
	}

	if len(errs) > 0 {
		return fmt.Errorf("cleanup errors: %s", fmt.Sprint(errs))
	}
	
	fmt.Printf("[K8s] Deleted project resources for %s\n", projectID)
	return nil
}

// GetPodLogs returns the logs of the first pod for a given project
func GetPodLogs(projectID string) (string, error) {
	if Client == nil {
		return "", fmt.Errorf("kubernetes client not initialized")
	}
	namespace := "apps"

	// 1. Get Pods for the project
	pods, err := Client.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{
		LabelSelector: fmt.Sprintf("project-id=%s", projectID),
	})
	if err != nil {
		return "", fmt.Errorf("failed to list pods: %v", err)
	}

	if len(pods.Items) == 0 {
		return "No pods found (deployment might be starting or stopped)", nil
	}

	// 2. Get Logs from the first pod
	podName := pods.Items[0].Name
	req := Client.CoreV1().Pods(namespace).GetLogs(podName, &corev1.PodLogOptions{
		TailLines: func(i int64) *int64 { return &i }(100), // Get last 100 lines
	})
	
	podLogs, err := req.DoRaw(context.TODO())
	if err != nil {
		return "", fmt.Errorf("failed to get logs: %v", err)
	}

	return string(podLogs), nil
}

// GetProjectStats returns CPU and Memory usage for the project
func GetProjectStats(projectID string) (map[string]string, error) {
	if Client == nil {
		return nil, fmt.Errorf("kubernetes client not initialized")
	}

	// 1. Get Pod Name
	pods, err := Client.CoreV1().Pods("apps").List(context.TODO(), metav1.ListOptions{
		LabelSelector: fmt.Sprintf("project-id=%s", projectID),
	})
	if err != nil || len(pods.Items) == 0 {
		return map[string]string{"cpu": "0", "memory": "0"}, nil // No pods running
	}
	podName := pods.Items[0].Name

	// 2. Call Metrics API (Raw)
	// format: /apis/metrics.k8s.io/v1beta1/namespaces/apps/pods/<podName>
	path := fmt.Sprintf("/apis/metrics.k8s.io/v1beta1/namespaces/apps/pods/%s", podName)
	
	data, err := Client.RESTClient().Get().AbsPath(path).DoRaw(context.TODO())
	if err != nil {
		// Metrics server might not be installed or pod not ready
		return map[string]string{"cpu": "0", "memory": "0"}, nil
	}



	// Minimal struct for parsing
	type PodMetrics struct {
		Containers []struct {
			Usage struct {
				CPU    string `json:"cpu"`
				Memory string `json:"memory"`
			} `json:"usage"`
		} `json:"containers"`
	}

	var metrics PodMetrics
	if err := json.Unmarshal(data, &metrics); err != nil {
		return map[string]string{"cpu": "Error", "memory": "Error"}, nil
	}

	if len(metrics.Containers) == 0 {
		return map[string]string{"cpu": "0", "memory": "0"}, nil
	}

	return map[string]string{
		"cpu":    metrics.Containers[0].Usage.CPU,
		"memory": metrics.Containers[0].Usage.Memory,
	}, nil
}
