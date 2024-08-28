import { Opinionated_VPC_Config_Data } from '../../lib/Opinionated_VPC_Config_Data';
import { FckNatInstanceProps } from 'cdk-fck-nat' //source: npm install cdk-fck-nat@latest
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export function apply_config(config: Opinionated_VPC_Config_Data){ //config: is of Opinionated_VPC_Config_Data
  config.setRegion("ca-central-1"); //<-- ca-central-1 is a Hydro Powered AWS Region (Low CO2 emissions)
  //^-- good choice for lower env clusters, as follows sustainability pillar of AWS's well architected framework


  const good_and_affordable_NAT_props: FckNatInstanceProps = {
    /*Pros of Fck NAT (Summary of https://fck-nat.dev/stable/)
      * Good:
        * t4g.micro supports sustained 3.2 Mbps egress and 5 Gbps traffic spikes (per instance/AZ)
          per https://fck-nat.dev/stable/choosing_an_instance_size/
        * HA, FT, and Auto healing since backed by an ASG
        * Hands free as long as you're under bandwidth limit (decent possibility)
      * Affordable:
        * Idle Costs:
          * 4tg.micro times 3 AZs = $9.18/month (1 per public AZ * 3 AZ * $3.06/month)
          * Default of 3 AWS Managed NAT GW's = $98.55/month (1 per public AZ * 3 AZ * $0.045/hr * 730 hr/month)
        * Per GB Costs:
          * Fck NAT = $0/GB
          * AWS Managed NAT = $0.045/GB
      * FOSS (Free Open Source Software):
        * Supported via Tips https://ko-fi.com/codebrewed
    */
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
    enableCloudWatch: false, //costs $17/month, can turn it on and off as needed
    enableSsm: true, //allows ssh via systems manager.
    //POTENTIAL TO DO: SG is created by default, but I may need to add one that supports dual stack
   }
   config.setNatGatewayProviderAsFckNat(good_and_affordable_NAT_props);
   

}//end apply_config
