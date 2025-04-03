import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import * as cdk from 'aws-cdk-lib';
//Intended Use: 
//EasyEKS Admins: edit this file with config to apply to all dev cluster's in your org.

export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack){ //config: is of type Easy_EKS_Config_Data
    config.addTag("Environment", "Dev");
}
