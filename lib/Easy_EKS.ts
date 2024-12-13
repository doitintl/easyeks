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
//Config Library Imports:
import * as global_baseline_eks_config from '../config/eks/global_baseline_eks_config';
import * as my_orgs_baseline_eks_config from '../config/eks/my_orgs_baseline_eks_config';
import * as lower_envs_eks_config from '../config/eks/lower_envs_eks_config';
import * as higher_envs_eks_config from '../config/eks/higher_envs_eks_config';
import * as dev_eks_config from '../config/eks/dev_eks_config';
import * as monitoring from './Frugal_GPL_Monitoring_Stack'; //TO DO
import { execSync } from 'child_process'; //temporary work around for kms UX issue


///////////////////////////////////////////////////////////////////////////////////////////////////

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
    apply_higher_envs_eks_config(){ higher_envs_eks_config.apply_config(this.config,this.stack); }
    apply_only_dev_eks_config(){ dev_eks_config.apply_config(this.config,this.stack); }
    apply_dev_eks_config(){ //convenience method
        global_baseline_eks_config.apply_config(this.config,this.stack);
        my_orgs_baseline_eks_config.apply_config(this.config,this.stack);
        lower_envs_eks_config.apply_config(this.config,this.stack);
        dev_eks_config.apply_config(this.config,this.stack); 
    }
    deploy_eks_construct_into_this_objects_stack(){
        const eksBlueprint = blueprints.EksBlueprint.builder();
        //logic to ensure the existance of kms key used to encrypt kube kubernetes secrets stored in AWS Managed etcd & csi ebs volumes.
        ensure_existance_of_aliased_kms_key(this.config.kmsKeyAlias);
        // This can be uncommented after the following is fixed https://github.com/aws/aws-cdk/issues/32368
        // if (kms.Key.isLookupDummy(kms.Key.fromLookup(this.stack, "pre-existing-kms-key", { aliasName: this.config.kmsKeyAlias, returnDummyKeyOnMissing: true,  }))){
        //     eksBlueprint.resourceProvider(blueprints.GlobalResources.KmsKey, new blueprints.CreateKmsKeyProvider(
        //     this.config.kmsKeyAlias, {description: "Easy EKS generated kms key, used to encrypt etcd and ebs-csi-driver provisioned volumes"}
        // ));}
        // else { eksBlueprint.resourceProvider(blueprints.GlobalResources.KmsKey, new blueprints.LookupKmsKeyProvider(this.config.kmsKeyAlias)); }
        eksBlueprint.resourceProvider(blueprints.GlobalResources.KmsKey, new blueprints.LookupKmsKeyProvider(this.config.kmsKeyAlias));
        eksBlueprint.resourceProvider(blueprints.GlobalResources.Vpc, new blueprints.DirectVpcProvider(this.config.vpc));
        eksBlueprint.clusterProvider(generate_cluster_blueprint(this.config));
        eksBlueprint.version(this.config.kubernetesVersion);
        if(this.config.clusterAddOns){ //<--JS truthy statement saying if not null
            eksBlueprint.addOns(...this.config.getClusterAddons());
            //                  ^... is JS array deconsturing operator which converts an array to a CSV list of parameters
        }
        const eks_blueprint_properties = convert_blueprintBuilder_to_blueprintProperties(this.config.id, eksBlueprint);

        const deploy_construct_into_stack = new blueprints.EksBlueprintConstruct(this.stack, eks_blueprint_properties);
        const ipv6_support_policy_statement = new iam.PolicyStatement({
            actions: ['ec2:AssignIpv6Addresses','ec2:UnassignIpv6Addresses'],
            resources: ['arn:aws:ec2:*:*:network-interface/*'],
        })
        const karpenter_node_role = this.stack.node.findChild(this.config.id).node.tryFindChild('karpenter-node-role') as iam.Role;
        const aws_vpc_cni_pod_role = this.stack.node.findChild(this.config.id).node.tryFindChild('aws-node-sa')?.node.tryFindChild('Role') as iam.Role;
        karpenter_node_role.addToPolicy(ipv6_support_policy_statement);
        aws_vpc_cni_pod_role.addToPolicy(ipv6_support_policy_statement);
    }//end deploy_eks_construct_into_this_objects_stack()

}//end class of Easy_EKS

///////////////////////////////////////////////////////////////////////////////////////////////////

function ensure_existance_of_aliased_kms_key(kmsKeyAlias: string){
    /*UX Improvement: By default EKS Blueprint will make new KMS key everytime you make a cluster.
    This logic checks for pre-existing keys, and prefers to reuse them. Else create if needed, reuse next time.
    The intent is to achieve the following EasyEKS default: (which is overrideable):
    * all lower envs share a kms key: "alias/eks/lower-envs" (alias/ will be added if not present.)
    * staging envs share a kms key: "alias/eks/stage"
    * prod envs share a kms key: "alias/eks/prod"
    */
    let kms_key:kms.Key;   
    const cmd = `aws kms list-aliases | jq '.Aliases[] | select(.AliasName == "${kmsKeyAlias}") | .TargetKeyId'`
    const cmd_results = execSync(cmd).toString();
    if(cmd_results===""){ //if alias not found, then make a kms key with the alias
        const create_key_cmd = `aws kms create-key --description="Easy EKS generated kms key, used to encrypt etcd and ebs-csi-driver provisioned volumes"`
        const results = JSON.parse( execSync(create_key_cmd).toString() );
        const key_id = results.KeyMetadata.KeyId;
        const add_alias_cmd = `aws kms create-alias --alias-name ${kmsKeyAlias} --target-key-id ${key_id}`;
        execSync(add_alias_cmd);
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////

function convert_blueprintBuilder_to_blueprintProperties(id: string, blueprint_builder: blueprints.BlueprintBuilder){
    let partial_blueprint_properties:Partial<blueprints.EksBlueprintProps> = blueprint_builder.props; 
    //partial means some values may be null
    //so we need to verify the partial object can safely be converted to the complete object.
    //id is the only value of EksBlueprintProps that must exist in a valid complete object.
    const blueprint_properties = { ...partial_blueprint_properties, id } as blueprints.EksBlueprintProps;
    return blueprint_properties;  
}

///////////////////////////////////////////////////////////////////////////////////////////////////

interface EasyEksClusterProviderProps extends blueprints.GenericClusterProviderProps {
    config: Easy_EKS_Config_Data;
}

class EasyEksClusterProvider extends blueprints.GenericClusterProvider { 
    config: Easy_EKS_Config_Data;
    constructor(props:EasyEksClusterProviderProps){
        super(props);
        this.config = props.config;
    }
   
    protected internalCreateCluster(stateStorage: Construct, stackID: string, clusterOptions: any): eks.Cluster {
        const cluster = new eks.Cluster(stateStorage, stackID, clusterOptions);

        const clusterAdminAccessPolicy: eks.AccessPolicy = eks.AccessPolicy.fromAccessPolicyName('AmazonEKSClusterAdminPolicy', {
            accessScopeType: eks.AccessScopeType.CLUSTER
        });

        if(this.config.clusterAdminAccessEksApiArns){ //<-- JS truthy statement to say if not empty do the following
            for (let index = 0; index < this.config.clusterAdminAccessEksApiArns?.length; index++) {
                new eks.AccessEntry( stateStorage, this.config.clusterAdminAccessEksApiArns[index], //<-- using ARN as a unique subStack id
                {
                    accessPolicies: [clusterAdminAccessPolicy],
                    cluster: cluster,
                    principal: this.config.clusterAdminAccessEksApiArns[index],
                    accessEntryName: this.config.clusterAdminAccessEksApiArns[index]
                });
            }
        }//end if

        const awsAuthConfigMap = new eks.AwsAuth(stateStorage, `${stackID}-aws-auth-cm`, {cluster: cluster}); 

        if(this.config.clusterViewerAccessAwsAuthConfigmapAccounts){ //<-- JS truthy statement to say if not empty do the following
            for (let index = 0; index < this.config.clusterViewerAccessAwsAuthConfigmapAccounts?.length; index++) {
                awsAuthConfigMap.addAccount(this.config.clusterViewerAccessAwsAuthConfigmapAccounts[index]);
            }
        }//end if
      
      return cluster;    
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////

function generate_cluster_blueprint(config: Easy_EKS_Config_Data){
    const cluster_blueprint = new EasyEksClusterProvider({
        config: config, //<-- passes easy eks config data
        tags: config.tags, //<-- attaches tags to EKS cluster in AWS Web Console
        authenticationMode: eks.AuthenticationMode.API_AND_CONFIG_MAP,
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

///////////////////////////////////////////////////////////////////////////////////////////////////
