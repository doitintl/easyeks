import { Easy_EKS_Config_Data } from '../Easy_EKS_Config_Data';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import { Construct } from "constructs";
import { deploy_vm_metrics_k8s_stack } from './deploy_vm_metrics_k8s_stack';
import { deploy_vm_logs_custom_stack } from './deploy_vm_logs_custom_stack';
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*Frugal Observability Stack:
* Grafana (Dashboard GUI for Prometheues Metrics & can also function as a GUI for quickwit logs)
* Victoria Metrics (better version of prometheus metric database)
* Victoria Logs
* Vector.dev (easy eks is only using vector-agent daemonset to ship logs into Victoria Logs) 
  * (vector can also be used as an efficient(rust based) sidecar proxy to collect metrics, but prometheus server is already scraping so no need.)
  * (vector also offers a aggregator deployment that can do transformation and enrichment, 
    easy eks isn't implementing that functionality, because it'd add unnecessary complexity and observability data durability concerns.)

Trade Offs:
Pros: 
* Predictable pricing Victoria Logs and Metrics baseline config is for 40GB EBS storage $3.20/day (~$97.34/month)
* Significant Cost Savings
  * Victoria Logs are theoretically at least ~10x cheaper than CW Logs
    Because:
    * CloudWatch Logs = $0.50 per 1GB ingested (https://aws.amazon.com/cloudwatch/pricing/)
    * EBS     = $0.08 per 1GB-stored, (supports up to 15x compression, so 2GB++ logs can fit on 1 GB storage, so ~$0.04 per 1GB log storaged.)
  * Prometheus Metrics should also be at least ~10x cheaper than CloudWatch Metrics (and easier to configure)

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
export class Frugal_Observability {

    //Class Variables/Properties:
    stack: cdk.Stack;
    cluster: eks.ICluster;
    //eks_config: Easy_EKS_Config_Data; //<-- doesn't exist within this class on purpose
    //^-- Avoid multiple instances to prevent unexpected results from multiple config object instances having de-synchronized config.

    constructor(stack: cdk.Stack, cluster: eks.ICluster){
        this.stack = stack;
        this.cluster = cluster;
        // Purposefully Minimal Class Constructor
        // The intent is to follow "builder pattern"
        // Where several config.ts files can partially initialize bits and peices of this object's config
        // and build up the config in peices instead of all at once.
        // The main purpose of this class is to hold configuration values.
    }//end of Frugal_Observability class' constructor
    

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Relatively static variable stored in the class
    //Observability Namespace:
    observability_ns_manifest = {
        "apiVersion": "v1",
        "kind": "Namespace",
        "metadata": {
            "name": "observability"
        }
    };
    observability_ns: eks.KubernetesManifest; //no setter needed, gets initialized at the last minute using the above manifest & below method.
    ensure_observability_namespace_exists(config: Easy_EKS_Config_Data){
        if (this.observability_ns === undefined) { //<--ensures the namespace is only initialized once.
            this.observability_ns = new eks.KubernetesManifest(this.stack, "observability-kube-namespace", {
                cluster: this.cluster,
                manifest: [this.observability_ns_manifest],
                overwrite: true,
                prune: true,
            });
            this.observability_ns.node.addDependency(config.aws_load_balancer_controller_helm_chart_essentials_dependency);
            //^-- fixes a race condition            
        }
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Input parameters of victoria_logs_custom_stack, stored in this class & associated setter methods:
    //(This deploys: vm-logs-db-single, vector.dev-agent(configured as log collector), kube-event-exporter, configmap of logging dashboards)

    //kubernetes_event_exporter:
        //variable declarations:
        kubernetes_event_exporter_helm_chart_version: string;
        kubernetes_event_exporter_baseline_helm_values: JSON;
        kubernetes_event_exporter_override_helm_values: JSON;
        //setter declarations:
        set_kubernetes_event_exporter_helm_chart_version(helm_chart_version: string){ this.kubernetes_event_exporter_helm_chart_version = helm_chart_version; }
        set_kubernetes_event_exporter_baseline_helm_values_as_JS_Object(helm_values: JSON){ this.kubernetes_event_exporter_baseline_helm_values = helm_values; }
        set_kubernetes_event_exporter_override_helm_values_as_JS_Object(helm_values: JSON){ this.kubernetes_event_exporter_override_helm_values = helm_values; }

    //vector.dev-agent(configured as log collector):
        //variable declarations:
        vector_dev_agent_helm_chart_version: string;
        vector_dev_agent_baseline_helm_values: JSON;
        vector_dev_agent_override_helm_values: JSON;
        //setter declarations:
        set_vector_dev_agent_helm_chart_version(helm_chart_version: string){ this.vector_dev_agent_helm_chart_version = helm_chart_version; }
        set_vector_dev_agent_baseline_helm_values_as_JS_Object(helm_values: JSON){ this.vector_dev_agent_baseline_helm_values = helm_values; }
        set_vector_dev_agent_override_helm_values_as_JS_Object(helm_values: JSON){ this.vector_dev_agent_override_helm_values = helm_values; }

    //victoria-logs-db-single:
        //variable declarations:
        victoria_logs_db_single_helm_chart_version: string;
        victoria_logs_db_single_baseline_helm_values: JSON;
        victoria_logs_db_single_override_helm_values: JSON;
        //setter declarations:
        set_victoria_logs_db_single_helm_chart_version(helm_chart_version: string){ this.victoria_logs_db_single_helm_chart_version = helm_chart_version; }
        set_victoria_logs_db_single_baseline_helm_values_as_JS_Object(helm_values: JSON){ this.victoria_logs_db_single_baseline_helm_values = helm_values; }
        set_victoria_logs_db_single_override_helm_values_as_JS_Object(helm_values: JSON){ this.victoria_logs_db_single_override_helm_values = helm_values; }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Input parameters of victoria_metrics_k8s_stack, stored in this class & associated setter methods:
    //(This deploys: vm-metrics-db-single, grafana, metrics-agents, vm-operator, misc other things)

    //grafana-admin-basic-auth secret:
        //variable declarations:
        grafana_admin_username: string;
        grafana_admin_password: string;
        //setter declarations:
        set_grafana_admin_username(username: string){ this.grafana_admin_username = username; }
        set_grafana_admin_password(password: string){ this.grafana_admin_password = password; }

    //VMKS(Victoria Metrics Kubernetes Stack):
        //variable declarations:
        victoria_metrics_kubernetes_stack_helm_chart_version: string;
        victoria_metrics_kubernetes_stack_baseline_helm_values: JSON;
        victoria_metrics_kubernetes_stack_override_helm_values: JSON;
        //setter declarations:
        set_victoria_metrics_kubernetes_stack_helm_chart_version(helm_chart_version: string){ this.victoria_metrics_kubernetes_stack_helm_chart_version = helm_chart_version; }
        set_victoria_metrics_kubernetes_stack_baseline_helm_values_as_JS_Object(helm_values: JSON){ this.victoria_metrics_kubernetes_stack_baseline_helm_values = helm_values; }
        set_victoria_metrics_kubernetes_stack_override_helm_values_as_JS_Object(helm_values: JSON){ this.victoria_metrics_kubernetes_stack_override_helm_values = helm_values; }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Deployment Logic: 
    deploy_configured_victoria_logs_custom_stack(config: Easy_EKS_Config_Data){
        this.ensure_observability_namespace_exists(config);
        deploy_vm_logs_custom_stack(this.stack, this.cluster, config, this.observability_ns);
    }
    deploy_configured_victoria_metrics_k8s_stack(config: Easy_EKS_Config_Data){
        this.ensure_observability_namespace_exists(config);
        deploy_vm_metrics_k8s_stack(this.stack, this.cluster, config, this.observability_ns);
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}//end of Frugal_Observability class

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
