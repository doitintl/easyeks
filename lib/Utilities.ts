//Utility Imports:
import * as shell from 'shelljs'; //npm install shelljs && npm i --save-dev @types/shelljs

class InvalidInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidInputError";
    }
}

export function validateTag(key: string, value: string){
    const allowedChars = "^([\\p{L}\\p{Z}\\p{N}_.:/=+\\-@]*)$"; // https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Tag.html; also using cfn-lint as a baseline
    // The set of allowed characters varies by service, from basically any character to a strict set of English alphanumeric characters and a few symbols
    const allowedCharsText = "The string can only contain Unicode letters, digits, whitespace, and the characters _.:/=+\-@";
    const allowedRegex = new RegExp(allowedChars, "mu");

    if (!allowedRegex.test(key)){
        throw new InvalidInputError(`Invalid tag key: "${key}". ${allowedCharsText}`)
    } else if (key.toLowerCase().startsWith("aws:")) {
        throw new InvalidInputError(`Invalid tag key "${key}". Tag keys cannot start with "aws:".`)
    } else if (!allowedRegex.test(value)){
        throw new InvalidInputError(`Invalid tag value: "${value}". ${allowedCharsText}`)
    } else {
        return true
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function ensure_existance_of_kubectl_helm_lambda_deployer_role_used_by_easy_eks(){
    const check_cmd = `aws iam get-role --role-name=kubectl-helm-lambda-deployer-role-used-by-easy-eks`
    const check_cmd_return_code = shell.exec(check_cmd, {silent:true}).code;
    //Expected Values: https://docs.aws.amazon.com/cli/latest/topic/return-codes.html
    if(check_cmd_return_code===0){ //0: pre-requisites dependency aws iam role is pre-existing (nothing to do)
        return;
    }
    if(check_cmd_return_code===127){
        console.log('* Error:');
        console.log('  aws (command line tool, acting as a prerequisite dependency of Easy EKS) was not found in path.');
        throw "User fixable error detected, see notes above."
    }
    if(check_cmd_return_code===253 || check_cmd_return_code===255){ //253: aws cli is not configured, 255: aws cli is mis-configured
        console.log('* Error:');
        console.log('  aws (command line tool), was detected to not be configured or misconfigured.');
        console.log('* Context:');
        console.log('  EasyEKS tried and failed to detect and ensure the pre-existance of AWS IAM role named:');
        console.log('  kubectl-helm-lambda-deployer-role-used-by-easy-eks');
        console.log('  This role is a pre-requisite dependency for some aws cdk logic used by EasyEKS.\n');
        throw "User fixable error detected, see notes above."
    }
    if(check_cmd_return_code===254){ //254: role does-not-exist & aws cli is configured
        console.log('EasyEKS detected non-existance of AWS IAM role named: kubectl-helm-lambda-deployer-role-used-by-easy-eks');
        console.log('EasyEKS will now automatically create this role, which acts as a prerequisites dependency.');
        const assume_role_policy_doc = 
        `{
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {
                        "AWS": "arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT}:root"
                    },
                    "Action": "sts:AssumeRole",
                    "Condition": {
                        "StringEquals": {
                            "aws:PrincipalTag/whitelisted-role-for-assuming": "easy-eks-generated-kubectl-helm-deployer-lambda-role"
                        }
                    }
                }
            ]
        }`;
        //^-- The above policy represents a balance between security and ease of use, in a way that's easy to automate.
        //    Any principal within the account tagged with the above key value pair is able to assume this role.
        const cmd1 = `aws iam create-role --role-name=kubectl-helm-lambda-deployer-role-used-by-easy-eks \
                     --assume-role-policy-document='${assume_role_policy_doc}'`;
        const cmd1_results = shell.exec(cmd1, {silent:true});
        if(cmd1_results.code===0){
            console.log('1 of 3: Successfully created role: kubectl-helm-lambda-deployer-role-used-by-easy-eks')
        }
        else{
            console.log(cmd1_results.stdout);
            console.log(cmd1_results.stderr);
        }
        const eks_kubectl_access_iam_policy_doc = 
        `{
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "eks:DescribeCluster",
                    "Resource": "arn:aws:eks:*",
                    "Effect": "Allow"
                }
            ]
        }`;
        const cmd2 = `aws iam create-policy --policy-name=eks_kubectl_access_iam_policy \
                     --policy-document='${eks_kubectl_access_iam_policy_doc}'`;
        const cmd2_results = shell.exec(cmd2, {silent:true});
        if(cmd2_results.code===0){
            console.log('2 of 3: Successfully created iam policy for role: kubectl-helm-lambda-deployer-role-used-by-easy-eks')
        }
        else{
            console.log(cmd2_results.stdout);
            console.log(cmd2_results.stderr);
        }
        const cmd3_1 = `aws iam attach-role-policy --role-name=kubectl-helm-lambda-deployer-role-used-by-easy-eks \
                       --policy-arn=arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly`
        const cmd3_2 = `aws iam attach-role-policy --role-name=kubectl-helm-lambda-deployer-role-used-by-easy-eks \
                       --policy-arn=arn:aws:iam::aws:policy/AmazonElasticContainerRegistryPublicReadOnly`
        const cmd3_3 = `aws iam attach-role-policy --role-name=kubectl-helm-lambda-deployer-role-used-by-easy-eks \
                       --policy-arn=arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`
        const cmd3_4 = `aws iam attach-role-policy --role-name=kubectl-helm-lambda-deployer-role-used-by-easy-eks \
                       --policy-arn=arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole`
        const cmd3_5 = `aws iam attach-role-policy --role-name=kubectl-helm-lambda-deployer-role-used-by-easy-eks \
                       --policy-arn=arn:aws:iam::${process.env.CDK_DEFAULT_ACCOUNT}:policy/eks_kubectl_access_iam_policy`;
        shell.exec(cmd3_1, {silent:true});
        shell.exec(cmd3_2, {silent:true});
        shell.exec(cmd3_3, {silent:true});
        shell.exec(cmd3_4, {silent:true});
        const cmd3_results = shell.exec(cmd3_5, {silent:true});
        if(cmd3_results.code===0){
            console.log('3 of 3: Successfully added iam policies to role: kubectl-helm-lambda-deployer-role-used-by-easy-eks')
        }
        else{
            console.log(cmd3_results.stdout);
            console.log(cmd3_results.stderr);
        }
        /////////////////////////////////////////////////////////////////////////////////////
        // Manual Clean Up Commands:
        // aws iam detach-role-policy --role-name=kubectl-helm-lambda-deployer-role-used-by-easy-eks --policy-arn=arn:aws:iam::090622937654:policy/eks_kubectl_access_iam_policy
        // aws iam detach-role-policy --role-name=kubectl-helm-lambda-deployer-role-used-by-easy-eks --policy-arn=arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
        // aws iam detach-role-policy --role-name=kubectl-helm-lambda-deployer-role-used-by-easy-eks --policy-arn=arn:aws:iam::aws:policy/AmazonElasticContainerRegistryPublicReadOnly
        // aws iam detach-role-policy --role-name=kubectl-helm-lambda-deployer-role-used-by-easy-eks --policy-arn=arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
        // aws iam detach-role-policy --role-name=kubectl-helm-lambda-deployer-role-used-by-easy-eks --policy-arn=arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole
        // aws iam delete-policy --policy-arn=arn:aws:iam::090622937654:policy/eks_kubectl_access_iam_policy
        // aws iam delete-role --role-name=kubectl-helm-lambda-deployer-role-used-by-easy-eks
        /////////////////////////////////////////////////////////////////////////////////////
    }//end if (role does not exist) then make it
}//end ensure_existance_of_kubectl_helm_lambda_deployer_role_used_by_easy_eks()
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
