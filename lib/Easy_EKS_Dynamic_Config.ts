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
    private static latest_version_of_vpc_cni_eks_addon: string;
    private static latest_version_of_coredns_eks_addon: string;
    private static latest_version_of_metrics_server_eks_addon: string;
    private static latest_version_of_eks_node_monitoring_agent_eks_addon: string;
    private static latest_version_of_ebs_csi_eks_addon: string;
    private static latest_version_of_amazon_cloudwatch_observability_eks_addon: string;
    private static latest_version_of_kube_proxy_1_31_eks_addon: string;
    private static latest_version_of_kube_proxy_1_32_eks_addon: string;
    private static latest_version_of_kube_proxy_1_33_eks_addon: string;
    private static arn_of_aws_iam_identity_running_cdk_deploy: string; 
    //^-- Purpose: Get's added to list of eks cluster admin users able to run 'aws eks update-kubeconfig --region ca-central-1 --name dev1-eks'


    
    private constructor(){ //singleton pattern's constructor is guaranteed to run only once
        //Initializing Genericly Reusable Config (that tends to be safe to use latest values of)
        // Note:
        // | tr -d '"|\n|\r'    means   translate delete (as in remove) double quote & new lines
        // | tr -d '"| |\n|\r'  means   translate delete (as in remove) double quote, white spaces, & new lines
        const cmd1 = `aws sts get-caller-identity | jq .Arn | tr -d '"|\n|\r'`;
        Easy_EKS_Dynamic_Config.arn_of_aws_iam_identity_running_cdk_deploy = stdout_of_cmd(cmd1); //plausible value = arn:aws:iam::111122223333:user/example

        const cmd2 = `curl https://raw.githubusercontent.com/deliveryhero/helm-charts/refs/heads/master/stable/node-local-dns/Chart.yaml | grep version: | cut -d ':' -f 2 | tr -d '"| |\n|\r'`;
        Easy_EKS_Dynamic_Config.latest_version_of_node_local_dns_cache_helm_chart = stdout_of_cmd(cmd2); //plausible value = 2.1.10

        const cmd3 = `aws eks describe-addon-versions --kubernetes-version=1.33 --addon-name=vpc-cni --query='addons[].addonVersions[].addonVersion' | jq '.[0]' | tr -d '"|\n|\r'`;
        Easy_EKS_Dynamic_Config.latest_version_of_vpc_cni_eks_addon = stdout_of_cmd(cmd3); //plausible value = v1.20.1-eksbuild.3

        const cmd4 = `aws eks describe-addon-versions --kubernetes-version=1.33 --addon-name=coredns --query='addons[].addonVersions[].addonVersion' | jq '.[0]' | tr -d '"|\n|\r'`;
        Easy_EKS_Dynamic_Config.latest_version_of_coredns_eks_addon = stdout_of_cmd(cmd4); //plausible value = v1.12.3-eksbuild.1

        const cmd5 = `aws eks describe-addon-versions --kubernetes-version=1.33 --addon-name=metrics-server --query='addons[].addonVersions[].addonVersion' | jq '.[0]' | tr -d '"|\n|\r'`;
        Easy_EKS_Dynamic_Config.latest_version_of_metrics_server_eks_addon = stdout_of_cmd(cmd5); //plausible value = v0.8.0-eksbuild.2

        const cmd6 = `aws eks describe-addon-versions --kubernetes-version=1.33 --addon-name=eks-node-monitoring-agent --query='addons[].addonVersions[].addonVersion' | jq '.[0]' | tr -d '"|\n|\r'`;
        Easy_EKS_Dynamic_Config.latest_version_of_eks_node_monitoring_agent_eks_addon = stdout_of_cmd(cmd6); //plausible value = v1.4.0-eksbuild.2

        const cmd7 = `aws eks describe-addon-versions --kubernetes-version=1.33 --addon-name=aws-ebs-csi-driver --query='addons[].addonVersions[].addonVersion' | jq '.[0]' | tr -d '"|\n|\r'`;
        Easy_EKS_Dynamic_Config.latest_version_of_ebs_csi_eks_addon = stdout_of_cmd(cmd7); //plausible value = v1.48.0-eksbuild.2

        const cmd8 = `aws eks describe-addon-versions --kubernetes-version=1.33 --addon-name=amazon-cloudwatch-observability --query='addons[].addonVersions[].addonVersion' | jq '.[0]' | tr -d '"|\n|\r'`;
        Easy_EKS_Dynamic_Config.latest_version_of_amazon_cloudwatch_observability_eks_addon = stdout_of_cmd(cmd8); //plausible value = v4.4.0-eksbuild.1

        const kp31 = `aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=kube-proxy --query='addons[].addonVersions[].addonVersion' | jq '.[0]' | tr -d '"|\n|\r'`;
        Easy_EKS_Dynamic_Config.latest_version_of_kube_proxy_1_31_eks_addon = stdout_of_cmd(kp31); //plausible value = v1.31.10-eksbuild.8

        const kp32 = `aws eks describe-addon-versions --kubernetes-version=1.32 --addon-name=kube-proxy --query='addons[].addonVersions[].addonVersion' | jq '.[0]' | tr -d '"|\n|\r'`;
        Easy_EKS_Dynamic_Config.latest_version_of_kube_proxy_1_32_eks_addon = stdout_of_cmd(kp32); //plausible value = v1.32.6-eksbuild.8

        const kp33 = `aws eks describe-addon-versions --kubernetes-version=1.33 --addon-name=kube-proxy --query='addons[].addonVersions[].addonVersion' | jq '.[0]' | tr -d '"|\n|\r'`;
        Easy_EKS_Dynamic_Config.latest_version_of_kube_proxy_1_33_eks_addon = stdout_of_cmd(kp33); //plausible value = v1.33.3-eksbuild.6
    }//end constructor

    private static ensure_init(){ if(!Easy_EKS_Dynamic_Config.singleton){ Easy_EKS_Dynamic_Config.singleton = new Easy_EKS_Dynamic_Config(); } }
    public static get_ARN_of_IAM_Identity_running_CDK_Deploy(): string{
        this.ensure_init();
        return this.arn_of_aws_iam_identity_running_cdk_deploy;
    }
    public static get_latest_version_of_node_local_dns_cache_helm_chart(): string{
        this.ensure_init();
        return this.latest_version_of_node_local_dns_cache_helm_chart;
    }
    public static get_latest_version_of_vpc_cni_eks_addon(): string{
        this.ensure_init();
        return this.latest_version_of_vpc_cni_eks_addon;
    }
    public static get_latest_version_of_coredns_eks_addon(): string{
        this.ensure_init();
        return this.latest_version_of_coredns_eks_addon;
    }
    public static get_latest_version_of_metrics_server_eks_addon(): string{
        this.ensure_init();
        return this.latest_version_of_metrics_server_eks_addon;
    }
    public static get_latest_version_of_eks_node_monitoring_agent_eks_addon(): string{
        this.ensure_init();
        return this.latest_version_of_eks_node_monitoring_agent_eks_addon;
    }
    public static get_latest_version_of_ebs_csi_eks_addon(): string{
        this.ensure_init();
        return this.latest_version_of_ebs_csi_eks_addon;
    }
    public static get_latest_version_of_amazon_cloudwatch_observability_eks_addon(): string{
        this.ensure_init();
        return this.latest_version_of_amazon_cloudwatch_observability_eks_addon;
    }
    public static get_latest_version_of_kube_proxy_1_31_eks_addon(): string{
        this.ensure_init();
        return this.latest_version_of_kube_proxy_1_31_eks_addon;
    }
    public static get_latest_version_of_kube_proxy_1_32_eks_addon(): string{
        this.ensure_init();
        return this.latest_version_of_kube_proxy_1_32_eks_addon;
    }
    public static get_latest_version_of_kube_proxy_1_33_eks_addon(): string{
        this.ensure_init();
        return this.latest_version_of_kube_proxy_1_33_eks_addon;
    }

} //end class Easy_EKS_Dynamic_Config
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function stdout_of_cmd(cmd: string): string{
    const cmd_results = shell.exec(cmd, {silent:true});
    if(cmd_results.code===0){ return cmd_results.stdout; }
    else{ throw(`cmd: ${cmd} of lib/Easy_EKS_Dynamic_Config.ts threw error`); }
}//end stdout_of_cmd(cmd)

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
