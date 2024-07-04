# eks-cdk-quickstart
Experimental Investigative Tinkering for Opinionated Approach to EKS


## Overview of Approach (What to Expect)
* End state of: N-sandbox, dev, stage, prod EKS clusters
  * Each cluster(environment) is optional
  * Can be managed individually
  * Reproducible Deployments are achieved using:
    * (IaC + Deployment Tools + Deployment docs) in git + manual human in the loop reproducible workflow to manage EKS Infrastructure Bootstrapping.
    * IaC in git + GitOps operator in cluster + human in the loop reproducible workflow to manage EKS application workloads.
* Each Cluster has:
  * karpenter.sh
  * AWS Load Balancer Controller
  * TBD
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
# [admin@laptop:~]
cd ~
git clone https://github.com/doitintl/eks-cdk-quickstart.git
cd ~/eks-cdk-quickstart
# [admin@laptop:~/eks-cdk-quickstart]
# ^- The above notation is used, b/c the below command requires you to be in correct working dir.
flox activate
# Note after running the above, your prompt will change
# FROM:
# [admin@laptop:~/eks-cdk-quickstart]
#
# TO: 
# flox [flox.dev]
# [admin@laptop:~/eks-cdk-quickstart]
#
# ^-- This allows you to see you're in flox shell mode
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

