import { Opinionated_VPC_Config_Data } from '../../lib/Opinionated_VPC_Config_Data';
import * as cdk from 'aws-cdk-lib';
import { FckNatInstanceProps } from 'cdk-fck-nat' //source: npm install cdk-fck-nat@latest
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export function apply_config(config: Opinionated_VPC_Config_Data, stack?: cdk.Stack){ //config: is of type Opinionated_VPC_Config_Data
  const good_and_affordable_NAT_properties: FckNatInstanceProps = {
    /*Pros of Fck NAT (Summary of https://fck-nat.dev/stable/)
      * Good:
        * t4g.micro supports sustained 3.2 Mbps egress and 5 Gbps traffic spikes (per instance/AZ)
          per https://fck-nat.dev/stable/choosing_an_instance_size/
        * HA, FT, and Auto healing since backed by an ASG
        * Hands free as long as you're under bandwidth limit (decent possibility)
      * Affordable:
        * Idle Costs:
          * 4tg.micro times 2 AZs (2 is configurable) = $6.12/month (2 AZ * $3.06/month)
          * Default of 3 AWS Managed NAT GW's = $98.55/month (1 per public AZ * 3 AZ * $0.045/hr * 730 hr/month)
        * Per GB Costs:
          * Fck NAT = $0/GB additional upcharge (normal networking costs still apply)
          * AWS Managed NAT = $0.045/GB additional upcharge
      * FOSS (Free Open Source Software):
        * Supported via Tips https://ko-fi.com/codebrewed
    */
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
    enableCloudWatch: false, //costs ~$17/month, could turn it on and off as needed, but honestly if problem
                             //just bump up to bigger size or switched to AWS Managed NAT
    enableSsm: true, //allows ssh via systems manager.
  }
  config.setNatGatewayProviderAsAwsManagedNat(); //Semi-Expensive Alternative
  //config.setNatGatewayProviderAsFckNat( TODO, good_and_affordable_NAT_properties);
  config.setNumNatGateways(1);
      /*                   ^-- Use 1, 2, or 3
      1 is recommended when, you have low traffic (under 1000 GB/month), and want lowest price.
      2 is recommended when, you have low traffic (under 1000 GB/month), and want HA/FT.
      3 is recommended when, you have high traffic (over 1000 GB/month), and want lowest price with HA/FT
      (1000 GB of cross AZ traffic * $0.01/GB = $10/month, so 1000GB is a good rule of thumb for determining
      when cross AZ bandwidth costs will outpace instance costs, at which point 3 can give lower net-cost.)
      */
  config.setVpcIPv4CIDR('10.99.0.0/16'); // WARNING: Don't change the VPC CIDR after creation
  config.setPublicSubnetCIDRSlash(23);  // Note: /23 = 510 usable IPs (mostly by LBs)
  config.setPrivateSubnetCIDRSlash(19); // Note: /19 = 8190 usable IPs
  config.setProvisionVPN(false);

}//end apply_config
