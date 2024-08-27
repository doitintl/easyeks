import { Opinionated_VPC_Config_Data } from '../../lib/Opinionated_VPC_Config_Data';


export function apply_config(config: Opinionated_VPC_Config_Data){ //config: is of Opinionated_VPC_Config_Data
  config.addTag("IaC Tooling used for Provisioning and Management", "aws cdk");
  config.addTag("Upstream Methodology Docs", "https://github.com/doitintl/eks-cdk-quickstart");
  config.setAccount( process.env.CDK_DEFAULT_ACCOUNT! ); //<-- pulls value from CLI env,
  config.setRegion( process.env.CDK_DEFAULT_REGION! ); //<-- ! after var, tells TS it won't be null.
  //^--If you follow suggested order of application (global -> org -> env), then the set's functionally act as overrideable defaults.

}//end apply_config
