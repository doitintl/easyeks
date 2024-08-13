import { Easy_EKS_Config_Data } from '../lib/Easy_EKS_Config_Data';
import { addons } from '@aws-quickstart/eks-blueprints'
//Intended Use: 
//A baseline config file (to be applied to all EasyEKS Clusters)
//That 98% of global users will feel comfortable using with 0 changes, but can change.

export function apply_config(config: Easy_EKS_Config_Data){ //config: is of type Easy_EKS_Config_Data
  config.addTag("IaC Tooling used for Provisioning and Management", "aws cdk");
  config.addTag("Upstream Methodology Docs", "https://github.com/doitintl/eks-cdk-quickstart");
  config.setAccount( process.env.CDK_DEFAULT_ACCOUNT! ); //<-- pulls value from CLI env,
  config.setRegion( process.env.CDK_DEFAULT_REGION! ); //<-- ! after var, tells TS it won't be null.
  //^--If you follow suggested order of application, org and environment config applies can override this default.
  config.addAddOn( new addons.KubeProxyAddOn( 'auto' ) );
}
