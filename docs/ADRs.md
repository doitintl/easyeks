# ADRs: Architectural Decision Records
* Design Decisions made and rational behind why design decisions were made.  
* Similar to RFCs: Request for Comments

---------------------------------------------------------------------------------------------------------

## Why CDK over TF?
**EKS BluePrints based on AWS CDK, is nice, but has simultaneous pros and cons:**
* **Pros: AKA Why CDK is better than TF**  
  (aws-quickstart/cdk-eks-blueprints > "aws-ia/terraform-aws-eks-blueprints")  
  The TS CDK implementation of EKS Blueprints:
  * Is better supported by AWS:
    * AWS obviously prioritizes their own product (cdk) over a third party's (terraform).
    * Lower risk of future abandonment
  * Is a more stable project:
    * The Terraform Implementation is shifting sand, that's on it's 5th breaking change
      / iteration. [Source](https://aws-ia.github.io/terraform-aws-eks-blueprints/v4-to-v5/motivation/)
    * The linked doc explains you can expect more problems with the Terraform 
      implementation, and suggests minimizing problems by using [Terraform's EKS 
      Module](https://registry.terraform.io/modules/terraform-aws-modules/eks/aws/latest)
  * More mature:
    * The EKS Blueprint via CDK docs are relatively better than the EKS Blueprint via Terraform docs.
    * [Better addon support](https://aws-quickstart.github.io/cdk-eks-blueprints/addons/#supported-add-ons)
    * CDK offloads state to CloudFormation. (This is one less problem.)
      (Terraform would leave you to figure out how to handle TF state according to best practices.)
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
  * CDK offers too much choice (multiple languages are supported, but TypeScript(TS) offers the best
    support, so it's best to pretend TS is the only option)
  * Adopting CDK creates multiple [DevOps Yak Shaving problems:](https://dev.to/dance2die/shaving-yak-4g2m)
    * Local Dev Requires: 
      * Installing and configuring `aws`, `node`, `npm`, `cdk`, npm packages (library dependencies)
      * Likely on specific pinned versions (plural) that are known to work with EKS Blueprints.
      * Need to figure out how to keep team members using consistent versions
    * CDK offers a GitOps Deployment solution as an answer to the problems introduced by adoption cdk
      * cdk makes it (relatively easy) to bootstrap an AWS Code Commit and Code Pipeline based GitOps solution.
      * Their solution only trades problems. Solves 1 in exchange for others.  
        A non-starter for me is GitOps hurts observability and feedback loop.

---------------------------------------------------------------------------------------------------------

## Why EasyEKS over CDK?

---------------------------------------------------------------------------------------------------------

## Why flox.dev over devbox.com over Nix?
.toml config is better than .json config for comments.

---------------------------------------------------------------------------------------------------------

## Why Nix over Docker?

---------------------------------------------------------------------------------------------------------

## Why /config/*.ts over /config/env.yaml?
* .ts > .yaml:
  Reasoning:
  * .ts allows input validation, a case where it's needed is if EKS Blueprints is using
    an older library version of EKS Blueprints, might not allow latest release of EKS to be used.
  * .ts & .yaml is possible, but that'd create 2 problems
    Problem #1. add complexity to code 
    instead
(because .ts allows input validation in some cases, example Kubernetes 1.35 might exist)
Keep it simple / make it look at close to readable config as possible.

* **Option 1:**
/config/
baseline.yaml  <-- for config that TS can't help validate / needs to be fed in by a human and readable.
                   ^-- would add complexity of needing type interface & 2 config files
baseline.ts    <-- for config that TS can help validate

* **Option 2:**
/config/
baseline.ts    <-- for both config types

* **Decision / Choice made**
* I'll go with option 2. I started with it, but I initially abandoned it due to it getting messy
  it looked too much like code with TS specific nuances. When I wanted it to look like easy to read config.
* That was a coding style problem, going to adopt a new style in line with blueprints.
* A problem I ran into was I was trying to pass all parameters in at construction time.
* I'll follow the blueprints patterns where you add a little config here, a little config there
  and slowly construct the object, via methods to set / append values.
  (that's basically the blueprints programming design pattern for constructing these objects / populating config)
  (I'll just wrap it to simplify it / abstract away complexity.)




---------------------------------------------------------------------------------------------------------

## Design Inspirations
### 1. Personsal Philosophy of what good DevOps Solutions look like
* Lessons learned from kubing since 2018 + designing multiple platforms from scratch.
  * UX is priority 1
  * FTUX and solid Onboarding docs is the key to success

### 2. Helm's UX pros

### 3. Kustomize's UX pros

  kustomize like by supporting a baseline, sandbox, dev, stage, prod style input parameter setup.
  helm like by separating logic into:
  * input values.yaml files consumer's of this repo would mess with
  * input variable inheritance (sandbox, dev, stage, prod) (would inherit from baseline)
    makes cognitive complexity easier to manage, and it'd be intuitive that you could edit baseline.
  * last min customizations needed to make N test environments / multiple instances of an environment would be useful.  


(went beyond the idea)
  idea of sane defaults used by 95% of users
  Then org/project defaults
    * logically separate: 
    * generic baseline input parameter's that multiple orgs might share
    * org specific baseline input parameter's

### 4. Docker's UX pros

### 5. EKS BluePrints based on CDK's UX pros
* Their examples make it so you build an object all in 1 go, but I saw it was possible to use a
  pattern of splitting the logic into 2 phases.
  1. construct config
  2. use config to create object
* I went with the above approach as it allowed me to do phased config construction / layered config.
