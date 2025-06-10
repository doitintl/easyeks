import { Easy_EKS_Config_Data } from './Easy_EKS_Config_Data';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as kms from 'aws-cdk-lib/aws-kms';
import console = require('console'); 
import { sign } from 'crypto';
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class Storage_YAML_Generator{
                                    
    config: Easy_EKS_Config_Data;
    cluster: eks.Cluster; 
    constructor(input_parmeters: Partial<Storage_YAML_Generator>){ Object.assign(this, input_parmeters); }

    generate_storage_class_manifests(){
        let array_of_yaml_manifests_to_return: { [key:string]: any }[] = [];
        let config = this.config;
        const kms_key = config.kmsKey;
        const storage_class_gp3 = {
                "apiVersion": "storage.k8s.io/v1",
                "kind": "StorageClass",
                "metadata": {
                    "name": "kms-encrypted-gp3",
                    "annotations": {
                    "storageclass.kubernetes.io/is-default-class": "true"
                    }
                },
                "provisioner": "ebs.csi.aws.com",
                "volumeBindingMode": "WaitForFirstConsumer",
                "allowVolumeExpansion": true,
                "reclaimPolicy": "Delete",
                "parameters": {
                    "type": "gp3",
                    "encrypted": "true",
                    "kmsKeyId": `${kms_key.keyArn}`
                }
            }
        array_of_yaml_manifests_to_return.push(storage_class_gp3)    
        return array_of_yaml_manifests_to_return;
    } //end generate_manifests

    generate_volume_claim_manifests(name: string, size: string){
        let array_of_yaml_manifests_to_return: { [key:string]: any }[] = [];
        let cluster = this.cluster;
        const volume_claim_gp3 = {
                "apiVersion": "v1",
                "kind": "PersistentVolumeClaim",
                "metadata": {
                    "name": `${name}`,
                    "namespace": "default"
                },
                "spec": {
                    "accessModes": [
                    "ReadWriteMany"
                    ],
                    "storageClassName": "kms-encrypted-gp3",
                    "resources": {
                    "requests": {
                        "storage": `${size}`
                    }
                    }
                }
            } 
        array_of_yaml_manifests_to_return.push(volume_claim_gp3)    
        return array_of_yaml_manifests_to_return;
    } //end generate_manifests


} //end class Karepnter_Manifests

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function Apply_Storage_Class_YAMLs(stack: cdk.Stack, cluster: eks.Cluster, config: Easy_EKS_Config_Data,
    manifestName: string,storage_class_YAMLs: {[key: string]: any;}[]){
    const apply_storage_class_YAML = new eks.KubernetesManifest(stack, manifestName,
        {
            cluster: cluster,
            manifest: storage_class_YAMLs,
            overwrite: true,
            prune: true,   
        }
    );

// Test volume claim


} //end function Storage_YAML_Generator