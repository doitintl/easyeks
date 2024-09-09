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
import * as monitoring from './Frugal_GPL_Monitoring_Stack';
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function add_to_list_of_deployable_stacks(stateStorage: Construct, config: Easy_EKS_Config_Data){

  
  //These next few lines are a temporary hack for learning purposes.
  const stack_test = new cdk.Stack(stateStorage, "test1-eks", {
    env: {
      account: config.account,
      region: config.region,
    }
  });
  const pre_existing_vpc = ec2.Vpc.fromLookup(stack_test,'pre-existing-vpc', {
    vpcName: 'lower-envs-vpc', //This assumes vpcName is unique, looks up by name
    vpcId: "vpc-0d419b717d34dba79",
  });//end pre_existing_vpc




  const eksBlueprint = blueprints.EksBlueprint.builder();
  eksBlueprint.resourceProvider(blueprints.GlobalResources.Vpc, new blueprints.VpcProvider('vpc-0d419b717d34dba79'));
  eksBlueprint.clusterProvider(generate_cluster_blueprint(stateStorage, config));
  
  eksBlueprint.account(config.account);
  eksBlueprint.region(config.region);
  eksBlueprint.version(config.kubernetesVersion);
  if(config.clusterAddOns){ //<--JS truthy statement saying if not null
    //... is JS array deconsturing operator which converts an array to a CSV list of parameters
    eksBlueprint.addOns(...config.getClusterAddons());
  }

  const eks_blueprint_properties = convert_blueprintBuilder_to_blueprintProperties(config.stackId, eksBlueprint);
  const eksBPC1 = new blueprints.EksBlueprintConstruct(stack_test, eks_blueprint_properties);
  // CLEAN this up after refactor
  // monitoring.deploy(stateStorage, config); //<-- TEMPORARY SPOT TO TRIGGER LOGIC, as a temporary hack, FOR TESTING PURPOSES,
  // const clusterStack = eksBlueprint.build(stateStorage, config.stackId) as cdk.Stack;
  // ^-- old method from b4 refactor
}


function convert_blueprintBuilder_to_blueprintProperties(id: string, blueprint_builder: blueprints.BlueprintBuilder){
  let partial_blueprint_properties:Partial<blueprints.EksBlueprintProps> = blueprint_builder.props; 
  //partial means some values may be null
  //so we need to verify the partial object can safely be converted to the complete object.
  //id is the only value of EksBlueprintProps that must exist in a valid complete object.
  const blueprint_properties = { ...partial_blueprint_properties, id } as blueprints.EksBlueprintProps;
  return blueprint_properties;  
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function generate_cluster_blueprint(stateStorage: Construct, config: Easy_EKS_Config_Data){
  const clusterAdmin: eks.AccessPolicy = eks.AccessPolicy.fromAccessPolicyName('AmazonEKSClusterAdminPolicy', {
    accessScopeType: cdk.aws_eks.AccessScopeType.CLUSTER
  });
  let partialEKSAccessEntriesFromConfig: Array<partialEKSAccessEntry> = [];
  if(config.clusterAdminARNs){
    for (let index = 0; index < config.clusterAdminARNs.length; index++) {
      partialEKSAccessEntriesFromConfig.push(new partialEKSAccessEntry(config.clusterAdminARNs[index], [clusterAdmin]));      
    }
  }

  // const pre_existing_vpc_stack = new cdk.Stack(stateStorage, 'pre-existing-vpc', {
  //   env: {
  //     account: config.account,
  //     region: config.region
  //   }
  // });

  // const pre_existing_vpc = ec2.Vpc.fromLookup(pre_existing_vpc_stack,'pre-existing-vpc', {
  //   vpcName: 'lower-envs-vpc', //This assumes vpcName is unique, looks up by name
  //   vpcId: "vpc-0544ea1fe5dc27131",
  // });//end pre_existing_vpc

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
    privateCluster: false,
    ipFamily: eks.IpFamily.IP_V4, 
//    vpc: pre_existing_vpc,
  });

  return cluster_blueprint;
}
