#!/usr/bin/env node
//^-- says node.js will be used to run this imperative scripting logic.
////////////////////////////////////////////////////////////////////////////////////////////
//Library Imports:
import console = require('console'); //Helps feedback loop, when manually debugging
                                     //allows `console.log(dev1cfg);` to work, when `cdk list` is run.

import * as cdk from 'aws-cdk-lib';
import * as global_baseline_config from '../config/apply_global_baseline_config';
import * as orgs_baseline_config from '../config/apply_orgs_baseline_config';
import * as dev_config from '../config/apply_dev_config';
/*     ^----This ----^
TS import syntax means:
* Import *("all") exported items from the specified source, into a "named import".
* The "named import" can be arbtirarily named.
* Items in the named import can be referenced with the dot operator.
*/
import { Easy_EKS_Config_Data } from '../lib/Easy_EKS_Config_Data';
/*     ^---------This---------^ 
TS import syntax means:
* Import a "specificallyly named" exported item, (or csv items) from the specified source.
* Here the "specifically named" item, must be an exact match for the name of the exported
  item in the referenced file.
* Items imported this way, can be referenced directly by name.
*/


////////////////////////////////////////////////////////////////////////////////////////////
//BOILERPLATE for how cdk works + notes for understanding
const cdk_construct_storage = new cdk.App(); //<-- Root AWS "Construct"
// https://docs.aws.amazon.com/cdk/v2/guide/constructs.html
// cdk.App & cdk.Stack classes from the AWS Construct Library are unique constructs.
// Unlike mosts constructs they don't configure AWS resources on their own.
// Their purpose is to act as an interface that provides context for your other constructs. 
// App is a root construct, and stack constructs can be stored in it.
// So app is a collection of 1 or more CDK stacks. 
// Stacks are a collection of 1 or more CDK constructs (including nested stacks) 
////////////////////////////////////////////////////////////////////////////////////////////


const dev1cfg: Easy_EKS_Config_Data = new Easy_EKS_Config_Data();
  global_baseline_config.apply_config(dev1cfg);
  orgs_baseline_config.apply_config(dev1cfg);
  dev_config.apply_config(dev1cfg);
console.log(dev1cfg);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const NTH_DYNAMIC_SANDBOX_CLUSTER:EKS_Inputs = new EKS_Generic_Baseline_Inputs(process.env.CDK_DEFAULT_REGION!); //! tells TS the var won't be undefined
new EKS_Blueprints_Based_EKS_Cluster().build(app, 'test-cluster', NTH_DYNAMIC_SANDBOX_CLUSTER );

const DEV_CLUSTER:EKS_Inputs = new EKS_Env_Override_Inputs("dev", "ca-central-1", "123456789");
new EKS_Blueprints_Based_EKS_Cluster().build(app, 'dev-cluster', DEV_CLUSTER );


//^-- refactor this next

