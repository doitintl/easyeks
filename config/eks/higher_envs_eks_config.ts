import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import * as cdk from 'aws-cdk-lib';
import * as blueprints from '@aws-quickstart/eks-blueprints'
//Intended Use: 
//EasyEKS Admins: edit this file with config to apply to all lower environment eks cluster's in your org.

export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack){ //config: is of type Easy_EKS_Config_Data
    config.setVpcByName("higher-envs-vpc", config, stack); //Name as in VPC's Name Tag
    //config.setVpcById("vpc-0dbcacb511f9bac4e", config, stack); //Alternative pre-existing VPC deployment option
    //config.addClusterAdminARN(`arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT!}:user/chrism`);
    //^--Note: identity referenced in ARN must exist or the deployment will fail

    //v-- Karpenter addon needs to be configured after vpc is set. 
    //    (Remember cdk is imperative as in step by step, so order matters)
    //    Alternatively you could try ${stack.region}a, b, c, but that assumption doesn't work for all regions.
    config.addAddOn( //https://github.com/aws-quickstart/cdk-eks-blueprints/blob/blueprints-1.15.1/lib/addons/karpenter/index.ts
        new blueprints.addons.KarpenterAddOn({
            version: "0.37.0", //https://github.com/aws/karpenter-provider-aws/releases
            // newer versions 0.37.3 and 1.0.2 are currently broken upstream
            // https://github.com/aws-quickstart/cdk-eks-blueprints/issues/1078
            namespace: "kube-system", //yet anther workaround for upstream bug... :\
            ec2NodeClassSpec: {
                amiFamily: "AL2", //"AL2 = Amazon Linux 2", "Bottlerocket" has a node-local-dns-cache bug to troubleshoot later
                subnetSelectorTerms: [{ tags: { "Name": `higher-envs-vpc/PrivateSubnet*` } }],
                securityGroupSelectorTerms: [{ tags: { "aws:eks:cluster-name": `${config.id}` } }],
                detailedMonitoring: false,
                tags: config.tags,
            },
            nodePoolSpec: {
                requirements: [
                    { key: 'topology.kubernetes.io/zone', operator: 'In', 
                      values: [
                          `${config.vpc.availabilityZones[0]}`,
                          `${config.vpc.availabilityZones[1]}`,
                          `${config.vpc.availabilityZones[2]}`] },
                    { key: 'kubernetes.io/arch', operator: 'In', values: ['amd64','arm64']},
                    { key: 'karpenter.sh/capacity-type', operator: 'In', values: ['on-demand']}, //on-demand for higher_envs
                ],
                disruption: {
                    consolidationPolicy: "WhenEmpty", //"WhenEmpty" is slightly higher cost and stability
                    consolidateAfter: "30s",
                    expireAfter: "20m",
                    budgets: [{nodes: "10%"}] 
                }
            },
            interruptionHandling: true,
            podIdentity: true,
            values: { //https://github.com/aws/karpenter-provider-aws/tree/main/charts/karpenter#values
                replicas: 2, //HA, because baseline MNG nodes are spot. 
                //Note: good helm default will make the replicas spread across nodes.
            }
        })
    );//end Karpenter AddOn
    
}
