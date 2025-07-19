import console = require('console'); //can help debug feedback loop, allows `console.log("hi");` to work, when `cdk list` is run.
import { Construct, IConstruct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
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

export class Easy_EKS_Essentials{ //purposefully don't extend stack, to implement builder pattern and give more flexibility for imperative logic.

    //Class Variables/Properties:
    eks_essentials_stack: cdk.Stack; //production readiness dependencies (karpenter, AWS LB Controller, node local dns cache, storage class, observability, etc.)
    config: Easy_EKS_Config_Data;
    pre_existing_cluster: eks.ICluster;

    //Class Constructor:
    constructor(storage_for_stacks_state: Construct, id_for_stack_and_eks_cluster: string, stack_config: cdk.StackProps) {
        this.eks_essentials_stack = new cdk.Stack(storage_for_stacks_state, `${id_for_stack_and_eks_cluster}-essentials2`, stack_config);
        this.config = new Easy_EKS_Config_Data(id_for_stack_and_eks_cluster);
        this.pre_existing_cluster = eks.Cluster.fromClusterAttributes(this.eks_essentials_stack, `${this.config.id}-cluster`, {
              vpc: this.config.vpc,
              clusterName: this.config.id,
        });
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

}//end Easy_EKS_Essentials
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


