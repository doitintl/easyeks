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

  let x = config.clusterAddOns;

  const clusterStack = blueprints.EksBlueprint.builder()
  .clusterProvider(generate_cluster_blueprint(config))
  .account(config.account)
  .region(config.region)
  .version(config.kubernetesVersion)
//  .addOns(...x!)
//  .addOns(baselineAddOns)
//  .addOns(...(config.clusterAddOns))//Note: ... is JS array deconsturing assignment, that converts an array to a CSV list
  .build(stateStorage, stackID)
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generate_cluster_blueprint(config: Easy_EKS_Config_Data){
  const clusterAdmin: eks.AccessPolicy = eks.AccessPolicy.fromAccessPolicyName('AmazonEKSClusterAdminPolicy', {
    accessScopeType: cdk.aws_eks.AccessScopeType.CLUSTER
  });
  let partialEKSAccessEntriesFromConfig: Array<partialEKSAccessEntry> = [];
  if(config.clusterAdminARNs){
    for (let index = 0; index < config.clusterAdminARNs.length; index++) {
      partialEKSAccessEntriesFromConfig.push(new partialEKSAccessEntry(config.clusterAdminARNs[index], [clusterAdmin]));      
    }
  }

  // const baselineWorkerNodeRole = new blueprints.CreateRoleProvider("eks-blueprint-worker-node-role", new iam.ServicePrincipal("ec2.amazonaws.com"),
  // [
  //     iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEKSWorkerNodePolicy"),
  //     iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryReadOnly"),
  //     iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
  // ]);

  const cluster_blueprint = new GenericClusterProviderWithAccessEntrySupport({
    tags: config.tags, //<-- attaches tags to EKS cluster in AWS Web Console
    authenticationMode: eks.AuthenticationMode.API_AND_CONFIG_MAP,
    partialEKSAccessEntries: partialEKSAccessEntriesFromConfig,
    managedNodeGroups: [
      {
        id: "ARM64-mng",
        amiType: eks.NodegroupAmiType.AL2_ARM_64,
        instanceTypes: [new ec2.InstanceType('t4g.small')], //t4g.small = 2cpu, 2gb ram 
        nodeGroupCapacityType: eks.CapacityType.SPOT,
        desiredSize: 1,
        minSize: 1,
        maxSize: 10,
  //      diskSize: 20, //20GB is the default
  //      nodeRole: baselineWorkerNodeRole,
  //    remoteAccess: https://aws-quickstart.github.io/cdk-eks-blueprints/api/interfaces/clusters.ManagedNodeGroup.html#remoteAccess
        enableSsmPermissions: true, //<-- allows aws managed ssh to private nodes, useful for debug
        nodeGroupSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        launchTemplate: { tags: config.tags } //<-- attaches tags to Launch Template, which gets propagated to these worker node
      }
    ],
    // fargateProfiles: { //https://aws-quickstart.github.io/cdk-eks-blueprints/cluster-providers/fargate-cluster-provider/
    //   "fargate-backed-pods": { //only the ondemand ARM64 backed flavor of fargate is supported.
    //       fargateProfileName: "fargate-backed-pods",
    //       selectors:  [{ namespace: "karpenter" }]
    //   } //karpenter.sh operator runs in karpenter ns, this says back that by fargate.
    // }, 
    outputConfigCommand: true,
  });

  return cluster_blueprint;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////







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
//   coreDnsComputeType:  <-- is an option in GenericClusterProvider
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
  new blueprints.addons.AwsLoadBalancerControllerAddOn(),
  new blueprints.addons.KarpenterAddOn({
    version: "v0.37.0",
    // nodePoolSpec: nodePoolSpec,
    // ec2NodeClassSpec: nodeClassSpec,
    interruptionHandling: true,
  }),
];//end BaselineAddOns


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

