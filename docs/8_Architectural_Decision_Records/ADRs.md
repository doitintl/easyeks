# ADRs: Architectural Decision Records
* Design Decisions made and rational behind why design decisions were made.  
  So somewhat similar to RFCs (Request for Comments) or design docs.
* These ADRs will be presented in a FAQ (Frequently Asked Questions) style format.

---------------------------------------------------------------------------------------------------------

## Q1: Why CDK over TF?
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
      * cdk makes it (relatively easy) to bootstrap an AWS Code Commit and Code Pipeline based GitOps
        solution.
      * cdk can be finicky about changes, so it's useful to have optimial feedback loop
      * Their solution only trades problems. Solves 1 in exchange for others.  
        A non-starter for me is GitOps hurts observability and feedback loop.

---------------------------------------------------------------------------------------------------------

## Q2: Why CDK over Pulumi?
* To summarize, for pragmatic reasons:
  * From an idealistic / purely technological perspective I personally believe Pulumi is 2x better than
    CDK. It'd probably be sufficiently better at:
    * Imperatively ordered provisioning
    * Robust input validation and IaC test suites
    * Feedback loop / execution times if written in golang (CDK's golang annoyingly still needs node.js)
  * AWS CDK's advantages, that made it win out:
    * Technical advantage is Cloud Formation makes bootstrapping of IaC "state" easier
    * CDK's community adoption is 10x bigger than Pulumi's
      * Pulumi has some EKS projects but they always have 1-10 github stars
    * CDK's commitment to long-term support is 10x better than Pulumi's
      * [Pulumi's EKS projects keep getting 1-10 commits then abandoned.](https://github.com/pulumi/eks-blueprint)
      * AWS's EKS Blueprints has been actively maintained for a few years, [it's at over 3k commits](https://github.com/aws-quickstart/cdk-eks-blueprints)
  * https://lethain.com/magnitudes-of-exploration/  
    ^-- This article is devops philosophy gold, and gives more insight on why I favor the 2 10x benefits
    over the 1 2x.

---------------------------------------------------------------------------------------------------------

## Why EasyEKS over CDK?

We follow the "batteries included, but swappable" philosophy. (Quote stolen from Fck NAT)

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

## Qn: What testing strategies are used?
(not yet implemented, just intended)
1. Only a minimium degree of typescript input validation will be used in places where it make sense.  
   * Why: TS validation working 100% of the time, can lead to some annoying edge cases in terms of UX.
2. The majority of left shifted configuration testing/input validation will be a manually invoked
   function call to trigger custom testing logic.  
   There's a few benefits to this approach:  
   * Users can define 2 clusters that exist in 2 different AWS accounts in the IaC, and not get constant
     false positive test failures about lack of existance or access.
   * IaC also involves CaC (config as code), and config isn't something you always want to test
     immediately. Sometime you want to stage config for something that will exist soon. Or there's an
     order of operations and external dependencies. It's nice to be able to stage config error free
     in the scenario where you know it wont work today, but should work tomorrow, and this can avoid
     some annoying constant error message scenarios.
   * From a practical standpoint you'd only be interested in testing what you're about to deploy.
     so there's no major downsides to the approach, and it has the upside of slightly faster feedback,
     by ensuring tests only run on demand on an as needed basis, and can be temporarily turned off.
   * Cleanly decoupled, opt-in test valdiation means, temporarily breaking the test logic won't block
     deployments. I can imagine an end user forking this project, and maybe adding some custom test
     logic, they can tinker with it without fear that temporarily breaking the test logic will break
     their ability to deploy. (worst case it'll just break leftshifted feedback.)
3. Post deployment test logic could be added, and with an option to select a subset of relevant tests.

---------------------------------------------------------------------------------------------------------

## Qn: Why not use fargate? / Why is the universal baseline 2x ARM based t4g.small spot nodes?
* Short answer is Pragmatic FinOps.
  * User facing workloads would be scheduled on karpenter.sh managed nodes  
    which could be configured as spot or on-demand, per the business's preferences.
  * Things in kube-system are made resilient to not mind running on spot-nodes.
  * CoreDNS has sufficient HA/FT, even when backed by spot, if it's 2-3 replicas are spread across
    2-3 AZs.
  * Spot capacity is different per AZ, so it's statistically unlikely that all 2-3 AZ's would go down
    at the same time.
* Why t4g.small > t4g.micro:
  * t4g.micro allows 4 pods per nodes (you'll hit this limit before hitting cpu/ram limit)
  * t4g.small allows 11 pods per node, we need more than 4 due to daemonsets
* Note the following prices listed are based on ca-central-1 pricing. (North America's Hydro powered region.)
  * ARM64(ARM) is cheaper than Intel/AMD's_x86_64(AMD)
    * t3a(AMD).small-on-demand = $0.0188/hr
    * t4g(ARM).small-on-demand = $0.0168/hr
  * 2 spot nodes cost less than 1 on-demand node
    * t4g.small-on-demand = $0.0168/hr
    * t4g.small-spot      ~ $0.0072/hr
  * EKS fargate is relatively expensive:
    * EKS has partial support for fargate nodes:
      * EKS currently only supports x86_64 Fargate (while ECS also supports cheaper ARM based Fargate)
      * EKS currently only supports on-demand Fargate (while ECS also supports cheaper Fargate spot)
    * Using ca-central-1 pricing:  
      * Smallest possible fargate pod size is 0.25 vCPU and 0.5GB ram  
        math (0.25*$0.04456+0.5*$0.004865) says each fargate pod costs $0.0135725/hr
      * You can almost buy 2 spot nodes for the price of 1 fargate pod
    * Equally important: Fargate goes against best practice of embracing standardization, it's usage
      would create edge cases, and edge cases would result in complexity.

---------------------------------------------------------------------------------------------------------

## Qn: Why default to GPL Monitoring stack? Why not ADOT? (Amazon's fork of ElasticSearch?) Why not CloudWatch?
* Why not CloudWatch:
  * It's relatively expensive
  * It's very hard to calculate and predict costs
  * It's got a relatively poor UX (User Experience)
* Why not ADOT fork of ElasticSearch:
  * Is relatively fragile. (It's stable, just speaking relatively.)
  * Is relatively Resource Inefficient. (So self hosting on kube becomes expensive in terms of infra)
  * Was never designed for log ingestion, it was designed for full text search of a static dataset.
    * Log Ingestion and the ability to handle kubernetes logs was bolted on as an after thought, so none
      of the above 2 points should be surprizing.
* Better/Newer Alternatives that were designed post-Kubernetes are:
  * [QuickWit](https://github.com/quickwit-oss/quickwit) Which is based on a tantivy, a rust clone of
    ElasticSearch.
  * [Loki by Grafana Labs](https://github.com/grafana/loki)  
  * The above 2 are best in class FOSS/generic kubernetes solutions that exist today as far as I'm aware.
  * GPL (Grafana, Prometheus, Loki) Stack wins out against QuickWit for this use case in my opinion, because:
    * GPL Stack is currently more mature.
    * Loki doesn't do indexing so ingestion is cheap in terms of cpu,ram,disk space then when querying
      queries take extra cpu/ram resources and can be slow at massive scale.
    * QuickWit does indexing so ingestion is takes extra cpu,ram, and disk space, in exchange for faster
      queries and working smoothly at massive scale. 
    * Also as a matter of personal preference Loki's query style reminds me of datadog's, which I
      slightly prefer over Lucene in terms of UX. (In practice both are great.)

---------------------------------------------------------------------------------------------------------

## Qn: Why is grafana secured the way it is?
* It boils down to practicality, there's this concept of threat analysis based security hardening,
  where before implementing any controls you ask the question. What do I want to protect against?
  * In my experience most companies:
    * Care about protecting their logging and monitoring stack against external internet based threats.
    * Don't mind giving all their employees access to metrics and logs. 
  * A shared user-name and password based login isn't usually a significant concern in this scenario.
    * If both are randomly generated and stored in AWS Secrets Manager, it sufficiently protects against
      most external threats when paired with HTTPS.
    * Then a shared NACL (Network Access Control List), basically a Security Group to Implement Firewall
       * Whitelisting adds sufficient defense in depth against any zero day exploits or negligance in
         terms of keeping a self-managed service on the lastest version.
       * In most cases it's trivially easy to add extra security by whitelisting an office, admin's home
         network, if the edge case where a static IP is lacking, kubectl port-forward can be used in a
         pinch, and a SSO enabled VPN to a network white a NAT GW that has a static IP that can be white
         listed, is a solution that could be implemented for the edge case, but that nice thing is it
         can be implemented incrementally, rather than blocking immediate value with a problem
         transformation. 
  * These 3 measures together solve problems that matter in a way that minimizes newly added problems.
    * These 3 can be E2E automated
    * Avoid the inifite DevOps Yak Shaving Trap where the solution to 1 problem involves the
      introduction of new problems. So I see it as a legitimate solution to problems rather than a fake
      solution that just transforms your original problem into a new problem.

---------------------------------------------------------------------------------------------------------

## Qn: Why is the networking the way it is? (Dual Stack VPC, IPv6 EKS, Reusing VPCs?, NAT?)
* TL;DR Summary: To solve problems with the default implementation details.
* What Problems exist in the default implementations:
  * If you let EKS Blueprints make a VPC for an EKS cluster
    * You'll get a IPv4 based VPC of 10.0.0.0./16
      * Each subnet will be a /19 (8190 usable IPs)
    * 3 public AZs
    * 3 private AZs
    * 3 managed NAT GWs (1 per AZ)
    * Each LB will be provisioned in 3 AZs, with 3 public IPs
  * Why is that (mildly) problematic?
    * 3 managed NAT GW = 3 * $0.05/hr * 730hr/month = $110/month
    * For a test cluster in a sandbox environment that was over half my bill.
    * It's not uncommon to have 3-4 EKS clusters for risk management and general best practices
      (dev, stage, prod, etc.) (It's also not uncommon to have temporary sandbox clusters.)
    * Also public IPv4's cost money now $0.005/hr * 730hr/month = $3.65/month each.
      NAT GWs, and 2 LBs across 3 AZs could easily turn into 9 IPs or $33/month.
    * These small inefficiencies aren't bad on their own, but 1 VPC per cluster results in them
      getting multiplied. (A little waste tends to increase net-efficiency, but wasteful spending can
      add up quickly at scale.)
    * https://fck-nat.dev/stable/ allows the cost of NAT GW to be cut by 10%  
      Side Note they have a donation link https://ko-fi.com/codebrewed
  * Light reuse of VPCs has several benefits:
    1. It saves on NAT GW costs / costs can scale better if you create multiple environments.
    2. It can help avoid complex networking and VPN sprawl.
    3. Most customers have pre-existing infrastructure and will deploy to a pre-existing VPC anyways.
       so it makes sense to support that common deployment option.
    4. There's usually no problem security wise with a 2 VPC setup to isolate
       lower and higher environments.  
       Example: dev, qa, test, and sandbox environments in a lower VPC.  
                staging, prod, or a blue green cutover prod-v2 in a higher VPC.
  * Light reuse and deploying into-pre-existing VPCs can surface an EKS edge case problem.
    * By default pods can quickly use up IPv4 IPs.
    * Going with a dual stack cluster and prefering EKS in IPv6 mode eliminates that problem.
      because EKS worker nodes are given IPv4 IPs, but pods are given IPv6 IPs, that allows the
      IPv4 part of the dual stack to last.

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
