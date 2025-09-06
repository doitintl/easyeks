//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//AWS CDK Imports:
import { Construct, IConstruct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import { KubectlV31Layer } from '@aws-cdk/lambda-layer-kubectl-v31'; //npm install @aws-cdk/lambda-layer-kubectl-v31
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Config Library Imports:
import * as global_baseline_eks_config from '../config/eks/global_baseline_eks_config';
import * as my_orgs_baseline_eks_config from '../config/eks/my_orgs_baseline_eks_config';
import * as lower_envs_eks_config from '../config/eks/lower_envs_eks_config';
import * as higher_envs_eks_config from '../config/eks/higher_envs_eks_config';
import * as dev_eks_config from '../config/eks/dev_eks_config';
import * as test_eks_config from '../config/eks/test_eks_config';
import * as stage_eks_config from '../config/eks/stage_eks_config';
import * as prod_eks_config from '../config/eks/prod_eks_config';
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Utility Imports:
import console = require('console'); //can help debug feedback loop, allows `console.log("hi");` to work, when `cdk list` is run.
import * as shell from 'shelljs'; //npm install shelljs && npm i --save-dev @types/shelljs
import request from 'sync-request-curl'; //npm install sync-request-curl (cdk requires sync functions, async not allowed)
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Local Library Imports:
import { Easy_EKS_Config_Data } from './Easy_EKS_Config_Data';
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



export class Easy_EKS_Essentials{ //purposefully don't extend stack, to implement builder pattern and give more flexibility for imperative logic.

    //Class Variables/Properties:
    stack: cdk.Stack;
    config: Easy_EKS_Config_Data;
    cluster_exists: boolean;
    cluster: eks.ICluster;

    //Class Constructor:
    constructor(storage_for_stacks_state: Construct, cluster_name: string, stack_config: cdk.StackProps, eks_config: Easy_EKS_Config_Data) {
        this.stack = new cdk.Stack(storage_for_stacks_state, `${cluster_name}-essentials`, stack_config);
        this.config = eks_config;
        this.cluster_exists = true_when_cluster_exists(cluster_name, this.stack.region);
        if(this.cluster_exists){
            this.cluster = import_cluster_into_stack(this.config, this.stack); 
        };
    }//end constructor of Easy_EKS_Essentials

    //Class Functions:
    stage_deployment_of_global_baseline_eks_essentials(){ global_baseline_eks_config.deploy_essentials(this.config, this.stack, this.cluster); }
    stage_deployment_of_my_orgs_baseline_eks_essentials(){ my_orgs_baseline_eks_config.deploy_essentials(this.config, this.stack, this.cluster); }
    stage_deployment_of_lower_envs_eks_essentials(){ lower_envs_eks_config.deploy_essentials(this.config, this.stack, this.cluster); }
    stage_deployment_of_higher_envs_eks_essentials(){ higher_envs_eks_config.deploy_essentials(this.config, this.stack, this.cluster); }
    stage_deployment_of_dev_eks_essentials(){ dev_eks_config.deploy_essentials(this.config, this.stack, this.cluster); }
    stage_deployment_of_test_eks_essentials(){ test_eks_config.deploy_essentials(this.config, this.stack, this.cluster); }
    stage_deployment_of_stage_eks_essentials(){ stage_eks_config.deploy_essentials(this.config, this.stack, this.cluster); }
    stage_deployment_of_prod_eks_essentials(){ prod_eks_config.deploy_essentials(this.config, this.stack, this.cluster); }

}//end class Easy_EKS_Essentials
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function import_cluster_into_stack(config: Easy_EKS_Config_Data, stack: cdk.Stack){//better for decoupling & separation of concerns
    //Workaround for CDK Oddity:
    //An imported eks.ICluster must be created with a eks.KubectlProvider, in order to run kubectl & helm against the imported cluster
    //Creation of cdk object of type eks.KubectlProvider requires an initialized object of type eks.ICluster
    let cluster: eks.ICluster;
    const temp_eks_construct_for_kubectl_provider = eks.Cluster.fromClusterAttributes(stack, 'eks.KubectlProvider', {
        clusterName: "test",
        kubectlLayer: new KubectlV31Layer(stack, 'kubectl'),
        kubectlRoleArn: 'arn:aws:iam::090622937654:role/kubectl-helm-lambda-deployer-role-used-by-easy-eks',
    });
    const kubectl_provider = eks.KubectlProvider.getOrCreate(stack, temp_eks_construct_for_kubectl_provider);
    cdk.Tags.of(kubectl_provider.handlerRole).add('whitelisted-role-for-assuming', 'easy-eks-generated-kubectl-helm-deployer-lambda-role'); //used in a whitelist condition
    cluster = eks.Cluster.fromClusterAttributes(stack, 'imported-eks-cluster', {
        clusterName: "test",
        kubectlProvider: kubectl_provider,
        kubectlRoleArn: 'arn:aws:iam::090622937654:role/kubectl-helm-lambda-deployer-role-used-by-easy-eks',
    });
//    this.kubectl_helm_lambda_handler_iam_role_for_easy_eks.grantAssumeRole(kubectl_provider.handlerRole);

    return cluster;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function true_when_cluster_exists(cluster_name: string, region: string){
    const cmd = `aws eks describe-cluster --name=${cluster_name} --region=${region}`
    const cmd_return_code = shell.exec(cmd, {silent:true}).code;
    if(cmd_return_code===0){ return true; } //return code 0 = pre-existing cluster found
    else{ return false; } //return code 254 = cluster not found
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


        // //v-- This achieve similar yet better results than commented out mastersRole
        // const msg = `aws eks update-kubeconfig --region ${this.stack.region} --name ${this.config.cluster_name}\n\n` +
        // 'Note: This only works for the user/role deploying cdk and IAM Whitelisted Admins.\n'+
        // '      To learn more review ./easyeks/config/eks/lower_envs_eks_config.ts';
        // const output_msg = new cdk.CfnOutput(this.stack, 'iamWhitelistedKubeConfigCmd', { value: msg });
