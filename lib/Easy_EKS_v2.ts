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
import { Karpenter } from 'cdk-eks-karpenter' //npm install cdk-eks-karpenter 

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
        const EKS_Node_Role = new iam.Role(this.stack, `EKS_Node_Role`, {
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

        const Baseline_MNG_Disk: ec2.BlockDevice = {
            deviceName: '/dev/xvda', //Root device name
            volume: ec2.BlockDeviceVolume.ebs(20, { volumeType: ec2.EbsDeviceVolumeType.GP3 }), //<--20GB volume size
        }
        let baseline_node_type:string;
            if(this.config.baselineNodesType === eks.CapacityType.SPOT){ baseline_node_type = "spot"; }
            else { baseline_node_type = "on-demand"; }
        const Baseline_MNG_LT = new ec2.LaunchTemplate(this.stack, `ARM64-Bottlerocket-${baseline_node_type}_MNG_LT`, {
            launchTemplateName: `${this.config.id}/baseline-MNG/ARM64-Bottlerocket-${baseline_node_type}`, //NOTE: CDK creates 2 LT's for some reason 2nd is eks-*
            blockDevices: [Baseline_MNG_Disk],
        });
        cdk.Tags.of(Baseline_MNG_LT).add("Name", `${this.config.id}/baseline-MNG/ARM64-Bottlerocket-${baseline_node_type}`);
        const tags = Object.entries(this.config.tags ?? {});
        tags.forEach(([key, value]) => cdk.Tags.of(Baseline_MNG_LT).add(key,value));
        const baseline_LT_Spec: eks.LaunchTemplateSpec = {
            id: Baseline_MNG_LT.launchTemplateId!,
            version: Baseline_MNG_LT.latestVersionNumber,
        };

        const baseline_MNG: eks.NodegroupOptions = {
            subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            amiType: eks.NodegroupAmiType.BOTTLEROCKET_ARM_64,
            instanceTypes: [new ec2.InstanceType('t4g.small')], //t4g.small = 2cpu, 2gb ram, 11pod max
            capacityType: eks.CapacityType.SPOT,
            desiredSize: this.config.baselineNodesNumber,
            minSize: 0,
            maxSize: 50,
            nodeRole: EKS_Node_Role,
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
            version: eks.KubernetesVersion.V1_31,
            kubectlLayer: new KubectlV31Layer(this.stack, 'kubectl'),
            vpc: this.config.vpc,
            ipFamily: this.config.ipMode,
            vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
            defaultCapacity: 0,
            tags: this.config.tags,
            authenticationMode: eks.AuthenticationMode.API_AND_CONFIG_MAP,
            mastersRole: assumableEKSAdminAccessRole, //<-- adds aws eks update-kubeconfig output
            secretsEncryptionKey: kms_key,
            });
        this.cluster.addNodegroupCapacity(`baseline_MNG`, baseline_MNG);
        let cluster = this.cluster;

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
        new eks.CfnAddon(this.stack, 'coredns', {
            clusterName: cluster.clusterName,
            addonName: 'coredns',
            addonVersion: 'v1.11.4-eksbuild.2',
            configurationValues: `{
                "autoScaling": {
                  "enabled": true,
                  "minReplicas": 2,
                  "maxReplicas": 1000
                },
                "affinity": {
                  "nodeAffinity": {
                    "requiredDuringSchedulingIgnoredDuringExecution": {
                      "nodeSelectorTerms": [
                        {
                          "matchExpressions": [
                            {
                              "key": "kubernetes.io/os",
                              "operator": "In",
                              "values": [
                                "linux"
                              ]
                            },
                            {
                              "key": "kubernetes.io/arch",
                              "operator": "In",
                              "values": [
                                "amd64",
                                "arm64"
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  },
                  "podAntiAffinity": {
                    "requiredDuringSchedulingIgnoredDuringExecution": [
                      {
                        "labelSelector": {
                          "matchExpressions": [
                            {
                              "key": "k8s-app",
                              "operator": "In",
                              "values": [
                                "kube-dns"
                              ]
                            }
                          ]
                        },
                        "topologyKey": "kubernetes.io/hostname"
                      }
                    ]
                  }
                }
            }`, //end CoreDNS configurationValues override
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
        new eks.CfnAddon(this.stack, 'metrics-server', {
            clusterName: cluster.clusterName,
            addonName: 'metrics-server',
            addonVersion: 'v0.7.2-eksbuild.1', //v--query for latest
            // aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=metrics-server --query='addons[].addonVersions[].addonVersion' | jq '.[0]'
            resolveConflicts: 'OVERWRITE',
            configurationValues: `{
                "replicas": 2,
                "addonResizer": {
                  "enabled": true,
                },
                "affinity": {
                  "nodeAffinity": {
                    "requiredDuringSchedulingIgnoredDuringExecution": {
                      "nodeSelectorTerms": [
                        {
                          "matchExpressions": [
                            {
                              "key": "kubernetes.io/os",
                              "operator": "In",
                              "values": [
                                "linux"
                              ]
                            },
                            {
                              "key": "kubernetes.io/arch",
                              "operator": "In",
                              "values": [
                                "amd64",
                                "arm64"
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  },
                  "podAntiAffinity": {
                    "requiredDuringSchedulingIgnoredDuringExecution": [
                      {
                        "labelSelector": {
                          "matchExpressions": [
                            {
                              "key": "k8s-app",
                              "operator": "In",
                              "values": [
                                "metrics-server"
                              ]
                            }
                          ]
                        },
                        "topologyKey": "kubernetes.io/hostname"
                      }
                    ]
                  }
                }
            }`, //end metrics-server configurationValues override
        });
        // new eks.CfnAddon(this.stack, 'eks-node-monitoring-agent', {
        //     clusterName: cluster.clusterName,
        //     addonName: 'eks-node-monitoring-agent',
        //     addonVersion: 'v1.0.1-eksbuild.2', //v--query for latest
        //     // aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=eks-node-monitoring-agent --query='addons[].addonVersions[].addonVersion' | jq '.[0]'
        // });
        // ^-- TO DO: debug, ds pods crash loop with 'failed to start metrics server: failed to create listener: listen tcp :8080: bind: address already in use'
        // OR wait for https://github.com/aws/containers-roadmap/issues/2521
        // Could workaround it with static manifest until the add-on is updated.

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
            wait: true,
            timeout: cdk.Duration.minutes(15),
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
        // The following help prevent timeout of install during initial cluster deployment
        awsLoadBalancerController.node.addDependency(cluster.awsAuth);
        awsLoadBalancerController.node.addDependency(ALBC_Kube_SA);

        // Install Node Local DNS Cache
        const nodeLocalDNSCache = cluster.addHelmChart('NodeLocalDNSCache', {
            chart: "node-local-dns", // Name of the Chart to be deployed
            release: "node-local-dns-cache", // Name for our chart in Kubernetes (helm list -A)
            repository: "oci://ghcr.io/deliveryhero/helm-charts/node-local-dns",  // HTTPS address of the helm chart (associated with helm repo add command)
            namespace: "kube-system",
            version: "2.1.4", // version of the helm chart, based on the following command
            // curl https://raw.githubusercontent.com/deliveryhero/helm-charts/refs/heads/master/stable/node-local-dns/Chart.yaml | grep version: | cut -d ':' -f 2
            wait: false,
            values: { //<-- helm chart values per https://github.com/deliveryhero/helm-charts/blob/master/stable/node-local-dns/values.yaml
            },
        });
        nodeLocalDNSCache.node.addDependency(cluster.awsAuth);

        // Install Karpenter.sh
        const karpenter = new Karpenter(this.stack, 'Karpenter', {
            cluster: cluster,
            namespace: 'kube-system',
            version: '1.2.0', //https://gallery.ecr.aws/karpenter/karpenter
            nodeRole: EKS_Node_Role, //custom NodeRole to pass to Karpenter Nodes
            helmExtraValues: { //https://github.com/aws/karpenter-provider-aws/blob/v1.2.0/charts/karpenter/values.yaml
                replicas: 2,
            },
        });
        karpenter.node.addDependency(cluster.awsAuth);

        //Karpenter Custom Resources based on https://karpenter.sh/docs/getting-started/getting-started-with-karpenter/
        //Converted using https://onlineyamltools.com/convert-yaml-to-json
        const karpenter_bottlerocket_spot_NodePool = {
            "apiVersion": "karpenter.sh/v1",
            "kind": "NodePool",
            "metadata": {
              "name": "karpenter-bottlerocket-spot" //karpenter in name b/c it shows up in Managed by column of AWS Web Console GUI
            },
            "spec": {
              "weight": 100, //<-- Note highest weight = default
              "template": {
                "metadata": {
                  "labels": { //Kubernetes Label attached to EKS Node
                    "Name": 'bottlerocket-spot',
                  }
                },
                "spec": {
                  "nodeClassRef": {
                    "group": "karpenter.k8s.aws",
                    "kind": "EC2NodeClass",
                    "name": "bottlerocket"
                  },
                  "requirements": [
                    {
                      "key": "karpenter.k8s.aws/instance-category",
                      "operator": "In",
                      "values": [ "t", "c", "m", "r", ]
                    },
                    {
                      "key": "kubernetes.io/arch",
                      "operator": "In",
                      "values": [
                        "amd64",
                        "arm64"
                      ]
                    },
                    {
                      "key": "kubernetes.io/os",
                      "operator": "In",
                      "values": [ "linux" ]
                    },
                    {
                      "key": "karpenter.sh/capacity-type",
                      "operator": "In",
                      "values": [ "spot" ]
                    }
                  ],
                  "expireAfter": "720h"
                }
              },
              "limits": {
                "cpu": 1000
              },
              "disruption": {
                "consolidationPolicy": "WhenEmptyOrUnderutilized",
                "consolidateAfter": "1m"
              }
            }
        };//end karpenter_bottlerocket_spot_NodePool
        const karpenter_bottlerocket_on_demand_NodePool = {
            "apiVersion": "karpenter.sh/v1",
            "kind": "NodePool",
            "metadata": {
              "name": 'karpenter-bottlerocket-on-demand' //karpenter in name b/c it shows up in Managed by column of AWS Web Console GUI
            },
            "spec": {
              "weight": 50, //<-- Note highest weight = default
              "template": {
                "metadata": {
                  "labels": { //Kubernetes Label attached to EKS Node
                    "Name": 'bottlerocket-on-demand'
                  }
                },
                "spec": {
                  "nodeClassRef": {
                    "group": "karpenter.k8s.aws",
                    "kind": "EC2NodeClass",
                    "name": "bottlerocket"
                  },
                  "requirements": [
                    {
                      "key": "karpenter.k8s.aws/instance-category",
                      "operator": "In",
                      "values": [ "t", "c", "m", "r", ]
                    },
                    {
                      "key": "kubernetes.io/arch",
                      "operator": "In",
                      "values": [
                        "amd64",
                        "arm64"
                      ]
                    },
                    {
                      "key": "kubernetes.io/os",
                      "operator": "In",
                      "values": [ "linux" ]
                    },
                    {
                      "key": "karpenter.sh/capacity-type",
                      "operator": "In",
                      "values": [ "on-demand" ]
                    }
                  ],
                  "expireAfter": "720h"
                }
              },
              "limits": {
                "cpu": 1000
              },
              "disruption": {
                "consolidationPolicy": "WhenEmptyOrUnderutilized",
                "consolidateAfter": "1m"
              }
            }
        };//end karpenter_bottlerocket_on_demand_NodePool
        let subnetSelectorTerms: Array<{[key:string]: string}> = [];
        for(let i=0; i<3; i++){ 
          subnetSelectorTerms.push( {"id": `${this.config.vpc.privateSubnets[i]?.subnetId}`} );
        };
        //^-- The above oddness is equivalent to this-v, but is resilient against a variable number of subnets:
        //       "subnetSelectorTerms": [
        //         { "id": `${this.config.vpc.privateSubnets[0]?.subnetId}` },
        //         { "id": `${this.config.vpc.privateSubnets[1]?.subnetId}` },
        //         { "id": `${this.config.vpc.privateSubnets[2]?.subnetId}` },
        //       ],
        const karpenter_bottlerocket_EC2NodeClass = {
          "apiVersion": "karpenter.k8s.aws/v1",
          "kind": "EC2NodeClass",
          "metadata": {
            "name": "bottlerocket"
          },
          "spec": {
            "amiFamily": "bottlerocket",
            "role": `${EKS_Node_Role.roleName}`,
            "subnetSelectorTerms": subnetSelectorTerms,
            "securityGroupSelectorTerms": [ { "tags": { "aws:eks:cluster-name": `${this.cluster.clusterName}` } } ],
            "amiSelectorTerms": [
              { "alias": "bottlerocket@v1.31.6" },
              //Bottlerocket is easier than AL2023 & more secure by default, but if need AL2023:
              //AL2023's Alias = "al2023@v20250123"
              //Date came from:
              //aws ssm get-parameter --name /aws/service/eks/optimized-ami/1.31/amazon-linux-2023/x86_64/standard/recommended/image_name --region ca-central-1 --query "Parameter.Value" --output text
              //amazon-eks-node-al2023-x86_64-standard-1.31-v20250123
            ],
            "tags": {//ARM64-bottlerocket-spot
              "Name": `${this.cluster.clusterName}/karpenter/bottlerocket-spot`,
            }
          }
        };
        const apply_karpenter1 = cluster.addManifest('karpenter_bottlerocket_EC2NodeClass', karpenter_bottlerocket_EC2NodeClass);
        const apply_karpenter2 = cluster.addManifest('karpenter_bottlerocket_spot_NodePool', karpenter_bottlerocket_spot_NodePool);
        const apply_karpenter3 = cluster.addManifest('karpenter_bottlerocket_on_demand_NodePool', karpenter_bottlerocket_on_demand_NodePool);
        apply_karpenter1.node.addDependency(karpenter);
        apply_karpenter2.node.addDependency(karpenter);
        apply_karpenter3.node.addDependency(karpenter);

    }//end deploy_cluster()

}//end Easy_EKS_v2



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