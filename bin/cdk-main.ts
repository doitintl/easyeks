#!/usr/bin/env node
//^-- says node.js will be used to run this imperative scripting logic.
////////////////////////////////////////////////////////////////////////////////////////////
//Library Imports:
import console = require('console'); //Helps feedback loop, when manually debugging
//     ^-- allows `console.log(dev1cfg);` to work, when `cdk list` is run.
import * as cdk from 'aws-cdk-lib';
/*     ^-This-^
TS(TypeScript) import syntax that means:
* Import *("all") exported items from the specified source, into a "named import".
* The "named import" can be arbtirarily named.
* Items in the named import can be referenced with the dot operator.
*/
import { Opinionated_VPC } from '../lib/Opinionated_VPC';
import { Easy_EKS } from '../lib/Easy_EKS'; //AWS EKS L2 construct based cluster
/*     ^--_This---^ 
TS import syntax that means:
* Import a "specificallyly named" exported item, 
  or CSV list of specificly named exported items, from the specified source.
* Here the "specifically named" item, must be an exact match for the name of the exported
  item in the referenced file.
* Items imported this way, can be referenced directly by name.
*/
////////////////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////////////////
// IMPORTANT NOTE: For Conceptual Understanding and Comprehension:
const cdk_state = new cdk.App(); //<-- Root AWS "Construct"
/* You can read more here https://docs.aws.amazon.com/cdk/v2/guide/constructs.html
but here's a summary of how this works
* variable "cdk_state" is a cdk.App, it's a special Construct that
  * points to a storage refence where the "state" of any deployed infrastructure is persisted.
  * specifically the "state" of any deployed "CDK Stacks" get stored in this storage reference.
  * Command: `AWS_REGION="ca-central-1" cdk bootstrap` initializes cdk's state storage reference.
  * Once initialized you can see the references backend in Cloud Formation & S3.

* variables "lower-envs-vpc" & "dev1-eks" are examples of cdk.Stack 's, which:
  * represent "(application) stacks", which store (Infrastructure as Code) "Constructs"

* So a VPC Construct, gets stored in "lower-envs-vpc" Stack, which gets persisted in cdk_state
*///////////////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////////////////
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
//VPC Infrastructure as Code (Use of Opinionated VPC is Highly Recommended, yet optional)
//Note: 'lower-envs-vpc' is both the VPC name and the CloudFormation Stack Name

const lower_envs_vpc = new Opinionated_VPC(cdk_state, 'lower-envs-vpc', low_co2_AMER_stack_config);
lower_envs_vpc.stage_deployment_of_opinionated_vpc_for_lower_envs();
// ^-- This applys global_baseline_vpc_config, then my_orgs_baseline_vpc_config, then lower_envs_vpc_config
//     Then stages deployment of vpc construct into lower_envs_vpc.stack
//     Actual Deployment happens when user runs `cdk deploy lower-envs-vpc`

// const higher_envs_vpc = new Opinionated_VPC(cdk_state, 'higher-envs-vpc', low_cost_AMER_stack_config);
// higher_envs_vpc.stage_deployment_of_opinionated_vpc_for_higher_envs();
/* ^-- This is commented out by default for 2 reasons:
       1. Every uncommented staged deployment makes `cdk list` take longer to finish
          (Things run faster if you wait to uncomment deployable stacks until needed.)
       2. It won't work until cdk bootstrap is run in the configured stack's region.
          (us-east-2 is associated with low_cost_AMER_stack_config)

Commands to bootstrap: 
Note: It's recommended to copy paste each command one at a time, & read output between runs.
```bash
export AWS_REGION=us-east-2
export AWS_ACCOUNT=$(aws sts get-caller-identity | jq .Account | tr -d '"')
echo $AWS_REGION
echo $AWS_ACCOUNT
cdk bootstrap aws://$AWS_ACCOUNT/$AWS_REGION
```
*/
///////////////////////////////////////////////////////////////////////////////////////////


///////////////////////////////////////////////////////////////////////////////////////////
//EKS Infrastructure as Code:
//Example 1: Long form, showing all steps of builder pattern 
//(This format makes it easier to understand the flow of logic and can be useful for debugging)
const dev1_eks = new Easy_EKS(cdk_state, 'dev1-eks', low_co2_AMER_stack_config);
dev1_eks.apply_global_baseline_eks_config();
dev1_eks.apply_my_orgs_baseline_eks_config();
dev1_eks.apply_lower_envs_eks_config();
dev1_eks.apply_dev_eks_config();
dev1_eks.stage_deployment_of_eks_construct_into_this_objects_stack();
dev1_eks.stage_deployment_of_global_baseline_eks_dependencies();
dev1_eks.stage_deployment_of_my_orgs_baseline_eks_dependencies();
dev1_eks.stage_deployment_of_lower_envs_eks_dependencies();
dev1_eks.stage_deployment_of_dev_eks_dependencies();
dev1_eks.stage_deployment_of_global_baseline_eks_workload_dependencies();
dev1_eks.stage_deployment_of_my_orgs_baseline_eks_workload_dependencies();
dev1_eks.stage_deployment_of_lower_envs_eks_workload_dependencies();
dev1_eks.stage_deployment_of_dev_eks_workload_dependencies();
dev1_eks.stage_deployment_of_global_baseline_eks_workloads();
dev1_eks.stage_deployment_of_my_orgs_baseline_eks_workloads();
dev1_eks.stage_deployment_of_lower_envs_eks_workloads();
dev1_eks.stage_deployment_of_dev_eks_workloads();
//^-- deployment time of ~18.6mins (~15-20mins)

//Example 2: Equivalent to Example 1, just with convenience methods as short hand
//(This format balances usability and debugability)
const dev2_eks = new Easy_EKS(cdk_state, 'dev2-eks', low_co2_AMER_stack_config);
dev2_eks.apply_dev_baseline_config(); //<-- convenience method #1
dev2_eks.stage_deployment_of_eks_construct_into_this_objects_stack();
dev2_eks.stage_deployment_of_dev_baseline_dependencies(); //<-- convenience method #2
dev2_eks.stage_deployment_of_dev_baseline_workload_dependencies(); //<-- convenience method #3
dev2_eks.stage_deployment_of_dev_baseline_workloads(); //<-- convenience method #4

//Example 3: Equivalent to Examples 1 & 2, just shorter
//(This format optimizes usability, but can make debugability slightly harder)
const dev3_eks = new Easy_EKS(cdk_state, 'dev3-eks', low_co2_AMER_stack_config);
dev3_eks.stage_deployment_of_opinionated_eks_cluster_for_dev_envs(); //<-- convenience method #5

///////////////////////////////////////////////////////////////////////////////////////////
// const test1_eks = new Easy_EKS(cdk_state, 'test1-eks', low_co2_AMER_stack_config);
// test1_eks.stage_deployment_of_opinionated_eks_cluster_for_test_envs();
// ^-- This is commented out, because: 
//     Every uncommented staged deployment makes `cdk list` take longer to finish
//     (Things run faster if you wait to uncomment deployable stacks until you need them.)
///////////////////////////////////////////////////////////////////////////////////////////
// const stage1_eks = new Easy_EKS(cdk_state, 'stage1-eks', low_cost_AMER_stack_config);
// stage1_eks.stage_deployment_of_opinionated_eks_cluster_for_stage_envs();
// const prod1_eks = new Easy_EKS(cdk_state, 'prod1-eks', low_cost_AMER_stack_config);
// prod1_eks.stage_deployment_of_opinionated_eks_cluster_for_prod_envs();
// ^-- These are commented out, because: 
//     In addition to the above reason, they also depend on higher-envs-vpc being deployed
///////////////////////////////////////////////////////////////////////////////////////////
