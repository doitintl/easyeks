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
export function deploy_vm_logs_custom_stack(stack: cdk.Stack, cluster: eks.ICluster, config: Easy_EKS_Config_Data, observability_namespace: eks.KubernetesManifest){

// const grafana_admin_login_kube_secret_as_yaml = `
// apiVersion: v1
// kind: Secret
// metadata:
//   name: grafana-admin-basic-auth
//   namespace: observability
// type: kubernetes.io/basic-auth
// stringData: #v-- placerholder values for testing
//   username: admin    # required field for kubernetes.io/basic-auth
//   password: password # required field for kubernetes.io/basic-auth
// `;
//     const grafana_admin_login_kube_secret_as_JS_object: JSON = read_yaml_string_as_javascript_object(grafana_admin_login_kube_secret_as_yaml);
//     const grafana_admin_login_kube_secret = new eks.KubernetesManifest(stack, "grafana-admin-login-kube-secret", {
//         cluster: cluster,
//         manifest: [ grafana_admin_login_kube_secret_as_JS_object ],
//         overwrite: true,
//         prune: true,
//     });
//     grafana_admin_login_kube_secret.node.addDependency(observability_namespace);

// const grafana_helm_values_as_yaml = `
// nodeSelector:
//   karpenter.sh/capacity-type: "on-demand" #<-- Valid values are "spot", "on-demand", and "reserved"
// resources: # (of grafana's main container)
//   requests:
//     cpu: 100m
//     memory: 400Mi
//   limits:
//     memory: 1024Mi
// admin:
//   existingSecret: "grafana-admin-basic-auth"
//   userKey: "username" #(reads value of specified key existing in a kubernetes secret)
//   passwordKey: "password" #(reads value of specified key existing in a kubernetes secret)
// grafana.ini:
//   auth.anonymous:
//     enabled: true 
//     org_name: "Main Org." #<-- default org
//     org_role: "Viewer" #<-- kube forward users default to viewer access & can login for admin edit access
// plugins:
// - victoriametrics-metrics-datasource
// - victoriametrics-logs-datasource
// # Plugin Name Lookup instructions
// # Step 1: Find Plugin https://grafana.com/grafana/plugins/all-plugins/
// # Step 2: https://grafana.com/grafana/plugins/victoriametrics-logs-datasource/?tab=installation
// # Step 3: Find plugin name from url path or on the pabe
// datasources:
//   datasources.yaml:
//     apiVersion: 1
//     datasources:
//     - name: Prometheus  #(Recommended for compatibility with pre-existing open source community developed dashboards)
//       type: prometheus
//       access: proxy
//       url: http://vm-victoria-metrics-single-server.observability.svc.cluster.local:8428
//       isDefault: true
// #    - name: VictoriaMetrics  #(could potentially useful for custom dashboard, supports a few additional Victoria Metric specific Queries)
// #      type: victoriametrics-metrics-datasource
// #      access: proxy
// #      url: http://vm-victoria-metrics-single-server.observability.svc.cluster.local:8428
// #      isDefault: false
//     - name: VictoriaLogs
//       type: victoriametrics-logs-datasource
//       access: proxy
//       url: http://vl-victoria-logs-single-server.observability.svc.cluster.local:9428
//       isDefault: false
// sidecar:
//   resources:
//     requests:
//       cpu: 10m
//       memory: 128Mi
//     limits:
//       memory: 512Mi
//   dashboards:
//     enabled: true #enable sidecar that auto loads grafana dashboards as code embedded as json in configmaps
//     label: grafana_dashboard
//     labelValue: "auto_loaded_by_grafana_sidecar_container"
// `;
//     const grafana_helm_values_as_JS_object: JSON = read_yaml_string_as_javascript_object(grafana_helm_values_as_yaml);
//     const grafana_dashboard_configmaps_yaml_file = './lib/Frugal_Observability/manifests/easy_eks_grafana_dashboard.configmaps.yaml';
//     const grafana_dashboard_configmaps_yamls_as_JSO_array: JSON[] = read_yaml_file_as_array_of_javascript_objects(grafana_dashboard_configmaps_yaml_file);
//     const grafana_dashboard_configmaps = new eks.KubernetesManifest(stack, "grafana-dashboards-in-configmaps", {
//         cluster: cluster,
//         manifest: grafana_dashboard_configmaps_yamls_as_JSO_array,
//         overwrite: true,
//         prune: true,
//     });
//     grafana_admin_login_kube_secret.node.addDependency(observability_namespace);

//     const grafana_dashboard_helm_release = new eks.HelmChart(stack, 'grafana-dashboard-helm', {
//         cluster: cluster,
//         namespace: 'observability',
//         repository: 'https://grafana.github.io/helm-charts',
//         chart: 'grafana',
//         release: 'grafana',
//         version: '10.3.0', //version of helm chart (v10.3.0, maps to app version 12.3.0)
//         // helm repo add grafana https://grafana.github.io/helm-charts
//         // helm repo update grafana
//         // helm search repo grafana
//         values: grafana_helm_values_as_JS_object,
//     });
//     // Imperative installation order to avoid temporary errors in logs
//     grafana_dashboard_helm_release.node.addDependency(observability_namespace);

} //end deploy_grafana_dashboard()
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/* Docs
https://artifacthub.io/packages/helm/grafana/grafana
https://github.com/grafana/helm-charts/blob/grafana-10.3.0/charts/grafana/values.yaml
https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/
*/

/* Commands to verify config:
* helm get values grafana -n=observability
Access Proxy Command:
* kubectl port-forward service/grafana -n=observability 3000:80
Browser Access:
http://localhost:3000
*///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
