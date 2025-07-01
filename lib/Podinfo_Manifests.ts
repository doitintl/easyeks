import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import { KubernetesManifest } from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Easy_EKS_Config_Data } from "./Easy_EKS_Config_Data";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { ApplicationProtocol, IpAddressType, TargetType } from "aws-cdk-lib/aws-elasticloadbalancingv2";


export interface Podinfo_Helm_Config {
  helm_chart_version: string,
  helm_chart_release: string,
  helm_chart_values?: Record<string, any> | undefined,
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// export const Podinfo_Http_Ingress_Yaml_Generator = (
//   podinfo_helm_config: Podinfo_Helm_Config,
// ): Record<string, any> => {
//   return {
//     "apiVersion": "networking.k8s.io/v1",
//     "kind": "Ingress",
//     "metadata": {
//       "name": `${podinfo_helm_config.helm_chart_release}-ingress`,
//       "namespace": "default",
//       "annotations": {
//         "kubernetes.io/ingress.class": "alb",
//         "alb.ingress.kubernetes.io/load-balancer-name": `${podinfo_helm_config.helm_chart_release}-http-alb`,
//         "alb.ingress.kubernetes.io/scheme": "internet-facing",
//         "alb.ingress.kubernetes.io/target-type": "ip",
//         "alb.ingress.kubernetes.io/group.name": podinfo_helm_config.helm_chart_release,
//         "alb.ingress.kubernetes.io/ip-address-type": "dualstack",
//         "alb.ingress.kubernetes.io/listen-ports": '[{"HTTP": 80}]',
//         "alb.ingress.kubernetes.io/backend-protocol": "HTTP",
//
//       },
//       "labels": {
//         "app": podinfo_helm_config.helm_chart_release,
//       },
//     },
//     "spec": {
//       "rules": [
//         {
//           "http": {
//             "paths": [
//               {
//                 "path": "/",
//                 "pathType": "Prefix",
//                 "backend": {
//                   "service": {
//                     "name": podinfo_helm_config.helm_chart_release,
//                     "port": {
//                       "number": podinfo_helm_config.helm_chart_values?.port ?? 9898,
//                     },
//                   },
//                 },
//               },
//             ],
//           },
//         },
//       ],
//     },
//   } as Record<string, any>;
// }

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// export const Podinfo_Https_Ingress_Yaml_Generator = (
//   podinfo_helm_config: Podinfo_Helm_Config,
//   certificateArn: string,
//   host: string,
// ): Record<string, any> => {
//   return {
//     "apiVersion": "networking.k8s.io/v1",
//     "kind": "Ingress",
//     "metadata": {
//       "name": `${podinfo_helm_config.helm_chart_release}-ingress`,
//       "namespace": "default",
//       "annotations": {
//         "kubernetes.io/ingress.class": "alb",
//         "alb.ingress.kubernetes.io/scheme": "internet-facing",
//         "alb.ingress.kubernetes.io/load-balancer-name": `${podinfo_helm_config.helm_chart_release}-https-alb`,
//         "alb.ingress.kubernetes.io/target-type": "ip",
//         "alb.ingress.kubernetes.io/group.name": podinfo_helm_config.helm_chart_release,
//         "alb.ingress.kubernetes.io/ip-address-type": "dualstack",
//         "alb.ingress.kubernetes.io/listen-ports": '[{"HTTP": 80}, {"HTTPS": 443}]',
//         "alb.ingress.kubernetes.io/backend-protocol": "HTTP",
//         "alb.ingress.kubernetes.io/actions.ssl-redirect": '{"Type": "redirect", "RedirectConfig": { "Protocol": "HTTPS", "Port": "443", "StatusCode": "HTTP_301"}}',
//         "alb.ingress.kubernetes.io/certificate-arn": certificateArn,
//       },
//       "labels": {
//         "app": podinfo_helm_config.helm_chart_release,
//       },
//     },
//     "spec": {
//       "rules": [
//         {
//           "host": host,
//           "http": {
//             "paths": [
//               {
//                 "path": "/",
//                 "pathType": "Prefix",
//                 "backend": {
//                   "service": {
//                     "name": podinfo_helm_config.helm_chart_release,
//                     "port": {
//                       "number": podinfo_helm_config.helm_chart_values?.port ?? 9898,
//                     },
//                   },
//                 },
//               },
//             ],
//           },
//         },
//       ],
//     },
//   } as Record<string, any>;
// }

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const Podinfo_TargetGroupBinding_Yaml_Generator = (
  podinfo_helm_config: Podinfo_Helm_Config,
  target_group_arn: string,
  alb_security_group_id: string,
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

  podinfo_helm.node.addDependency(cluster.awsAuth);
  podinfo_helm.node.addDependency(cluster);
  return podinfo_helm;
} //end function Apply_Podinfo_Helm_Chart

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function Apply_Podinfo_Http_Alb_YAML(cluster: eks.Cluster,
                                            config: Easy_EKS_Config_Data,
                                            stack: cdk.Stack,
                                            podinfo_helm_config: Podinfo_Helm_Config) {

  // Provisioning an ALB by CDK
  const alb_sg = new ec2.SecurityGroup(stack, `${podinfo_helm_config.helm_chart_release}-alb-http-sg`, {
    vpc: config.vpc,
    // securityGroupName: `${podinfo_helm_config.helm_chart_release}-alb-http-sg`,
    allowAllIpv6Outbound: true,
    allowAllOutbound: true,
    description: `${podinfo_helm_config.helm_chart_release}-alb-http-sg`,
  })
  cdk.Tags.of(alb_sg).add("Name", `${podinfo_helm_config.helm_chart_release}-alb-http-sg`); 
  alb_sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow HTTP from anywhere with IPv4");
  alb_sg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(80), "Allow HTTP from anywhere with IPv6");

  const alb = new elbv2.ApplicationLoadBalancer(stack, `${podinfo_helm_config.helm_chart_release}-http-alb`, {
    vpc: config.vpc,
    internetFacing: true,
    securityGroup: alb_sg,
    ipAddressType: IpAddressType.DUAL_STACK,
    loadBalancerName: `${podinfo_helm_config.helm_chart_release}-http-alb`,
    http2Enabled: true,
  });

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

  const tgb_yaml = Podinfo_TargetGroupBinding_Yaml_Generator(podinfo_helm_config, targetGroup.targetGroupArn, alb_sg.securityGroupId);
  const albController = (stack.node.tryFindChild(config.id)?.node.tryFindChild('chart-AWSLoadBalancerController')?.node.defaultChild as cdk.CfnResource);

  const tgb_manifest = new KubernetesManifest(stack, `${podinfo_helm_config.helm_chart_release}-http-tgb`, {
    cluster: cluster,
    manifest: [tgb_yaml],
    prune: true,
  });

  tgb_manifest.node.addDependency(albController);
  tgb_manifest.node.addDependency(cluster.awsAuth);
  (tgb_manifest.node.defaultChild as cdk.CfnResource)?.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
  alb_sg.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

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

  // Output the ALB DNS name
  new cdk.CfnOutput(stack, 'HttpAlbDnsName', {
    value: alb.loadBalancerDnsName,
  });

} //end function Apply_Podinfo_Http_Alb_YAML
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function Apply_Podinfo_Https_Alb_YAML(cluster: eks.Cluster,
                                             config: Easy_EKS_Config_Data,
                                             stack: cdk.Stack,
                                             podinfo_helm_config: Podinfo_Helm_Config,
                                             certificateArn: string) {

  // Provisioning an ALB by CDK
  const alb_sg = new ec2.SecurityGroup(stack, `${podinfo_helm_config.helm_chart_release}-alb-https-sg`, {
    vpc: config.vpc,
    // securityGroupName: `${podinfo_helm_config.helm_chart_release}-alb-https-sg`,
    allowAllIpv6Outbound: true,
    allowAllOutbound: true,
    description: `${podinfo_helm_config.helm_chart_release}-alb-https-sg`,
  });
  cdk.Tags.of(alb_sg).add("Name", `${podinfo_helm_config.helm_chart_release}-alb-https-sg`); 
  alb_sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow HTTP from any IPv4");
  alb_sg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(80), "Allow HTTP from any IPv6");
  alb_sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "Allow HTTP from any IPv4");
  alb_sg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(443), "Allow HTTP from any IPv6");

  const alb = new elbv2.ApplicationLoadBalancer(stack, `${podinfo_helm_config.helm_chart_release}-https-alb`, {
    vpc: config.vpc,
    internetFacing: true,
    securityGroup: alb_sg,
    ipAddressType: IpAddressType.DUAL_STACK,
    loadBalancerName: `${podinfo_helm_config.helm_chart_release}-https-alb`,
    http2Enabled: true,
  });

  const targetGroup = new elbv2.ApplicationTargetGroup(stack, `${podinfo_helm_config.helm_chart_release}-https-target-group`, {
    targetGroupName: `${podinfo_helm_config.helm_chart_release}-https-tg`,
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

  const tgb_yaml = Podinfo_TargetGroupBinding_Yaml_Generator(podinfo_helm_config, targetGroup.targetGroupArn, alb_sg.securityGroupId);
  const albController = (stack.node.tryFindChild(config.id)?.node.tryFindChild('chart-AWSLoadBalancerController')?.node.defaultChild as cdk.CfnResource);

  const tgb_manifest = new KubernetesManifest(stack, `${podinfo_helm_config.helm_chart_release}-https-tgb`, {
    cluster: cluster,
    manifest: [tgb_yaml],
    prune: true,
  });

  tgb_manifest.node.addDependency(albController);
  tgb_manifest.node.addDependency(cluster.awsAuth);
  (tgb_manifest.node.defaultChild as cdk.CfnResource)?.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
  alb_sg.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

  const httpListener = alb.addListener(`${podinfo_helm_config.helm_chart_release}-alb-http-redirect-listener`, {
    port: 80,
    protocol: ApplicationProtocol.HTTP,
    defaultAction: elbv2.ListenerAction.redirect({
      protocol: ApplicationProtocol.HTTPS
    }),
  });
  const httpsListener = alb.addListener(`${podinfo_helm_config.helm_chart_release}-alb-https-listener`, {
    port: 443,
    protocol: ApplicationProtocol.HTTPS,
    certificates:[elbv2.ListenerCertificate.fromArn(certificateArn)],
    defaultAction: elbv2.ListenerAction.fixedResponse(404, {
      contentType: "text/plain",
    }),
  });

  httpsListener.addTargetGroups(`${podinfo_helm_config.helm_chart_release}-https-tg`, {
    targetGroups: [targetGroup],
  });

  // Output the ALB DNS name
  new cdk.CfnOutput(stack, 'HttsAlbDnsName', {
    value: alb.loadBalancerDnsName,
  });

} //end function Apply_Podinfo_Https_Alb_Yaml
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////