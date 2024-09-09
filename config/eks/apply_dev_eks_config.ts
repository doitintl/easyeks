import { Easy_EKS_Config_Data } from '../../lib/Easy_EKS_Config_Data';
import * as blueprints from '@aws-quickstart/eks-blueprints'
//Intended Use: 
//EasyEKS Admins: edit this file with config to apply to all dev cluster's in your org.

export function apply_config(config: Easy_EKS_Config_Data){ //config: is of type Easy_EKS_Config_Data
  config.setRegion("ca-central-1"); //<-- ca-central-1 is a Hydro Powered AWS Region (Low CO2 emissions)
  //^-- good choice for lower env clusters, as follows sustainability pillar of AWS's well architected framework
  config.addTag("Environment", "Dev");
//  config.addClusterAdminARN("arn:aws:iam::905418347382:user/chrism");
  //^--Note: principal in ARN must exist or deploy will fail
}
