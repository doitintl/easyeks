These yaml files:
* Get applied/deployed during the essentials stage  
  as in: `cdk deploy dev1-eks-essentials`
* Are referenced & deployed by the deploy_essentials() method, of typescript files like:
  * global_baseline_eks_config.ts
  * my_orgs_baseline_eks_config.ts
  * lower_envs_eks_config.ts
  * etc. (*_eks_config.ts)


Notes:
* By convention/tendency, each yaml should contain a comment regarding
  the file it's referenced by.


Awareness of Naming Convention:
* '*.global_baseline.*' is in their filename, that's a hint that they get called by global_baseline_eks_config.ts
