import console = require('console'); //can help debug feedback loop, allows `console.log("hi");` to work, when `cdk list` is run.
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as blueprints from '@aws-quickstart/eks-blueprints'; 
//          ^-- blueprints as in blueprint of a eks cluster defined as a declarative cloud formation stack
import { Easy_EKS_Config_Data } from '../lib/Easy_EKS_Config_Data';
import { config } from 'process';
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
/* Adding Useful Functionality:
2023--: EKS required AWS IAM identity rights to be managed via aws-auth configmap
2024++: EKS allows AWS IAM identity rights to be managed via IAM & EKS APIs
        This needs 2 things:
        1. 
 cdk.aws_eks.AccessEntry, need access to a cdk.aws_eks.Cluster object
   EKSBlueprint's implemementation details don't make that hand off easy, so needed to override, extend, and customize some things   
   Source Code:
   https://github.com/aws-quickstart/cdk-eks-blueprints/blob/blueprints-1.15.1/lib/cluster-providers/generic-cluster-provider.ts
*/

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//This is the configuration half of API part of AuthenticationMode.API_AND_CONFIG_MAP
//
//https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_eks.AccessPolicy.html
const clusterAdmin: eks.AccessPolicy = eks.AccessPolicy.fromAccessPolicyName('AmazonEKSClusterAdminPolicy', {
  accessScopeType: cdk.aws_eks.AccessScopeType.CLUSTER,
});

class partialEKSAccessEntry {
  subStackID: string; //Access Entry Stack ID, needs to be unique per Access Entry
  accesssPolicies: cdk.aws_eks.IAccessPolicy[];
  principalARN: string;
  accessEntryName: string;
  constructor(principleARN: string, accessPolicies: cdk.aws_eks.IAccessPolicy[]){
    this.subStackID = principleARN;
    this.accesssPolicies = accessPolicies;
    this.principalARN = principleARN;
    this.accessEntryName = principleARN;
  }
}

interface GenericClusterProviderPropsWithAccessEntrySupport extends blueprints.GenericClusterProviderProps {
  partialEKSAccessEntries?: Array<partialEKSAccessEntry>;
}

class GenericClusterProviderWithAccessEntrySupport extends blueprints.GenericClusterProvider { 
  partialEKSAccessEntries?: Array<partialEKSAccessEntry>;

  constructor(props:GenericClusterProviderPropsWithAccessEntrySupport){
    super(props);
    this.partialEKSAccessEntries = props.partialEKSAccessEntries;
  }
  protected internalCreateCluster(stateStorage: Construct, stackID: string, clusterOptions: any): cdk.aws_eks.Cluster {
    const cluster = new cdk.aws_eks.Cluster(stateStorage, stackID, clusterOptions);
    console.log(this.partialEKSAccessEntries?.length);
      if(this.partialEKSAccessEntries){
        for (let index = 0; index < this.partialEKSAccessEntries?.length; index++) {
          new eks.AccessEntry( stateStorage, this.partialEKSAccessEntries[index].subStackID, 
            {
              accessPolicies: this.partialEKSAccessEntries[index].accesssPolicies,
              cluster: cluster,
              principal: this.partialEKSAccessEntries[index].principalARN,
              accessEntryName: this.partialEKSAccessEntries[index].accessEntryName 
            }
          );      
        }
      }
    console.log(this.partialEKSAccessEntries);

    return cluster;
    //Dry Run:
    //
    
  }
}


//////
const baselineClusterProvider = new GenericClusterProviderWithAccessEntrySupport({
    partialEKSAccessEntries: [
      new partialEKSAccessEntry('arn:aws:iam::905418347382:user/chrism', [clusterAdmin]), 
      new partialEKSAccessEntry('arn:aws:iam::905418347382:user/bluey', [clusterAdmin]) 
      //fast feedback method: cdk synth | grep "Type: AWS::EKS::AccessEntry" -C 20 | grep "arn:aws:iam::905418347382:user/chrism"
    ],
  //  tags: baselineEKSTags, //<-- attaches tags to EKS cluster in AWS Web Console
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
  //      launchTemplate: { tags: baselineEKSTags } //<-- attaches tags to Launch Template, which gets propagated to worker node
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
  //      launchTemplate: { tags: baselineEKSTags } //<-- attaches tags to Launch Template, which gets propagated to worker node
      }
    ],
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
