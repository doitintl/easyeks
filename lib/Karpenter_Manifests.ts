import { Easy_EKS_Config_Data } from './Easy_EKS_Config_Data';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IConstruct } from 'constructs';
import { Karpenter } from 'cdk-eks-karpenter' //npm install cdk-eks-karpenter 

export interface Karpenter_Helm_Config {
    helm_chart_version: string,
    helm_chart_values?: Record<string, any> | undefined,
}

export interface Karpenter_Manifest_Loop_Inputs {
    arch: string,
    type: string,
    weight: number,
    nodepools_cpu_limit: number,
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class Karpenter_YAML_Generator{
                                    
    config: Easy_EKS_Config_Data;
    cluster: eks.Cluster;
                                                       // Plausible Values to expect:
    amiSelectorTerms_alias: string;                    // "bottlerocket@v1.31.0"
    consolidationPolicy: string;                       // "WhenEmptyOrUnderutilized"
    manifest_inputs: Karpenter_Manifest_Loop_Inputs[]; // [{arch: "arm64", type: "spot", weight: 100, nodepools_cpu_limit: 1000 }]
    constructor(input_parmeters: Partial<Karpenter_YAML_Generator>){ Object.assign(this, input_parmeters); }

    generate_manifests(){
        let array_of_yaml_manifests_to_return: { [key:string]: any }[] = [];
        let config = this.config;
        let cluster = this.cluster;
        //^-- I'm purposefully only shortening a subset of variables to not need this keyword.
        //    This shortening trick isn't being done with input parameter's
        //    The intent is to make it easier for human's reading the code to distinguish variable type by inspection
        //    config.*     cluster.*    config.vpc.privateSubnets.length ---> all represent some variables you should skim
        //    this.*                    this.amiSelectorTerms_alias --------> all represent an input parameter to focus on

        //Karpenter Custom Resources based on https://karpenter.sh/docs/getting-started/getting-started-with-karpenter/
        //Most of this started from yaml converted using https://onlineyamltools.com/convert-yaml-to-json, 
        //then variablized.
        //then split into multiple karpenter yaml manifests to have nicer AWS tagging.
    
        let subnetSelectorTerms: Array<{[key:string]: string}> = [];
        for(let i=0; i<config.vpc.privateSubnets.length; i++){ 
          subnetSelectorTerms.push( {"id": `${config.vpc.privateSubnets[i]?.subnetId}`} );
        };
        //^-- The above oddness is equivalent to this-v, but is resilient against a variable number of private subnets:
        //       "subnetSelectorTerms": [
        //         { "id": `${config.vpc.privateSubnets[0]?.subnetId}` },
        //         { "id": `${config.vpc.privateSubnets[1]?.subnetId}` },
        //         { "id": `${config.vpc.privateSubnets[2]?.subnetId}` },
        //       ],
        let ipv6_status: string = "enabled";
        if(config.ipMode===eks.IpFamily.IP_V6){console.log("ipv6 enabled")};
        if(config.ipMode===eks.IpFamily.IP_V4){console.log("ipv4 enabled")};
        for (const item of this.manifest_inputs) {
            const karpenter_bottlerocket_EC2NodeClass = {
                "apiVersion": "karpenter.k8s.aws/v1",
                "kind": "EC2NodeClass",
                "metadata": {
                    "name": `${item.arch}-bottlerocket-${item.type}`
                },
                "spec": {
                    "amiFamily": "Bottlerocket",
                    "role": `${config.workerNodeRole.roleName}`,
                    "tags": {//ARM64-bottlerocket-spot
                        "Name": `${cluster.clusterName}/karpenter/${item.arch}-bottlerocket-${item.type}`, //<-- "dev1-eks/karpenter/x86_64-bottlerocket-spot", etc.
                    },
                    "metadataOptions": { //overriding karpenter.sh's stupid default values & replacing with defaults that improve app compatibility
                                         //This also makes karpenter node's IMDSv2 configuration consistent with that of default MNG Nodes
                        "httpTokens": "required", //IMDSv2 = Required
                        "httpEndpoint": "enabled",
                        "httpProtocolIPv6": ipv6_status, //enabled or disabled based on config
                        "httpPutResponseHopLimit": 2 //2 allows pods to successfully run commands like the example below while IMDSv2 is set to enforced
// kubectl run -it curl --image=docker.io/curlimages/curl -- sh
// TOKEN=`curl -X PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 600"`
// curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id                        
                    },
                    "subnetSelectorTerms": subnetSelectorTerms,
                    "securityGroupSelectorTerms": [ { "tags": { "aws:eks:cluster-name": `${cluster.clusterName}` } } ],
                    "amiSelectorTerms": [
                        { "alias": this.amiSelectorTerms_alias }, //<--"bottlerocket@v1.31.6"
                        //Bottlerocket is easier than AL2023 & more secure by default, but if need AL2023:
                        //AL2023's Alias = "al2023@v20250123"
                        //Date came from:
                        //aws ssm get-parameter --name /aws/service/eks/optimized-ami/1.31/amazon-linux-2023/x86_64/standard/recommended/image_name --region ca-central-1 --query "Parameter.Value" --output text
                        //amazon-eks-node-al2023-x86_64-standard-1.31-v20250123
                    ],
                }
            };//end EC2NodeClass

            const karpenter_bottlerocket_NodePool = {
                "apiVersion": "karpenter.sh/v1",
                "kind": "NodePool",
                "metadata": {
                    "name": `karpenter-${item.arch}-bottlerocket-${item.type}` //karpenter in name b/c it shows up in "Managed by" column of AWS Web Console GUI
                },
                "spec": {
                    "weight": parseInt(`${item.weight}`), //converts string to integer
                    "template": {
                        "metadata": {
                            "labels": { //Kubernetes Label attached to EKS Node
                                "NodePool": `karpenter-${item.arch}-bottlerocket-${item.type}`,
                            }
                        },
                        "spec": {
                            "nodeClassRef": {
                                "group": "karpenter.k8s.aws",
                                "kind": "EC2NodeClass",
                                "name": `${item.arch}-bottlerocket-${item.type}`
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
                                      `${item.arch}`,
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
                                  "values": [ `${item.type}` ]
                              }
                          ],
                          "expireAfter": "720h", //One Month
                      }
                    },
                    "limits": {
                        "cpu": parseInt(`${item.nodepools_cpu_limit}`),
                    },
                    "disruption": {
                        "consolidationPolicy": this.consolidationPolicy,
                        "consolidateAfter": "1m"
                    }
                }                
            };//end Nodepool

            array_of_yaml_manifests_to_return.push(karpenter_bottlerocket_EC2NodeClass);
            array_of_yaml_manifests_to_return.push(karpenter_bottlerocket_NodePool);
        }//end for

        return array_of_yaml_manifests_to_return;
    } //end generate_manifests

} //end class Karepnter_Manifests

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function Apply_Karpenter_YAMLs_with_fixes(stack: cdk.Stack, cluster: eks.Cluster, config: Easy_EKS_Config_Data,
                                                karpenter_helm_config: Karpenter_Helm_Config, 
                                                karpenter_YAMLs: {[key: string]: any;}[]){

    //v-- Creates a ton of prerequisites and a release/instance of karpenter helm chart
    const karpenter = new Karpenter(stack, 'Karpenter', {
        cluster: cluster,
        namespace: 'kube-system',
        version: karpenter_helm_config.helm_chart_version,
        nodeRole: config.workerNodeRole,
        helmExtraValues: karpenter_helm_config.helm_chart_values,
    });
    //v-- The following updates cdk's order of operations to wait to deploy karpenter, until cluster is ready
    karpenter.node.addDependency(cluster.awsAuth);
    //v-- Patch fix for https://github.com/aws-samples/cdk-eks-karpenter/issues/231
    Patch_Karpenters_IAM_Role(stack, config);
    //v-- The following 2 lines help prevent cdk destroy issue
    const karpenter_helm_chart_CFR = (stack.node.tryFindChild(config.cluster_name)?.node.tryFindChild('chart-karpenter')?.node.defaultChild as cdk.CfnResource);
    if(karpenter_helm_chart_CFR){ karpenter_helm_chart_CFR.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN); }

    //v-- kubectl apply -f karpenter_YAMLs
    const apply_karpenter_YAML = new eks.KubernetesManifest(stack, 'karpenter_YAMLs',
        {
            cluster: cluster,
            manifest: karpenter_YAMLs,
            overwrite: true,
            prune: true,   
        }
    );
    //v-- Inform cdk of order of operations
    apply_karpenter_YAML.node.addDependency(karpenter);
    //v-- The following 2 lines prevent cdk destroy issue
    const apply_karpenter_YAML_CFR = (apply_karpenter_YAML.node.defaultChild as cdk.CfnResource);
    if(apply_karpenter_YAML_CFR){ apply_karpenter_YAML_CFR.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN); }

} //end function Apply_Karpenter_YAMLs_with_fixes

function Patch_Karpenters_IAM_Role(stack: cdk.Stack, config: Easy_EKS_Config_Data){
    //Patch fix for https://github.com/aws-samples/cdk-eks-karpenter/issues/231
    let karpenter_controller_pods_role = stack.node.tryFindChild(config.cluster_name)?.node.tryFindChild('karpenter')?.node.tryFindChild('Role') as iam.Role;
    const karpenter_IAM_Policy_JSON = {
        "Version": "2012-10-17",
        "Statement": [
          {
            "Sid": "AllowInstanceProfileActions",
            "Effect": "Allow",
            "Resource": `arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT!}:instance-profile/*`,
            "Action": [
              "iam:GetInstanceProfile",
              "iam:AddRoleToInstanceProfile",
              "iam:RemoveRoleFromInstanceProfile",
              ],
          },
          { //v-- This isn't a hard requirement, but enables faster convergence
            //    without it karpenter logs temporarily mention an IAM rights failure, that fixes itself within 11 mins.
            "Sid": "LessRestrictivePassRoleForFasterConvergence",
            "Effect": "Allow",
            "Resource": `arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT!}:role/*`,
            "Action": [
              "iam:PassRole",
              ],
          },
        ]
      };
    const karpenter_IAM_Policy = new iam.Policy(stack, `karpenter_controller_pod_IAM_policy_for_EKS`, {
        document: iam.PolicyDocument.fromJson( karpenter_IAM_Policy_JSON ),
    });
    karpenter_controller_pods_role.attachInlinePolicy(karpenter_IAM_Policy);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////