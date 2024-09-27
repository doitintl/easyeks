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
    config.setIpMode(eks.IpFamily.IP_V6); 
    //^--EasyEKS Recommended Default: is IP_V6
    /* Useful Notes:
    * eks.IpFamily.IP_V4
      * can be deployed into a IPv4/v6 DualStack VPC or classic IPv4 VPC
    * eks.IpFamily.IP_V6:
      * Worker nodes get IPv4 IPs
      * Pods get IPv6 IPs
      * It's EasyEKS's Default because it aligns with design goals:
        * Reliability/Maintainability Improvement: It eliminates the possibility of running out of IP Addresses.
        * Cost Savings: Due to the above, it's safe to run multiple EasyEKS Clusters in 1 VPC (which saves on NAT GW Costs)*/
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    config.setKubernetesVersion(KubernetesVersion.V1_30); //<--Note: EKS Blueprints can be slow to support latest
    config.addAddOn( new blueprints.addons.MetricsServerAddOn() ); //allows `kubectl top nodes` to work
    config.addAddOn(
      new blueprints.addons.EbsCsiDriverAddOn({
          version: "auto", //latest version is always best, and works for all versions of kubernetes
          kmsKeys: [ blueprints.getNamedResource(blueprints.GlobalResources.KmsKey) ], //TO DO: Needs bug fix using default kms, and not user alias
          storageClass: "gp3"
      })
  );

}//end apply_config()
