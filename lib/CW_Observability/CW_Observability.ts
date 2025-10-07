import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks'
import * as iam from 'aws-cdk-lib/aws-iam';
import { Easy_EKS_Config_Data } from "../Easy_EKS_Config_Data";
import * as fs from 'fs'; //node.js built in file system module, used to improve fluent-bit config edit UX.
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface CloudWatch_Metrics_Input_Parameters {
    addonVersion: string;
    enhanced_container_insights: boolean;
    accelerated_compute_metrics: boolean;
    metrics_collection_interval_seconds: number; //10, 60, 300 are reasonable values
}
export interface CloudWatch_Logs_Input_Parameters {
    application_log_conf_file_name: string;
    dataplane_log_conf_file_name: string;
    fluent_bit_conf_file_name: string;
    host_log_conf_file_name: string;
    parsers_conf_file_name: string;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class CloudWatch_Metrics_and_Logs_Observability {

    //Class Variables/Properties:
    stack: cdk.Stack;
    cluster: eks.ICluster;
    //eks_config: Easy_EKS_Config_Data; //<-- doesn't exist within this class on purpose
    //^-- Avoid multiple instances to prevent unexpected results from multiple config object instances having de-synchronized config.
    cloudwatch_metrics_input_parameters: CloudWatch_Metrics_Input_Parameters;
    cloudwatch_logs_input_parameters: CloudWatch_Logs_Input_Parameters;

    
    //Class Constructor:
    constructor(stack: cdk.Stack, cluster: eks.ICluster){
        this.stack = stack;
        this.cluster = cluster;
    }//end constructor of Grafana_Prometheus_Quickwit_Vector

    
    //Start of classes functions:
    set_input_parameters_of_cloudwatch_metrics(cloudwatch_metrics_input_parameters: CloudWatch_Metrics_Input_Parameters){
        this.cloudwatch_metrics_input_parameters = cloudwatch_metrics_input_parameters;
    }
    set_input_parameters_of_cloudwatch_logs(cloudwatch_logs_input_parameters: CloudWatch_Logs_Input_Parameters){
        this.cloudwatch_logs_input_parameters = cloudwatch_logs_input_parameters;
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    deploy_configured_cloudwatch_metrics_observability(config: Easy_EKS_Config_Data){
        //This deploys 1 daemonset named cloudwatch-agent (in amazon-cloudwatch namespace):
        //   * Generates a log group
        //     * /aws/containerinsights/$CLUSTER_NAME/performance
        //     Don't bother querying this log group for logs
        //     It's just a werid implementation detail, that stores metrics in a log format.
        //   * v- This makes it so you can see metrics in AWS_Console -> CloudWatch -> Container Insights
        const aws_cloudwatch_observability_eks_addon_iam_role = new iam.Role(this.stack, 'metrics-via-aws-cw-observability-eks-addon-iam-role', {
            managedPolicies: [ iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy') ],
            assumedBy: (new cdk.aws_iam.ServicePrincipal("pods.eks.amazonaws.com")),
        });
        aws_cloudwatch_observability_eks_addon_iam_role.assumeRolePolicy!.addStatements( //<-- ! is TypeScript for "I know this variable isn't null"
            new iam.PolicyStatement({
                actions: ['sts:AssumeRole', 'sts:TagSession'],
                principals: [new iam.ServicePrincipal('pods.eks.amazonaws.com')],
            })
        );
        const aws_cloudwatch_observability_eks_addon = new eks.CfnAddon(this.stack, 'metrics-via-aws-cloudwatch-observability-eks-addon', {
            clusterName: this.cluster.clusterName,
            addonName: 'amazon-cloudwatch-observability',
            addonVersion: this.cloudwatch_metrics_input_parameters.addonVersion,
            resolveConflicts: 'OVERWRITE',
            podIdentityAssociations: [
                {
                    serviceAccount: "cloudwatch-agent",
                    roleArn: aws_cloudwatch_observability_eks_addon_iam_role.roleArn,
                }
            ], // (v-- replicaCount: 1, makes logs easier to read/debug, and doesn't hurt stability.)
            //Example of advanced config: https://github.com/aws-observability/helm-charts/issues/173
            configurationValues: `{
                "agent": {
                    "config": {
                        "logs": {
                            "metrics_collected": {
                                "application_signals": {},
                                "kubernetes": {
                                    "cluster_name": "${this.cluster.clusterName}",
                                    "metrics_collection_interval": ${this.cloudwatch_metrics_input_parameters.metrics_collection_interval_seconds},
                                    "enhanced_container_insights": ${this.cloudwatch_metrics_input_parameters.enhanced_container_insights},
                                    "accelerated_compute_metrics": ${this.cloudwatch_metrics_input_parameters.accelerated_compute_metrics},
                                },
                            }
                        },
                        "traces": {
                            "traces_collected": {
                                "application_signals": {}
                            }
                        }
                    }
                },
                "containerLogs": { "enabled": false },
            }`, //aws_cloudwatch_observability_eks_addon configurationValues override
            //containerLogs.enabled = false is on purpose (EasyEKS treats metrics and logs as decoupled options)
        }); //end AWS Cloudwatch Observability EKS Addon
    return aws_cloudwatch_observability_eks_addon;
    } //end deploy_metrics_via_cloudwatch()
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    deploy_configured_cloudwatch_logs_observability(config: Easy_EKS_Config_Data){
        //below is equivalent to & based on $REPO/research/cloudwatch_logs_manual_install.sh
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //Start of Ensure Namespace Exists
        const amazon_cloudwatch_ns_manifest = {
            "apiVersion": "v1",
            "kind": "Namespace",
            "metadata": {
                "name": "amazon-cloudwatch",
                "labels": {
                    "name": "amazon-cloudwatch" //(staying consistent with upstream from $REPO/research/cloudwatch_logs_manual_install.sh)
                }
            }
        };
        const amazon_cloudwatch_ns = new eks.KubernetesManifest(this.stack, "amazon-cloudwatch-namespace",
            {
                cluster: this.cluster,
                manifest: [amazon_cloudwatch_ns_manifest],
                overwrite: true,
                prune: true,
                skipValidation: true, //might make things slightly faster
            }
        );
        const amazon_cloudwatch_ns_CFR = (amazon_cloudwatch_ns.node.defaultChild as cdk.CfnResource);
        amazon_cloudwatch_ns_CFR.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
        //End of of Ensure Namespace Exists
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //pod IAM Role (using worker node role instead)
        //v-- commented out to use worker node's IAM role to avoid an IPv6, IMDSv2, pod-identity-association, & fluentbit specific integration bug
        //https://github.com/aws/aws-for-fluent-bit/issues/983
        // const fluent_bit_Kube_SA = new eks.ServiceAccount(stack, 'fluent-bit_amazon-cloudwatch_kube-sa', {
        //     cluster: cluster,
        //     name: 'fluent-bit',
        //     namespace: cw_logs_ns_manifest.metadata.name,
        //     identityType: eks.IdentityType.POD_IDENTITY, //depends on eks-pod-identity-agent addon
        //     //Note: It's not documented, but this generates 4 things:
        //     //1. A kube SA in the namespace of the cluster
        //     //2. An IAM role paired to the Kube SA
        //     //3. An EKS Pod Identity Association
        //     //4. The eks-pod-identity-agent addon (if it doesn't already exist)
        // });
        const fluent_bit_cluster_info_serviceaccount_manifest = {
            "apiVersion": "v1",
            "kind": "ServiceAccount",
            "metadata": {
                "name": "fluent-bit",
                "namespace": amazon_cloudwatch_ns_manifest.metadata.name,
            }
        };    
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //YAML of the main app
        const fluent_bit_cluster_info_configmap_manifest = {
            "apiVersion": "v1",
            "kind": "ConfigMap",
            "metadata": {
                "name": "fluent-bit-cluster-info",
                "namespace": amazon_cloudwatch_ns_manifest.metadata.name,
            },
            "data": {
                "cluster.name": this.cluster.clusterName,
                "logs.region": config.cluster_region,
                "http.server": "On",
                "http.port": "2020",
                "read.head": "Off",
                "read.tail": "On",
            }
        };
        const fluent_bit_cluster_role_manifest = {
            "apiVersion": "rbac.authorization.k8s.io/v1",
            "kind": "ClusterRole",
            "metadata": {
                "name": "fluent-bit-role"
            },
            "rules": [
                {
                    "nonResourceURLs": [ "/metrics" ],
                    "verbs": [ "get" ]
                },
                {
                    "apiGroups": [ "" ],
                    "resources": [
                        "namespaces",
                        "pods",
                        "pods/logs",
                        "nodes",
                        "nodes/proxy"
                    ],
                    "verbs": [
                        "get",
                        "list",
                        "watch"
                    ]
                }
            ]
        };
        const fluent_bit_cluster_role_binding_manifest = {
            "apiVersion": "rbac.authorization.k8s.io/v1",
            "kind": "ClusterRoleBinding",
            "metadata": {
                "name": "fluent-bit-role-binding"
            },
            "roleRef": {
                "apiGroup": "rbac.authorization.k8s.io",
                "kind": "ClusterRole",
                "name": "fluent-bit-role"
            },
            "subjects": [
                {
                    "kind": "ServiceAccount",
                    "name": "fluent-bit",
                    "namespace": "amazon-cloudwatch"
                }
            ]
        };
        const fluent_bit_daemonset_manifest = {
            "apiVersion": "apps/v1",
            "kind": "DaemonSet",
            "metadata": {
                "name": "fluent-bit",
                "namespace": "amazon-cloudwatch",
                "labels": {
                    "k8s-app": "fluent-bit",
                    "version": "v1",
                    "kubernetes.io/cluster-service": "true"
                }
            },
            "spec": {
                "selector": {
                    "matchLabels": {
                        "k8s-app": "fluent-bit"
                    }
                },
                "template": {
                    "metadata": {
                        "labels": {
                            "k8s-app": "fluent-bit",
                            "version": "v1",
                            "kubernetes.io/cluster-service": "true"
                        }
                    },
                    "spec": {
                        "containers": [
                            {
                                "name": "fluent-bit",
                                "image": "public.ecr.aws/aws-observability/aws-for-fluent-bit:2.32.4",
                                "imagePullPolicy": "Always",
                                "env": [
                                    {
                                        "name": "AWS_REGION",
                                        "valueFrom": {
                                            "configMapKeyRef": {
                                                "name": "fluent-bit-cluster-info",
                                                "key": "logs.region"
                                            }
                                        }
                                    },
                                    {
                                        "name": "CLUSTER_NAME",
                                        "valueFrom": {
                                            "configMapKeyRef": {
                                                "name": "fluent-bit-cluster-info",
                                                "key": "cluster.name"
                                            }
                                        }
                                    },
                                    {
                                        "name": "HTTP_SERVER",
                                        "valueFrom": {
                                            "configMapKeyRef": {
                                                "name": "fluent-bit-cluster-info",
                                                "key": "http.server"
                                            }
                                        }
                                    },
                                    {
                                        "name": "HTTP_PORT",
                                        "valueFrom": {
                                            "configMapKeyRef": {
                                                "name": "fluent-bit-cluster-info",
                                                "key": "http.port"
                                            }
                                        }
                                    },
                                    {
                                        "name": "READ_FROM_HEAD",
                                        "valueFrom": {
                                            "configMapKeyRef": {
                                                "name": "fluent-bit-cluster-info",
                                                "key": "read.head"
                                            }
                                        }
                                    },
                                    {
                                        "name": "READ_FROM_TAIL",
                                        "valueFrom": {
                                            "configMapKeyRef": {
                                                "name": "fluent-bit-cluster-info",
                                                "key": "read.tail"
                                            }
                                        }
                                    },
                                    {
                                        "name": "HOST_NAME",
                                        "valueFrom": {
                                            "fieldRef": {
                                                "fieldPath": "spec.nodeName"
                                            }
                                        }
                                    },
                                    {
                                        "name": "HOSTNAME",
                                        "valueFrom": {
                                            "fieldRef": {
                                                "apiVersion": "v1",
                                                "fieldPath": "metadata.name"
                                            }
                                        }
                                    },
                                    {
                                        "name": "CI_VERSION",
                                        "value": "k8s/1.3.37"
                                    }
                                ],
                                "resources": {
                                    "limits": {
                                        "memory": "200Mi"
                                    },
                                    "requests": {
                                        "cpu": "500m",
                                        "memory": "100Mi"
                                    }
                                },
                                "volumeMounts": [
                                    {
                                        "name": "fluentbitstate",
                                        "mountPath": "/var/fluent-bit/state"
                                    },
                                    {
                                        "name": "varlog",
                                        "mountPath": "/var/log",
                                        "readOnly": true
                                    },
                                    {
                                        "name": "varlibdockercontainers",
                                        "mountPath": "/var/lib/docker/containers",
                                        "readOnly": true
                                    },
                                    {
                                        "name": "fluent-bit-config",
                                        "mountPath": "/fluent-bit/etc/"
                                    },
                                    {
                                        "name": "runlogjournal",
                                        "mountPath": "/run/log/journal",
                                        "readOnly": true
                                    },
                                    {
                                        "name": "dmesg",
                                        "mountPath": "/var/log/dmesg",
                                        "readOnly": true
                                    }
                                ]
                            }
                        ],
                        "terminationGracePeriodSeconds": 10,
                        "hostNetwork": true,
                        "dnsPolicy": "ClusterFirstWithHostNet",
                        "volumes": [
                            {
                                "name": "fluentbitstate",
                                "hostPath": {
                                    "path": "/var/fluent-bit/state"
                                }
                            },
                            {
                                "name": "varlog",
                                "hostPath": {
                                    "path": "/var/log"
                                }
                            },
                            {
                                "name": "varlibdockercontainers",
                                "hostPath": {
                                    "path": "/var/lib/docker/containers"
                                }
                            },
                            {
                                "name": "fluent-bit-config",
                                "configMap": {
                                    "name": "fluent-bit-config"
                                }
                            },
                            {
                                "name": "runlogjournal",
                                "hostPath": {
                                    "path": "/run/log/journal"
                                }
                            },
                            {
                                "name": "dmesg",
                                "hostPath": {
                                    "path": "/var/log/dmesg"
                                }
                            }
                        ],
                        "serviceAccountName": "fluent-bit",
                        "nodeSelector": {
                            "kubernetes.io/os": "linux"
                        }
                    }
                }
            }
        };
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //Dynamically Construct fluent-bit ConfigMap from config files
        let application_log_conf: string = "";
        let dataplane_log_conf: string = "";
        let fluent_bit_conf: string = "";
        let host_log_conf: string = "";
        let parsers_conf: string = "";
        try {
            application_log_conf = fs.readFileSync(`./lib/CW_Observability/${this.cloudwatch_logs_input_parameters.application_log_conf_file_name}`, 'utf8');
            dataplane_log_conf = fs.readFileSync(`./lib/CW_Observability/${this.cloudwatch_logs_input_parameters.dataplane_log_conf_file_name}`, 'utf8');
            fluent_bit_conf = fs.readFileSync(`./lib/CW_Observability/${this.cloudwatch_logs_input_parameters.fluent_bit_conf_file_name}`, 'utf8');
            host_log_conf = fs.readFileSync(`./lib/CW_Observability/${this.cloudwatch_logs_input_parameters.host_log_conf_file_name}`, 'utf8');
            parsers_conf = fs.readFileSync(`./lib/CW_Observability/${this.cloudwatch_logs_input_parameters.parsers_conf_file_name}`, 'utf8');
        } catch (error) {
            console.error(`Error reading Cloudwatch's fluent-bit config file:`, error);
        }
        const fluent_bit_config_configmap_manifest = {
            "apiVersion": "v1",
            "kind": "ConfigMap",
            "metadata": {
                "name": "fluent-bit-config",
                "namespace": amazon_cloudwatch_ns_manifest.metadata.name,
                "labels": {
                    "k8s-app": "fluent-bit"
                }
            },
            "data": {
                "application-log.conf": application_log_conf,
                "dataplane-log.conf": dataplane_log_conf,
                "host-log.conf": host_log_conf,
                "fluent-bit.conf": fluent_bit_conf,
                "parsers.conf": parsers_conf,
            }
        }
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        const enable_cloudwatch_logs = new eks.KubernetesManifest(this.stack, "enable-cloudwatch-logs",
            {
                cluster: this.cluster,
                manifest: [
                    fluent_bit_cluster_info_serviceaccount_manifest,
                    fluent_bit_cluster_info_configmap_manifest,
                    fluent_bit_cluster_role_manifest,
                    fluent_bit_cluster_role_binding_manifest,
                    fluent_bit_daemonset_manifest,
                    fluent_bit_config_configmap_manifest,
                ],
                overwrite: true,
                prune: true,
                skipValidation: true, //might make things slightly faster
            }
        );
        enable_cloudwatch_logs.node.addDependency(amazon_cloudwatch_ns);
    } //End of function enable_logs_observability_via_cloudwatch()
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}//end class CloudWatch_Metrics_and_Logs_Observability
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



/* 
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
The following is purposefully commented out, but left to explain design decision:

AWS's Container Insights for EKS addon has an odd design that leads to a poor UX.
* It can be configure to deploy 2 scenarios
  1. CW Metrics
  2. CW Metrics + CW Logs
* AWS's approach has multiple flaws that hurt UX
  * Forcing json input isn't comment friendly (and comments are needed to explain the config which is confusing due to being hacked together)
  * It doesn't allow you to enable CW Logs (with CW Metrics disabled)
  * To customize CW Logs config (fluentbit), you need 4 yaml config files that need to be converted to single line strings
    so they can be embedded in a json value.
* In my opinion a better design would have been to:
  1. split it into 2 addons (1 for metrics and 1 for logs).
  2. Use human readable input parameters (instead of forcing yaml squashed to single line string)
* To achieve a better UX EasyEKS is taking the aproach of:
  1. Using the Container Insights EKS Addon for Metrics Only
  2. Implementing CW Logs using seperate logic (that will be easier to implement human readable input parameters with)
  The advantage of the approach is that it will allow metric & log options to be enabled & disabled in isolation, which allows mixing and matching.
  Example Combinations: 
  1. CW_Container_Insights(Metrics) + no_logging
  1. Grafana+Prometheus(Metrics) + no_logging
  1. CW_Log_Insights(Logs) + no_metrics
  1. Grafana+QuickWit(Logs) + no_metrics
  1. CW_Container_Insights(Metrics) + CW_Log_Insights(Logs)
  1. Grafana+Prometheus(Metrics) + Grafana+QuickWit(Logs)
  1. Grafana+Prometheus(Metrics) + CW_Log_Insights(Logs)
  1. (and many more combinations)

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
*/

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Older logic kept for reference to help understand the above explanation:
// Install AWS Cloudwatch Observability EKS Addon
// Note as of Sept 24th, 2025 there's an edge case bug that breaks fluent-bit's IAM access
// (The edge case is specific to integration of IPv6_EKS + IMDSv2 + Pod Identity Agent supplied IAM role + fluent-bit)
// So This is purposfully using node IAM rights to workaround the bug. 
// https://github.com/aws/aws-for-fluent-bit/issues/983
// const aws_cloudwatch_observability_eks_addon_iam_role = new iam.Role(stack, 'aws-cw-observability-eks-addon-iam-role', {
//     managedPolicies: [ iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy') ],
//     assumedBy: (new cdk.aws_iam.ServicePrincipal("pods.eks.amazonaws.com")),
// });
// aws_cloudwatch_observability_eks_addon_iam_role.assumeRolePolicy!.addStatements( //<-- ! is TypeScript for "I know this variable isn't null"
//     new iam.PolicyStatement({
//         actions: ['sts:AssumeRole', 'sts:TagSession'],
//         principals: [new iam.ServicePrincipal('pods.eks.amazonaws.com')],
//     })
// );
// const aws_cloudwatch_observability_eks_addon = new eks.CfnAddon(stack, 'aws-cloudwatch-observability-eks-addon', {
//     clusterName: cluster.clusterName,
//     addonName: 'amazon-cloudwatch-observability',
//     addonVersion: Easy_EKS_Dynamic_Config.get_latest_version_of_amazon_cloudwatch_observability_eks_addon(), //OR 'v4.4.0-eksbuild.1'
//     resolveConflicts: 'OVERWRITE',
//     // podIdentityAssociations: [
//     //     {
//     //         serviceAccount: "cloudwatch-agent",
//     //         roleArn: aws_cloudwatch_observability_eks_addon_iam_role.roleArn,
//     //     }
//     // ],
//     // Note about configurationValues:
//     // agent.config.logs.metrics_collected.kubernetes.
//     configurationValues: `{
//         "admissionWebhooks": {},
//         "agent": {
//             "config": {
//                 "logs": {
//                     "metrics_collected": {
//                         "application_signals": {},
//                         "kubernetes": {
//                             "cluster_name": "${cluster.clusterName}",
//                             "metrics_collection_interval": 300,
//                             "enhanced_container_insights": false,
//                             "accelerated_compute_metrics": false
//                         },
//                     }
//                 },
//                 "traces": {
//                     "traces_collected": {
//                         "application_signals": {}
//                     }
//                 }
//             }
//         },
//         "containerLogs": {
//             "enabled": true,
//             "fluentBit": {
//                 "resources": {
//                     "requests": {
//                         "cpu": "50m",
//                         "memory": "25Mi"
//                     },
//                     "limits": {
//                         "cpu": "500m",
//                         "memory": "250Mi"
//                     }
//                  },
//                  "config": {
//                      "customParsers": "yaml-file-convert-to-single-line-string",
//                      "extraFiles": {
//                          "application-log.conf": "yaml-file-convert-to-single-line-string",
//                          "dataplane-log.conf": "yaml-file-convert-to-single-line-string",
//                          "host-log.conf": "yaml-file-convert-to-single-line-string",
//                      },
//                  },
//             }
//         },
//         "dcgmExporter": {
//             "enabled": false
//         },
//         "manager": {},
//         "neuronMonitor": {
//             "enabled": false
//         },
//         "tolerations": [ { "key": "", "operator": "Exists" } ]
//     }`, //aws_cloudwatch_observability_eks_addon configurationValues override
// }); //end AWS Cloudwatch Observability EKS Addon
// ^-- The above fluent bit config accepts yaml embedded in json
//     yaml multi-line-text-file can be converted to a single-line-string to embed in a json value.
//     cat test.yaml | jq --raw-input --slurp
//^-- This deploys 2 daemonsets of significance:
//1. cloudwatch-agent (in amazon-cloudwatch namespace):
//   * Generates a log group
//     *  /aws/containerinsights/$CLUSTER_NAME/performance
//     Don't bother querying this log group.
//     It's just a werid implementation detail, that stores metrics embeddeded in a log format.
//   * ^- This makes it so you can see metrics in AWS_Console -> CloudWatch -> Container Insights
//2. fluent-bit (in amazon-cloudwatch namespace):
//   * Docs: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Container-Insights-setup-logs-FluentBit.html
//   * Generates 2-3 log groups
//     1. /aws/containerinsights/CLUSTER_NAME/application  (container logs generated by pods)
//     2. /aws/containerinsights/Cluster_Name/dataplane    (containerd & kubelet logs)
//     3. /aws/containerinsights/Cluster_Name/host         (dmesg and a few others) (doesn't show up on bottlerocket)
//   * ^-- This makes it so you can go to AWS_Console -> CloudWatch -> Log Insights to query container, pod, contatainerd, and kubelet logs
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
