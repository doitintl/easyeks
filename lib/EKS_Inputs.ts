import * as fs from 'fs'
import * as YAML from 'yaml'

const baseline_config_file: string = fs.readFileSync('./config/baseline.shared_input_values.yaml', 'utf8')
const baseline_config_yaml:yaml_config = YAML.parse(baseline_config_file)



type yaml_config = {
  tags: key_value[]
}
type key_value = { [key: string]: string }

const y = baseline_config_yaml.tags

console.log(y)

for (var item of y){
  console.log( "hi" );  
}

// y.forEach(
//   function( value ){
//     console.log( [value] );
//   }
// );

///////////////////////////////////////////////////

// type yaml_config = {
//   tags?: key_value[]
// }
// type key_value = { [key: string]: string }

// const y = baseline_config_yaml.tags

// y?.forEach(
//   function( value ){
//     console.log( value );
//   }
// );




export class EKS_Inputs {
    tags: { [key: string]: string };

    constructor() //baseline default values
    {
        this.tags = { }
    }

    addTag( key: string, value: string ){
      this.tags = { ...this.tags, [key] : value };
    }
}
