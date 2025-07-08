import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks'
import {
  Apply_Podinfo_Helm_Chart,
  Apply_Podinfo_Http_Alb_YAML,
  Apply_Podinfo_Https_Alb_YAML,
  Podinfo_Helm_Config,
} from "../../lib/Podinfo_Manifests";

//Intended Use: 
//EasyEKS Admins: edit this file with config to apply to all dev / sandbox cluster's in your org.

export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack) { //config: is of type Easy_EKS_Config_Data
  config.addTag("Environment", "Dev");
}//end apply_config()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_dependencies(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster) {

}//end deploy_dependencies()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_workload_dependencies(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster){
    // This is an example of a workload that uses a PersistentVolumeClaim with a storage class that is encrypted
    // with AWS KMS key.
    // IMPORTANT: if the cdk insfrastructure is destroyed it will leave the volume orphans, and they will
    // need to be manually deleted.
    let name="test-claim-gp3";
    let size="10Gi";
    const volume_claim_gp3 = {
        "apiVersion": "v1",
        "kind": "PersistentVolumeClaim",
        "metadata": {
            "name": `${name}`,
            "namespace": "default"
        },
        "spec": {
            "accessModes": [
                "ReadWriteOnce"
            ],
            "storageClassName": "kms-encrypted-gp3",
            "resources": {
                "requests": {
                    "storage": `${size}`
                }
            }
        }
    }
    const pod_using_volume_claim = {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {
            "name": "app"
        },
        "spec": {
            "containers": [
                {
                    "name": "app",
                    "image": "ubuntu:latest",
                    "command": [
                        "/bin/sh"
                    ],
                    "args": [
                        "-c",
                        "while true; do echo $(date -u) >> /data/out.txt; sleep 5; done"
                    ],
                    "volumeMounts": [
                        {
                            "name": "persistent-storage",
                            "mountPath": "/data"
                        }
                    ]
                }
            ],
            "volumes": [
                {
                    "name": "persistent-storage",
                    "persistentVolumeClaim": {
                        "claimName": `${name}`
                    }
                }
            ]
        }
    }
    const pvc_demo_construct = new eks.KubernetesManifest(stack, "persistentVolumeClaimManifest",
    {
        cluster: cluster,
        manifest: [volume_claim_gp3, pod_using_volume_claim],
        overwrite: true,
        prune: true,
    });
    pvc_demo_construct.node.addDependency(cluster.awsAuth);
}//end deploy_workload_dependencies()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_workloads(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster) {
  // Define a BLUE podinfo application with insecure ALB (HTTP)
  const BLUE_PODINFO_HELM_CONFIG = {
    helm_chart_release: "podinfo-blue",
    helm_chart_values: {
      ui: {
        color: "#0000FF",
        message: "This is an insecure application with BLUE background",
      },
    } as Record<string, any>,
  } as Podinfo_Helm_Config

  // Deploy a podinfo sample application with BLUE background
  Apply_Podinfo_Helm_Chart(cluster, config, stack, BLUE_PODINFO_HELM_CONFIG);

  // Provisioning HTTP ALB, which includes HTTP ALB, Listener, Target Group, etc.
  Apply_Podinfo_Http_Alb_YAML(cluster, config, stack,
    BLUE_PODINFO_HELM_CONFIG)

  // Define a GREEN podinfo application with secure ALB (HTTPS)
  const GREEN_PODINFO_HELM_CONFIG = {
    helm_chart_release: "podinfo-green",
    helm_chart_values: {
      ui: {
        color: "#008000",
        message: "This is an secure application with GREEN background",
      },
    } as Record<string, any>,
  } as Podinfo_Helm_Config

  // Deploy a podinfo sample application with GREEN background
  Apply_Podinfo_Helm_Chart(cluster, config, stack, GREEN_PODINFO_HELM_CONFIG);

  // Generate HTTPS ingress manifest
  /**
   * TODO: due to DNS ACME challenge, we just use the existing ACME's ARN and subdomain
   * To make this happen, you need to do:
   * 1. Prepare a domain or sub-domain
   * 2. Create a certificate in ACM for the domain / sub-domain
   * 3. Create CNAME to verify the certificate successfully
   * 4. Get the ARN of the certificate
   * 5. Deploy the stack
   * 6. After ALB is provisioned, create a CNAME record of the domain/sub-domain with the value in the DNS hostname of the ALB
   */
  // const https_ingress_yaml = Podinfo_Https_Ingress_Yaml_Generator(
  //   GREEN_PODINFO_HELM_CONFIG,
  //   // ACME ARN
  //   "arn:aws:acm:ap-southeast-2:092464092456:certificate/a2e016d5-58fb-4308-b894-f7a21f7df0b8",
  //   // Sub-domain
  //   "kefeng-easyeks.gcp.au-pod-1.cs.doit-playgrounds.dev",
  // )

  // kubectl apply manifest
//   Apply_Podinfo_Https_Alb_YAML(cluster, config, stack,
//     GREEN_PODINFO_HELM_CONFIG,
//     "arn:aws:acm:ap-southeast-2:092464092456:certificate/a2e016d5-58fb-4308-b894-f7a21f7df0b8")
}//end deploy_workloads()
