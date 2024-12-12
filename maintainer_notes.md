# Commands last used to update dependencies
* https://github.com/aws-quickstart/cdk-eks-blueprints/tree/blueprints-1.16.2
  a specific release of eks-blueprints, will mention pinning to a specific version of cdk
  * There were a few times I was able to mix eks-blueprints with newer version of cdk
  * But I've also run into unexpected bug when trying to mix 1.16.2 with 2.170.0  
    and it often results in npm install errors as well, so best to pin to the version
    the blueprints suggest.

```shell
cd ~/eks-cdk-quickstart
rm -rf ~/eks-cdk-quickstart/node_modules
npm install --include=dev @aws-quickstart/eks-blueprints@1.16.2 aws-cdk-lib@2.162.1
```
