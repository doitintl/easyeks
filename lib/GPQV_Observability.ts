import { Easy_EKS_Config_Data } from "./Easy_EKS_Config_Data";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import { Construct } from "constructs";
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*Frugal GPQ: Grafana Prometheus Quickwit Stack
* Grafana (Dashboard GUI for Prometheues Metrics & can also function as a GUI for quickwit logs)
* Prometheus (Metric Database, that also collects its own metrics)
* Quickwit (Logs GUI that works independently of grafana + centralized logging using s3 as storage backend)
* Vector.dev (easy eks is only using vector-agent daemonset to ship logs into quickwit) 
  * (vector can also be used as an efficient(rust based) sidecar proxy to collect metrics, but prometheus server is already scraping so no need.)
  * (vector also offers a aggregator deployment that can do transformation and enrichment, 
    easy eks isn't implementing that functionality, because it'd add unnecessary complexity and observability data durability concerns.)

Trade Offs:
Pros: 
* Predictable pricing
* Significant Cost Savings
  * QuickWit Logs are theoretically ~10x cheaper than CW Logs
    Because:
    * CW Logs = $0.500 per 1GB ingested (https://aws.amazon.com/cloudwatch/pricing/)
    * S3      = $0.023 per 1GB ingested/stored (quickwit uses s3 for storage)
  * Prometheus Metrics should also be ~10x cheaper than CW Metrics (and easier to configure)

Cons:
* 1 replica (No HA, No FT, but also no big deal due to kube auto-healing)
* This isn't a problem if you embrace the philosophy of SLOs/ that 100% uptime is overrated.
* You can often get 99%-99.95% uptime for much cheaper

Ambivalent Notes: 
* If something goes wrong, it'll need some degree of human intervention (but since R&D done upfront, potentially cheaper even with human maintenance.)
* Try starting with it and only switching to cloudwatch options if it becomes a problem.
* You can use it as a stop gap solution or in lower environments where cons are acceptable.
* Spot nodes can be used to be even cheaper (it'd only poke minor holes in metric graphs)
*/
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface Quickwit_Input_Parameters {
    enabled: boolean;
    rds_instance_type: ec2.InstanceType;
}
export interface Vector_Input_Parameters {
    enabled: boolean;
}
export interface Prometheus_Input_Parameters {
    enabled: boolean;
}
export interface Grafana_Input_Parameters {
    enabled: boolean;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export class Grafana_Prometheus_Quickwit_Vector{

    //Class Variables/Properties:
    stack: cdk.Stack;
    cluster: eks.ICluster;
    //eks_config: Easy_EKS_Config_Data; //<-- doesn't exist within this class on purpose
    //^-- Avoid multiple instances to prevent unexpected results from multiple config object instances having de-synchronized config.
    observability_ns_manifest = {
        "apiVersion": "v1",
        "kind": "Namespace",
        "metadata": {
            "name": "monitoring" //following a pre-existing-convention established by kube-prometheus-stack
        }
    };
    observability_ns: eks.KubernetesManifest;
    quickwit_input_parameters: Quickwit_Input_Parameters;
    vector_input_parameters: Vector_Input_Parameters;
    prometheus_input_parameters: Prometheus_Input_Parameters;
    grafana_input_parameters: Grafana_Input_Parameters;


    //Class Constructor:
    constructor(stack: cdk.Stack, cluster: eks.ICluster){
        this.stack = stack;
        this.cluster = cluster;
    }//end constructor of Grafana_Prometheus_Quickwit_Vector


    set_input_parameters_of_quickwit(quickwit_input_parameters: Quickwit_Input_Parameters){
        this.quickwit_input_parameters = quickwit_input_parameters;
    }
    set_input_parameters_of_vector(vector_input_parameters: Vector_Input_Parameters){
        this.vector_input_parameters = vector_input_parameters;
    }
    set_input_parameters_of_prometheus(prometheus_input_parameters: Prometheus_Input_Parameters){
        this.prometheus_input_parameters = prometheus_input_parameters;
    }
    set_input_parameters_of_grafana(grafana_input_parameters: Grafana_Input_Parameters){
        this.grafana_input_parameters = grafana_input_parameters;
    }
    deploy_configured_GPQV_Observability_Stack(config: Easy_EKS_Config_Data){
        this.observability_ns = new eks.KubernetesManifest(this.stack, "monitoring-kube-namespace", {
            cluster: this.cluster,
            manifest: [this.observability_ns_manifest],
            overwrite: true,
            prune: true,
        });
        if(this.quickwit_input_parameters.enabled === true){ this.deploy_quickwit(config); }
        if(this.vector_input_parameters.enabled === true){ this.deploy_vector(config); }
        if(this.prometheus_input_parameters.enabled === true){ this.deploy_prometheus(config); }
        if(this.grafana_input_parameters.enabled === true){ this.deploy_grafana(config); }
    }
    deploy_quickwit(config: Easy_EKS_Config_Data){
        const quickwit_Kube_SA = new eks.ServiceAccount(this.stack, 'quickwit_kube-sa', {
            cluster: this.cluster,
            name: 'qw-quickwit', //based on $HELM_RELEASE_NAME-quickwit
            namespace: this.observability_ns_manifest.metadata.name,
            identityType: eks.IdentityType.POD_IDENTITY, //depends on eks-pod-identity-agent addon
            //Note: It's not documented, but this generates 4 things:
            //1. A kube SA in the namespace of the cluster
            //2. An IAM role paired to the Kube SA
            //3. An EKS Pod Identity Association
            //4. The eks-pod-identity-agent addon (if it doesn't already exist)
        });
        quickwit_Kube_SA.node.addDependency(this.observability_ns);
        // v-- temp for testing
        quickwit_Kube_SA.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'));
        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        const quickwit_s3_bucket = new s3.Bucket(this.stack, 'quickwit-logs-bucket', {
            encryption: s3.BucketEncryption.KMS_MANAGED,
            bucketKeyEnabled: true, //cost optimization to minimize AWS API calls
            removalPolicy: cdk.RemovalPolicy.DESTROY, //auto cleanup on cdk deploy
            autoDeleteObjects: true, //auto cleanup on cdk deploy
        });
        const vpc = config.vpc;
        const sg_of_cluster_nodes = ec2.SecurityGroup.fromLookupById(this.stack, `sg-of-${config.cluster_name}-nodes`, config.sg_id_of_cluster_nodes);
        const sg_of_psql = new ec2.SecurityGroup(this.stack, 'psql-sg', {
            securityGroupName: `${config.cluster_name}-essentials-quickwit-psql`,
            vpc: vpc,
            allowAllIpv6Outbound: true,
            allowAllOutbound: true,
            description: "SG of PSQL used by quickwit for eks cluster logging",
        });
        sg_of_psql.addIngressRule(sg_of_cluster_nodes, ec2.Port.allTcp(), `Allow Ingress from ${config.cluster_name}`);
        cdk.Tags.of(sg_of_psql).add('Name', `${config.cluster_name}/psql-for-cluster-hosted-quickwit-logging`);
        const quickwit_psql = new rds.DatabaseInstance(this.stack, 'quickwit-psql', {
            instanceIdentifier: `${config.cluster_name}-essentials-quickwit-psql`, //warning don't change name (doing so causes recreation)
            engine: rds.DatabaseInstanceEngine.postgres({version: rds.PostgresEngineVersion.VER_17_5}),
            instanceType: this.quickwit_input_parameters.rds_instance_type,
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
        const quickwit_helm_release = new eks.HelmChart(this.stack, 'qw-helm', {
            cluster: this.cluster,
            namespace: this.observability_ns_manifest.metadata.name,
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
                    "QW_METASTORE_URI": `postgres://quickwit:placeholder-password-for-testing@${config.cluster_name}-essentials-quickwit-psql.ctecks8yu9bg.${config.cluster_region}.rds.amazonaws.com:5432/quickwit_metastore`,
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
        quickwit_helm_release.node.addDependency(this.observability_ns);
        quickwit_helm_release.node.addDependency(quickwit_Kube_SA);
        quickwit_helm_release.node.addDependency(quickwit_s3_bucket);
        quickwit_helm_release.node.addDependency(quickwit_psql);
    } //end deploy_quickwit()

    deploy_vector(config: Easy_EKS_Config_Data){
        //TODO
    }

    deploy_prometheus(config: Easy_EKS_Config_Data){
        const kube_prometheus_stack_helm_release = new eks.HelmChart(this.stack, 'kps-helm', { //kps = kube prometheus stack (grafana & prometheus)
            cluster: this.cluster,
            namespace: "monitoring", //observability_ns_manifest.metadata.name,
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
        kube_prometheus_stack_helm_release.node.addDependency(this.observability_ns);
    } //end deploy_prometheus

    deploy_grafana(config: Easy_EKS_Config_Data){
        //TODO
    }

}//end class Grafana_Prometheus_Quickwit_Vector

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
