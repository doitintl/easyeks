import console = require('console'); //can help debug feedback loop, allows `console.log("hi");` to work, when `cdk list` is run.
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as blueprints from '@aws-quickstart/eks-blueprints'; // blueprints as in blueprint_of_eks_declarative_cf_stack
import { Easy_EKS_Config_Data } from '../lib/Easy_EKS_Config_Data';
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/* This code does 2 things:
1. Acts as a bridge (duck tape logic) to convert 
   from: Easy_EKS_Config_Data (a UX optimized / simplified config format)
   to: EKS_Blueprints_Config_Objects (In the way that project expects it)
2. Exposes a method to deploy EKS_Blueprints_Based_Cluster
*/
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const baselineEKSTags: { [key: string]: string } = {
  "a": "b",
  "abc": "xyz",
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const baselineWorkerNodeRole = new blueprints.CreateRoleProvider("eks-blueprint-worker-node-role", new iam.ServicePrincipal("ec2.amazonaws.com"),
[
    iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEKSWorkerNodePolicy"),
    iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryReadOnly"),
    iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
]);
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////




//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//2023--: EKS required AWS IAM identity rights to be managed via aws-auth configmap
//2024++: EKS allows AWS IAM identity rights to be managed via IAM & EKS APIs,
//This is the configuration half of API part of AuthenticationMode.API_AND_CONFIG_MAP
//
//https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_eks.AccessPolicy.html
const clusterAdmin: eks.AccessPolicy = eks.AccessPolicy.fromAccessPolicyName('AmazonEKSClusterAdminPolicy', {
  accessScopeType: cdk.aws_eks.AccessScopeType.CLUSTER,
});

class CustomClusterProvider extends blueprints.GenericClusterProvider {
  constructor(props:blueprints.GenericClusterProviderProps){
    super(props);
  }
  protected internalCreateCluster(scope: Construct, id: string, clusterOptions: any): cdk.aws_eks.Cluster {
    const cluster = new cdk.aws_eks.Cluster(scope, id, clusterOptions);

    //https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_eks.AccessEntry.html
    const accessEntry1 = new eks.AccessEntry( scope, 'AccessEntry for IAM user chrism', {
      accessPolicies: [clusterAdmin],
      cluster: cluster,
      principal: 'arn:aws:iam::905418347382:user/chrism',
      accessEntryName: 'IAM user chrism',
    });

    return cluster;
    //Dry Run:
    //cdk synth | grep "Type: AWS::EKS::AccessEntry" -A 12
  }
}


const baselineClusterProvider = new CustomClusterProvider({
  tags: baselineEKSTags, //<-- attaches tags to EKS cluster in AWS Web Console
  outputConfigCommand: true,
  authenticationMode: eks.AuthenticationMode.API_AND_CONFIG_MAP,
  fargateProfiles: { //https://aws-quickstart.github.io/cdk-eks-blueprints/cluster-providers/fargate-cluster-provider/
    "fargate-backed-pods": { //only the ondemand ARM64 backed flavor of fargate is supported.
        fargateProfileName: "fargate-backed-pods",
        selectors:  [{ namespace: "karpenter" }]
    } //karpenter.sh operator runs in karpenter ns, this says back that by fargate.
  }, 
  managedNodeGroups: [
    {
      id: "AMD64-mng",
      amiType: eks.NodegroupAmiType.AL2_X86_64,
      instanceTypes: [new ec2.InstanceType('t3a.small')], //t3a.small = 2cpu, 2gb ram
      nodeGroupCapacityType: eks.CapacityType.SPOT,
//      diskSize: 20, //20GB is the default
      desiredSize: 0,
      minSize: 0,
      maxSize: 2,
//      nodeRole: baselineWorkerNodeRole,
//    remoteAccess: https://aws-quickstart.github.io/cdk-eks-blueprints/api/interfaces/clusters.ManagedNodeGroup.html#remoteAccess
      enableSsmPermissions: true, //<-- allows aws managed ssh to private nodes, useful for debug 
      nodeGroupSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      launchTemplate: { tags: baselineEKSTags } //<-- attaches tags to Launch Template, which gets propagated to worker node
    },
    {
      id: "ARM64-mng",
      amiType: eks.NodegroupAmiType.AL2_ARM_64,
      instanceTypes: [new ec2.InstanceType('t4g.small')], //t4g.small = 2cpu, 2gb ram 
      nodeGroupCapacityType: eks.CapacityType.SPOT,
//      diskSize: 20, //20GB is the default
      desiredSize: 1,
      minSize: 0,
      maxSize: 3,
      enableSsmPermissions: true, //<-- allows aws managed ssh to private nodes, useful for debug
      nodeGroupSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      launchTemplate: { tags: baselineEKSTags } //<-- attaches tags to Launch Template, which gets propagated to worker node
    }
  ],


});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const baselineAddOns: Array<blueprints.ClusterAddOn> = [
  new blueprints.addons.KubeProxyAddOn(),
  new blueprints.addons.CoreDnsAddOn(),
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
  //  coreDnsComputeType:  <-- is an option in GenericClusterProvider
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
  // new blueprints.addons.AwsLoadBalancerControllerAddOn(),
  // new blueprints.addons.KarpenterAddOn({
  //   version: "v0.37.0",
  //   nodePoolSpec: nodePoolSpec,
  //   ec2NodeClassSpec: nodeClassSpec,
  //   interruptionHandling: true,
  // }),
];//end BaselineAddOns
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//

export class EKS_Inputs implements cdk.StackProps { //mainly exists for type readability, might get rid of. (TBD)
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
export class EKS_Blueprints_Based_EKS_Cluster {

  build(scope: Construct, stackID: string, props?: EKS_Inputs) {
    
    const account = props?.env?.account!; //<-- ? means if this optional variable exists, then check it's sub variable 
    const region = props?.env?.region!; //<-- ! means TS can trust this variable won't be null

    const clusterStack = blueprints.EksBlueprint.builder()
    .clusterProvider(baselineClusterProvider)
    .version(eks.KubernetesVersion.V1_30)
    .account(account)
    .region(region)
    .addOns(...baselineAddOns)//Note: ... is JS array deconsturing assignment, array --> csv list
    .build(scope, stackID, props);
  }
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function add_to_list_of_deployable_stacks(stateStorage: Construct, stackID: string, config: Easy_EKS_Config_Data){
//to do, convert easy config to blueprint config.

  //deploy
}
