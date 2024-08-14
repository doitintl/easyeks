import { KubernetesVersion } from 'aws-cdk-lib/aws-eks';
import * as blueprints from '@aws-quickstart/eks-blueprints'; 

export class Easy_EKS_Config_Data { //This object just holds config data.
  //Typescript(TS) readability notes
  //Config_Var: Data_Type
  //(var?: is TS syntax to ignore initial null value)
  account?: string;
  region?: string;
  kubernetesVersion: KubernetesVersion;
  tags?: { [key: string]: string };
  clusterAdminARNs?: string[];
  clusterAddOns?: Array<blueprints.ClusterAddOn>;

  constructor(){ /*
  Constructor with no args is on purpose for desired UX
  The idea is to add partial configuration snippets over time/as multiple operations
  rather than populate a complete config all at once in one go.*/
  //this.clusterAddOns = [ new blueprints.addons.KubeProxyAddOn() ];
  } 

  //Config Snippet Population Methods
  setAccount(account: string){ this.account = account; }
  setRegion(region: string){ this.region = region; }
  setKubernetesVersion(version: KubernetesVersion){ this.kubernetesVersion = version; }
  addTag(key: string, value: string){ 
    // if(this.tags === undefined){ this.tags = { [key] : value } }
    // else{ this.tags = { ...this.tags, [key] : value }
    this.tags = { ...this.tags, [key] : value }; 
  }
  addClusterAdminARN(arn:string){ //initialize if undfined
    if(this.clusterAdminARNs === undefined){ this.clusterAdminARNs = [arn] }
    else{ this.clusterAdminARNs.push(arn); } //push means add to end of array
  } 
  addAddOn(addon: blueprints.ClusterAddOn){ //initialize if undfined
    if(this.clusterAddOns === undefined){ this.clusterAddOns = [addon] }
    else{ this.clusterAddOns.push(addon); } //push means add to end of array
  }
}
