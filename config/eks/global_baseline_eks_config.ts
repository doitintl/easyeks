import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as eks from 'aws-cdk-lib/aws-eks';
import request from 'sync-request-curl'; //npm install sync-request-curl (cdk requires sync functions, async not allowed)
//Intended Use: 
//A baseline config file (to be applied to all EasyEKS Clusters)
//That 95% of global users will feel comfortable using with 0 changes, but can change.

//export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster){ //config: is of type Easy_EKS_Config_Data
export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack){ //config: is of type Easy_EKS_Config_Data    
    config.addTag("IaC Tooling used for Provisioning and Management of this EKS Cluster", "cdk: a CLI tool that stands for AWS Cloud Development Kit.");
    config.addTag("Upstream Methodology Docs", "https://github.com/doitintl/easyeks");
    //^-- NOTE: AWS tag restrictions vary by service, but generally only letters, numbers, spaces, and the following characters are allowed: + - = . _ : / @
    //    Tags are validated by the validateTag() function in lib/Utilities.ts before deployment
    //    More details:
    //      - https://docs.aws.amazon.com/eks/latest/userguide/eks-using-tags.html#tag-restrictions
    //      - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Using_Tags.html#tag-restrictions
    
}//end apply_config()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_addons(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.ICluster){

    /*To see official names of all eks add-ons:
    aws eks describe-addon-versions  \
    --kubernetes-version=1.31 \
    --query 'sort_by(addons  &owner)[].{owner: owner, addonName: addonName}' \
    --output table
    */
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // NOTICE: Don't add eks-pod-identity-agent addon
    // It's purposefully left out to work around CDK bug https://github.com/aws/aws-cdk/issues/32580
    // The cdk bug relates to an error where there's a complaint about it already being present, if 2 things try to install it.
    // The AWS Load Balancer Controller installation logic, will trigger the installation of eks-pod-identity-agent addon.
    // https://github.com/aws/aws-cdk/pull/33891
    // ^-- A fix is actively being worked on, but not yet available.
    // Note the IaC will deploy default (which isn't latest)
    // but if you manually update in GUI it'll stay updated
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}//end deploy_addons()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_essentials(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.ICluster){

}//end deploy_essentials()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_workloads(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.ICluster){

}//end deploy_workloads()
