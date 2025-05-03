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
import * as global_baseline_vpc_config from '../config/vpc/global_baseline_vpc_config';
import * as my_orgs_baseline_vpc_config from '../config/vpc/my_orgs_baseline_vpc_config';
import * as lower_envs_vpc_config from '../config/vpc/lower_envs_vpc_config';
import * as higher_envs_vpc_config from '../config/vpc/higher_envs_vpc_config';
import { FckNatInstanceProvider } from 'cdk-fck-nat' //source: npm install cdk-fck-nat@latest
import { execSync } from 'child_process'; //work around for vpc lookup issue

///////////////////////////////////////////////////////////////////////////////////////////////////////////

export class Opinionated_VPC{

    //Class Variables/Properties:
    stack: cdk.Stack;
    config: Opinionated_VPC_Config_Data;
    vpc: ec2.Vpc;

    //Class Constructor:
    constructor(storage_for_stacks_state: Construct, id_for_stack_and_vpc: string, stack_config: cdk.StackProps) {
        this.stack = new cdk.Stack(storage_for_stacks_state, id_for_stack_and_vpc, stack_config);
        this.config = new Opinionated_VPC_Config_Data(id_for_stack_and_vpc);
    }//end constructor of Opinionated_VPC

    //Class Functions:
    apply_global_baseline_vpc_config(){ global_baseline_vpc_config.apply_config(this.config,this.stack); }
    apply_my_orgs_baseline_vpc_config(){ my_orgs_baseline_vpc_config.apply_config(this.config,this.stack); }
    apply_lower_envs_vpc_config(){ lower_envs_vpc_config.apply_config(this.config,this.stack); }
    apply_higher_envs_vpc_config(){ higher_envs_vpc_config.apply_config(this.config,this.stack); }
    deploy_vpc_construct_into_this_objects_stack(){

        //The following is to prevent creation 2 VPCs with the same name:
        //Plausible values of this.config.id = "lower-envs-vpc" or "higher-envs-vpc"
        check_for_partially_deleted_vpc_to_prevent_error(this.config.id, this.stack);

        //https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.VpcProps.html
        this.vpc = new ec2.Vpc(this.stack, this.config.id, {
            vpcName: this.config.id,
            natGatewayProvider: this.config.natGatewayProvider,
            natGateways: this.config.numNatGateways,
            ipProtocol: ec2.IpProtocol.DUAL_STACK,
            ipAddresses: ec2.IpAddresses.cidr(this.config.vpcNetworkWithCIDRSlash),
            ipv6Addresses: ec2.Ipv6Addresses.amazonProvided(),
            vpnGateway: this.config.provisionVPN,
            subnetConfiguration: [
                { 
                    name: "Public", 
                    subnetType: ec2.SubnetType.PUBLIC,
                    cidrMask: this.config.publicSubNetCIDRSlash,
                    mapPublicIpOnLaunch: true, //<--this is temporarily needed for fck-NAT to work,
                    //until the following is resolved https://github.com/AndrewGuenther/cdk-fck-nat/issues/344
                    ipv6AssignAddressOnCreation: true,
                },
                { 
                    name: "Private",
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidrMask: this.config.privateSubNetCIDRSlash,
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

        //v-- Fck-NAT compatibility requirement:
        if(this.config.natGatewayProvider instanceof FckNatInstanceProvider){
            //v-- Configure Security Group
            (this.config.natGatewayProvider as FckNatInstanceProvider).securityGroup
                .addIngressRule(
                    ec2.Peer.ipv4(this.config.vpcNetworkWithCIDRSlash),
                    ec2.Port.allTraffic(),
                    "Allow vpc clients ingress into NAT, to enable outbound internet connectivity."
                );
            //v-- UX Improvement: Add Name Tag to SG
            let sg_construct = this.vpc.node.findChild('NatSecurityGroup').node.defaultChild!;//!=not null, true due to if
            cdk.Tags.of(sg_construct).add("Name", `${this.config.id}/nat-gw`); 
        } /*Note about the above logic in the if statement:
        The ability to customize NAT GW's SG is limited, to the above methodology.
        Normally SG's can be customized further using other methodologies, but those won't work here.
        In this case the VPC Construct only allows the above methodology.
        The above methodology is able to allow partial customization, 
        while avoiding a circular reference scenario:
        1. when constructing vpc with ec2-based NAT, it's required the nat-gw object be fully initialized.
        2. nat-gw's constructor mentions sg as an optional parameter, but that can't be used, because
        3. sg's constructor requires a fully initialized vpc to exist.
        */

        //v-- UX Improvement: Add configured tags to VPC
        this.config.tags?.forEach((tag,i) => {
            cdk.Tags.of(this.vpc).add(tag.key, tag.value);
        });

        //v-- UX Improvement: Improved Naming for Subnets and NAT-GWs/NAT-Instances
        const publicSubnets = this.vpc.selectSubnets({subnetType: ec2.SubnetType.PUBLIC}).subnets;
        const privateSubnets = this.vpc.selectSubnets({subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}).subnets;
        publicSubnets.forEach((subnet, i) => {
            const subnetName: string = `${this.config.id}/PublicSubnet${i+1}/${subnet.availabilityZone}`;
            const NAT_GW_Name: string = `${subnetName}/NAT-GW`;
            cdk.Tags.of(subnet).add("Name", subnetName);
            cdk.Tags.of(subnet).add("kubernetes.io/role/elb", "1");
            //Note tryFindChild values correspond to CF Stack's Resources Tab
            let potential_NAT_ASG = this.vpc.node.tryFindChild(`PublicSubnet${i+1}`)?.node.tryFindChild('FckNatAsg');
            let potential_NAT_GW = this.vpc.node.tryFindChild(`PublicSubnet${i+1}`)?.node.tryFindChild('NATGateway');
            if(potential_NAT_ASG){ cdk.Tags.of(potential_NAT_ASG).add("Name", NAT_GW_Name) };
            if(potential_NAT_GW){ cdk.Tags.of(potential_NAT_GW).add("Name", NAT_GW_Name) };
        });
        privateSubnets.forEach((subnet, i) => {
            cdk.Tags.of(subnet).add("Name", `${this.config.id}/PrivateSubnet${i+1}/${subnet.availabilityZone}`);
            cdk.Tags.of(subnet).add("kubernetes.io/role/internal-elb", "1");
        });
        //Note the VPC's default SG is blank, not tagable, not editable, this seems to be by design. AWS Foundational
        //Security Best Practices state The VPC default security group should not allow inbound and outbound traffic.

    }//end deploy_vpc_construct_into_this_objects_stack()

}//end class of Opinionated_VPC

///////////////////////////////////////////////////////////////////////////////////////////////////

function check_for_partially_deleted_vpc_to_prevent_error(vpc_name_tag: string, stack: cdk.Stack){
    /* Why this exists:
    Earlier ran into a bug where more than 1 instance of lower-envs-vpcs was created
    cdk's ec2.Vpc.fromLookup() is useful for importing pre-existing VPC
    but is bad for acting as an existance check, because non-existence triggers error
    so using aws cli as more flexible fallback option to try to prevent the issue.
    */
    const cmd = `aws ec2 describe-vpcs --filter Name=tag:Name,Values=${vpc_name_tag} --query "Vpcs[].VpcId" | tr -d '\r\n []"'`
    //` | jq '.Aliases[] | select(.AliasName == "${kmsKeyAlias}") | .TargetKeyId'`
    const cmd_results = execSync(cmd).toString();
    // Plausible Values to expect:
    // cmd_results===""
    // cmd_results==="vpc-0f79593fc83da0b82" (Note: If you console.log it you wouldn't see doublequotes)
    if(cmd_results===""){ return; } //If no pre-existing vpc detected all good, resume creation.
    else{ //if pre-existing vpc detected, check for partially deleted instance of VPC stack to avoid error.
        const potential_vpc_id=cmd_results;
        let vpc = ec2.Vpc.fromLookup(stack, 'vpc-lookup', {
            isDefault: false,
            tags: { ["Name"]: vpc_name_tag },
            vpcId: potential_vpc_id,
        });
        if(vpc.publicSubnets.length===0){
            const error_msg = `VPC with tag "Name: ${vpc_name_tag}", was detected to have 0 public subnets.\n`+
                              "This usually means:\n"+
                              "* cdk destroy was run against this vpc, and an incomplete destroy occured.\n"+
                              "* If you were to allow this program to continue, by commenting out the error check.\n"+
                              "  Then you'd end up with 2 VPCs with the same name, and that'd cause EKS provisioning failures.\n"+
                              "\n"+
                              "So: \n"+
                              "* The program has been stopped to show the error sooner rather than later.\n"+
                              "\n"+
                              "Resolution Options:\n"+
                              "* Option 1: Manually fully delete the partially destroyed VPC, then re-run this to re-create.\n"+
                              "* Option 2: Manage VPC outside of this program (manually or otherwise) & Import it into eks\n"+
                              `  * In ./bin/cdk-main.ts, comment out the vpc stack named ${vpc_name_tag}\n`+
                              "  * In ./config/eks/lower_envs_eks_config.ts  or  higher_envs_eks_config.ts\n"+
                              '    1. Comment out config.setVpcByName("lower-envs-vpc", config, stack);\n'+
                              '    2. Set config.setVpcById("vpc-0dbcacb511f9bac4e", config, stack);\n';
            console.log(error_msg);
            throw "Edge Case Error Detected: Requesting Human Intervention";
        }
    }
    return;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
