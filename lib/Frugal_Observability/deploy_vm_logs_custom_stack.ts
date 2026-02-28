import { Easy_EKS_Config_Data } from '../Easy_EKS_Config_Data';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import { Construct } from "constructs";
import * as fs from 'fs'; //node.js built in file system module
import * as yaml from 'js-yaml'; //npm install js-yaml && npm install --save-dev @types/js-yaml
import { read_yaml_string_as_javascript_object, read_yaml_file_as_javascript_object, read_yaml_file_as_array_of_javascript_objects } from '../Utilities';
import { merge } from 'lodash'; //npm install lodash & npm install @types/lodash
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function deploy_vm_logs_custom_stack(stack: cdk.Stack, cluster: eks.ICluster, config: Easy_EKS_Config_Data, observability_namespace: eks.KubernetesManifest){

/* Notes:
vector.dev is an all in one observability agent that can collect metrics, logs, and traces

In the current setup vector is purely used as a logging agent/only used as a logging agent.

Why the design decision makes sense:
* victoria metrics has multiple useful default grafana dashboards for metrics.
  * victoria metric has it's own metric shipping agent, vmagent which has 3 significant advantages:
    * It favors convention over configuration, so it ships with a working config by default.
    * It formats the raw prometheus metric data in a way that the pre-built community dashboards expect, so community dashboards work by default
    * The operator pattern allows self service configuration of metric collection, using kube custom resources of configuration snippets, instead of a centralized config file.
  * vector.dev agent as a metric shipping agent has 3 significant disadvantages:
    * It needs to be explicitly configured.
    * It would be complex to ship prometheus metrics in a way that pre-build community dashboards would recognize, they'd often show no-data, when metric data was available.
    * It'd be a centralized config location, and any iterations would require restarts that'd interrupt log shipping, misconfigurations would have a large blast radius.
    * It also doesn't offer any features or UX benefits that give it an edge over vmagent.
* using vector.dev purely as a log shipper:
  * vector.dev has UX benefits when it comes to managing logs
  * logs only means lower cognitive overhead.
*/

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    //kubernetes-event-exporter (will send kube-event-logs to vector-aggregator)
    //Note: vector.dev can collect kubernetes events by itself, by using http_client & kube SA token auth
    //      but while testing that approach, I discovered the algorithm used is simple yet problematic.
    //      * Rather than watch the kube-api server,
    //      * It'd work by polling for 100% of events, every N seconds.
    //      * Then to only forward new events, the deduplication algorithm would store 100% of events in
    //        memory, or at least the UID of event. And only forward events not alredy found in memory,
    //        deduplicating by event UID.
    //      * Problems: 
    //        * By default dedup supports 10k, it'd be easy to cross that threshold in a medium cluster
    //        * If you cross the configurable threshold, you'd see duplicate events (verifiable by event UID)
    //        * You can easily bump that max to ~100k or something to support a large cluster, 
    //          but then the aggregator would likely use over 1GB ram just for deduplication.
    //        * And in addition to memory inefficient if/when the vector aggregator pod reboots
    //          it'd resend everything, since the deduplication memory cache would reset.
    // 3 Other reasonable alternatives exist.
    // Alt 1: Grafana Alloy: No due to reports of complex config and high resource utilization. 
    // Alt 2: https://github.com/max-rocket-internet/k8s-event-logger
    //        Actively maintained, efficient algorith, and simple, vector could partition the log stream.
    // Alt 3: https://github.com/resmoio/kubernetes-event-exporter?tab=readme-ov-file#elasticsearch
    //        * Going with this option.
    //        * Why: 4x number of github stars vs 2nd option + has api rate limiting logic
    //        * How: I'll use log to stdout & which would make it easy to swap out with Alt 2 if needed.
    //        * Potential downside shouldn't be an issue:
    //          * Only downside is bitnami involvement
    //            In 2025 Broadcom will get rid of docker.io/bitnami images.
    //          * But that shouldn't be an issue because:
    //            * Their helm charts will still be available
    //            * gallery.ecr.aws/bitnami will still be accessible (https://github.com/bitnami/charts/issues/35314)
    //            * Alt images exist: 
    //              * docker pull docker.io/bitnamilegacy/kubernetes-event-exporter:1.7.0-debian-12-r46
    //                ^-- multi-platform, ARM & AMD builds exist, but this will be removed in 2026
    //              * https://gallery.ecr.aws/bitnami/kubernetes-event-exporter
    //                docker pull public.ecr.aws/bitnami/kubernetes-event-exporter:1.7.0-debian-12-r52
    //                ^-- darn no matching manifest for linux/arm64/v8 in the manifest list entries (looks x86_64 only)
    //              * docker pull ghcr.io/resmoio/kubernetes-event-exporter:latest
    //                ^-- multi-platform, ARM & AMD(x86_64) builds exist
    ///////////////////////////////////////////////////////////////////////////////////////////////////////

    const merged_kubernetes_event_exporter_helm_values = merge(
        config.Frugal_Observability.kubernetes_event_exporter_baseline_helm_values,
        config.Frugal_Observability.kubernetes_event_exporter_override_helm_values); //2nd parameter overrides 1st when merging
    const kubernetes_event_exporter_helm_release = new eks.HelmChart(stack, 'kubernetes-event-exporter-helm', {
        cluster: cluster,
        namespace: 'observability',
        repository: 'https://charts.bitnami.com/bitnami',
        chart: 'kubernetes-event-exporter',
        release: 'kubernetes-event-exporter',
        version: config.Frugal_Observability.kubernetes_event_exporter_helm_chart_version,
        values: merged_kubernetes_event_exporter_helm_values,
    });
    kubernetes_event_exporter_helm_release.node.addDependency(observability_namespace);
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    const merged_vector_dev_as_log_collection_agent_helm_values = merge(
        config.Frugal_Observability.vector_dev_agent_baseline_helm_values,
        config.Frugal_Observability.vector_dev_agent_override_helm_values); //2nd parameter overrides 1st when merging
    const vector_as_a_log_collection_agent_helm_release = new eks.HelmChart(stack, 'vector-observability-agent-daemonset-helm', {
        cluster: cluster,
        namespace: 'observability',
        repository: 'https://helm.vector.dev',
        chart: 'vector',
        release: 'log-collection-agent',
        version: config.Frugal_Observability.vector_dev_agent_helm_chart_version,
        values: merged_vector_dev_as_log_collection_agent_helm_values,
    });
    vector_as_a_log_collection_agent_helm_release.node.addDependency(observability_namespace);
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    const merged_victoria_logs_single_db_helm_values = merge(
        config.Frugal_Observability.victoria_logs_db_single_baseline_helm_values,
        config.Frugal_Observability.victoria_logs_db_single_override_helm_values); //2nd parameter overrides 1st when merging
    const victoria_logs_helm_release = new eks.HelmChart(stack, 'victoria-logs-db-helm', {
        cluster: cluster,
        namespace: 'observability',
        repository: "https://victoriametrics.github.io/helm-charts/",
        chart: "victoria-logs-single",
        release: 'vl',
        version: config.Frugal_Observability.victoria_logs_db_single_helm_chart_version,
        values: merged_victoria_logs_single_db_helm_values,
    }); 
    victoria_logs_helm_release.node.addDependency(observability_namespace);
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Victoria Logs Specific Dashboards:
    //(Note normally a service monitor needs to be associated as well, but the helm chart's values file generates that for us)
    const grafana_dashboard_configmaps_yaml_file = './lib/Frugal_Observability/manifests/victoria_logs_grafana_dashboard.configmaps.yaml';
    const grafana_dashboard_configmaps_yamls_as_JSO_array: JSON[] = read_yaml_file_as_array_of_javascript_objects(grafana_dashboard_configmaps_yaml_file);
    //Apply YAML Manifests
    const grafana_dashboard_configmaps = new eks.KubernetesManifest(stack, "victoria-logs-grafana-dashboards", {
        cluster: cluster,
        manifest: grafana_dashboard_configmaps_yamls_as_JSO_array,
        overwrite: true,
        prune: true,
    });
    grafana_dashboard_configmaps.node.addDependency(observability_namespace);
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

} //end deploy_vm_logs_custom_stack()
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
