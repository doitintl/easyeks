import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import * as cdk from 'aws-cdk-lib';
import * as blueprints from '@aws-quickstart/eks-blueprints'
import * as iam from 'aws-cdk-lib/aws-iam';
import { NodeLocalDNSCacheAddOn } from '../../lib/Node_Local_DNS_Cache_AddOn';
//Intended Use: 
//A baseline config file (to be applied to all EasyEKS Clusters)
//That 95% of global users will feel comfortable using with 0 changes, but can change.

export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack){ //config: is of type Easy_EKS_Config_Data
    config.addTag("IaC Tooling used for Provisioning and Management", "cdk: a CLI tool that stands for AWS Cloud Development Kit.");
    config.addTag("Upstream Methodology Docs", "https://github.com/doitintl/eks-cdk-quickstart");
    //^-- NOTE: hashtag(#)   comma(,)   singlequote(')   doublequote(\")   parenthesis()   and more are not valid tag values
    //    https://docs.aws.amazon.com/codeguru/latest/bugbust-ug/limits-tags.html
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    //v--If you follow suggested order of application (global -> org -> env), then the set's functionally act as overrideable defaults.
    config.addAddOn( new blueprints.addons.KubeProxyAddOn() );
    config.addAddOn( new blueprints.addons.VpcCniAddOn({
        version: "v1.18.3-eksbuild.3", //latest is valid for all kubernetes
        //serviceAccountPolicies: [ iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEKS_CNI_Policy"),]
        //^-- Don't use this, it only supports attaching AWS Managed IAM Policies, which only support ipv4 clusters
        //    Using Node Roles allows the flexibility to support dualstack VPCs. 
    }));
    config.addAddOn( new blueprints.addons.EksPodIdentityAgentAddOn() );
    config.addAddOn( new blueprints.addons.AwsLoadBalancerControllerAddOn( {
        values: { //https://github.com/aws/eks-charts/blob/master/stable/aws-load-balancer-controller/values.yaml
            replicaCount: 1 //makes logs easier to read `kubectl logs deploy/aws-load-balancer-controller -n=kube-system`
        }
    }));

    //v-- Below represents an optimized CoreDNS deployment, based on
    //    https://aws.amazon.com/blogs/containers/amazon-eks-add-ons-advanced-configuration/
    //    aws eks describe-addon-configuration --addon-name coredns --addon-version v1.11.1-eksbuild.11 --query configurationSchema --output text | jq .
    config.addAddOn( new blueprints.addons.CoreDnsAddOn( "v1.11.3-eksbuild.1", { //<-- As of Sept 2024, "auto" (version) maps to older v1.11.1-eksbuild.8 that doesn't support autoscaling
      configurationValues: {
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
      }//end CoreDNS configurationValues override
    }));//end CoreDNS AddOn
    config.addAddOn( new NodeLocalDNSCacheAddOn( {} ) );
}//end function
