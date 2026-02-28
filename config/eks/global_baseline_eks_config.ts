import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import { Easy_EKS_Dynamic_Config } from '../../lib/Easy_EKS_Dynamic_Config';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as cwo from '../../lib/CW_Observability/CW_Observability';
import { read_yaml_string_as_javascript_object, read_yaml_file_as_javascript_object, read_yaml_file_as_array_of_javascript_objects, read_yaml_file_as_normalized_yaml_multiline_string } from '../../lib/Utilities';
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

    /*To see officially recognized spelling of names of all eks add-ons:
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

    const default_priority_class_manifest = {
        "apiVersion": "scheduling.k8s.io/v1",
        "kind": "PriorityClass",
        "metadata": {
            "name": 'default',
        },
        "globalDefault": true,
        "preemptionPolicy": "PreemptLowerPriority",
        "value": 1000, //(high number = high priority, low number = low priority)
        "description": "PriorityClass supplied by Easy EKS",
    };
    const low_priority_class_manifest = {
        "apiVersion": "scheduling.k8s.io/v1",
        "kind": "PriorityClass",
        "metadata": {
            "name": 'low',
        },
        "preemptionPolicy": "PreemptLowerPriority",
        "value": 500, //(high number = high priority, low number = low priority)
        "description": "PriorityClass supplied by Easy EKS",
    };
    const high_priority_class_manifest = {
        "apiVersion": "scheduling.k8s.io/v1",
        "kind": "PriorityClass",
        "metadata": {
            "name": 'high',
        },
        "preemptionPolicy": "PreemptLowerPriority",
        "value": 2000, //(high number = high priority, low number = low priority)
        "description": "PriorityClass supplied by Easy EKS",
    };
    const priority_classes = new eks.KubernetesManifest(stack, "kube_pod_priority_classes",
    {
        cluster: cluster,
        manifest: [default_priority_class_manifest,low_priority_class_manifest,high_priority_class_manifest],
        overwrite: true,
        prune: true,
    });

    const prometheus_operator_crds_helm_release = new eks.HelmChart(stack, 'prometheus_operator_crds_helm', {
        cluster: cluster,
        namespace: 'kube-system',
        repository: 'https://prometheus-community.github.io/helm-charts',
        chart: 'prometheus-operator-crds',
        release: 'prometheus-operator-crds',
        version: '27.0.0', //version of helm chart, this shouldn't need to be updated (because prometheus' CRDs are v1.0 stable)
        values: read_yaml_file_as_javascript_object(
            './config/eks/yaml/cluster/prometheus_operator_crds.baseline.helm_values.yaml'),
    });
    const victoriametrics_operator_crds_helm_release = new eks.HelmChart(stack, 'victoriametrics_operator_crds_helm', {
        cluster: cluster,
        namespace: 'kube-system',
        repository: 'https://victoriametrics.github.io/helm-charts/',
        chart: 'victoria-metrics-operator-crds',
        release: 'victoria-metrics-operator-crds',
        version: '0.8.0', //<-- version of helm chart, associated with app version 0.68.0
        values: read_yaml_file_as_javascript_object(
            './config/eks/yaml/cluster/victoriametrics_operator_crds.baseline.helm_values.yaml'),
    });
    // VictoriaMetrics' CRDs are beta so they may need to be updated in the future, use below command to look up latest
    // helm repo add vm https://victoriametrics.github.io/helm-charts/ || helm repo update vm && helm search repo vm/victoria-metrics-operator-crds -l

}//end deploy_addons()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_essentials(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.ICluster){

    //Note: config.CloudWatch_Observability's set functions & config.Frugal_Observablity's set functions
    //      are only staging configuration for a potential deployment (and in this file just the baseline config)
    //      They aren't actually deploying anything (during this stage)
    //Also you can overide / replace either of these global baseline configurations, by calling the set_input_parameters()
    //from other *_config.ts files, which would replace the staged global baseline configurations.
    const cw_metrics_observability_inputs: cwo.CloudWatch_Metrics_Input_Parameters = {
        addonVersion: Easy_EKS_Dynamic_Config.get_latest_version_of_amazon_cloudwatch_observability_eks_addon(), //OR 'v4.4.0-eksbuild.1'
        enhanced_container_insights: false, //true is probably overkill & more expensive.
        accelerated_compute_metrics: false,
        metrics_collection_interval_seconds: 300, //10(expensive and short history), 60(expensive), 300(cheaper) are reasonable values
        // enhanced false gives -> https://aws.github.io/amazon-cloudwatch-agent/
        // enhanced true  gives -> https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Container-Insights-metrics-enhanced-EKS.html
    };
    config.CloudWatch_Observability.set_input_parameters_of_cloudwatch_metrics(cw_metrics_observability_inputs);
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    const cw_logs_observability_inputs: cwo.CloudWatch_Logs_Input_Parameters = {
        application_log_conf_file_name: "default-application-log.conf",
        dataplane_log_conf_file_name: "default-dataplane-log.conf",
        fluent_bit_conf_file_name: "default-fluent-bit.conf",
        host_log_conf_file_name: "default-host-log.conf",
        parsers_conf_file_name: "default-parsers.conf",
        //If you want to modify, then copy and edit files in './lib/CW_Observability/' (95% of people won't need to)
    };
    config.CloudWatch_Observability.set_input_parameters_of_cloudwatch_logs(cw_logs_observability_inputs);
    /////////////////////////////////////////////////////////////////////////////////////////////////////

    /////////////////////////////////////////////////////////////////////////////////////////////////////
    //Baseline Configuration of VM Logs Custom Stack
    config.Frugal_Observability.set_kubernetes_event_exporter_baseline_helm_values_as_JS_Object(
        read_yaml_file_as_javascript_object(
            './config/eks/yaml/essentials/frugal_observability/kubernetes_event_exporter.baseline.helm_values.yaml')
    );
    config.Frugal_Observability.set_vector_dev_agent_baseline_helm_values_as_JS_Object(
        read_yaml_string_as_javascript_object(
            read_yaml_file_as_normalized_yaml_multiline_string(
                './config/eks/yaml/essentials/frugal_observability/vector_dev_as_log_agent.baseline.templatized_helm_values.yaml')
            .replaceAll('TEMPLATIZED_VARIABLE_CLUSTER_NAME', config.cluster_name) //(value_to_find, replacement_value)
            .replaceAll('TEMPLATIZED_VARIABLE_CLUSTER_REGION', config.cluster_region) //(value_to_find, replacement_value)
            //^--running 2 find and replace functions against a multi-line string 
        )//then after variable replacement of templatized file is done, converting it to javascript object
    );
    config.Frugal_Observability.set_victoria_logs_db_single_baseline_helm_values_as_JS_Object(
        read_yaml_string_as_javascript_object(
            read_yaml_file_as_normalized_yaml_multiline_string(
                './config/eks/yaml/essentials/frugal_observability/victoria_logs_single_db.baseline.templatized_helm_values.yaml')
            .replaceAll('TEMPLATIZED_VARIABLE_IPV6_ENABLED', `${config.ipMode === eks.IpFamily.IP_V6}`)//(value_to_find, replacement_value)
            //^--running find and replace function against multi-line string.  ^--evaluates to true using default config
        )//then after variable replacement of templatized file is done, converting it to javascript object
    );
    //If the above were deployed, then you could use the following commands to see helm-values of live env
    // helm get values kubernetes-event-exporter -n=observability
    // helm get values log-collection-agent -n=observability
    // helm get values vl -n=observability
    /////////////////////////////////////////////////////////////////////////////////////////////////////

    /////////////////////////////////////////////////////////////////////////////////////////////////////
    //Baseline Configuration of VM Metrics Kube Stack
    config.Frugal_Observability.set_victoria_metrics_kubernetes_stack_baseline_helm_values_as_JS_Object(
        read_yaml_string_as_javascript_object(
            read_yaml_file_as_normalized_yaml_multiline_string(
                './config/eks/yaml/essentials/frugal_observability/victoria_metrics_kubernetes_stack.baseline.templatized_helm_values.yaml')
            .replaceAll('TEMPLATIZED_VARIABLE_IPV6_ENABLED', `${config.ipMode === eks.IpFamily.IP_V6}`)//(value_to_find, replacement_value)
            //^--running find and replace function against multi-line string.  ^--evaluates to true using default config
        )//then after variable replacement of templatized file is done, converting it to javascript object
    );
    //If the above were deployed, then you could use the following commands to see helm-values of live env
    // helm get values vmks -n=observability
    /////////////////////////////////////////////////////////////////////////////////////////////////////

}//end deploy_essentials()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_workloads(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.ICluster){

}//end deploy_workloads()
