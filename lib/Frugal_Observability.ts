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
/*Frugal GVVV: Grafana Victoria Vector Stack
* Grafana (Dashboard GUI for Prometheues Metrics & can also function as a GUI for quickwit logs)
* Victoria Metrics (better version of prometheus metric database)
* Victoria Logs
* Vector.dev (easy eks is only using vector-agent daemonset to ship logs into Victoria Logs) 
  * (vector can also be used as an efficient(rust based) sidecar proxy to collect metrics, but prometheus server is already scraping so no need.)
  * (vector also offers a aggregator deployment that can do transformation and enrichment, 
    easy eks isn't implementing that functionality, because it'd add unnecessary complexity and observability data durability concerns.)

Trade Offs:
Pros: 
* Predictable pricing
* Significant Cost Savings
  * Victoria Logs are theoretically ~10x cheaper than CW Logs
    Because:
    * CW Logs = $0.50 per 1GB ingested (https://aws.amazon.com/cloudwatch/pricing/)
    * EBS     = $0.08 per 1GB-stored, (supports up to 15x compression, so 2GB++ logs can fit on 1 GB storage, so ~$0.04 per 1GB log storaged.)
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
export interface Victoria_Logs_Single_Node_Input_Parameters {
    enabled: boolean;
}
export interface Vector_Log_Shipping_Agent_Input_Parameters {
    enabled: boolean;
}
export interface Victoria_Metrics_Single_Node_Input_Parameters {
    enabled: boolean;
}
export interface Grafana_Dashboard_Input_Parameters {
    enabled: boolean;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export class Frugal_Observability {

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
    logs_db_input_parameters: Victoria_Logs_Single_Node_Input_Parameters;
    logs_agent_input_parameters: Vector_Log_Shipping_Agent_Input_Parameters;
    metrics_db_input_parameters: Victoria_Metrics_Single_Node_Input_Parameters;
    dashboard_input_parameters: Grafana_Dashboard_Input_Parameters;


    //Class Constructor:
    constructor(stack: cdk.Stack, cluster: eks.ICluster){
        this.stack = stack;
        this.cluster = cluster;
    }//end of Frugal_Observability class' constructor


    set_input_parameters_of_logs_db(input: Victoria_Logs_Single_Node_Input_Parameters){
        this.logs_db_input_parameters = input;
    }
    set_input_parameters_of_logs_agent(input: Vector_Log_Shipping_Agent_Input_Parameters){
        this.logs_agent_input_parameters = input;
    }
    deploy_configured_Frugal_Observability_Stack(config: Easy_EKS_Config_Data){
        this.observability_ns = new eks.KubernetesManifest(this.stack, "monitoring-kube-namespace", {
            cluster: this.cluster,
            manifest: [this.observability_ns_manifest],
            overwrite: true,
            prune: true,
        });
        if(this.logs_db_input_parameters.enabled === true){ this.deploy_victoria_logs_db(config); }
        if(this.logs_agent_input_parameters.enabled === true){ this.deploy_vector_logging_agent(config); }
    }
    deploy_victoria_logs_db(config: Easy_EKS_Config_Data){
        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        const victoria_logs_helm_release = new eks.HelmChart(this.stack, 'victoria-logs-helm', {
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
            },//end helm values
        });
        // Imperative installation order to avoid temporary errors in logs
        victoria_logs_helm_release.node.addDependency(this.observability_ns);
    } //end deploy_quickwit()

    deploy_vector_logging_agent(config: Easy_EKS_Config_Data){
        //TODO
    }



}//end of Frugal_Observability class

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
