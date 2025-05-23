import { Opinionated_VPC_Config_Data } from '../../lib/Opinionated_VPC_Config_Data';
import * as cdk from 'aws-cdk-lib';
import { FckNatInstanceProps } from 'cdk-fck-nat' //source: npm install cdk-fck-nat@latest
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export function apply_config(config: Opinionated_VPC_Config_Data, stack: cdk.Stack){ //config: is of type Opinionated_VPC_Config_Data

    const good_and_affordable_NAT_props: FckNatInstanceProps = {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.C6GN, ec2.InstanceSize.MEDIUM), 
                                        //^-- ~$32/month per instance, supports 1.6Gbps sustained throughput + 5Gbps spikes
        enableCloudWatch: true, //costs ~$17/month, higher envs justify the cost
        enableSsm: true, //allows ssh via systems manager.
    }
    //config.setNatGatewayProviderAsAwsManagedNat(); //Costly Alternative
    config.setNatGatewayProviderAsFckNat(good_and_affordable_NAT_props);
    config.setNumNatGateways(2); //You can change this later, changing to 3 at higher traffic can lower net-costs, see lower env comments
    config.setVpcIPv4CIDR('10.100.0.0/16'); // WARNING: Don't change the VPC CIDR after creation
    config.setPublicSubnetCIDRSlash(23);  // Note: /23 = 510 usable IPs (mostly by LBs)
    config.setPrivateSubnetCIDRSlash(19); // Note: /19 = 8190 usable IPs
    config.setProvisionVPN(false);

}//end apply_config
