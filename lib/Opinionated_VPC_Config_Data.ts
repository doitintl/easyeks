import { FckNatInstanceProvider, FckNatInstanceProps } from 'cdk-fck-nat' //source: npm install cdk-fck-nat@latest
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { validateTag } from './Utilities';

export class Opinionated_VPC_Config_Data { //This object just holds config data.
    //Typescript(TS) readability notes
    //Config_Var: Data_Type
    //(var?: is TS syntax to ignore initial null value)
    id: string; //id of cloud formation stack and vpc
    tags?: {key: string, value: string}[];
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
  
  
  
    constructor(id_for_stack_and_vpc: string){
        this.id = id_for_stack_and_vpc; /*
        Constructor with minimal args is on purpose for desired UX of "builder pattern".
        The idea is to add partial configuration snippets over time/as multiple operations
        rather than populate a complete config all at once in one go.*/
    }



    //Config Snippet Population Methods
    addTag(key: string, value: string){
        try {
            validateTag(key, value)
            if(this.tags === undefined){ this.tags = [{key: key, value: value}] }
            else{ this.tags.push({key: key, value: value}) }
        } catch (error: any) {
            console.error("Error:", error.message)
            throw "Error validating tags. See details above"// Using throw here to stop the checks; otherwise an error will print out for every place this tag would be applied, and the process will continue
        }
    }
    setNatGatewayProviderAsFckNat(props: FckNatInstanceProps){
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
