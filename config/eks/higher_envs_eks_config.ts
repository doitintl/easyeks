import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import { KubectlV31Layer } from '@aws-cdk/lambda-layer-kubectl-v31'; //npm install @aws-cdk/lambda-layer-kubectl-v31
import request from 'sync-request-curl'; //npm install sync-request-curl (cdk requires sync functions, async not allowed)
//Intended Use: 
//EasyEKS Admins: edit this file with config to apply to all lower environment eks cluster's in your org.

export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack){ //config: is of type Easy_EKS_Config_Data
    config.setKmsKeyAlias("eks/higher-envs"); //kms key with this alias will be created or reused if pre-existing
    config.setVpcByName("higher-envs-vpc", config, stack); //Name as in VPC's Name Tag
    //config.setVpcById("vpc-0dbcacb511f9bac4e", config, stack); //Alternative pre-existing VPC deployment option
    config.setBaselineMNGSize(2);
    config.setBaselineMNGType(eks.CapacityType.ON_DEMAND);
    //config.addClusterAdminARN(`arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT!}:user/example`);
    //^--Important Note: identity referenced in ARN must exist or the deployment will fail
    //         This allows you to create a explicit list of ARNS (representing IAM roles or users)
    //         That act as EKS Admins of all higher environments.
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Kubernetes verson and addon's that may depend on Kubernetes version / should be updated along side it should be specified here
    config.setKubernetesVersion(eks.KubernetesVersion.V1_31);
    config.setKubectlLayer(new KubectlV31Layer(stack, 'kubectl'));
    config.addEKSAddon('kube-proxy', { //spelling matters for all addons
        addonName: 'kube-proxy', //spelling matter & should match above
        addonVersion: 'v1.31.3-eksbuild.2', //Commented out for default (it won't be latest)
        // Use this to look up latest
        // aws eks describe-addon-versions --kubernetes-version=1.31 --addon-name=kube-proxy --query='addons[].addonVersions[].addonVersion' | jq '.[0]'
        resolveConflicts: 'OVERWRITE',
        configurationValues: '{}',
    });
    //NOTE! AWS LoadBalancer Controller may need to be updated along with version of Kubernetes
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


    //v-- Karpenter addon needs to be configured after vpc is set. 
    //    (Remember cdk is imperative, as in step by step, so order of code execution matters)
    //    Alternatively you could try ${stack.region}a, b, c, but that assumption doesn't work for all regions.
    // config.addAddOn( //https://github.com/aws-quickstart/cdk-eks-blueprints/blob/blueprints-1.15.1/lib/addons/karpenter/index.ts
    //     new blueprints.addons.KarpenterAddOn({
    //         version: "0.37.0", //https://github.com/aws/karpenter-provider-aws/releases
    //         // newer version: 1.1.0 works with kube 1.31 only if ec2nodeclassspec & nodepoolspec are commented
    //         // so newer only partially works
    //         // strategy: prioritize other issues, then this might fix itself by the time I get to it.
    //         // https://github.com/aws-quickstart/cdk-eks-blueprints/issues/1078
    //         namespace: "kube-system", //yet anther workaround for upstream bug... :\
    //         ec2NodeClassSpec: {
    //             amiFamily: "AL2", //"AL2 = Amazon Linux 2", "Bottlerocket" has a node-local-dns-cache bug to troubleshoot later
    //             subnetSelectorTerms: [{ tags: { "Name": `higher-envs-vpc/PrivateSubnet*` } }],
    //             securityGroupSelectorTerms: [{ tags: { "aws:eks:cluster-name": `${config.id}` } }],
    //             detailedMonitoring: false,
    //             tags: config.tags,
    //         },
    //         nodePoolSpec: {
    //             requirements: [
    //                 { key: 'topology.kubernetes.io/zone', operator: 'In', 
    //                   values: [
    //                       `${config.vpc.availabilityZones[0]}`,
    //                       `${config.vpc.availabilityZones[1]}`,
    //                       `${config.vpc.availabilityZones[2]}`] },
    //                 { key: 'kubernetes.io/arch', operator: 'In', values: ['amd64','arm64']},
    //                 { key: 'karpenter.sh/capacity-type', operator: 'In', values: ['on-demand']}, //on-demand for higher_envs
    //             ],
    //             disruption: {
    //                 consolidationPolicy: "WhenEmpty", //"WhenEmpty" is slightly higher cost and stability
    //                 consolidateAfter: "30s",
    //                 expireAfter: "20m",
    //                 budgets: [{nodes: "10%"}] 
    //             }
    //         },
    //         interruptionHandling: true,
    //         podIdentity: true,
    //         values: { //https://github.com/aws/karpenter-provider-aws/tree/main/charts/karpenter#values
    //             replicas: 2, //HA, because baseline MNG nodes are spot. 
    //             //FYI: good helm default automatically make the replicas spread across nodes.
    //         }
    //     })
    // );//end Karpenter AddOn
    
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
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}//end deploy_workloads()
