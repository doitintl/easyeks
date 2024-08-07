import { Easy_EKS_Config_Data } from '../lib/Easy_EKS_Config_Data';
//Intended Use: 
//EasyEKS Admins: edit this file with config to apply to all dev cluster's in your org.

export function apply_config(config: Easy_EKS_Config_Data){ //config: is of type Easy_EKS_Config_Data
  config.addTag("Environment", "Dev");
}
