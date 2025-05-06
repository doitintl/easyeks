# Easy EKS (Pre-Alpha)

## What is Easy EKS?
**Here are 3 useful answers to that question based on different perspectives:**  
(Each answer is clarified further in later sections on this page.)
1. **A Solution:**  
   Setting up and learning how to implement EKS according to best practices is often said to be hard,
   so much so that it crosses the threshold of being problematically difficult and a barrier to
   adoption. From this perspective Easy EKS can be seen as a solution to EKS's difficulty problem.
2. **Summarized Technical Description:**  
   An opionated bundling of automation & IaC (Infrastructure as Code) that aims to:
   1. Make it easy to provision EKS clusters that are nearly production ready by default.
   2. Maintain a heavily standardized opinionated set of IaC, which makes automation maintainable.
   3. Apply useful design patterns from Helm and Kustomize to IaC based on AWS CDK.
3. **General Description:**  
   A user experience optimized approach to EKS, that aims to make using EKS `simpler`, `accessible`,
   and `enjoyable`.

-------------------------------------------------------------------------------------------------------

### What problem does Easy EKS solve?
* EKS is a double-edged sword:
  * Good: 
    * It simplifies the setup of a Kubernetes Cluster on AWS.
    * It works great after it's set up.
  * Bad:
    * EKS by itself is far from being production ready by default, EKS is more like the virtual
      equivalent of receiving a custom PC build project, while wanting a push button server.
    * It has a terrible FTUX (first time user experience) and OOTB (out of the box) UX (user
      experience), because end users are left to figure out how to re-invent a production ready setup,
      and there's a high risk that they'll set it up poorly, need months to figure it out, or both.
* Easy EKS can be seen as a solution to EKS's problems related to its slow and flawed set up process,
  FTUX, and OOTB UX:
  * https://www.reddit.com/r/aws/comments/qpw36d/aws_eks_rant/
  * https://www.reddit.com/r/devops/comments/y5am95/why_is_eks_and_aws_in_general_so_much_more/
  * https://matduggan.com/aws-eks/

-------------------------------------------------------------------------------------------------------

### What Specific Technical Benefits does Easy EKS Offer?
* **Currently Available in Pre-Alpha:**
  1. `Useful elements of Helm's design pattern are used:`
     * A nice feature of Helm over say Kustomize, Terraform, or common CDK/Pulumi design patterns, is
       that it's intuitively clear what parts of the IaC are fine to change vs shouldn't be changed.
     * Configuration input parameters have sensible defaults, but can be overridden.
     * Some IaC complexity can be hidden, which allows users to focus on well organized config, which
       in turn significantly lowers cognitive overhead and improves ease of mangement and accessibility.
     * Supports the deployment of Multiple Instances: It's very easy to have multiple clusters per
       environment (dev1-eks, dev2-eks, etc.)
     * Helm popularized a convention of mixing config values with
       [heavy commentary](https://artifacthub.io/packages/helm/prometheus-community/prometheus?modal=values)
       which improves accessibility and general user experience, by explaining what a config flag will
       do and documenting commented out examples of alternative possible values with correct syntax.
  1. `Useful elements of Kustomize's design pattern are used:`
     * Kustomize popularized the [config overlay design pattern](https://kubectl.docs.kubernetes.io/guides/introduction/kustomize/#2-create-variants-using-overlays),
       which offers multiple advantages:
       * It allows config shared between multiple environments, to be deduplicated which makes it much
         easier to avoid unwanted config drift between environments, which improves maintainability.
       * It keeps the config well organized, which makes it easier to quickly navigate.
  1. `Two well configured AWS VPCs`
     * The VPCs are dualstack(IPv4/v6), and EKS cluster's use IPv6 mode to eliminate problem of running
       out of IPs.
     * fck-nat: The (f)easible (c)ost (k)onfigurable NAT, is an alternative to AWS's Managed NAT GW,
       that's an order of magnitude cheaper. 
     * lower-envs-vpc defaults to 1 fck-NAT instance
     * higher-envs-vpc defaults to 2 fck-NAT instances, and can optionally be set to 3 AWS Managed NAT
       GWs.
     * node-local-dns-cache and S3 Gateway endpoints are also enabled by default.
  1. `Heavily cost optimized:`
     * Easy EKS gives the benefits of EKS's Auto Mode (and more), without Auto Mode's additional costs.
     * The baseline costs of a dev cluster is under $100/month.
       * EKS control plane cost is $73/month.
       * lower-env-vpc's fck-NAT defaults to $3.06/month, and is meant to be shared by multiple clusters.
       * 2x t4g.small spot baseline nodes are $10.22/month
       * karpenter's lower-envs default config is weighted to prefer spot based ARM bottlerocket nodes.
  1. `UX optimizations:`
     * EKS clusters have useful tags.
     * Name tags of EC2 instances are nicely organized.
     * IAM admins are given EKS viewer access by default for both the EKS web console and kubectl.
     * kubectl onboarding is streamlined.
  1. `Production Readiness optimizations:`
     * kubernetes secrets stored in etcd get KMS encrypted by default.
     * EKS Addons are all installed by default.
     * CoreDNS's config is optimized by default in terms of node affinity and autoscaling.
     * AWS Load Balancer Controller is installed by default and configured using eks-pod-identity-agent,
       which means it doubles as a great IaC reference for pod level IAM rights.
     * Karpenter is installed by default and preconfigured to provision spot, on-demand, AMD, or ARM
       bottlerocket based worker nodes.
* **Planned for Alpha:**
  1. `The default storage class is preconfigured to provide kms encrypted gp3 ebs volumes.`
  1. `Additional streamlining of kubectl access onboarding`
  1. `Metric Level Observability`
  1. `Log Level Observability`
  1. `Standardize Variable Naming Conventions`

-------------------------------------------------------------------------------------------------------

### Simpler EKS
1. **Deployment <u>and baseline configuration</u> are both automated:**
   * `cdk` is used to automate the provisioning of nearly production ready EKS Clusters.
2. **The administrative overhead associated with managing multiple clusters is lower:**
   * A `kustomize inspired` design pattern is used to make the deployment and management over time of
     multiple clusters much easier.
3. **Complexity is simplified, by shielding the end user engineers from unnecessary complexity that can be practically hidden away:**
   * A `helm inspired` design pattern to abstract away complexity.
     * helm hides complexity in templatized yaml files, and helm values.yaml files, which represent
       sane default values of input parameters to feed into the templating engine.
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
       * Edit /config/ (which is an intuitive and simplified end user interface inspired by kustomize
         and helm values)
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
    * `You get to enjoy a turn key, batteries included, nearly production ready user experience`.
    * It's designed to be intuitive, and even FTUX (first time user experience) and OUX (onboarding UX)
      are prioritized to make it easy to learn.
* You can enjoy:
  * Being able to get meaningful work done quick:
    * Learn the basics within a day.
    * Deploy a cluster in under an hour, with a nearly production ready baseline configuration.
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
