import * as yaml from 'js-yaml'; //npm install js-yaml && npm install --save-dev @types/js-yaml

export function config_for_cert_manager_helm_values () {
    type JSON = {[key: string]: any;}; //data type requested by helm values
    let recommended_config: JSON = {};

//v-- Basically an inline heredoc, where YAML Indentation matters, so this can't be indented in typescript
const helm_values_as_yaml = `
# v-- Based on https://cert-manager.io/docs/installation/best-practice/#best-practice-helm-chart-values
#          and https://github.com/cert-manager/cert-manager/blob/v1.19.1/deploy/charts/cert-manager/values.yaml
crds:
  enabled: true

global:
  priorityClassName: system-cluster-critical

resources:
  requests:
    cpu: 10m
    memory: 32Mi
  limits:
    memory: 1Gi
replicaCount: 2
topologySpreadConstraints:
- maxSkew: 1 #Prefer the 2 replicas of cert-manager controller to spread across zones
  topologyKey: topology.kubernetes.io/zone #(topologyKey = Node Label)
  whenUnsatisfiable: ScheduleAnyway
  labelSelector:
    matchLabels: #(of pod)
      app.kubernetes.io/instance: cert-manager
      app.kubernetes.io/component: controller
- maxSkew: 1 #Prefer 2 replicas of cert-manager controller to spread across multiple nodes
  topologyKey: kubernetes.io/hostname
  whenUnsatisfiable: DoNotSchedule
  labelSelector:
    matchLabels: #(of pod)
      app.kubernetes.io/instance: cert-manager
      app.kubernetes.io/component: controller
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
    - topologyKey: kubernetes.io/hostname
      labelSelector:
        matchExpressions:
        - values: ["cert-manager"]
          operator: In
          key: app.kubernetes.io/instance
        - values: ["controller"]
          operator: In
          key: app.kubernetes.io/component
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        topologyKey: topology.kubernetes.io/zone #<-- node label
        labelSelector: # <-- pod labels
          matchExpressions:
          - values: ["cert-manager"]
            operator: In
            key: app.kubernetes.io/instance
          - values: ["controller"]
            operator: In
            key: app.kubernetes.io/component
podDisruptionBudget:
  enabled: true
  minAvailable: 1
automountServiceAccountToken: false
serviceAccount:
  automountServiceAccountToken: false
volumes:
- name: serviceaccount-token
  projected:
    defaultMode: 0444
    sources:
    - serviceAccountToken:
        expirationSeconds: 3607
        path: token
    - configMap:
        name: kube-root-ca.crt
        items:
        - key: ca.crt
          path: ca.crt
    - downwardAPI:
        items:
        - path: namespace
          fieldRef:
            apiVersion: v1
            fieldPath: metadata.namespace
volumeMounts:
- mountPath: /var/run/secrets/kubernetes.io/serviceaccount
  name: serviceaccount-token
  readOnly: true

webhook:
  resources:
    requests:
      cpu: 10m
      memory: 32Mi
    limits:
      memory: 1Gi
  replicaCount: 3
  topologySpreadConstraints:
  - maxSkew: 1 #Prefer the 3 replicas of cert-manager webhook to spread across zones
    topologyKey: topology.kubernetes.io/zone #(topologyKey = Node Label)
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels: #(of pod)
        app.kubernetes.io/instance: cert-manager
        app.kubernetes.io/component: webhook
  - maxSkew: 1 #Force 3 replicas of cert-manager webhook to spread across multiple nodes
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels: #(of pod)
        app.kubernetes.io/instance: cert-manager
        app.kubernetes.io/component: webhook
  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution: #prefer spreading across zones & hosts
      - weight: 100
        podAffinityTerm:
          topologyKey: kubernetes.io/hostname #<-- node label
          labelSelector: # <-- pod labels
            matchExpressions:
            - values: ["cert-manager"]
              operator: In
              key: app.kubernetes.io/instance
            - values: ["webhook"]
              operator: In
              key: app.kubernetes.io/component
      - weight: 100
        podAffinityTerm:
          topologyKey: topology.kubernetes.io/zone #<-- node label
          labelSelector: # <-- pod labels
            matchExpressions:
            - values: ["cert-manager"]
              operator: In
              key: app.kubernetes.io/instance
            - values: ["webhook"]
              operator: In
              key: app.kubernetes.io/component
  podDisruptionBudget:
    enabled: true
    minAvailable: 1
  automountServiceAccountToken: false
  serviceAccount:
    automountServiceAccountToken: false
  volumes:
  - name: serviceaccount-token
    projected:
      defaultMode: 0444
      sources:
      - serviceAccountToken:
          expirationSeconds: 3607
          path: token
      - configMap:
          name: kube-root-ca.crt
          items:
          - key: ca.crt
            path: ca.crt
      - downwardAPI:
          items:
          - path: namespace
            fieldRef:
              apiVersion: v1
              fieldPath: metadata.namespace
  volumeMounts:
  - mountPath: /var/run/secrets/kubernetes.io/serviceaccount
    name: serviceaccount-token
    readOnly: true

cainjector:
  extraArgs:
  - --namespace=cert-manager
  - --enable-certificates-data-source=false
  resources:
    requests:
      cpu: 10m
      memory: 32Mi
    limits:
      memory: 1Gi
  replicaCount: 2
  topologySpreadConstraints:
  - maxSkew: 1 #Prefer the 2 replicas of cert-manager cainjector to spread across zones
    topologyKey: topology.kubernetes.io/zone #(topologyKey = Node Label)
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels: #(of pod)
        app.kubernetes.io/instance: cert-manager
        app.kubernetes.io/component: cainjector
  - maxSkew: 1 #Prefer 2 replicas of cert-manager cainjector to spread across multiple nodes
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels: #(of pod)
        app.kubernetes.io/instance: cert-manager
        app.kubernetes.io/component: cainjector
  affinity:
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution: #require spreading across hosts
      - topologyKey: kubernetes.io/hostname
        labelSelector:
          matchExpressions:
          - values: ["cert-manager"]
            operator: In
            key: app.kubernetes.io/instance
          - values: ["cainjector"]
            operator: In
            key: app.kubernetes.io/component
      preferredDuringSchedulingIgnoredDuringExecution: #prefer spreading across zones
      - weight: 100
        podAffinityTerm:
          topologyKey: topology.kubernetes.io/zone #<-- node label
          labelSelector: # <-- pod labels
            matchExpressions:
            - values: ["cert-manager"]
              operator: In
              key: app.kubernetes.io/instance
            - values: ["cainjector"]
              operator: In
              key: app.kubernetes.io/component
  podDisruptionBudget:
    enabled: true
    minAvailable: 1
  automountServiceAccountToken: false
  serviceAccount:
    automountServiceAccountToken: false
  volumes:
  - name: serviceaccount-token
    projected:
      defaultMode: 0444
      sources:
      - serviceAccountToken:
          expirationSeconds: 3607
          path: token
      - configMap:
          name: kube-root-ca.crt
          items:
          - key: ca.crt
            path: ca.crt
      - downwardAPI:
          items:
          - path: namespace
            fieldRef:
              apiVersion: v1
              fieldPath: metadata.namespace
  volumeMounts:
  - mountPath: /var/run/secrets/kubernetes.io/serviceaccount
    name: serviceaccount-token
    readOnly: true

startupapicheck:
  automountServiceAccountToken: false
  serviceAccount:
    automountServiceAccountToken: false
  volumes:
  - name: serviceaccount-token
    projected:
      defaultMode: 0444
      sources:
      - serviceAccountToken:
          expirationSeconds: 3607
          path: token
      - configMap:
          name: kube-root-ca.crt
          items:
          - key: ca.crt
            path: ca.crt
      - downwardAPI:
          items:
          - path: namespace
            fieldRef:
              apiVersion: v1
              fieldPath: metadata.namespace
  volumeMounts:
  - mountPath: /var/run/secrets/kubernetes.io/serviceaccount
    name: serviceaccount-token
    readOnly: true
`;


    try {
        const JSON_string_from_YAML = JSON.stringify( yaml.load(helm_values_as_yaml), null, 4); //null, 4 makes it human readable
        const JS_Object_from_JSON = JSON.parse(JSON_string_from_YAML);
        recommended_config = JS_Object_from_JSON;
    } catch (error){
        console.error("Error parsing cert-manager.io's helm values as yaml", error);
    } //end try-catch

    return recommended_config;

}//end config_for_cert_manager_helm_values()
