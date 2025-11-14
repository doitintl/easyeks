import * as fs from 'fs'; //node.js built in file system module
import * as yaml from 'js-yaml'; //npm install js-yaml && npm install --save-dev @types/js-yaml
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const example_of_plausible_input_value_for_multi_line_yaml_string = `
apiVersion: v1
kind: Namespace
metadata:
  name: observability
`;
export function read_yaml_string_as_javascript_object(multi_line_yaml_string: string){
    const javascript_object_to_return: JSON = JSON.parse(JSON.stringify(yaml.load(multi_line_yaml_string)));
    return javascript_object_to_return;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Example of plausible input value: './lib/Frugal_Observability/manifests/certs/self-signed-root-ca-issuer.ClusterIssuer.yaml'
export function read_yaml_file_as_javascript_object(file_path_relative_to_root_of_repo:string){
    let javascript_object_to_return: JSON;
    try { //v-- convert yaml into JavaScript Objects
        javascript_object_to_return = JSON.parse(JSON.stringify(yaml.load(fs.readFileSync(file_path_relative_to_root_of_repo, 'utf8'))));
    } catch (error) {
         console.error(`Error reading YAML file at location: ${file_path_relative_to_root_of_repo}`, error);
         throw "User fixable error detected, see notes above.";
    }
    return javascript_object_to_return;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Example of plausible input value: './lib/Frugal_Observability/manifests/rbac/kube_rbac_objects.yaml'
export function read_yaml_file_as_array_of_javascript_objects(file_path_relative_to_root_of_repo:string){
    let array_of_javascript_objects_to_return: JSON[] = [];
    const contents_of_yaml_file = fs.readFileSync(file_path_relative_to_root_of_repo, 'utf8');
    const array_of_yaml_manifests: string[] = contents_of_yaml_file.split("---");
    for(let i: number = 0; i < array_of_yaml_manifests.length; i++) {
        try {
            let javascript_object = JSON.parse(JSON.stringify(yaml.load(array_of_yaml_manifests[i])));
            array_of_javascript_objects_to_return.push(javascript_object); //.push means add object to array.
        } catch(error){
            console.error(`Error reading YAML file at location: ${file_path_relative_to_root_of_repo}`, error);
            throw "User fixable error detected, see notes above.";
        }
    }
    return array_of_javascript_objects_to_return;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
