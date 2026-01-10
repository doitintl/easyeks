import { Easy_EKS_Config_Data } from '../Easy_EKS_Config_Data';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import { Construct } from "constructs";
import * as fs from 'fs'; //node.js built in file system module
import * as yaml from 'js-yaml'; //npm install js-yaml && npm install --save-dev @types/js-yaml
import { read_yaml_string_as_javascript_object, read_yaml_file_as_javascript_object, read_yaml_file_as_array_of_javascript_objects } from '../Utilities';
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function deploy_kubernetes_event_logs_exporter(stack: cdk.Stack, cluster: eks.ICluster, config: Easy_EKS_Config_Data, observability_namespace: eks.KubernetesManifest){

const kubernetes_event_exporter_helm_values_as_yaml = `
global:
  security:
    allowInsecureImages: true
image:
  registry: ghcr.io
  repository: resmoio/kubernetes-event-exporter
  tag: latest
resources:
  requests:
    cpu: 25m
    memory: 128Mi
  limits:
    memory: 512Mi
config:
  logLevel: error
  logFormat: json
  kubeQPS: 200      #queries per second should be 1/5th of burst
  kubeBurst: 1000   #recommended to match expected max events per minute
  maxEventAgeSeconds: 60 
  route:
    routes:
    - match:
      - receiver: "vector_agent"
  receivers:
  - name: "vector_agent"
    stdout:
      deDot: false
`;

    const kubernetes_event_exporter_helm_values_as_JS_object: JSON = read_yaml_string_as_javascript_object(kubernetes_event_exporter_helm_values_as_yaml);
    
    const kubernetes_event_exporter_helm_release = new eks.HelmChart(stack, 'kubernetes-event-exporter-helm', {
        cluster: cluster,
        namespace: 'observability',
        repository: 'https://charts.bitnami.com/bitnami',
        chart: 'kubernetes-event-exporter',
        release: 'kubernetes-event-exporter',
        version: '3.6.3', //version of helm chart (3.6.3, maps to app version 1.7.0)
        // helm repo add bitnami https://charts.bitnami.com/bitnami
        // helm repo update bitnami
        // helm search repo bitnami | egrep "NAME|kubernetes-event-exporter"  <-- can be used to see latest chart
        // helm show values bitnami/kubernetes-event-exporter  <-- can be run to show all possible values
        // helm get values kubernetes-event-exporter -n=observability  <-- can be run to see the yaml equivalent the the below values. (potentially easier to read)
        values: kubernetes_event_exporter_helm_values_as_JS_object,
    });

    kubernetes_event_exporter_helm_release.node.addDependency(observability_namespace);

} //end deploy_kubernetes_event_logs_exporter()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
