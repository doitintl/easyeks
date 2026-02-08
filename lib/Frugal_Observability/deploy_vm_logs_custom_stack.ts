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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const kubernetes_event_exporter_helm_values_as_yaml = `
global:
  security:
    allowInsecureImages: true #Read as allow non-bitnami images
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
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const vector_as_a_log_collection_agent_helm_values_as_yaml = `
role: Agent     #<--deploys vector as a kubernetes daemonset & uses hostPath for ephemeral filesystem.
logLevel: "info"
image:
  base: distroless-libc
# ^-- Explanation of what image.base options does:
# alpine          --use the following image--> 0.38.0-alpine
# distroless-libc --use the following image--> 0.38.0-distroless-libc
# Notes: 
# * 0.38.0 is used as an explicit example, but it's real value would be the default image version associated with the helm chart version
# * distroless-libc is better in terms of performance and security, recommend to use it after figuring out an ideal config.
# * alpine is useful if you need to debug config, as it allows exec'ing into the pod
#   Note installing apps is a bit tricky in their alpine image, so here's an example of how to install additional tools
#   * kubect exec -it pod/observability-aggregator-vector-0 -n=observability -- /bin/ash
#     Pod's Alpine Shell:
#     * apk update --no-check-certificate --allow-untrusted
#     * apk add --no-cache --no-check-certificate --allow-untrusted netcat-openbsd
#     * nc -6 -w 1 -v -z observability-aggregator-vector.observability 6443
#     * apk add --no-cache --no-check-certificate --allow-untrusted curl
#     * curl observability-aggregator-vector.observability:8686/health 
rollWorkloadSecrets: true
podPriorityClassName: "system-node-critical" #ensures daemonset is schedulable even on small nodes
resources:
  limits:
    memory: 4Gi
  requests:
    cpu: 10m
    memory: 32Mi
env:
- name: KUBERNETES_SERVICE_HOST
  value: "kubernetes.default.svc"   #<--IPv6 fix documented in https://github.com/vectordotdev/vector/issues/19224
containerPorts:
- containerPort: 8686   #<--graphql endpoint. Enabled by customConfig.api.enabled: true & address: [::]:8686
  name: api             #   Usage: kubectl exec -it daemonset/observability-agent-vector -n=observability -- vector top -H
  protocol: TCP         #   ^-- shows a metric dashboard
service:
  ports:
  - name: api
    port: 8686
    protocol: TCP
serviceHeadless:
  ports:
  - name: api
    port: 8686
    protocol: TCP
customConfig:
  acknowledgements:  #<--(durable delivery of data) means: send data, ask server to verify/acknowledge successful delivery, retry upon failure.
    enabled: true    #Note it's often not supported,  but it'll be enabled for sinks where it is supported.
  api:
    enabled: true
    address: "[::]:8686"  #<-- triggers listening on port 8686, accessible from the IPv6 equivalent of 0.0.0.0 (any source IP)
    playground: false
  data_dir: /vector-data-dir
  sources:
    container_logs:
      type: kubernetes_logs  #(<-- logs of containers of kubernetes pods)
      glob_minimum_cooldown_ms: 1000
  transforms:
    subset_of_logs:
      type: "route"
      reroute_unmatched: false
      inputs: 
      - container_logs
      route: #v-- Pattern is log_name: 'VRLcondition' (https://vector.dev/docs/reference/vrl/#example-filtering-events)
        kubernetes_event_exporter_container_logs: ' .source_type == "kubernetes_logs" && .kubernetes.pod_labels."app.kubernetes.io/name" == "kubernetes-event-exporter" '     #<-- now "subset_of_logs.kubernetes_event_exporter_container_logs" is a recognized input
        kube_container_logs: ' .source_type == "kubernetes_logs" && .kubernetes.pod_labels."app.kubernetes.io/name" != "kubernetes-event-exporter" ' #<-- now "subset_of_logs.kube_container_logs" is a recognized input
    kube_event_logs:
      type: "remap"
      inputs: [ subset_of_logs.kubernetes_event_exporter_container_logs ]
      # v-- source represents an embedded multi-line text file / HEREDOC of vector remap language syntax
      source: |
        . = parse_json!(.message) #<-- extract contents of json log embedded in .message, and transfer it's contents into the root of a new json log entry
    conventionalized_kube_event_logs:
      type: "remap"
      inputs: [ kube_event_logs ]
      source: |
        # v-- Thanks to this "log_source: kubernetes_event_logs" becomes a working query for Victoria Logs
        .log_source = "kubernetes_event_logs"
        # v-- UX improvements
        .cluster_name = "${config.cluster_name}"
        .cluster_region = "${config.cluster_region}"
        .event_type = del(.type) #<-- effectively renames the key "type" to "event_type"
        .event_reason = del(.reason) #<-- effectively renames the key "reason" to "event_reason"
        if ( exists(.involvedObject.namespace) ) {
            .event_ns = del(.involvedObject.namespace) #<-- effectively renames the key "involvedObject.namespace" to "event_ns"
        } else {
            .event_ns = "none" #<-- force existance of key, so it can be used as Victoria Log Stream Entry
        }   #^v-- shortening name of keys used as log streams, for UX reasons (looks nicer in GUI)
        .obj_kind = del(.involvedObject.kind) #<-- effectively renames the key "involvedObject.kind" to "obj_kind"
        # v-- Cleaning up duplicate info & useless noise
        del(.source_type)
        del(.involvedObject.resourceVersion)
        del(.involvedObject.uid)
        del(.involvedObject.ownerReferences)
        del(.involvedObject.deleted)
        del(.metadata)
        del(.source)
    conventionalized_kube_container_logs:
      type: "remap"
      inputs: [ "subset_of_logs.kube_container_logs" ]
      source: |
        # v-- Thanks to this "log_source: kubernetes_container_logs" becomes a working query for Victoria Logs  
        .log_source = "kubernetes_container_logs"
        # v-- UX improvements
        .cluster_name = "${config.cluster_name}"
        .cluster_region = "${config.cluster_region}"
        #v-- shortening name of keys used as log streams, for UX reasons (looks nicer in GUI)
        .container = del(.kubernetes.container_name) #<-- effectively renames the key "kubernetes.container_name" to "container"
        .ns = del(.kubernetes.pod_namespace) #<-- effectively renames the key "kubernetes.pod_namespace" to "ns"
        # v-- Cleaning up duplicate info & useless noise
        del(.source_type)
        del(.file)
        del(.kubernetes.container_id)
        del(.kubernetes.namespace_labels)
        del(.kubernetes.node_labels."k8s.io/cloud-provider-aws")
        del(.kubernetes.node_labels."karpenter.sh/do-not-sync-taints")
        del(.kubernetes.node_labels."beta*")
        del(.kubernetes.node_labels."beta.kubernetes.io/arch")
        del(.kubernetes.node_labels."beta.kubernetes.io/instance-type") #<-- "'s are needed when referencing a key with /'s OR -'s
        del(.kubernetes.node_labels."beta.kubernetes.io/os")
        del(.kubernetes.node_labels."failure-domain.beta.kubernetes.io/region")
        del(.kubernetes.node_labels."failure-domain.beta.kubernetes.io/zone")
        del(.kubernetes.node_labels."topology.ebs.csi.aws.com/zone")
        del(.kubernetes.node_labels."kubernetes.io/os")
        del(.kubernetes.node_labels."kubernetes.io/hostname")
        del(.kubernetes.node_labels."karpenter.sh/initialized")
        del(.kubernetes.node_labels."karpenter.sh/registered")
        del(.kubernetes.node_labels."karpenter.k8s.aws/instance-hypervisor")
        del(.kubernetes.node_labels."karpenter.k8s.aws/instance-family")
        del(.kubernetes.node_labels."karpenter.k8s.aws/instance-generation")
        del(.kubernetes.node_labels."karpenter.k8s.aws/instance-size")
        del(.kubernetes.node_labels."karpenter.k8s.aws/instance-encryption-in-transit-supported")
        del(.kubernetes.node_labels."karpenter.k8s.aws/instance-category")
        del(.kubernetes.node_labels."eks.amazonaws.com/sourceLaunchTemplateVersion")
        del(.kubernetes.pod_ips)
        del(.kubernetes.pod_annotations."eks.amazonaws.com/timestamp")
        del(.kubernetes.pod_labels."controller-revision-hash")
        del(.kubernetes.pod_labels."pod-template-generation")
        del(.kubernetes.pod_labels."pod-template-hash")
        del(.kubernetes.pod_uid)
        # v-- Note: .kubernetes is purposefully temporarily added in front of a few things, to preserve them, when .kubernetes is later removed.
        .kubernetes.message = del(.message)
        .kubernetes.timestamp = del(.timestamp)
        .kubernetes.cluster_name = del(.cluster_name)
        .kubernetes.cluster_region = del(.cluster_region)
        .kubernetes.ns = del(.ns)
        .kubernetes.container = del(.container)
        .kubernetes.log_type = del(.stream)
        .kubernetes.log_source = del(.log_source)
        . = del(.kubernetes) #<-- remove kubernetes for UX as its redundant info
  sinks: #<--(sink = destination)
    victoria_logs_db_sink_for_conventionalized_kube_container_logs:
      endpoints:
      - http://vl-victoria-logs-single-server.observability.svc.cluster.local:9428/insert/elasticsearch/
      inputs: [ conventionalized_kube_container_logs ]  #<-- best to only send 1 input per vl_log_sink, so they can have diff VL-Stream-Field values
      type: elasticsearch   #<-- The Bulk API algorithm invented by elasticsearch is the most efficient option available
      api_version: v8
      compression: gzip
      mode: bulk
      healthcheck:
        enabled: false   #<-- recommended per VL's docs: https://docs.victoriametrics.com/victorialogs/data-ingestion/vector/
      request:  #<-- based on example config of 'helm show values oci://ghcr.io/victoriametrics/helm-charts/victoria-logs-single'
        headers: #v--Important: don't put spaces between these CSV values, or it'll cause a hidden error.
          VL-Time-Field: "timestamp"
          VL-Stream-Fields: "container,ns"  #<-- UX wise best to only have short names & 2 max (also only use keys with low cardinality) (query optimization)
          VL-Msg-Field: "message"
          AccountID: "0"
          ProjectID: "0"
    victoria_logs_db_sink_for_conventionalized_kube_event_logs:
      inputs: [ conventionalized_kube_event_logs ]  #<-- best to only send 1 input per vl_log_sink, so they can have diff VL-Stream-Field values
      type: elasticsearch   #<-- The Bulk API algorithm invented by elasticsearch is the most efficient option available
      api_version: v8
      compression: gzip
      mode: bulk
      endpoints:
      - http://vl-victoria-logs-single-server:9428/insert/elasticsearch/
      healthcheck:
        enabled: false   #<-- recommended per VL's docs: https://docs.victoriametrics.com/victorialogs/data-ingestion/vector/
      request:  #<-- based on example config of 'helm show values oci://ghcr.io/victoriametrics/helm-charts/victoria-logs-single'
        headers: #v--Important: don't put spaces between these CSV values, or it'll cause a hidden error.
          VL-Time-Field: "timestamp"
          VL-Stream-Fields: "obj_kind,event_ns"  #<-- UX wise best to only have short names & 2 max (also only use keys with low cardinality) (query optimization)
          VL-Msg-Field: "message"
          AccountID: "0"
          ProjectID: "0"
`;
    const vector_as_a_log_collection_agent_helm_values_as_JS_object: JSON = read_yaml_string_as_javascript_object(vector_as_a_log_collection_agent_helm_values_as_yaml);
    
    const vector_as_a_log_collection_agent_helm_release = new eks.HelmChart(stack, 'vector-observability-agent-daemonset-helm', {
        cluster: cluster,
        namespace: 'observability',
        repository: 'https://helm.vector.dev',
        chart: 'vector',
        release: 'log-collection-agent',
        version: '0.49.0', //version of helm chart (0.49.0, maps to app version 0.52.0-distroless-libc)
        // helm repo add vector https://helm.vector.dev
        // helm repo update vector
        // helm search repo vector
        // helm show values vector/vector       <-- can be run to show all possible values
        // helm get values log-collection-agent  <-- can be run to see the yaml equivalent the the below values. (potentially easier to read)
        values: vector_as_a_log_collection_agent_helm_values_as_JS_object,
    });
    vector_as_a_log_collection_agent_helm_release.node.addDependency(observability_namespace);
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    const victoria_logs_helm_release = new eks.HelmChart(stack, 'victoria-logs-db-helm', {
        cluster: cluster,
        namespace: 'observability',
        repository: "https://victoriametrics.github.io/helm-charts/",
        chart: "victoria-logs-single",
        release: 'vl',
        version: "0.11.24", //version of helm chart (v0.11.15, maps to app version 1.43.1)
        // helm repo add vm https://victoriametrics.github.io/helm-charts/
        // helm repo update vm
        // helm search repo vm
        // helm show values vm/victoria-logs-single
        values: {
            "server": {
                //v--PURPOSEFULLY not using pod level HTTPS, because it breaks kubectl port-forward
                // "extraVolumes": [{
                //     "name": "https-cert",
                //     "secret": {
                //         "secretName": "https-cert-for-vl-victoria-logs-single-server" //generated by cert-manager
                //     },
                // }],
                // "extraVolumeMounts": [{
                //     "name": "https-cert",
                //     "mountPath": "/etc/ssl/certs",
                //     "readOnly": true,
                // }],
                // "service": {
                //     "servicePort": "9443", //unencrypted default is 9428
                //     "targetPort": "9443",
                // },
                "extraArgs": { //https://docs.victoriametrics.com/victorialogs/#list-of-command-line-flags
                    "httpListenAddr": ":9428",
                    "tls": "false", //tls: true, breaks kubectl port-forward
                    //"tlsCertFile": "/etc/ssl/certs/tls.crt",
                    //"tlsKeyFile": "/etc/ssl/certs/tls.key",
                    "enableTCP6": `${config.ipMode === eks.IpFamily.IP_V6}`, //evaluates to true using default config, which enables application level IPv6 support.
                },  //^-- This is required for readiness and liveness probes to work correctly in IPv6 environments.
                "retentionPeriod": "31d", //(Possible units character: h(ours), d(ays), w(eeks), m(onths), y(ears))
                "persistentVolume": {
                    "size": "20Gi" //<--Recommendation: Never change this value (will error) & leave 20Gi as default, when you want to size up don't do so using declarative helm values
                },                 //   resize up using the following 2 imperative kubectl command, against pre-existing pvc object.
                                   //   kubectl -n=observability patch pvc server-volume-vl-victoria-logs-single-server-0 --patch '{ "spec": { "resources": { "requests": { "storage": "21Gi"} } } }'
                                   //   kubectl -n=observability rollout restart sts/vl-victoria-logs-single-server
                                   //   (pvc resize will complete after pod restarts)
                                   //   (Reason for recommendation is you can scale up but you can't scale down. + editing value will result in errors)
                "resources": {     
                    "requests": {
                        "cpu": "100m",
                        "memory": "128Mi",
                    },
                    "limits": {
                        "memory": "4Gi",
                    },
                },
                "serviceMonitor": {
                    "enabled": true //<-- deploys config snippet, vm-operator uses to configure collection of metrics, used by "VictoriaLogs - single-node" Grafana Dashboard.
                }, //^-- Note: If you run kubectl get vmservicescrape, and don't see a matching vmservicescrape spawned from the servicemonitor, then reboot victoria-metrics-operator
            },
        },//end helm values
        //Command to verify config:
        //* helm get values vl -n=observability
        //Access Proxy Command:
        //* kubectl port-forward service/vl-victoria-logs-single-server -n=observability 9428:9428
        //Browser Access:
        //* http://localhost:9428/select/vmui/
    });
    // Imperative installation order to avoid temporary errors in logs
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
/* Docs
* https://vector.dev/docs/reference/configuration/
* https://github.com/vectordotdev/helm-charts/blob/vector-0.49.0/charts/vector/values.yaml
* https://docs.victoriametrics.com/helm/victoria-logs-single/
*/

/* Commands to verify config:
* helm get values log-collection-agent -n=observability
* helm get values vl -n=observability
Access Proxy Command:
* kubectl port-forward service/vl-victoria-logs-single-server -n=observability 9428:9428
Browser Access:
http://localhost:9428/select/vmui/
*///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
