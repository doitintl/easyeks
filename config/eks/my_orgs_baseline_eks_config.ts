import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import { KubernetesVersion } from 'aws-cdk-lib/aws-eks';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as blueprints from '@aws-quickstart/eks-blueprints'
import * as kms from 'aws-cdk-lib/aws-kms';
//Intended Use:
//A baseline config file (to be applied to all EasyEKS Clusters in your organization)
//EasyEKS Admins would be expected to edit this file with defaults specific to their org.

export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack){ //config: is of type Easy_EKS_Config_Data
    config.addTag("Maintained By", "Cloud Platform Team");
    config.addTag("Contact Methods for Questions", "devops slack channel or email devops@my.org");
    //^-- NOTE: hashtag(#)   comma(,)   singlequote(')   doublequote(\")   parenthesis()   and more are not valid tag values
    //    https://docs.aws.amazon.com/codeguru/latest/bugbust-ug/limits-tags.html
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    config.setIpMode(eks.IpFamily.IP_V6); //<--EasyEKS Recommended Default for DualStack VPCs
    /* Note:
    You can deploy eks.IpFamily.IP_V4 into a dualStack VPC or classic IPv4 VPC
    Summary of IP_V6 Mode: 
    * worker nodes get IPv4 IPs, pods get IPv6 IPs. 
    * It's EasyEKS's Default because it aligns with design goals:
      * Reliability/Maintainability Improvement: It eliminates the possibility of running out of IP Addresses.
      * Cost Savings: Due to the above is safe to run multiple EasyEKS Clusters in 1 VPC (which saves on NAT GW Costs)    */
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    config.setKubernetesVersion(KubernetesVersion.V1_30); //<--This library might not support latest
    // config.addAddOn( new blueprints.addons.MetricsServerAddOn() ); //allows kubectl top to work
    // config.addAddOn(
    //       new blueprints.addons.EbsCsiDriverAddOn({
    //         version: "auto",
    //         kmsKeys: [
    //           blueprints.getResource( context => new kms.Key(context.scope, "ebs-csi-driver-key", { alias: "ebs-csi-driver-key"})),
    //         ],
    //         storageClass: "gp3"
    //       })
    // ); 
    // config.addAddOn( //https://github.com/aws-quickstart/cdk-eks-blueprints/blob/blueprints-1.15.1/lib/addons/karpenter/index.ts
    //       new blueprints.addons.KarpenterAddOn({
    //         version: "0.37.0", //replace with 1.0.0 in future
    //         ec2NodeClassSpec: {
    //           amiFamily: "Bottlerocket",
    //           subnetSelectorTerms: [{ tags: { "Name": `${config.stackId}/${config.stackId}-vpc/PrivateSubnet*` } }],
    //           securityGroupSelectorTerms: [{ tags: { "aws:eks:cluster-name": `${config.stackId}` } }],
    //           detailedMonitoring: false,
    //           tags: config.tags,
    //         },
    //         nodePoolSpec: {
    //           requirements: [
    //               { key: 'topology.kubernetes.io/zone', operator: 'In', values: [`${config.region}a`, `${config.region}b`, `${config.region}c`] },
    //               { key: 'kubernetes.io/arch', operator: 'In', values: ['amd64','arm64']},
    //               { key: 'karpenter.sh/capacity-type', operator: 'In', values: ['on-demand']},
    //           ],
    //           disruption: {
    //               consolidationPolicy: "WhenEmpty", //WhenUnderutilized is more agressive cost savings
    //               consolidateAfter: "30s",
    //               expireAfter: "20m",
    //               budgets: [{nodes: "10%"}] 
    //           }
    //         },
    //         interruptionHandling: true,
    //         podIdentity: true,
    //         values: { //https://github.com/aws/karpenter-provider-aws/tree/main/charts/karpenter#values
    //           replicas: 1,
    //         }
    //       })
    // );

}//end apply_config()
