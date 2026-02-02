package k8s

import (
	"context"
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
func DeployProject(projectID, name string, envVars map[string]string, targetPort int) (string, error) {
	if Client == nil {
		return "", fmt.Errorf("kubernetes client not initialized")
	}

	namespace := "apps" // User requested 'apps' namespace
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
							Ports: []corev1.ContainerPort{{ContainerPort: int32(targetPort)}}, // User defined port
							Env:   k8sEnv,
							ImagePullPolicy: corev1.PullAlways, // Important for updates
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
	// Hostname format: project-id.foundry.heejunp.com
	ingressHost := fmt.Sprintf("%s-foundry.heejunp.com", projectID)
	
	pathType := netv1.PathTypePrefix
	ingressClassName := "nginx"

	ingress := &netv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{
			Name: projectID,
			Annotations: map[string]string{
				// "kubernetes.io/ingress.class": "nginx",
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
	return fmt.Sprintf("http://%s", ingressHost), nil
}

// DeleteProject deletes Deployment, Service, and Ingress
func DeleteProject(projectID string) error {
	if Client == nil {
		return fmt.Errorf("kubernetes client not initialized")
	}
	namespace := "apps"

	// Delete Options (PropagationBackground cleans up child pods)
	background := metav1.DeletePropagationBackground
	opts := metav1.DeleteOptions{PropagationPolicy: &background}

	var errs []string

	// Delete Ingress
	if err := Client.NetworkingV1().Ingresses(namespace).Delete(context.TODO(), projectID, opts); err != nil {
		errs = append(errs, fmt.Sprintf("ingress: %v", err))
	}
	// Delete Service
	if err := Client.CoreV1().Services(namespace).Delete(context.TODO(), projectID, opts); err != nil {
		errs = append(errs, fmt.Sprintf("service: %v", err))
	}
	// Delete Deployment
	if err := Client.AppsV1().Deployments(namespace).Delete(context.TODO(), projectID, opts); err != nil {
		errs = append(errs, fmt.Sprintf("deployment: %v", err))
	}

	if len(errs) > 0 {
		return fmt.Errorf("cleanup errors: %s", fmt.Sprint(errs))
	}
	
	fmt.Printf("[K8s] Deleted project resources for %s\n", projectID)
	return nil
}
