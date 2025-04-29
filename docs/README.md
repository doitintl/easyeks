# Easy EKS (Pre-Alpha)

## What problem does this solve?
* EKS is a double-edged sword:
  * Good: 
    * It simplifies the setup of a Kubernetes Cluster on AWS.
    * It works great after it's set up.
  * Bad: 
    * Set up is left to end users who have a high risk of setting it up poorly, taking months, or
      both.
    * It has a terrible FTUX (first time user experience) and OOTB (out of the box) UX (user
      experience).
* Easy EKS is a solution to EKS's problems related to its slow and flawed set up process, FTUX, and
  OOTB UX.
  * https://www.reddit.com/r/aws/comments/qpw36d/aws_eks_rant/
  * https://www.reddit.com/r/devops/comments/y5am95/why_is_eks_and_aws_in_general_so_much_more/
  * https://matduggan.com/aws-eks/

## What is Easy EKS?
* Easy EKS is a user experience optimized approach to EKS, where using it becomes `simpler`, `accessible`, and `enjoyable`.

-------------------------------------------------------------------------------------------------------

### Simpler EKS
1. **Deployment <u>and baseline configuration</u> are both automated:**
   * `cdk` is used to automate the provisioning of production ready EKS Clusters.
2. **The administrative overhead associated with managing multiple clusters is minimized:**
   * A `kustomize inspired` design pattern is used to make the deployment and management over time of multiple clusters much easier.
3. **Complexity is simplified, by shielding the end user engineers from unnecessary complexity that's practical to hide away:**
   * A `helm inspired` design pattern to abstract away complexity.
     * helm hides complexity in templatized yaml files, and helm values.yaml files, which represent sane default values of input parameters to feed into the templating engine.
     * Here's an example of how helm allows end uesrs to see a significantly simplified interface:
       * A 15 line long `kps.helm-values.yaml` file (of values representing overrides of
         kube-prometheus-stack helm chart's default input parameters)
       * With a command like `helm upgrade --install kps oci://registry-1.docker.io/bitnamicharts/kube-prometheus --version=9.6.2 --values=kps.helm-values.yaml --namespace=monitoring --create-namespace=true`
       * Can deploy over 10,000 lines of yaml to a cluster. The complexity still exists, but it's
         hidden, abstracted away, and replaced with a simplified interface for end users.
     * Easy EKS hides it's complexity in:
       * /lib/ (a cdk library)
       * /.flox/ (a recommended, yet optional method of automating dev shell dependencies with `flox activate`)
     * Easy EKS presents a simplified workflow to end users:
       * Edit /config/ (which is an intuitive and simplified end user interface inspired by kustomize and helm values)
       * `cdk list`
       * `cdk deploy dev1-eks`

-------------------------------------------------------------------------------------------------------

### Accessible EKS
| **Accessibility Concerns**                                                 | **The following Common EKS Barriers**                                                                                                                                                                                                                                                                                                                                                                                                    | **Are replaced with a streamlined happy path**                                                                                                                                                                                                                                               |
|----------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Learning how to deploy a Production Ready Cluster                          | Often takes `weeks` to learn the basics, `months` to become proficient.                                                                                                                                                                                                                                                                                                                                                                  | Often takes `hours` to learn the basics, `days` to become proficient.                                                                                                                                                                                                                        |
| Installation Experience                                                    | It's like building a custom computer from parts, each potentially `needing research and troubleshooting`, then installing an OS.                                                                                                                                                                                                                                                                                                         | It's like installing an OS on a `preassembled` computer. (Still work, but significantly less)                                                                                                                                                                                                |
| Installation Docs                                                          | EKS and components need to be installed, often `over 10 installation docs`  are needed, and spread across AWS and multiple 3rd party repositories.                                                                                                                                                                                                                                                                                       | A bundled and automated installation allows for `more centralized installation docs`.                                                                                                                                                                                                        |
| Prerequisite Knowledge                                                     | AWS's cdk based EKS Blueprints, can make things easier, but it `requires prior knowledge` of JavaScript, TypeScript, npm, and EKS Blueprints. It's also worth pointing out that `EKS Blueprints, is not a turn key automated platform`, it's the building blocks that could be used to build one.                                                                                                                                        | Easy EKS is designed to prioritize FTUX (First Time User Experience), minimize cognitive complexity, be intuitive, and documented enough for those with `zero prior knowledge` to find it easy.                                                                                              |
| Successful adoption needs EKS specialists, which create staffing concerns. | It's not uncommon to dedicate at least 1 full-time engineer to managing "DevOps Yak Shaving" and "engineering toil heavy tasks" tasks associated with EKS. `Expensive Staff` Augmentation can set things up quick, Cheaper Engineers still end up being more expensive from needing more time or creating a patchwork that will need to be reworked. "Bus factor", job mobility, time off, and skillset bottlenecks are common concerns. | A standardized, easy to learn, free open source product allows staff to be more fungible. `Specialized Knowledge is still needed, but orders of magnitude less`, even a Jr Engineer could become proficient within a week, and wouldn't need to dedicate their time on low value toil tasks. |

-------------------------------------------------------------------------------------------------------

### Enjoyable EKS

* User Experience is what makes cars enjoyable products. The same is true for Easy EKS.
  * Cars have complexity,
    * But it's the car maker that deals with the complexity. 
    * You the end user get a simplifed turn key user experience.
    * It's designed to be intuitive, learning how to drive isn't hard.
  * Easy EKS has complexity,
    * But you will be shielded from the majority of the complexity, it's abstrated away where practical.
    * `You get to enjoy a turn key, batteries included, production ready user experience`.
    * It's designed to be intuitive, and even FTUX (first time user experience) and OUX (onboarding UX)
      are prioritized to make it easy to learn.
* You can enjoy:
  * Being able to get meaningful work done quick:
    * Learn the basics within a day.
    * Deploy a cluster in under an hour, with a production ready baseline configuration.
    * Develop working proficiency in under a week. 
  * Not having to think through engineering toil:
    * Instead of choices, that make engineer's stress over identifying the best chocie.
    * You get an opinionated approach of wise decisions that are best for most people.  
      (They're sane well optimized defaults that can be overriden if needed.)
    * opinionated with decisions made = standardized
    * standardization is a pre-requisite for end to end automation.
  * Being confident in your choice to use Easy EKS:
    * Easy EKS was designed and automated by a platform engineer, with over 6 years of kubernetes
      consulting experience. Who has been a senior architect, builder, IaC coder, and automation
      engineer of over 5 built from scratch kubernetes platforms.
    * ADR's (Architectural Decision Records) are available to verify reasoning behind all choices.
      * This isn't just a platform that claims to follow best practices.
      * It's a platform that includes justifications of why it's practices are best practices.

-------------------------------------------------------------------------------------------------------

## Why Easy EKS Exists
| **Basic Functionality you'd expect to see, for normal usage and production readiness:** | **GCP's GKE AutoPilot:**<br> (a point of reference of what good looks like) | **AWS EKS:**<br> (The default out of the box user experience is a collection of dumb problems to have)                                                                                                                                           | **Easy EKS**  <br> (Smart solutions to dumb problems that make EKS easier, brought to you by doit.com)                                                                                 |
|-----------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| A well configured VPC                                                                   | Default VPC ships with Cloud NAT                                            | Default VPC doesn't ship with a NAT GW, and Managed NAT GW is so bad [(link 1)](https://www.lastweekinaws.com/blog/the-aws-managed-nat-gateway-is-unpleasant-and-not-recommended/), that fck-NAT exists [(link 2)](https://fck-nat.dev/stable/). | Ships with fck-NAT (order of magnitude cheaper), and dualstack VPC for IPv6 based EKS, which eliminates potential problem of running out of IPs.                                       |
| Optimized DNS                                                                           | DNS is optimized by default via Node Local DNS Cache and Cloud DNS          | Ships with nothing. A relatively easy install won't be Fault Tolerant, won't have a dns auto-scaler, nor node-local-dns-cache. Figuring out production grade optimizations takes days.                                                           | Alpha ships with Node Local DNS Cache, core dns autoscaler, and anti affinity rules for increased fault tolerance.<br> Planned for Beta: verify/optimize core dns autoscaler's config. |
| Easily populate ~/.kube/config for Kubectl Access                                       | A blue connect button at the top of the Web GUI, shows a command.           | Access tends to be a multistep process, so you look up docs for something that should be trivially easy.                                                                                                                                         | When cdk eks blueprints finishes, it outputs a config command.                                                                                                                         |
| Teammates can easily access to kubectl and Web Console                                  | GCP IAM roles map to GKE's rbac rights by default.                           | In general, access needs to be explicitly configured per cluster, nuanced limitations make it hard.                                                                                                                                              | Pragmatic workarounds to access limitations are set by default to make access easier.                                                                                                  |
| Metric Level Observability                                                              | Ships with preconfigured working dashboards                                 | Ships with nothing, figuring out how to set up takes days.                                                                                                                                                                                       | PLANNED (alpha)                                                                                                                                                                        |
| Log Level Observability                                                                 | Ships with intuitive centralized logging                                    | Ships with nothing, figuring out how to set up takes days.                                                                                                                                                                                       | PLANNED (alpha)                                                                                                                                                                        |
| Automatically Provisions storage for stateful workloads                                 | Ships with a preconfigured storageclass                                     | Ships with broken implementation, fixing is relatively easy, but how/why is this not a default functionality baked into the platform?                                                                                                            | Ships with KMS Encrypted EBS storageclass                                                                                                                                              |
| Automatically Provision Load Balancers for Ingress                                      | Ships with GKE Ingress Controller and GKE's Gateway API controller          | Ships with nothing, and the solution: AWS Load Balancer Controller, is considered a 3rd party add-on, with a complex installation that can take days to figure out.                                                                              | Ships with AWS Load Balancer Controller                                                                                                                                                |
| Pod Level IAM Identity                                                                  | Ships with Workload Identity (pod level IAM roles)                          | Ships with nothing, making it work is relatively easy, seems reasonable to have this be a default baked into the platform.                                                                                                                       | Ships with Amazon EKS Pod Identity Agent                                                                                                                                               |
| Worker Node Autoscaling                                                                 | Ships with NAP (Node Auto Provisioner)                                      | Ships with nothing, figuring out how to install cluster autoscaler or karpenter.sh can take days.                                                                                                                                                | Ships with Karpenter.sh (Note: currently an outdated version to avoid compatibility issues, waiting for Karpenter 1.2.x / stable version planned for alpha)                            |

-------------------------------------------------------------------------------------------------------

## How do I get started?
[Check the docs page](/docs)
