import { FckNatInstanceProvider, FckNatInstanceProps } from 'cdk-fck-nat' //source: npm install cdk-fck-nat@latest
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class Opinionated_VPC_Config_Data { //This object just holds config data.
  //Typescript(TS) readability notes
  //Config_Var: Data_Type
  //(var?: is TS syntax to ignore initial null value)
  stackID: string;
  account: string;
  region: string;
  tags?: { [key: string]: string };
  natGatewayProvider: ec2.NatProvider;
  numNatGateways: number;
  provisionVPN: boolean;
  vpcNetworkWithCIDRSlash: string;
  publicSubNetCIDRSlash: number;
  privateSubNetCIDRSlash: number;
  //Future UX Improvement: Allow explicit control over subnet CIDRs 
  //Blocked by: Upstream CDK Improvements (subscribed to updates)
  //https://github.com/aws/aws-cdk/issues/5927#issuecomment-2127888388
  //https://github.com/aws/aws-cdk/issues/3931



  constructor(stackID: string){
      this.stackID = stackID; /*
      Constructor with minimal args is on purpose for desired UX
      The idea is to add partial configuration snippets over time/as multiple operations
      rather than populate a complete config all at once in one go.*/
  }



  //Config Snippet Population Methods
  setAccount(account: string){ this.account = account; }
  setRegion(region: string){ this.region = region; }
  addTag(key: string, value: string){ 
    if(this.tags === undefined){ this.tags = { [key] : value } }
    else{ this.tags = { ...this.tags, [key] : value }}
  }
  setNatGatewayProviderAsFckNat(stack_to_deploy_into: cdk.Stack, props: FckNatInstanceProps){
    //fix for https://github.com/AndrewGuenther/cdk-fck-nat/issues/118
    const sg_construct = new Construct(stack_to_deploy_into, "fck-NAT-security-group");
    // const sg = new ec2.SecurityGroup(sg_construct, "fck-nat-sg", {
    //   vpc: 'TODO', //the vpc in which to create the SG,
    //   allowAllIpv6Outbound: true,
    //   allowAllOutbound: true,
    //   description: "allow NAT to accept inbound traffic",
    //   securityGroupName: "fck-nat-sg"
    // });
    const modified_properties:FckNatInstanceProps = { 
      instanceType: props.instanceType,
      cloudWatchConfigParam: props?.cloudWatchConfigParam,
      eipPool: props?.eipPool,
      enableCloudWatch: props.enableCloudWatch,
      enableSsm: props.enableSsm,
      keyName: props.keyName,
      keyPair: props.keyPair,
      machineImage: props?.machineImage,
      // securityGroup: sg,
      userData: props?.userData
    };
    this.natGatewayProvider = new FckNatInstanceProvider( props );
  }
  setNatGatewayProviderAsAwsManagedNat(){
    this.natGatewayProvider = ec2.NatProvider.gateway();
  }
  setNumNatGateways(number: number){ this.numNatGateways = number; }
  setVpcIPv4CIDR(vpcNetworkWithCIDRSlash: string){ this.vpcNetworkWithCIDRSlash = vpcNetworkWithCIDRSlash; }
  setPublicSubnetCIDRSlash(cidrSlash: number){ this.publicSubNetCIDRSlash = cidrSlash; }
  setPrivateSubnetCIDRSlash(cidrSlash: number){ this.privateSubNetCIDRSlash = cidrSlash; }
  setProvisionVPN(vpn: boolean){ this.provisionVPN = vpn; }

}//end Opinionated_VPC_Config_Data
