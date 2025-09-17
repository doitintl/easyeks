//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//AWS CDK Imports:
import { Construct, IConstruct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Config Library Imports:
import * as global_baseline_eks_config from '../config/eks/global_baseline_eks_config';
import * as my_orgs_baseline_eks_config from '../config/eks/my_orgs_baseline_eks_config';
import * as lower_envs_eks_config from '../config/eks/lower_envs_eks_config';
import * as higher_envs_eks_config from '../config/eks/higher_envs_eks_config';
import * as dev_eks_config from '../config/eks/dev_eks_config';
import * as test_eks_config from '../config/eks/test_eks_config';
import * as stage_eks_config from '../config/eks/stage_eks_config';
import * as prod_eks_config from '../config/eks/prod_eks_config';
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Utility Imports:
import * as shell from 'shelljs'; //npm install shelljs && npm i --save-dev @types/shelljs
import console = require('console'); //can help debug feedback loop, allows `console.log("hi");` to work, when `cdk list` is run.
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Local Library Imports:
import { Easy_EKS_Config_Data } from './Easy_EKS_Config_Data';
import { Easy_EKS_Cluster } from './Easy_EKS_Cluster';
import { Easy_EKS_Essentials } from './Easy_EKS_Essentials';
import { Easy_EKS_Workloads } from './Easy_EKS_Workloads';
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export class Easy_EKS{ //purposefully don't extend stack, to implement builder pattern and give more flexibility for imperative logic.

    //Class Variables/Properties:
    eks_config: Easy_EKS_Config_Data;
    eks_cluster: Easy_EKS_Cluster; //creates eks cluster + manageds eks addons
    eks_essentials: Easy_EKS_Essentials; //imports eks cluster + deploys production readiness essentials (karpenter, AWS LB Controller, node local dns cache, storage class, observability, etc.)
    eks_workloads: Easy_EKS_Workloads; //imports eks cluster + deploys workloads

    //Class Constructor:
    constructor(storage_for_stacks_state: Construct, cluster_name: string, stack_config: cdk.StackProps) {
        let cluster_region = process.env.CDK_DEFAULT_REGION!; //<-- better readability
        this.eks_config = new Easy_EKS_Config_Data(cluster_name, cluster_region);
        this.eks_cluster = new Easy_EKS_Cluster(storage_for_stacks_state, cluster_name, stack_config);
        //Constructor with minimal args is on purpose for desired UX of "builder pattern".
        //The idea is to add partial configuration snippets over time/as multiple operations
        //rather than populate a complete config all at once in one go.
        if(this.eks_config.preexisting_cluster_detected){
            this.eks_essentials = new Easy_EKS_Essentials(storage_for_stacks_state, cluster_name, stack_config);
            this.eks_workloads = new Easy_EKS_Workloads(storage_for_stacks_state, cluster_name, stack_config);
        }
    }//end constructor of Easy_EKS



    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Begin Class Functions (Associated with Easy_EKS):
    apply_global_baseline_eks_config(){ global_baseline_eks_config.apply_config(this.eks_config, this.eks_cluster.stack); }
    apply_my_orgs_baseline_eks_config(){ my_orgs_baseline_eks_config.apply_config(this.eks_config, this.eks_cluster.stack); }
    apply_lower_envs_eks_config(){ lower_envs_eks_config.apply_config(this.eks_config, this.eks_cluster.stack); }
    apply_higher_envs_eks_config(){ higher_envs_eks_config.apply_config(this.eks_config, this.eks_cluster.stack); }
    apply_dev_eks_config(){ dev_eks_config.apply_config(this.eks_config, this.eks_cluster.stack); }
    apply_test_eks_config(){ test_eks_config.apply_config(this.eks_config, this.eks_cluster.stack); }
    apply_stage_eks_config(){ stage_eks_config.apply_config(this.eks_config, this.eks_cluster.stack); }
    apply_prod_eks_config(){ prod_eks_config.apply_config(this.eks_config, this.eks_cluster.stack); }
    apply_dev_baseline_config(){ //convenience method
        this.apply_global_baseline_eks_config();
        this.apply_my_orgs_baseline_eks_config();
        this.apply_lower_envs_eks_config();
        this.apply_dev_eks_config();
    }
    apply_test_baseline_config(){ //convenience method
      this.apply_global_baseline_eks_config();
      this.apply_my_orgs_baseline_eks_config();
      this.apply_lower_envs_eks_config();
      this.apply_test_eks_config();
    }
    apply_stage_baseline_config(){ //convenience method
      this.apply_global_baseline_eks_config();
      this.apply_my_orgs_baseline_eks_config();
      this.apply_higher_envs_eks_config();
      this.apply_stage_eks_config();
    }
    apply_prod_baseline_config(){ //convenience method
      this.apply_global_baseline_eks_config();
      this.apply_my_orgs_baseline_eks_config();
      this.apply_higher_envs_eks_config();
      this.apply_prod_eks_config();
    }
    //End Class Functions (Associated with Easy_EKS)
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Begin Class Functions (Associated with Easy_EKS_Cluster):
    stage_deployment_of_eks_cluster(){
        this.eks_config.workerNodeRole = this.eks_cluster.initialize_WorkerNodeRole(this.eks_cluster.stack);
        this.eks_cluster.stage_deployment_of_eks_cluster(this.eks_config); 
    }
    stage_deployment_of_global_baseline_eks_addons(){ this.eks_cluster.stage_deployment_of_global_baseline_eks_addons(this.eks_config); }
    stage_deployment_of_my_orgs_baseline_eks_addons(){ this.eks_cluster.stage_deployment_of_my_orgs_baseline_eks_addons(this.eks_config); }
    stage_deployment_of_lower_envs_eks_addons(){ this.eks_cluster.stage_deployment_of_lower_envs_eks_addons(this.eks_config); }
    stage_deployment_of_higher_envs_eks_addons(){ this.eks_cluster.stage_deployment_of_higher_envs_eks_addons(this.eks_config); }
    stage_deployment_of_dev_eks_addons(){ this.eks_cluster.stage_deployment_of_dev_eks_addons(this.eks_config); }
    stage_deployment_of_test_eks_addons(){ this.eks_cluster.stage_deployment_of_test_eks_addons(this.eks_config); }
    stage_deployment_of_stage_eks_addons(){ this.eks_cluster.stage_deployment_of_stage_eks_addons(this.eks_config); }
    stage_deployment_of_prod_eks_addons(){ this.eks_cluster.stage_deployment_of_prod_eks_addons(this.eks_config); }
    stage_deployment_of_dev_baseline_addons(){ //convenience method
        this.stage_deployment_of_global_baseline_eks_addons();
        this.stage_deployment_of_my_orgs_baseline_eks_addons();
        this.stage_deployment_of_lower_envs_eks_addons();
        this.stage_deployment_of_dev_eks_addons();
    }
    stage_deployment_of_test_baseline_addons(){ //convenience method
      this.stage_deployment_of_global_baseline_eks_addons();
      this.stage_deployment_of_my_orgs_baseline_eks_addons();
      this.stage_deployment_of_lower_envs_eks_addons();
      this.stage_deployment_of_test_eks_addons();
    }
    stage_deployment_of_stage_baseline_addons(){ //convenience method
      this.stage_deployment_of_global_baseline_eks_addons();
      this.stage_deployment_of_my_orgs_baseline_eks_addons();
      this.stage_deployment_of_higher_envs_eks_addons();
      this.stage_deployment_of_stage_eks_addons();
    }
    stage_deployment_of_prod_baseline_addons(){ //convenience method
      this.stage_deployment_of_global_baseline_eks_addons();
      this.stage_deployment_of_my_orgs_baseline_eks_addons();
      this.stage_deployment_of_higher_envs_eks_addons();
      this.stage_deployment_of_prod_eks_addons();
    }
    //End Class Functions (Associated with Easy_EKS_Cluster)
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Begin Class Functions (Associated with Easy_EKS_Essentials):
    stage_deployment_of_global_baseline_eks_essentials(){
        if(this.eks_essentials){
            this.eks_essentials.initalize_imported_cluster_in_stack(this.eks_essentials.stack, this.eks_config.cluster_name, this.eks_config.kubectlLayer);
            this.eks_essentials.stage_deployment_of_global_baseline_eks_essentials(this.eks_config); 
        }
    }
    stage_deployment_of_my_orgs_baseline_eks_essentials(){
        if(this.eks_essentials){ this.eks_essentials.stage_deployment_of_my_orgs_baseline_eks_essentials(this.eks_config); }
    }
    stage_deployment_of_lower_envs_eks_essentials(){
        if(this.eks_essentials){ this.eks_essentials.stage_deployment_of_lower_envs_eks_essentials(this.eks_config); }
    }
    stage_deployment_of_higher_envs_eks_essentials(){
        if(this.eks_essentials){ this.eks_essentials.stage_deployment_of_higher_envs_eks_essentials(this.eks_config); }
    }
    stage_deployment_of_dev_eks_essentials(){
        if(this.eks_essentials){ this.eks_essentials.stage_deployment_of_dev_eks_essentials(this.eks_config); }
    }
    stage_deployment_of_test_eks_essentials(){
        if(this.eks_essentials){ this.eks_essentials.stage_deployment_of_test_eks_essentials(this.eks_config); }
    }
    stage_deployment_of_stage_eks_essentials(){
        if(this.eks_essentials){ this.eks_essentials.stage_deployment_of_stage_eks_essentials(this.eks_config); } 
    }
    stage_deployment_of_prod_eks_essentials(){
        if(this.eks_essentials){ this.eks_essentials.stage_deployment_of_prod_eks_essentials(this.eks_config); }
    }
    stage_deployment_of_dev_baseline_essentials(){ //convenience method
        this.stage_deployment_of_global_baseline_eks_essentials();
        this.stage_deployment_of_my_orgs_baseline_eks_essentials();
        this.stage_deployment_of_lower_envs_eks_essentials();
        this.stage_deployment_of_dev_eks_essentials();
    }
    stage_deployment_of_test_baseline_essentials(){ //convenience method
      this.stage_deployment_of_global_baseline_eks_essentials();
      this.stage_deployment_of_my_orgs_baseline_eks_essentials();
      this.stage_deployment_of_lower_envs_eks_essentials();
      this.stage_deployment_of_test_eks_essentials();
    }
    stage_deployment_of_stage_baseline_essentials(){ //convenience method
      this.stage_deployment_of_global_baseline_eks_essentials();
      this.stage_deployment_of_my_orgs_baseline_eks_essentials();
      this.stage_deployment_of_higher_envs_eks_essentials();
      this.stage_deployment_of_stage_eks_essentials();
    }
    stage_deployment_of_prod_baseline_essentials(){ //convenience method
      this.stage_deployment_of_global_baseline_eks_essentials();
      this.stage_deployment_of_my_orgs_baseline_eks_essentials();
      this.stage_deployment_of_higher_envs_eks_essentials();
      this.stage_deployment_of_prod_eks_essentials();
    }
    //End Class Functions (Associated with Easy_EKS_Essentials)
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Begin Class Functions (Associated with Easy_EKS_Workloads):
    stage_deployment_of_global_baseline_eks_workloads(){
        if(this.eks_workloads){
            this.eks_workloads.initalize_imported_cluster_in_stack(this.eks_workloads.stack, this.eks_config.cluster_name, this.eks_config.kubectlLayer);
            this.eks_workloads.stage_deployment_of_global_baseline_eks_workloads(this.eks_config); 
        }
    }
    stage_deployment_of_my_orgs_baseline_eks_workloads(){
        if(this.eks_workloads){ this.eks_workloads.stage_deployment_of_my_orgs_baseline_eks_workloads(this.eks_config); }
    }
    stage_deployment_of_lower_envs_eks_workloads(){
        if(this.eks_workloads){ this.eks_workloads.stage_deployment_of_lower_envs_eks_workloads(this.eks_config); }
    }
    stage_deployment_of_higher_envs_eks_workloads(){
        if(this.eks_workloads){ this.eks_workloads.stage_deployment_of_higher_envs_eks_workloads(this.eks_config); }
    }
    stage_deployment_of_dev_eks_workloads(){
        if(this.eks_workloads){ this.eks_workloads.stage_deployment_of_dev_eks_workloads(this.eks_config); }
    }
    stage_deployment_of_test_eks_workloads(){
        if(this.eks_workloads){ this.eks_workloads.stage_deployment_of_test_eks_workloads(this.eks_config); }
    }
    stage_deployment_of_stage_eks_workloads(){
        if(this.eks_workloads){ this.eks_workloads.stage_deployment_of_stage_eks_workloads(this.eks_config); }
    }
    stage_deployment_of_prod_eks_workloads(){
        if(this.eks_workloads){ this.eks_workloads.stage_deployment_of_prod_eks_workloads(this.eks_config); }      
    }
    stage_deployment_of_dev_baseline_workloads(){ //convenience method
        this.stage_deployment_of_global_baseline_eks_workloads();
        this.stage_deployment_of_my_orgs_baseline_eks_workloads();
        this.stage_deployment_of_lower_envs_eks_workloads();
        this.stage_deployment_of_dev_eks_workloads();
    }
    stage_deployment_of_test_baseline_workloads(){ //convenience method
      this.stage_deployment_of_global_baseline_eks_workloads();
      this.stage_deployment_of_my_orgs_baseline_eks_workloads();
      this.stage_deployment_of_lower_envs_eks_workloads();
      this.stage_deployment_of_test_eks_workloads();
    }
    stage_deployment_of_stage_baseline_workloads(){ //convenience method
      this.stage_deployment_of_global_baseline_eks_workloads();
      this.stage_deployment_of_my_orgs_baseline_eks_workloads();
      this.stage_deployment_of_higher_envs_eks_workloads();
      this.stage_deployment_of_stage_eks_workloads();
    }
    stage_deployment_of_prod_baseline_workloads(){ //convenience method
      this.stage_deployment_of_global_baseline_eks_workloads();
      this.stage_deployment_of_my_orgs_baseline_eks_workloads();
      this.stage_deployment_of_higher_envs_eks_workloads();
      this.stage_deployment_of_prod_eks_workloads();
    }
    //End Class Functions (Associated with Easy_EKS_Workloads)
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //Begin Class Functions (Associated with shortest convenience method for each env):
    stage_deployment_of_opinionated_eks_cluster_for_dev_envs(){
        this.apply_dev_baseline_config();
        this.stage_deployment_of_eks_cluster();
        this.stage_deployment_of_dev_baseline_addons();
        this.stage_deployment_of_dev_baseline_essentials();
        this.stage_deployment_of_dev_baseline_workloads();
    }
    stage_deployment_of_opinionated_eks_cluster_for_test_envs(){
      this.apply_test_baseline_config();
      this.stage_deployment_of_eks_cluster();
      this.stage_deployment_of_test_baseline_addons();
      this.stage_deployment_of_test_baseline_essentials();
      this.stage_deployment_of_test_baseline_workloads();
    }
    stage_deployment_of_opinionated_eks_cluster_for_stage_envs(){
      this.apply_stage_baseline_config();
      this.stage_deployment_of_eks_cluster();
      this.stage_deployment_of_stage_baseline_addons();
      this.stage_deployment_of_stage_baseline_essentials();
      this.stage_deployment_of_stage_baseline_workloads();
    }
    stage_deployment_of_opinionated_eks_cluster_for_prod_envs(){
      this.apply_prod_baseline_config();
      this.stage_deployment_of_eks_cluster();
      this.stage_deployment_of_prod_baseline_addons();
      this.stage_deployment_of_prod_baseline_essentials();
      this.stage_deployment_of_prod_baseline_workloads();
    }
    //End Class Functions (Associated with shortest convenience method for each env)
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}//end class Easy_EKS
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
