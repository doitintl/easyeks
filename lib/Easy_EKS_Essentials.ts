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


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export class Easy_EKS_Essentials{ //purposefully don't extend stack, to implement builder pattern and give more flexibility for imperative logic.

    //Class Variables/Properties:
    stack: cdk.Stack;
    cluster: eks.ICluster;

    //Class Constructor:
    constructor(storage_for_stacks_state: Construct, cluster_name: string, stack_config: cdk.StackProps) {
        this.stack = new cdk.Stack(storage_for_stacks_state, `${cluster_name}-essentials`, stack_config);
    }//end constructor of Easy_EKS_Essentials

    //Class Functions:
    initalize_imported_cluster_in_stack(stack: cdk.Stack, cluster_name: string, aws_lambda_layer_with_kubectl_and_helm: cdk.aws_lambda.ILayerVersion){//better for decoupling & separation of concerns
        //Workaround for CDK Oddity:
        //An imported eks.ICluster must be created with a eks.KubectlProvider, in order to run kubectl & helm against the imported cluster
        //Creation of cdk object of type eks.KubectlProvider requires an initialized object of type eks.ICluster
        if(!aws_lambda_layer_with_kubectl_and_helm){
            console.log('* Error Context:');
            console.log('  * Where:');
            console.log('    Easy_EKS_Essentials.import_cluster_into_stack(stack, cluster_name, aws_lambda_layer_with_kubectl_and_helm)');
            console.log('  * What:');
            console.log('    Variable aws_lambda_layer_with_kubectl_and_helm was detected to have an undefined value');
            console.log('  * Why:');
            console.log('    You are seeing this clear and left shifted (fast feedback error), instead of a delayed cryptic cdk errors like:');
            console.log('    No such file or directory: \'kubectl\'');
            console.log('    No such file or directory: \'helm\'');
            console.log('  * Possible Reason:');
            console.log('    Did you pass in the variable from a config object?');
            console.log('    as in: config.kubectlLayer, if so, then you may have called this method too soon.');
            console.log('    Specifically before Easy_EKS_Config_Data config object was fully initialized.');
            throw "User fixable error detected, see notes above."
        }
        let imported_cluster: eks.ICluster;
        const temp_eks_construct_for_kubectl_provider = eks.Cluster.fromClusterAttributes(stack, 'eks.KubectlProvider', {
            clusterName: cluster_name,
            kubectlLayer: aws_lambda_layer_with_kubectl_and_helm,
            kubectlRoleArn: `arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT}:role/kubectl-helm-lambda-deployer-role-used-by-easy-eks`,
        });
        const kubectl_provider = eks.KubectlProvider.getOrCreate(stack, temp_eks_construct_for_kubectl_provider);
        cdk.Tags.of(kubectl_provider.handlerRole).add('whitelisted-role-for-assuming', 'easy-eks-generated-kubectl-helm-deployer-lambda-role'); //used in a whitelist condition
        imported_cluster = eks.Cluster.fromClusterAttributes(stack, 'imported-eks-cluster', {
            clusterName: cluster_name,
            kubectlProvider: kubectl_provider,
            kubectlRoleArn: `arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT}:role/kubectl-helm-lambda-deployer-role-used-by-easy-eks`,
        });
        this.cluster = imported_cluster;
        //Note: If you're wondering why this code is implemented with an imported_cluster:
        //      Easy_EKS v0.5.0 originally ran cdk equivalent kubectl apply & helm install against the created cluster
        //      During development, cdk specific scalability limits around max response size and timeouts, were frequently hit.
        //      So Easy_EKS v0.6.0 was refactored to have kubectl and helm logic run against an imported eks cluster, in order
        //      to avoid cdk specific scalability limits. It also mitigated other issues and lead to multiple UX improvements.
    }    
    //v-- these depend on config being initialized (must be called after the above, Easy_EKS.ts's global_baseline was tweaked to make this less of an issue.)
    stage_deployment_of_global_baseline_eks_essentials(config: Easy_EKS_Config_Data){ global_baseline_eks_config.deploy_essentials(config, this.stack, this.cluster); }
    stage_deployment_of_my_orgs_baseline_eks_essentials(config: Easy_EKS_Config_Data){ my_orgs_baseline_eks_config.deploy_essentials(config, this.stack, this.cluster); }
    stage_deployment_of_lower_envs_eks_essentials(config: Easy_EKS_Config_Data){ lower_envs_eks_config.deploy_essentials(config, this.stack, this.cluster); }
    stage_deployment_of_higher_envs_eks_essentials(config: Easy_EKS_Config_Data){ higher_envs_eks_config.deploy_essentials(config, this.stack, this.cluster); }
    stage_deployment_of_dev_eks_essentials(config: Easy_EKS_Config_Data){ dev_eks_config.deploy_essentials(config, this.stack, this.cluster); }
    stage_deployment_of_test_eks_essentials(config: Easy_EKS_Config_Data){ test_eks_config.deploy_essentials(config, this.stack, this.cluster); }
    stage_deployment_of_stage_eks_essentials(config: Easy_EKS_Config_Data){ stage_eks_config.deploy_essentials(config, this.stack, this.cluster); }
    stage_deployment_of_prod_eks_essentials(config: Easy_EKS_Config_Data){ prod_eks_config.deploy_essentials(config, this.stack, this.cluster); }
}//end class Easy_EKS_Essentials
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
