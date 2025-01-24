Easy EKS was originally written based on "EKS Blueprints" (A Level 3 CDK Construct).
After 6 months of pre-alpha development, and running into many edge cases and limitations.
It was refactored to use "EKS" (A Level 2 CDK Construct).

Here's more specifics about why:
* This project doesn't use many EKS Blueprint features/design patterns, and thinks many of them are not a good idea.
  * Like teams with rbac rights mapped to namespaces
  * GitOps Pipelines powered by AWS Services
  * Also CodeCommit is being removed from AWS so CDK based GitOps Pipelines may stop working in the future.
* cdk-eks-blueprints isn't well maintained/practically abandoned
  * I was tricked into thinking it was maintained based on seeing over 3k commits + recent commits
  * But https://github.com/aws-quickstart/cdk-eks-blueprints/graphs/code-frequency
    shows that over 95% of the commits happend across 3 spikes in prior years. After Dec 2022, there's barely any commits.
  * Many addons offered by EKS Blueprints are unmaintained
    * When a new release of EKS came out, L2 construct would quickly gain access to it, but L3 construct would gain access
      only after a month had passed.
    * There's an istio addon that's on an ancient version, which makes me think it was added then left to rot.
    * This is a poor UX because it makes you expect things it makes available to work, but they don't.
      * I've encountered many situations where it was easier to get things to work and fix bugs by starting over from scratch.
    * EKS Blueprints karpenter had only offered old versions, been in a non-working state for months, and had limitations
      that'd prevent certain customizations even if it was semi working.
  * Many features that work for the L2 construct can't be used with the L3 construct, and the L3 either makes them harder
    or in some cases breaks them in odd ways.
    * I wasn't able to customize the aws-auth configmap.
    * I wasn't able to apply arbitrary kubernetes yaml manifests.
    * I was able to modify an EKS blueprint cluster provider class to get access to the L2 EKS construct
      but then only a subset of logic that normally works with the L2 EKS construct would work correctly, and it seemed
      to be related to an order of operations hard limitation imposed by the "EKS BP L3 C", so using it introduced unfixable
      bugs.

