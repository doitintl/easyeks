# TO DO
* This needs further cleanup (It's been reorganized and consolidated)
* some instructions need more polish and another round of QA.
* it'd also be good to make it harder to accidently miss steps when copy pasting commands.

# Overview of Contents:
* The Pre-Requisites are Split into 4 Phases
  1. Workstation Setup
  2. IAM Setup
  3. Git Repo Setup
  4. CDK Bootstrap
* Each phase has
  * Generic instructions (you should skim this)
  * Detailed platform specific instructions (you should read this)
  * When this becomes a documentation webpage these can be re-organized into tabs

--------------------------------------------------------------------------------------------------------------

## Phase 1: Workstation Setup

### Phase 1A: Workstation Setup (Generic Overview)
1. We need a unix based terminal (Mac, Linux, or WSL (Windows Subsystem for Linux))
2. The following terminal shell based tools need to be installed on it:  
   git, aws (cli), node.js, npm (node package manager), typescript, cdk (cli)
   * flox.dev is the recommended way of installing tools, as it ensures consistency of dependencies between
     team members.
   * Install flox CLI from flox.dev  
     (Think of it as a bundling of all your dependencies)
   * Verify flox is installed
     `flox --version` (newer version is fine, this is just what was last tested)



### Phase 1B: Workstation Setup (Detailed Instructions for AL2 based EC2 Instance)
1. Manually provision a ec2 bastion in the AWS Web GUI
   * Amazon Linux 64-bit
   * t3a.medium (2 cpu / 4gb ram), smaller sizes can freeze up. (I should retest size small.)
   * In a public subnet, with a public IP (so you can ssh to it)
   * SSH key pair you have access to
   * 30GB storage recommended (Nix uses a decent amount of space) (8GB can work)
   * AWS Security SG allows ssh from your local machine

2. Gain shell access to the machine
   * **Option 1: Setup ssh access ~/.ssh/config**
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

   * **Option 2: Browser Based Shell using AWS Systems Manager (works with private ip assuming NAT & IAM)**
     * https://ca-central-1.console.aws.amazon.com/systems-manager/fleet-manager/managed-nodes?region=ca-central-1  
     * As long as it has internet access (public ip, or private ip in a VPC with a NAT GW)
     * and the right role it should show up, and that should be true if you gave it an admin role
     * From this interface you can `Select the node > Node actions > tools > Start Terminal session`

3. Install Flox (copy paste commands 1 line at a time)
```shell
#[ec2-user@ec2-bastion-with-iam-admin-role:~]#
cat /etc/os-release
uname -r
# ^-- The above commands say we're on an rpm based x86_64 distro of Amazon Linux 2023 
wget https://downloads.flox.dev/by-env/stable/rpm/flox-1.3.2.x86_64-linux.rpm
sudo rpm --import https://downloads.flox.dev/by-env/stable/rpm/flox-archive-keyring.asc
sudo rpm -ivh ~/flox-*.rpm
flox --version
rm ~/flox-*.rpm
# 1.3.2
```

4. Install node.js modules
```shell
# flox [flox.dev]
# [admin@workstation:~/eks-cdk-quickstart]
npm install
# ^-- will populate a /node_modules/, based on package.json
```

--------------------------------------------------------------------------------------------------------------

## Phase 2: IAM Setup

### Phase 2A: IAM Setup (Generic Overview)
* Configure AWS IAM Role and AWS CLI

### Phase 2B: IAM Setup (Detailed Instructions for AL2 based EC2 Instance)
* Manually create an aws admin ec2 instance role, and attach it. 
  (You can add or update the role of a pre-existing instance)

### Phase 2C: IAM Setup (Detailed Instructions for Local Machine)
* run `aws configure`
* run `cat ~/.aws/config`
* run `cat ~/.aws/credentials`, static user credentials would be here. Empty if SSO or IAM role.

--------------------------------------------------------------------------------------------------------------

## Phase 3: Git Repo Setup

### Phase 3A: Git Repo Setup (Generic Overview)
2. Gain the ability to clone a private git repo (here's an example based on private github)
   1. create a classic readonly GitHub Token to clone private doit repo  
      * https://github.com/settings/tokens/new  
      * note = test <-- note this value represents TOKEN_NAME
      * expiration = 7 days
      * scopes = repo (checking that will also check 5 subboxes)
      * Generate Token
   2. Temporarily copy the token's value into a nodepad app,  
      It'll look something like the following fake value:  
      `ghp_jwiZWtzLWNkay1xdWlja3N0YXJ0CgwMjQtMD`

### Phase 3B: Git Repo Setup (Detailed Instructions for Private GitHub Repo)
3. Copy Paste Commands (one line at a time) to clone private github repo from AWS Cloud Shell  
```shell
# [ec2-user@ec2-bastion-with-iam-admin-role:~]
sudo dnf update -y
sudo dnf install git -y
# if [admin@workstation:~], just make sure you have git installed
export TOKEN_NAME="test"
export TOKEN_PASS="ghp_jwiZWtzLWNkay1xdWlja3N0YXJ0CgwMjQtMD"
cd ~
git clone https://$TOKEN_NAME:$TOKEN_PASS@github.com/doitintl/eks-cdk-quickstart.git
cd ~/eks-cdk-quickstart
```

--------------------------------------------------------------------------------------------------------------

## Phase 4: CDK Bootstrap
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

* Bootstrap cdk
```shell
export AWS_REGION=ca-central-1
cdk bootstrap --region=ca-central-1
# ^-- Note the region flag isnt required, itll default to your locally configured region
#     Theres 2 advantages to explicitly specifying
#     1. When working with a team, they cant see your locally configured region,
#        so documenting in git improves reproducibility.
#     2. It makes it intuitively obvious that cdk bootstrap is regionally scoped, not global.
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
```
