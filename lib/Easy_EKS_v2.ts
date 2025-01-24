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
import * as blueprints from '@aws-quickstart/eks-blueprints'; 
//          ^-- blueprints as in blueprint of a eks cluster defined as a declarative cloud formation stack
import { Easy_EKS_Config_Data, observabilityOptions } from './Easy_EKS_Config_Data';
//Config Library Imports:
import * as global_baseline_eks_config from '../config/eks/global_baseline_eks_config';
import * as my_orgs_baseline_eks_config from '../config/eks/my_orgs_baseline_eks_config';
import * as lower_envs_eks_config from '../config/eks/lower_envs_eks_config';
import * as higher_envs_eks_config from '../config/eks/higher_envs_eks_config';
import * as dev_eks_config from '../config/eks/dev_eks_config';
import * as observability from './Frugal_GPL_Observability_Stack';
import { execSync } from 'child_process'; //temporary? work around for kms UX issue
import { KubectlV31Layer } from '@aws-cdk/lambda-layer-kubectl-v31';
import request from 'sync-request-curl'; //npm install sync-request-curl (cdk requires sync functions, async not allowed)

export class Easy_EKS_v2{ //purposefully don't extend stack, to implement builder pattern and give more flexibility for imperative logic.

    //Class Variables/Properties:
    stack: cdk.Stack;
    config: Easy_EKS_Config_Data;
    cluster: eks.Cluster;

    //Class Constructor:
    constructor(storage_for_stacks_state: Construct, id_for_stack_and_eks_cluster: string, stack_config: cdk.StackProps) {
        this.stack = new cdk.Stack(storage_for_stacks_state, id_for_stack_and_eks_cluster, stack_config);
        this.config = new Easy_EKS_Config_Data(id_for_stack_and_eks_cluster);
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
    deploy_eks_construct_into_this_objects_stack(){

        const ipv6_support_iam_policy = new iam.PolicyDocument({
            statements: [new iam.PolicyStatement({
            resources: ['arn:aws:ec2:*:*:network-interface/*'],
            actions: [
                'ec2:AssignIpv6Addresses',
                'ec2:UnassignIpv6Addresses',
            ],
            })],
        });

        const default_MNG_role = new iam.Role(this.stack, `Default_MNG_Role`, {
            roleName: `${this.config.id}_Default_EKS_MNG_Role`,
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

        

        const blockDevice: ec2.BlockDevice = {
            deviceName: '/dev/xvda', //Root device name
            volume: ec2.BlockDeviceVolume.ebs(20, { volumeType: ec2.EbsDeviceVolumeType.GP3 }), //<--20GB volume size
        }
        const Default_MNG_LT = new ec2.LaunchTemplate(this.stack, 'Default_MNG_LT', {
            launchTemplateName: `${this.config.id}/baseline-MNG/ARM64-spot`, //NOTE: CDK creates 2 LT's for some reason 2nd is eks-*
            blockDevices: [blockDevice],
        });
        cdk.Tags.of(Default_MNG_LT).add("Name", `${this.config.id}/baseline-MNG/ARM64-spot`);
        const tags = Object.entries(this.config.tags ?? {});
        tags.forEach(([key, value]) => cdk.Tags.of(Default_MNG_LT).add(key,value));
        const default_LT_Spec: eks.LaunchTemplateSpec = {
                id: Default_MNG_LT.launchTemplateId!,
                version: Default_MNG_LT.latestVersionNumber,
        };
        const default_MNG: eks.NodegroupOptions = {
            subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            amiType: eks.NodegroupAmiType.AL2023_ARM_64_STANDARD,
            instanceTypes: [new ec2.InstanceType('t4g.small')], //t4g.small = 2cpu, 2gb ram, 11pod max
            capacityType: eks.CapacityType.SPOT,
            desiredSize: 2,
            minSize: 0,
            maxSize: 50,
            nodeRole: default_MNG_role,
            launchTemplateSpec: default_LT_Spec, //<-- necessary to add tags to EC2 instances
        };

        const clusterAdminAccessPolicy: eks.AccessPolicy = eks.AccessPolicy.fromAccessPolicyName('AmazonEKSClusterAdminPolicy', {
            accessScopeType: eks.AccessScopeType.CLUSTER
        });
        //UX convienence similar to EKS Blueprints
        const assumableEKSAdminAccessRole = new iam.Role(this.stack, 'assumableEKSAdminAccessRole', {
        assumedBy: new iam.AccountRootPrincipal(), //<-- root as is root of the account,
                                                   // so assumable by any principle/identity in the account.
        });

        this.cluster = new eks.Cluster(this.stack, this.config.id, {
            clusterName: this.config.id,
            version: eks.KubernetesVersion.V1_31,
            kubectlLayer: new KubectlV31Layer(this.stack, 'kubectl'),
            vpc: this.config.vpc,
            ipFamily: eks.IpFamily.IP_V6,
            vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
            defaultCapacity: 0,
            tags: this.config.tags,
            authenticationMode: eks.AuthenticationMode.API_AND_CONFIG_MAP,
            mastersRole: assumableEKSAdminAccessRole, //<-- adds aws eks update-kubeconfig output
            });

        this.cluster.addNodegroupCapacity('ARM64-MNG', default_MNG);
        let cluster = this.cluster;
        /*To see official names of all eks add-ons:
        aws eks describe-addon-versions  \
        --kubernetes-version=1.31 \
        --query 'sort_by(addons  &owner)[].{owner: owner, addonName: addonName}' \
        --output table
        */
        new eks.Addon(this.stack, 'kube-proxy', {
            cluster,
            addonName: 'kube-proxy',
            addonVersion: 'v1.31.3-eksbuild.2',
        });
        new eks.Addon(this.stack, 'coredns', {
            cluster,
            addonName: 'coredns',
            addonVersion: 'v1.11.4-eksbuild.2',
            
        });
        new eks.Addon(this.stack, 'vpc-cni', {
            cluster,
            addonName: 'vpc-cni',
            addonVersion: 'v1.19.2-eksbuild.1', //v--query for latest
            // aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=vpc-cni --query='addons[].addonVersions[].addonVersion' | jq '.[0]'
        });
        new eks.Addon(this.stack, 'aws-ebs-csi-driver', {
            cluster,
            addonName: 'aws-ebs-csi-driver', 
            addonVersion: 'v1.38.1-eksbuild.2' //v--query for latest
            // aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=aws-ebs-csi-driver --query='addons[].addonVersions[].addonVersion' | jq '.[0]'
        });
        new eks.Addon(this.stack, 'snapshot-controller', {
            cluster,
            addonName: 'snapshot-controller',
            addonVersion: 'v8.1.0-eksbuild.2' //v--query for latest
            // aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=snapshot-controller --query='addons[].addonVersions[].addonVersion' | jq '.[0]'
        });
        new eks.Addon(this.stack, 'metrics-server', {
            cluster,
            addonName: 'metrics-server',
            addonVersion: 'v0.7.2-eksbuild.1' //v--query for latest
            // aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=metrics-server --query='addons[].addonVersions[].addonVersion' | jq '.[0]'
        });
        // The eks-pod-identity-agent Add-on is purposefully commented out due to a CDK bug https://github.com/aws/aws-cdk/issues/32580
        // Another call triggers it's installation, and the cdk bug complains about it already being present.
        // new eks.Addon(this.stack, 'eks-pod-identity-agent', {
        //     cluster,
        //     addonName: 'eks-pod-identity-agent', 
        //     addonVersion: 'v1.3.4-eksbuild.1' //v--query for latest
        //     // aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=eks-pod-identity-agent --query='addons[].addonVersions[].addonVersion' | jq '.[0]'
        // });

        // Install AWS Load Balancer Controller via Helm Chart
        const ALBC_Version = 'v2.11.0'; //Jan 23, 2025 latest from https://github.com/kubernetes-sigs/aws-load-balancer-controller/releases
        const ALBC_IAM_Policy_Url = `https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/refs/tags/${ALBC_Version}/docs/install/iam_policy.json`
        const ALBC_IAM_Policy_JSON = JSON.parse(request("GET", ALBC_IAM_Policy_Url).body.toString());
        const ALBC_IAM_Policy = new iam.Policy(this.stack, `${this.config.id}_AWS_LB_Controller_policy_for_EKS`, {
            document: iam.PolicyDocument.fromJson( ALBC_IAM_Policy_JSON ),
        });
        const ALBC_Kube_SA = new eks.ServiceAccount(this.stack, 'aws-load-balancer-controller', {
            cluster: cluster,
            name: 'aws-load-balancer-controller',
            namespace: 'kube-system',
            identityType: eks.IdentityType.POD_IDENTITY, //depends on eks-pod-identity-agent addon
            //Note: It's not documented, but this generates 3 things:
            //1. A kube SA in the namespace of the cluster
            //2. An IAM role paired to the Kube SA
            //3. An EKS Pod Identity Association
        });
        ALBC_Kube_SA.role.attachInlinePolicy(ALBC_IAM_Policy);
        const awsLoadBalancerController = cluster.addHelmChart('AWSLoadBalancerController', {
            chart: 'aws-load-balancer-controller',
            repository: 'https://aws.github.io/eks-charts',
            namespace: "kube-system",
            release: 'aws-load-balancer-controller',
            version: '1.11.0', //<-- helm chart version based on the following command
            // curl https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/refs/tags/v2.11.0/helm/aws-load-balancer-controller/Chart.yaml | grep version: | cut -d ':' -f 2
            wait: false,
            values: { //<-- helm chart values per https://github.com/kubernetes-sigs/aws-load-balancer-controller/blob/v2.11.0/helm/aws-load-balancer-controller/values.yaml
                clusterName: cluster.clusterName,
                vpcId: this.config.vpc.vpcId,
                region: this.stack.region,
                replicaCount: 1,
                serviceAccount: {
                    name: "aws-load-balancer-controller",
                    create: false,
                },
            },
        });


        
        // new eks.AccessEntry(this.stack, assumableEKSAdminAccessRole.roleArn, //<-- using ARN as a unique subStack id
        //     { 
        //         accessPolicies: [clusterAdminAccessPolicy],
        //         cluster: this.cluster,
        //         principal: assumableEKSAdminAccessRole.roleArn,
        //         accessEntryName: 'assumableEKSAdminAccessRole'
        //     });
        // new cdk.CfnOutput(this.stack, 'easyKubectlAccessCommand', {
        //     value: `aws eks update-kubeconfig --name ${this.config.id} --region ${this.stack.region} --role-arn test` //${this.cluster.adminRole.roleArn}`
        //     });
    }//end deploy_cluster()

}//end Easy_EKS_v2


