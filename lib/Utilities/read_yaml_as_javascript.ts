import * as fs from 'fs'; //node.js built in file system module
import * as yaml from 'js-yaml'; //npm install js-yaml && npm install --save-dev @types/js-yaml
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const example_of_plausible_input_value_for_multi_line_yaml_string = `
apiVersion: v1
kind: Namespace
# comments are fine
metadata:
  name: observability
  # indented inline comments are also fine
`;
export function read_yaml_string_as_javascript_object(multi_line_yaml_string: string){
    const normalized_yaml_object = normalize_yaml( multi_line_yaml_string );
    const javascript_object_to_return: JSON = JSON.parse(JSON.stringify(yaml.load( normalized_yaml_object )));
    return javascript_object_to_return;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Example of plausible input value: './lib/Frugal_Observability/manifests/certs/self-signed-root-ca-issuer.ClusterIssuer.yaml'
export function read_yaml_file_as_javascript_object(file_path_relative_to_root_of_repo:string){
    let javascript_object_to_return: JSON;
    const normalized_yaml_object = normalize_yaml( fs.readFileSync(file_path_relative_to_root_of_repo, 'utf8') );
    try { //v-- convert yaml into JavaScript Objects
        javascript_object_to_return = JSON.parse(JSON.stringify(yaml.load( normalized_yaml_object )));
    } catch (error) {
        console.error(`Error reading YAML file (and converting its contents to a JavaScript Object)\n`+
                      `at location: ${file_path_relative_to_root_of_repo}\n`, error);
        throw "User fixable error detected, read the first 3 lines of the above feedback message.";
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
        const normalized_yaml_object = normalize_yaml( array_of_yaml_manifests[i] );
        //^-- normalize_yaml() avoids errors, when a yaml entry has line_comments or empty_lines
        if( normalized_yaml_object.length > 0 ){ //<--avoid loading null values (avoids issue with extra --- at bottom of yaml, or commented out yaml_objs)
            try {
                let javascript_object = JSON.parse(JSON.stringify(yaml.load( normalized_yaml_object )));
                array_of_javascript_objects_to_return.push(javascript_object); //.push means add object to array.
            } catch(error){
                console.error(`Error while reading YAML file (and converting its contents to an Array of JavaScript Objects)\n`+
                              `at location: ${file_path_relative_to_root_of_repo}\n`, error);
                throw "User fixable error detected, read the first 3 lines of the above feedback message.";
            }
        }    
    };//end for
    if(array_of_javascript_objects_to_return.length===0){
        console.error(`Error while reading YAML file (and converting its contents to an Array of JavaScript Objects)\n`+
                      `at location: ${file_path_relative_to_root_of_repo}\n`+
                      'File seems to be fully commented out or blank.');
        throw "User fixable error detected, read the first 3 lines of the above feedback message.";
    }
    return array_of_javascript_objects_to_return;
    //Note: If you're reading this I'll assume it's because you're doing everything right and seeing an odd issue.
    //      FYI: I saw an edge case where kube secret of type service-account-token was silently ignored when it was the last item in the array.
    //           Changing the order of yaml objects in the yaml file worked around the issue.
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function normalize_yaml(yaml: string){
    let normalized_yaml_to_return: string;
    const yaml_split_into_array_of_lines = yaml.split('\n');
    //v-- filters out yaml comment lines. (lines starting with # or leading space followed by #).
    const string_array_of_lines_to_keep = yaml_split_into_array_of_lines
        //TypesScript(TS) Readability Notes:
        //TS lets you split . operations across lines (improves readability by allowing logic to be spread vertically)
        //* !   :means:  NOT
        //* =>  :means:  an anonymous function (shorthand)(input parameter on left side, inline function on right side)
        //* .filter()'s input parameter is a function returning boolean value. (false --> filter_out_value, true --> keep_value)
        .filter(  line => !(line.trimStart().startsWith('#'))  ) //#<--keep lines NOT(!) starting with yaml comment(#)
        .filter(  line => !(line.trim() === '')  ); //<--remove lines that become '' after triming whitespace at start and end of line. (because helm values can have empty lines)
    //v-- rejoin filtered array of lines into a single multi-line-string / (normalized) yaml object.
    normalized_yaml_to_return = string_array_of_lines_to_keep.join('\n');
    return normalized_yaml_to_return;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
