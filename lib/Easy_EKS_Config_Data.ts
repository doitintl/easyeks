export class Easy_EKS_Config_Data { //This object just holds config data.
  constructor(){ //Constructor with no args is on purpose for desired UX
  
  } 
  //^-- The idea is to periodically add config over time using
  //    methods to add small snippets of config over multiple operations
  //    rather than populate the config all at once.

  //Config_Vars: Data_Types
  //(var?: is TS syntax to ignore initial null value)
  tags?: { [key: string]: string };

  //Config Snippet Population Methods
  addTag( key: string, value: string ){
      this.tags = { ...this.tags, [key] : value };

  }


}
