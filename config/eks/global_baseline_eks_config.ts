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
    */
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    //v--If you follow suggested order of application (global -> org -> env), then the set's functionally act as overrideable defaults.

    /*To see official names of all eks add-ons:
    aws eks describe-addon-versions  \
    --kubernetes-version=1.31 \
    --query 'sort_by(addons  &owner)[].{owner: owner, addonName: addonName}' \
    --output table
    */
    config.addEKSAddon('kube-proxy', { //spelling matters for all addons
        addonName: 'kube-proxy', //spelling matter & should match above
        addonVersion: 'v1.31.3-eksbuild.2', //Commented out for default (it won't be latest)
        // Use this to look up latest
        // aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=kube-proxy --query='addons[].addonVersions[].addonVersion' | jq '.[0]'
        resolveConflicts: 'OVERWRITE',
        configurationValues: '{}',
    });
    config.addEKSAddon('vpc-cni', {
        addonName: 'vpc-cni',
        resolveConflicts: 'OVERWRITE',
        addonVersion: "v1.19.3-eksbuild.1", //latest tends to be valid for all versions of kubernetes
        // Use this to look up latest
        // aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=kube-proxy --query='addons[].addonVersions[].addonVersion' | jq '.[0]'
        //serviceAccountRoleArn: <-- leave this blank, to use worker node's IAM role, which gives dualstack ipv4/ipv6 support
        configurationValues: '{}',
    });
    //NOTICE: Don't add eks-pod-identity-agent via config.addEKSAddon()
    //It's purposefully left out to work around CDK bug https://github.com/aws/aws-cdk/issues/32580
    //Other logic will triggers it's installation. The cdk bug complains about it already being present, if added here.



    // config.addAddOn( new blueprints.addons.AwsLoadBalancerControllerAddOn( {
    //     values: { //https://github.com/aws/eks-charts/blob/master/stable/aws-load-balancer-controller/values.yaml
    //         replicaCount: 1 //makes logs easier to read `kubectl logs deploy/aws-load-balancer-controller -n=kube-system`
    //     }
    // }));

    
    config.addEKSAddon('coredns', {
        addonName: 'coredns',
        addonVersion: 'v1.11.4-eksbuild.2', //latest tends to be valid for all version of kubernetes
        // Use this to look up latest
        // aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=coredns --query='addons[].addonVersions[].addonVersion' | jq '.[0]'
        resolveConflicts: 'OVERWRITE',
        //v-- Below represents an optimized CoreDNS deployment, based on
        //    https://aws.amazon.com/blogs/containers/amazon-eks-add-ons-advanced-configuration/
        //    aws eks describe-addon-configuration --addon-name coredns --addon-version v1.11.4-eksbuild.2 --query configurationSchema --output text | jq .
        configurationValues: `{
            "autoScaling": {
              "enabled": true,
              "minReplicas": 2,
              "maxReplicas": 1000
            },
            "affinity": {
              "nodeAffinity": {
                "requiredDuringSchedulingIgnoredDuringExecution": {
                  "nodeSelectorTerms": [
                    {
                      "matchExpressions": [
                        {
                          "key": "kubernetes.io/os",
                          "operator": "In",
                          "values": [
                            "linux"
                          ]
                        },
                        {
                          "key": "kubernetes.io/arch",
                          "operator": "In",
                          "values": [
                            "amd64",
                            "arm64"
                          ]
                        }
                      ]
                    }
                  ]
                }
              },
              "podAntiAffinity": {
                "requiredDuringSchedulingIgnoredDuringExecution": [
                  {
                    "labelSelector": {
                      "matchExpressions": [
                        {
                          "key": "k8s-app",
                          "operator": "In",
                          "values": [
                            "kube-dns"
                          ]
                        }
                      ]
                    },
                    "topologyKey": "kubernetes.io/hostname"
                  }
                ]
              }
            }
        }`, //end CoreDNS configurationValues override
    });//end CoreDNS AddOn


}//end apply_config()


export function deploy_workloads(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster){
    //Install AWS Load Balancer Controller via Helm Chart
    const ALBC_Version = 'v2.12.0'; //April 9th, 2025 latest from https://github.com/kubernetes-sigs/aws-load-balancer-controller/releases
    const ALBC_IAM_Policy_Url = `https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/refs/tags/${ALBC_Version}/docs/install/iam_policy.json`
    const ALBC_IAM_Policy_JSON = JSON.parse(request("GET", ALBC_IAM_Policy_Url).body.toString());
    const ALBC_IAM_Policy = new iam.Policy(stack, `${config.id}_AWS_LB_Controller_policy_for_EKS`, {
        document: iam.PolicyDocument.fromJson( ALBC_IAM_Policy_JSON ),
    });
    const ALBC_Kube_SA = new eks.ServiceAccount(stack, 'aws-load-balancer-controller', {
        cluster: cluster,
        name: 'aws-load-balancer-controller',
        namespace: 'kube-system',
        identityType: eks.IdentityType.POD_IDENTITY, //depends on eks-pod-identity-agent addon
        //Note: It's not documented, but this generates 4 things:
        //1. A kube SA in the namespace of the cluster
        //2. An IAM role paired to the Kube SA
        //3. An EKS Pod Identity Association
        //4. The eks-pod-identity-agent addon (dependency)
    });
    ALBC_Kube_SA.role.attachInlinePolicy(ALBC_IAM_Policy);
    const awsLoadBalancerController = cluster.addHelmChart('AWSLoadBalancerController', {
        chart: 'aws-load-balancer-controller',
        repository: 'https://aws.github.io/eks-charts',
        namespace: "kube-system",
        release: 'aws-load-balancer-controller',
        version: '1.11.0', //<-- helm chart version based on the following command
        // curl https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/refs/tags/v2.11.0/helm/aws-load-balancer-controller/Chart.yaml | grep version: | cut -d ':' -f 2
        wait: true,
        timeout: cdk.Duration.minutes(15),
        values: { //<-- helm chart values per https://github.com/kubernetes-sigs/aws-load-balancer-controller/blob/v2.11.0/helm/aws-load-balancer-controller/values.yaml
            clusterName: cluster.clusterName,
            vpcId: config.vpc.vpcId,
            region: stack.region,
            replicaCount: 1,
            serviceAccount: {
                name: "aws-load-balancer-controller",
                create: false,
            },
        },
    });
    // The following help prevent timeout of install during initial cluster deployment
    awsLoadBalancerController.node.addDependency(cluster.awsAuth);
    awsLoadBalancerController.node.addDependency(ALBC_Kube_SA);
}//end deploy_workloads()
