import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import { KubernetesVersion } from 'aws-cdk-lib/aws-eks';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
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
    config.addAddOn( new blueprints.addons.MetricsServerAddOn() ); //allows kubectl top to work
    // config.addAddOn(
    //       new blueprints.addons.EbsCsiDriverAddOn({
    //         version: "auto",
    //         kmsKeys: [
    //           blueprints.getResource( context => new kms.Key(context.scope, "ebs-csi-driver-key", { alias: "ebs-csi-driver-key"})),
    //         ],
    //         storageClass: "gp3"
    //       })
    // );

}//end apply_config()
