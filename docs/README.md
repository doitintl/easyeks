## Table of Contents
- **[Usage Workflow](#usage-workflow)**
  - [Useful Background Contextual Information](#useful-background-contextual-information)
  - [Step by Step Usage Example](#high-level-overview-of-usage-steps)
  - [Usage/Purpose of files, folders, and config worth knowing about or editing](#purpose-of-files-and-folders-worth-knowing-about-or-editing)
- **[Project Goal](#project-goals)**

---------------------------------------------------------------------------------------------------------

## Usage Workflow
### Useful Background Contextual Information
* CDK: Cloud Development Kit
  * Is a CLI tool released by AWS
  * It imperatively generates declarative config (in the form of CloudFormation)
  * It supports multiple programming languages, but TypeScript offers the best support
* EKS Blueprints based on CDK
  * Is an IaC library intended to make EKS easier for those with specialized knowledge.
* Easy EKS: A wrapper for CDK & EKS Blueprints, that aims to:
  * minimize specialized knowledge.
  * establish a standardized baseline of sane defaults (standardization is a pre-req for automation)
    * automate pre-requisites
    * automate deployment
* flox.dev (a wrapper that makes Nix easier to use, it's powerful for people with specialized knowledge.)
  * Nix is a package manager that in some cases can be used as an alternative to docker.
  * It solves 3 key problems:
    * It automates pre-requisites
    * It allows multiple versions of node, npm, and cdk to be installed and switched between
      on machine. 
      * Devs can safely and easily work on multiple JavaScript or TypeScript Projects.
      * Ops can safely and easily work on multiple CDK or Pulumi Projects.
      * Similar to docker, versions of dependencies can be pinned on a per project basis.  
      * This avoids edge case of inconsistency and incompatibility between versions.
    * Multiple Team members effectively use a consistent dev environment where all their 
      tooling is pinned to a version that's shared by and consistent for all team members.

### High level overview of usage steps
1. Setup a workstation with AWS rights (your laptop or an EC2 with IAM role you can ssh into)
2. Install flox.dev
3. Clone git repo onto workstation
   * For initial testing just fork the upstream repo 
   * For adoption fork the repo and clone your fork
4. cd into git repo (it has a .flox folder)
   `cd ~/eks-cdk-quickstart
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
   # [admin@~/eks-cdk-quickstart]
   cdk list
   cdk deploy test-cluster
   ```
   Note the above cdk commands assume 3 things are true
   1. your IAM identity and region are set to an account / region where cdk has been bootstrapped. (You can check CloudFormation in that region to verify this.)
   2. You've somehow met the pre-requisite dependcies (Check if flox.dev is active)
   3. You're current working directory is correct (This is why the above examples gives a hint)
9. Edit config and deploy again
10. Suggested Usage Tips (In the future link to a doc that only exists in my head.)



### Purpose of files and folders worth knowing about or editing
* **./.flox/**:  
  (holds config of shared dev env, usually ignore unless you need to update dependency versions)
* **./bin/cdk-main.ts/**:  
  When you run `cdk *` command, this is the main entry point of the program.
  This is where you can define/declare N number of test, dev, stage, or prod clusters.
* **./config/*/**:  
  * Here is where snippets of cluster config exist, the idea is to merge them into what you need.
    Vaguely similar to how combining default helm values.yaml & helm override values.yaml, or kustomize
    base and kustomize overlay work.
  * apply_global_baseline_config.ts is a shared baseline config, intended to be globally usable, without
    needing to be modified.
  * apply_orgs_baseline_config.ts is a shared baseline config, inteaded to be edited to be specific to
    your org.
  * apply_dev_config.ts is dev environment specific config.
* **./lib/*/**:  
  * The intent is for end users to never need nor want to touch this.
  * The intent is specialized knowledge and complexity/implementation details of what's happening under
    the hood are abstracted away here.
  * Power users who fork the project could modify it, but the idea is the batteries included 
    standardized experience will be good enough, that they too won't need nor want to create work.

---------------------------------------------------------------------------------------------------------

## Project Goals
* Create an standardized opinionated batteries included experience that 98% of users would happily use
  with minimal modifications.
  * convention over configuration
  * use sane, sensible, justifed defaults to prevent creation of needless toil based work.
* Real Production Grade Projects use multiple clusters, (N-test, N-dev, N-stage, N-prod, ci, etc.)
* Easy and Intuitive UX
  * FTUX:
    * can try / test in under and hour (45min understanding / setup + 15 min automation)
    * solid dev cluster within a day
    * Solid Onboarding Docs and Advice
      * Phased adoption/onboarding with next steps that leverage best practices
      * Secrets management advance and example.
      * Advantages of practice of keeping cluster infra mgmt and workload deploy mgmt as 2 logically
        seperate phases, using different tooling. 
      * (Advise only using this for managing cluster's baseline infra)
  * Well organized config, code, and docs:
    * Be helm / kustomize like in that it should be intuitively obvious where to look for stuff you
      might want to edit/mess with. And it should be intuitive obvious what stuff you want to ignore.
      Most users ignore the helm chart's golang templating as implementation detail used to hide / 
      abstract away complexity. So they know they can ignore it and free up the cognitive overhead.
      Most of the TypeScript code should be treated that way. 
    * Like how helm users can use it w/o understanding that complexity  
      user's shouldn't need to know or understand specialised JS/TS knowledge to use this.
* Be beginner friendly:
  * Avoid Fancy programming in favor of KIS(keep it simple), intuitive, readable, and code that
    someone with little to no prior knowledge would find easy to read and understand, by the curious.
  * Abstract away complexity

## Stretch Goals (potential future considerations)
* pre-requisite provisioning, validation/testing, and integration.
