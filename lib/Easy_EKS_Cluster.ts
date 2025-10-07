//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//AWS CDK Imports:
import { Construct, IConstruct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Config Library Imports:
import * as global_baseline_eks_config from '../config/eks/global_baseline_eks_config';
import * as my_orgs_baseline_eks_config from '../config/eks/my_orgs_baseline_eks_config';
import * as lower_envs_eks_config from '../config/eks/lower_envs_eks_config';
import * as higher_envs_eks_config from '../config/eks/higher_envs_eks_config';
import * as dev_eks_config from '../config/eks/dev_eks_config';
import * as test_eks_config from '../config/eks/test_eks_config';
import * as stage_eks_config from '../config/eks/stage_eks_config';
import * as prod_eks_config from '../config/eks/prod_eks_config';
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Utility Imports:
import * as shell from 'shelljs'; //npm install shelljs && npm i --save-dev @types/shelljs
import console = require('console'); //can help debug feedback loop, allows `console.log("hi");` to work, when `cdk list` is run.
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Local Library Imports:
import { Easy_EKS_Config_Data } from './Easy_EKS_Config_Data';
import { Easy_EKS_Dynamic_Config } from './Easy_EKS_Dynamic_Config';
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export class Easy_EKS_Cluster{ //purposefully don't extend stack, to implement builder pattern and give more flexibility for imperative logic.

    //Class Variables/Properties:
    stack: cdk.Stack;
    cluster: eks.Cluster;
    cluster_exists: boolean;
    //eks_config: Easy_EKS_Config_Data; //<-- doesn't exist within this class on purpose
    //^-- Avoid multiple instances to prevent unexpected results from multiple config object instances having de-synchronized config.

    //Class Constructor:
    constructor(storage_for_stacks_state: Construct, cluster_name: string, stack_config: cdk.StackProps) {
        this.stack = new cdk.Stack(storage_for_stacks_state, `${cluster_name}-cluster`, stack_config);
    }//end constructor of Easy_EKS_Cluster

    //Class Functions:
    stage_deployment_of_global_baseline_eks_addons(config: Easy_EKS_Config_Data){ global_baseline_eks_config.deploy_addons(config, this.stack, this.cluster); }
    stage_deployment_of_my_orgs_baseline_eks_addons(config: Easy_EKS_Config_Data){ my_orgs_baseline_eks_config.deploy_addons(config, this.stack, this.cluster); }
    stage_deployment_of_lower_envs_eks_addons(config: Easy_EKS_Config_Data){ lower_envs_eks_config.deploy_addons(config, this.stack, this.cluster); }
    stage_deployment_of_higher_envs_eks_addons(config: Easy_EKS_Config_Data){ higher_envs_eks_config.deploy_addons(config, this.stack, this.cluster); }
    stage_deployment_of_dev_eks_addons(config: Easy_EKS_Config_Data){ dev_eks_config.deploy_addons(config, this.stack, this.cluster); }
    stage_deployment_of_test_eks_addons(config: Easy_EKS_Config_Data){ test_eks_config.deploy_addons(config, this.stack, this.cluster); }
    stage_deployment_of_stage_eks_addons(config: Easy_EKS_Config_Data){ stage_eks_config.deploy_addons(config, this.stack, this.cluster); }
    stage_deployment_of_prod_eks_addons(config: Easy_EKS_Config_Data){ prod_eks_config.deploy_addons(config, this.stack, this.cluster); }

    initialize_WorkerNodeRole(stack: cdk.Stack){
        const ipv6_support_iam_policy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    resources: ['arn:aws:ec2:*:*:network-interface/*'],
                    actions: [
                        'ec2:AssignIpv6Addresses',
                        'ec2:UnassignIpv6Addresses',
                    ],
                }),
            ],
        });
        const EKS_Worker_Node_Role = new iam.Role(stack, 'EKS_Worker_Node_Role', {
            //roleName: //cdk isn't great about cleaning up resources, so leting it generate name is more reliable
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSWorkerNodePolicy'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKS_CNI_Policy'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'), //workaround https://github.com/aws/aws-for-fluent-bit/issues/983
                //^-- allows aws managed browser based shell access to private nodes, can be useful for debuging
                //^-- AWS Systems Manager --> Session Manager --> Start Session
            ],
            inlinePolicies: {
                ipv6_support_iam_policy,
            },
        });
        EKS_Worker_Node_Role.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN); //Workaround to avoid cdk destroy bug
        // ^--This leaves orphaned IAM roles, which isn't ideal, yet least bad option.
        //    Shouldn't hurt anything in most cases (there is a max of 1000 IAM roles per AWS account)
        //    It'd only be a problem after 100's of deploy & destroy operations, after which it's easy to manually clean up.
        return EKS_Worker_Node_Role;
    }

    stage_deployment_of_eks_cluster(config: Easy_EKS_Config_Data){
        const baseline_LT_Spec = initalize_baseline_LT_Spec(this.stack, config);
        const baseline_MNG: eks.NodegroupOptions = {
            subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            amiType: eks.NodegroupAmiType.BOTTLEROCKET_ARM_64,
            instanceTypes: [new ec2.InstanceType('t4g.medium')], //medium = 2cpu, 4gb ram, 17 max pods per node
            //^-- Can't go smaller. small supports 11 max pods per node, medium supports 17 max pods per node
            //    daemonsets make it so medium is smallest acceptable baseline node size.
            capacityType: eks.CapacityType.SPOT,
            desiredSize: config.baselineNodesNumber,
            minSize: 0,
            maxSize: 50,
            nodeRole: config.workerNodeRole,
            launchTemplateSpec: baseline_LT_Spec, //<-- necessary to add tags to EC2 instances
        };
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Logic to create cluster:  
        // if (kms.Key.isLookupDummy(kms.Key.fromLookup(this.stack, "pre-existing-kms-key", { aliasName: this.config.kmsKeyAlias, returnDummyKeyOnMissing: true,  }))){
        //     eksBlueprint.resourceProvider(blueprints.GlobalResources.KmsKey, new blueprints.CreateKmsKeyProvider(
        //     this.config.kmsKeyAlias, {description: "Easy EKS generated kms key, used to encrypt etcd and ebs-csi-driver provisioned volumes"}
        // ));}
        // else { eksBlueprint.resourceProvider(blueprints.GlobalResources.KmsKey, new blueprints.LookupKmsKeyProvider(this.config.kmsKeyAlias)); }
        ensure_existance_of_aliased_kms_key(config.kmsKeyAlias, this.stack.stackName, this.stack.region);
        const kms_key = config.kmsKey;
        this.cluster = new eks.Cluster(this.stack, config.cluster_name, {
            clusterName: config.cluster_name,
            version: config.kubernetesVersion,
            kubectlLayer: config.kubectlLayer,
            clusterLogging: config.control_plane_logging_options_to_enable,
            vpc: config.vpc,
            ipFamily: config.ipMode,
            vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
            defaultCapacity: 0,
            tags: config.tags,
            authenticationMode: eks.AuthenticationMode.API_AND_CONFIG_MAP,
            // mastersRole: //<-- This is the built in way to set output associated with update-kubeconfig
            //                    The role specified is usually assumable by iam.AccountRootPrinciple which isn't secure,
            //                    so mastersRole is purposefully commented out / not implemented for improved security.
            //                    Its functionality is replaced by a custom cdk.CfnOutput call.
            secretsEncryptionKey: kms_key,
        });
        //v-- This achieve similar yet better results than commented out mastersRole
        const msg = `aws eks update-kubeconfig --region ${this.stack.region} --name ${config.cluster_name}\n\n` +
        'Note: This only works for the user/role deploying cdk and IAM Whitelisted Admins.\n'+
        '      To learn more review ./easyeks/config/eks/lower_envs_eks_config.ts';
        const output_msg = new cdk.CfnOutput(this.stack, 'iamWhitelistedKubeConfigCmd', { value: msg });
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //Logic to add nicer Name Tags to EKS's Security Groups
        //Update Control Plane SG:
        const eks_control_plane_sg = (this.stack.node.tryFindChild(config.cluster_name)?.node.tryFindChild('ControlPlaneSecurityGroup')?.node.defaultChild as cdk.CfnResource);
        cdk.Tags.of(eks_control_plane_sg).add('Name', `${config.cluster_name}/control-plane`);
        //Update Cluster Nodes SG:
        //v-- This implementation works around a cdk limitation
        if(config.preexisting_cluster_detected){
            const cmd_to_update_sg_tag = `aws ec2 create-tags \
                                         --resources ${config.sg_id_of_cluster_nodes} \
                                         --tags Key=Name,Value=${config.cluster_name}/cluster-nodes`
            shell.exec(cmd_to_update_sg_tag, {silent:true});
        }
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //Logic to add baseline Managed Node Group to Cluster
        this.cluster.addNodegroupCapacity('baseline_MNG', baseline_MNG);
        // TIP:
        // If CloudFormation update fails after editing nodepool
        // OR
        // If you plan to make iterative changes to nodepools
        // renaming 'baseline_MNG' to 'baseline_MNG1' 
        // (and then switching back and forth or incrementing by 1, like baseline_MNG2, will speed things up.)
        // If the name changes it can do a delete and create in parallel so the update takes ~400s
        // If the name stays the same it does an inplace rolling update which takes 3x longer ~1200s
        // If while tinkering you temporarily change the variable name baseline_MNG1 to make feedback of dev1-eks faster
        // Then you should change the variable name back to baseline_MNG when you're done, because if you don't then
        //      the other envs (dev2, test1, stage1, prod1, etc.), would have their nodepool force updated on next update.
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Logic to allow all authenticated users in AWS account Limited Viewer Only Access by default:
        if(config.clusterViewerAccessAwsAuthConfigmapAccounts){ //<-- JS truthy statement to say if not empty do the following
            for (let index = 0; index < config.clusterViewerAccessAwsAuthConfigmapAccounts?.length; index++) {
                this.cluster.awsAuth.addAccount(config.clusterViewerAccessAwsAuthConfigmapAccounts[index]);
            }
            //v-- kubectl apply -f viewer_only_rbac.yaml
            let apply_viewer_only_rbac_YAML = new eks.KubernetesManifest(this.stack, 'viewer_only_rbac_yamls',
                {
                    cluster: this.cluster,
                    manifest: [viewer_only_crb, enhanced_viewer_cr],
                    overwrite: true,
                    prune: true,   
                }
            );
            (apply_viewer_only_rbac_YAML.node.defaultChild as cdk.CfnResource).applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
        }
        // Note: Config as Code allows this to be enabled/disabled, default config has it set to enabled.
        // The intented functionality is:
        // * To allow any authenticated human user to view non-sensitive yaml in AWS Web Console by default.
        // 
        // How?
        // * A Cluster Role Binding maps all authenticated users to viewer only access.
        // * It's a little excessive in terms of principle of least privilege, but shouldn't hurt security, given limited rights.
        // 
        // Who are Limited Viewr Only Users?
        // * Human users logged into the EKS Section of the AWS Web Console
        // * All authenticated Kubernetes users (so all pods)
        // 
        // What can't they do?
        // * Regardless of AWS Web Console or kubectl access
        //   * Can't read kubernetes secrets
        //   * Can't create or edit objects
        // * AWS IAM identities won't automatically gain the ability to get kubectl access.
        // * kubectl access requires additional IAM permissions, even if kubectl access is given, it
        //   * Can't read kubectl secrets
        //   * Can't kubectl exec into pods
        // 
        // What can they do?
        // * View YAML objects in AWS Web Console (with the exception of secrets)           
        // * If given additional IAM rights for kubectl access, can get, describe, and -o yaml most objects.
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Logic to add the person running cdk deploy to the list of cluster admins
        // This satisfies EKS IAM access entry rights prerequisite, needed to allow the output command to work
        // aws eks update-kubeconfig --region ca-central-1 --name dev1-eks
        // For good security we lock this down to whitelisted IAM access entries, defined in the Access tab of EKS's web console
        // For convienence we make an assumption that the IAM identity running cdk deploy dev1-eks, should be auto-added to that list.
        // A singleton pattern is used to avoid multiple lookups.
        config.add_cluster_wide_kubectl_Admin_Access_using_ARN(Easy_EKS_Dynamic_Config.get_ARN_of_IAM_Identity_running_CDK_Deploy());
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Logic to add Cluster Admins Defined in Config as Code:
        const clusterAdminAccessPolicy: eks.AccessPolicy = eks.AccessPolicy.fromAccessPolicyName('AmazonEKSClusterAdminPolicy', {
          accessScopeType: eks.AccessScopeType.CLUSTER
        });
        if(config.clusterAdminAccessEksApiArns){ //<-- JS truthy statement to say if not empty do the following
            for (let index = 0; index < config.clusterAdminAccessEksApiArns?.length; index++) {
                new eks.AccessEntry( this.stack, config.clusterAdminAccessEksApiArns[index], //<-- using ARN as a unique subStack id
                {
                    accessPolicies: [clusterAdminAccessPolicy],
                    cluster: this.cluster,
                    principal: config.clusterAdminAccessEksApiArns[index],
                    accessEntryName: config.clusterAdminAccessEksApiArns[index]
                });
            }
        }
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    }//end of stage_deployment_of_eks_cluster()

}//end class Easy_EKS_Cluster
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    max-pods = 17
    `;
    //^-- per https://github.com/aws/amazon-vpc-cni-k8s/blob/master/misc/eni-max-pods.txt
    // t4g.small supports max-pods = 11
    // t4g.medium supports max-pods = 17
    // Before adding observability stack daemonsets took up 8/11 of small's pod capacity
    // Proactively bumping min node size from t4g.small to t4g.medium to account for daemonsets needed by observability stack
    const Bottlerocket_baseline_MNG_userdata = ec2.UserData.custom(Bottlerocket_baseline_MNG_TOML);
    const Baseline_MNG_LT = new ec2.LaunchTemplate(stack, `ARM64-Bottlerocket-${baseline_node_type}_MNG_LT`, {
      launchTemplateName: `${config.cluster_name}/baseline-MNG/arm64-bottlerocket-${baseline_node_type}`, //EKS Layer2 construct makes 2 LT's for some reason, uses the eks-* one.
      //blockDevices: [Baseline_MNG_Disk_AL2023],
      blockDevices: [Baseline_MNG_Disk_Bottlerocket_1_of_2, Baseline_MNG_Disk_Bottlerocket_2_of_2],
      userData: Bottlerocket_baseline_MNG_userdata,
    });
    cdk.Tags.of(Baseline_MNG_LT).add("Name", `${config.cluster_name}/baseline-MNG/arm64-bottlerocket-${baseline_node_type}`);
    const tags = Object.entries(config.tags ?? {});
    tags.forEach(([key, value]) => cdk.Tags.of(Baseline_MNG_LT).add(key,value));
    const baseline_LT_Spec: eks.LaunchTemplateSpec = {
      id: Baseline_MNG_LT.launchTemplateId!,
      version: Baseline_MNG_LT.latestVersionNumber,
    };
    return baseline_LT_Spec;

}//end initialize_baseline_LT_Spec
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function ensure_existance_of_aliased_kms_key(kmsKeyAlias: string, stackName: string, region: string){
    /*UX Improvement: By default EKS Blueprint will make new KMS key everytime you make a cluster.
    This logic checks for pre-existing keys, and prefers to reuse them. Else create if needed, reuse next time.
    The intent is to achieve the following EasyEKS default: (which is overrideable):
    * all lower envs share a kms key: "alias/eks/lower-envs" (alias/ will be added if not present.)
    * staging envs share a kms key: "alias/eks/stage"
    * prod envs share a kms key: "alias/eks/prod"
    */
    const cmd = `aws kms list-aliases --region ${region} | jq '.Aliases[] | select(.AliasName == "${kmsKeyAlias}") | .TargetKeyId'`
    const cmd_results = shell.exec(cmd,{silent:true}).stdout;
    let key_id = "";
    if(cmd_results===""){ //if alias not found, then make a kms key with the alias
        const create_key_cmd = `aws kms create-key --region ${region} --description="Easy EKS generated kms key, used to encrypt etcd and ebs-csi-driver provisioned volumes"`
        const results = JSON.parse( shell.exec(create_key_cmd,{silent:true}).stdout );
        key_id = results.KeyMetadata.KeyId;
        const add_alias_cmd = `aws kms create-alias --alias-name ${kmsKeyAlias} --target-key-id ${key_id} --region ${region}`;
        shell.exec(add_alias_cmd,{silent:true});
        //get the ebs csi role, so it can be used to add permissions to the new key
    }
    // Below is disabled for now, as we need to test that it assigns the permissions correctly / not fully tested WIP code
    //else { //if alias found, then get the key id
    //    key_id = cmd_results.replace(/"/g, ''); //remove quotes from string
    //}
    //give_kms_access_to_ebs_csi_role(stackName, region, key_id); 
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*function give_kms_access_to_ebs_csi_role(stackName: string, region: string, KeyId: string){
    const roleName = stackName + '-awsebscsidriveriamrole';
    const cdm_list_ebs_csi_role = `aws iam list-roles --query "Roles[?contains(RoleName, '${roleName}')].Arn" --output text`;
    const list_roles_cmd = shell.exec(cdm_list_ebs_csi_role,{silent:true}).stdout;
    if (list_roles_cmd !== '') {
        const policy = `{
          "Version": "2012-10-17",
          "Id": "key-default-1",
          "Statement": [
            {
              "Sid": "Enable IAM User Permissions",
              "Effect": "Allow",
              "Principal": {
                "AWS": "arn:aws:iam::381492072749:root"
              },
              "Action": "kms:*",
              "Resource": "*"
            },
            {
              "Sid": "Enable IAM User Permissions",
              "Effect": "Allow",
              "Principal": {
                "AWS": "${list_roles_cmd.trim()}"
              },
              "Action": [
                "kms:Encrypt",
                "kms:Decrypt",
                "kms:ReEncrypt*",
                "kms:GenerateDataKey*",
                "kms:DescribeKey",
                "kms:CreateGrant",
                "kms:ListGrants",
                "kms:RevokeGrant"
              ],
              "Resource": "*"
            }
          ]
        }`;
        const cmp_policy_cmd = `aws kms put-key-policy --policy-name default --key-id ${KeyId.trim()} --region ${region} --policy '${policy}'`;
        shell.exec(cmp_policy_cmd,{silent:true}).stdout;
    } else {
        console.log(`EBS CSI Role with name: ${roleName} already exists.`);
    }
}*/
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
