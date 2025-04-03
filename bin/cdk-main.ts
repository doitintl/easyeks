#!/usr/bin/env node
//^-- says node.js will be used to run this imperative scripting logic.
////////////////////////////////////////////////////////////////////////////////////////////
//Library Imports:
import console = require('console'); //Helps feedback loop, when manually debugging
//     ^-- allows `console.log(dev1cfg);` to work, when `cdk list` is run.
import * as cdk from 'aws-cdk-lib';
/*     ^-This-^
TS import syntax means:
* Import *("all") exported items from the specified source, into a "named import".
* The "named import" can be arbtirarily named.
* Items in the named import can be referenced with the dot operator.
*/
import { Opinionated_VPC } from '../lib/Opinionated_VPC';
import { Easy_EKS } from '../lib/Easy_EKS'; //AWS EKS L2 construct based cluster
/*     ^--_This---^ 
TS import syntax means:
* Import a "specificallyly named" exported item, (or csv items) from the specified source.
* Here the "specifically named" item, must be an exact match for the name of the exported
  item in the referenced file.
* Items imported this way, can be referenced directly by name.
*/
////////////////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////////////////
// IMPORTANT NOTE: For Conceptual Understanding and Comprehension:
const reference_to_cdk_bootstrapped_cf_for_storing_state_of_stacks = new cdk.App(); //<-- Root AWS "Construct"
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
const default_stack_config: cdk.StackProps = {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT!, //<-- process.env pulls value from CLI env,
        region: process.env.CDK_DEFAULT_REGION! //<-- ! after var, tells TS it won't be null.
    }
}
/*Useful Notes:
UX (User Experience)
AMER (North and South American Contents)
EMEA (European Union, Middle East, Africa)
per https://www.concurrencylabs.com/blog/choose-your-aws-region-wisely/
    https://openupthecloud.com/which-aws-region-cheapest/
    https://statusgator.com/blog/is-north-virginia-aws-region-the-least-reliable-and-why/
us-east-2 (Ohio, USA) is cheapest and most reliable for AMER
eu-west-1 (Ireland, EU) is cheapest and most reliable for EMEA
ca-central-1 (Montreal, Canada) is a Hydro Powered AWS Region (Low CO2 Emissions)*/

//v-- consider for lower or small envs, per AWS's Well Architected Framework's sustainability pillar
const low_co2_AMER_stack_config: cdk.StackProps = {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT!,
        region: "ca-central-1" //Montreal, Canada (low co2)
        //Heads Up About UX Oddity specific to this region:
        //ca-central-1 has 3 user facing regions: a, b, d
        //`aws ec2 describe-availability-zones --region ca-central-1` can be used to verify
        //AWS lore suggests ca-central-1's c AZ exists for AWS internal use
    }
}

//v-- consider for higher or big envs, per AWS's Well Architected Framework's cost optimization pillar
const low_cost_AMER_stack_config: cdk.StackProps = {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT!,
        region: "us-east-2" //Ohio, USA (cheap and reliable)
    }
}
const low_cost_EMEA_stack_config: cdk.StackProps = {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT!,
        region: "eu-west-1" //Ireland, EU (cheap and reliable)
    }
}
///////////////////////////////////////////////////////////////////////////////////////////



///////////////////////////////////////////////////////////////////////////////////////////
//VPC Infrastructure as Code (Use of Opinionated VPC is Recommended, yet optional)
//Note: 'lower-envs-vpc' is both the VPC name and the CloudFormation Stack Name

const lower_envs_vpc = new Opinionated_VPC(reference_to_cdk_bootstrapped_cf_for_storing_state_of_stacks, 'lower-envs-vpc', low_co2_AMER_stack_config);
//Note: About the below lower_envs_vpc.apply_*_config() functions
//      The order in which you call these functions matters, because some functions set
//      values in a way that's intended to be overridable. This is why it's
//      recommended to follow the below order of application (global -> my_org -> env)
lower_envs_vpc.apply_global_baseline_vpc_config();
lower_envs_vpc.apply_my_orgs_baseline_vpc_config();
lower_envs_vpc.apply_lower_envs_vpc_config();
lower_envs_vpc.deploy_vpc_construct_into_this_objects_stack();
///////////////////////////////////////////////////////////////////////////////////////////



///////////////////////////////////////////////////////////////////////////////////////////
//EKS Infrastructure as Code:
const dev1_eks = new Easy_EKS(reference_to_cdk_bootstrapped_cf_for_storing_state_of_stacks, 'dev1-eks', low_co2_AMER_stack_config);
dev1_eks.apply_dev_baseline_config();
dev1_eks.deploy_eks_construct_into_this_objects_stack();

const dev2_eks = new Easy_EKS(reference_to_cdk_bootstrapped_cf_for_storing_state_of_stacks, 'dev2-eks', low_co2_AMER_stack_config);
dev2_eks.apply_dev_baseline_config();
dev2_eks.deploy_eks_construct_into_this_objects_stack();
//^-- deployment time of ~15m (active dev)
///////////////////////////////////////////////////////////////////////////////////////////

