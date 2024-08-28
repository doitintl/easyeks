/*Opinionated VPC:
The idea is to have:
* more cost optimized defaults, like Fck-NAT (https://fck-nat.dev/stable/)
* ipv4/ipv6 dualstack VPC by default,
  that can be shared by multiple environments
  * a low VPC (for sandbox, dev, qa, test, and CI environments)
  * a high VPC (for stage, prod, and blue green prod envs)*/
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'; 
import * as cdk from 'aws-cdk-lib';
import { Opinionated_VPC_Config_Data } from './Opinionated_VPC_Config_Data';
///////////////////////////////////////////////////////////////////////////////////////////////////////////

export function add_to_list_of_deployable_stacks(constructWhereStacksStateIsStored: Construct, config: Opinionated_VPC_Config_Data){


  const vpcStack: cdk.Stack = new cdk.Stack(
    constructWhereStacksStateIsStored, 
    config.stackId,
    {
        env: {
            region: config.region,
            account: config.account,
        }
    }
  );//end vpcStack

//https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.VpcProps.html
  const vpc = new dualStackVPC(vpcStack, config.stackId, {
    vpcName: config.stackId,
    ipProtocol: ec2.IpProtocol.DUAL_STACK,
    natGatewayProvider: config.natGatewayProvider,
    natGateways: 1,
    ipAddresses: ec2.IpAddresses.cidr('10.100.0.0/16'),
    vpnGateway: false,
    subnetConfiguration: [
        { name: "Public", 
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
          ipv6AssignAddressOnCreation: true,
        },
        { name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 19, //Note: /19 = (8190 usable IPs)
          ipv6AssignAddressOnCreation: true,
        }
    ],
    //v--S3 and DynamoDB GW Endpoints cost nothing extra, can only safe money. should be default
    gatewayEndpoints: { 
        S3: { //Note ECR actually pulls from this endpoint
            service: ec2.GatewayVpcEndpointAwsService.S3,
        },
        DynamoDB: {
            service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
        },
    },
  });//end vpc

}//end add_to_list_of_deployable_stacks

///////////////////////////////////////////////////////////////////////////////////////////////////////////
class dualStackVPC extends ec2.Vpc {
    constructor(constructWhereStacksStateIsStored: Construct, stackID: string, properties?: ec2.VpcProps){
        super(constructWhereStacksStateIsStored, stackID, properties);

        // v--improve subnet naming for UX purposes
        [...this.publicSubnets].forEach((subnet, i) => {
          const cfnSubnet = subnet.node.defaultChild as ec2.CfnSubnet;
          cfnSubnet.tags.setTag("Name", `${stackID}-Public123Subnet${i}`, 1);
        });
        [...this.privateSubnets].forEach((subnet, i) => {
            const cfnSubnet = subnet.node.defaultChild as ec2.CfnSubnet;
            cfnSubnet.tags.setTag("Name", `${stackID}-PrivateSubnet${i}`, 1);
        });

    }//end dualStackVPC constructor

}//end dualStackVPC class



