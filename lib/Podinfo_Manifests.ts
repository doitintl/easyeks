import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Easy_EKS_Config_Data } from "./Easy_EKS_Config_Data";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { ApplicationProtocol, IpAddressType, TargetType } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { KubernetesManifest } from "aws-cdk-lib/aws-eks";


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
        "alb.ingress.kubernetes.io/load-balancer-name": `${podinfo_helm_config.helm_chart_release}-http-alb`,
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
        "alb.ingress.kubernetes.io/load-balancer-name": `${podinfo_helm_config.helm_chart_release}-https-alb`,
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
export const Podinfo_TargetGroupBinding_Yaml_Generator = (
  podinfo_helm_config: Podinfo_Helm_Config,
  target_group_arn: string,
  alb_security_group_id: string
): Record<string, any> => {
  return {
    apiVersion: "elbv2.k8s.aws/v1beta1",
    kind: "TargetGroupBinding",
    metadata: {
      name: `${podinfo_helm_config.helm_chart_release}-tgb`,
    },
    spec: {
      serviceRef: {
        name: podinfo_helm_config.helm_chart_release,
        port: 9898,
      },
      targetGroupARN: target_group_arn,
      targetType: "ip",
      networking: {
        ingress: [
          {
            from: [
              {
                securityGroup: {
                  groupID: alb_security_group_id,
                },

              },
            ],
            ports: [
              {
                protocol: "TCP",
                port: "http",
              },
            ],
          },
        ],
      },
    },
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const Apply_Podinfo_Helm_Chart = (cluster: eks.Cluster,
                                         config: Easy_EKS_Config_Data,
                                         stack: cdk.Stack,
                                         podinfo_helm_config: Podinfo_Helm_Config) => {

  const podinfo_helm = new eks.HelmChart(stack, podinfo_helm_config.helm_chart_release, {
    cluster: cluster,
    repository: "https://stefanprodan.github.io/podinfo",
    chart: "podinfo",
    release: podinfo_helm_config.helm_chart_release,
    version: podinfo_helm_config.helm_chart_version || "6.9.0",
    values: {
      ...podinfo_helm_config.helm_chart_values,
    },
  });

  // const podinfo_helm = cluster.addHelmChart(podinfo_helm_config.helm_chart_release, {
  //   repository: "https://stefanprodan.github.io/podinfo",
  //   chart: "podinfo",
  //   release: podinfo_helm_config.helm_chart_release,
  //   version: podinfo_helm_config.helm_chart_version || "6.9.0",
  //   values: {
  //     ...podinfo_helm_config.helm_chart_values,
  //   },
  // })
  podinfo_helm.node.addDependency(cluster.awsAuth);
  podinfo_helm.node.addDependency(cluster);
  return podinfo_helm;
} //end function Apply_Podinfo_Helm_Chart

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function Apply_Podinfo_Http_Ingress_YAML(cluster: eks.Cluster,
                                           config: Easy_EKS_Config_Data,
                                           stack: cdk.Stack,
                                           podinfo_helm_config: Podinfo_Helm_Config,
                                           podinfo_http_ingress_yaml: Record<string, any>) {

  // Provisioning an ALB by CDK
  const alb_sg = new ec2.SecurityGroup(stack, `${podinfo_helm_config.helm_chart_release}-alb-http-sg`, {
    vpc: config.vpc,
    securityGroupName: `${podinfo_helm_config.helm_chart_release}-alb-http-sg`,
    allowAllIpv6Outbound: true,
    allowAllOutbound: true,
    description: `${podinfo_helm_config.helm_chart_release}-alb-http-sg`,
  })
  alb_sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow HTTP from anywhere");

  const alb = new elbv2.ApplicationLoadBalancer(stack, `${podinfo_helm_config.helm_chart_release}-http-alb`, {
    vpc: config.vpc,
    internetFacing: true,
    securityGroup: alb_sg,
    ipAddressType: IpAddressType.DUAL_STACK,
    loadBalancerName: `${podinfo_helm_config.helm_chart_release}-http-alb`,
    http2Enabled: true,
  });
  // const service = new eks.KubernetesObjectValue(stack, `${podinfo_helm_config.helm_chart_release}-service`, {
  //   cluster: cluster,
  //   objectType: "service",
  //   objectName: `${podinfo_helm_config.helm_chart_release}`,
  //   jsonPath: ".spec.clusterIP",
  // });
  // const deployment = (stack.node.tryFindChild(podinfo_helm_config.helm_chart_release)?.node.defaultChild as cdk.CfnResource);
  // service.node.addDependency(deployment);

  const targetGroup = new elbv2.ApplicationTargetGroup(stack, `${podinfo_helm_config.helm_chart_release}-http-target-group`, {
    targetGroupName: `${podinfo_helm_config.helm_chart_release}-http-tg`,
    vpc: config.vpc,
    port: 80,
    ipAddressType: elbv2.TargetGroupIpAddressType.IPV6, // Crucial for IPv6
    protocol: elbv2.ApplicationProtocol.HTTP,
    targetType: TargetType.IP,
    healthCheck: {
      path: '/',
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
    },
    crossZoneEnabled: true,
  });
  // targetGroup.addTarget(new targets.IpTarget(service.value, 9898));
  // targetGroup.node.addDependency(service);

  const tbg_yaml = Podinfo_TargetGroupBinding_Yaml_Generator(podinfo_helm_config, targetGroup.targetGroupArn, alb_sg.securityGroupId);
  const albController = (stack.node.tryFindChild(config.id)?.node.tryFindChild('chart-AWSLoadBalancerController')?.node.defaultChild as cdk.CfnResource);

  // const tgb_manifest = cluster.addManifest(`${podinfo_helm_config.helm_chart_release}-http-tgb`, tgb);
  const tgb_manifest = new KubernetesManifest(stack, `${podinfo_helm_config.helm_chart_release}-http-tgb`, {
    cluster: cluster,
    manifest: [tbg_yaml],
    prune: true
  });

  tgb_manifest.node.addDependency(albController);
  tgb_manifest.node.addDependency(cluster.awsAuth);
  (tgb_manifest.node.defaultChild as cdk.CfnResource)?.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

  const listener = alb.addListener(`${podinfo_helm_config.helm_chart_release}-alb-http-listener`, {
    port: 80,
    protocol: ApplicationProtocol.HTTP,
    defaultAction: elbv2.ListenerAction.fixedResponse(404, {
      contentType: "text/plain",
    }),
  });

  listener.addTargetGroups(`${podinfo_helm_config.helm_chart_release}-http-tg`, {
    targetGroups: [targetGroup],
  });
  // stack.node.tryFindChild(config.id)?.node.tryFindChild('karpenter')?.node.tryFindChild('Role') as iam.Role;

  // kubectl apply -f
  // const ingress_manifest = cluster.addManifest(`${podinfo_helm_config.helm_chart_release}-ingress`, podinfo_http_ingress_yaml);
  // (ingress_manifest.node.defaultChild as cdk.CfnResource).applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

  // listener.node.addDependency(targetGroup);
  alb.node.addDependency(alb_sg);
  // alb.node.addDependency(listener);
  // ingress_manifest.node.addDependency(alb);

  // Output the ALB DNS name
  new cdk.CfnOutput(stack, 'AlbDnsName', {
    value: alb.loadBalancerDnsName,
  });

  // return ingress_manifest
} //end function Apply_Podinfo_Ingress_YAML
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////