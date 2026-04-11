These yaml files:
* Get applied/deployed during the cluster stage  
  as in: `cdk deploy dev1-eks-cluster`
  * The intent is for the clsuter stage to deploy the dependencies (like CRDs) of the next stage.  
    (The next stage would be the essentials stage).
* Are referenced & deployed by the deploy_addons() method of a typescript file named:
  * global_baseline_eks_config.ts

Awareness of Naming Convention:
* '*.global_baseline.*' is in their filename, that's a hint that they get called by global_baseline_eks_config.ts
