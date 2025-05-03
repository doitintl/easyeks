# Basic Deployment and Usage

## Verify the Prerequisites were done correctly

The below needs N assumptions to be true in order to work:
1. your IAM identity and region are set to an account / region where cdk has been bootstrapped. (You can check CloudFormation in that region to verify this.)
2. You've somehow met the pre-requisite dependcies (Check if flox.dev is active)
3. You're current working directory is correct (This is why the above examples gives a hint)

* Run the following command to make sure you have access to an AWS Identity  
  `aws sts get-caller-identity`

* Here's what output could look like in a MFA SSO CLI Auth Configuration Setup
  ```console
  {
      "UserId": "AROA5FTZDSN3OT5JM4NOV:botocore-session-1719967403",
      "Account": "905418347382",
      "Arn": "arn:aws:sts::905418347382:assumed-role/OrganizationAccountAccessRole/botocore-session-1719967403"
  }
  ```

* Here's what output could look like in a simple setup
  ```console
  {
      "UserId": "AIDA5FTZDSN3I5BGLZTQB",
      "Account": "905418347382",
      "Arn": "arn:aws:iam::905418347382:user/chrism"
  }
  ```

```shell
# [admin@workstation:~/easyeks]
# ^- The above notation is used, b/c the below command requires you to be in correct working dir.
flox activate
# Note after running the above, your prompt will change
# FROM:
# [admin@workstation:~/easyeks]
#
# TO: 
# flox [flox.dev]
# [admin@workstation:~/easyeks]
#
# ^-- This allows you to see you're in flox shell mode
export AWS_REGION=ca-central-1
cdk list
```

--------------------------------------------------------------------------------------------------------------

## Useful Background Contextual Information for comprehension
1. Note: The following is how `cdk` cli maps to it's program entry point /bin/cdk-main.ts.
```shell
# flox [flox.dev]
# [admin@workstation:~/easyeks]
head -n 2 cdk.json
# {
#   "app": "npx ts-node --prefer-ts-exts bin/cdk-main.ts",
#   ^-- so ./bin/cdk-main.ts is cdk CLI's entry point where the app logic starts
```

--------------------------------------------------------------------------------------------------------------

## Deploy vpc then cluster
2. CDK List and Deploy vpc then cluster
```shell
# flox [flox.dev]
# [ec2-user@ec2-bastion-with-iam-admin-role:~/easyeks]#
cdk list
time cdk list
# ^-- needs the env var set, in order to work, (normally takes 5-25 seconds)
# lower-envs-vpc
# dev1-eks
# dev2-eks
cdk deploy lower-envs-vpc
cdk deploy dev1-eks
```

TO DO:
* add a more detailed note or image about how to populate ~/.kube/config
* Basics of karpenter and tear down