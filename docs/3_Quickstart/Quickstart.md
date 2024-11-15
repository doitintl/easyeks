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
* Copy paste the following block of text into CloudShell
```shell
tee /home/cloudshell-user/.local/bin/gencreds  << 'EOF'
#!/bin/bash
TEMP=$(curl -H "Authorization: $AWS_CONTAINER_AUTHORIZATION_TOKEN" $AWS_CONTAINER_CREDENTIALS_FULL_URI 2>/dev/null)
ACCESS_KEY=$(echo $TEMP | jq -r .AccessKeyId)
SECRET_KEY=$(echo $TEMP | jq -r .SecretAccessKey)
echo """
You can copy paste the following ephemeral credentials into docker shell, to easily
give docker shell temporary IAM rights:
export AWS_ACCESS_KEY_ID=$ACCESS_KEY
export ACCESS_SECRET_ACCESS_KEY=$SECRET_KEY
"""
EOF
sudo chmod +x /home/cloudshell-user/.local/bin/gencreds
```
* Darn the ephemeral credentials expire in 6 minutes... I'll try it and see what happens.
  It should be possible to provision one's that last 1 hour.

* Copy paste the following block of text into CloudShell
```shell
tee /home/cloudshell-user/.local/bin/gencreds  << 'EOF'
#!/bin/bash
: Coding Logic: Imperative code is used to generate declarative results
ROLE_NAME="infrastucture_automation_admin"
CHECK_EXISTANCE=$(aws iam get-role --role-name $ROLE_NAME 2>&1)
if [[ $CHECK_EXISTANCE =~ "NoSuchEntity" ]]; then
  echo "infrastructure_automation_admin role doesn't exist, it will be created";
  tee /tmp/assume-role-policy.json << '


POLICY="""
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "sts:AssumeRole",
            "Principal": {
                "AWS": "905418347382"
            },
            "Condition": {}
        }
    ]
}
"""
POLICYB=$( echo "$POLICY" | base64 )
echo "$POLICY" > /tmp/policy.json
cat /tmp/policy.json

echo "$POLICY" > policy.json

  aws iam create-role \
    --role-name $ROLE_NAME \
    --max-session-duration 36000 \
    --tags '{"Key": "Generated By", "Value": "https://github.com/doitintl/eks-cdk-quickstart"}' \
    --assume-role-policy-document file://policy.json

    --cli-binary-format raw-in-base64-out

fi



ACCOUNT=$(aws sts get-caller-identity | jq .Account)




EOF
sudo chmod +x /home/cloudshell-user/.local/bin/gencreds
```




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


