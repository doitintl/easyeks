import { Easy_EKS_Config_Data } from '../lib/Easy_EKS_Config_Data';
//Intended Use: 
//A baseline config file (to be applied to all EasyEKS Clusters in your organization)
//EasyEKS Admins would be expected to edit this file with defaults specific to their org.

export function apply_config(config: Easy_EKS_Config_Data){ //config: is of type Easy_EKS_Config_Data
  config.addTag("Maintained By", "Cloud Platform Team");
  config.addTag("Point of Contact for Questions", "slack channel #xyz, or email devops@my.org");
}



//Note: ca-central-1 is a Hydro Powered AWS Region (Low CO2 emissions), recommended to use for lower environment clusters

