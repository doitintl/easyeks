import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';

export interface Podinfo_Helm_Config {
  helm_chart_version: string,
  helm_chart_release: string,
  helm_chart_values?: Record<string, any> | undefined,
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const Podinfo_Http_Ingress_Yaml_Generator = (
  podinfo_helm_config: Podinfo_Helm_Config,
): Record<string, any> => {
  return {
    "apiVersion": "networking.k8s.io/v1",
    "kind": "Ingress",
    "metadata": {
      "name": `${podinfo_helm_config.helm_chart_release}-ingress`,
      "namespace": "default",
      "annotations": {
        "kubernetes.io/ingress.class": "alb",
        "alb.ingress.kubernetes.io/scheme": "internet-facing",
        "alb.ingress.kubernetes.io/target-type": "ip",
        "alb.ingress.kubernetes.io/group.name": podinfo_helm_config.helm_chart_release,
        "alb.ingress.kubernetes.io/ip-address-type": "dualstack",
        "alb.ingress.kubernetes.io/listen-ports": '[{"HTTP": 80}]',
        "alb.ingress.kubernetes.io/backend-protocol": "HTTP",

      },
      "labels": {
        "app": podinfo_helm_config.helm_chart_release,
      },
    },
    "spec": {
      "rules": [
        {
          "http": {
            "paths": [
              {
                "path": "/",
                "pathType": "Prefix",
                "backend": {
                  "service": {
                    "name": podinfo_helm_config.helm_chart_release,
                    "port": {
                      "number": podinfo_helm_config.helm_chart_values?.port ?? 9898,
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  } as Record<string, any>;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const Podinfo_Https_Ingress_Yaml_Generator = (
  podinfo_helm_config: Podinfo_Helm_Config,
  certificateArn: string,
  host: string,
): Record<string, any> => {
  return {
    "apiVersion": "networking.k8s.io/v1",
    "kind": "Ingress",
    "metadata": {
      "name": `${podinfo_helm_config.helm_chart_release}-ingress`,
      "namespace": "default",
      "annotations": {
        "kubernetes.io/ingress.class": "alb",
        "alb.ingress.kubernetes.io/scheme": "internet-facing",
        "alb.ingress.kubernetes.io/target-type": "ip",
        "alb.ingress.kubernetes.io/group.name": podinfo_helm_config.helm_chart_release,
        "alb.ingress.kubernetes.io/ip-address-type": "dualstack",
        "alb.ingress.kubernetes.io/listen-ports": '[{"HTTP": 80}, {"HTTPS": 443}]',
        "alb.ingress.kubernetes.io/backend-protocol": "HTTP",
        "alb.ingress.kubernetes.io/actions.ssl-redirect": '{"Type": "redirect", "RedirectConfig": { "Protocol": "HTTPS", "Port": "443", "StatusCode": "HTTP_301"}}',
        "alb.ingress.kubernetes.io/certificate-arn": certificateArn,
      },
      "labels": {
        "app": podinfo_helm_config.helm_chart_release,
      },
    },
    "spec": {
      "rules": [
        {
          "host": host,
          "http": {
            "paths": [
              {
                "path": "/",
                "pathType": "Prefix",
                "backend": {
                  "service": {
                    "name": podinfo_helm_config.helm_chart_release,
                    "port": {
                      "number": podinfo_helm_config.helm_chart_values?.port ?? 9898,
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  } as Record<string, any>;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const Apply_Podinfo_Helm_Chart = (cluster: eks.Cluster,
                                         podinfo_helm_config: Podinfo_Helm_Config) => {
  const podinfo_helm = cluster.addHelmChart(podinfo_helm_config.helm_chart_release, {
    repository: "https://stefanprodan.github.io/podinfo",
    chart: "podinfo",
    release: podinfo_helm_config.helm_chart_release,
    version: podinfo_helm_config.helm_chart_version || "6.9.0",
    values: {
      ...podinfo_helm_config.helm_chart_values,
    },
  })
  podinfo_helm.node.addDependency(cluster.awsAuth);
  return podinfo_helm;
} //end function Apply_Podinfo_Helm_Chart

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function Apply_Podinfo_Ingress_YAML(cluster: eks.Cluster,
                                           podinfo_helm_config: Podinfo_Helm_Config,
                                           podinfo_http_ingress_yaml: Record<string, any>) {
  // kubectl apply -f
  const ingress_manifest = cluster.addManifest(`${podinfo_helm_config.helm_chart_release}-ingress`, podinfo_http_ingress_yaml);
  (ingress_manifest.node.defaultChild as cdk.CfnResource).applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

  return ingress_manifest
} //end function Apply_Podinfo_Ingress_YAML
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////