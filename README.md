# Easy EKS (Pre-Alpha)
Easy EKS is FOSS (free open source software), developed by engineers at doit.com, who
believe EKS can be simple, accessible, and enjoyable to use. If you find this to be
useful, then consider checking out [doit's FinOps Platform and Cloud Provider Support.](go.doit.com/easyeks_interest_tracker)

## What is Easy EKS?
An opinionated bundling of automation & Infrastructure as code that aims to:
1. Make it easy to provision EKS clusters that are nearly production ready by default.
2. Maintain a heavily standardized opinionated set of IaC, which makes automation
   maintainable.
3. Apply useful design patterns from Helm and Kustomize to IaC based on AWS CDK.

## FAQs: Focused on Setting Expectations up Front
### **What does Pre-Alpha mean? What's Next?**
1. **Pre-Alpha** (current state)
   * Multiple "nearly production by default" functionality goals have not yet been met
   * Upgrade paths and everyday usage aren't well tested
1. **Alpha**
   * "nearly production by default" functionality goals have all been met
   * Clean up code and establish a naming convention for variables and functions
1. **Beta**
   * Focus on fixing bugs and UX(user experience) issues
   * Make nice docs
1. **Stable**
   * Make SEO Optimized Website

### **If used as intended, what specific end results would this tool make easy?**
* Deployment of IPv4/v6 dualstack, FinOps optimized VPCs, becomes easy.
* A lower-envs-vpc would be deployed in a 1st AWS Account meant for lower environments.
* A higher-envs-vpc would be deployed in a 2nd AWS Account meant for higher environments.
* Quick and easy push button deployments of eks clusters that automatically install and
  configure a nearly production ready standardized default.
* Standardized default includes: dualstack, FinOps optimizations (lower-envs-vpc and
  dev1-eks defaults to under $100/month), EKS addons, Karpenter Node Auto Provisioner, AWS
  Load Balancer Controller (for ingress.yaml), KMS encrypted storageclass, metric and log
  level observability, become a standardized default easy button deployment.
* Multiple eks clusters can easily be deployed, within 20 minutes per cluster.
* dev1-eks, dev2-eks, qa1-eks, etc. clusters deploy to lower-envs-vpc
* stage1-eks, stage2-eks, prod1-eks, etc. clusters deploy to higher-envs-vpc

### **What does the user journey map look like?**
**What does the user journey map look like?, Specifically in terms of:**  
**Evaluation --> Long Term Usage --> Org Level Onboarding & Adoption --> Maintenance**
1. **Evaluation:**
   1. Download source code from Assets in https://github.com/doitintl/easyeks/releases
   1. Extract the files to ~/easyeks
   1. Your first deployment can easily be done in under an hour, using [Easy EKS's Quickstart](./docs/03_Quickstart/Quickstart.md)
      It has 2 prerequisites: Docker installed & IAM admin access to a lower-env AWS Account.
   1. The quickstart's automation takes under 30 minutes, which gives time to skim the docs.
   1. A docker image is built locally to satisfy prerequisites, and install cdk and kubectl.
   1. AWS Cloud Shell is used to generate 1-hour temporary credentials for docker.
   1. `cdk deploy dev1-eks` will generate a copy pasteable command to populate ~/.kube/config
1. **Long Term Usage:**
   1. The quickstart minimizes prerequites in exchange for making modifications harder.
   1. For long term usage, it's recommended to install prerequites on a workstation with bash
      or zsh (Linux, Mac, Unix, or Window's WSL).
   1. For anyone not familiar with node.js prerequisites, it's recommended to use flox.dev,
      which is a user experience optimized abstraction layer for Nix packages, which is
      basically a docker alternative that integrates with your shell instead of replacing it.
      [How to do this is documented here](https://github.com/doitintl/easyeks/blob/main/docs/04_Prerequisites/Recommended_Long-Term_Setup.md)
   1. You can modify the contents of `~/easyeks/config/vpc/*.ts` and 
      `~/easyeks/config/eks/*.ts` to your needs similar to how you'd edit Kustomization.yaml
      and helm-values.yaml IaC config files.
   1. Then this workflow can be used to iteratively introduce any desired changes
      ```shell
      cd ~/easyeks
      cdk list
      cdk deploy lower-envs-vpc
      cdk deploy dev1-eks
      ```
1. **Org Level Onboarding & Adoption:**
   1. The following practices are recommended for org wide collaboration
   1. Establish your own private copy of easyeks, by uploading your modified contents of
      ~/easyeks into your own private git repo. (No need to do a traditional git fork.)
   1. Have everyone in the org use the flox.dev methodology, to ensure cdk's runtime
      dependencies can easily stay in sync across workstations.
   1. Bring your own kubernetes CICD pipeline and integrate it.
1. **Maintenance:**
   1. During initial adoption it's expected that you'll make rapid changes, but after
      you configure things as you like, you should deploy updates about once every 3 months.
   1. It's not necessary to fork easyeks, because upstream cdk supplies updates not easyeks,
      easyeks is just a template of opinionated best practices that's easy to start from
      and maintain over time.
   1. A rough overview of intended update workflow is as follows:
      * `~/easyeks/.flox/env/manifest.toml` has comments on how to declaratively uppdate Nix
        pkg dependencies, it's recommended to update from there as they lag slightly behind
        latest.
      * `cd ~/easyeks/` & `npm install @aws-cdk/lambda-layer-kubectl-v32`
      * Update versions listed in `~/easyeks/config/eks/*.ts` to updated versions.
      * `cdk deploy dev1-eks`
      * Note: cdk uses a local cache cdk.context.json, which makes it so normally only 1
        stack can be updated at a time. That said if you copy the repo in N different
        locations on your local machine, and open N different terminals set to those
        locations, then it should be possible to deploy updates to multiple clusters in
        parallel. Parallel updates should only be done after validating config syntax
        against a lower environment.

### **What features are purposefully not implemented? (and pragmatic reasons for why not)** 
1. **Deployment of easyeks vpcs and clusters using a CICD pipeline is out of scope.**  
   **This project project intends that a human manually cdk deploys CF stacks from a terminal.**
   * **Why Reason #1: Avoids Problems**  
     cdk is an abstraction layer that orchestrates AWS Cloud Formation deployments. If you
     specify an incorrect value in the config and an error occurs, then:
     * CICD pipelines can hide error messages, make error messages harder to find, add time
       between feedback loop interations, add prerequisites, learning, and complexity.
     * cdk deployments are idempotent in the case of success, but not in the case of failure.
     * When a failure occurs, it's possible for Cloud Formation to get stuck in ways manual
       ClickOps intervention is needed by an admin to get them back to a deployable state.
       This means you can't manage it purely through a CICD pipeline, and since manual
       intervention is occasionally required you may as well just do it manually.
   * **Why Reason #2: Even if a clean pipeline implementation existed, there is little benefit
     in implementing pipeline level automation of cdk stack deployments.**
     * Once configured VPC and Cluster level infrastructure don't need daily updates.
     * A more realistic and perfectly reasonable maintenance strategy, is to periodically
       manually run updates from a workstation, once every few months is fine.
1. **Easy EKS doesn't supply upstream updates and releases don't aim to be backwards compatible**
   * **Why Reason #1: There's no true need to do so**
     * Even though Easy EKS doesn't offer upstream updates, you can still receive upstream
       updates from cdk, eks, helm charts, and container images.
     * This means that instead of updating Easy EKS v0.5.0 -> v0.6.0 -> v0.7.0 -> etc.  
       * The way Easy EKS' updates are intended to work is as follows:  
         Any version you adopt regardless of if it's v0.5.0, v0.6.0, v0.7.0, etc. They're just
         templates representing a standardized bundling of IaC. While it's true that newer 
         versions will be better, that doesn't mean the older versions will be bad. Any version
         of the template new or old should be updatable to latest cdk, eks, helm charts, etc.
       * You're supposed to treat each release of easyeks as your own personal fork and make it
         your own, threat it as a starting point and modify it however you want.
       * The only time you may want to consider updating to a new release of easyeks is if you
         have the opportunity to start over from scratch, or think it's worth doing a blue green
         cutover. One strategy you may want to use is to use early pre-alpha releases of easyeks
         for dev, sandbox, and ephemeral cluster environments. And wait until it's at least alpha
         before using it for production.
   * **Why Reason #2: Attemping would place unnecessary limits and burden on easyeks's maintainers.**
     * Easy EKS is FOSS developed during free time. It's not funded or staffed to implement
       advanced things like CICD pipelines and with tests for backwards compatibility.
     * Easy EKS is free so maintainers get to develop it stress free, without needing to contemplate
       the ramifications of renaming a variable, simplifying, or altering a function.
     * Since it's IaC that you're meant to customize, there's also a greater logistical challenges
       in terms of how upstream updates could even be offered without resetting any changes you make.
   * **Why Reason #3: This approach also offers minor but notable benefits to consumers.**
     * There's a small bit of complexity involved in forking a public repo and then converting that to
       a private fork. Since you don't need to worry about upstream updates, you don't need to worry
       about traditional git forking, which removes some complexity.
     * Since you're not expected to update to easyeks releases as they come out, easyeks isn't going
       to be a source of breaking changes or additional maintenance / yet another thing to update.
