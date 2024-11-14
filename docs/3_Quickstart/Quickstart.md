# Easy EKS Quickstart
## Who is this for
* All first time users, are recommended to initially start with this approach:
  * This approach aims to be accessible to Jr Engineers:
    * Only basic knowledge of docker, aws iam, and linux shell is needed.
  * Even Senior Engineers can appreciate initially starting with this approach:
    * The quickstart methodology:
      * Aims to make Easy EKS's Workflow and Results:
        * Easy to try out
        * Quick to test
      * By initially skipping and minimizing prerequisites.
    * After having a chance to quickly try it out, get a feel for the process and
      workflow, if you decide you like and want to adopt the approach.
      Then you can advance to adoption onboarding where a
      different methodlogy involving prerequisite steps is recommended, because it's
      more optimized for long-term adoption. (Think of this as a "fast method", and
      that as a "recommended method".)

------------------------------------------------------------------------------------

## Overview of the Approach
* Background Context to understand why the approach is taken:
  * AWS Cloud 9, would have been perfect for this, but AWS removed that service.
  * AWS Cloud Shell, looks like it'd work, but can't for various reasons:
    * Lacks rights and storage to install flox / Nix pgks
    * Only offers 1GB storage, which is insufficient storage, to satisfy install of
      dependencies using a script. This also prevents the use of large docker images.
    * Ephemeral Storage with additional space exists, but too can't be used for
      multiple reasons.
  * Many other options are avoided, because they introduce many prerequisites.
* Overview of the approach:
  1. Assumed Prerequisites:  
     1. You have docker installed.
     2. You can access AWS CloudShell as an AWS Admin IAM user or assumed role.
  2. Docker on local machine is used to produce a secure standardized environment.
  3. AWS Cloud Shell is used to generate ephemeral IAM credentials, that can be copy
     pasted into the docker container's environment variables.

------------------------------------------------------------------------------------

## Quickstart Steps:
* You should read the expectations doc before doing this.  
  (It explains why ca-central-1 is used initially.)

* authenticating to a private repo (not true during alpha, but beta or 1.0 a public repo would allow this to be skipped.)

* https://ca-central-1.console.aws.amazon.com/cloudshell/home?region=ca-central-1#

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


