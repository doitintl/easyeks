import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import { Easy_EKS_Dynamic_Config } from '../../lib/Easy_EKS_Dynamic_Config';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
//import request from 'sync-request-curl'; //npm install sync-request-curl (cdk requires sync functions, async not allowed)
import * as curl from 'sync-request-curl'; //When updated from v3->v4 to fix vulnerabilities, had to changed import logic to
const request = curl.default || curl;      //workaround an edge case import bug / avoid mismatch between CommonJS & ES Module import
import { Karpenter_Helm_Config, Karpenter_YAML_Generator, Apply_Karpenter_YAMLs_with_fixes } from '../../lib/Karpenter_Manifests';
import { KubectlV32Layer } from '@aws-cdk/lambda-layer-kubectl-v32'; //npm install @aws-cdk/lambda-layer-kubectl-v32
import { KubectlV33Layer } from '@aws-cdk/lambda-layer-kubectl-v33'; //npm install @aws-cdk/lambda-layer-kubectl-v33
import { KubectlV34Layer } from '@aws-cdk/lambda-layer-kubectl-v34'; //npm install @aws-cdk/lambda-layer-kubectl-v34
import { KubectlV35Layer } from '@aws-cdk/lambda-layer-kubectl-v35'; //npm install @aws-cdk/lambda-layer-kubectl-v35
import { read_yaml_string_as_javascript_object, read_yaml_file_as_javascript_object, read_yaml_file_as_array_of_javascript_objects, read_yaml_file_as_normalized_yaml_multiline_string } from '../../lib/Utilities';
//Intended Use: 
//EasyEKS Admins: edit this file with config to apply to all lower environment eks cluster's in your org.

export function apply_config(config: Easy_EKS_Config_Data, stack: cdk.Stack){ //config: is of type Easy_EKS_Config_Data
    config.set_KMS_Key_Alias_to_provision_and_reuse("eks/higher-envs"); //kms key with this alias will be created or reused if pre-existing
    config.set_VPC_using_name_tag("higher-envs-vpc", config, stack); //Name as in VPC's Name Tag
    //config.set_VPC_using_VPC_Id("vpc-0dbcacb511f9bac4e", config, stack); //Alternative pre-existing VPC deployment option
    config.set_number_of_baseline_nodes(2);
    config.set_capacity_type_of_baseline_nodes(eks.CapacityType.ON_DEMAND);
    if(process.env.CDK_DEFAULT_ACCOUNT==="111122223333"){
        config.add_cluster_wide_kubectl_Admin_Access_using_ARN(`arn:aws:iam::111122223333:user/example`); 
        /* Note 1:
           The IAM user/role running cdk deploy dev1-eks, gets added to the list of Cluster Admins by default.
           This is done for convenience, if you want to change this default, you'll need to edit ./lib/Easy_EKS.ts

           Note 2: 
           config.add_cluster_wide_kubectl_Admin_Access_using_ARN('...:user/example') should only be used in an if statement,
           Because the identity referenced in ARN must exist or the deployment will fail
           This allows you to create a explicit list of ARNs (representing IAM roles or users)
           That act as EKS Admins of all higher environments.
        */
    }
    //Kubernetes verson and addon's that may depend on Kubernetes version / should be updated along side it should be specified here
    config.set_clusters_version_of_Kubernetes(eks.KubernetesVersion.V1_34);
    config.set_worker_nodes_bottlerocket_release_version( "1.55.0-d93bb1b1" ); //<-- current value is a release associated with kube 1.33
    //^-- Choice: do you want latest? (every time `cdk deploy stage1-eks` is run, which could trigger extra node reboots)
    //            If so then use Easy_EKS_Dynamic_Config.get_latest_version_of_bottlerocket_1_33_release()
    //        OR: do you want to minimize node reboots as much as possible? / only when explicitly specified
    //            if so then use manual updates triggered by changing config of specific version.
    //            Command to lookup latest version (followed by example output):
    //            aws ssm get-parameter --name /aws/service/bottlerocket/aws-k8s-1.35/x86_64/latest/image_version --query "Parameter.Value" --output text | tr -d '\n|\r'
    //            1.55.0-d93bb1b1
    config.set_version_of_kubectl_used_by_lambda(new KubectlV34Layer(stack, 'kubectl-helm-lambda-executor')); //<--It's fine for this to stay on an old version
    //^--refers to version of kubectl & helm installed in AWS Lambda Layer responsible for kubectl & helm deployments
    //Note: If there's ever a problem with latest available versions of kubectl & helm
    //      Example: Sept 9th, 2025 KubectlV33Layer, resulted in an error 
    //      'Error: media type "application/vnd.cncf.helm.chart.provenance.v1.prov" is not allowed'
    //If latest doesn't work it's safe to permanently use old versions of both apps / older version of kubectl layer (apps refers to kubectl & helm, which both exists in KubectlV32Layer)
    //It's safe to permanently use old versions of both apps.
    config.set_control_plane_logging_options_to_enable([
        // eks.ClusterLoggingTypes.API,
        // eks.ClusterLoggingTypes.AUDIT,
        // eks.ClusterLoggingTypes.AUTHENTICATOR,
        // eks.ClusterLoggingTypes.CONTROLLER_MANAGER,
        // eks.ClusterLoggingTypes.SCHEDULER,
    ]);
}//end apply_config()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_addons(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.Cluster){

    const kube_proxy = new eks.CfnAddon(stack, 'kube-proxy', {
        clusterName: cluster.clusterName,
        addonName: 'kube-proxy',
        addonVersion: Easy_EKS_Dynamic_Config.get_latest_version_of_kube_proxy_1_34_eks_addon(), // no reason not to use latest for this
        resolveConflicts: 'OVERWRITE',
        configurationValues: `{
            "resources": {
                "requests": {
                    "cpu": "10m",
                    "memory": "26Mi"
                }
            }
        }`,
    });
    //NOTE! AWS LoadBalancer Controller and karpenter may occassionally need to be updated along with version of Kubernetes

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Install Karpenter.sh
    // Note: Karpenter leverages a 3rd party cdk construct so it needs do be implemented in the scope of cluster creation
    // as in against type eks.Cluster. It can't be installed on imported clusters of type eks.ICluster (I stands for interface)
    const karpenter_helm_config: Karpenter_Helm_Config = {
        helm_chart_version: '1.8.3', //https://gallery.ecr.aws/karpenter/karpenter
        helm_chart_values: { //https://github.com/aws/karpenter-provider-aws/blob/v1.8.3/charts/karpenter/values.yaml
            replicas: 2,
            controller: {
                resources: {
                    requests: {
                        cpu: "22m",
                        memory: "110Mi",
                    },
                    limits: {
                        memory: "1Gi",
                    }
                }
            }
        },
    };
    const karpenter_YAMLs = (new Karpenter_YAML_Generator({
        cluster: cluster,
        config: config,
        amiSelectorTerms_alias: `bottlerocket@${config.worker_nodes_bottlerocket_release_version}`, //Example value: 'bottlerocket@1.51.0-47438798'
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
    const ALBC_Version = 'v3.1.0'; //latest as of March 3rd, 2026 per https://github.com/kubernetes-sigs/aws-load-balancer-controller/releases
    const ALBC_IAM_Policy_Url = `https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/refs/tags/${ALBC_Version}/docs/install/iam_policy.json`
    const ALBC_IAM_Policy_JSON:JSON = request('GET', ALBC_IAM_Policy_Url).getJSON();
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
    //v--stored in config as it needs to be used as a dependency for other things, to fix a race condition
    config.aws_load_balancer_controller_helm_chart_essentials_dependency = cluster.addHelmChart('AWSLoadBalancerController', {
        chart: 'aws-load-balancer-controller',
        repository: 'https://aws.github.io/eks-charts',
        namespace: "kube-system",
        release: 'aws-load-balancer-controller',
        version: '3.1.0', //<-- helm chart version based on the following command
        // Commands to look up latest helm chart version:
        // helm repo add eks https://aws.github.io/eks-charts && helm repo update eks && helm search repo eks | egrep "NAME|aws-load-balancer-controller"
        wait: true,
        timeout: cdk.Duration.minutes(15),
        values: { //<-- helm chart values per https://github.com/kubernetes-sigs/aws-load-balancer-controller/blob/main/helm/aws-load-balancer-controller/values.yaml
            clusterName: cluster.clusterName,
            vpcId: config.vpc.vpcId,
            region: stack.region,
            replicaCount: 1,
            serviceAccount: {
                name: "aws-load-balancer-controller",
                create: false,
            },
            resources: {
                requests: {
                    cpu: "1m",
                    memory: "27Mi"
                },
                limits: {
                    memory: "128Mi"
                }
            },
        },
    });
    config.aws_load_balancer_controller_helm_chart_essentials_dependency.node.addDependency(ALBC_Kube_SA);
    // ^-- This prevents temporary errors in logs of AWS Load Balancer Controller
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}//end deploy_essentials()

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function deploy_workloads(config: Easy_EKS_Config_Data, stack: cdk.Stack, cluster: eks.ICluster){

}//end deploy_workloads()
