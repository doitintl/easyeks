import { Easy_EKS_Config_Data } from '../lib/Easy_EKS_Config_Data';
//Intended Use: 
//EasyEKS Admins: edit this file with config to apply to all dev cluster's in your org.

export function apply_config(config: Easy_EKS_Config_Data){ //config: is of type Easy_EKS_Config_Data
  config.addTag("Environment", "Dev");
}

//Note: ca-central-1 is a Hydro Powered AWS Region (Low CO2 emissions), recommended to use for lower environment clusters
//Note: I should give a pre-existing subnet/VPC scenario some left shifted test automation, / automated validation
//      in the form of verifying subnet tag pre-req requirements exist as expected.
