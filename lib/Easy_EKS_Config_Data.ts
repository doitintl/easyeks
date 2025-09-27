//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//AWS CDK Imports:
import { KubernetesVersion } from 'aws-cdk-lib/aws-eks';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Utility Imports:
import * as shell from 'shelljs'; //npm install shelljs && npm i --save-dev @types/shelljs
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Local Library Imports:
import { validateTag } from './Utilities';
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class Easy_EKS_Config_Data { //This object just holds config data.
    //Typescript(TS) readability notes
    //Config_Var: Data_Type
    //(var?: is TS syntax to ignore initial null value)
    cluster_name: string;
    cluster_region: string; //for convenience
    vpc: ec2.Vpc; //populated with pre-existing VPC
    kubernetesVersion: KubernetesVersion;
    kubectlLayer: cdk.aws_lambda.ILayerVersion;
    tags?: { [key: string]: string };
    ipMode: eks.IpFamily;
    clusterAdminAccessEksApiArns?: string[];
    clusterViewerAccessAwsAuthConfigmapAccounts?: string[]; //only aws-auth configmap supports accounts
    kmsKeyAlias: string; //kms key with this alias will be created or reused if pre-existing
    kmsKey: kms.IKey; //store pre-existing KMS key
    baselineNodesNumber: number;
    baselineNodesType: eks.CapacityType; //enum eks.CapacityType.SPOT or eks.CapacityType.ON_DEMAND
    workerNodeRole: iam.Role; //used by baselineMNG & Karpenter
    preexisting_cluster_detected: boolean; //true when cluster is detected to be pre-existing
    sg_id_of_cluster_nodes: string; //(cdk doesn't normally supply this, added for convenience)
    control_plane_logging_options_to_enable?: eks.ClusterLoggingTypes[]; //? is necessary as undefined is used to represent none



    constructor(cluster_name: string, cluster_region: string){
        this.cluster_name = cluster_name;
        this.cluster_region = cluster_region;
        this.preexisting_cluster_detected = true_when_cluster_exists(cluster_name, cluster_region);
        if(this.preexisting_cluster_detected){
            this.sg_id_of_cluster_nodes = lookup_sg_id_of_cluster_nodes(cluster_name, cluster_region);
        }
        //Constructor with minimal args is on purpose for desired UX of "builder pattern".
        //The idea is to add partial configuration snippets over time/as multiple operations
        //rather than populate a complete config all at once in one go.
    } 
  
  
  
    //Config Snippet Population Methods
    set_VPC_using_VPC_Id(vpcId: string, config: Easy_EKS_Config_Data, stack: cdk.Stack){
        const pre_existing_vpc = ec2.Vpc.fromLookup(stack,'pre-existing-vpc', {
            vpcId: vpcId,
        });
        this.vpc = pre_existing_vpc as ec2.Vpc;
    }
    set_VPC_using_name_tag(vpcName: string, config: Easy_EKS_Config_Data, stack: cdk.Stack){ 
        //Note: The following "normal cdk way of doing things" works 99% of the time
        //      const pre_existing_vpc = ec2.Vpc.fromLookup(stack,'pre-existing-vpc', {
        //          isDefault: false,
        //          tags: { ["Name"]: vpcName },
        //      });
        // I've replaced it with an alternative that should work 99.5% of the time, 
        // by translating name to id, then looking up by id.
        ////////////////////////////////////////////////////////////////////////////////
        // Explanation of Edge Case Problem: 
        // .fromLookup() uses cdk.context.json, which functions as a cache.
        // An edge case problem exists, where cdk destroy & re-deploy will fail, due
        // to outdated cache value, unless the user knows to run
        // cdk destroy --> `cdk context --clear` --> cdk re-deploy
        // This extra logic translates vpcName to id, then looks up by name and id,
        // which effectively eliminates the edge case and need for said specialized
        // knowledge of how to handle the edge case.
        ////////////////////////////////////////////////////////////////////////////////
        const cmd = `aws ec2 describe-vpcs --filter Name=tag:Name,Values=${vpcName} --query "Vpcs[].VpcId" | tr -d '\r\n []"'`
        const cmd_results = shell.exec(cmd, {silent:true}).stdout;
        // Plausible Values to expect:
        // case 1: cmd_results===""
        //         ^-- Occurs when vpc name not found. Would cause an error, which is desired behavior as we assume it should be found.
        // case 2: cmd_results==="vpc-0f79593fc83da0b82" (Note: If you console.log it you wouldn't see doublequotes)
        //         ^-- If name is found a single valid id "should" show up.
        //             I say "should", because a 2nd edge case of 2 VPCs having the same name is technically possible, but unlikey.
        const potential_vpc_id=cmd_results;
        const pre_existing_vpc = ec2.Vpc.fromLookup(stack,'pre-existing-vpc', {
            isDefault: false,
            tags: { ["Name"]: vpcName },
            vpcId: potential_vpc_id,
        });
        if(vpcName === "lower-envs-vpc" || vpcName === "higher-envs-vpc"){
            cdk.Annotations.of(stack).acknowledgeWarning('@aws-cdk/aws-eks:clusterMustManuallyTagSubnet');
            //By default you'll see a false positive warning message about needing to manually tag Subnets
            //If you're using the vpc naming convention suggested by this automation, then the automation
            //has already taken care of it, so this disables the warning for vpcs created by this automation.
        }
        this.vpc = pre_existing_vpc as ec2.Vpc;
    }
    set_clusters_version_of_Kubernetes(version: KubernetesVersion){ this.kubernetesVersion = version; }
    set_version_of_kubectl_used_by_lambda(version: cdk.aws_lambda.ILayerVersion ){ this.kubectlLayer = version; }
    add_tag(key: string, value: string){
        try {
            validateTag(key, value)
            if(this.tags === undefined){ this.tags = { [key] : value } }
            else{ this.tags = { ...this.tags, [key] : value } }
        } catch (error: any) {
            console.error("Error:", error.message)
            throw "Error validating tags. See details above"// Using throw here to stop the checks; otherwise an error will print out for every place this tag would be applied, and the process will continue
        }
    }
    set_number_of_baseline_nodes(num_baseline_nodes: number){
        this.baselineNodesNumber = num_baseline_nodes;
    }
    set_capacity_type_of_baseline_nodes(baseline_node_type: eks.CapacityType){
        this.baselineNodesType = baseline_node_type;
    }
    set_IPv4_or_IPv6(ipMode: eks.IpFamily){ this.ipMode = ipMode; }
    add_cluster_wide_kubectl_Admin_Access_using_ARN(arn:string){        //v--initialize if undefined
        if(this.clusterAdminAccessEksApiArns === undefined){ this.clusterAdminAccessEksApiArns = [arn]; }
        else{
            if(!this.clusterAdminAccessEksApiArns.includes(arn)){ //if value isn't already in array
                this.clusterAdminAccessEksApiArns.push(arn); //then push, as in add, to end of array
            }
        } 
    }
    grant_cluster_wide_Viewer_Access_to_all_IAM_Identities_within_AWS_Account(account:string){        //v--initialize if undefined
        if(this.clusterViewerAccessAwsAuthConfigmapAccounts === undefined){ this.clusterViewerAccessAwsAuthConfigmapAccounts = [account] } 
        else{
            if(!this.clusterViewerAccessAwsAuthConfigmapAccounts.includes(account)){ //if value isn't already in array
            this.clusterViewerAccessAwsAuthConfigmapAccounts.push(account); //then push, as in add, to end of array
            }
        } 
    }
    set_control_plane_logging_options_to_enable(array_of_control_plane_logging_options: eks.ClusterLoggingTypes[]){
        //If array is empty, then leave the variable as undefined (to avoid runtime error)
        if(array_of_control_plane_logging_options.length===0){ 
            this.control_plane_logging_options_to_enable = undefined;
        }
        else{ this.control_plane_logging_options_to_enable = array_of_control_plane_logging_options; }
    }
    set_KMS_Key_Alias_to_provision_and_reuse(kms_key_alias: string){
        /*Note (About UX improvement logic):
        Expectation is for end user to pass in value like "eks/lower-envs",
        as that's what they'll see in the AWS Web GUI Console; however, the cdk library needs "alias/"
        in front. Ex: "alias/eks/lower-envs".
        This will check if string starts with "alias/", and add it (if missing), for a better UX.
        */
        if(kms_key_alias.startsWith('alias/')){ this.kmsKeyAlias = kms_key_alias; }
        else{ this.kmsKeyAlias = `alias/${kms_key_alias}`; }
    }
    //Potential future logic mentioned in my_orgs_baseline_eks_config's storage class manifest
    // set_KMS_Key(stack: cdk.Stack){
    //     this.kmsKey = kms.Key.fromLookup(stack, 'pre-existing-kms-key', { aliasName: this.kmsKeyAlias });
    // } 
}//end of Easy_EKS_Config_Data
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function true_when_cluster_exists(cluster_name: string, region: string){
    const cmd = `aws eks describe-cluster --name=${cluster_name} --region=${region}`
    const cmd_return_code = shell.exec(cmd, {silent:true}).code;
    if(cmd_return_code===0){ return true; } //return code 0 = pre-existing cluster found
    else{ return false; } //return code 254 = cluster not found
}//end of true_when_cluster_exists()
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function lookup_sg_id_of_cluster_nodes(cluster_name: string, cluster_region: string){
    //This seems to be generated after cluster exists, so this logic only runs against pre-existing clusters
    let sg_id_of_cluster_nodes: string = "";
    const cmd_to_lookup_sg_id = `aws ec2 describe-security-groups --region=${cluster_region} \
                                --filters Name=tag:aws:eks:cluster-name,Values=${cluster_name} \
                                --filters Name=tag:kubernetes.io/cluster/${cluster_name},Values=owned \
                                --query "SecurityGroups[*].GroupId" \
                                --output text | tr -d '\n|\r'`; //<-- |tr -d, means translate delete (remove) new lines 
    const cmd_to_lookup_sg_id_results = shell.exec(cmd_to_lookup_sg_id, {silent:true});
    if(cmd_to_lookup_sg_id_results.code===0){
        sg_id_of_cluster_nodes = cmd_to_lookup_sg_id_results.stdout;
    }
    return sg_id_of_cluster_nodes; //"" or real-value, (should only return real-value when called against pre-existing cluster)
}//end of set_sg_id_of_cluster_nodes()
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
