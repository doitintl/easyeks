## Explanation of Approach (Why) (Architectural Decision Records)
* Philosophy(as in criteria for good) of what makes good DevOps/IaC Solution:
  * A Good DevOps Solution will solve a problem in a way that genuinely simplify the problem.
    * A commonly made mistake is the proposal of a solution, that in reality just transforms a problem, by means of solving an
      original problem in exchange for creating N new problems.  
      (This often happens when people treat Kubernetes as a solution they can throw at a problem.)  
      (Kubernete's isn't bad, their propsosed solution is just incomplete.)
    * A Good DevOps solution is able to genuinely simplify problems by:
      * Minimizing the number of new problems introduced by the adoption of the proposed solution. 
      * If newly introduced problem is a DevOps Yak Shaving Dependency, and it can't be removed/avoided, the troublesomeness of
        it should be minimized by E2E automating the dependency as much as possible, and ensuring smooth user friendly onboarding UX.
  * Reproducibility is the ideal (GitOps is just 1 way of achieving)
  * AWS CDK offers a [GitOps Pipeline](https://catalog.workshops.aws/eks-blueprints-for-cdk/en-US/050-multiple-clusters-pipelines)
    where git commits can be used to trigger deployments, updates, and manage the lifecycle of a cluster using GitOps for both
    the infra and the workloads. 
    This was purposefully not done, In favor of manual infra & GitOps workloads. 
    (Because AWS's proposed solution goes against my philosophy of what a good solution looks like).
    (That approach creates multiple problems, 2 big one's are poor feedback loop and poor deployment observability.)
* AWS CDK has the potential to be better than OpenTofu(AKA Terraform) for EKS, problem is onboarding UX.
  This approach offers a streamlined onboarding UX to AWS CDK Blueprints for EKS.
  * Why CDK > TF? what problems does TF have?
    * TF has an onboarding UX problem, related to TF statefile.
    * CDK minimizes that problem by using Cloud Formation to store state.
    * TF makes it easy to have 1 environment, but managing N environments that can share code is harder.
    * CDK makes it easier to manage N environments.
    * Neither TF nore CDK is superior in 100% of scenarios; however, I'd argue that CDK is superior for EKS, because:
      * AWS has invested more into their EKS blueprints based on CDK, it's more mature. https://aws-quickstart.github.io/cdk-eks-blueprints/addons/ 
      * AWS's EKS blueprints based on TF are on their 5th breaking change https://aws-ia.github.io/terraform-aws-eks-blueprints/v4-to-v5/motivation/#what-is-changing
      * CDK is less risky than TF. (AWS may decide to stop backing TF in the future, and TF is being replaced by OpenTofu) (CDK has neither problem.)
* Problem with docker:
  We could use a container image to pin version of aws cdk cli & dependencies, but it has UX problems.
* UX improvements from using NixOS based flox.dev over docker. 
  * we still get cli & dependency version pinning (only using NixOS, under the hood with complexity/implementation details abstracted away, instead of docker.)
  * It's designed to merge into your existing shell vs replace it
    * So if you have a fancy starship.rs based shell, you can keep using it.
    * If you have AWS CLI credentials available on your machine the flox shell environment can access them
  * nix based solution vs containers, strikes a better balance of customization and standardization.
* Q: Why flox.dev over devbox? (Alternative NixOS based solution.)
  A: .toml config offers a better UX than json config.
* Problems solved:
  * 1st to give Linux, Mac, WSL2 users reading this onboarding guide a more standardized shell environment
    from which to run the following commands.
  * 2nd is that AWS CDK backed by TypeScript is sensitive to things like
    the version of aws (aws cli), cdk (aws cdk cli), node, npm, etc. That's
    installed on your machine.
  * This approach makes your life easier:
    * When working as a team, where you want your team mates to use the same tools.
    * If you work on multiple projects that might need different versions of dev tools installed
    * If you go 6-12 months between touching this and periocially updating dependencies breaks your local 
      environment's compatibility with the IaC.


