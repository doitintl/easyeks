import console = require('console'); //can help debug feedback loop, allows `console.log("hi");` to work, when `cdk list` is run.
import { Construct, IConstruct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as blueprints from '@aws-quickstart/eks-blueprints'; 
//          ^-- blueprints as in blueprint of a eks cluster defined as a declarative cloud formation stack
import { Easy_EKS_Config_Data } from './Easy_EKS_Config_Data';
import { partialEKSAccessEntry, GenericClusterProviderWithAccessEntrySupport } from './Modified_Cluster_Provider';
//Config Library Imports:
import * as global_baseline_eks_config from '../config/eks/global_baseline_eks_config';
import * as my_orgs_baseline_eks_config from '../config/eks/my_orgs_baseline_eks_config';
import * as lower_envs_eks_config from '../config/eks/lower_envs_eks_config';
import * as dev_eks_config from '../config/eks/dev_eks_config';
import * as monitoring from './Frugal_GPL_Monitoring_Stack'; //TO DO
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class Easy_EKS{

    //Class Variables/Properties:
    stack: cdk.Stack;
    config: Easy_EKS_Config_Data;

    //Class Constructor:
    constructor(storage_for_stacks_state: Construct, id_for_stack_and_eks_cluster: string, stack_config: cdk.StackProps) {
        this.stack = new cdk.Stack(storage_for_stacks_state, id_for_stack_and_eks_cluster, stack_config);
        this.config = new Easy_EKS_Config_Data(id_for_stack_and_eks_cluster);
    }//end constructor of Opinionated_VPC

    //Class Functions:
    apply_global_baseline_eks_config(){ global_baseline_eks_config.apply_config(this.config,this.stack); }
    apply_my_orgs_baseline_eks_config(){ my_orgs_baseline_eks_config.apply_config(this.config,this.stack); }
    apply_lower_envs_eks_config(){ lower_envs_eks_config.apply_config(this.config,this.stack); }
    apply_dev_eks_config(){ dev_eks_config.apply_config(this.config,this.stack); }
    deploy_eks_construct_into_this_objects_stack(){
        const eksBlueprint = blueprints.EksBlueprint.builder();
        eksBlueprint.resourceProvider(blueprints.GlobalResources.Vpc, new blueprints.DirectVpcProvider(this.config.vpc));
        eksBlueprint.clusterProvider(generate_cluster_blueprint(this.config));
        eksBlueprint.version(this.config.kubernetesVersion);
        if(this.config.clusterAddOns){ //<--JS truthy statement saying if not null
            eksBlueprint.addOns(...this.config.getClusterAddons());
            //                  ^... is JS array deconsturing operator which converts an array to a CSV list of parameters
        }
        const eks_blueprint_properties = convert_blueprintBuilder_to_blueprintProperties(this.config.id, eksBlueprint);
        const deploy_construct_into_stack = new blueprints.EksBlueprintConstruct(this.stack, eks_blueprint_properties);
    }//end deploy_eks_construct_into_this_objects_stack()

}//end class of Easy_EKS

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function convert_blueprintBuilder_to_blueprintProperties(id: string, blueprint_builder: blueprints.BlueprintBuilder){
    let partial_blueprint_properties:Partial<blueprints.EksBlueprintProps> = blueprint_builder.props; 
    //partial means some values may be null
    //so we need to verify the partial object can safely be converted to the complete object.
    //id is the only value of EksBlueprintProps that must exist in a valid complete object.
    const blueprint_properties = { ...partial_blueprint_properties, id } as blueprints.EksBlueprintProps;
    return blueprint_properties;  
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function generate_cluster_blueprint( config: Easy_EKS_Config_Data){
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
                id: "ARM64-MNG",
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
                launchTemplate: { tags: {...config.tags, ["Name"]: `${config.id}/baseline-MNG/ARM64-spot`} }
                //^-- attaches tags to Launch Template, which gets propagated to these kubernetes worker node
            }
        ],
        outputConfigCommand: true,
        privateCluster: false,
        ipFamily: config.ipMode,
    });
    return cluster_blueprint;
}
