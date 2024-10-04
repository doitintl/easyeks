### Detailed Usage Steps: AWS EC2 Bastion VM and GitHub private repo
1. Manually provision a ec2 bastion in the AWS Web GUI
   * Amazon Linux 64-bit
   * t3a.medium, in a public subnet, with a public IP  
   * SSH key pair you have access to
   * 50GB storage (Nix uses a decent amount of space)
   * SG allows ssh from your local machine
   * manually create an aws admin ec2 instance role, and attach it
2. SSH into bastion
   * **Option 2A: ~/.ssh/config**
     ```shell
     mkdir -p ~/.ssh
     chmod 700 ~/.ssh
     touch ~/.ssh/config
     chmod 600 ~/.ssh/*
     vi ~/.ssh/config
     ```
     ```text
     # Contents of ~/.ssh/config
     Host bastion
     Hostname 15.223.71.219 #<-- ec2 public ip
     User ec2-user
     IdentityFile ~/.ssh/chrism_doit.ssh.privatekey
     ```
     `ssh bastion`
   * **Option 2B: Browser Based SSH using AWS Systems Manager (works with private ip)**
     * https://ca-central-1.console.aws.amazon.com/systems-manager/fleet-manager/managed-nodes?region=ca-central-1  
     * As long as it has internet access (public ip, or private ip in a VPC with a NAT GW)
     * and the right role it should show up, and that should be true if you gave it an admin role
     * From this interface you can `Select the node > Node actions > tools > Start Terminal session`
2. Gain the ability to clone a private git repo
   * **Option 1A: (won't work with doit's private repo setup)**
     1. Create a private fork of the repo (not needed for a basic demo, but would be done for adoption)
     2. Provision a Read Only GitHub Token so you can clone private repos
        * https://github.com/settings/personal-access-tokens/new
        * Token name = test
        * Resource Owner = org where your repo is (ex doitintl)
        * Expiration = 7 days
        * Repository Access = Only Select Repositories / your private fork of https://github.com/doitintl/eks-cdk-quickstart
        * Repository Permissions / Contents = Read-Only
        * Generate Token and Request Access
        ^-- didn't work... looking back after page refresh it's stuck in status pending
     3. Temporarily copy your PAT into a notepad app, it'll look something like the following fake value:  
        `github_pat_TmV3UmVwbGljYVNldEF2Y7_WlsYWJsZQo_IvwFJWNSzvUbGFzdFVwZGF0ZVRpbWU6IDIwMjQtMDktMjd`  
        darn approval process for fast expiring rbac limited token and can't fork to test desired workflow :\,
        this won't work with current setup.
   * **Option 1B: (will work with doit's private repo setup)**
     1. create a classic readonly GitHub Token to clone private doit repo  
        * https://github.com/settings/tokens/new  
        * note = test <-- note this value represents TOKEN_NAME
        * expiration = 7 days
        * scopes = repo (checking that will also check 5 subboxes)
        * Generate Token
     2. Temporarily copy the token's value into a nodepad app, it'll look something like the following fake value:  
        `ghp_jwiZWtzLWNkay1xdWlja3N0YXJ0CgwMjQtMD`
3. Copy Paste Commands (one line at a time) to clone private github repo from AWS Cloud Shell  
```shell
#[ec2-user@ec2-bastion-with-iam-admin-role:~]#
sudo dnf update -y
sudo dnf install git -y
export TOKEN_NAME="test"
export TOKEN_PASS="ghp_jwiZWtzLWNkay1xdWlja3N0YXJ0CgwMjQtMD"
git clone https://$TOKEN_NAME:$TOKEN_PASS@github.com/doitintl/eks-cdk-quickstart.git
```
4. Install Flox (copy paste commands 1 line at a time)
```shell
#[ec2-user@ec2-bastion-with-iam-admin-role:~]#
cat /etc/os-release
uname -r
# ^-- The above command say we're on an rpm based x86_64 distro of Amazon Linux 2023 
wget https://downloads.flox.dev/by-env/stable/rpm/flox-1.3.2.x86_64-linux.rpm
sudo rpm --import https://downloads.flox.dev/by-env/stable/rpm/flox-archive-keyring.asc
sudo rpm -ivh ~/flox-*.rpm
flox --version
rm ~/flox-*.rpm
# 1.3.2
```
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