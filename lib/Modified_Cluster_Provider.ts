/* Adding Useful Functionality:
2023--: EKS required AWS IAM identity rights to be managed via aws-auth configmap
2024++: EKS allows AWS IAM identity rights to be managed via IAM & EKS APIs
        This needs 2 things:
        1. blueprints.GenericClusterProvider object,
           needs authenticationMode: eks.AuthenticationMode.API_AND_CONFIG_MAP,
        2. cdk.aws_eks.AccessEntry, need access to a cdk.aws_eks.Cluster object
           EKSBlueprint's implemementation details don't make that hand off easy,
           so needed to override, extend, and customize some things.
Upstream Source Code:
https://github.com/aws-quickstart/cdk-eks-blueprints/blob/blueprints-1.15.1/lib/cluster-providers/generic-cluster-provider.ts

Summary of what this does:
new GenericClusterProviderWithAccessEntrySupport({
    partialEKSAccessEntries: [ new partialEKSAccessEntry('arn:aws:iam::905418347382:user/chrism', [clusterAdmin]) ];
}); //^--makes this a valid input parameter, and relatively simple usage logic.
*/
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as blueprints from '@aws-quickstart/eks-blueprints'; 

export class partialEKSAccessEntry {
    subStackID: string; //Access Entry Stack ID, needs to be unique per Access Entry
    accesssPolicies: cdk.aws_eks.IAccessPolicy[];
    principalARN: string;
    accessEntryName: string;
    constructor(principleARN: string, accessPolicies: cdk.aws_eks.IAccessPolicy[]){
      this.subStackID = principleARN;
      this.accesssPolicies = accessPolicies;
      this.principalARN = principleARN;
      this.accessEntryName = principleARN;
    }
}

interface GenericClusterProviderPropsWithAccessEntrySupport extends blueprints.GenericClusterProviderProps {
    partialEKSAccessEntries?: Array<partialEKSAccessEntry>;
}

export class GenericClusterProviderWithAccessEntrySupport extends blueprints.GenericClusterProvider { 
    partialEKSAccessEntries?: Array<partialEKSAccessEntry>;
  
    constructor(props:GenericClusterProviderPropsWithAccessEntrySupport){
      super(props);
      this.partialEKSAccessEntries = props.partialEKSAccessEntries;
    }
  
    protected internalCreateCluster(stateStorage: Construct, stackID: string, clusterOptions: any): cdk.aws_eks.Cluster {
      const cluster = new cdk.aws_eks.Cluster(stateStorage, stackID, clusterOptions);
        if(this.partialEKSAccessEntries){ //<-- JS truthy statement to say if not empty do this
          for (let index = 0; index < this.partialEKSAccessEntries?.length; index++) {
            new eks.AccessEntry( stateStorage, this.partialEKSAccessEntries[index].subStackID, 
              {
                accessPolicies: this.partialEKSAccessEntries[index].accesssPolicies,
                cluster: cluster,
                principal: this.partialEKSAccessEntries[index].principalARN,
                accessEntryName: this.partialEKSAccessEntries[index].accessEntryName 
              }
            );      
          }
        }
      return cluster;    
    }
}
