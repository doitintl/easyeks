# Overview of Contents:
* The Pre-Requisites are Split into 3 Phases
  1. Workstation Setup
  2. IAM Setup
  3. Git Repo Setup
  4. Verification
* Each phase has
  * Generic instructions (you should skim this)
  * Detailed platform specific instructions (you should read this)
  * When this becomes a documentation webpage these can be re-organized into tabs

--------------------------------------------------------------------------------------------------------------

## Phase 1: Workstation Setup

### Phase 1A: Workstation Setup (Generic Overview)

### Phase 1B: Workstation Setup (Detailed Instructions for AL2 based EC2 Instance)

--------------------------------------------------------------------------------------------------------------

## Phase 2: IAM Setup

### Phase 2A: IAM Setup (Generic Overview)

### Phase 2B: IAM Setup (Detailed Instructions for AL2 based EC2 Instance)

--------------------------------------------------------------------------------------------------------------

## Phase 3: Git Repo Setup

### Phase 3A: Git Repo Setup (Generic Overview)

### Phase 3B: Git Repo Setup (Detailed Instructions for Private GitHub Repo)

--------------------------------------------------------------------------------------------------------------

## Phase 4: Verification



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











### Detailed Usage Steps: AWS EC2 Bastion VM and GitHub private repo
1. Manually provision a ec2 bastion in the AWS Web GUI
   * Amazon Linux 64-bit
   * t3a.medium, in a public subnet, with a public IP  
   * SSH key pair you have access to
   * 50GB storage (Nix uses a decent amount of space)
     Actually Rich mentioned they got it to work with 8GB storage.
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
