# eks-cdk-quickstart
Experimental Investigative Tinkering for Opinionated Approach to EKS


## Overview of Approach (What to Expect)
* EKS Cluster With:
  * karpenter.sh
  * AWS Load Balancer Controller
* N-eks-sandbox envs 100% manual CLI (in lower AWS account) (offers better feedback loop than GitOps)
* Dev / QA 100% GitOps (lower AWS account)
* Stage / Prod 100% GitOps (higher AWS account)


## Explanation of Approach (Why)
* AWS CDK has the potential to be better than OpenTofu(AKA Terraform) for EKS, problem is onboarding UX.
  This approach offers a streamlined onboarding UX to AWS CDK Blueprints for EKS.
* Problem with docker:
  We could use a container image to pin version of aws cdk cli & dependencies, but it has UX problems.
* UX improvements from using devbox over docker. 
  * we still get cli & dependency version pinning (only using NixOS, under the hood with complexity/implementation details abstracted away, instead of docker.)
  * It's designed to merge into your existing shell vs replace it
    * So if you have a fancy starship.rs based shell, you can keep using it.
    * If you have AWS CLI credentials available on your machine the devbox shell environment can access them
  * nix based solution vs containers, strikes a better balance of customization and standardization.
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
* Install devbox CLI from https://github.com/jetify-com/devbox?tab=readme-ov-file#installing-devbox
  (Think of it as a bundling of all your dependencies)
* Verify devbox is installed
  `devbox version` (newer version is fine, this is just what was last tested)
  ```console
  0.12.0
  ```
* Download this repo
```shell
# [admin@laptop:~]
cd ~
git clone https://github.com/doitintl/eks-cdk-quickstart.git
cd ~/eks-cdk-quickstart
# [admin@laptop:~/eks-cdk-quickstart]
devbox shell
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


