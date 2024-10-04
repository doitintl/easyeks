High level overview and recommed read detailed setup guide.




## Quickstart (How)
* Install flox CLI from flox.dev
  (Think of it as a bundling of all your dependencies)
* Verify flox is installed
  `flox --version` (newer version is fine, this is just what was last tested)
  ```console
  1.1.0
  ```
* Download this repo
```shell
# [admin@workstation:~]
cd ~
git clone https://github.com/doitintl/eks-cdk-quickstart.git
cd ~/eks-cdk-quickstart
# [admin@workstation:~/eks-cdk-quickstart]
# ^- The above notation is used, b/c the below command requires you to be in correct working dir.
flox activate
# Note after running the above, your prompt will change
# FROM:
# [admin@workstation:~/eks-cdk-quickstart]
#
# TO: 
# flox [flox.dev]
# [admin@workstation:~/eks-cdk-quickstart]
#
# ^-- This allows you to see you're in flox shell mode
```

```shell
# flox [flox.dev]
# [admin@workstation:~/eks-cdk-quickstart]
npm install
# ^-- will populate a /node_modules/, based on package.json

head -n 2 cdk.json
# {
#   "app": "npx ts-node --prefer-ts-exts bin/cdk-main.ts",
#   ^-- so ./bin/cdk-main.ts is cdk CLI's entry point where the app logic starts
export AWS_REGION=ca-central-1
cdk list
```
* Configure AWS CLI
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
* Bootstrap cdk
```shell
export AWS_REGION=ca-central-1
cdk bootstrap --region=ca-central-1
# ^-- Note the region flag isn't required, it'll default to your locally configured region
#     There's 2 advantages to explicitly specifying
#     1. When working with a team, they can't see your locally configured region,
#        so documenting in git improves reproducibility.
#     2. It makes it intuitively obvious that cdk bootstrap is regionally scoped, not global.
```

