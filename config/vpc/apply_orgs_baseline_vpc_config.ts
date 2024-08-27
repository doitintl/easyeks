import { Opinionated_VPC_Config_Data } from '../../lib/Opinionated_VPC_Config_Data';


export function apply_config(config: Opinionated_VPC_Config_Data){ //config: is of Opinionated_VPC_Config_Data
  config.addTag("Maintained By", "Cloud Platform Team");
  config.addTag("Contact Methods for Questions", "devops slack channel or email devops@my.org");
  //^-- NOTE: hashtag(#)  comma(,)   singlequote(')  and more are not valid tag values
  //    https://docs.aws.amazon.com/directoryservice/latest/devguide/API_Tag.html

}//end apply_config
