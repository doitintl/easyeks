# Quick Method of Satisfying Prerequisites
* This fast method is recommended for:
  * Anyone who wants to try this out as fast as possible.
  * Jr Engineers with little prior knowledge of shells, manually provisioning an ec2
    instance, ssh, and private git repos.
* It's not recommended for users planning to commit to long-term adoption of EasyEKS, 
  as it minimizes prerequisites at the cost of benefits gained by implementing the
  prerequisites.
* Unfortunately aws got rid of Cloud9, which would have been perfect for this, and 
  AWS's Cloud Shell is the closest equivalent.



## AWS Cloud Shell Introduction
* Notes: 
  * AWS Cloud Shell doesn't support installing flox / Nix pgks, so scripting is used as an alternative.
  * This assumes you have access to AWS Web Console and have your IAM user has admin rights
  * This minimizes or avoids:
    * setting up ssh and/or a shell environment
      * browser based shell
      * aws cli, npm, cdk, jq, and git are pre-installed
      * aws iam integration is pre-configured
    * setting up flox
    * authenticating to a private repo (not true during alpha, but beta or 1.0 a public repo would allow this to be skipped.)
* The AWS Cloud Shell methodology is meant to represent a "fast method" not a "correct method"
  * So it's recommended to use it to get a feel for the process, but then go back and do things the nix pkgs way if you
    start to seriously consider adopting Easy EKS for long term usage.
* You should read the expectations doc before doing this (it explains why ca-central-1 is used)



## TO DO:
* I need to rethink this from scratch. Cloud9 would be perfect but non-option :\
* Next best thing is probably to either:
  * use AWS CloudShell to bootstrap an EC2 VM.
  * or make a custom docker image with the npm dependencies installed. 
    (this would, introduce a need for a gitops pipeline to make it maintainable,
    but might be worth looking into.)
  * research if a better cloud9 alternative exists


## AWS Cloud Shell Instructions (Don't work will replace)
* https://ca-central-1.console.aws.amazon.com/cloudshell/home?region=ca-central-1#
* Note!:
  * AWS Cloud Shell only offers 1GB of persistent storage in the home directory.
  * 1GB isn't sufficient free space for npm dependencies.
  * AWS Cloud Shell has additional ephemeral (temporary storage) that we can use
  * Just know that when using the AWS Cloud Shell quickstart method:
    * The directory where you clone the repo into is important
    * and you should expect the ephemeral storage to be lost / reset after 20 min of
      inactivity.

* Clone the repo
```shell
# [cloudshell-user@ip-10-134-71-234 ~]
# v-- note in the future when this repo is public it'll be as simple as git clone without authentication.
export TOKEN_NAME="test_fake_values_as_an_example"
export TOKEN_PASS="ghp_jwiZWtzLWNkay1xdWlja3N0YXJ0CgwMjQtMD"
git clone https://$TOKEN_NAME:$TOKEN_PASS@github.com/doitintl/eks-cdk-quickstart.git
cd ~/eks-cdk-quickstart
# ^-- This location is persistent, but lacks storage for installing dependencies
df -h
# ^-- helps tell us which location would be good to store dependencies into
#     we'll become root to gain access to write to a location with more storage
#     root user's home dir (/root) is ephemeral storage
sudo su -
# [root@ip-10-134-71-234 ~]
cp -r /home/cloudshell-user/eks-cdk-quickstart /root
cd /root/eks-cdk-quickstart
npm install
# ^-- installs dependencies
# Note root user has misconfigured path & AWS CLI so switch back to cloudshell-user
chown -R cloudshell-user:cloudshell-user /root/eks-cdk-quickstart
su cloudshell-user
cd /root/eks-cdk-quickstart
# [cloudshell-user@ip-10-134-71-234 /root/esk-cdk-quickstart]
export AWS_REGION=ca-central-1
cdk list

# ^-- doesn't work this is getting too hacky/too much roomt for error
#     an inexperienced person would have trouble following.
```


