//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Utility Imports:
import * as shell from 'shelljs'; //npm install shelljs && npm i --save-dev @types/shelljs
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export class Easy_EKS_Dynamic_Config { 
    // This class dynamically fetches latest values
    // A singleton pattern is used to avoid multiple lookups.
    private static singleton: Easy_EKS_Dynamic_Config;

    //v-- Purpose: Genericly Reusable Config (that tends to be safe to use latest values of)
    private static latest_version_of_node_local_dns_cache_helm_chart: string;
    private static latest_version_of_y: string;
    private static latest_version_of_z: string;
    private static arn_of_aws_iam_identity_running_cdk_deploy: string; 
    //^-- Purpose: Get's added to list of eks cluster admin users able to run 'aws eks update-kubeconfig --region ca-central-1 --name dev1-eks'


    
    private constructor(){ //singleton pattern's constructor is guaranteed to run only once

        //Initializing Genericly Reusable Config (that tends to be safe to use latest values of)
        const cmd1 = `aws sts get-caller-identity | jq .Arn | tr -d '"|\n|\r'`; //translate delete (remove) double quote & new lines
        const cmd1_results = shell.exec(cmd1, {silent:true});
        if(cmd1_results.code===0){
            Easy_EKS_Dynamic_Config.arn_of_aws_iam_identity_running_cdk_deploy = cmd1_results.stdout; //plausible value = arn:aws:iam::111122223333:user/example
        }
        else{ throw('cmd1 of lib/Easy_EKS_Dynamic_Config.ts threw error'); }

        const cmd2 = `curl https://raw.githubusercontent.com/deliveryhero/helm-charts/refs/heads/master/stable/node-local-dns/Chart.yaml | grep version: | cut -d ':' -f 2 | tr -d '"| |\n|\r'`;
        const cmd2_results = shell.exec(cmd2, {silent:true});
        if(cmd2_results.code===0){
            Easy_EKS_Dynamic_Config.latest_version_of_node_local_dns_cache_helm_chart = cmd2_results.stdout; //plausible value = arn:aws:iam::111122223333:user/example
        }
        else{ throw('cmd2 of lib/Easy_EKS_Dynamic_Config.ts threw error'); }

    }//end constructor
    private static ensure_init(){ if(!Easy_EKS_Dynamic_Config.singleton){ Easy_EKS_Dynamic_Config.singleton = new Easy_EKS_Dynamic_Config(); } }
    public static get_ARN_of_IAM_Identity_running_CDK_Deploy(): string{
        Easy_EKS_Dynamic_Config.ensure_init();
        return Easy_EKS_Dynamic_Config.arn_of_aws_iam_identity_running_cdk_deploy; //returns arn of IAM user/role identity that ran `cdk deploy dev1-eks-cluster`
    }
    public static get_latest_version_of_node_local_dns_cache_helm_chart(): string{
        Easy_EKS_Dynamic_Config.ensure_init();
        return Easy_EKS_Dynamic_Config.latest_version_of_node_local_dns_cache_helm_chart; //returns arn of IAM user/role identity that ran `cdk deploy dev1-eks-cluster`
    }
} //end CDK_Deployer
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
