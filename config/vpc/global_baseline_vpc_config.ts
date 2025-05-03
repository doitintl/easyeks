import { Opinionated_VPC_Config_Data } from '../../lib/Opinionated_VPC_Config_Data';
import * as cdk from 'aws-cdk-lib';

export function apply_config(config: Opinionated_VPC_Config_Data, stack: cdk.Stack){ //config: is of type Opinionated_VPC_Config_Data
    config.addTag("AWS Tag Allowed Characters", "letters numbers + - = . _ : / @ WebSiteLinks");
    config.addTag("AWS Tag Forbidden Character", "Hashtag Comma SingleQuote DoubleQuote Parenthesis QuestionMark Asterisk Ampersand https://docs.aws.amazon.com/codeguru/latest/bugbust-ug/limits-tags.html");
    config.addTag("IaC Tooling used for Provisioning and Management of this VPC", "cdk: a CLI tool that stands for AWS Cloud Development Kit.");
    config.addTag("Upstream Methodology Docs", "https://github.com/doitintl/easyeks");
    //^-- NOTE: hashtag(#)   comma(,)   singlequote(')   doublequote(\")   parenthesis()   and more are not valid tag values
    //    https://docs.aws.amazon.com/codeguru/latest/bugbust-ug/limits-tags.html
}//end apply_config
