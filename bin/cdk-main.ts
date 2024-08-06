#!/usr/bin/env node
import console = require('console'); //can help debug feedback loop, allows `console.log("hi");` to work, when `cdk list` is run.
import 'source-map-support/register'; //supposedly this makes stacktrace errors easier to read
import * as cdk from 'aws-cdk-lib';
import * as blueprints from '@aws-quickstart/eks-blueprints';
// import { EKS_Inputs, EKS_Generic_Baseline_Inputs,
// EKS_Blueprints_Based_EKS_Cluster,
// EKS_Env_Override_Inputs
//   } from '../lib/eks-blueprints-based-eks-cluster';
//       ^-- Matches name of exported class in referenced file
import { EKS_Inputs } from '../lib/EKS_Inputs';

////////////////////////////////////////////////////////////////////////////////////////////
//BOILERPLATE for how cdk works + notes for understanding
const app = new cdk.App(); //<-- Root AWS "Construct"
// https://docs.aws.amazon.com/cdk/v2/guide/constructs.html
// cdk.App & cdk.Stack classes from the AWS Construct Library are unique constructs.
// Unlike mosts constructs they don't configure AWS resources on their own.
// Their purpose is to act as an interface that provides context for your other constructs. 
// App is a root construct, and stack constructs can be stored in it.
// So app is a collection of 1 or more CDK stacks. 
// Stacks are a collection of 1 or more CDK constructs (including nested stacks) 
////////////////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Note: ca-central-1 is a Hydro Powered AWS Region (Low CO2 emissions), recommended to use for lower environment clusters
// const NTH_DYNAMIC_SANDBOX_CLUSTER:EKS_Inputs = new EKS_Generic_Baseline_Inputs(process.env.CDK_DEFAULT_REGION!); //! tells TS the var won't be undefined
// new EKS_Blueprints_Based_EKS_Cluster().build(app, 'test-cluster', NTH_DYNAMIC_SANDBOX_CLUSTER );

//console.log(BaselineTags);

//const DEV_CLUSTER:EKS_Inputs = new EKS_Env_Override_Inputs("dev", "ca-central-1", "123456789");
//new EKS_Blueprints_Based_EKS_Cluster().build(app, 'dev-cluster', DEV_CLUSTER );


console.log("===============================");
console.log("class:");
const test: EKS_Inputs = new EKS_Inputs();
//test.addTag("abc","xyz");
console.log(test);
console.log("===============================");

