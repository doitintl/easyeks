import { Easy_EKS_Config_Data } from '../Easy_EKS_Config_Data';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import { Construct } from "constructs";
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as fs from 'fs'; //node.js built in file system module
import * as yaml from 'js-yaml'; //npm install js-yaml && npm install --save-dev @types/js-yaml
import { read_yaml_string_as_javascript_object, read_yaml_file_as_javascript_object, read_yaml_file_as_array_of_javascript_objects } from '../../lib/Utilities';
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
export interface Victoria_Logs_Single_Node_Input_Parameters {
    enabled: boolean;
}
export interface Vector_Observability_Agent_Input_Parameters {
    enabled: boolean;
}
export interface Victoria_Metrics_Single_Node_Input_Parameters {
    enabled: boolean;
}
export interface Grafana_Dashboard_Input_Parameters {
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
    logs_db_input_parameters: Victoria_Logs_Single_Node_Input_Parameters;
    observability_agent_input_parameters: Vector_Observability_Agent_Input_Parameters;
    metrics_db_input_parameters: Victoria_Metrics_Single_Node_Input_Parameters;
    dashboard_input_parameters: Grafana_Dashboard_Input_Parameters;


    //Class Constructor:
    constructor(stack: cdk.Stack, cluster: eks.ICluster){
        this.stack = stack;
        this.cluster = cluster;
    }//end of Frugal_Observability class' constructor


    set_input_parameters_of_logs_db(input: Victoria_Logs_Single_Node_Input_Parameters){
        this.logs_db_input_parameters = input;
    }
    set_input_parameters_of_observability_agent(input: Vector_Observability_Agent_Input_Parameters){
        this.observability_agent_input_parameters = input;
    }
    deploy_configured_Frugal_Observability_Stack(config: Easy_EKS_Config_Data){
        this.observability_ns = new eks.KubernetesManifest(this.stack, "observability-kube-namespace", {
            cluster: this.cluster,
            manifest: [this.observability_ns_manifest],
            overwrite: true,
            prune: true,
        });
        this.observability_ns.node.addDependency(config.aws_load_balancer_controller_helm_chart_essentials_dependency);
        //^-- fixes race condition
        if(this.logs_db_input_parameters.enabled === true){ this.deploy_victoria_logs_db(config); }
        if(this.observability_agent_input_parameters.enabled === true){ this.deploy_vector_observability_agents(config); }
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    deploy_victoria_logs_db(config: Easy_EKS_Config_Data){
        const victoria_logs_helm_release = new eks.HelmChart(this.stack, 'victoria-logs-db-helm', {
            cluster: this.cluster,
            namespace: this.observability_ns_manifest.metadata.name,
            repository: "https://victoriametrics.github.io/helm-charts/",
            chart: "victoria-logs-single",
            release: 'vl',
            version: "0.11.15", //version of helm chart (v0.11.15, maps to app version 1.36.1)
            // helm repo add vm https://victoriametrics.github.io/helm-charts/
            // helm repo update vm
            // helm search repo vm
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
                        "enableTCP6": `${config.ipMode === eks.IpFamily.IP_V6}`, //defaults to true, which enables application level IPv6 support.
                    },  //^-- This is required for readiness and liveness probes to work correctly in IPv6 environments.
                    "retentionPeriod": "30d",
                    "persistentVolume": {
                        "size": "10Gi"
                    },
                    "resources": {
                        "requests": {
                            "cpu": "100m",
                            "memory": "128Mi",
                        },
                        "limits": {
                            "memory": "4Gi",
                        },
                    },
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
        victoria_logs_helm_release.node.addDependency(this.observability_ns);
    } //end deploy_victoria_logs_db()
    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    deploy_vector_observability_agents(config: Easy_EKS_Config_Data){
const vector_observability_agent_helm_values_as_yaml = `
role: Agent     #<--deploys vector as a kubernetes daemonset & uses hostPath for ephemeral filesystem.
logLevel: "info"
image:
  base: distroless-libc
rollWorkloadSecrets: true
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
- containerPort: 9090   #<--prometheus metric http endpoint. Enabled by customConfig.sinks.exporter.type = prometheus_exporter
  name: prom-exporter   #   Usage: kubectl port-forward svc/observability-agent-vector 9090:9090 -n=observability
  protocol: TCP         #   ^-- Browser: localhost:9090/metrics
service:
  ports:
  - name: api
    port: 8686
    protocol: TCP
  - name: prom-exporter
    port: 9090
    protocol: TCP
serviceHeadless:
  ports:
  - name: api
    port: 8686
    protocol: TCP
  - name: prom-exporter
    port: 9090
    protocol: TCP
extraVolumes:
- name: ca-of-https-cert
  secret:
    secretName: root-ca-for-frugal-observability-stack
extraVolumeMounts:
- name: ca-of-https-cert
  mountPath: /etc/ssl/certs/ca.crt 
  subPath: ca.crt #mounting a subset of the secret
  readOnly: true
customConfig:
  acknowledgements:  #<--(durable delivery of data) means: send data, ask server to verify/acknowledge successful delivery, retry upon failure.
    enabled: true    #Note it's often not supported,  but it'll be enabled for sinks where it is supported.
  api:
    enabled: true
    address: "[::]:8686"  #<-- triggers listening on port 8686, accessible from the IPv6 equivalent of 0.0.0.0 (any source IP)
    playground: false
  data_dir: /vector-data-dir
  sources:
    worker_node_metrics:
      type: host_metrics
      namespace: kube_worker_node_metrics
      filesystem:
        devices:
          excludes:
          - 'binfmt_misc'
        filesystems:
          excludes:
          - '[binfmt_misc]'
        mountpoints:
          excludes:
          - '*/proc/sys/fs/binfmt_misc'
    container_logs:
      type: kubernetes_logs  #(<-- logs of containers of kubernetes pods)
      glob_minimum_cooldown_ms: 1000
  sinks: #<--(sink = destination)
    prometheus_exporter:          #<-- You can test using kubectl port-forward -n=observability svc/observability-aggregator-vector 9090:9090
      type: prometheus_exporter   #    Then browser: http://localhost:9090/metrics
      address: "[::]:9090" #<-- triggers listening on port 9090
      inputs:
      - worker_node_metrics
    vector_aggregator:
      type: vector  #<--Uses efficient gRPC & End-to-End Ack (retry on fail) for data durability
      address: "https://observability-aggregator-vector.observability:6443"   #<--inner cluster dns name (generated by kube service)
      tls:
        enabled: true
        ca_file: /etc/ssl/certs/ca.crt
        server_name: observability-aggregator-vector.observability
        verify_hostname: true
        verify_certificate: true
      healthcheck:
        enabled: true
      compression: true
      buffer:        #Note: In theory statefulset aggregator hosted on spot nodes can reboot without losing observability data, thanks to buffer
      - type: disk                   #<--node local disk (via hostPath)
        max_size: ${2 * 1073741824}  #<--2 GiB
        when_full: drop_newest       #<--last resort
      inputs: #(to send to aggregator)
      - container_logs
      - worker_node_metrics
`;
const vector_observability_agent_helm_values_as_JS_object: JSON = read_yaml_string_as_javascript_object(vector_observability_agent_helm_values_as_yaml);

const vector_observability_aggregator_helm_values_as_yaml = `
role: Aggregator    #<--deploys vector as a kubernetes statefulset & uses PVC for buffering.
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
replicas: 1
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
- containerPort: 6443   #<--GRPC endpoint. (not a webserver) (grpc needs https)
  name: vector
  protocol: TCP
- containerPort: 8686   #<--graphql endpoint. Enabled by customConfig.api.enabled: true & address: [::]:8686
  name: api             #   Usage: kubectl exec -it pod/observability-aggregator-vector-0 -n=observability -- vector top -H
  protocol: TCP         #   ^-- shows a metric dashboard
- containerPort: 9090   #<--prometheus metric http endpoint. Enabled by customConfig.sinks.exporter.type = prometheus_exporter
  name: prom-exporter   #   Usage: kubectl port-forward svc/observability-aggregator-vector 9090:9090 -n=observability
  protocol: TCP         #   ^-- Browser: localhost:9090/metrics
service:
  ports:
  - name: vector
    port: 6443
    protocol: TCP
  - name: api
    port: 8686
    protocol: TCP
  - name: prom-exporter
    port: 9090
    protocol: TCP
serviceHeadless:
  ports:
  - name: vector
    port: 6443
    protocol: TCP
  - name: api
    port: 8686
    protocol: TCP
  - name: prom-exporter
    port: 9090
    protocol: TCP
extraVolumes:
- name: https-cert
  secret:
    secretName: https-cert-for-observability-aggregator-vector    #<--(contains: ca.crt, tls.crt, tls.key)
extraVolumeMounts:
- name: https-cert
  mountPath: /etc/ssl/certs
  readOnly: true
customConfig:
  acknowledgements:   #<--(durable delivery of data) means: send data, ask server to verify/acknowledge successful delivery, retry upon failure.
    enabled: true
  api:
    enabled: true
    address: "[::]:8686"  #<-- triggers listening on port 8686, accessible from the IPv6 equivalent of 0.0.0.0 (any source IP)
    playground: false
  data_dir: /vector-data-dir
  sources:
    vector_agents: #<-- source of container logs + worker node metrics
      type: vector
      version: "2"
      address: "[::]:6443"   #<-- triggers listening on port 6443 (from an IPv6 IP address)
      tls:
        enabled: true
        ca_file: /etc/ssl/certs/ca.crt
        crt_file: /etc/ssl/certs/tls.crt
        key_file: /etc/ssl/certs/tls.key
        server_name: observability-aggregator-vector.observability
        verify_certificate: false    #<-- (false = mTLS disabled) (client cert verification true = mTLS enabled)
        verify_hostname: true        #<-- true = only allow incoming traffic from dns names associated with https-cert
    vector_aggregator_generated_test_logs:
      type: demo_logs
      format: shuffle # randomly choose a line in the list
      lines:
      - "test log #1"
      - "test log #2"
      - "test log #3"
      interval: 10 #<-- generate 1 test log every 10 seconds
    vector_aggregator_generated_test_metrics:
      type: static_metrics
      namespace: vector_generated_test_metric
      interval_secs: 10  #<-- generate 1 test metric every 10 seconds
      metrics:
      - name: vector_aggregator_generated_test_metric
        kind: absolute
        value:
          gauge:
            value: 1
        tags:
          purpose: testing
  transforms:
    from_vector_agents:
      type: "route"
      inputs: [ "vector_agents" ]
      route:
        metrics: #<-- now "from_vector_agents.metrics" is a recognized input
          type: 'is_metric'
        logs:    #<-- now "from_vector_agents.logs" is a recognized input
          type: 'is_log'
        traces:  #<-- now "from_vector_agents.traces" is a recognized input
          type: 'is_trace'
      reroute_unmatched: false
    subset_of_metrics:
      type: "route"
      inputs: 
      - from_vector_agents.metrics
      - vector_aggregator_generated_test_metrics
      route: #v-- Pattern is log_name: 'VRLcondition' (https://vector.dev/docs/reference/vrl/#example-filtering-events)
        vector_aggregator_generated_test_metrics: '.namespace == "vector_generated_test_metric"'   #<-- now "subset_of_metrics.vector_aggregator_generated_test_metrics" is a recognized input
        kube_worker_node_metrics: '.namespace == "kube_worker_node_metrics"'                       #<-- now "subset_of_metrics.kube_worker_node_metrics" is a recognized input
    subset_of_logs:
      type: "route"
      reroute_unmatched: false
      inputs: 
      - from_vector_agents.logs
      - vector_aggregator_generated_test_logs
      route: #v-- Pattern is log_name: 'VRLcondition' (https://vector.dev/docs/reference/vrl/#example-filtering-events)
        vector_aggregator_generated_test_logs: '.source_type == "demo_logs"'   #<-- now "subset_of_logs.vector_aggregator_generated_test_logs" is a recognized input
        kubernetes_event_exporter_container_logs: ' .source_type == "kubernetes_logs" && .kubernetes.pod_labels."app.kubernetes.io/name" == "kubernetes-event-exporter" '     #<-- now "subset_of_logs.kubernetes_event_exporter_container_logs" is a recognized input
        kube_container_logs: ' .source_type == "kubernetes_logs" && .kubernetes.pod_labels."app.kubernetes.io/name" != "kubernetes-event-exporter" ' #<-- now "subset_of_logs.kube_container_logs" is a recognized input
    kube_event_logs:
      type: "remap"
      inputs: [ subset_of_logs.kubernetes_event_exporter_container_logs ]
      # v-- source represents an embedded multi-line text file / HEREDOC of vector remap language syntax
      source: |
        . = parse_json!(.message) #<-- extract contents of json log embedded in .message, and transfer it's contents into the root of a new json log entry
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
    conventionalized_vector_aggregator_generated_test_logs:
      type: "remap"
      inputs: [ "subset_of_logs.vector_aggregator_generated_test_logs" ]
      source: |-
        del(.source_type) # remove the following KV pair from the log entry, "source_type": "demo_logs"
        .log_source = "vector_generated_test_logs" #(effectively renamed the KV pair, to this new name)
        # ^-- Thanks to this "log_source: vector_generated_test_logs" becomes a working query for Victoria Logs
  sinks: #<--(sink = destination)
    prometheus_exporter:          #<-- You can test using kubectl port-forward -n=observability svc/observability-aggregator-vector 9090:9090
      type: prometheus_exporter   #    Then browser: http://localhost:9090/metrics
      address: "[::]:9090"  #<-- triggers listening on port 9090 (from an IPv6 IP address)
      inputs:
      - subset_of_metrics.kube_worker_node_metrics
    victoria_logs_db_sink_for_conventionalized_kube_container_logs:
      inputs: [ conventionalized_kube_container_logs ]  #<-- best to only send 1 input per vl_log_sink, so they can have diff VL-Stream-Field values
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
#    std_out: #<-- You can test using kubectl logs observability-aggregator-vector-0 -n=observability
#      type: "console"
#      inputs:
#      - conventionalized_vector_aggregator_generated_test_logs
#      - subset_of_metrics.vector_aggregator_generated_test_metrics
#      - conventionalized_kube_container_logs
#      encoding:
#        codec: "json"
`;
const vector_observability_aggregator_helm_values_as_JS_object: JSON = read_yaml_string_as_javascript_object(vector_observability_aggregator_helm_values_as_yaml);

        const vector_aggregator_cert_yaml_file = './lib/Frugal_Observability/manifests/certs_for_vector_observability_aggregator.yaml';
        const vector_aggregator_cert_yamls_as_JSO_array: JSON[] = read_yaml_file_as_array_of_javascript_objects(vector_aggregator_cert_yaml_file);
        const observability_certificates = new eks.KubernetesManifest(this.stack, "observability-certificates", {
            cluster: this.cluster,
            manifest: [ ...vector_aggregator_cert_yamls_as_JSO_array ],
            overwrite: true,
            prune: true,
        });
        observability_certificates.node.addDependency(this.observability_ns);



        const vector_observability_agent_helm_release = new eks.HelmChart(this.stack, 'vector-observability-agent-daemonset-helm', {
            cluster: this.cluster,
            namespace: this.observability_ns_manifest.metadata.name,
            repository: 'https://helm.vector.dev',
            chart: 'vector',
            release: 'observability-agent',
            version: '0.46.0', //version of helm chart (0.46.0, maps to app version 0.50.0-distroless-libc)
            // helm repo add vector https://helm.vector.dev
            // helm repo update vector
            // helm search repo vector
            // helm show values vector/vector       <-- can be run to show all possible values
            // helm get values observability-agent  <-- can be run to see the yaml equivalent the the below values. (potentially easier to read)
            values: vector_observability_agent_helm_values_as_JS_object,
        });
        const vector_observability_aggregator_helm_release = new eks.HelmChart(this.stack, 'vector-observability-aggregator-statefulset-helm', {
            cluster: this.cluster,
            namespace: this.observability_ns_manifest.metadata.name,
            repository: 'https://helm.vector.dev',
            chart: 'vector',
            release: 'observability-aggregator', //<-- don't modify as an https cert is generated to match a name generated based on this
            version: '0.46.0', //version of helm chart (0.46.0, maps to app version 0.50.0-distroless-libc)
            // helm repo add vector https://helm.vector.dev
            // helm repo update vector
            // helm search repo vector
            // helm show values vector/vector            <-- can be run to show all possible values
            // helm get values observability-aggregator  <-- can be run to see the yaml equivalent the the below values. (potentially easier to read)
            values: vector_observability_aggregator_helm_values_as_JS_object,
        });
        // Imperative installation order to avoid temporary errors in logs
        vector_observability_agent_helm_release.node.addDependency(this.observability_ns);
        vector_observability_aggregator_helm_release.node.addDependency(this.observability_ns);
        vector_observability_aggregator_helm_release.node.addDependency(observability_certificates);

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
    const kubernetes_event_exporter_helm_release = new eks.HelmChart(this.stack, 'kubernetes-event-exporter-helm', {
        cluster: this.cluster,
        namespace: this.observability_ns_manifest.metadata.name,
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

    } //end deploy_vector_logging_agent
    ///////////////////////////////////////////////////////////////////////////////////////////////////////


}//end of Frugal_Observability class

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
