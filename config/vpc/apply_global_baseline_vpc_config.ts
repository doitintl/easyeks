import { Opinionated_VPC_Config_Data } from '../../lib/Opinionated_VPC_Config_Data';
import * as cdk from 'aws-cdk-lib';

export function apply_config(config: Opinionated_VPC_Config_Data, stack?: cdk.Stack){ //config: is of type Opinionated_VPC_Config_Data
  config.addTag("IaC Tooling used for Provisioning and Management", "aws cdk");
  config.addTag("Upstream Methodology Docs", "https://github.com/doitintl/eks-cdk-quickstart");
}//end apply_config
