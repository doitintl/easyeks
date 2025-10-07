import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import { Easy_EKS_Dynamic_Config } from '../../lib/Easy_EKS_Dynamic_Config';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as eks from 'aws-cdk-lib/aws-eks';
import request from 'sync-request-curl'; //npm install sync-request-curl (cdk requires sync functions, async not allowed)
import { 
    CloudWatch_Metrics_Input_Parameters,
    CloudWatch_Logs_Input_Parameters,
    CloudWatch_Metrics_and_Logs_Observability
} from '../../lib/CW_Observability/CW_Observability';
//Intended Use: 
//A baseline config file (to be applied to all EasyEKS Clusters)
//That 95% of global users will feel comfortable using with 0 changes, but can change.

//export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster){ //config: is of type Easy_EKS_Config_Data
export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack){ //config: is of type Easy_EKS_Config_Data    
    config.add_tag("IaC Tooling used for Provisioning and Management of this EKS Cluster", "cdk: a CLI tool that stands for AWS Cloud Development Kit.");
    config.add_tag("Upstream Methodology Docs", "https://github.com/doitintl/easyeks");
    //^-- NOTE: AWS tag restrictions vary by service, but generally only letters, numbers, spaces, and the following characters are allowed: + - = . _ : / @
    //    Tags are validated by the validateTag() function in lib/Utilities.ts before deployment
    //    More details:
    //      - https://docs.aws.amazon.com/eks/latest/userguide/eks-using-tags.html#tag-restrictions
    //      - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Using_Tags.html#tag-restrictions
    config.add_cluster_wide_kubectl_Admin_Access_using_ARN(`arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT}:role/kubectl-helm-lambda-deployer-role-used-by-easy-eks`);
    //^-- cdk-main.ts calls a Utility.ts library that uses aws cli to ensure this role exists (cdk errors would occur if it wasn't pre-existing.)
}//end apply_config()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_addons(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster){

    /*To see official names of all eks add-ons:
    aws eks describe-addon-versions  \
    --kubernetes-version=1.33 \
    --query 'sort_by(addons  &owner)[].{owner: owner, addonName: addonName}' \
    --output table
    */
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // NOTICE: Don't add eks-pod-identity-agent addon
    // It's purposefully left out to work around CDK bug https://github.com/aws/aws-cdk/issues/32580
    // The cdk bug relates to an error where there's a complaint about it already being present, if 2 things try to install it.
    // The AWS Load Balancer Controller installation logic, will trigger the installation of eks-pod-identity-agent addon.
    // https://github.com/aws/aws-cdk/pull/33891
    // ^-- A fix is actively being worked on, but not yet available.
    // Note the IaC will deploy default (which isn't latest)
    // but if you manually update in GUI it'll stay updated
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}//end deploy_addons()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_essentials(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.ICluster){

    //Note: This is only staging configuration for a potential deployment.
    //It's not actually deploying anything
    //Also you can overide / replace either of these global baseline configurations, by calling the set_input_parameters()
    //from another config.ts file, which will replace the staged global baseline configuration.
    const cw_metrics_observability_inputs: CloudWatch_Metrics_Input_Parameters = {
        addonVersion: Easy_EKS_Dynamic_Config.get_latest_version_of_amazon_cloudwatch_observability_eks_addon(), //OR 'v4.4.0-eksbuild.1'
        enhanced_container_insights: false, //true is probably overkill & more expensive.
        accelerated_compute_metrics: false,
        metrics_collection_interval_seconds: 300, //10(expensive and short history), 60(expensive), 300(cheaper) are reasonable values
        // enhanced false gives -> https://aws.github.io/amazon-cloudwatch-agent/
        // enhanced true  gives -> https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Container-Insights-metrics-enhanced-EKS.html
    };
    config.CW.set_input_parameters_of_cloudwatch_metrics(cw_metrics_observability_inputs);
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    const cw_logs_observability_inputs: CloudWatch_Logs_Input_Parameters = {
        application_log_conf_file_name: "default-application-log.conf",
        dataplane_log_conf_file_name: "default-dataplane-log.conf",
        fluent_bit_conf_file_name: "default-fluent-bit.conf",
        host_log_conf_file_name: "default-host-log.conf",
        parsers_conf_file_name: "default-parsers.conf",
        //If you want to modify, then copy and edit files in './lib/CW_Observability/' (95% of people won't need to)
    };
    config.CW.set_input_parameters_of_cloudwatch_logs(cw_logs_observability_inputs);
    /////////////////////////////////////////////////////////////////////////////////////////////////////

}//end deploy_essentials()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_workloads(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.ICluster){

}//end deploy_workloads()
