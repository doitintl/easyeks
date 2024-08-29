#!/usr/bin/env node
//^-- says node.js will be used to run this imperative scripting logic.
////////////////////////////////////////////////////////////////////////////////////////////
//Library Imports:
import console = require('console'); //Helps feedback loop, when manually debugging
//     ^-- allows `console.log(dev1cfg);` to work, when `cdk list` is run.
import * as cdk from 'aws-cdk-lib';
import * as Opinionated_VPC from '../lib/Opinionated_VPC';
import * as EKS_Blueprints_Based_Cluster from '../lib/EKS_Blueprints_Based_EKS_Cluster';
/*     ^-------------This--------------^
TS import syntax means:
* Import *("all") exported items from the specified source, into a "named import".
* The "named import" can be arbtirarily named.
* Items in the named import can be referenced with the dot operator.
*/
import { Opinionated_VPC_Config_Data } from '../lib/Opinionated_VPC_Config_Data';
import { Easy_EKS_Config_Data } from '../lib/Easy_EKS_Config_Data';
/*     ^---------This---------^ 
TS import syntax means:
* Import a "specificallyly named" exported item, (or csv items) from the specified source.
* Here the "specifically named" item, must be an exact match for the name of the exported
  item in the referenced file.
* Items imported this way, can be referenced directly by name.
*/
////////////////////////////////////////////////////////////////////////////////////////////
//Config Library Imports:
import * as global_baseline_vpc_config from '../config/vpc/apply_global_baseline_vpc_config';
import * as orgs_baseline_vpc_config from '../config/vpc/apply_orgs_baseline_vpc_config';
import * as lower_envs_vpc_config from '../config/vpc/apply_lower_envs_vpc_config';
import * as higher_envs_vpc_config from '../config/vpc/apply_higher_envs_vpc_config';
import * as global_baseline_eks_config from '../config/eks/apply_global_baseline_eks_config';
import * as orgs_baseline_eks_config from '../config/eks/apply_orgs_baseline_eks_config';
import * as dev_eks_config from '../config/eks/apply_dev_eks_config';
////////////////////////////////////////////////////////////////////////////////////////////
//Log Verbosity Config:
import { userLog } from '@aws-quickstart/eks-blueprints/dist/utils';
userLog.settings.minLevel = 3; //<-- Hide's eks blueprint's debug logs, 3 = info, 2 = debug
////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////
// IMPORTANT NOTE: For Conceptual Understanding and Comprehension:
const cdk_construct_storage = new cdk.App(); //<-- Root AWS "Construct"
/* https://docs.aws.amazon.com/cdk/v2/guide/constructs.html
cdk.App & cdk.Stack classes from the AWS Construct Library are unique constructs.
Unlike mosts constructs they don't configure AWS resources on their own.
Their purpose is to act as an interface that provides context for your other constructs. 
App is a root construct, and stack constructs can be stored in it.
So app is a collection of 1 or more CDK stacks. 
Stacks are a collection of 1 or more CDK constructs (including nested stacks) 

^-- That's mostly from the docs, what follows is paraphrased elaboration:
* cdk_construct_storage of type cdk.App:
  * Is able to discover a Cloud Formation stack, in a region cdk bootstrap was run against.
  * Cloud Formation is where the state of CDK managed IaC gets stored/persisted.
  * So you can think of this as a reference point that allows cdk.Stack objects to learn
    where to persist their state data and re-discover their persisted state data between
    runs of the cdk CLI command.
* Objects of type Easy_EKS_Config_Data (like dev1cfg)
  * These objects only exists in memory between runs, and exist as a conveinent abstraction
    layer for preparing a config, and viewing key/simplified config details.
  * About the 1 input parameter:
    * stackID: dev1-eks, is of type string
    * stackID get's stored in the cdk_construct_storage to enable persistence of IaC state.
* EKS_Blueprints_Based_Cluster.add_to_list_of_deployable_stacks(cdk_construct_storage, config);
  * About the 2 input parameters:
    * cdk_construct_storage: is of type cdk.App
    * dev1cfg: is of type Easy_EKS_Config_Data
  * What the function does:
    1. Converts Easy EKS Config into a format EKS Blueprints can use.
    2. Plugs the data into EKS Blueprints builder logic, which stages a deployment.
       Specifically when you run `cdk list` (in the correct working directory and context)
       It'll show up as an option of a deployable cluster.
       `cdk deploy dev1-eks`
       (where dev1-eks is a stackID, can then be used to dry-run a deployment, 
       and prompt's y to confirm deployment. (A deployment will take about 17 minutes.)
*///////////////////////////////////////////////////////////////////////////////////////////



///////////////////////////////////////////////////////////////////////////////////////////
//VPC Infrastructure as Code (Recommended, yet optional)
//Note: 'lower-envs-vpc' is both the VPC name and the CloudFormation Stack Name
const lower_envs_vpc_cfg: Opinionated_VPC_Config_Data = new Opinionated_VPC_Config_Data('lower-envs-vpc');
      global_baseline_vpc_config.apply_config(lower_envs_vpc_cfg);
      orgs_baseline_vpc_config.apply_config(lower_envs_vpc_cfg);
      lower_envs_vpc_config.apply_config(lower_envs_vpc_cfg);
const higher_envs_vpc_cfg: Opinionated_VPC_Config_Data = new Opinionated_VPC_Config_Data('higher-envs-vpc');
      global_baseline_vpc_config.apply_config(higher_envs_vpc_cfg);
      orgs_baseline_vpc_config.apply_config(higher_envs_vpc_cfg);
      higher_envs_vpc_config.apply_config(higher_envs_vpc_cfg);
      //^-- Note some of the apply_config, uses methods to set a value, which is overrideable
      //    so the order of application can matter. 
      //    So it's best to follow a pattern of global --> org --> env when applying config.

Opinionated_VPC.add_to_list_of_deployable_stacks(cdk_construct_storage, lower_envs_vpc_cfg);
Opinionated_VPC.add_to_list_of_deployable_stacks(cdk_construct_storage, higher_envs_vpc_cfg);
///////////////////////////////////////////////////////////////////////////////////////////



///////////////////////////////////////////////////////////////////////////////////////////
//EKS Infrastructure as Code:
const dev1cfg: Easy_EKS_Config_Data = new Easy_EKS_Config_Data('dev1-eks');
  global_baseline_eks_config.apply_config(dev1cfg);
  orgs_baseline_eks_config.apply_config(dev1cfg);
  dev_eks_config.apply_config(dev1cfg);
  //console.log('dev1cfg:\n', dev1cfg); //<-- \n is newline
  //^--this and `cdk synth $StackID | grep -C 5 "parameter"` can help config validation feedback loop)

EKS_Blueprints_Based_Cluster.add_to_list_of_deployable_stacks(cdk_construct_storage, dev1cfg);
///////////////////////////////////////////////////////////////////////////////////////////


