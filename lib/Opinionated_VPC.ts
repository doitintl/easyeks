/*Opinionated VPC:
Deploys dualstack VPC + Fck-NAT (https://fck-nat.dev/stable/)
The idea is to have:
* a low VPC (for sandbox, dev, qa, test, and CI environments)
* and a high VPC (for stage, prod, and blue green prod envs)*/
import { FckNatInstanceProvider, FckNatInstanceProps } from 'cdk-fck-nat' //source: npm install cdk-fck-nat@1.5.6
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'; 
import * as cdk from 'aws-cdk-lib';

const lowNATProps: FckNatInstanceProps = {
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
    //^-- can spike to 5GB/s and sustained 3.2Mbps egress, $3.06/month
    //    per https://fck-nat.dev/stable/choosing_an_instance_size/
    enableCloudWatch: false, //costs $17/month, can turn it on as needed
    enableSsm: true, //allows ssh via systems manager.
   }
const lowNAT = new FckNatInstanceProvider(lowNATProps);   

//https://superluminar.io/2023/03/23/ipv6-in-aws-with-cdk/

export function add_to_list_of_deployable_stacks(stateStorage: Construct){
    const lowVPC = new ec2.Vpc(stateStorage, 'low-envs-VPC', {
        vpcName: "low-envs-vpc",
        natGatewayProvider: lowNAT,
        ipAddresses: ec2.IpAddresses.cidr('10.100.0.0/16'),
        maxAzs: 3,
        subnetConfiguration: [
            { name: "Public", subnetType: ec2.SubnetType.PUBLIC },
            { name: "Private", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
        ],
        vpnGateway: false,
        //v--S3 and DynamoDB GW Endpoints cost nothing extra, can only safe money. should be default
        gatewayEndpoints: { 
            S3: { //Note ECR actually pulls from this endpoint
                service: ec2.GatewayVpcEndpointAwsService.S3,
            },
            DynamoDB: {
                service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
            },
        },
    });

    // v--associate an IPv6 ::/56 CIDR block with our vpc
    const cfnVpcCidrBlock = new ec2.CfnVPCCidrBlock(stateStorage, "Ipv6Cidr", {
        vpcId: lowVPC.vpcId,
        amazonProvidedIpv6CidrBlock: true,
      });
    const vpcIpv6CidrBlock = cdk.Fn.select(0, lowVPC.vpcIpv6CidrBlocks);

    // v--slice our ::/56 CIDR block into 256 chunks of ::/64 CIDRs
    const subnetIpv6CidrBlocks = cdk.Fn.cidr(vpcIpv6CidrBlock, 256, "64");



}



// natGatewayProvider.securityGroup.addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.allTraffic());

