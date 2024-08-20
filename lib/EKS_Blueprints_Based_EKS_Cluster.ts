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
export function add_to_list_of_deployable_stacks(stateStorage: Construct, config: Easy_EKS_Config_Data){
  const clusterStack = blueprints.EksBlueprint.builder();
  clusterStack.clusterProvider(generate_cluster_blueprint(config));
  clusterStack.account(config.account);
  clusterStack.region(config.region);
  clusterStack.version(config.kubernetesVersion);
  if(config.clusterAddOns){ //<--JS truthy statement saying if not null
    //... is JS array deconsturing operator which converts an array to a CSV list of parameters
    clusterStack.addOns(...config.getClusterAddons());
  }
  clusterStack.build(stateStorage, config.stackId);
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

  const cluster_blueprint = new GenericClusterProviderWithAccessEntrySupport({
    tags: config.tags, //<-- attaches tags to EKS cluster in AWS Web Console
    authenticationMode: eks.AuthenticationMode.API_AND_CONFIG_MAP,
    partialEKSAccessEntries: partialEKSAccessEntriesFromConfig,
    managedNodeGroups: [
      {
        id: "ARM64-mng",
        amiType: eks.NodegroupAmiType.AL2_ARM_64,
        instanceTypes: [new ec2.InstanceType('t4g.small')], //t4g.small = 2cpu, 2gb ram, 11pod max
        nodeGroupCapacityType: eks.CapacityType.SPOT,
        desiredSize: 2,
        minSize: 2,
        maxSize: 50,
        //Note disk size defaults to 20GB, no need to edit for baseline nodes hosting kube-system
        //Use karpenter.sh to add bigger disks to user facing workloads if needed.
        enableSsmPermissions: true, //<-- allows aws managed ssh to private nodes, can be useful for debuging
        //^-- AWS Systems Manager --> Session Manager --> Start Session
        nodeGroupSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        launchTemplate: { tags: config.tags } //<-- attaches tags to Launch Template, which gets propagated to these worker node
      }
    ],
    outputConfigCommand: true,
  });

  return cluster_blueprint;
}

