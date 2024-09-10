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
import * as global_baseline_vpc_config from '../config/vpc/apply_global_baseline_vpc_config';
import * as my_orgs_baseline_vpc_config from '../config/vpc/apply_my_orgs_baseline_vpc_config';
import * as lower_envs_vpc_config from '../config/vpc/apply_lower_envs_vpc_config';
import * as higher_envs_vpc_config from '../config/vpc/apply_higher_envs_vpc_config';

///////////////////////////////////////////////////////////////////////////////////////////////////////////

export class Opinionated_VPC{

    //Class Variables:
    stack: cdk.Stack;
    config: Opinionated_VPC_Config_Data;
  
    //Class Constructor:
    constructor(storage_for_stacks_state: Construct, id_for_stack_and_vpc: string, stack_config: cdk.StackProps) {
        this.stack = new cdk.Stack(storage_for_stacks_state, id_for_stack_and_vpc, stack_config);
        this.config = new Opinionated_VPC_Config_Data(id_for_stack_and_vpc);
    }//end constructor of Opinionated_VPC

    //Class Functions:
    apply_global_baseline_config(){ global_baseline_vpc_config.apply_config(this.config,this.stack); }
    apply_my_orgs_baseline_config(){ my_orgs_baseline_vpc_config.apply_config(this.config,this.stack); }
    apply_lower_envs_config(){ lower_envs_vpc_config.apply_config(this.config,this.stack); }
    apply_higher_envs_config(){ higher_envs_vpc_config.apply_config(this.config,this.stack); }
    deploy_vpc_construct_into_this_objects_stack(){
        //https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.VpcProps.html
        const vpc = new ec2.Vpc(this.stack, this.config.id, {
            vpcName: this.config.id,
            natGatewayProvider: this.config.natGatewayProvider,
            natGateways: this.config.numNatGateways,
            ipProtocol: ec2.IpProtocol.IPV4_ONLY,
            // ipProtocol: ec2.IpProtocol.DUAL_STACK,
            ipAddresses: ec2.IpAddresses.cidr(this.config.vpcNetworkWithCIDRSlash),
            // ipv6Addresses: ec2.Ipv6Addresses.amazonProvided(),
            vpnGateway: this.config.provisionVPN,
            subnetConfiguration: [
                { 
                    name: "Public", 
                    subnetType: ec2.SubnetType.PUBLIC,
                    cidrMask: this.config.publicSubNetCIDRSlash,
                    // mapPublicIpOnLaunch: true, //(this is needed for fck-NAT to work)
                    // ipv6AssignAddressOnCreation: true,
                },
                { 
                    name: "Private",
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidrMask: this.config.privateSubNetCIDRSlash,
                    // ipv6AssignAddressOnCreation: true,
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
            const subnetName: string = `${this.config.id}/PublicSubnet${i+1}/${subnet.availabilityZone}`;
            const NAT_GW_Name: string = `${subnetName}/NAT-GW`;
            cdk.Tags.of(subnet).add("Name", subnetName);
            cdk.Tags.of(subnet).add("kubernetes.io/role/elb", "1");
            //Note tryFindChild values correspond to CF Stack's Resources Tab
            let potential_NAT_ASG = vpc.node.tryFindChild(`PublicSubnet${i+1}`)?.node.tryFindChild('FckNatAsg');
            let potential_NAT_GW = vpc.node.tryFindChild(`PublicSubnet${i+1}`)?.node.tryFindChild('NATGateway');
            if(potential_NAT_ASG){ cdk.Tags.of(potential_NAT_ASG).add("Name", NAT_GW_Name) };
            if(potential_NAT_GW){ cdk.Tags.of(potential_NAT_GW).add("Name", NAT_GW_Name) };
        });
        privateSubnets.forEach((subnet, i) => {
            cdk.Tags.of(subnet).add("Name", `${this.config.id}/PrivateSubnet${i+1}/${subnet.availabilityZone}`);
            cdk.Tags.of(subnet).add("kubernetes.io/role/internal-elb", "1");
        });
    }//end deploy_vpc_construct_into_this_objects_stack()

}//end class of Opinionated_VPC
