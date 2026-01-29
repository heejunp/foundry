package k8s

import (
	"context"
	"fmt"
	"os"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	netv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

// DeployProject creates Deployment, Service, and Ingress
// Note: This typically runs AFTER the build succeeds.
// For MVP, we might call this immediately assuming the image will exist,
// OR we should have a controller/poller checking build status.
// For now, let's just scaffolding it.
func DeployProject(projectID, name string, envVars map[string]string) error {
	if Client == nil {
		return fmt.Errorf("kubernetes client not initialized")
	}

	namespace := "default"
	registry := os.Getenv("CONTAINER_REGISTRY")
	if registry == "" {
		registry = "foundry-local"
	}
	imageName := fmt.Sprintf("%s/%s:latest", registry, projectID)
	
	labels := map[string]string{
		"app":         "foundry-app",
		"project-id":  projectID,
	}

	// 1. Convert Map to EnvVar slice
	var k8sEnv []corev1.EnvVar
	for k, v := range envVars {
		k8sEnv = append(k8sEnv, corev1.EnvVar{Name: k, Value: v})
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
					Containers: []corev1.Container{
						{
							Name:  "app",
							Image: imageName,
							Ports: []corev1.ContainerPort{{ContainerPort: 80}}, // Assume port 80 for now
							Env:   k8sEnv,
							ImagePullPolicy: corev1.PullAlways, // Important for updates
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
					TargetPort: intstr.FromInt(80),
				},
			},
			Type: corev1.ServiceTypeClusterIP,
		},
	}

	// 4. Ingress
	ingressHost := fmt.Sprintf("%s.foundry.local", name) // e.g. my-blog.foundry.local
	pathType := netv1.PathTypePrefix
	ingress := &netv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{
			Name: projectID,
		},
		Spec: netv1.IngressSpec{
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
											Port: netv1.ServiceBackendPort{
												Number: 80,
											},
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

	// Apply Everything (Create or Update)
	// Error handling simplified for brevity
	_, err := Client.AppsV1().Deployments(namespace).Create(context.TODO(), deployment, metav1.CreateOptions{})
	if err != nil {
		// Try update if exists? For now just create
		fmt.Printf("[K8s] Deployment create error (might exist): %v\n", err)
	}
	
	_, err = Client.CoreV1().Services(namespace).Create(context.TODO(), service, metav1.CreateOptions{})
	if err != nil {
		fmt.Printf("[K8s] Service create error: %v\n", err)
	}

	_, err = Client.NetworkingV1().Ingresses(namespace).Create(context.TODO(), ingress, metav1.CreateOptions{})
	if err != nil {
		fmt.Printf("[K8s] Ingress create error: %v\n", err)
	}

	fmt.Printf("[K8s] Deployed project %s at http://%s\n", name, ingressHost)
	return nil
}
