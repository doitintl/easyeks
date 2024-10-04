* Understanding how it works and what to expect at a high level

add initial demo feedback.

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

### How Onboarding Works

### High level overview of usage steps
1. Setup a workstation with AWS rights (your laptop, EC2 VM with IAM role you can ssh into)  
   (Note: AWS Cloud Shell won't work due to lack of disk space and "System has not been booted with systemd as init system (PID 1)" Error)
2. Install flox.dev
3. Clone git repo onto workstation
   * For initial testing just fork the upstream repo 
   * For adoption fork the repo and clone your fork
4. cd into git repo (it has a .flox folder)
   `cd ~/eks-cdk-quickstart`
5. `flox activate`  
   Flox will use nix packages to overlay(merge/override) pre-requisite dependencies
   into your current working directory. (and append "flox [flox.dev]\n" to your $PS1 prompt var)  
   So things like `npm --version` in the working directory and sub dirs, will likely show
   a different value than if you ran the command in another location on your terminal.
   It'll use versions of the cli tool supplied by nix pkgs, rather than what's installed on
   your system.
6. configure aws cli, and check your identity to avoid assumptions  
   `aws configure`  
   `aws configure get region`
   `aws sts get-caller-identity`
7. `cdk bootstrap`  
   ^-- This uses your currently set AWS region and IAM identity as input.
8. Deploy a Cluster
   ```shell
   # flox [flox.dev]
   # [admin@laptop:~/eks-cdk-quickstart]#
   cdk list
   cdk deploy lower-envs-vpc
   cdk deploy dev1-eks
   ```
   Note the above cdk commands assume 3 things are true
   1. your IAM identity and region are set to an account / region where cdk has been bootstrapped. (You can check CloudFormation in that region to verify this.)
   2. You've somehow met the pre-requisite dependcies (Check if flox.dev is active)
   3. You're current working directory is correct (This is why the above examples gives a hint)
9. Edit config and deploy again
10. Suggested Usage Tips (In the future link to a doc that only exists in my head.)

