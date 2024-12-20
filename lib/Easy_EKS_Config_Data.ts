import { KubernetesVersion } from 'aws-cdk-lib/aws-eks';
import * as blueprints from '@aws-quickstart/eks-blueprints'; 
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';

export enum observabilityOptions {
    None,
    Frugal_Grafana_Prometheus_Loki
};

export class Easy_EKS_Config_Data { //This object just holds config data.
    //Typescript(TS) readability notes
    //Config_Var: Data_Type
    //(var?: is TS syntax to ignore initial null value)
    id: string; //id of cloud formation stack and eks cluster
    vpc: ec2.Vpc; //populated with pre-existing VPC
    kubernetesVersion: KubernetesVersion;
    tags?: { [key: string]: string };
    ipMode: eks.IpFamily;
    clusterAdminAccessEksApiArns?: string[];
    clusterViewerAccessAwsAuthConfigmapAccounts?: string[]; //only aws-auth configmap supports accounts
    clusterAddOns?: Map<string, blueprints.ClusterAddOn>;
    kmsKeyAlias: string; //kms key with this alias will be created or reused if pre-existing
    observabilityOption: observabilityOptions;
  

  
    constructor(id_for_stack_and_eks: string){
        this.id = id_for_stack_and_eks; /*
        Constructor with minimal args is on purpose for desired UX of "builder pattern".
        The idea is to add partial configuration snippets over time/as multiple operations
        rather than populate a complete config all at once in one go.*/
        this.observabilityOption = observabilityOptions.None;
    } 
  
  
  
    //Config Snippet Population Methods
    setVpcById(vpcId: string, config: Easy_EKS_Config_Data, stack: cdk.Stack){
        const pre_existing_vpc = ec2.Vpc.fromLookup(stack,'pre-existing-vpc', {
            vpcId: vpcId,
        });
        this.vpc = pre_existing_vpc as ec2.Vpc;
    }
    setVpcByName(vpcName: string, config: Easy_EKS_Config_Data, stack: cdk.Stack){ 
        const pre_existing_vpc = ec2.Vpc.fromLookup(stack,'pre-existing-vpc', {
            isDefault: false,
            tags: { ["Name"]: vpcName },
        });
        if(vpcName === "lower-envs-vpc" || vpcName === "higher-envs-vpc"){
            cdk.Annotations.of(stack).acknowledgeWarning('@aws-cdk/aws-eks:clusterMustManuallyTagSubnet');
            //By default you'll see a false positive warning message about needing to manually tag Subnets
            //If you're using the vpc naming convention suggested by this automation, then the automation
            //has already taken care of it, so this disables the warning for vpcs created by this automation.
        }
        this.vpc = pre_existing_vpc as ec2.Vpc;
    }
    setKubernetesVersion(version: KubernetesVersion){ this.kubernetesVersion = version; }
    addTag(key: string, value: string){ 
        if(this.tags === undefined){ this.tags = { [key] : value } }
        else{ this.tags = { ...this.tags, [key] : value }}
    }
    setIpMode(ipMode: eks.IpFamily){ this.ipMode = ipMode; }
    addClusterAdminARN(arn:string){        //v--initialize if undefined
        if(this.clusterAdminAccessEksApiArns === undefined){ this.clusterAdminAccessEksApiArns = [arn] } 
        else{ this.clusterAdminAccessEksApiArns.push(arn); } //push means add to end of array
    }
    addClusterViewerAccount(account:string){        //v--initialize if undefined
        if(this.clusterViewerAccessAwsAuthConfigmapAccounts === undefined){ this.clusterViewerAccessAwsAuthConfigmapAccounts = [account] } 
        else{ this.clusterViewerAccessAwsAuthConfigmapAccounts.push(account); } //push means add to end of array
    }
    addAddOn(addon: blueprints.ClusterAddOn){
        type AddOnObject = { props: { name: string }, coreAddOnProps: { addOnName: string} };
        let addOnName: string;
        const case1=(JSON.parse(JSON.stringify(addon)) as AddOnObject).props?.name;
        const case2=addOnName=(JSON.parse(JSON.stringify(addon)) as AddOnObject).coreAddOnProps?.addOnName;
        if(case1){addOnName=case1};
        if(case2){addOnName=case2};
    
        if(this.clusterAddOns === undefined){ 
            this.clusterAddOns = new Map<string, blueprints.ClusterAddOn>(); //<-- initialize if undefined
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
    setKmsKeyAlias(kms_key_alias: string){
        /*Note (About UX improvement logic):
        Expectation is for end user to pass in value like "eks/lower-envs",
        as that's what they'll see in the AWS Web GUI Console; however, the cdk library needs "alias/"
        in front. Ex: "alias/eks/lower-envs".
        This will check if string starts with "alias/", and add it if not there, for a better UX.
        */
        if(kms_key_alias.startsWith('alias/')){ this.kmsKeyAlias = kms_key_alias; }
        else{ this.kmsKeyAlias = `alias/${kms_key_alias}`; }
    }
    setObservabilityToFrugalGrafanaPrometheusLoki(){
        this.observabilityOption = observabilityOptions.Frugal_Grafana_Prometheus_Loki;
    }


  
    //The following converts an internally used data type to a conventionally expected data type
    getClusterAddons():Array<blueprints.ClusterAddOn> {//<--declaring return type
        let eks_blueprints_expected_format: Array<blueprints.ClusterAddOn> = [];
        if(this.clusterAddOns){//<-- JS falsy statement meaning if not empty
            eks_blueprints_expected_format = Array.from(this.clusterAddOns.values());
        }
        return eks_blueprints_expected_format;
    }

}//end of Easy_EKS_Config_Data
