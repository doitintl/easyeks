import { Easy_EKS_Config_Data } from '../lib/Easy_EKS_Config_Data';
import { KubernetesVersion } from 'aws-cdk-lib/aws-eks';
import * as blueprints from '@aws-quickstart/eks-blueprints'
import * as kms from 'aws-cdk-lib/aws-kms';
//Intended Use: 
//A baseline config file (to be applied to all EasyEKS Clusters in your organization)
//EasyEKS Admins would be expected to edit this file with defaults specific to their org.

export function apply_config(config: Easy_EKS_Config_Data){ //config: is of type Easy_EKS_Config_Data
  config.addTag("Maintained By", "Cloud Platform Team");
  config.addTag("Contact Methods for Questions", "devops slack channel or email devops@my.org");
  //^-- NOTE: hashtag(#)  comma(,)   singlequote(')  and more are not valid tag values
  //    https://docs.aws.amazon.com/directoryservice/latest/devguide/API_Tag.html
  config.setKubernetesVersion(KubernetesVersion.V1_30); //<--This library might not support latest
  config.addAddOn(
        new blueprints.addons.EbsCsiDriverAddOn({
          version: "auto",
          kmsKeys: [
            blueprints.getResource( context => new kms.Key(context.scope, "ebs-csi-driver-key", { alias: "ebs-csi-driver-key"})),
          ],
          storageClass: "gp3"
        })
  );

//   new blueprints.addons.EbsCsiDriverAddOn({
//     version: "auto",
//     kmsKeys: [
//       blueprints.getResource(
//         (context) =>
//           new kms.Key(context.scope, "ebs-csi-driver-key", {
//             alias: "ebs-csi-driver-key",
//           })
//       ),
//     ],
//     storageClass: "gp3",
//   }),
//   new blueprints.addons.AwsLoadBalancerControllerAddOn(),
//   new blueprints.addons.KarpenterAddOn({
//     version: "v0.37.0",
//     // nodePoolSpec: nodePoolSpec,
//     // ec2NodeClassSpec: nodeClassSpec,
//     interruptionHandling: true,
//   }),

}
