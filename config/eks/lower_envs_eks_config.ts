import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import * as cdk from 'aws-cdk-lib';
//Intended Use: 
//EasyEKS Admins: edit this file with config to apply to all lower environment eks cluster's in your org.

export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack){ //config: is of type Easy_EKS_Config_Data
    config.setVpcByName("lower-envs-vpc", config, stack); //Name as in VPC's Name Tag
    //config.setVpcById("vpc-0dbcacb511f9bac4e", config, stack); //Alternative pre-existing VPC deployment option
    //config.addClusterAdminARN(`arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT!}:user/chrism`);
    //^--Note: identity referenced in ARN must exist or the deployment will fail
}
