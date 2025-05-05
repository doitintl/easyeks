import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import { KubectlV31Layer } from '@aws-cdk/lambda-layer-kubectl-v31'; //npm install @aws-cdk/lambda-layer-kubectl-v31
import request from 'sync-request-curl'; //npm install sync-request-curl (cdk requires sync functions, async not allowed)
import { Karpenter_Helm_Config, Karpenter_YAML_Generator, Apply_Karpenter_YAMLs_with_fixes } from '../../lib/Karpenter_Manifests';
//Intended Use: 
//EasyEKS Admins: edit this file with config to apply to all lower environment eks cluster's in your org.

export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack){ //config: is of type Easy_EKS_Config_Data
    config.setKmsKeyAlias("eks/lower-envs"); //kms key with this alias will be created or reused if pre-existing
    config.setVpcByName("lower-envs-vpc", config, stack); //Name as in VPC's Name Tag
    //config.setVpcById("vpc-0dbcacb511f9bac4e", config, stack); //Alternative pre-existing VPC deployment option
    config.setBaselineMNGSize(2);
    config.setBaselineMNGType(eks.CapacityType.SPOT);
    if(process.env.CDK_DEFAULT_ACCOUNT==="111122223333"){
        config.addClusterAdminARN(`arn:aws:iam::111122223333:user/example`); 
        /* Note: 
           config.addClusterAdminARN('...:user/example') should only be used in an if statement,
           Because the identity referenced in ARN must exist or the deployment will fail
           This allows you to create a explicit list of ARNs (representing IAM roles or users)
           That act as EKS Admins of all lower environments.
        */
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Kubernetes verson and addon's that may depend on Kubernetes version / should be updated along side it should be specified here
    config.setKubernetesVersion(eks.KubernetesVersion.V1_31);
    config.setKubectlLayer(new KubectlV31Layer(stack, 'kubectl'));
    config.addEKSAddon('kube-proxy', { //spelling matters for all addons
        addonName: 'kube-proxy', //spelling matter & should match above
        addonVersion: 'v1.31.7-eksbuild.7', //Note you can comment this out, but you'll get default instead of latest.
        // Use this to look up latest
        // aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=kube-proxy --query='addons[].addonVersions[].addonVersion' | jq '.[0]'
        resolveConflicts: 'OVERWRITE',
        configurationValues: '{}',
    });
    //NOTE! AWS LoadBalancer Controller may need to be updated along with version of Kubernetes
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}//end apply_config()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_workloads(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster){

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Install AWS Load Balancer Controller via Helm Chart
    const ALBC_Version = 'v2.12.0'; //April 9th, 2025 latest from https://github.com/kubernetes-sigs/aws-load-balancer-controller/releases
    const ALBC_IAM_Policy_Url = `https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/refs/tags/${ALBC_Version}/docs/install/iam_policy.json`
    const ALBC_IAM_Policy_JSON = JSON.parse(request("GET", ALBC_IAM_Policy_Url).body.toString());
    const ALBC_IAM_Policy = new iam.Policy(stack, 'AWS_LB_Controller_IAM_policy_for_EKS', {
        document: iam.PolicyDocument.fromJson( ALBC_IAM_Policy_JSON ),
    });
    const ALBC_Kube_SA = new eks.ServiceAccount(stack, 'aws-load-balancer-controller_kube-sa', {
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
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Install Karpenter.sh
    const karpenter_helm_config: Karpenter_Helm_Config = {
        helm_chart_version: '1.4.0', //https://gallery.ecr.aws/karpenter/karpenter
        helm_chart_values: { //https://github.com/aws/karpenter-provider-aws/blob/v1.4.0/charts/karpenter/values.yaml
            replicas: 1,
        },
    };
    const karpenter_YAMLs = (new Karpenter_YAML_Generator({
        cluster: cluster,
        config: config,
        amiSelectorTerms_alias: "bottlerocket@v1.31.0", /* <-- Bottlerocket alias always ends in a zero, below is proof by command output
        export K8S_VERSION="1.31"
        aws ssm get-parameters-by-path --path "/aws/service/bottlerocket/aws-k8s-$K8S_VERSION" --recursive | jq -cr '.Parameters[].Name' | grep -v "latest" | awk -F '/' '{print $7}' | sort | uniq
        */
        consolidationPolicy: "WhenEmptyOrUnderutilized", //WhenUnderutilized is more agressive cost savings / slightly worse stability
        manifest_inputs: [ //Note highest weight = default, higher = preferred
            { type: "spot",      arch: "arm64", nodepools_cpu_limit: 1000, weight: 4, },
            { type: "spot",      arch: "amd64", nodepools_cpu_limit: 1000, weight: 3, },
            { type: "on-demand", arch: "arm64", nodepools_cpu_limit: 1000, weight: 2, },
            { type: "on-demand", arch: "amd64", nodepools_cpu_limit: 1000, weight: 1, },
        ]
    })).generate_manifests();
    Apply_Karpenter_YAMLs_with_fixes(stack, cluster, config, karpenter_helm_config, karpenter_YAMLs, awsLoadBalancerController);
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}//end deploy_workloads()
