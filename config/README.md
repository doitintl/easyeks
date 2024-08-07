# Mental Framework for How these Config Files are Intended to work

## Design Goals and Inspiration
**EKS BluePrints for AWS CDK CLI tool has simultaneous pros and cons:**
* Pros: AKA Why CDK is better than TF  
  (aws-quickstart/cdk-eks-blueprints > "aws-ia/terraform-aws-eks-blueprints")  
  The TS CDK implementation of EKS Blueprints:
  * Is better supported by AWS:
    * AWS obviously prioritizes their own product (cdk) over a third party's (terraform).
    * Lower risk of future abandonment
  * More stable:
    * The Terraform Implementation is shifting sand, that's on it's 5th breaking change
      / iteration. [Source](https://aws-ia.github.io/terraform-aws-eks-blueprints/v4-to-v5/motivation/)
    * The linked doc explains you can expect more problems with the Terraform 
      implementation, and suggests minimizing problems by using [Terraform's EKS 
      Module](https://registry.terraform.io/modules/terraform-aws-modules/eks/aws/latest)
  * More mature:
    * The EKS Blueprint via CDK docs are relatively better than the EKS Blueprint via Terraform docs.
    * [Better addon support](https://aws-quickstart.github.io/cdk-eks-blueprints/addons/#supported-add-ons)
  * More flexible, powerful, and feature full: 
    * Multiple Kubernetes Clusters to support multiple enviornment's is a well known
      kubernetes best practice. You test updates in dev, then stage, then prod to lower risk.
    * CDK makes it easier to maintain and manage IaC of multiple clusters / environments:  
      Because it allows declarative config (in the form of Cloud Formation) to be imperatively generated.
* Cons: AKA Why EKS Blueprint via CDK isn't perfect
  * Too much specialized knowledge is required to use it effectively.
  * Too many choices are offered (and at multiple levels)
     * cdk language implementation
     * deployment methodology
     * EKS Cluster Infrastructure 
     * EKS Cluster Addons
  * CDK offers too much choice (multiple languages are supported, but TypeScript(TS) offers the best support,
    so it's best to pretend TS is the only option)
  * Adopting CDK creates multiple [DevOps Yak Shaving problems](https://dev.to/dance2die/shaving-yak-4g2m):
    * Local Dev Requires: 
      * Installing and configuring `aws`, `node`, `npm`, `cdk`, npm packages (library dependencies)
      * Likely on specific pinned versions (plural) that are known to work with EKS Blueprints.
      * Need to figure out how to 
      
      
       all installed, configured, and ideally

   in the form of pre-requisite yak shaving
    * You can solve it by adopting AWS's Code Pipeline GitOps solution  
      (but this solution only creates new problems)
    * Or local dev environment setup problems (node, npm, cdk, must be installed, on correct versions)
  * Specialized knowledge is required
  * Too much choice


apply_global_baseline_config.ts
Conceptually think of this as a mix between:
* A Helm Chart's default values.yaml
* A /base/kustomization.yaml
* A shared baseline config.


Purpose: 
Act as sane defaults for 95% of users, can use for all clusters (dev,stage,prod,ci,etc.)
With no need to modify, yet easily referenced for the curious.
Design Choices:
* .ts > .yaml:
  Reasoning:
  * .ts allows input validation, a case where it's needed is if EKS Blueprints is using
    an older library version of EKS Blueprints, might not allow latest release of EKS to be used.
  * .ts & .yaml is possible, but that'd create 2 problems
    Problem #1. add complexity to code 
    instead
(because .ts allows input validation in some cases, example Kubernetes 1.35 might exist)
Keep it simple / make it look at close to readable config as possible.

## Usage WorkFlow






