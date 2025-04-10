import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import { KubectlV31Layer } from '@aws-cdk/lambda-layer-kubectl-v31'; //npm install @aws-cdk/lambda-layer-kubectl-v31
//Intended Use: 
//EasyEKS Admins: edit this file with config to apply to all lower environment eks cluster's in your org.

export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack){ //config: is of type Easy_EKS_Config_Data
    config.setKmsKeyAlias("eks/lower-envs"); //kms key with this alias will be created or reused if pre-existing
    config.setVpcByName("lower-envs-vpc", config, stack); //Name as in VPC's Name Tag
    //config.setVpcById("vpc-0dbcacb511f9bac4e", config, stack); //Alternative pre-existing VPC deployment option
    config.setBaselineMNGSize(2);
    config.setBaselineMNGType(eks.CapacityType.SPOT);
    config.setKubernetesVersion(eks.KubernetesVersion.V1_31);
    config.setKubectlLayer(new KubectlV31Layer(stack, 'kubectl'));
    

    //config.addClusterAdminARN(`arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT!}:user/example`);
    //^--Important Note: identity referenced in ARN must exist or the deployment will fail
    //         This allows you to create a explicit list of ARNS (representing IAM roles or users)
    //         That act as EKS Admins of all lower environments.

    //config.setObservabilityToFrugalGrafanaPrometheusLoki();

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
    //             subnetSelectorTerms: [{ tags: { "Name": `lower-envs-vpc/PrivateSubnet*` } }],
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
    //                 { key: 'karpenter.sh/capacity-type', operator: 'In', values: ['spot']}, //spot for lower-envs
    //             ],
    //             disruption: {           //WhenUnderutilized is more agressive cost savings / slightly worse stability
    //                 consolidationPolicy: "WhenUnderutilized", 
    //                 //consolidateAfter: "30s", //<--not compatible with WhenUnderutilized
    //                 expireAfter: "20m",
    //                 budgets: [{nodes: "10%"}] 
    //             }
    //         },
    //         interruptionHandling: true,
    //         podIdentity: true,
    //         values: { //https://github.com/aws/karpenter-provider-aws/tree/main/charts/karpenter#values
    //             replicas: 1,
    //         }
    //     })
    // );//end Karpenter AddOn

}//end apply_config()

export function deploy_workloads(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster){

}//end deploy_workloads()
