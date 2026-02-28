These yaml files:
* Get applied/deployed during the cluster stage  
  as in: `cdk deploy dev1-eks-cluster`
* They are referenced / deployed by typescript files

Notes:
* By convention/tendency, each yaml should contain a comment regarding
  the file it's referenced by.
* The intent is for the cluster stage to deploy the dependencies of
  the next stage, which would be the essentials stage.