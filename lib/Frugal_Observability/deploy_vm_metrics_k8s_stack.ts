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
export function deploy_vm_metrics_k8s_stack(stack: cdk.Stack, cluster: eks.ICluster, config: Easy_EKS_Config_Data, observability_namespace: eks.KubernetesManifest){
//daemonset vmks-prometheus-node-exporter -> generates node metrics in prometheus format
//deployment vmks-kube-state-metrics -> generates kubernetes metrics in prometheus format
//deployment vmagent-vmks-victoria-metrics-k8s-stack -> auto-configured to scrape both and send to vm-metrics-db
//stateful deployment vmsingle-vmks-victoria-metrics-k8s-stack -> stores metrics
//grafana deployment vmks-grafana -> acts as a dashboard to show metrics stored in victoria metrics & and alternative dashboard for victoria logs

const grafana_admin_login_kube_secret_as_yaml = `
apiVersion: v1
kind: Secret
metadata:
  name: grafana-admin-basic-auth
  namespace: observability
type: kubernetes.io/basic-auth
stringData: #v-- placerholder values for testing
  username: admin    # username is a required field/label_name for secrets of type kubernetes.io/basic-auth
  password: password # password is a required field/label_name for secrets of type kubernetes.io/basic-auth
`;
    const grafana_admin_login_kube_secret_as_JS_object: JSON = read_yaml_string_as_javascript_object(grafana_admin_login_kube_secret_as_yaml);
    const grafana_admin_login_kube_secret = new eks.KubernetesManifest(stack, "grafana-admin-login-kube-secret", {
        cluster: cluster,
        manifest: [ grafana_admin_login_kube_secret_as_JS_object ],
        overwrite: true,
        prune: true,
    });
    grafana_admin_login_kube_secret.node.addDependency(observability_namespace);

const vmks_helm_values_as_yaml = `
victoria-metrics-operator:
  enabled: true
  env:
  - name: "VM_ENABLETCP6" #<-- adds necessary IPv6 compatibility flags to all resources managed by vm operator
    value: "true"
  extraArgs:
    controller.prometheusCRD.resyncPeriod: 1m  #(Makes prom to vm CR conversion more reliable)
  resources:
    requests:
      cpu: 2m
      memory: 42Mi
    limits:
      memory: 1Gi
kube-state-metrics: # https://github.com/prometheus-community/helm-charts/blob/main/charts/kube-state-metrics/values.yaml
  enabled: true # <--deploys as a dependency/nested/child helm chart, such that all ^-original values-^ file's values are indented by 2
  resources:
    requests:
      cpu: 10m
      memory: 20Mi
    limits:
      memory: 256Mi
  nodeSelector:
    karpenter.sh/capacity-type: "on-demand" #<-- Valid values are "spot", "on-demand", and "reserved"
prometheus-node-exporter: # https://github.com/prometheus-community/helm-charts/blob/main/charts/prometheus-node-exporter/values.yaml
  enabled: true # <--deploys as a dependency/nested/child helm chart, such that all ^-original values-^ file's values are indented by 2
  priorityClassName: "system-node-critical" #ensures daemonset is schedulable even on small nodes
  resources:
    requests:
      cpu: 10m
      memory: 20Mi
    limits:
      memory: 256Mi
vmagent:        # kubectl get vmagent -n=observability
  enabled: true # <--creates a kube custom resource of type vmagent (that vm-operator will convert to vmagent deployment)
  spec:
    resources:
      requests:
        cpu: 50m
        memory: 100Mi
      limits:
        memory: 500Mi
    nodeSelector:
      karpenter.sh/capacity-type: "on-demand" #<-- Valid values are "spot", "on-demand", and "reserved"
vmsingle:       # kubectl get vmsingle -n=observability
  enabled: true # <--creates a kube custom resource of type vmsingle (that vm-operator will convert to vmsingle deployment)
  spec:
    resources:
      requests:
        cpu: 50m
        memory: 400Mi
      limits:
        memory: 1600Mi
    storage:
      resources:
        requests:
          storage: 20Gi
    nodeSelector:
      karpenter.sh/capacity-type: "on-demand" #<-- Valid values are "spot", "on-demand", and "reserved"
defaultDashboards: #<-- deploys ConfigMaps containing dashboards as JSON, that grafana sidecar will auto load / auto import as IaC Managed Dashboards
  enabled: true
  dashboards: #v-- disabling 3 that don't work with EKS due to managed ctrl plane, to remove 3 empty dashboards
    etcd:
      enabled: false
    kubernetes-controller-manager:
      enabled: false
    kubernetes-scheduler:
      enabled: false
    grafana-overview:
      enabled: false #<-- not useful
    kubernetes-kubelet:
      enabled: true
    kubernetes-system-api-server:
      enabled: true
    kubernetes-system-coredns:
      enabled: true
    kubernetes-views-global:
      enabled: true
    kubernetes-views-namespaces:
      enabled: true
    kubernetes-views-nodes:
      enabled: true
    kubernetes-views-pods:
      enabled: true
    node-exporter-full:
      enabled: true
    victoriametrics-operator:
      enabled: true
    victoriametrics-single-node:
      enabled: true
    victoriametrics-vmagent:
      enabled: true
    victoriametrics-vmalert:
      enabled: true
grafana:        # https://github.com/grafana/helm-charts/blob/main/charts/grafana/values.yaml
  enabled: true # <--deploys as a dependency/nested/child helm chart, such that all ^-original values file values are indented by 2
  nodeSelector:
    karpenter.sh/capacity-type: "on-demand" #<-- Valid values are "spot", "on-demand", and "reserved"
  sidecar:
    dashboards:
      enabled: true  # <-- enable sidecar that auto loads grafana dashboards as code embedded as json in configmaps
      label: grafana_dashboard
      labelValue: "1" # auto load dashboards stored in configmaps with kubernetes label matching this key value pair
    resources: # (of grafana's config reloader sidecar container)
      requests:
        cpu: 10m
        memory: 128Mi
      limits:
        memory: 512Mi
  resources: # (of grafana's main container)
    requests:
      cpu: 100m
      memory: 300Mi
    limits:
      memory: 1024Mi
  admin:
    existingSecret: "grafana-admin-basic-auth"
    userKey: "username" #(reads value of specified key existing in a kubernetes secret)
    passwordKey: "password" #(reads value of specified key existing in a kubernetes secret)
  grafana.ini:
    auth.anonymous:
      enabled: true 
      org_name: "Main Org." #<-- default org
      org_role: "Viewer" #<-- kube forward users default to viewer access & can login for admin edit access
    unified_alerting: #<-- Grafana has a built in alert manager, disabling to avoid confusion & enforce IaC based alerts
      enabled: false  #<-- Use vmalert instead
    plugins: #Plugin names based on URL paths on this page https://grafana.com/grafana/plugins/all-plugins/
      disable_plugins: "grafana-lokiexplore-app,grafana-exploretraces-app,grafana-pyroscope-app" #<-- Disabled to remove distractions, reenable if needed
      # grafana-lokiexplore-app = Drilldown/Logs (option in the GUI)
      # grafana-exploretraces-app = Drilldown/Traces (option in the GUI)
      # grafana-pyroscope-app = Drilldown/Profiles (option in the GUI)
  plugins:
  - victoriametrics-logs-datasource
  # - victoriametrics-metrics-datasource #<--intentionally commented out, in favor if built in prometheus data source
  # Plugin Name Lookup instructions
  # Step 1: Find Plugin https://grafana.com/grafana/plugins/all-plugins/
  # Step 2: https://grafana.com/grafana/plugins/victoriametrics-logs-datasource/?tab=installation
  # Step 3: Find plugin name from url path or on the pabe
  datasources:
    datasources.yaml:
      apiVersion: 1
      datasources:
      # - name: VictoriaMetrics  #(could potentially useful for custom dashboard, supports a few additional Victoria Metric specific Queries)
      #   type: victoriametrics-metrics-datasource
      #   access: proxy
      #   url: http://vmsingle-vmks-victoria-metrics-k8s-stack.observability.svc.cluster.local:8428
      #   isDefault: false
      # For better compatibility with pre-existing dashboards, victoria metrics backend is loaded as type Prometheus
      - name: VictoriaMetrics #(Recommended for compatibility with pre-existing open source community developed dashboards)
        type: prometheus
        access: proxy
        url: http://vmsingle-vmks-victoria-metrics-k8s-stack.observability.svc.cluster.local.:8428
        isDefault: false
      - name: VictoriaLogs
        type: victoriametrics-logs-datasource
        access: proxy
        url: http://vl-victoria-logs-single-server.observability.svc.cluster.local.:9428
        isDefault: false
##########################################################################################
# v-- I'll turn these on later
alertmanager:
  enabled: false
vmalert:
  enabled: false
`;
    const vmks_helm_values_as_JS_object: JSON = read_yaml_string_as_javascript_object(vmks_helm_values_as_yaml);
    const vmks_helm_release = new eks.HelmChart(stack, 'victoria-metrics-k8s-stack-helm', {
        cluster: cluster,
        namespace: 'observability',
        repository: 'https://victoriametrics.github.io/helm-charts',
        chart: 'victoria-metrics-k8s-stack',
        release: 'vmks',
        version: '0.67.0', //version of helm chart
        // helm repo add vm https://victoriametrics.github.io/helm-charts
        // helm repo update vm
        // helm search repo vm | egrep "NAME|victoria-metrics-k8s-stack"
        // helm show values vm/victoria-metrics-k8s-stack
        // https://github.com/VictoriaMetrics/helm-charts/tree/master/charts
        values: vmks_helm_values_as_JS_object,
    });
    vmks_helm_release.node.addDependency(observability_namespace); // <-- Imperative installation order to avoid temporary errors in logs
    //kubectl port-forward svc/vmks-grafana -n=observability 3000:80
    //Browser:   localhost:3000


} //end deploy_vm_metrics_k8s_stack()
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/* 
Docs:
* https://docs.victoriametrics.com/helm/victoria-metrics-k8s-stack/

Commands to verify config:
* helm get values vmks -n=observability

Access Proxy Command:
* kubectl port-forward service/grafana -n=observability 3000:80

Browser Access:
* http://localhost:3000
*///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
