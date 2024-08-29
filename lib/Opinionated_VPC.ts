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
    config.stackID,
    {
        env: {
            region: config.region,
            account: config.account,
        }
    }
  );//end vpcStack



  //https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.VpcProps.html
  const vpc = new ec2.Vpc(vpcStack, config.stackID, {
    vpcName: config.stackID,
    natGatewayProvider: config.natGatewayProvider,
    natGateways: config.numNatGateways,
    ipProtocol: ec2.IpProtocol.DUAL_STACK,
    ipAddresses: ec2.IpAddresses.cidr(config.vpcNetworkWithCIDRSlash),
    ipv6Addresses: ec2.Ipv6Addresses.amazonProvided(),
    vpnGateway: config.provisionVPN,
    subnetConfiguration: [
        { name: "Public", 
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: config.publicSubNetCIDRSlash,
          ipv6AssignAddressOnCreation: true,
        },
        { name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: config.privateSubNetCIDRSlash,
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



  //UX Improvement: Improved Naming for Subnets and NAT-GWs/NAT-Instances
  const publicSubnets = vpc.selectSubnets({subnetType: ec2.SubnetType.PUBLIC}).subnets;
  const privateSubnets = vpc.selectSubnets({subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}).subnets;
  publicSubnets.forEach((subnet, i) => {
      const subnetName: string = `${config.stackID}/PublicSubnet${i+1}/${subnet.availabilityZone}`;
      const NAT_GW_Name: string = `${subnetName}/NAT-GW`;
      cdk.Tags.of(subnet).add("Name", subnetName);
      //Note tryFindChild values correspond to CF Stack's Resources Tab
      let potential_NAT_ASG = vpc.node.tryFindChild(`PublicSubnet${i+1}`)?.node.tryFindChild('FckNatAsg');
      let potential_NAT_GW = vpc.node.tryFindChild(`PublicSubnet${i+1}`)?.node.tryFindChild('NATGateway');
      if(potential_NAT_ASG){ cdk.Tags.of(potential_NAT_ASG).add("Name", NAT_GW_Name) };
      if(potential_NAT_GW){ cdk.Tags.of(potential_NAT_GW).add("Name", NAT_GW_Name) };
  });
  privateSubnets.forEach((subnet, i) => {
      cdk.Tags.of(subnet).add("Name", `${config.stackID}/PrivateSubnet${i+1}/${subnet.availabilityZone}`);
  });

  //UX Oddity: Turned out to be an AWS oddity that can't be fixed with code change
  //Canada has 3 customer facing regions: a, b, d, which can be verified with
  //`aws ec2 describe-availability-zones --region ca-central-1`
  //The reddit lore is that ca-central-1's c AZ exists for AWS internal use. 

}//end add_to_list_of_deployable_stacks
