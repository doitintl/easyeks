

5. Change current working directory to the repo, which has a .flox folder
```shell
#[ec2-user@ec2-bastion-with-iam-admin-role:~]#
ls -lah ~/eks-cdk-quickstart | grep .flox
cd ~/eks-cdk-quickstart
```
6. Run flox activate in that folder
```shell
#[ec2-user@ec2-bastion-with-iam-admin-role:~/eks-cdk-quickstart]#
flox activate
# ^-- this will create a flox.dev env, where 
#     all cli tooling dependencies (aws, cdk, node, npm, typescript, jq)
#     will be installed and on the correct version within ~2 minutes
#     when you're in flox activate mode and in that folder or a subfolder
#     future activations will be instant (like a docker image, but with nix pgks)
aws --version
cdk --version
npm --version
```
7. CDK Bootstrap and Deploy
```shell
#[ec2-user@ec2-bastion-with-iam-admin-role:~/eks-cdk-quickstart]#
aws sts get-caller-identity
# ^-- verify you have rights
export AWS_REGION="ca-central-1"
# ^-- recommend add a region to ~/.bashrc, or `aws configure`
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity | jq .Account | tr -d '\"')
echo $AWS_ACCOUNT_ID
cdk bootstrap aws://$AWS_ACCOUNT_ID/ca-central-1
# ^-- bootstraps the region, after which you'll see a Stack name of "CDKToolkit"
#     in AWS Web GUI Console > CloudFormation > Stacks (for that region)
#     Note you can only deploy into region's that have been bootstrapped
cdk list
time cdk list
# ^-- needs the env var set, in order to work, (normally takes 5-25 seconds)
# lower-envs-vpc
# dev1-eks
# dev2-eks
cdk deploy lower-envs-vpc
cdk deploy dev1-eks
```
