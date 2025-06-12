import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks'
import * as iam from 'aws-cdk-lib/aws-iam';
import request from 'sync-request-curl'; //npm install sync-request-curl (cdk requires sync functions, async not allowed)
//Intended Use: 
//EasyEKS Admins: edit this file with config to apply to all dev / sandbox cluster's in your org.

export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack){ //config: is of type Easy_EKS_Config_Data
    config.addTag("Environment", "Dev");
}//end apply_config()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_dependencies(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster){

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

export function deploy_workloads(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster){

}//end deploy_workloads()