import console = require('console'); //can help debug feedback loop, allows `console.log("hi");` to work, when `cdk list` is run.
import * as cdk from 'aws-cdk-lib';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const BaselineTags: any = { //<-- TODO, didn't work not working per synth, debug later & fix any
  "Provisioning and IaC Management Tooling": "aws cdk",
  "Maintained By": "Platform Team",
  "Environment": "Nth Sandbox Cluster",
  "Primary Point of Contact": "admin@example.com",
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const BaselineAddOns: Array<blueprints.ClusterAddOn> = [
  new blueprints.addons.VpcCniAddOn({
    customNetworkingConfig: {
        subnets: [
            blueprints.getNamedResource("secondary-cidr-subnet-0"),
            blueprints.getNamedResource("secondary-cidr-subnet-1"),
            blueprints.getNamedResource("secondary-cidr-subnet-2"),
        ]
    },
    awsVpcK8sCniCustomNetworkCfg: true,
    eniConfigLabelDef: 'topology.kubernetes.io/zone',
    serviceAccountPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEKS_CNI_Policy")]
  }),
  new blueprints.addons.CoreDnsAddOn(),
  new blueprints.addons.KubeProxyAddOn(),
  new blueprints.addons.EbsCsiDriverAddOn({
    version: "auto",
    kmsKeys: [
      blueprints.getResource(
        (context) =>
          new kms.Key(context.scope, "ebs-csi-driver-key", {
            alias: "ebs-csi-driver-key",
          })
      ),
    ],
    storageClass: "gp3",
  }),
  // new blueprints.addons.AwsLoadBalancerControllerAddOn(),
  // new blueprints.addons.KarpenterAddOn({
  //   version: "v0.37.0",
  //   nodePoolSpec: nodePoolSpec,
  //   ec2NodeClassSpec: nodeClassSpec,
  //   interruptionHandling: true,
  // }),
];//end BaselineAddOns
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export abstract class EKS_Inputs implements cdk.StackProps { //mainly exists for type readability
  env: cdk.Environment;
  tags?: { [key: string]: string; } | undefined; //Stack tags that will be applied to all the taggable resources and the stack itself.
  envName?: string;
  vpcID?: string;
} 

export class EKS_Generic_Baseline_Inputs extends EKS_Inputs { //Props as in Properties, so Input Properties
  constructor(){
    super();
    this.env = {
      account: process.env.CDK_DEFAULT_ACCOUNT, //pulls account from CLI env
      region: process.env.CDK_DEFAULT_REGION,  //pulls region from CLI env
      }
    this.envName = "Nth sandbox cluster"
    this.vpcID = "Will be dynamically generated"
  }
}


export class EKS_Env_Override_Inputs extends EKS_Generic_Baseline_Inputs {
  constructor(envName: string, region: string, vpcID: string) {
    super();
    this.env = {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: region,
    }
    this.envName = envName;
    this.vpcID = vpcID;
    }
}


export class EKS_Blueprints_Based_EKS_Cluster {
  build(scope: Construct, id: string, props?: cdk.StackProps) {
    const account = props?.env?.account!; //<-- ? means if this exists check the sub variable 
    const region = props?.env?.region!; //<-- ! means TS can trust this variable won't be null

    const blueprint = blueprints.EksBlueprint.builder()
    .version('auto') //setting to 1.28 resulted in error
    .account(account)
    .region(region)
    .addOns()//end addOns
    .build(scope, id, props);
  } // end constructor
    
}//end class EKS_Blueprints_Based_EKS_Cluster
