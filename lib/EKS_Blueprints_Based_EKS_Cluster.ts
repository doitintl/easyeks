import console = require('console'); //can help debug feedback loop, allows `console.log("hi");` to work, when `cdk list` is run.
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as blueprints from '@aws-quickstart/eks-blueprints'; 
//          ^-- blueprints as in blueprint of a eks cluster defined as a declarative cloud formation stack
import { Easy_EKS_Config_Data } from './Easy_EKS_Config_Data';
import { partialEKSAccessEntry, GenericClusterProviderWithAccessEntrySupport } from './Modified_Cluster_Provider';
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function add_to_list_of_deployable_stacks(stateStorage: Construct, stackID: string, config: Easy_EKS_Config_Data){
  const clusterStack = blueprints.EksBlueprint.builder()
  .clusterProvider(baselineClusterProvider)
  .version(eks.KubernetesVersion.V1_30)
  .build(stateStorage, stackID)

/*
.version(eks.KubernetesVersion.V1_30)
.account(account)
.region(region)
.addOns(...baselineAddOns)//Note: ... is JS array deconsturing assignment, array --> csv listv
*/

//console.log(config.tags);
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const clusterAdmin: eks.AccessPolicy = eks.AccessPolicy.fromAccessPolicyName('AmazonEKSClusterAdminPolicy', {
  accessScopeType: cdk.aws_eks.AccessScopeType.CLUSTER
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const baselineClusterProvider = new GenericClusterProviderWithAccessEntrySupport({
    partialEKSAccessEntries: [
      new partialEKSAccessEntry('arn:aws:iam::905418347382:user/chrism', [clusterAdmin]), 
      //new partialEKSAccessEntry('arn:aws:iam::905418347382:user/non-existant-user', [clusterAdmin]), 
      //^--principal in ARN must exit or deploy will fail (TODO: add left-shifted validation.)
    ],
  //  tags: baselineEKSTags, //<-- attaches tags to EKS cluster in AWS Web Console
    outputConfigCommand: true,
    authenticationMode: eks.AuthenticationMode.API_AND_CONFIG_MAP,
  //   fargateProfiles: { //https://aws-quickstart.github.io/cdk-eks-blueprints/cluster-providers/fargate-cluster-provider/
  //     "fargate-backed-pods": { //only the ondemand ARM64 backed flavor of fargate is supported.
  //         fargateProfileName: "fargate-backed-pods",
  //         selectors:  [{ namespace: "karpenter" }]
  //     } //karpenter.sh operator runs in karpenter ns, this says back that by fargate.
  //   }, 
  //   managedNodeGroups: [
  //     {
  //       id: "AMD64-mng",
  //       amiType: eks.NodegroupAmiType.AL2_X86_64,
  //       instanceTypes: [new ec2.InstanceType('t3a.small')], //t3a.small = 2cpu, 2gb ram
  //       nodeGroupCapacityType: eks.CapacityType.SPOT,
  // //      diskSize: 20, //20GB is the default
  //       desiredSize: 0,
  //       minSize: 0,
  //       maxSize: 2,
  // //      nodeRole: baselineWorkerNodeRole,
  // //    remoteAccess: https://aws-quickstart.github.io/cdk-eks-blueprints/api/interfaces/clusters.ManagedNodeGroup.html#remoteAccess
  //       enableSsmPermissions: true, //<-- allows aws managed ssh to private nodes, useful for debug 
  //       nodeGroupSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  // //      launchTemplate: { tags: baselineEKSTags } //<-- attaches tags to Launch Template, which gets propagated to worker node
  //     },
  //     {
  //       id: "ARM64-mng",
  //       amiType: eks.NodegroupAmiType.AL2_ARM_64,
  //       instanceTypes: [new ec2.InstanceType('t4g.small')], //t4g.small = 2cpu, 2gb ram 
  //       nodeGroupCapacityType: eks.CapacityType.SPOT,
  // //      diskSize: 20, //20GB is the default
  //       desiredSize: 1,
  //       minSize: 0,
  //       maxSize: 3,
  //       enableSsmPermissions: true, //<-- allows aws managed ssh to private nodes, useful for debug
  //       nodeGroupSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  // //      launchTemplate: { tags: baselineEKSTags } //<-- attaches tags to Launch Template, which gets propagated to worker node
  //     }
  //   ],
  });
  


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function tags_from_config(config: Easy_EKS_Config_Data){
  const blueprint_formatted_tags: {[key: string]: string;} = {
    "a": "b",
    "abc": "xyz",
  }
  return blueprint_formatted_tags;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



function cluster_from_config(config: Easy_EKS_Config_Data){
  const blueprint_formatted_tags: {[key: string]: string;} = {
    "a": "b",
    "abc": "xyz",
  }
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
const baselineAddOns: Array<blueprints.ClusterAddOn> = [
  // new blueprints.addons.KubeProxyAddOn(),
  // new blueprints.addons.CoreDnsAddOn(),
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

//workerNodeRole?: blueprints.CreateRoleProvider;
//eksAddOns?: Array<blueprints.ClusterAddOn>;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//
