import { Opinionated_VPC_Config_Data } from '../../lib/Opinionated_VPC_Config_Data';
import * as cdk from 'aws-cdk-lib';

export function apply_config(config: Opinionated_VPC_Config_Data, stack: cdk.Stack){ //config: is of type Opinionated_VPC_Config_Data
    config.addTag("IaC Tooling used for Provisioning and Management of this VPC", "cdk: a CLI tool that stands for AWS Cloud Development Kit.");
    config.addTag("Upstream Methodology Docs", "https://github.com/doitintl/easyeks");
    //^-- NOTE: AWS tag restrictions vary by service, but generally only letters, numbers, spaces, and the following characters are allowed: + - = . _ : / @
    //    Tags are validated by the validateTag() function in lib/Utilities.ts before deployment
    //    More details:
    //      - https://docs.aws.amazon.com/eks/latest/userguide/eks-using-tags.html#tag-restrictions
    //      - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Using_Tags.html#tag-restrictions
}//end apply_config
