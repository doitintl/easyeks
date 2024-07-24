import console = require('console'); //can help debug feedback loop, allows `console.log("hi");` to work, when `cdk list` is run.
import * as cdk from 'aws-cdk-lib';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { KubernetesVersion } from 'aws-cdk-lib/aws-eks';
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const baselineEKSTags:  { [key: string]: string } = { //<-- TODO, didn't work not working per synth, debug later & fix any
  "Provisioning and IaC Management Tooling": "aws cdk",
  "Maintained By": "Platform Team",
  "Environment": "Nth Sandbox Cluster",
  "Primary Point of Contact": "ops@example.com",
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// const baselineWorkerNodeRole = new blueprints.CreateRoleProvider("eks-blueprint-worker-node-role", new iam.ServicePrincipal("ec2.amazonaws.com"),
// [
//     iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEKSWorkerNodePolicy"),
//     iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryReadOnly"),
//     iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
// ]);
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Reference: https://aws-quickstart.github.io/cdk-eks-blueprints/cluster-providers/generic-cluster-provider/
//Reference: https://github.com/aws-quickstart/cdk-eks-blueprints/blob/main/examples/examples.ts
// const baselineClusterProvider = new blueprints.GenericClusterProvider({
//   tags: {
//       "Name": "blueprints-example-cluster",
//       "Type": "generic-cluster",
//       "lala": "testtest",
//   },
//   managedNodeGroups: [
//   ]
// });
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const baselineAddOns: Array<blueprints.ClusterAddOn> = [
  // new blueprints.addons.VpcCniAddOn({
  //   customNetworkingConfig: {
  //       subnets: [
  //           blueprints.getNamedResource("secondary-cidr-subnet-0"),
  //           blueprints.getNamedResource("secondary-cidr-subnet-1"),
  //           blueprints.getNamedResource("secondary-cidr-subnet-2"),
  //       ]
  //   },
  //   awsVpcK8sCniCustomNetworkCfg: true,
  //   eniConfigLabelDef: 'topology.kubernetes.io/zone',
  //   serviceAccountPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEKS_CNI_Policy")]
  // }),
  new blueprints.addons.CoreDnsAddOn(),
  new blueprints.addons.KubeProxyAddOn(),
  // new blueprints.addons.EbsCsiDriverAddOn({
  //   version: "auto",
  //   kmsKeys: [
  //     blueprints.getResource(
  //       (context) =>
  //         new kms.Key(context.scope, "ebs-csi-driver-key", {
  //           alias: "ebs-csi-driver-key",
  //         })
  //     ),
  //   ],
  //   storageClass: "gp3",
  // }),
  // new blueprints.addons.AwsLoadBalancerControllerAddOn(),
  // new blueprints.addons.KarpenterAddOn({
  //   version: "v0.37.0",
  //   nodePoolSpec: nodePoolSpec,
  //   ec2NodeClassSpec: nodeClassSpec,
  //   interruptionHandling: true,
  // }),
];//end BaselineAddOns
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export abstract class EKS_Inputs implements cdk.StackProps { //mainly exists for type readability, might get rid of. (TBD)
  env: cdk.Environment;
  stackTags?: { [key: string]: string; }; //? means optional variable
  envName?: string;
  workerNodeRole?: blueprints.CreateRoleProvider;
  eksAddOns?: Array<blueprints.ClusterAddOn>;
  vpcID?: string;

  constructor(envName: string, region: string, vpcID: string){
    this.env = {
      account: process.env.CDK_DEFAULT_ACCOUNT, //pulls account from CLI env
      region: region,
      }
    this.envName = envName;
    this.stackTags = baselineEKSTags;
    this.vpcID = vpcID;
//    this.workerNodeRole = baselineWorkerNodeRole;
    this.eksAddOns = baselineAddOns;
  }
} 
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export class EKS_Generic_Baseline_Inputs extends EKS_Inputs { //Props as in Properties, so Input Properties
  constructor(region: string){
    super("Nth-sandbox-cluster", region, "this will be dynamiclly generated");
  }
}

// export class EKS_Env_Override_Inputs extends EKS_Generic_Baseline_Inputs {
//   constructor(envName: string, region: string, vpcID: string) {
//     super(region);
//   }
// }
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export class EKS_Blueprints_Based_EKS_Cluster {
  build(scope: Construct, id: string, props?: EKS_Inputs) {
    
    const account = props?.env?.account!; //<-- ? means if this optional variable exists, then check it's sub variable 
    const region = props?.env?.region!; //<-- ! means TS can trust this variable won't be null
    
    const clusterStack = blueprints.EksBlueprint.builder()
//    .clusterProvider(baselineClusterProvider)
    .version(KubernetesVersion.V1_29)
    .account(account)
    .region(region)
    .addOns(...baselineAddOns)//end addOns
    .build(scope, id, props);
  }
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
