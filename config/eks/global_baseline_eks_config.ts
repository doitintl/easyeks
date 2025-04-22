import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as eks from 'aws-cdk-lib/aws-eks';
import request from 'sync-request-curl'; //npm install sync-request-curl (cdk requires sync functions, async not allowed)
//Intended Use: 
//A baseline config file (to be applied to all EasyEKS Clusters)
//That 95% of global users will feel comfortable using with 0 changes, but can change.

//export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster){ //config: is of type Easy_EKS_Config_Data
export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack){ //config: is of type Easy_EKS_Config_Data    
    config.addTag("AWS Tag Allowed Characters", "letters numbers + - = . _ : / @ WebSiteLinks");
    config.addTag("AWS Tag Forbidden Characters", "Hashtag Comma SingleQuote DoubleQuote Parenthesis QuestionMark Asterisk Ampersand https://docs.aws.amazon.com/codeguru/latest/bugbust-ug/limits-tags.html");
    config.addTag("IaC Tooling used for Provisioning and Management of this EKS Cluster", "cdk: a CLI tool that stands for AWS Cloud Development Kit.");
    config.addTag("Upstream Methodology Docs", "https://github.com/doitintl/eks-cdk-quickstart");
    //^-- NOTE: hashtag(#)   comma(,)   singlequote(')   doublequote(\")   parenthesis()   and more are not valid tag values
    //    https://docs.aws.amazon.com/codeguru/latest/bugbust-ug/limits-tags.html
    /*Note it's possible when updating tags, that you could see 
    An error like AWS::EKS::Nodegroup "Update is not supported for the following properties"
    If that happens temporarily edit the following line in Easy_EKS.ts
    this.cluster.addNodegroupCapacity(`default_MNG`, default_MNG);
    to
    this.cluster.addNodegroupCapacity(`default_MNG-1`, default_MNG);
    redeploy and it'll go through
    then rename it back
    Note: 
    After setting default_MNG-1, you may see ...is in UPDATE_ROLLBACK_FAILED state and can not be updated
    If so, go to CloudFormation -> stack -> Stack actions -> continue update rollback for stack - Advanced troubleshooting
    --> resources to skip - optional (check the box) --> Continue update rollback. 
    (wait 10 sec, then retry cdk deploy stack)
    */
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /*To see official names of all eks add-ons:
    aws eks describe-addon-versions  \
    --kubernetes-version=1.31 \
    --query 'sort_by(addons  &owner)[].{owner: owner, addonName: addonName}' \
    --output table
    */
    //global config has lowest precedence
    //my_orgs config replaces global config
    //lower_envs config replaces both of the above
    //dev env specific values overide all of the above
    //This holds true if you use the convience methods or mimic their order.
    //kube-proxy below is also defined in other config files, so the below config will be ignored, since the others have higher precedence.
    //Note if you don't specify a value like below it'll use the default value, suggestion is for my_orgs config to use latest.
    //You'll likely want to use overrides when envs are on different versions of Kubernetes.
    config.addEKSAddon('kube-proxy', {
      addonName: 'kube-proxy',
      resolveConflicts: 'OVERWRITE',
      configurationValues: '{}',
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // NOTICE: Don't add eks-pod-identity-agent via config.addEKSAddon(...omitted...);
    // It's purposefully left out to work around CDK bug https://github.com/aws/aws-cdk/issues/32580
    // The cdk bug relates to an error where there's a complaint about it already being present, if 2 things try to install it.
    // The AWS Load Balancer Controller installation logic, will trigger the installation of eks-pod-identity-agent addon.
    // https://github.com/aws/aws-cdk/pull/33891
    // ^-- A WIP fix exists
    // Note the IaC will deploy default (which isn't latest)
    // but if you manually update in GUI it'll stay updated
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}//end apply_config()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_workloads(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster){

}//end deploy_workloads()
