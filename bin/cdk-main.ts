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
//Example 1 shows convience methods
const dev1_eks = new Easy_EKS(cdk_state, 'dev1-eks', low_co2_AMER_stack_config);
dev1_eks.apply_dev_baseline_config(); //<-- conviencne method #1
dev1_eks.deploy_eks_construct_into_this_objects_stack();
dev1_eks.deploy_dev_baseline_workloads(); //<-- conviencne method #2
//^-- deployment time of ~15-20m

//Example 2 is equivalent to Example 1, just more explicit.
const dev2_eks = new Easy_EKS(cdk_state, 'dev2-eks', low_co2_AMER_stack_config);
dev2_eks.apply_global_baseline_eks_config();
dev2_eks.apply_my_orgs_baseline_eks_config();
dev2_eks.apply_lower_envs_eks_config();
dev2_eks.apply_dev_eks_config();
dev2_eks.deploy_eks_construct_into_this_objects_stack();
dev2_eks.deploy_global_baseline_eks_workloads();
dev2_eks.deploy_my_orgs_baseline_eks_workloads();
dev2_eks.deploy_lower_envs_eks_workloads();
dev2_eks.deploy_dev_eks_workloads();
///////////////////////////////////////////////////////////////////////////////////////////

