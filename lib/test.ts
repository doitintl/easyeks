import { Construct, IConstruct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { KubectlV31Layer } from '@aws-cdk/lambda-layer-kubectl-v31'; //npm install @aws-cdk/lambda-layer-kubectl-v31
import * as iam from 'aws-cdk-lib/aws-iam';


export class Test_EKS{
    id: string;
    nc_stack: cdk.Stack;
    ic_stack: cdk.Stack;
    n_cluster: eks.Cluster;
    i_cluster: eks.ICluster;
    vpc: ec2.Vpc;
    kubectl_helm_lambda_handler_iam_role_for_easy_eks: iam.Role;

    constructor(storage_for_stacks_state: Construct, stack_id: string, stack_config: cdk.StackProps) {
        this.id = stack_id;
        this.nc_stack = new cdk.Stack(storage_for_stacks_state, `${stack_id}-ncluster`, stack_config);
        this.ic_stack = new cdk.Stack(storage_for_stacks_state, `${stack_id}-icluster`, stack_config);
        this.vpc = ec2.Vpc.fromLookup(this.nc_stack,'pre-existing-vpc', { vpcId: "vpc-0b612c0311610627b", }) as ec2.Vpc;
        this.kubectl_helm_lambda_handler_iam_role_for_easy_eks = initialize_Kubectl_Lambda_Handler_IAM_Role(this.nc_stack);
        this.deploy_cluster();
        this.deploy_deployment_to_new_cluster();
        this.import_cluster();
        this.deploy_deployment_to_imported_cluster();
    }



    deploy_cluster(){
        const clusterAdminAccessPolicy: eks.AccessPolicy = eks.AccessPolicy.fromAccessPolicyName('AmazonEKSClusterAdminPolicy', { accessScopeType: eks.AccessScopeType.CLUSTER });

        this.n_cluster = new eks.Cluster(this.nc_stack, this.id, {
            clusterName: "test",
            version: eks.KubernetesVersion.V1_31,
            vpc: this.vpc,
            vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
            defaultCapacity: 1,
            ipFamily: eks.IpFamily.IP_V6,
            authenticationMode: eks.AuthenticationMode.API_AND_CONFIG_MAP,
            kubectlLayer: new KubectlV31Layer(this.nc_stack, 'kubectl'),
        });

        new eks.AccessEntry( this.nc_stack, 'arn:aws:iam::090622937654:user/chris.m@doit.com', //<-- using ARN as a unique subStack id
            {
                accessPolicies: [clusterAdminAccessPolicy],
                cluster: this.n_cluster,
                principal: 'arn:aws:iam::090622937654:user/chris.m@doit.com',
                accessEntryName: 'arn:aws:iam::090622937654:user/chris.m@doit.com'
            }
        );
        new eks.AccessEntry( this.nc_stack, 'arn:aws:iam::090622937654:role/kubectl-helm-lambda-deployer-role-used-by-easy-eks', //<-- using ARN as a unique subStack id
            {
                accessPolicies: [clusterAdminAccessPolicy],
                cluster: this.n_cluster,
                principal: 'arn:aws:iam::090622937654:role/kubectl-helm-lambda-deployer-role-used-by-easy-eks',
                accessEntryName: 'arn:aws:iam::090622937654:role/kubectl-helm-lambda-deployer-role-used-by-easy-eks'
            }
        );
        // aws eks update-kubeconfig --region ca-central-1 --name test
    } //end deploy_cluster

    deploy_deployment_to_new_cluster(){
        const pvc_demo_construct = new eks.KubernetesManifest(this.nc_stack, "nginx-deploy",
        {
            cluster: this.n_cluster,
            manifest: [nginx_deploy],
            overwrite: true,
            prune: true,
        });
    }

    import_cluster(){
        //cdk oddity:
        //Creation of cdk object of type eks.KubectlProvider requires an initialized object of type eks.ICluster
        const temp_eks_construct_for_kubectl_provider = eks.Cluster.fromClusterAttributes(this.ic_stack, 'eks.KubectlProvider', {
            clusterName: "test",
            kubectlLayer: new KubectlV31Layer(this.ic_stack, 'kubectl'),
            kubectlRoleArn: 'arn:aws:iam::090622937654:role/kubectl-helm-lambda-deployer-role-used-by-easy-eks',
        });
        const kubectl_provider = eks.KubectlProvider.getOrCreate(this.ic_stack, temp_eks_construct_for_kubectl_provider);
        cdk.Tags.of(kubectl_provider.handlerRole).add('whitelisted-role-for-assuming', 'easy-eks-generated-kubectl-helm-deployer-lambda-role'); //used in a whitelist condition
        this.i_cluster = eks.Cluster.fromClusterAttributes(this.ic_stack, 'imported-eks-cluster', {
            clusterName: "test",
            kubectlProvider: kubectl_provider,
            kubectlRoleArn: 'arn:aws:iam::090622937654:role/kubectl-helm-lambda-deployer-role-used-by-easy-eks',
        });
        this.kubectl_helm_lambda_handler_iam_role_for_easy_eks.grantAssumeRole(kubectl_provider.handlerRole);
    }

    deploy_deployment_to_imported_cluster(){
        const pvc_demo_construct = new eks.KubernetesManifest(this.ic_stack, "nginx-deploy",
        {
            cluster: this.i_cluster,
            manifest: [nginx_deploy2],
            overwrite: true,
            prune: true,
        });
    }

} //end Test_EKS

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const nginx_deploy = {
    "apiVersion": "apps/v1",
    "kind": "Deployment",
    "metadata": {
        "name": "nginx",
        "labels": {
            "name": "nginx"
        }
    },
    "spec": {
        "replicas": 1,
        "selector": {
            "matchLabels": {
                "name": "nginx"
            }
        },
        "template": {
            "metadata": {
                "labels": {
                    "name": "nginx"
                }
            },
            "spec": {
                "containers": [
                    {
                        "name": "nginx",
                        "image": "nginx:mainline-alpine3.22-perl",
                        "ports": [
                            {
                                "containerPort": 80
                            }
                        ]
                    }
                ]
            }
        }
    }
} //end nginx_deploy

const nginx_deploy2 = {
    "apiVersion": "apps/v1",
    "kind": "Deployment",
    "metadata": {
        "name": "nginx2",
        "labels": {
            "name": "nginx2"
        }
    },
    "spec": {
        "replicas": 1,
        "selector": {
            "matchLabels": {
                "name": "nginx2"
            }
        },
        "template": {
            "metadata": {
                "labels": {
                    "name": "nginx2"
                }
            },
            "spec": {
                "containers": [
                    {
                        "name": "nginx",
                        "image": "nginx:mainline-alpine3.22-perl",
                        "ports": [
                            {
                                "containerPort": 80
                            }
                        ]
                    }
                ]
            }
        }
    }
} //end nginx_deploy2

////////////////////////////////////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function initialize_Kubectl_Lambda_Handler_IAM_Role(stack: cdk.Stack){

  const eks_kubectl_access_iam_policy = new iam.PolicyDocument({
      statements: [
          new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              resources: ['arn:aws:eks:*'],
              actions: [
                  'eks:DescribeCluster',
              ],
          }),
      ],
  });

  const principal: iam.IPrincipal = new iam.AccountPrincipal('090622937654');
  const conditions: any = {
      "StringEquals": {	"aws:PrincipalTag/whitelisted-role-for-assuming": "easy-eks-generated-kubectl-helm-deployer-lambda-role" }
  };
  const principal_with_conditions = new iam.PrincipalWithConditions( principal, conditions );

  const Kubectl_Lambda_Handler_IAM_Role = new iam.Role(stack, 'EKS_Kubectl_Lambda_Handler_IAM_Role', {
      roleName: "kubectl-helm-lambda-deployer-role-used-by-easy-eks",
      //assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      //^-- maybe wrong since User: arn:aws:sts::090622937654:assumed-role/test-icluster-testicluste-HandlerServiceRoleFCDC14A-qOkuBv2iokh2/test-icluster-testiclustereksKubec-Handler886CB40B-MLZkEygseQzc not authorized
      //assumedBy: new iam.ArnPrincipal('arn:aws:iam::090622937654:role/*'), //fails Invalid principal in policy
      //assumedBy: new iam.AccountPrincipal('090622937654'), // works
      //assumedBy: new iam.ArnPrincipal('arn:aws:iam::090622937654:role/test-icluster-testicluste-HandlerServiceRoleFCDC14A-qOkuBv2iokh2'), //works
      assumedBy: principal_with_conditions,
      managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonElasticContainerRegistryPublicReadOnly'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
      inlinePolicies: {
          eks_kubectl_access_iam_policy,
      },
  });

  return Kubectl_Lambda_Handler_IAM_Role;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



