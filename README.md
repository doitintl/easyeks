# Easy EKS (Pre-Alpha)

## What is Easy EKS?
A user experience optimized approach to EKS, where using it becomes **simpler**, **accessible**, and **enjoyable**.

### Simpler EKS
* `cdk` is used to automate the provisioning of production ready eks clusters.
* A `kustomize` inspired design pattern is used to make the deployment and management over time of multiple clusters much easier.
* A `helm` inspired design pattern to abstract away complexity.
  * helm hides complexity in templatized yaml files, and helm values.yaml files, which represent sane default values of input parameters to feed into the templating engine.
  * helm's end users see a significantly simplified interface:  
    For example:
    * A 15 line long `kps.helm-values.yaml` file (of values representing overrides of kube-prometheus-stack helm chart's default input parameters)
        us a command like `helm upgrade --install kps oci://registry-1.docker.io/bitnamicharts/kube-prometheus --version=9.6.2 --values=kps.helm-values.yaml --namespace=monitoring --create-namespace=true`
    * Can deploy over 10,000 lines of yaml to a cluster, the complexity still exists, but it's hidden, abstracted away, and replaced with a simplified interface that end users use.
  * Easy EKS hides it's complexity in /lib/ (cdk library), and /.flox/ (a recommended, yet optional method of automating dependencies with `flox activate`)
  * Easy EKS presents a simplified workflow to end users:
    * Edit /config/ (which is an intuitive and simplified end user interface inspired by kustomize and helm values)
    * `cdk list`
    * `cdk deploy dev1-eks`

### Accessible EKS

    * 
      
Be Quick to Learn, Easy to Use, with minimal prior knowledge:**
  * Aims to be:
    * Easy enough for cloud engineers, without specialized knowledge, to be able to:
    * Learn, setup, and deploy a production ready eks cluster within a day.
    * Gain working mastery of the a

    * how to deploy within a day
  
  a non-experts to figure out how to deploy a


  production production within a day, and a that a non-expertfor non-experts a team with little prior knowledge:

to deploy a production ready eks cluster in a day.

FTUX (First Time User Experience) and user onboarding



### Enjoyable EKS

* It's based on cdk, which you can think of as a set of building blocks to build and automate a solution.
* An opionated approach to EKS, where automation
standardized baseline
ation to achieve a
  turn key, batteries included, production ready user experience.
* Basically EKS
 with more of a turn key, batteries included, production ready user experience.
* A standardized deployment of EKS, that aims to enable users to establish a production ready baseline in under a day.
* An Opinionated Approach to EKS, that aims to make deploying and managing EKS clusters easier, it's based on:
  * The guiding principle that prioritizing UX(User Experience) and 
    is a critical element of a project's success and adoption.
  * `cdk` (AWS's Cloud Development Kit, a CLI tool)
  * `helm` and `kustomize` inspired infrastructure as code management patterns

---




## Why Easy EKS Exists
| **Basic Functionality you'd expect to see, for normal usage and production readiness:** | **GCP's GKE AutoPilot:**<br/> (a point of reference of what good looks like)                         | **AWS EKS:**<br/> (The default out of the box user experience is a collection of dumb problems to have)                                                                                                                                                                                                                        | **Easy EKS**  <br/> (Smart solutions to dumb problems that make EKS easier, brought to you by doit.com)                                                                                 |
|-----------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| A well configured VPC                                                                   | Default VPC ships with Cloud NAT                                                                     | Default VPC doesn't ship with a NAT GW, and Managed NAT GW is so bad [(link 1)](https://www.lastweekinaws.com/blog/the-aws-managed-nat-gateway-is-unpleasant-and-not-recommended/), that fck-NAT exists [(link 2)](https://fck-nat.dev/stable/).                                                                               | Ships with fck-NAT (order of magnitude cheaper), and dualstack VPC for IPv6 based EKS, which eliminates potential problem of running out of IPs.                                        |
| Optimized DNS                                                                           | DNS is optimized by default via Node Local DNS Cache and Cloud DNS                                   | Ships with nothing. A relatively easy install won't be Fault Tolerant, won't have a dns auto-scaler, nor node-local-dns-cache. Figuring out production grade optimizations takes days.                                                                                                                                         | Alpha ships with Node Local DNS Cache, core dns autoscaler, and anti affinity rules for increased fault tolerance.<br/> Planned for Beta: verify/optimize core dns autoscaler's config. |
| Easily populate ~/.kube/config for Kubectl Access                                       | A blue connect button at the top of the Web GUI, shows a command.                                    | * Need to look up command in docs.<br/> * By default, only the cluster creator has any access.                                                                                                                                                                                                                                 | * When cdk eks blueprints finishes, it outputs a config command.                                                                                                                        |
| Teammates can easily gain kubectl access                                                | * Admin GCP IAM role maps to kube admin access<br/> * Viewer GCP IAM role maps to kube viewer access | * Access configuration needs to be explicitly configured (using EKS API or aws-auth config map in kube-system namespace)<br/> * A common practice to work around the above, is to have an assumed role act as the cluster creator, but that solution creates the problem of needing to studying docs to craft a custom command | PLANNED (beta)                                                                                                                                                                          |
| You and others can view basic info in the Web Console                                   | Unrivaled web console user experience                                                                | It's so sad that a row even needed to be made to point out that even the account owner, super admin, or human that created the cluster can't always view what's in the cluster from the web console.                                                                                                                           | PLANNED (beta)                                                                                                                                                                          |
| Metric Level Observability                                                              | Ships with preconfigured working dashboards                                                          | Ships with nothing, figuring out how to set up takes days.                                                                                                                                                                                                                                                                     | PLANNED (beta)                                                                                                                                                                          |
| Log Level Observability                                                                 | Ships with intuitive centralized logging                                                             | Ships with nothing, figuring out how to set up takes days.                                                                                                                                                                                                                                                                     | PLANNED (beta)                                                                                                                                                                          |
| Automatically Provisions storage for stateful workloads                                 | Ships with a preconfigured storageclass                                                              | Ships with broken implementation, fixing is relatively easy, but how/why is this not a default functionality baked into the platform?                                                                                                                                                                                          | Ships with KMS Encrypted EBS storageclass                                                                                                                                               |
| Automatically Provision Load Balancers for Ingress                                      | Ships with GKE Ingress Controller and GKE's Gateway API controller                                   | Ships with nothing, and the solution: AWS Load Balancer Controller, is considered a 3rd party add-on, with a complex installation that can take days to figure out.                                                                                                                                                            | Ships with AWS Load Balancer Controller                                                                                                                                                 |
| Pod Level IAM Identity                                                                  | Ships with Workload Identity (pod level IAM roles)                                                   | Ships with nothing, making it work is relatively easy, seems reasonable to have this be a default baked into the platform.                                                                                                                                                                                                     | Ships with Amazon EKS Pod Identity Agent                                                                                                                                                |
| Worker Node Autoscaling                                                                 | Ships with NAP (Node Auto Provisioner)                                                               | Ships with nothing, figuring out how to install cluster autoscaler or karpenter.sh can take days.                                                                                                                                                                                                                              | Ships with Karpenter.sh                                                                                                                                                                 |



## Overview of Approach (What to Expect)
* End state of: N-sandbox, dev, stage, prod EKS clusters
  * Each cluster(environment) is optional
  * Can be managed individually
  * Reproducible Deployments are achieved using:
    * (IaC + Deployment Tools + Deployment docs) in git + manual human in the loop reproducible workflow to manage EKS Infrastructure Bootstrapping.
    * IaC in git + GitOps operator in cluster + human in the loop reproducible workflow to manage EKS application workloads.
* Recommended End State:
  * stage and prod are isolated in a "high side" AWS account. (Devs and Ops have access.)
  * Nth-sandbox and dev envs are isolated in a "low side" AWS account. (Only Ops has access.)



## Explanation of Approach (Why) (Architectural Decision Records)
* Philosophy of what makes good DevOps/IaC Solution:
  * A Good DevOps Solution will solve a problem in a way that genuinely simplify the problem.
    * A commonly made mistake is the proposal of a solution, that in reality just transforms a problem, by means of solving an
      original problem in exchange for creating N new problems.  
      (This often happens when people treat Kubernetes as a solution they can throw at a problem.)  
      (Kubernete's isn't bad, their propsosed solution is just incomplete.)
    * A Good DevOps solution is able to genuinely simplify problems by:
      * Minimizing the number of new problems introduced by the adoption of the proposed solution. 
      * If newly introduced problem is a DevOps Yak Shaving Dependency, and it can't be removed/avoided, the troublesomeness of
        it should be minimized by E2E automating the dependency as much as possible, and ensuring smooth user friendly onboarding UX.
  * Reproducibility is the ideal (GitOps is just 1 way of achieving)
  * AWS CDK offers a [GitOps Pipeline](https://catalog.workshops.aws/eks-blueprints-for-cdk/en-US/050-multiple-clusters-pipelines)
    where git commits can be used to trigger deployments, updates, and manage the lifecycle of a cluster using GitOps for both
    the infra and the workloads. 
    This was purposefully not done, In favor of manual infra & GitOps workloads. 
    (Because AWS's proposed solution goes against my philosophy of what a good solution looks like).
    (That approach creates multiple problems, 2 big one's are poor feedback loop and poor deployment observability.)
* AWS CDK has the potential to be better than OpenTofu(AKA Terraform) for EKS, problem is onboarding UX.
  This approach offers a streamlined onboarding UX to AWS CDK Blueprints for EKS.
  * Why CDK > TF? what problems does TF have?
    * TF has an onboarding UX problem, related to TF statefile.
    * CDK minimizes that problem by using Cloud Formation to store state.
    * TF makes it easy to have 1 environment, but managing N environments that can share code is harder.
    * CDK makes it easier to manage N environments.
    * Neither TF nore CDK is superior in 100% of scenarios; however, I'd argue that CDK is superior for EKS, because:
      * AWS has invested more into their EKS blueprints based on CDK, it's more mature. https://aws-quickstart.github.io/cdk-eks-blueprints/addons/ 
      * AWS's EKS blueprints based on TF are on their 5th breaking change https://aws-ia.github.io/terraform-aws-eks-blueprints/v4-to-v5/motivation/#what-is-changing
      * CDK is less risky than TF. (AWS may decide to stop backing TF in the future, and TF is being replaced by OpenTofu) (CDK has neither problem.)
* Problem with docker:
  We could use a container image to pin version of aws cdk cli & dependencies, but it has UX problems.
* UX improvements from using NixOS based flox.dev over docker. 
  * we still get cli & dependency version pinning (only using NixOS, under the hood with complexity/implementation details abstracted away, instead of docker.)
  * It's designed to merge into your existing shell vs replace it
    * So if you have a fancy starship.rs based shell, you can keep using it.
    * If you have AWS CLI credentials available on your machine the flox shell environment can access them
  * nix based solution vs containers, strikes a better balance of customization and standardization.
* Q: Why flox.dev over devbox? (Alternative NixOS based solution.)
  A: .toml config offers a better UX than json config.
* Problems solved:
  * 1st to give Linux, Mac, WSL2 users reading this onboarding guide a more standardized shell environment
    from which to run the following commands.
  * 2nd is that AWS CDK backed by TypeScript is sensitive to things like
    the version of aws (aws cli), cdk (aws cdk cli), node, npm, etc. That's
    installed on your machine.
  * This approach makes your life easier:
    * When working as a team, where you want your team mates to use the same tools.
    * If you work on multiple projects that might need different versions of dev tools installed
    * If you go 6-12 months between touching this and periocially updating dependencies breaks your local 
      environment's compatibility with the IaC.


## Quickstart (How)
* Install flox CLI from flox.dev
  (Think of it as a bundling of all your dependencies)
* Verify flox is installed
  `flox --version` (newer version is fine, this is just what was last tested)
  ```console
  1.1.0
  ```
* Download this repo
```shell
# [admin@workstation:~]
cd ~
git clone https://github.com/doitintl/eks-cdk-quickstart.git
cd ~/eks-cdk-quickstart
# [admin@workstation:~/eks-cdk-quickstart]
# ^- The above notation is used, b/c the below command requires you to be in correct working dir.
flox activate
# Note after running the above, your prompt will change
# FROM:
# [admin@workstation:~/eks-cdk-quickstart]
#
# TO: 
# flox [flox.dev]
# [admin@workstation:~/eks-cdk-quickstart]
#
# ^-- This allows you to see you're in flox shell mode
```

```shell
# flox [flox.dev]
# [admin@workstation:~/eks-cdk-quickstart]
npm install
# ^-- will populate a /node_modules/, based on package.json

head -n 2 cdk.json
# {
#   "app": "npx ts-node --prefer-ts-exts bin/cdk-main.ts",
#   ^-- so ./bin/cdk-main.ts is cdk CLI's entry point where the app logic starts
export AWS_REGION=ca-central-1
cdk list
```
* Configure AWS CLI
* Run the following command to make sure you have access to an AWS Identity
`aws sts get-caller-identity`
* Here's what output could look like in a MFA SSO CLI Auth Configuration Setup
```console
{
    "UserId": "AROA5FTZDSN3OT5JM4NOV:botocore-session-1719967403",
    "Account": "905418347382",
    "Arn": "arn:aws:sts::905418347382:assumed-role/OrganizationAccountAccessRole/botocore-session-1719967403"
}
```
* Here's what output could look like in a simple setup
```console
{
    "UserId": "AIDA5FTZDSN3I5BGLZTQB",
    "Account": "905418347382",
    "Arn": "arn:aws:iam::905418347382:user/chrism"
}
```
* Bootstrap cdk
```shell
export AWS_REGION=ca-central-1
cdk bootstrap --region=ca-central-1
# ^-- Note the region flag isn't required, it'll default to your locally configured region
#     There's 2 advantages to explicitly specifying
#     1. When working with a team, they can't see your locally configured region,
#        so documenting in git improves reproducibility.
#     2. It makes it intuitively obvious that cdk bootstrap is regionally scoped, not global.
```

## Skaffolding Methodology (Boostrapping methodology used to populate the files in this repo)
* /.flox/ files were initially generated by `flox init`.
* NixOs gets latest packages on a delay of 1-2 weeks, so it didn't have the aws-cdk pgk version 2.147.3
  which the lastest eks-blueprints 1.15.1 needs, so for now I'm using the previous version (1.14.1)
  flox.dev's packages were set to install cdk 2.133.0 (which) eks-blueprints 1.14.1 uses.
* Due to a nix cdk pgk bug  
  `npx aws-cdk@2.133.0 init app --language typescript`  
  was used in place of  
  `cdk init app --language typescript`
* `npm install npm i @aws-quickstart/eks-blueprints@1.14.1`  
  was used to configure npm dependencies needed by eks-blueprints v1.14.1

