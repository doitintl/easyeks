import { KubernetesVersion } from 'aws-cdk-lib/aws-eks';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';


type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;
type EKSAddOnInput = Optional<eks.CfnAddonProps, 'clusterName'>; //makes clusterName Optional parameter


export class Easy_EKS_Config_Data { //This object just holds config data.
    //Typescript(TS) readability notes
    //Config_Var: Data_Type
    //(var?: is TS syntax to ignore initial null value)
    id: string; //id of cloud formation stack and eks cluster
    vpc: ec2.Vpc; //populated with pre-existing VPC
    kubernetesVersion: KubernetesVersion;
    kubectlLayer: cdk.aws_lambda.ILayerVersion;
    tags?: { [key: string]: string };
    ipMode: eks.IpFamily;
    clusterAdminAccessEksApiArns?: string[];
    clusterViewerAccessAwsAuthConfigmapAccounts?: string[]; //only aws-auth configmap supports accounts
    eksAddOnsMap?: Map<string, EKSAddOnInput>; //Map enables value override between configs (global_baseline, my_orgs_baseline, lower_envs_eks, and dev)
    kmsKeyAlias: string; //kms key with this alias will be created or reused if pre-existing
    baselineNodesNumber: number;
    baselineNodesType: eks.CapacityType; //enum eks.CapacityType.SPOT or eks.CapacityType.ON_DEMAND
    workerNodeRole: iam.Role; //used by baselineMNG & Karpenter
    constructor(id_for_stack_and_eks: string){
        this.id = id_for_stack_and_eks; /*
        Constructor with minimal args is on purpose for desired UX of "builder pattern".
        The idea is to add partial configuration snippets over time/as multiple operations
        rather than populate a complete config all at once in one go.*/
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
    setKubectlLayer(version: cdk.aws_lambda.ILayerVersion ){ this.kubectlLayer = version; }
    addTag(key: string, value: string){ 
        if(this.tags === undefined){ this.tags = { [key] : value } }
        else{ this.tags = { ...this.tags, [key] : value }}
    }
    setBaselineMNGSize(num_baseline_nodes: number){
        this.baselineNodesNumber = num_baseline_nodes;
    }
    setBaselineMNGType(baseline_node_type: eks.CapacityType){
        this.baselineNodesType = baseline_node_type;
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
    addEKSAddon(name:string, EKSAddOnProps:EKSAddOnInput){
        if(this.eksAddOnsMap === undefined){
            this.eksAddOnsMap = new Map<string, EKSAddOnInput>(); //initialize if undefined
            this.eksAddOnsMap.set(name, EKSAddOnProps); //<-- add Key Value Entry to Map
        }
        else{
            this.eksAddOnsMap.set(name, EKSAddOnProps);  //<-- add Key Value Entry to Map
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

}//end of Easy_EKS_Config_Data
