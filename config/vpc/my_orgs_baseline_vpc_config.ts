import { Opinionated_VPC_Config_Data } from '../../lib/Opinionated_VPC_Config_Data';
import * as cdk from 'aws-cdk-lib';

export function apply_config(config: Opinionated_VPC_Config_Data, stack: cdk.Stack){ //config: is of type Opinionated_VPC_Config_Data
    config.addTag("Maintained By", "Cloud Platform Team");
    config.addTag("Contact Methods for Questions", "devops slack channel or email devops@my.org");
    //^-- NOTE: hashtag(#)   comma(,)   singlequote(')   doublequote(\")   parenthesis()   and more are not valid tag values
    //    https://docs.aws.amazon.com/codeguru/latest/bugbust-ug/limits-tags.html
}//end apply_config
