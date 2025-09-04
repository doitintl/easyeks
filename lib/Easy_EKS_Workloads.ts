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

export class Easy_EKS_Workloads{ //purposefully don't extend stack, to implement builder pattern and give more flexibility for imperative logic.


}//end class Easy_EKS_Workloads

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////







