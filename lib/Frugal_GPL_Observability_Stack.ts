/*Frugal GPL: Grafana Prometheus Loki Monitoring Stack
Is meant to be a batteries included stop gap solution
that you might use temporarily or in lower environments where cons are acceptable.

Trade Offs:
Pros: 
* Predictable pricing
* Uses spot node selectors to be even cheaper.

Cons:
* 1 replica (No HA, No FT, but also no big deal due to kube auto-healing)
* This isn't a problem if you embrace the philosophy of SLOs/ that 100% uptime is overrated.
* You can often get 99%-99.95% uptime for much cheaper
*/

/*WIP GOALs - option1:
* I want to avoid HTTP ACME challenge in favor if DNS ACME challenge.
* A customer will likely have a DNS registrar (completely random)
* A customer will likely have a preferred Authoritative DNS Server (CloudFlare for Example)
* They can delegate a subdomain or buy a DNS for this purpose.
* Eventually make doc
  * In that doc I should advise against subdomain route in favor of dedicated domain / add details
  * https://doitintl.slack.com/archives/C03NQB4900K/p1724770111798199?thread_ts=1724434702.650379&cid=C03NQB4900K
* For now going the subdomain route
  Generated a Route53 Hosted Zone named eks.easyeks.dev
  generated a type NS with 4 value's
  ns-1834.awsdns-37.co.uk.
  ns-616.awsdns-13.net.
  ns-1302.awsdns-34.org.
  ns-469.awsdns-58.com. 
* Then in CloudFlare DNS management of the easyeks.dev domain I added 2 records
  Type   Name   NameServer
  NS     eks    ns-616.awsdns-13.net.
  NS     eks    ns-469.awsdns-58.com.
* Then in Route53 I could create
  grafana.dev.eks.easyeks.dev --> 127.0.0.1
* Was able to verify it works instantly with:
  nslookup grafana.dev.eks.easyeks.dev 1.1.1.1

Option 2:
Internal LB, HTTP, and Port Forwarding Using AWS System Manager Session Manager (acting as an IAM Auth Proxy)
*/

import { Easy_EKS_Config_Data } from "./Easy_EKS_Config_Data";
import { Construct } from "constructs";
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cdk from 'aws-cdk-lib';
import { Easy_EKS } from "./Easy_EKS";

export function deploy(stack: cdk.Stack, config: Easy_EKS_Config_Data){



//const stack = new cdk.Stack(stateStorage, config.id+"-monitoring-cert");

// const myHostedZone = new route53.HostedZone(stack, 'HostedZone', {
//   zoneName: 'eks.easyeks.dev',
// });

// const cert = new acm.Certificate(stack, 'Certificate', {
//   domainName: 'grafana.dev1.eks.easyeks.dev',
//   certificateName: 'grafana.dev1.eks.easyeks.dev', //Optionally provide an certificate name
//   validation: acm.CertificateValidation.fromDns(myHostedZone),
//   //Generates a CNAME in hosted zone & cert in ACM
// });



}


