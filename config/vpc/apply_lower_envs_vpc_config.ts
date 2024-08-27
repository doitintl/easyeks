import { Opinionated_VPC_Config_Data } from '../../lib/Opinionated_VPC_Config_Data';


export function apply_config(config: Opinionated_VPC_Config_Data){ //config: is of Opinionated_VPC_Config_Data
  config.setRegion("ca-central-1"); //<-- ca-central-1 is a Hydro Powered AWS Region (Low CO2 emissions)
  //^-- good choice for lower env clusters, as follows sustainability pillar of AWS's well architected framework
    
}//end apply_config
