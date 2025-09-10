import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import { Easy_EKS_Dynamic_Config } from '../../lib/Easy_EKS_Dynamic_Config';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import request from 'sync-request-curl'; //npm install sync-request-curl (cdk requires sync functions, async not allowed)
import { Karpenter_Helm_Config, Karpenter_YAML_Generator, Apply_Karpenter_YAMLs_with_fixes } from '../../lib/Karpenter_Manifests';
import { KubectlV31Layer } from '@aws-cdk/lambda-layer-kubectl-v31'; //npm install @aws-cdk/lambda-layer-kubectl-v31
import { KubectlV32Layer } from '@aws-cdk/lambda-layer-kubectl-v32'; //npm install @aws-cdk/lambda-layer-kubectl-v32
import { KubectlV33Layer } from '@aws-cdk/lambda-layer-kubectl-v33'; //npm install @aws-cdk/lambda-layer-kubectl-v33
//Intended Use: 
//EasyEKS Admins: edit this file with config to apply to all lower environment eks cluster's in your org.

export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack){ //config: is of type Easy_EKS_Config_Data
    config.setKmsKeyAlias("eks/higher-envs"); //kms key with this alias will be created or reused if pre-existing
    config.setVpcByName("higher-envs-vpc", config, stack); //Name as in VPC's Name Tag
    //config.setVpcById("vpc-0dbcacb511f9bac4e", config, stack); //Alternative pre-existing VPC deployment option
    config.setBaselineMNGSize(2);
    config.setBaselineMNGType(eks.CapacityType.ON_DEMAND);
    if(process.env.CDK_DEFAULT_ACCOUNT==="111122223333"){
        config.addClusterAdminARN(`arn:aws:iam::111122223333:user/example`); 
        /* Note 1:
           The IAM user/role running cdk deploy dev1-eks, gets added to the list of Cluster Admins by default.
           This is done for convenience, if you want to change this default, you'll need to edit ./lib/Easy_EKS.ts

           Note 2: 
           config.addClusterAdminARN('...:user/example') should only be used in an if statement,
           Because the identity referenced in ARN must exist or the deployment will fail
           This allows you to create a explicit list of ARNs (representing IAM roles or users)
           That act as EKS Admins of all higher environments.
        */
    }
    //Kubernetes verson and addon's that may depend on Kubernetes version / should be updated along side it should be specified here
    config.setKubernetesVersion(eks.KubernetesVersion.V1_33);
    config.setKubectlLayer(new KubectlV32Layer(stack, 'kubectl')); //<--It's fine for this to stay on an old version
    //^--refers to version of kubectl & helm installed in AWS Lambda Layer responsible for kubectl & helm deployments
    //Note: As of Sept 9th, 2025 KubectlV33Layer (which currently has latest available versions of kubectl & helm)
    //      results in error 'Error: media type "application/vnd.cncf.helm.chart.provenance.v1.prov" is not allowed'
    //It's safe to permanently use old versions of both apps.

}//end apply_config()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_addons(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster){

    const kube_proxy = new eks.CfnAddon(stack, 'kube-proxy', {
        clusterName: cluster.clusterName,
        addonName: 'kube-proxy',
        addonVersion: Easy_EKS_Dynamic_Config.get_latest_version_of_kube_proxy_1_33_eks_addon(), // or 'v1.33.3-eksbuild.6'
        resolveConflicts: 'OVERWRITE',
        configurationValues: '{}',
    });
    //NOTE! AWS LoadBalancer Controller and karpenter may occassionally need to be updated along with version of Kubernetes

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Install Karpenter.sh
    // Note: Karpenter leverages a 3rd party cdk construct so it needs do be implemented in the scope of cluster creation
    // as in against type eks.Cluster. It can't be installed on imported clusters of type eks.ICluster (I stands for interface)
    const karpenter_helm_config: Karpenter_Helm_Config = {
        helm_chart_version: '1.6.0', //https://gallery.ecr.aws/karpenter/karpenter
        helm_chart_values: { //https://github.com/aws/karpenter-provider-aws/blob/v1.6.0/charts/karpenter/values.yaml
            replicas: 2,
        },
    };
    const karpenter_YAMLs = (new Karpenter_YAML_Generator({
        cluster: cluster,
        config: config,
        amiSelectorTerms_alias: "bottlerocket@v1.33.0", /* <-- Bottlerocket alias always ends in a zero, below is proof by command output
        export K8S_VERSION="1.33"
        aws ssm get-parameters-by-path --path "/aws/service/bottlerocket/aws-k8s-$K8S_VERSION" --recursive | jq -cr '.Parameters[].Name' | grep -v "latest" | awk -F '/' '{print $7}' | sort | uniq
        */
        consolidationPolicy: "WhenEmpty", //"WhenEmpty" is slightly higher cost and stability
        manifest_inputs: [ //Note highest weight = default, higher = preferred
            { type: "on-demand", arch: "arm64", nodepools_cpu_limit: 1000, weight: 4, },
            { type: "on-demand", arch: "amd64", nodepools_cpu_limit: 1000, weight: 3, },
            { type: "spot",      arch: "arm64", nodepools_cpu_limit: 1000, weight: 2, },
            { type: "spot",      arch: "amd64", nodepools_cpu_limit: 1000, weight: 1, },
        ]
    })).generate_manifests();
    Apply_Karpenter_YAMLs_with_fixes(stack, cluster, config, karpenter_helm_config, karpenter_YAMLs);
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}//end deploy_addons()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_essentials(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.ICluster){

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Install AWS Load Balancer Controller via Helm Chart
    const ALBC_Version = 'v2.13.4'; //latest as of Sept 9th, 2025 per https://github.com/kubernetes-sigs/aws-load-balancer-controller/releases
    const ALBC_IAM_Policy_Url = `https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/refs/tags/${ALBC_Version}/docs/install/iam_policy.json`
    const ALBC_IAM_Policy_JSON = JSON.parse(request("GET", ALBC_IAM_Policy_Url).body.toString());
    const ALBC_IAM_Policy = new iam.Policy(stack, 'AWS_LB_Controller_IAM_policy_for_EKS', {
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
        version: '1.13.4', //<-- helm chart version based on the following command
        // curl https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/refs/tags/v2.13.4/helm/aws-load-balancer-controller/Chart.yaml | grep version: | cut -d ':' -f 2
        wait: true,
        timeout: cdk.Duration.minutes(15),
        values: { //<-- helm chart values per https://github.com/kubernetes-sigs/aws-load-balancer-controller/blob/v2.13.4/helm/aws-load-balancer-controller/values.yaml
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
    // The following should help prevent temporary errors in logs of ALBC
    awsLoadBalancerController.node.addDependency(ALBC_Kube_SA);
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}//end deploy_essentials()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_workloads(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.ICluster){

}//end deploy_workloads()
