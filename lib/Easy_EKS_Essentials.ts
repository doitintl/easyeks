import console = require('console'); //can help debug feedback loop, allows `console.log("hi");` to work, when `cdk list` is run.
import { Construct, IConstruct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as eksv2 from '@aws-cdk/aws-eks-v2-alpha'; //npm install @aws-cdk/aws-eks-v2-alpha
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Easy_EKS_Config_Data } from './Easy_EKS_Config_Data';
//Config Library Imports:
import * as global_baseline_eks_config from '../config/eks/global_baseline_eks_config';
import * as my_orgs_baseline_eks_config from '../config/eks/my_orgs_baseline_eks_config';
import * as lower_envs_eks_config from '../config/eks/lower_envs_eks_config';
import * as higher_envs_eks_config from '../config/eks/higher_envs_eks_config';
import * as dev_eks_config from '../config/eks/dev_eks_config';
import * as test_eks_config from '../config/eks/test_eks_config';
import * as stage_eks_config from '../config/eks/stage_eks_config';
import * as prod_eks_config from '../config/eks/prod_eks_config';
import * as observability from './Frugal_GPL_Observability_Stack';
import * as shell from 'shelljs'; //npm install shelljs && npm i --save-dev @types/shelljs
import request from 'sync-request-curl'; //npm install sync-request-curl (cdk requires sync functions, async not allowed)
import { KubectlV31Layer } from '@aws-cdk/lambda-layer-kubectl-v31'; //npm install @aws-cdk/lambda-layer-kubectl-v31

export class Easy_EKS_Essentials{ //purposefully don't extend stack, to implement builder pattern and give more flexibility for imperative logic.

    //Class Variables/Properties:
    eks_essentials_stack: cdk.Stack; //production readiness dependencies (karpenter, AWS LB Controller, node local dns cache, storage class, observability, etc.)
    config: Easy_EKS_Config_Data;
    pre_existing_cluster: eks.ICluster;

    //Class Constructor:
    constructor(storage_for_stacks_state: Construct, id_for_stack_and_eks_cluster: string, stack_config: cdk.StackProps) {
        this.eks_essentials_stack = new cdk.Stack(storage_for_stacks_state, `${id_for_stack_and_eks_cluster}-essentials3`, stack_config);
        this.config = new Easy_EKS_Config_Data(id_for_stack_and_eks_cluster);

        // TO DO: Import cluster that supports kubectl 
        // https://github.com/aws/aws-cdk/issues/23409#issuecomment-1409347474
        const kubectl_Lambda_Handler_IAM_Role: iam.Role  = initialize_Kubectl_Lambda_Handler_IAM_Role(this.eks_essentials_stack);
        const kubectl_layer = new KubectlV31Layer(this.eks_essentials_stack, 'kubectl');

///---
        // cdk workaround https://github.com/aws/aws-cdk/issues/23409#issuecomment-1409347474
        const cdk_workaround = eks.Cluster.fromClusterAttributes(this.eks_essentials_stack, `cdk_workaround_temp_cluster_to_generate_kubectl_provider`, {
            clusterName: 'temp',
            kubectlRoleArn: kubectl_Lambda_Handler_IAM_Role.roleArn, //iam role with kubectl cluster admin permissions (needed for kubectl access)
            kubectlLayer: kubectl_layer,
        });

        this.config.setVpcById('vpc-0b612c0311610627b', this.config, this.eks_essentials_stack);

        const kubectl_provider = eks.KubectlProvider.getOrCreate(this.eks_essentials_stack, cdk_workaround);
///---

        this.pre_existing_cluster = eks.Cluster.fromClusterAttributes(this.eks_essentials_stack, `${this.config.id}-cluster`, {
            vpc: this.config.vpc,
            clusterName: this.config.id,
            kubectlRoleArn: kubectl_Lambda_Handler_IAM_Role.roleArn,
            kubectlLayer: kubectl_layer,
            kubectlProvider: kubectl_provider,
        });
        let cluster1: cdk.aws_eks.ICluster = this.pre_existing_cluster;

//NEW CLUSTER -v
        const eks_v2_cluster = new eksv2.Cluster(this.eks_essentials_stack, 'eks_v2_cluster', {
            version: eksv2.KubernetesVersion.V1_31,
            kubectlProviderOptions: {kubectlLayer: new KubectlV31Layer(this.eks_essentials_stack, 'kubectlv2')},
        });
        //it became an autopilot cluster...
        //it's kubectl provider has 2 parts
        //Handler: dev1-eks-essentials3-eksv2clusterKubectlProviderHa-3ba0Dg1MoJ8v 
        // Description: onEvent handler for EKS kubectl resource provider
        //         arn:aws:lambda:ca-central-1:090622937654:function:dev1-eks-essentials3-eksv2clusterKubectlProviderHa-3ba0Dg1MoJ8v
          // ^-- This one looks correct to me
        //Provider (framework-onEvent): dev1-eks-essentials3-eksv2clusterKubectlProviderfr-iFvhallgDqu7
        //         arn:aws:lambda:ca-central-1:090622937654:function:dev1-eks-essentials3-eksv2clusterKubectlProviderfr-iFvhallgDqu7
//

        //let function_arn1 = cdk.aws_lambda.Function.fromFunctionName(this.eks_essentials_stack, "ProviderOnEventFunc1", "ProviderframeworkonEvent-XXX").functionArn; 
        // ^-- ERROR: //DOES NOT EXIST
        //let function_arn2 = cdk.aws_lambda.Function.fromFunctionName(this.eks_essentials_stack, "ProviderOnEventFunc2", "dev1-eks-cluster-awscdkaw-ProviderframeworkonEvent-dolYQLkBLZjE").functionArn;
        // ^-- ERROR: Received response status [FAILED] from custom resource. Message returned: Unsupported resource type "Custom::AWSCDK-EKS-KubernetesResource
        //let function_arn2 = cdk.aws_lambda.Function.fromFunctionName(this.eks_essentials_stack, "ProviderOnEventFunc2", eks_v2_cluster.kubectlProvider?.serviceToken!).functionArn;
        // ^-- console.log(function_arn2); //token BS
        let function_arn2 = "arn:aws:lambda:ca-central-1:090622937654:function:dev1-eks-essentials3-eksv2clusterKubectlProviderHa-3ba0Dg1MoJ8v";

        const kubectlProvider2: eksv2.KubectlProvider = eksv2.KubectlProvider.fromKubectlProviderAttributes(
            this.eks_essentials_stack, "kubectl-provider-v2", {
               serviceToken: function_arn2,
               role: kubectl_Lambda_Handler_IAM_Role,
        });
        const cluster2 = eksv2.Cluster.fromClusterAttributes(
            this.eks_essentials_stack, "cluster2", {
                clusterName: "dev1-eks",
                kubectlProvider: kubectlProvider2,
            }
        );

        let name = "";
        name = "";
        


        const volume_claim_gp3 = {
            "apiVersion": "v1",
            "kind": "PersistentVolumeClaim",
            "metadata": {
                "name": `test`,
                "namespace": "default"
            },
            "spec": {
                "accessModes": [
                    "ReadWriteOnce"
                ],
                "storageClassName": "kms-encrypted-gp3",
                "resources": {
                    "requests": {
                        "storage": `10Gi`
                    }
                }
            }
        }
        if(name === "1"){      
            const pvc_demo_construct = new eks.KubernetesManifest(this.eks_essentials_stack, "persistentVolumeClaimManifest",
            {
                cluster: cluster1,
                manifest: [volume_claim_gp3],
                overwrite: true,
                prune: true,
            });
        }

        if(name === "2"){      
            const pvc_demo_construct = new eksv2.KubernetesManifest(this.eks_essentials_stack, "persistentVolumeClaimManifest",
            {
                cluster: cluster2,
                manifest: [volume_claim_gp3],
                overwrite: true,
                prune: true,
            });
        }

        ////////////////
        // get the serviceToken from the custom resource provider
        //const functionArn = lambda.Function.fromFunctionName(this.eks_essentials_stack, 'ProviderOnEventFunc', 'ProviderframeworkonEvent-XXX').functionArn;
        
        //const kubectlProvider2 = eks.KubectlProvider.getOrCreate(this.eks_essentials_stack, )

        // const kubectlProvider = eks.KubectlProvider.fromKubectlProviderAttributes(this.eks_essentials_stack, 'KubectlProvider', {
        //   functionArn,
        //   kubectlRoleArn: 'arn:aws:iam::090622937654:role/dev1-eks-cluster-dev1eksKubectlHandlerRoleE4463AF7-ba2pjt014olK',
        //   kubectlLambdaHandlerIAMRole,
        // });
        // this.pre_existing_cluster = eks.Cluster.fromClusterAttributes(this.eks_essentials_stack, `${this.config.id}-cluster`, {
        //       vpc: this.config.vpc,
        //       clusterName: this.config.id,
        // });
        /*
        Constructor with minimal args is on purpose for desired UX of "builder pattern".
        The idea is to add partial configuration snippets over time/as multiple operations
        rather than populate a complete config all at once in one go.*/
    }//end constructor of Easy_EKS_v2

    //Class Functions:
    stage_deployment_of_global_baseline_eks_essentials(){ global_baseline_eks_config.deploy_essentials(this.config,this.eks_essentials_stack, this.pre_existing_cluster); }
    stage_deployment_of_my_orgs_baseline_eks_essentials(){ my_orgs_baseline_eks_config.deploy_essentials(this.config,this.eks_essentials_stack, this.pre_existing_cluster); }
    stage_deployment_of_lower_envs_eks_essentials(){ lower_envs_eks_config.deploy_essentials(this.config,this.eks_essentials_stack, this.pre_existing_cluster); }
    stage_deployment_of_higher_envs_eks_essentials(){ higher_envs_eks_config.deploy_essentials(this.config,this.eks_essentials_stack, this.pre_existing_cluster); }
    stage_deployment_of_dev_eks_essentials(){ dev_eks_config.deploy_essentials(this.config,this.eks_essentials_stack, this.pre_existing_cluster); }
    stage_deployment_of_test_eks_essentials(){ test_eks_config.deploy_essentials(this.config,this.eks_essentials_stack, this.pre_existing_cluster); }
    stage_deployment_of_stage_eks_essentials(){ stage_eks_config.deploy_essentials(this.config,this.eks_essentials_stack, this.pre_existing_cluster); }
    stage_deployment_of_prod_eks_essentials(){ prod_eks_config.deploy_essentials(this.config,this.eks_essentials_stack, this.pre_existing_cluster); }
    stage_deployment_of_dev_baseline_essentials(){ //convenience method
        this.stage_deployment_of_global_baseline_eks_essentials();
        this.stage_deployment_of_my_orgs_baseline_eks_essentials();
        this.stage_deployment_of_lower_envs_eks_essentials();
        this.stage_deployment_of_dev_eks_essentials();
    }
    stage_deployment_of_test_baseline_essentials(){ //convenience method
      this.stage_deployment_of_global_baseline_eks_essentials();
      this.stage_deployment_of_my_orgs_baseline_eks_essentials();
      this.stage_deployment_of_lower_envs_eks_essentials();
      this.stage_deployment_of_test_eks_essentials();
    }
    stage_deployment_of_stage_baseline_essentials(){ //convenience method
      this.stage_deployment_of_global_baseline_eks_essentials();
      this.stage_deployment_of_my_orgs_baseline_eks_essentials();
      this.stage_deployment_of_higher_envs_eks_essentials();
      this.stage_deployment_of_stage_eks_essentials();
    }
    stage_deployment_of_prod_baseline_essentials(){ //convenience method
      this.stage_deployment_of_global_baseline_eks_essentials();
      this.stage_deployment_of_my_orgs_baseline_eks_essentials();
      this.stage_deployment_of_higher_envs_eks_essentials();
      this.stage_deployment_of_prod_eks_essentials();
    }


    //Class Functions:
    apply_global_baseline_eks_config(){ global_baseline_eks_config.apply_config(this.config,this.eks_essentials_stack); }
    apply_my_orgs_baseline_eks_config(){ my_orgs_baseline_eks_config.apply_config(this.config,this.eks_essentials_stack); }
    apply_lower_envs_eks_config(){ lower_envs_eks_config.apply_config(this.config,this.eks_essentials_stack); }
    apply_higher_envs_eks_config(){ higher_envs_eks_config.apply_config(this.config,this.eks_essentials_stack); }
    apply_dev_eks_config(){ dev_eks_config.apply_config(this.config,this.eks_essentials_stack); }
    apply_dev_baseline_config(){ //convenience method
        this.apply_global_baseline_eks_config();
        this.apply_my_orgs_baseline_eks_config();
        this.apply_lower_envs_eks_config();
        this.apply_dev_eks_config();
    }

}//end class Easy_EKS_Essentials

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function initialize_Kubectl_Lambda_Handler_IAM_Role(stack: cdk.Stack){

  const eks_kubectl_access_iam_policy = new iam.PolicyDocument({
      statements: [
          new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              resources: ['arn:aws:eks:*'],
              actions: [
                  'eks:DescribeCluster',
              ],
          }),
      ],
  });

  const Kubectl_Lambda_Handler_IAM_Role = new iam.Role(stack, 'EKS_Kubectl_Lambda_Handler_IAM_Role', {
      //roleName: //cdk isn't great about cleaning up resources, so leting it generate name is more reliable
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonElasticContainerRegistryPublicReadOnly'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
      inlinePolicies: {
          eks_kubectl_access_iam_policy,
      },
  });
  return Kubectl_Lambda_Handler_IAM_Role;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////






