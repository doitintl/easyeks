export function config_for_coreds_eks_addon(min_replicas:number) {
    let recommended_config = 
        `{
            "autoScaling": {
              "enabled": true,
              "minReplicas": ${min_replicas},
              "maxReplicas": 1000
            },
            "affinity": {
              "nodeAffinity": {
                "requiredDuringSchedulingIgnoredDuringExecution": {
                  "nodeSelectorTerms": [
                    {
                      "matchExpressions": [
                        {
                          "key": "kubernetes.io/os",
                          "operator": "In",
                          "values": [
                            "linux"
                          ]
                        },
                        {
                          "key": "kubernetes.io/arch",
                          "operator": "In",
                          "values": [
                            "amd64",
                            "arm64"
                          ]
                        }
                      ]
                    }
                  ]
                }
              },
              "podAntiAffinity": {
                "requiredDuringSchedulingIgnoredDuringExecution": [
                  {
                    "labelSelector": {
                      "matchExpressions": [
                        {
                          "key": "k8s-app",
                          "operator": "In",
                          "values": [
                            "kube-dns"
                          ]
                        }
                      ]
                    },
                    "topologyKey": "kubernetes.io/hostname"
                  }
                ]
              }
            }
        }`; //end CoreDNS configurationValues override
    return recommended_config;
} //end config_for_coreds_eks_addon()
