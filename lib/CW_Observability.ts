import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks'
import * as iam from 'aws-cdk-lib/aws-iam';
import { Easy_EKS_Config_Data } from "./Easy_EKS_Config_Data";
import { Easy_EKS_Dynamic_Config } from './Easy_EKS_Dynamic_Config';
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface EKS_Metrics_via_CloudWatch_Input_Parameters {
    addonVersion: string;
    enhanced_container_insights: boolean;
    accelerated_compute_metrics: boolean;
    metrics_collection_interval_seconds: number; //10, 60, 300 are reasonable values
}

export function enable_metrics_observability_via_cloudwatch(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster, input: EKS_Metrics_via_CloudWatch_Input_Parameters){
    //This deploys 1 daemonset named cloudwatch-agent (in amazon-cloudwatch namespace):
    //   * Generates a log group
    //     * /aws/containerinsights/$CLUSTER_NAME/performance
    //     Don't bother querying this log group for logs
    //     It's just a werid implementation detail, that stores metrics in a log format.
    //   * v- This makes it so you can see metrics in AWS_Console -> CloudWatch -> Container Insights
    const aws_cloudwatch_observability_eks_addon_iam_role = new iam.Role(stack, 'metrics-via-aws-cw-observability-eks-addon-iam-role', {
        managedPolicies: [ iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy') ],
        assumedBy: (new cdk.aws_iam.ServicePrincipal("pods.eks.amazonaws.com")),
    });
    aws_cloudwatch_observability_eks_addon_iam_role.assumeRolePolicy!.addStatements( //<-- ! is TypeScript for "I know this variable isn't null"
        new iam.PolicyStatement({
            actions: ['sts:AssumeRole', 'sts:TagSession'],
            principals: [new iam.ServicePrincipal('pods.eks.amazonaws.com')],
        })
    );
    const aws_cloudwatch_observability_eks_addon = new eks.CfnAddon(stack, 'metrics-via-aws-cloudwatch-observability-eks-addon', {
        clusterName: cluster.clusterName,
        addonName: 'amazon-cloudwatch-observability',
        addonVersion: input.addonVersion,
        resolveConflicts: 'OVERWRITE',
        //Example of advanced config: https://github.com/aws-observability/helm-charts/issues/173
        configurationValues: `{
            "agent": {
                "config": {
                    "logs": {
                        "metrics_collected": {
                            "application_signals": {},
                            "kubernetes": {
                                "cluster_name": "${cluster.clusterName}",
                                "metrics_collection_interval": ${input.metrics_collection_interval_seconds},
                                "enhanced_container_insights": ${input.enhanced_container_insights},
                                "accelerated_compute_metrics": ${input.accelerated_compute_metrics},
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
    }); //end AWS Cloudwatch Observability EKS Addon
    
return aws_cloudwatch_observability_eks_addon;
}//end deploy_metrics_via_cloudwatch()
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface EKS_Logs_via_CloudWatch_Input_Parameters {
    //TBD
}

export function deploy_logs_via_cloudwatch(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster){

}
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
