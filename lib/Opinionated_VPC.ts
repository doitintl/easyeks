/*Opinionated VPC:
The idea is to have:
* more cost optimized defaults, like Fck-NAT (https://fck-nat.dev/stable/)
* ipv4/ipv6 dualstack VPC by default,
  that can be shared by multiple environments
  * a low VPC (for sandbox, dev, qa, test, and CI environments)
  * a high VPC (for stage, prod, and blue green prod envs)*/
import { FckNatInstanceProvider, FckNatInstanceProps } from 'cdk-fck-nat' //source: npm install cdk-fck-nat@1.5.6
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'; 
import * as cdk from 'aws-cdk-lib';
import { Opinionated_VPC_Config_Data } from './Opinionated_VPC_Config_Data';
///////////////////////////////////////////////////////////////////////////////////////////////////////////

export function add_to_list_of_deployable_stacks(constructWhereStacksStateIsStored: Construct, config: Opinionated_VPC_Config_Data){
//    const vpcStack = null;

//     const lowVPC = new ec2.Vpc(constructWhereStacksStateIsStored, "stackID", {
// //        vpcName: stackID,
//         natGatewayProvider: lowNAT,
//         ipAddresses: ec2.IpAddresses.cidr('10.100.0.0/16'),
//         subnetConfiguration: [
//             { name: "Public", subnetType: ec2.SubnetType.PUBLIC },
//             { name: "Private", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
//         ],
//         vpnGateway: false,
//     });
}//end add_to_list_of_deployable_stacks

///////////////////////////////////////////////////////////////////////////////////////////////////////////
class dualStackVPC extends ec2.Vpc {
/*Based on:
* https://superluminar.io/2023/03/23/ipv6-in-aws-with-cdk/
*/
    egressOnlyInternetGatewayID: string;

    constructor(constructWhereStacksStateIsStored: Construct, stackID: string, properties?: ec2.VpcProps){
        super(constructWhereStacksStateIsStored, stackID, properties);
    
        // v--add Name Tag
        cdk.Tags.of(this).add("Name", this.node.path);

        // v--associate an IPv6 ::/56 CIDR block with our vpc
        const cfnVpcCidrBlock = new ec2.CfnVPCCidrBlock(this, "Ipv6Cidr", {
            vpcId: this.vpcId,
            amazonProvidedIpv6CidrBlock: true,
        });
        const vpcIpv6CidrBlock = cdk.Fn.select(0, this.vpcIpv6CidrBlocks);

        // v--slice our ::/56 CIDR block into 256 chunks of ::/64 CIDRs
        const subnetIpv6CidrBlocks = cdk.Fn.cidr(vpcIpv6CidrBlock, 256, "64");   

        // v--associate an IPv6 CIDR sub-block to each subnet
        [
        ...this.publicSubnets,
        ...this.privateSubnets,
        ...this.isolatedSubnets,
        ].forEach((subnet, i) => {
          subnet.node.addDependency(cfnVpcCidrBlock);
          const cfnSubnet = subnet.node.defaultChild as ec2.CfnSubnet;
          cfnSubnet.ipv6CidrBlock = cdk.Fn.select(i, subnetIpv6CidrBlocks);
          cfnSubnet.assignIpv6AddressOnCreation = true;
        });

        const addDefaultIpv6Routes = (
            subnets: ec2.ISubnet[],
            gatewayId: string,
            routerType: ec2.RouterType
        ) => subnets.forEach((subnet) =>
                (subnet as ec2.Subnet).addRoute("DefaultIPv6Route", {
                  routerType: routerType,
                  routerId: gatewayId,
                  destinationIpv6CidrBlock: "::/0",
                  enablesInternetConnectivity: true,
                }));

        // v--For public subnets, ensure they have a route to the internet gateway
        if (this.internetGatewayId) {
            addDefaultIpv6Routes(
              this.publicSubnets,
              this.internetGatewayId,
              ec2.RouterType.GATEWAY
            );
        }

        // v-- ensure there is an IPv6 egress gateway
        const egressIgw = new ec2.CfnEgressOnlyInternetGateway(
          this, "IPv6EgressOnlyIGW", { vpcId: this.vpcId }
        );
        this.egressOnlyInternetGatewayID = egressIgw.ref;

        // v-- ensure private subnets have a route to the egress gateway
        addDefaultIpv6Routes(
          this.privateSubnets,
          egressIgw.ref,
          ec2.RouterType.EGRESS_ONLY_INTERNET_GATEWAY
        );

    }//end dualStackVPC constructor
///////////////////////////////////////////////////////////////////////////////////////////////////////////







/*    
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
        }
*/

//private subnets should be /19 (8190 usable IPs)

}//end dualStackVPC class




const lowNATProps: FckNatInstanceProps = {
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
    //^-- can spike to 5GB/s and sustained 3.2Mbps egress, $3.06/month
    //    per https://fck-nat.dev/stable/choosing_an_instance_size/
    enableCloudWatch: false, //costs $17/month, can turn it on as needed
    enableSsm: true, //allows ssh via systems manager.
   }
const lowNAT = new FckNatInstanceProvider(lowNATProps);   

//https://superluminar.io/2023/03/23/ipv6-in-aws-with-cdk/






