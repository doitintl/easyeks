import { Easy_EKS_Config_Data } from '../lib/Easy_EKS_Config_Data';
import * as blueprints from '@aws-quickstart/eks-blueprints'
import * as iam from 'aws-cdk-lib/aws-iam';
import { NodeLocalDNSCacheAddOn } from '../lib/Node_Local_DNS_Cache_AddOn';
//Intended Use: 
//A baseline config file (to be applied to all EasyEKS Clusters)
//That 95% of global users will feel comfortable using with 0 changes, but can change.

export function apply_config(config: Easy_EKS_Config_Data){ //config: is of type Easy_EKS_Config_Data
  config.addTag("IaC Tooling used for Provisioning and Management", "aws cdk");
  config.addTag("Upstream Methodology Docs", "https://github.com/doitintl/eks-cdk-quickstart");
  config.setAccount( process.env.CDK_DEFAULT_ACCOUNT! ); //<-- pulls value from CLI env,
  config.setRegion( process.env.CDK_DEFAULT_REGION! ); //<-- ! after var, tells TS it won't be null.
  //^--If you follow suggested order of application, org and environment config applies can override this default.
  config.addAddOn( new blueprints.addons.KubeProxyAddOn() );
  config.addAddOn( new blueprints.addons.VpcCniAddOn({
    serviceAccountPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEKS_CNI_Policy")]
  }));
  config.addAddOn( new blueprints.addons.EksPodIdentityAgentAddOn() );
  config.addAddOn( new blueprints.addons.AwsLoadBalancerControllerAddOn( {
    values: { //https://github.com/aws/eks-charts/blob/master/stable/aws-load-balancer-controller/values.yaml
      replicaCount: 1 //makes logs easier to read `kubectl logs deploy/aws-load-balancer-controller -n=kube-system`
    }
  } ) );
  //v-- Below represents an optimized CoreDNS deployment, based on
  //    https://aws.amazon.com/blogs/containers/amazon-eks-add-ons-advanced-configuration/
  //    aws eks describe-addon-configuration --addon-name coredns --addon-version v1.11.1-eksbuild.11 --query configurationSchema --output text | jq .
  config.addAddOn( new blueprints.addons.CoreDnsAddOn( "v1.11.1-eksbuild.11", { //<-- As of Aug 2024, "auto" (version) maps to older v1.11.1-eksbuild.8 that doesn't support autoscaling
    configurationValues: {
            "autoScaling": {
              "enabled": true,
              "minReplicas": 2,
              "maxReplicas": 100
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
