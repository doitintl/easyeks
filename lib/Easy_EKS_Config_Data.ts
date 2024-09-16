import { KubernetesVersion } from 'aws-cdk-lib/aws-eks';
import * as blueprints from '@aws-quickstart/eks-blueprints'; 


export class Easy_EKS_Config_Data { //This object just holds config data.
  //Typescript(TS) readability notes
  //Config_Var: Data_Type
  //(var?: is TS syntax to ignore initial null value)
  stackId: string;
  account: string;
  region: string;
  kubernetesVersion: KubernetesVersion;
  tags?: { [key: string]: string };
  clusterAdminARNs?: string[];
  clusterAddOns?: Map<string, blueprints.ClusterAddOn>;



  constructor(stackId: string){
  this.stackId = stackId; /*
  Constructor with minimal args is on purpose for desired UX of "builder pattern".
  The idea is to add partial configuration snippets over time/as multiple operations
  rather than populate a complete config all at once in one go.*/
  } 



  //Config Snippet Population Methods
  setAccount(account: string){ this.account = account; }
  setRegion(region: string){ this.region = region; }
  setKubernetesVersion(version: KubernetesVersion){ this.kubernetesVersion = version; }
  addTag(key: string, value: string){ 
    if(this.tags === undefined){ this.tags = { [key] : value } }
    else{ this.tags = { ...this.tags, [key] : value }}
  }
  addClusterAdminARN(arn:string){ 
    if(this.clusterAdminARNs === undefined){ this.clusterAdminARNs = [arn] } //<--initialize if undfined
    else{ this.clusterAdminARNs.push(arn); } //push means add to end of array
  } 
  addAddOn(addon: blueprints.ClusterAddOn){
    type AddOnObject = { props: { name: string }, coreAddOnProps: { addOnName: string} };
    let addOnName: string;
    const case1=(JSON.parse(JSON.stringify(addon)) as AddOnObject).props?.name;
    const case2=addOnName=(JSON.parse(JSON.stringify(addon)) as AddOnObject).coreAddOnProps?.addOnName;
    if(case1){addOnName=case1};
    if(case2){addOnName=case2};

    if(this.clusterAddOns === undefined){ 
      this.clusterAddOns = new Map<string, blueprints.ClusterAddOn>(); //<-- initialize if undfined
      this.clusterAddOns.set(addOnName, addon); //<-- add Key Value Entry to HashMap
    }
    else{
      this.clusterAddOns.set(addOnName, addon); //<-- add Key Value Entry to HashMap
      //If you're woundering why a HashMap is used instead of an Array
      //This is done to achieve a UX feature, where
      //If you define an AddOn in the global config and environment specific config
      //If it were an array, CDK would declare an error saying it already exists.
      //Since it's a Map, the newest entry can override the older entry
      //Which is a desired functionality for the sake of UX.
    } 
  }


  
  //The following converts an internally used data type to a conventionally expected data type
  getClusterAddons():Array<blueprints.ClusterAddOn> {//<--declaring return type
      let eks_blueprints_expected_format: Array<blueprints.ClusterAddOn> = [];
      if(this.clusterAddOns){//<-- JS falsy statement meaning if not empty
        eks_blueprints_expected_format = Array.from(this.clusterAddOns.values());
      }
      return eks_blueprints_expected_format;
  }

}//end of Class
