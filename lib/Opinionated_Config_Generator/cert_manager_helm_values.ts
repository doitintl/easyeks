import * as yaml from 'js-yaml'; //npm install js-yaml && npm install --save-dev @types/js-yaml

export function config_for_cert_manager_helm_values (min_replicas:number) { //<-- args TBD(to be determined)
    type JSON = {[key: string]: any;}; //data type requested by helm values
    let recommended_config: JSON = {};

//v-- Basically an inline heredoc, where YAML Indentation matters, so this can't be indented in typescript
const helm_values_as_yaml = `
crds:
  enabled: true
`;
//^-- is based on https://cert-manager.io/docs/installation/best-practice/#best-practice-helm-chart-values
//            and https://github.com/cert-manager/cert-manager/blob/v1.19.1/deploy/charts/cert-manager/values.yaml

    try {
        const JSON_string_from_YAML = JSON.stringify( yaml.load(helm_values_as_yaml), null, 4); //null, 4 makes it human readable
        const JS_Ojbect_from_JSON = JSON.parse(JSON_string_from_YAML);
        recommended_config = JS_Ojbect_from_JSON;
    } catch (error){
        console.error("Error parsing cert-manager.io's helm values as yaml", error);
    } //end try-catch

    return recommended_config;

}//end config_for_cert_manager_helm_values()
