// The point of this is to investigate not using eks-blueprints, which has been problematic.
// * not as maintained as I 1st thought, https://github.com/aws-quickstart/cdk-eks-blueprints/graphs/code-frequency
// * It's karpenter has been busted for a long time, I suspect this standalone could be more reliable https://github.com/aws-samples/cdk-eks-karpenter
// * Many operations can only be done against object of type eks.Cluster, blueprints made that hard to get access to
//   I found edge case limitations where even though I can access it by overriding an internal protected method I can't do things like deploy yaml
//   due to an order of operations issue, so going to do a major refactor to get rid of EKS Blueprint in favor of L2 construct.
//   v2 will be based on https://github.com/aws/aws-cdk/tree/main/packages/aws-cdk-lib/aws-eks#aws-iam-mapping

import console = require('console'); //can help debug feedback loop, allows `console.log("hi");` to work, when `cdk list` is run.
import { Construct, IConstruct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Easy_EKS_Config_Data } from './Easy_EKS_Config_Data';
//Config Library Imports:
import * as global_baseline_eks_config from '../config/eks/global_baseline_eks_config';
import * as my_orgs_baseline_eks_config from '../config/eks/my_orgs_baseline_eks_config';
import * as lower_envs_eks_config from '../config/eks/lower_envs_eks_config';
import * as higher_envs_eks_config from '../config/eks/higher_envs_eks_config';
import * as dev_eks_config from '../config/eks/dev_eks_config';
import * as observability from './Frugal_GPL_Observability_Stack';
import { execSync } from 'child_process'; //temporary? work around for kms UX issue
import request from 'sync-request-curl'; //npm install sync-request-curl (cdk requires sync functions, async not allowed)



export class Easy_EKS{ //purposefully don't extend stack, to implement builder pattern and give more flexibility for imperative logic.

    //Class Variables/Properties:
    stack: cdk.Stack;
    config: Easy_EKS_Config_Data;
    cluster: eks.Cluster;

    //Class Constructor:
    constructor(storage_for_stacks_state: Construct, id_for_stack_and_eks_cluster: string, stack_config: cdk.StackProps) {
        this.stack = new cdk.Stack(storage_for_stacks_state, id_for_stack_and_eks_cluster, stack_config);
        this.config = new Easy_EKS_Config_Data(id_for_stack_and_eks_cluster); /*
        Constructor with minimal args is on purpose for desired UX of "builder pattern".
        The idea is to add partial configuration snippets over time/as multiple operations
        rather than populate a complete config all at once in one go.*/
    }//end constructor of Easy_EKS_v2

    //Class Functions:
    apply_global_baseline_eks_config(){ global_baseline_eks_config.apply_config(this.config,this.stack); }
    apply_my_orgs_baseline_eks_config(){ my_orgs_baseline_eks_config.apply_config(this.config,this.stack); }
    apply_lower_envs_eks_config(){ lower_envs_eks_config.apply_config(this.config,this.stack); }
    apply_higher_envs_eks_config(){ higher_envs_eks_config.apply_config(this.config,this.stack); }
    apply_dev_eks_config(){ dev_eks_config.apply_config(this.config,this.stack); }
    apply_dev_baseline_config(){ //convenience method
        global_baseline_eks_config.apply_config(this.config,this.stack);
        my_orgs_baseline_eks_config.apply_config(this.config,this.stack);
        lower_envs_eks_config.apply_config(this.config,this.stack);
        dev_eks_config.apply_config(this.config,this.stack);
    }

    deploy_global_baseline_eks_workloads(){ global_baseline_eks_config.deploy_workloads(this.config,this.stack, this.cluster); }
    deploy_my_orgs_baseline_eks_workloads(){ my_orgs_baseline_eks_config.deploy_workloads(this.config,this.stack, this.cluster); }
    deploy_lower_envs_eks_workloads(){ lower_envs_eks_config.deploy_workloads(this.config,this.stack, this.cluster); }
    deploy_higher_envs_eks_workloads(){ higher_envs_eks_config.deploy_workloads(this.config,this.stack, this.cluster); }
    deploy_dev_eks_workloads(){ dev_eks_config.deploy_workloads(this.config,this.stack, this.cluster); }
    deploy_dev_baseline_workloads(){ //convenience method
        global_baseline_eks_config.deploy_workloads(this.config,this.stack, this.cluster);
        my_orgs_baseline_eks_config.deploy_workloads(this.config,this.stack, this.cluster);
        lower_envs_eks_config.deploy_workloads(this.config,this.stack, this.cluster);
        dev_eks_config.deploy_workloads(this.config,this.stack, this.cluster);
    }

    deploy_eks_construct_into_this_objects_stack(){
        this.config.baselineNodeRole = initialize_baselineNodeRole(this.stack);
        const baseline_LT_Spec = initalize_baseline_LT_Spec(this.stack, this.config);

        const baseline_MNG: eks.NodegroupOptions = {
            subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            amiType: eks.NodegroupAmiType.BOTTLEROCKET_ARM_64,
            instanceTypes: [new ec2.InstanceType('t4g.small')], //t4g.small = 2cpu, 2gb ram, 11pod max
            capacityType: eks.CapacityType.SPOT,
            desiredSize: this.config.baselineNodesNumber,
            minSize: 0,
            maxSize: 50,
            nodeRole: this.config.baselineNodeRole,
            launchTemplateSpec: baseline_LT_Spec, //<-- necessary to add tags to EC2 instances
        };

        const clusterAdminAccessPolicy: eks.AccessPolicy = eks.AccessPolicy.fromAccessPolicyName('AmazonEKSClusterAdminPolicy', {
            accessScopeType: eks.AccessScopeType.CLUSTER
        });

        //UX convienence similar to EKS Blueprints
        const assumableEKSAdminAccessRole = new iam.Role(this.stack, 'assumableEKSAdminAccessRole', {
          assumedBy: new iam.AccountRootPrincipal(), //<-- root as is root of the account,
                                                     // so assumable by any principle/identity in the account.
        });
  
        // if (kms.Key.isLookupDummy(kms.Key.fromLookup(this.stack, "pre-existing-kms-key", { aliasName: this.config.kmsKeyAlias, returnDummyKeyOnMissing: true,  }))){
        //     eksBlueprint.resourceProvider(blueprints.GlobalResources.KmsKey, new blueprints.CreateKmsKeyProvider(
        //     this.config.kmsKeyAlias, {description: "Easy EKS generated kms key, used to encrypt etcd and ebs-csi-driver provisioned volumes"}
        // ));}
        // else { eksBlueprint.resourceProvider(blueprints.GlobalResources.KmsKey, new blueprints.LookupKmsKeyProvider(this.config.kmsKeyAlias)); }
        ensure_existance_of_aliased_kms_key(this.config.kmsKeyAlias);
        const kms_key = kms.Key.fromLookup(this.stack, 'pre-existing-kms-key', { aliasName: this.config.kmsKeyAlias });

        this.cluster = new eks.Cluster(this.stack, this.config.id, {
            clusterName: this.config.id,
            version: this.config.kubernetesVersion,
            kubectlLayer: this.config.kubectlLayer,
            vpc: this.config.vpc,
            ipFamily: this.config.ipMode,
            vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
            defaultCapacity: 0,
            tags: this.config.tags,
            authenticationMode: eks.AuthenticationMode.API_AND_CONFIG_MAP,
            mastersRole: assumableEKSAdminAccessRole, //<-- adds aws eks update-kubeconfig output
            secretsEncryptionKey: kms_key,
        });


        let cluster = this.cluster;
        this.cluster.addNodegroupCapacity('baseline_MNG', baseline_MNG);
        //TIP:
        //If you plan to make iterative changes to nodepools
        //renaming 'baseline_MNG' to 'baseline_MNG1' 
        //(and then switching back and forth or incrementing by 1, like baseline_MNG2, will speed things up.)
        //If the name changes it can do a delete and create in parallel so the update takes ~400s
        //If the name stays the same it does an inplace rolling update which takes 3x longer ~1200s

        // Configure Limited Viewer Only Access by default:
        if(this.config.clusterViewerAccessAwsAuthConfigmapAccounts){ //<-- JS truthy statement to say if not empty do the following
            for (let index = 0; index < this.config.clusterViewerAccessAwsAuthConfigmapAccounts?.length; index++) {
                cluster.awsAuth.addAccount(this.config.clusterViewerAccessAwsAuthConfigmapAccounts[index]);
            }
            cluster.addManifest('viewer_only_cluster_role_binding', viewer_only_crb);
            cluster.addManifest('enhanced_viewer_cluster_role', enhanced_viewer_cr);
        }

        // Configure Cluster Admins via IaC:
        if(this.config.clusterAdminAccessEksApiArns){ //<-- JS truthy statement to say if not empty do the following
            for (let index = 0; index < this.config.clusterAdminAccessEksApiArns?.length; index++) {
                new eks.AccessEntry( this.stack, this.config.clusterAdminAccessEksApiArns[index], //<-- using ARN as a unique subStack id
                {
                    accessPolicies: [clusterAdminAccessPolicy],
                    cluster: cluster,
                    principal: this.config.clusterAdminAccessEksApiArns[index],
                    accessEntryName: this.config.clusterAdminAccessEksApiArns[index]
                });
            }
        }//end if



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //Logic to Add EKS Addons Defined in Config
        if(this.config.eksAddOnsMap){ //JS falsy statement meaning if not empty
            for (let [addonName, input] of this.config.eksAddOnsMap){
                const props: eks.CfnAddonProps = { 
                    clusterName: cluster.clusterName,
                    addonName: addonName,
                    addonVersion: input.addonVersion,
                    configurationValues: input.configurationValues,
                }
                new eks.CfnAddon(this.stack, addonName, props);
            }
        }
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    }//end deploy_cluster()

}//end Easy_EKS_v2
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function initialize_baselineNodeRole(stack: cdk.Stack){
  const ipv6_support_iam_policy = new iam.PolicyDocument({
      statements: [new iam.PolicyStatement({
      resources: ['arn:aws:ec2:*:*:network-interface/*'],
      actions: [
          'ec2:AssignIpv6Addresses',
          'ec2:UnassignIpv6Addresses',
      ],
      })],
  });
  const EKS_Node_Role = new iam.Role(stack, `EKS_Node_Role`, {
      //roleName: //cdk isn't great about cleaning up resources, so leting it generate name is more reliable
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSWorkerNodePolicy'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKS_CNI_Policy'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
          //^-- allows aws managed browser based shell access to private nodes, can be useful for debuging
          //^-- AWS Systems Manager --> Session Manager --> Start Session
      ],
      inlinePolicies: {
          ipv6_support_iam_policy,
      },
  });
  return EKS_Node_Role
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function initalize_baseline_LT_Spec(stack: cdk.Stack, config: Easy_EKS_Config_Data){

    const Baseline_MNG_Disk_AL2023: ec2.BlockDevice = {
      deviceName: '/dev/xvda', //AL2023's Root device name 
      volume: ec2.BlockDeviceVolume.ebs(20, { volumeType: ec2.EbsDeviceVolumeType.GP3 }), //<--20GB volume size
    }
    const Baseline_MNG_Disk_Bottlerocket_1_of_2: ec2.BlockDevice = {
    deviceName: '/dev/xvda', //Bottlerocket's 2GB Read Only Root device name 
    volume: ec2.BlockDeviceVolume.ebs(2, { volumeType: ec2.EbsDeviceVolumeType.GP3 }), //<--2GB volume size (pointless to edit)
    }
    const Baseline_MNG_Disk_Bottlerocket_2_of_2: ec2.BlockDevice = {
    deviceName: '/dev/xvdb', //Bottlerocket's Ephemeral storage device name (for container image cache & empty dir volumes)
    volume: ec2.BlockDeviceVolume.ebs(15, { volumeType: ec2.EbsDeviceVolumeType.GP3 }), //<--15GB volume size
    }
    let baseline_node_type:string;
      if(config.baselineNodesType === eks.CapacityType.SPOT){ baseline_node_type = "spot"; }
      else { baseline_node_type = "on-demand"; }
    //v--bottlerocket userdata patch for bug: https://github.com/bottlerocket-os/bottlerocket/issues/4472
    //Odd indentation is on purpose as spacing matters for TOML
    //v-- avoid editing this, invalid config prevents nodes from joining cluster, and results in a slow and annoying feedback loop.
    const Bottlerocket_baseline_MNG_TOML = `
    [settings.kubernetes]
    max-pods = 11
    `;
    //^-- 11 = max pods of t4g.small, per https://github.com/aws/amazon-vpc-cni-k8s/blob/master/misc/eni-max-pods.txt
    const Bottlerocket_baseline_MNG_userdata = ec2.UserData.custom(Bottlerocket_baseline_MNG_TOML);
    const Baseline_MNG_LT = new ec2.LaunchTemplate(stack, `ARM64-Bottlerocket-${baseline_node_type}_MNG_LT`, {
      launchTemplateName: `${config.id}/baseline-MNG/ARM64-Bottlerocket-${baseline_node_type}`, //EKS Layer2 construct makes 2 LT's for some reason, uses the eks-* one.
      //blockDevices: [Baseline_MNG_Disk_AL2023],
      blockDevices: [Baseline_MNG_Disk_Bottlerocket_1_of_2, Baseline_MNG_Disk_Bottlerocket_2_of_2],
      userData: Bottlerocket_baseline_MNG_userdata, //cdk.Fn.base64(Bottlerocket_baseline_MNG_userdata),
    });
    cdk.Tags.of(Baseline_MNG_LT).add("Name", `${config.id}/baseline-MNG/ARM64-Bottlerocket-${baseline_node_type}`);
    const tags = Object.entries(config.tags ?? {});
    tags.forEach(([key, value]) => cdk.Tags.of(Baseline_MNG_LT).add(key,value));
    const baseline_LT_Spec: eks.LaunchTemplateSpec = {
      id: Baseline_MNG_LT.launchTemplateId!,
      version: Baseline_MNG_LT.latestVersionNumber,
    };
    return baseline_LT_Spec;

}//end initialize_baseline_LT_Spec 
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



///////////////////////////////////////////////////////////////////////////////////////////////////
//Viewer Only RBAC Access (Equivalent to whats in research folder)
//Converted using https://onlineyamltools.com/convert-yaml-to-json
const viewer_only_crb = {
    "apiVersion": "rbac.authorization.k8s.io/v1",
    "kind": "ClusterRoleBinding",
    "metadata": {
      "name": "easyeks-all-authenticated-users-viewer"
    },
    "subjects": [
      {
        "apiGroup": "rbac.authorization.k8s.io",
        "kind": "Group",
        "name": "system:authenticated"
      }
    ],
    "roleRef": {
      "apiGroup": "rbac.authorization.k8s.io",
      "kind": "ClusterRole",
      "name": "view"
    }
}

const enhanced_viewer_cr = {
    "apiVersion": "rbac.authorization.k8s.io/v1",
    "kind": "ClusterRole",
    "metadata": {
      "name": "easyeks-enhanced-viewer",
      "labels": {
        "rbac.authorization.k8s.io/aggregate-to-view": "true"
      }
    },
    "rules": [
      {
        "apiGroups": [
          ""
        ],
        "verbs": [
          "get",
          "list",
          "watch"
        ],
        "resources": [
          "podtemplates",
          "nodes",
          "persistentvolumes"
        ]
      },
      {
        "apiGroups": [
          "scheduling.k8s.io"
        ],
        "verbs": [
          "get",
          "list",
          "watch"
        ],
        "resources": [
          "priorityclasses"
        ]
      },
      {
        "apiGroups": [
          "apiregistration.k8s.io"
        ],
        "verbs": [
          "get",
          "list",
          "watch"
        ],
        "resources": [
          "apiservices"
        ]
      },
      {
        "apiGroups": [
          "coordination.k8s.io"
        ],
        "verbs": [
          "get",
          "list",
          "watch"
        ],
        "resources": [
          "leases"
        ]
      },
      {
        "apiGroups": [
          "node.k8s.io"
        ],
        "verbs": [
          "get",
          "list",
          "watch"
        ],
        "resources": [
          "runtimeclasses"
        ]
      },
      {
        "apiGroups": [
          "flowcontrol.apiserver.k8s.io"
        ],
        "verbs": [
          "get",
          "list",
          "watch"
        ],
        "resources": [
          "flowschemas",
          "prioritylevelconfigurations"
        ]
      },
      {
        "apiGroups": [
          "networking.k8s.io"
        ],
        "verbs": [
          "get",
          "list",
          "watch"
        ],
        "resources": [
          "ingressclasses"
        ]
      },
      {
        "apiGroups": [
          "storage.k8s.io"
        ],
        "verbs": [
          "get",
          "list",
          "watch"
        ],
        "resources": [
          "storageclasses",
          "volumeattachments",
          "csidrivers",
          "csinodes",
          "csistoragecapacities"
        ]
      },
      {
        "apiGroups": [
          "rbac.authorization.k8s.io"
        ],
        "verbs": [
          "get",
          "list",
          "watch"
        ],
        "resources": [
          "clusterroles",
          "clusterrolebindings",
          "roles",
          "rolebindings"
        ]
      },
      {
        "apiGroups": [
          "apiextensions.k8s.io"
        ],
        "verbs": [
          "get",
          "list",
          "watch"
        ],
        "resources": [
          "customresourcedefinitions"
        ]
      },
      {
        "apiGroups": [
          "admissionregistration.k8s.io"
        ],
        "verbs": [
          "get",
          "list",
          "watch"
        ],
        "resources": [
          "mutatingwebhookconfigurations",
          "validatingwebhookconfigurations"
        ]
      },
      {
        "apiGroups": [
          "karpenter.sh"
        ],
        "verbs": [
          "get",
          "list",
          "watch"
        ],
        "resources": [
          "nodepools",
          "nodeclaims"
        ]
      },
      {
        "apiGroups": [
          "karpenter.k8s.aws"
        ],
        "verbs": [
          "get",
          "list",
          "watch"
        ],
        "resources": [
          "ec2nodeclasses"
        ]
      },
    ]
}
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