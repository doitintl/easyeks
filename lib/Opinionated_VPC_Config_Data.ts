import { FckNatInstanceProvider, FckNatInstanceProps } from 'cdk-fck-nat' //source: npm install cdk-fck-nat@latest
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class Opinionated_VPC_Config_Data { //This object just holds config data.
  //Typescript(TS) readability notes
  //Config_Var: Data_Type
  //(var?: is TS syntax to ignore initial null value)
  stackId: string;
  account: string;
  region: string;
  tags?: { [key: string]: string };
  natGatewayProvider: ec2.NatProvider;
  //  ipv4CIDR: object;
  



  constructor(stackId: string){
      this.stackId = stackId; /*
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
  setNatGatewayProviderAsFckNat(props: FckNatInstanceProps){
    this.natGatewayProvider = new FckNatInstanceProvider( props );
  }
  setNatGatewayProviderAsAwsManagedNat(){
    this.natGatewayProvider = ec2.NatProvider.gateway();
  }



}//end Opinionated_VPC_Config_Data
