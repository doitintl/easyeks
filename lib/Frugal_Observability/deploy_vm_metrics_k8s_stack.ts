import { Easy_EKS_Config_Data } from '../Easy_EKS_Config_Data';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import { Construct } from "constructs";
import * as fs from 'fs'; //node.js built in file system module
import * as yaml from 'js-yaml'; //npm install js-yaml && npm install --save-dev @types/js-yaml
import { read_yaml_string_as_javascript_object, read_yaml_file_as_javascript_object, read_yaml_file_as_array_of_javascript_objects, read_yaml_file_as_normalized_yaml_multiline_string } from '../Utilities';
import { merge } from 'lodash'; //npm install lodash & npm install @types/lodash
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function deploy_vm_metrics_k8s_stack(stack: cdk.Stack, cluster: eks.ICluster, config: Easy_EKS_Config_Data, observability_namespace: eks.KubernetesManifest){
//daemonset vmks-prometheus-node-exporter -> generates node metrics in prometheus format
//deployment vmks-kube-state-metrics -> generates kubernetes metrics in prometheus format
//deployment vmagent-vmks-victoria-metrics-k8s-stack -> auto-configured to scrape both and send to vm-metrics-db
//stateful deployment vmsingle-vmks-victoria-metrics-k8s-stack -> stores metrics
//grafana deployment vmks-grafana -> acts as a dashboard to show metrics stored in victoria metrics & and alternative dashboard for victoria logs

    const grafana_admin_login_kube_secret_as_yaml = read_yaml_file_as_normalized_yaml_multiline_string(
        './config/eks/yaml/essentials/frugal_observability/grafana_admin_login.templatized.yaml')
        .replaceAll('TEMPLATIZED_VARIABLE_GRAFANA_ADMIN_USERNAME', config.Frugal_Observability.grafana_admin_username) //(value_to_find, replacement_value)
        .replaceAll('TEMPLATIZED_VARIABLE_GRAFANA_ADMIN_PASSWORD', config.Frugal_Observability.grafana_admin_password) //(value_to_find, replacement_value)
    ;// ^-- reading file as multi-line string, then doing find and replace twice
    const grafana_admin_login_kube_secret_as_JS_object: JSON = read_yaml_string_as_javascript_object(grafana_admin_login_kube_secret_as_yaml);
    const grafana_admin_login_kube_secret = new eks.KubernetesManifest(stack, "grafana-admin-login-kube-secret", {
        cluster: cluster,
        manifest: [ grafana_admin_login_kube_secret_as_JS_object ],
        overwrite: true,
        prune: true,
    });
    grafana_admin_login_kube_secret.node.addDependency(observability_namespace);

    const merged_victoria_metrics_kubernetes_stack_helm_values = merge(
        config.Frugal_Observability.victoria_metrics_kubernetes_stack_baseline_helm_values,
        config.Frugal_Observability.victoria_metrics_kubernetes_stack_override_helm_values); //2nd parameter overrides 1st when merging
    const vmks_helm_release = new eks.HelmChart(stack, 'victoria-metrics-k8s-stack-helm', {
        cluster: cluster,
        namespace: 'observability',
        repository: 'https://victoriametrics.github.io/helm-charts',
        chart: 'victoria-metrics-k8s-stack',
        release: 'vmks',
        version: config.Frugal_Observability.victoria_metrics_kubernetes_stack_helm_chart_version,
        values: merged_victoria_metrics_kubernetes_stack_helm_values,
        wait: true, //the below dependency is a Custom Resource that requires CRDs to be good, before it runs.
    });
    vmks_helm_release.node.addDependency(observability_namespace); // <-- Imperative installation order to avoid temporary errors in logs

    const modified_vm_alert_yaml_file = './lib/Frugal_Observability/manifests/modified_upstream.vmalert.yaml';
    const modified_vm_alert_as_JSO_array: JSON[] = read_yaml_file_as_array_of_javascript_objects(modified_vm_alert_yaml_file);
    const modified_vm_alert = new eks.KubernetesManifest(stack, "modified-upstream-vm-alert", {
        cluster: cluster,
        manifest: modified_vm_alert_as_JSO_array,
        overwrite: true,
        prune: true,
    });
    modified_vm_alert.node.addDependency(vmks_helm_release);

} //end deploy_vm_metrics_k8s_stack()
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
