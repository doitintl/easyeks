import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import { KubernetesVersion } from 'aws-cdk-lib/aws-eks';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as kms from 'aws-cdk-lib/aws-kms';
//import { NodeLocalDNSCacheAddOn } from '../../lib/Node_Local_DNS_Cache_AddOn';
//Intended Use:
//A baseline config file (to be applied to all EasyEKS Clusters in your organization)
//EasyEKS Admins would be expected to edit this file with defaults specific to their org.

export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack){ //config: is of type Easy_EKS_Config_Data
    config.addTag("Internally Maintained By", "person1@our.org and person2@our.org of Cloud Platform Team Updated 2024/12/15");
    config.addTag("Internal Contact Methods for Questions", "devops slack channel or email devops@our.org");
    config.addTag("IaC Tooling used for Provisioning and Management of EKS Workloads", "To be Determined maybe github actions flux or argo");
    //^-- NOTE: hashtag(#)   comma(,)   singlequote(')   doublequote(\")   parenthesis()   and more are not valid tag values
    //    https://docs.aws.amazon.com/codeguru/latest/bugbust-ug/limits-tags.html
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    config.addClusterViewerAccount(process.env.CDK_DEFAULT_ACCOUNT!); //<-- comment out to disable RO_viewer_by_default
    /* Explanation of what this-^ does:
    It adds current account to eks cluster's aws-auth configmap
    kubectl get cm -n=kube-system aws-auth -o yaml | grep Accounts:
      mapAccounts: '["111122223333"]'
    This by itself does nothing, but it plus additional logic mimics a GKE viewer role like UX experience.
    FAQ:
    * Automatic viewer access sounds like Magic. Magic scares me, explain?
      * Easy EKS uses 3 key bits of logic to pull it off:
        1. A ClusterRole named easyeks-enhanced-viewer
           * Defines the view only kube rbac rights
        2. A ClusterRoleBinding named easyeks-all-authenticated-users-viewer
           * maps the view role to the system:authenticated Group
        3. Account Mapped in aws-auth configmap
           * Makes members of the mapped aws account considered "authenticated" + all other explicit entries.
      * Note GKE had a vulnerability (that doesn't seem to show in their CVE bulletin list?) related to
        not properly scoping system:authenticated, such that the meaning of the word "authenticated" was too broad.
        and that allowed cross account access to GKE clusters.
      * EKS doesn't have the issue of overly broad interpretation of "authenticated"
        * EKS's API (in the EKS Web GUI) only lets you specify 1 role / 1 user at a time.
        * mapAccounts is the closest thing to a wildcard that exists, and it's scoped to explicit aws accounts.
        * and it only grants viewer.
      * in EasyEKS's opinionated approach this is an acceptable trade off / no big deal security wise, and
        significantly improves UX. But you can disable the viewer access by default by commenting the above.
    * What does viewer access allow? 
      * kubectl cli read only (cluster wide kube rbac rights to get, list, watch, against most, but not all objects)
      * EKS Web GUI read everything except kubernetes secrets
    * What viewer access can't do: (purposeful so as to prevent privilege escalation)
      * Can't view kubernetes secrets
      * Can't create pods
      * Can't kubectl exec -it into existing pods
    */ 
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
    config.addEKSAddon('metrics-server', { //allows `kubectl top nodes` to work
        addonName: 'metrics-server',
        addonVersion: 'v0.7.2-eksbuild.2', //v--query for latest
        // aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=metrics-server --query='addons[].addonVersions[].addonVersion' | jq '.[0]'
        resolveConflicts: 'OVERWRITE',
        // Commenting out broken config
        // configurationValues: `{
        //     "replicas": 2,
        //     "affinity": {
        //       "nodeAffinity": {
        //         "requiredDuringSchedulingIgnoredDuringExecution": {
        //           "nodeSelectorTerms": [
        //             {
        //               "matchExpressions": [
        //                 {
        //                   "key": "kubernetes.io/os",
        //                   "operator": "In",
        //                   "values": [
        //                     "linux"
        //                   ]
        //                 },
        //                 {
        //                   "key": "kubernetes.io/arch",
        //                   "operator": "In",
        //                   "values": [
        //                     "amd64",
        //                     "arm64"
        //                   ]
        //                 }
        //               ]
        //             }
        //           ]
        //         }
        //       },
        //       "podAntiAffinity": {
        //         "requiredDuringSchedulingIgnoredDuringExecution": [
        //           {
        //             "labelSelector": {
        //               "matchExpressions": [
        //                 {
        //                   "key": "app.kubernetes.io/name",
        //                   "operator": "In",
        //                   "values": [
        //                     "metrics-server"
        //                   ]
        //                 }
        //               ]
        //             },
        //             "topologyKey": "kubernetes.io/hostname"
        //           }
        //         ]
        //       }
        //     }
        // }`, //end metrics-server configurationValues override
    });//end metrics-server addon
    // config.addEKSAddon('aws-ebs-csi-driver', {
    //     addonName: 'aws-ebs-csi-driver', 
    //     // addonVersion: 'v1.41.0-eksbuild.1' //v--query for latest
    //     // aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=aws-ebs-csi-driver --query='addons[].addonVersions[].addonVersion' | jq '.[0]'
    // });
    config.addEKSAddon('snapshot-controller', {
        addonName: 'snapshot-controller',
        addonVersion: 'v8.2.0-eksbuild.1' //v--query for latest
        // aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=snapshot-controller --query='addons[].addonVersions[].addonVersion' | jq '.[0]'
    });
    config.addEKSAddon('eks-node-monitoring-agent', {
        addonName: 'eks-node-monitoring-agent',
        addonVersion: 'v1.2.0-eksbuild.1', //v--query for latest
        // aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=eks-node-monitoring-agent --query='addons[].addonVersions[].addonVersion' | jq '.[0]'
    });

    // config.addAddOn( new NodeLocalDNSCacheAddOn( {} ) ); //Note: NL_DNS has issues with bottlerocket AMI, which is why EasyEKS defaults to AmazonLinux2.
}//end apply_config()


export function deploy_workloads(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster){

}//end deploy_workloads()
