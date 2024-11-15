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

## Background Context to Understand Why this specific Approach is Used:
* AWS Cloud 9, would have been perfect for this, but AWS removed that service.
* AWS Cloud Shell, looks like it'd work, but can't for various reasons:
  * Lacks rights and storage to install flox / Nix pgks
  * Only offers 1GB storage, which is insufficient storage, to satisfy install of
    dependencies using a script. This also prevents the use of large docker images.
  * Ephemeral Storage with additional space exists, but too can't be used for
    multiple reasons.
* Many other options are avoided, because they introduce many prerequisites.

------------------------------------------------------------------------------------

## Overview of the Approach
1. Assumed Prerequisites:  
   1. You have docker installed.
   2. You can access AWS CloudShell as an AWS Admin IAM user or assumed role.
   3. You are using a unix terminal (Mac, Linux, or Windows Terminal with WSL).
2. Docker on local machine is used to produce a secure standardized environment.
3. AWS Cloud Shell is used to generate ephemeral IAM credentials, that can be copy
   pasted into the docker container's environment variables.

------------------------------------------------------------------------------------

## Quickstart Steps:

### Step 1: Recommended Reading
* It's recommended that you read the expectations doc and notes above.
  * They'll help establish background contextual information, like why ca-central-1
    is used initially.

### Step 2: Clone this Git Repo to your Local Machine
* Note after public alpha this quickstart will change to a public repo, that
  doesn't require authentication.
1. create a classic readonly GitHub Token to clone private doit repo  
   * https://github.com/settings/tokens/new  
   * note = test <-- IMPORTANT: This value represents TOKEN_NAME
   * expiration = 7 days
   * scopes = repo (checking that will also check 5 subboxes)
   * Generate Token
2. Temporarily copy the token's value into a text editor,  
   It'll look something like the following fake value:  
   `ghp_jwiZWtzLWNkay1xdWlja3N0YXJ0CgwMjQtMD`
3. Manually edit the text file to look like this, but `customized with your values`:
   ```text
   export TOKEN_NAME="test"
   export TOKEN_PASS="ghp_jwiZWtzLWNkay1xdWlja3N0YXJ0CgwMjQtMD"
   echo $TOKEN_NAME
   echo $TOKEN_PASS
   ```
4. Open a Unix Terminal, and copy paste a customized version of the above command
   into your terminal. Verify that the echo $VAR, confirms your environment
   variables are correctly set before moving on.
5. Download this repo to your local machine  
   `[admin-user@local-machine:~]`  
   ```shell
   cd ~
   git clone https://$TOKEN_NAME:$TOKEN_PASS@github.com/doitintl/eks-cdk-quickstart.git
   cd ~/eks-cdk-quickstart
   ```

### Step 3: Use a Dockerfile in the repo to build a custom image for local use
* `[admin-user@local-machine:~/eks-cdk-quickstart]`  
  ```shell
  time docker build . --tag local-image
  ```

### Step 4: Use AWS CloudShell to provision Ephemeral IAM credentials for docker shell
* Visit AWS Cloud Shell
  https://ca-central-1.console.aws.amazon.com/cloudshell/home?region=ca-central-1#
* `[cloudshell-user@ip-10-134-71-234 ~]`
* Security Notice:
  * Hackers love engineers who copy paste random code from the internal into a terminal. 
    (Same with curl http://be.careful.com/install.sh | bash)
  * While convienent, this is a security bad practice that's a known threat vector, and
    a dangerous habit to promote.
  * Cloud IAM access has higher stakes than compromising your local machine, so this
    is a good time to be extra vigilant!
* Practice good cyber security hygiene by:
  * Paying attention to date of last update/edit.  
    * A common cognitive shortcut is to trust that someone in the open source community,
      audited a bit of code and didn't see a need to create an git issue about security
      concerns.
    * Remember that logic isn't valid for recent edits. 
    * Also, If you've personally audited in the past, you should re-audit when recent
      edits occur.
  * Reading the following code block.
  * Take some time to review it for safety and understand it's intent.
* Use Github's copy button to help copy paste the following block of text into AWS Cloud Shell.
```shell
tee /home/cloudshell-user/.local/bin/gencreds  << 'EOF'
#!/bin/bash
: Coding Logic: Imperative code is used to generate declarative results
USERINFO=$(aws sts get-caller-identity)
ACCOUNT=$(echo $USERINFO | jq -r .Account)
USER_ARN=$(echo $USERINFO | jq -r .Arn)
USER_ID=$(echo $USER_ARN | cut -d ":" -f 6- | tr '/' '_')
ROLE_NAME="$USER_ID"_local_docker_iam_admin
CHECK_EXISTANCE=$(aws iam get-role --role-name $ROLE_NAME 2>&1)

if [[ $USER_ID == "root" ]]; then
  echo "A significant error has been detected. AWS root user can't be used to assume IAM roles."
  echo "Login as an IAM user or role, and then retry this logic."
  echo "Detected USER_ID: $USER_ID"
fi

if [[ $CHECK_EXISTANCE =~ "The specified value for roleName is invalid" ]]; then
  echo "A significant error has occured, related to auto generation of role name."
  echo -e "If you see this error, please submit a bug report. \n"
  echo -e "ERROR: $CHECK_EXISTANCE \n"
  echo "ROLE_NAME: $ROLE_NAME"
fi

if [[ $CHECK_EXISTANCE =~ "NoSuchEntity" ]]; then
  echo "User $USER_ID's local docker iam admin role for IaC Automation doesn't exist. It will be created.";
tee /tmp/assume-role-policy.json << POLICYFILE
{
  "Version": "2012-10-17",
  "Statement": [
      {
          "Effect": "Allow",
          "Principal": { 
              "AWS": "$USER_ARN"
          },
          "Action": "sts:AssumeRole"
      }
  ]
}
POLICYFILE
  aws iam create-role \
    --role-name $ROLE_NAME \
    --max-session-duration 36000 \
    --tags '{"Key": "Role Generated Using Docs In", "Value": "https://github.com/doitintl/eks-cdk-quickstart"}' \
           '{"Key": "Purpose", "Value": "Allows named human user to easily manually generate ephemeral IAM admin credentials for use by local docker IaC Automation"}' \
    --assume-role-policy-document file:///tmp/assume-role-policy.json
  aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
  echo "sleeping for 10 seconds to allow time for IAM role to provision and become ready for use."
  sleep 10s
fi

echo "The following are ephemeral IAM admin credentials that will expire after 10 hours."
echo "You can copy paste them into a local terminal, to give a local docker container IAM Admin Access."
echo "IMPORTANT: It's only relatively safe to paste these into a trust worthy docker image running on your local machine."
echo "IMPORTANT: If you accidently paste live credentials into a dangerous location, then immediately navigate to:"
echo -e "AWS Web Console -> IAM -> Roles -> search "local_docker_iam_admin" -> Revoke sessions --> Revoke active sessions.\n\n"

STS_SESSION_NAME="$USER_ID"_$(date | tr ' :' '_')
JSON_CREDS=$(aws sts assume-role --role-arn arn:aws:iam::$ACCOUNT:role/$ROLE_NAME --role-session-name $STS_SESSION_NAME 2>/dev/null)
ACCESS_KEY=$(echo $JSON_CREDS | jq -r .Credentials.AccessKeyId)
SECRET_KEY=$(echo $JSON_CREDS | jq -r .Credentials.SecretAccessKey)
TOKEN=$(echo $JSON_CREDS | jq -r .Credentials.SessionToken)
echo """
Copy paste the following into local docker shell, to easily give local docker temporary IAM rights:


export AWS_ACCESS_KEY_ID=$ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=$SECRET_KEY
export AWS_SESSION_TOKEN=$TOKEN
aws sts get-caller-identity

"""
EOF
sudo chmod +x /home/cloudshell-user/.local/bin/gencreds
```
* Run this in CloudShell: `gencreds`

### Step 5: Run the local-image with an interactive shell
* `[admin-user@local-machine:~/eks-cdk-quickstart]`  
  ```shell
  docker run -it --hostname cdk-runner local-image bash
  ```

* Clone the repo
```shell
# 

npm install
export AWS_REGION=ca-central-1
cdk list

```


