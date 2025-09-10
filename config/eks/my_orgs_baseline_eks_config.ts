import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import { Easy_EKS_Dynamic_Config } from '../../lib/Easy_EKS_Dynamic_Config';
import { KubernetesVersion } from 'aws-cdk-lib/aws-eks';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import request from 'sync-request-curl'; //npm install sync-request-curl (cdk requires sync functions, async not allowed)
//Intended Use:
//A baseline config file (to be applied to all EasyEKS Clusters in your organization)
//EasyEKS Admins would be expected to edit this file with defaults specific to their org. (that rarely change and are low risk to add)

export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack){ //config: is of type Easy_EKS_Config_Data
    config.addTag("Internally Maintained By", "person1@our.org and person2@our.org of Cloud Platform Team Updated 2024/12/15");
    config.addTag("Internal Contact Methods for Questions", "devops slack channel or email devops@our.org");
    config.addTag("IaC Tooling used for Provisioning and Management of EKS Workloads", "To be Determined maybe github actions flux or argo");
    //^-- NOTE: hashtag(#)   comma(,)   singlequote(')   doublequote(\")   parenthesis()   and more are not valid tag values
    //    https://docs.aws.amazon.com/codeguru/latest/bugbust-ug/limits-tags.html
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    config.addClusterViewerAccount(process.env.CDK_DEFAULT_ACCOUNT!); //<-- comment out to disable read_only_viewer_by_default
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

}//end apply_config()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_addons(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster){

    const vpc_cni = new eks.CfnAddon(stack, 'vpc-cni', {
        clusterName: cluster.clusterName,
        addonName: 'vpc-cni',
        addonVersion: Easy_EKS_Dynamic_Config.get_latest_version_of_vpc_cni_eks_addon(), //OR 'v1.20.1-eksbuild.3'
        //serviceAccountRoleArn: <-- leave this blank, to use worker node's IAM role, which gives dualstack ipv4/ipv6 support
        resolveConflicts: 'OVERWRITE',
        configurationValues: '{}',
    });//end vpc-cni addon

    const coredns = new eks.CfnAddon(stack, 'coredns', {
        clusterName: cluster.clusterName,
        addonName: 'coredns',
        addonVersion: Easy_EKS_Dynamic_Config.get_latest_version_of_coredns_eks_addon(), //OR 'v1.12.3-eksbuild.1'
        resolveConflicts: 'OVERWRITE',
        //v-- Below represents an optimized CoreDNS deployment, based on
        //    https://aws.amazon.com/blogs/containers/amazon-eks-add-ons-advanced-configuration/
        //    aws eks describe-addon-configuration --addon-name coredns --addon-version v1.11.4-eksbuild.2 --query configurationSchema --output text | jq .
        configurationValues: `{
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
        }`, //end CoreDNS configurationValues override
    });//end CoreDNS AddOn

    const metrics_server = new eks.CfnAddon(stack, 'metrics-server', { //allows `kubectl top nodes` to work & valid for all versions of kubernetes
        clusterName: cluster.clusterName,
        addonName: 'metrics-server',
        addonVersion: Easy_EKS_Dynamic_Config.get_latest_version_of_metrics_server_eks_addon(), //OR 'v0.8.0-eksbuild.2'
        resolveConflicts: 'OVERWRITE',
        configurationValues: `{
            "replicas": 2,
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
                          "key": "app.kubernetes.io/name",
                          "operator": "In",
                          "values": [
                            "metrics-server"
                          ]
                        }
                      ]
                    },
                    "topologyKey": "kubernetes.io/hostname"
                  }
                ]
              }
            }
        }`, //end metrics-server configurationValues override
    });//end metrics-server addon

    const eks_node_monitoring_agent = new eks.CfnAddon(stack, 'eks-node-monitoring-agent', {
        clusterName: cluster.clusterName,
        addonName: 'eks-node-monitoring-agent',
        addonVersion: Easy_EKS_Dynamic_Config.get_latest_version_of_eks_node_monitoring_agent_eks_addon(), //or 'v1.4.0-eksbuild.2'
        resolveConflicts: 'OVERWRITE',
        configurationValues: '{}',
    });

    ///////////////////////////////////////////////////////////////////
    // Install Pod Identity Agent Addon (using cdk bug avoidance logic)
    // This might look odd, it's a workaround for this bug https://github.com/aws/aws-cdk/issues/32580
    const ALBC_Kube_SA = new eks.ServiceAccount(stack, 'pod-identity-agent-addon', {
        cluster: cluster,
        name: 'cdk-workaround',
        namespace: 'kube-system',
        identityType: eks.IdentityType.POD_IDENTITY, //depends on eks-pod-identity-agent addon
        //Note: It's not documented, but this generates 4 things:
        //1. A kube SA in the namespace of the cluster
        //2. An IAM role paired to the Kube SA
        //3. An EKS Pod Identity Association
        //4. The eks-pod-identity-agent addon
        //   ^<-- workaround is leveraging this 4th entry to indirectly install pod identity agent addon,
        //        this install method avoids cdk bug.
    });
    ///////////////////////////////////////////////////////////////////

    /////////////////////////////////////////////////////////////////////////////////////////////////////
    // Install EBS CSI Driver Addon (using cdk bug avoidance logic)
    // If you try to use eks.ServiceAccount with eksAddons you'll hit a cdk integration bug, this works around it.
    // (The gist of the bug is it'd fail, because the name would already exist because 2 things would try to create it.)
    const ebs_csi_addon_iam_role = new iam.Role(stack, 'aws-ebs-csi-driver-iam-role', {
        managedPolicies: [ iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEBSCSIDriverPolicy') ],
        assumedBy: (new cdk.aws_iam.ServicePrincipal("pods.eks.amazonaws.com")),
    });
    ebs_csi_addon_iam_role.assumeRolePolicy!.addStatements( //<-- ! is TypeScript for "I know this variable isn't null"
        new iam.PolicyStatement({
            actions: ['sts:AssumeRole', 'sts:TagSession'],
            principals: [new iam.ServicePrincipal('pods.eks.amazonaws.com')],
        })
    );
    const ebs_csi_addon = new eks.CfnAddon(stack, 'aws-ebs-csi-driver', {
        clusterName: cluster.clusterName,
        addonName: 'aws-ebs-csi-driver',
        addonVersion: Easy_EKS_Dynamic_Config.get_latest_version_of_ebs_csi_eks_addon(), //OR 'v1.48.0-eksbuild.2'
        resolveConflicts: 'OVERWRITE',
        podIdentityAssociations: [
            {
                serviceAccount: "ebs-csi-controller-sa",
                roleArn: ebs_csi_addon_iam_role.roleArn,
            }
        ], // (v-- replicaCount: 1, makes logs easier to read/debug, and doesn't hurt stability.)
        configurationValues: `{
            controller: {
                "replicaCount": 1,
            },
        }`, //end aws-ebs-csi-driver configurationValues override
    }); //end EBS CSI Driver Addon
    /////////////////////////////////////////////////////////////////////////////////////////////////////

}//end deploy_addons()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_essentials(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.ICluster){

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Install Node Local DNS Cache
    const nodeLocalDNSCache = cluster.addHelmChart('NodeLocalDNSCache', {
        chart: "node-local-dns", // Name of the Chart to be deployed
        release: "node-local-dns-cache", // Name for our chart in Kubernetes (helm list -A)
        repository: "oci://ghcr.io/deliveryhero/helm-charts/node-local-dns",  // HTTPS address of the helm chart (associated with helm repo add command)
        namespace: "kube-system",
        version: Easy_EKS_Dynamic_Config.get_latest_version_of_node_local_dns_cache_helm_chart(), //OR "2.1.10"
        wait: false,
        values: { //<-- helm chart values per https://github.com/deliveryhero/helm-charts/blob/master/stable/node-local-dns/values.yaml
          config: {
            bindIp: true, //BottleRocket specific fix
          },
        },
    });
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Install default gp3 storage class
    // File in /research/ was converted using https://onlineyamltools.com/convert-yaml-to-json
    const storage_class_gp3_manifest = {
        "apiVersion": "storage.k8s.io/v1",
        "kind": "StorageClass",
        "metadata": {
            "name": "kms-encrypted-gp3",
            "annotations": {
                "storageclass.kubernetes.io/is-default-class": "true"
            }
        },
        "provisioner": "ebs.csi.aws.com",
        "volumeBindingMode": "WaitForFirstConsumer",
        "allowVolumeExpansion": true,
        "reclaimPolicy": "Delete",
        "parameters": {
            "type": "gp3",
            "encrypted": "true",
            //"kmsKeyId": `${config.kmsKey.keyArn}` //not yet stable, needs more testing of the logic to add permissions to KMS key
        }
    }
    const storage_class_gp3_construct = new eks.KubernetesManifest(stack, "StorageClassManifest",
        {
            cluster: cluster,
            manifest: [storage_class_gp3_manifest],
            overwrite: true,
            prune: true,   
        }
    );
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}//end deploy_essentials()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_workloads(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.ICluster){

}//end deploy_workloads()