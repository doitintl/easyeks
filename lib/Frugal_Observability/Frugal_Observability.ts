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
export interface Victoria_Metrics_K8s_Stack_Input_Parameters {
    enabled: boolean;
}
export interface Victoria_Logs_Custom_Stack_Input_Parameters {
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
            "name": "observability"
        }
    };
    observability_ns: eks.KubernetesManifest;
    victoria_metrics_k8s_stack_input_parameters: Victoria_Metrics_K8s_Stack_Input_Parameters;
    victoria_logs_custom_stack_input_parameters: Victoria_Logs_Custom_Stack_Input_Parameters;


    //Class Constructor:
    constructor(stack: cdk.Stack, cluster: eks.ICluster){
        this.stack = stack;
        this.cluster = cluster;
    }//end of Frugal_Observability class' constructor


    set_input_parameters_of_victoria_metrics_k8s_stack(input: Victoria_Metrics_K8s_Stack_Input_Parameters){
        this.victoria_metrics_k8s_stack_input_parameters = input;
    }
    set_input_parameters_of_victoria_logs_custom_stack(input: Victoria_Logs_Custom_Stack_Input_Parameters){
        this.victoria_logs_custom_stack_input_parameters = input;
    }
    deploy_configured_Frugal_Observability_Stack(config: Easy_EKS_Config_Data){
        this.observability_ns = new eks.KubernetesManifest(this.stack, "observability-kube-namespace", {
            cluster: this.cluster,
            manifest: [this.observability_ns_manifest],
            overwrite: true,
            prune: true,
        });
        this.observability_ns.node.addDependency(config.aws_load_balancer_controller_helm_chart_essentials_dependency);
        //^-- fixes a race condition
        if(this.victoria_metrics_k8s_stack_input_parameters?.enabled === true){ //the ? can be interpreted as if defined & enabled
            deploy_vm_metrics_k8s_stack(this.stack, this.cluster, config, this.observability_ns);
        }
        if(this.victoria_logs_custom_stack_input_parameters?.enabled === true){ //the ? can be interpreted as if defined & enabled
            deploy_vm_logs_custom_stack(this.stack, this.cluster, config, this.observability_ns);
        }
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////////


}//end of Frugal_Observability class

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
