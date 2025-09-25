import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import { Easy_EKS_Dynamic_Config } from '../../lib/Easy_EKS_Dynamic_Config';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks'
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import {
  Apply_Podinfo_Helm_Chart,
  Apply_Podinfo_Http_Alb_YAML,
  Apply_Podinfo_Https_Alb_YAML,
  Podinfo_Helm_Config,
} from "../../lib/Podinfo_Manifests";

//Intended Use: 
//EasyEKS Admins: edit this file with config to apply to all dev / sandbox cluster's in your org.

export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack) { //config: is of type Easy_EKS_Config_Data
  config.add_tag("Environment", "Dev");
}//end apply_config()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_addons(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster) {

    /////////////////////////////////////////////////////////////////////////////////////////////////////
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
    const aws_cloudwatch_observability_eks_addon = new eks.CfnAddon(stack, 'aws-cloudwatch-observability-eks-addon', {
        clusterName: cluster.clusterName,
        addonName: 'amazon-cloudwatch-observability',
        addonVersion: Easy_EKS_Dynamic_Config.get_latest_version_of_amazon_cloudwatch_observability_eks_addon(), //OR 'v4.4.0-eksbuild.1'
        resolveConflicts: 'OVERWRITE',
        // podIdentityAssociations: [
        //     {
        //         serviceAccount: "cloudwatch-agent",
        //         roleArn: aws_cloudwatch_observability_eks_addon_iam_role.roleArn,
        //     }
        // ],
        // Note about configurationValues:
        // agent.config.logs.metrics_collected.kubernetes.
        configurationValues: `{
            "admissionWebhooks": {},
            "agent": {
                "config": {
                    "logs": {
                        "metrics_collected": {
                            "application_signals": {},
                            "kubernetes": {
                                "enhanced_container_insights": true,
                                "accelerated_compute_metrics": false
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
            "containerLogs": {
                "enabled": true,
                "fluentBit": {
                    "resources": {
                        "requests": {
                            "cpu": "50m",
                            "memory": "25Mi"
                        },
                        "limits": {
                            "cpu": "500m",
                            "memory": "250Mi"
                        }
                    },
                }
            },
            "dcgmExporter": {
                "enabled": false
            },
            "manager": {},
            "neuronMonitor": {
                "enabled": false
            },
            "tolerations": [ { "key": "", "operator": "Exists" } ]
        }`, //aws_cloudwatch_observability_eks_addon configurationValues override
    }); //end AWS Cloudwatch Observability EKS Addon
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
    //     3. /aws/containerinsights/Cluster_Name/host         (dmesg and a few others)
    //   * ^-- This makes it so you can go to AWS_Console -> CloudWatch -> Log Insights to query container, pod, contatainerd, and kubelet logs
    /////////////////////////////////////////////////////////////////////////////////////////////////////

    // v-- most won't need this, so commented out by default
    // const pvc_snapshot_controller = new eks.CfnAddon(stack, 'snapshot-controller', {
    //     clusterName: cluster.clusterName,
    //     addonName: 'snapshot-controller',
    //     addonVersion: 'v8.2.0-eksbuild.1', //v--query for latest
    //     // aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=snapshot-controller --query='addons[].addonVersions[].addonVersion' | jq '.[0]'
    //     resolveConflicts: 'OVERWRITE',
    //     configurationValues: '{}',
    // });

}//end deploy_addons()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_essentials(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.ICluster){
    const observability_ns_manifest = {
        "apiVersion": "v1",
        "kind": "Namespace",
        "metadata": {
          "name": "observability"
        }
    };
    const observability_ns = new eks.KubernetesManifest(stack, "observability",
        {
            cluster: cluster,
            manifest: [observability_ns_manifest],
            overwrite: true,
            prune: true,
        }
    );



    const kube_prometheus_stack_helm_release = new eks.HelmChart(stack, 'kps-helm', { //kps = kube prometheus stack (grafana & prometheus)
        cluster: cluster,
        namespace: "observability",
        repository: "https://prometheus-community.github.io/helm-charts",
        chart: "kube-prometheus-stack",
        release: 'kps',
        version: "77.6.2", //version of helm chart
        // helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        // helm repo update prometheus-community
        // helm search repo prometheus-community/kube-prometheus-stack
        values: { //https://github.com/prometheus-community/helm-charts/blob/kube-prometheus-stack-72.3.0/charts/kube-prometheus-stack/values.yaml
            "grafana": { //kubectl port-forward svc/kps-grafana -n=observability 8080:80
                "ingress": { //Chrome http://localhost:8080
                    "enabled": false, //disabled by default to minimize pre-requisites
                    "ingressClassName": "alb",
                    "annotations": {
                        "alb.ingress.kubernetes.io/ip-address-type": "dualstack",
                        "alb.ingress.kubernetes.io/target-type": "ip",
                        "alb.ingress.kubernetes.io/scheme": "internal",
                        "alb.ingress.kubernetes.io/group.name": "internal-alb",
                    },
                    "hosts": ["grafana.dev1.eks.domain.net"], //revisit this later
                }
            },
        },//end helm values
    });
    kube_prometheus_stack_helm_release.node.addDependency(observability_ns);
    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    const quickwit_Kube_SA = new eks.ServiceAccount(stack, 'quickwit_kube-sa', {
            cluster: cluster,
            name: 'qw-quickwit',
            namespace: 'observability',
            identityType: eks.IdentityType.POD_IDENTITY, //depends on eks-pod-identity-agent addon
            //Note: It's not documented, but this generates 4 things:
            //1. A kube SA in the namespace of the cluster
            //2. An IAM role paired to the Kube SA
            //3. An EKS Pod Identity Association
            //4. The eks-pod-identity-agent addon (if it doesn't already exist)
    });
    quickwit_Kube_SA.node.addDependency(observability_ns);
    // v-- temp for testing
    quickwit_Kube_SA.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'));
    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    const quickwit_s3_bucket = new s3.Bucket(stack, 'quickwit-logs-bucket', {
        encryption: s3.BucketEncryption.KMS_MANAGED,
        bucketKeyEnabled: true, //cost optimization to minimize AWS API calls
        removalPolicy: cdk.RemovalPolicy.DESTROY, //auto cleanup on cdk deploy
        autoDeleteObjects: true, //auto cleanup on cdk deploy
    });
    const vpc = config.vpc;
    const sg_of_cluster_nodes = ec2.SecurityGroup.fromLookupById(stack, "sg-of-cluster-nodes", config.sg_id_of_cluster_nodes);
    const sg_of_psql = new ec2.SecurityGroup(stack, 'psql-sg', {
        securityGroupName: 'dev1-eks-essentials-quickwitpsql',
        vpc: vpc,
        allowAllIpv6Outbound: true,
        allowAllOutbound: true,
        description: "SG of PSQL used by quickwit for eks cluster logging",
    });
    sg_of_psql.addIngressRule(sg_of_cluster_nodes, ec2.Port.allTcp(), `Allow Ingress from ${config.cluster_name}`);
    cdk.Tags.of(sg_of_psql).add('Name', `${config.cluster_name}/psql-for-cluster-hosted-quickwit-logging`);
    const quickwit_psql = new rds.DatabaseInstance(stack, 'quickwit-psql', {
        instanceIdentifier: 'dev1-eks-essentials-quickwit-psql', //warning don't change name (doing so causes recreation)
        engine: rds.DatabaseInstanceEngine.postgres({version: rds.PostgresEngineVersion.VER_17_5}),
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MICRO), //t4g.micro
        vpc,
        publiclyAccessible: false,
        allocatedStorage: 20, //20GB is min value, per https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Storage.html
        storageType: rds.StorageType.GP3,
        backupRetention: cdk.Duration.days(3),
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        databaseName: 'quickwit_metastore', //'-' not allowed
        credentials: {
            username: 'quickwit',
            password: cdk.SecretValue.unsafePlainText("placeholder-password-for-testing"),
        },
        securityGroups: [sg_of_psql],
    });
    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    const quickwit_helm_release = new eks.HelmChart(stack, 'qw-helm', {
        cluster: cluster,
        namespace: "observability",
        repository: "https://helm.quickwit.io",
        chart: "quickwit",
        release: 'qw',
        version: "0.7.18", //version of helm chart (helm version 0.7.18 maps to app version 0.8.2)
        // helm repo add quickwit https://helm.quickwit.io
        // helm repo update quickwit
        // helm search repo quickwit
        // helm show values quickwit/quickwit
        values: {
            "serviceAccount": {
                "create": false, //<--tell helm to let cdk create the kube service account
                "name": "qw-quickwit" //<-- helm expects cdk to create a kube sa with this name
            },
            "environment": {
                //"QW_METASTORE_URI": `postgres://username:password@host_name:5432/db_name`,
                "QW_METASTORE_URI": `postgres://quickwit:placeholder-password-for-testing@dev1-eks-essentials-quickwit-psql.ctecks8yu9bg.ca-central-1.rds.amazonaws.com:5432/quickwit_metastore`,
                "QW_LISTEN_ADDRESS": "::" //IPv6 equivalent of 0.0.0.0
            },             
            "config": { //<--added to configmap qw-quickwit
                "default_index_root_uri": `s3://${quickwit_s3_bucket.bucketName}/quickwit-indexes`,
                "storage": {
                    "s3": { //kube service account + pod IAM asssociation is used for authn/z
                        "region": `${quickwit_s3_bucket.stack.region}`,
                    },
                },    
            },
            "metastore": { //First to come up
                "replicaCount": "1",
                "resources": {
                    "requests": {
                        "cpu": "1",
                        "memory": "1Gi",
                    },
                    "limits": {
                        "cpu": "4",
                        "memory": "7Gi",
                    }
                },
            },
            "control_plane": {
                "enabled": true,
                "resources": {
                    "requests": {
                        "cpu": "1",
                        "memory": "1Gi",
                    },
                    "limits": {
                        "cpu": "4",
                        "memory": "7Gi",
                    }
                },
            },
            "indexer": {
                "replicaCount": "1",
                "resources": {
                    "requests": {
                        "cpu": "1",
                        "memory": "1Gi",
                    },
                    "limits": {
                        "cpu": "4",
                        "memory": "7Gi",
                    }
                },
            },
            "searcher": {
                "replicaCount": "1",
                "resources": {
                    "requests": {
                        "cpu": "1",
                        "memory": "1Gi",
                    },
                    "limits": {
                        "cpu": "4",
                        "memory": "7Gi",
                    }
                },
            },
            "janitor": {
                "enabled": true,
                "resources": {
                    "requests": {
                        "cpu": "1",
                        "memory": "1Gi",
                    },
                    "limits": {
                        "cpu": "4",
                        "memory": "7Gi",
                    }
                },
            },
        },//end helm values
    });
    // Imperative installation order to avoid temporary errors in logs
    quickwit_helm_release.node.addDependency(observability_ns);
    quickwit_helm_release.node.addDependency(quickwit_Kube_SA);
    quickwit_helm_release.node.addDependency(quickwit_s3_bucket);
    quickwit_helm_release.node.addDependency(quickwit_psql);

}//end deploy_essentials()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_workloads(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.ICluster) {

    // This is an example of a workload that uses a PersistentVolumeClaim with a storage class that is encrypted
    // with AWS KMS key.
    // IMPORTANT: if the cdk insfrastructure is destroyed it will leave the volume orphans, and they will
    // need to be manually deleted.
    let name="test-claim-gp3";
    let size="10Gi";
    const volume_claim_gp3 = {
        "apiVersion": "v1",
        "kind": "PersistentVolumeClaim",
        "metadata": {
            "name": `${name}`,
            "namespace": "default"
        },
        "spec": {
            "accessModes": [
                "ReadWriteOnce"
            ],
            "storageClassName": "kms-encrypted-gp3",
            "resources": {
                "requests": {
                    "storage": `${size}`
                }
            }
        }
    }
    const pod_using_volume_claim = {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {
            "name": "app"
        },
        "spec": {
            "containers": [
                {
                    "name": "app",
                    "image": "ubuntu:latest",
                    "command": [
                        "/bin/sh"
                    ],
                    "args": [
                        "-c",
                        "while true; do echo $(date -u) >> /data/out.txt; sleep 5; done"
                    ],
                    "volumeMounts": [
                        {
                            "name": "persistent-storage",
                            "mountPath": "/data"
                        }
                    ]
                }
            ],
            "volumes": [
                {
                    "name": "persistent-storage",
                    "persistentVolumeClaim": {
                        "claimName": `${name}`
                    }
                }
            ]
        }
    }
    const pvc_demo_construct = new eks.KubernetesManifest(stack, "persistentVolumeClaimManifest",
    {
        cluster: cluster,
        manifest: [volume_claim_gp3, pod_using_volume_claim],
        overwrite: true,
        prune: true,
    });






  // Define a BLUE podinfo application with insecure ALB (HTTP)
  const BLUE_PODINFO_HELM_CONFIG = {
    helm_chart_release: "podinfo-blue",
    helm_chart_values: {
      ui: {
        color: "#0000FF",
        message: "This is an insecure application with BLUE background",
      },
    } as Record<string, any>,
  } as Podinfo_Helm_Config

  // Deploy a podinfo sample application with BLUE background
  // Apply_Podinfo_Helm_Chart(cluster, config, stack, BLUE_PODINFO_HELM_CONFIG);

  // Provisioning HTTP ALB, which includes HTTP ALB, Listener, Target Group, etc.
  // Apply_Podinfo_Http_Alb_YAML(cluster, config, stack, BLUE_PODINFO_HELM_CONFIG)

  // Define a GREEN podinfo application with secure ALB (HTTPS)
  const GREEN_PODINFO_HELM_CONFIG = {
    helm_chart_release: "podinfo-green",
    helm_chart_values: {
      ui: {
        color: "#008000",
        message: "This is an secure application with GREEN background",
      },
    } as Record<string, any>,
  } as Podinfo_Helm_Config

  // Deploy a podinfo sample application with GREEN background
  // Apply_Podinfo_Helm_Chart(cluster, config, stack, GREEN_PODINFO_HELM_CONFIG);

  // Generate HTTPS ingress manifest
  /**
   * TODO: due to DNS ACME challenge, we just use the existing ACME's ARN and subdomain
   * To make this happen, you need to do:
   * 1. Prepare a domain or sub-domain
   * 2. Create a certificate in ACM for the domain / sub-domain
   * 3. Create CNAME to verify the certificate successfully
   * 4. Get the ARN of the certificate
   * 5. Deploy the stack
   * 6. After ALB is provisioned, create a CNAME record of the domain/sub-domain with the value in the DNS hostname of the ALB
   */
  // const https_ingress_yaml = Podinfo_Https_Ingress_Yaml_Generator(
  //   GREEN_PODINFO_HELM_CONFIG,
  //   // ACME ARN
  //   "arn:aws:acm:ap-southeast-2:092464092456:certificate/a2e016d5-58fb-4308-b894-f7a21f7df0b8",
  //   // Sub-domain
  //   "kefeng-easyeks.gcp.au-pod-1.cs.doit-playgrounds.dev",
  // )

  // kubectl apply manifest
//   Apply_Podinfo_Https_Alb_YAML(cluster, config, stack,
//     GREEN_PODINFO_HELM_CONFIG,
//     "arn:aws:acm:ap-southeast-2:092464092456:certificate/a2e016d5-58fb-4308-b894-f7a21f7df0b8")
}//end deploy_workloads()
