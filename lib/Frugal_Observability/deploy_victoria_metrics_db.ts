import { Easy_EKS_Config_Data } from '../Easy_EKS_Config_Data';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import { Construct } from "constructs";
import * as fs from 'fs'; //node.js built in file system module
import * as yaml from 'js-yaml'; //npm install js-yaml && npm install --save-dev @types/js-yaml
import { read_yaml_string_as_javascript_object, read_yaml_file_as_javascript_object, read_yaml_file_as_array_of_javascript_objects } from '../Utilities';
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function deploy_victoria_metrics_db(stack: cdk.Stack, cluster: eks.ICluster, config: Easy_EKS_Config_Data, observability_namespace: eks.KubernetesManifest){

// v-- docs https://github.com/VictoriaMetrics/helm-charts/blob/victoria-metrics-single-0.26.0/charts/victoria-metrics-single/values.yaml
const victoria_metrics_helm_values_as_yaml = `
server:
  nodeSelector:
    karpenter.sh/capacity-type: "on-demand" #<-- Valid values are "spot", "on-demand", and "reserved"
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      memory: 2048Mi
  extraArgs:
    enableTCP6: true #<-- essential for IPv6 / dual stack cluster
  serviceMonitor:
    enabled: false #Can be enabled for compatibility, avoiding in favor of a better happy path
  persistentVolume:
    size: 10Gi #<--Recommendation: Never change this value & leave 10Gi as default, when you want to size up don't do so using declarative helm values
               #   resize up using the following 2 imperative kubectl commands, against pre-existing pvc object.
               #   kubectl -n=observability patch pvc server-volume-vm-victoria-metrics-single-server-0 --patch '{ "spec": { "resources": { "requests": { "storage": "11Gi"} } } }'
               #   kubectl -n=observability rollout restart sts/vm-victoria-metrics-single-server
               #   (pvc resize will complete after pod restarts)
`;
    const victoria_metrics_helm_values_as_JS_object: JSON = read_yaml_string_as_javascript_object(victoria_metrics_helm_values_as_yaml);

    const victoria_metrics_helm_release = new eks.HelmChart(stack, 'victoria-metrics-db-helm', {
        cluster: cluster,
        namespace: 'observability',
        repository: "https://victoriametrics.github.io/helm-charts/",
        chart: "victoria-metrics-single",
        release: 'vm',
        version: "0.26.0", //version of helm chart (0.26.0, maps to app version 1.131.0)
        // helm repo add vm https://victoriametrics.github.io/helm-charts/
        // helm repo update vm
        // helm search repo vm
        values: victoria_metrics_helm_values_as_JS_object,
        //Command to verify config:
        //* helm get values vm -n=observability
        //Access Proxy Command:
        //* kubectl port-forward service/vm-victoria-metrics-single-server -n=observability 8428:8428
        //Browser Access:
        //* http://localhost:8428/vmui/
        //  http://localhost:8428/vmui/#/cardinality
        //  ^-- can be used to verifiy metrics received from vector via remote_write instead of scrape jobs
    });
    // Imperative installation order to avoid temporary errors in logs
    victoria_metrics_helm_release.node.addDependency(observability_namespace);

} //end deploy_victoria_logs_db()
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
