These get yaml files get applied/deployed during the cluster stage  
as in: `cdk deploy dev1-eks-cluster`  
Notes:
* By convention, each file will contain a comment regarding the file it's referenced by.
* The intent is for dependencies of essentials stage (`cdk deploy dev1-eks-essentials`)
  to be deployed during the cluster stage.
