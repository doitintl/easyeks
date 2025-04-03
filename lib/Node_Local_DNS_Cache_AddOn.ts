import { Construct } from 'constructs';
//import * as blueprints from '@aws-quickstart/eks-blueprints';

//v-- User provided options for the Helm Chart
//    This add-on doesn't need user supplied values, this is done for the sake of following convention.
// export interface NodeLocalDNSCacheAddOnProps extends blueprints.HelmAddOnUserProps {
//   name?: string,
//   namespace?: string
//   createNamespace?: boolean,
//   version?: string,
// }

//v-- Default props to be used when creating the Helm chart
// export const defaultProps: blueprints.HelmAddOnProps & NodeLocalDNSCacheAddOnProps = {
//   name: "node-local-dns-cache-addon", // Internal identifyer for our add-on
//   namespace: "kube-system", // Namespace used to deploy the helm chart
//   chart: "node-local-dns", // Name of the Chart to be deployed
//   version: "2.0.14", // version of the chart 
//   // Chart's version shouldn't need to be updated, but the following can be used to check for updates:
//   // helm repo add deliveryhero https://charts.deliveryhero.io/
//   // helm search repo deliveryhero | egrep "CHART|dns"
//   release: "node-local-dns-cache", // Name for our chart in Kubernetes (helm list -A)
//   repository: "https://charts.deliveryhero.io/",  // HTTPS address of the helm chart (associated with helm repo add command)
//   values: {} // Additional chart values. 
//   //^-- Default Helm Chart Values are fine/nothing needs to be passed in, per--v
//   //https://stackoverflow.com/questions/71920188/how-to-enable-node-local-dns-cache-on-eks
// }



// /**
//  * populateValues populates the appropriate values used to customize the Helm chart
//  * @param helmOptions User provided values to customize the chart
//  */
// function populateValues(helmOptions: NodeLocalDNSCacheAddOnProps): blueprints.Values {
//     const values = helmOptions.values ?? {};
//     return values;
// }


// export class NodeLocalDNSCacheAddOn extends blueprints.HelmAddOn {

//   readonly options: NodeLocalDNSCacheAddOnProps

//   constructor(props: NodeLocalDNSCacheAddOnProps) {
//     super({...defaultProps, ...props});
//     this.options = this.props as NodeLocalDNSCacheAddOnProps;
//   }

//    deploy(clusterInfo: blueprints.ClusterInfo): Promise<Construct> {
//      const values: blueprints.Values = {};
//      //let values: blueprints.Values = populateValues(this.options);
     
//      const chart = this.addHelmChart(clusterInfo, values);
     
//      return Promise.resolve(chart);
//    }
// }


