package k8s

import (
	"fmt"
	"os"
	"path/filepath"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
)

var Client *kubernetes.Clientset

// InitK8s initializes the Kubernetes client
// It first tries In-Cluster config, then falls back to local kubeconfig
func InitK8s() error {
	var config *rest.Config
	var err error

	// 1. Try In-Cluster Config
	config, err = rest.InClusterConfig()
	if err != nil {
		fmt.Println("[K8s] In-Cluster config failed, trying local kubeconfig...")
		
		// 2. Fallback to Local Kubeconfig
		var kubeconfig string
		if home := homedir.HomeDir(); home != "" {
			kubeconfig = filepath.Join(home, ".kube", "config")
		} else {
			kubeconfig = os.Getenv("KUBECONFIG")
		}

		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return fmt.Errorf("failed to load kubeconfig: %w", err)
		}
	}

	// Create the clientset
	Client, err = kubernetes.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create k8s client: %w", err)
	}

	// Verify connection
	version, err := Client.Discovery().ServerVersion()
	if err != nil {
		fmt.Printf("[K8s] Warning: Failed to connect to cluster: %v\n", err)
		// We don't return error here to allow server to start even if K8s is down
		return nil
	}

	fmt.Printf("[K8s] Connected to cluster version: %s\n", version)
	return nil
}
