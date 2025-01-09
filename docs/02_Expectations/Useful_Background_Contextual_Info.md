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

### Purpose of files and folders worth knowing about or editing
* **./.flox/**:  
  (holds config of shared dev env, usually ignore unless you need to update dependency versions)  
  `flox activate`  
   Flox will use nix packages to overlay(merge/override) pre-requisite dependencies
   into your current working directory. (and append "flox [flox.dev]\n" to your $PS1 prompt var)  
   So things like `npm --version` in the working directory and sub dirs, will likely show
   a different value than if you ran the command in another location on your terminal.
   It'll use versions of the cli tool supplied by nix pkgs, rather than what's installed on
   your system.
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
