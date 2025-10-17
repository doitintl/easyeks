export function config_for_metrics_server_eks_addon (replicas:number) {
    let recommended_config = 
        `{
            "replicas": ${replicas},
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
                          "key": "app.kubernetes.io/name",
                          "operator": "In",
                          "values": [
                            "metrics-server"
                          ]
                        }
                      ]
                    },
                    "topologyKey": "kubernetes.io/hostname"
                  }
                ]
              }
            }
        }`; //end metrics-server configurationValues override
    return recommended_config;
}//end config_for_metrics_server_eks_addon()
