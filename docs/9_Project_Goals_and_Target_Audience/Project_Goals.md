# Easy EKS's Project Goals
Easy EKS = EKS + Apps + Config + Infrastructure as Code + Automation + Docs.

## 1. Make a standardized baseline distribution of EKS
* Standardization is a prerequisite for:
  * High quality documentation, that can lower cost of learning.
  * Quick and Easy Reproducibility, thanks to standardized reusable config values,
    that are well tested an known to work.
  * High quality automation, that's quick to setup and easy to use.

## 2. Automate the deployment of production ready EKS clusters
* Freshly deployed clusters should be production ready by default.
* Production readiness, means: all of the following are fully configured, working,
  and documented.
  * Metric and log level observability dashboards
  * Secure authenticated access to observability dashboards.
  * DNS, workload identity, node autoscaling, load balancer provisioning, HTTPS cert
    provisioning, secrets management solutions that keep secrets out of source code.
* Production ready by default, means: Engineers using Easy EKS can:
  * Focus on workloads that deliver business value.
  * Forget about workloads that support production ready functionality, because those
    workloads, work out of the box without needing additional setup or configuration.

## 3. The standardized baseline will be optimized for a target audience of SMBs
* Standardization requires a standard. 
* Coming up with a standard requires making decisions when options and choices exist.
* Decisions will be made with the goal of doing an opinionated optimization of the
  perceived needs and wants of generic SMBs (Small to Medium Businesses).
* Example optimizations to aim for when making decisions:
  1. Cheap TCO (Total Cost of Ownership)
  2. Be quick and easy for non-EKS specialists to learn.
     * High quality documentation matters, because teams of EKS specialists are rare,
       and teams with basic knowledge who would benefit from docs are common.
  3. A production ready setup should be fast and easy:
     * By minimizing prerequisites, prior knowledge, and configuration changes.
     * By prioritizing a high quality user experience.
  4. Be beginner friendly.
     * Abstract away complexity as much as practical.
     * In terms of coding conventions:
       * Favor code thats simple, easy to read, and intuitively understand by someone
         with little to no prior knowledge.
       * Detailed IaC code comments (similar to what you'd see in a helm values file)
         should be viewed as reasonable, since the intended audience can't be assumed
         to have specialised knowledge of the implementation language or technology,
         and SMBs can't be assumed to be able to afford training time.

## 4. Make it easy to deploy and manage multiple EKS clusters
* It's a best practice to have multiple clusters: dev, stage, and prod.
  * It's also handy if you can have N-dev, N-stage, and N-prod clusters.
* Automation that's relatively easy to maintain and flexible enough to handle multiple
  clusters is hard:
  * It needs to use variable parameters.
  * Environments should also stay relatively synchronized and consistent, so it's
    useful to allow the variable parameters to be shareable and overrideable.
  * Change management workflows like changing dev, then stage, then prod also need to
    be taken into consideration.

## 5. Prioritize a great user experience at all levels
* A great FTUX (First time User Experience):
  * A new user should be able to:
    * Deploy their first cluster within an hour.
    * Use docs to learn the basics within a few hours.
    * Easily gain working proficiency within a week.
  * Docs that help with new user onboarding docs and offer usage advice with
    justifications.
    * Phased adoption/onboarding with next steps that gradually introduce best
      practices.
    * Has advice for advanced topics long with examples, for things like managing
      automated deployment of custom workloads and infrastructure secrets.
* Easy and Intuitive UX (User Experience):
  * Well organized docs, infrastructure as code, and config.
  * This tool's IaC should try to use design elements of helm and kustomize.
    * Helm and kustomize's popularity proves that elements of their designs are
      intuitive for new users, and if someone has prior knowledge of them, then
      they'll see familiarity in the patterns and it'll be even more intuitive.
    * Some specific design elements to emulate: 
      * Make it intuitively obvious where to look for config that can be edited.
      * Make it intuitively obvious what config shouldn't be edited.
      * Lower cognitive overhead by abstracting away and hiding complexity:
        * Make it intutiively obvious to users what parts of the system they should
          metaphorically treat as black box. 
        * Ex: Helm's golang templating, and Kustomize's base folder. Can be treated
          as a black box that you can peek into the box if curious, but as an end
          user, it's known there's no need to fully understand it to use it.
        * Their configuration languages try to be simple and don't require deep
          understanding of specialized knowledge.
