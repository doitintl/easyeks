import { Easy_EKS_Config_Data } from "./Easy_EKS_Config_Data";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import { Construct } from "constructs";
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as fs from 'fs';
import * as yaml from 'js-yaml'; //npm install js-yaml && npm install --save-dev @types/js-yaml
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*Frugal GVVV: Grafana Victoria Vector Stack
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
                    "extraArgs": {
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
  name: api
  protocol: TCP
- containerPort: 9090
  name: prom-exporter
  protocol: TCP
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
    enabled: true
  api:
    enabled: true
    address: "[::]:8686"  #<-- [::] is the ipv6 equivalent of 0.0.0.0
    playground: false
  data_dir: /vector-data-dir
  sources:
    host_metrics:
      type: host_metrics
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
    kubernetes_logs:
      type: kubernetes_logs
      glob_minimum_cooldown_ms: 1000
  sinks: #<--(sink = destination)
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
      inputs:  #v-- these must match arbitrary source names defined in sources
      - kubernetes_logs
      - host_metrics
`;
const vector_observability_agent_helm_values_as_JS_object = JSON.parse(JSON.stringify(yaml.load(vector_observability_agent_helm_values_as_yaml)));

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
- containerPort: 6443   #<--GRPC endpoint. Enabled by customConfig.sources.vector_agents.type: vector & address: [::]:6443
  name: vector
  protocol: TCP
- containerPort: 8686   #<--graphql endpoint. Enabled by customConfig.api.enabled: true & address: [::]:8686
  name: api
  protocol: TCP
- containerPort: 9090   #<--currently broken
  name: prom-exporter
  protocol: TCP
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
    address: "[::]:8686"  #<-- [::] is the ipv6 equivalent of 0.0.0.0
    playground: false
  data_dir: /vector-data-dir
  sources:
    vector_agents:
      type: vector
      version: "2"
      address: "[::]:6443"   #<-- triggers listening on port 6443
      tls:
        enabled: true
        ca_file: /etc/ssl/certs/ca.crt
        crt_file: /etc/ssl/certs/tls.crt
        key_file: /etc/ssl/certs/tls.key
        server_name: observability-aggregator-vector.observability
        verify_certificate: false    #<-- (false = mTLS disabled) (client cert verification true = mTLS enabled)
        verify_hostname: true        #<-- true = only allow incoming traffic from dns names associated with https-cert
  sinks: #<--(sink = destination)
    victoria_logs_db:
      type: elasticsearch   #<-- The Bulk API algorithm invented by elasticsearch is the most efficient option available
      api_version: v8
      compression: gzip
      endpoints:
      - http://vl-victoria-logs-single-server:9428/insert/elasticsearch/
      healthcheck:
        enabled: false   #<-- recommended per VL's docs: https://docs.victoriametrics.com/victorialogs/data-ingestion/vector/
      query:
        _msg_field: message
        _stream_field: host,container_name
        _time_field: timestamp
      inputs:  # v--these must match arbitrary source names defined in sources
      - vector_agents
`;
const vector_observability_aggregator_helm_values_as_JS_object = JSON.parse(JSON.stringify(yaml.load(vector_observability_aggregator_helm_values_as_yaml)));



        const vector_observability_agent_helm_release = new eks.HelmChart(this.stack, 'vector-observability-agent-daemonset-helm', {
            cluster: this.cluster,
            namespace: this.observability_ns_manifest.metadata.name,
            repository: "https://helm.vector.dev",
            chart: "vector",
            release: 'observability-agent',
            version: "0.46.0", //version of helm chart (0.46.0, maps to app version 0.50.0-distroless-libc)
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
            repository: "https://helm.vector.dev",
            chart: "vector",
            release: 'observability-aggregator',
            version: "0.46.0", //version of helm chart (0.46.0, maps to app version 0.50.0-distroless-libc)
            // helm repo add vector https://helm.vector.dev
            // helm repo update vector
            // helm search repo vector
            // helm show values vector/vector            <-- can be run to show all possible values
            // helm get values observability-aggregator  <-- can be run to see the yaml equivalent the the below values. (potentially easier to read)
            values: vector_observability_aggregator_helm_values_as_JS_object,
        });
        const observability_certificate_authority_manifest = {
            "apiVersion": "cert-manager.io/v1",
            "kind": "Issuer",
            "metadata": {
                "name": "ca-issuer",
                "namespace": this.observability_ns_manifest.metadata.name,
            },
            "spec": {
                "ca": {
                    "secretName": "observability-certificate-authority"
                },
            }   
        };
        const observability_certificates = new eks.KubernetesManifest(this.stack, "persistentVolumeClaimManifest", {
            cluster: this.cluster,
            manifest: [observability_certificate_authority_manifest],
            overwrite: true,
            prune: true,
        });
        // Imperative installation order to avoid temporary errors in logs
        vector_observability_agent_helm_release.node.addDependency(this.observability_ns);
        vector_observability_aggregator_helm_release.node.addDependency(this.observability_ns);
    } //end deploy_vector_logging_agent
    ///////////////////////////////////////////////////////////////////////////////////////////////////////


}//end of Frugal_Observability class

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
