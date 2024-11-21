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

## Quickstart's Minimal Prep Work:

### Step 1: Recommended Reading
* It's recommended that you read the expectations doc and notes above.
  * They'll help establish background contextual information, like why ca-central-1
    is used initially.

### Step 2: Use Copy Paste to install getcreds command on AWS CloudShell
* After following these steps, you can type `getcreds` into AWS's CloudShell, and
  it will become a newly recognized command that:
  * Will be used later.
  * It provisions Ephemeral IAM credentials that can be used by docker shell.
* Visit AWS Cloud Shell  
  https://ca-central-1.console.aws.amazon.com/cloudshell/home?region=ca-central-1#
* Security Notice:
  * Hackers love engineers who copy paste random code from the internal into a terminal.  
    (Same with curl http://be.careful.com/install.sh | bash)
  * While convienent, this is a security bad practice that's a known threat vector, and
    a dangerous habit to promote.
  * Cloud IAM access has higher stakes than compromising your local machine, so this
    is a good time to be extra vigilant!
* Practice good cyber security hygiene by:
  * As a rule of thumb, this quickstart method should only be done in aws accounts,
    that represent lower non-prod enviornments, or ideally a playground / sandbox account.
  * Paying attention to date of last update/edit.  
    * A common cognitive shortcut is to trust that someone in the open source community,
      audited a bit of code and didn't see a need to create an git issue about security
      concerns.
    * Remember that logic isn't valid for recent edits. 
    * Also, If you've personally audited in the past, you should re-audit when recent
      edits occur.
  * Reading the following code block.
  * Investing some time into reviewing it for safety and understanding it's intent.
* Use Github's copy button to help copy paste the following block of text into AWS Cloud Shell.
* `[cloudshell-user@ip-10-134-71-234 ~]`
```shell
tee /home/cloudshell-user/.local/bin/gencreds  << 'EOF'
#!/bin/bash
# Coding Logic: Imperative code is used to generate declarative results.
USERINFO=$(aws sts get-caller-identity)
ACCOUNT=$(echo $USERINFO | jq -r .Account)
USER_ARN=$(echo $USERINFO | jq -r .Arn)
USER_ID=$(echo $USER_ARN | cut -d ":" -f 6- | tr '/' '_')

if [[ $USER_ID == 'root' ]]; then
  echo "A significant error has been detected. AWS root user can't be used to assume IAM roles."
  echo "Login as an IAM user or role, then retry this logic."
  echo "Detected USER_ID: $USER_ID"
fi

# The ROLE_NAME logic handles roles having a max length of 64 characters. It's basically
# truncate if needed, then append. Ultimately _docker always ends up as the last 7 characters.
ROLE_NAME=$(echo -n $USER_ID | cut -c1-57)_docker

CHECK_EXISTANCE=$(aws iam get-role --role-name $ROLE_NAME 2>&1)

if [[ $CHECK_EXISTANCE =~ 'The specified value for roleName is invalid' ]]; then
  echo "A significant error has occured, related to auto generation of role name."
  echo -e "If you see this error, please submit a bug report. \n"
  echo -e "ERROR: $CHECK_EXISTANCE \n"
  echo "ROLE_NAME: $ROLE_NAME"
fi

if [[ $CHECK_EXISTANCE =~ 'NoSuchEntity' ]]; then
  echo "User $USER_ID's local docker iam admin role for IaC Automation doesn't exist. It will be created."
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
    --max-session-duration 3600 \
    --tags '{"Key": "Role Generated Using Docs In", "Value": "https://github.com/doitintl/eks-cdk-quickstart"}' \
           '{"Key": "Purpose", "Value": "Allows named human user to easily manually generate ephemeral IAM admin credentials for use by local docker IaC Automation"}' \
    --assume-role-policy-document file:///tmp/assume-role-policy.json
  aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
  echo -e "Sleeping for 10 seconds to allow time for IAM role to provision and become ready for 1st use.\n"
  sleep 10s
fi

echo -e "
The following are ephemeral IAM admin credentials that will expire after 1-hour.
1-hour represents the max time allowed by this methodology, it's a hard limit imposed by AWS.
You can copy paste them into a interactive shell of a docker container running on your
local machine, as an easy method of giving the local docker container AWS IAM Admin Access.
Note: The generated copypasteable creds, have an if statement, it's purpose is to
      avoid annoyances, in the event you accidently paste the results into cloudshell.
IMPORTANT: It's only relatively safe to paste these into a trust worthy docker image running
           on your local machine.
IMPORTANT: If you accidently paste live credentials into a dangerous location, 
           then immediately navigate to:
           AWS Web Console -> IAM -> Roles -> search 'docker' ->
           Click ROLE_NAME = $ROLE_NAME
           -> Revoke sessions -> Revoke active sessions.\n\n"

# NOTE: aws sts assume-role STS_SESSION_NAME variable has a acceptable character and max length constraints.
STS_SESSION_NAME=$(echo -n "$USER_ID"_$(date | tr ' :' '_') | rev | cut -c 1-64 | rev)
JSON_CREDS=$(aws sts assume-role --role-arn arn:aws:iam::$ACCOUNT:role/$ROLE_NAME --duration-seconds 3600 --role-session-name $STS_SESSION_NAME 2>/dev/null)
ACCESS_KEY=$(echo $JSON_CREDS | jq -r .Credentials.AccessKeyId)
SECRET_KEY=$(echo $JSON_CREDS | jq -r .Credentials.SecretAccessKey)
TOKEN=$(echo $JSON_CREDS | jq -r .Credentials.SessionToken)
echo """
Copy paste the following into the interactive shell of a docker container, running on
your local machine, to easily give the docker container temporary AWS IAM Admin Rights.


if [[ \$USER != 'cloudshell-user' ]]; then
export AWS_ACCESS_KEY_ID=$ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=$SECRET_KEY
export AWS_SESSION_TOKEN=$TOKEN
aws sts get-caller-identity
fi



As a security best practice, when you're done (pasting into docker shell):
1. Copy some random non-sensitive text
   • It'd be a good idea to use a random word in this output.
   • It'd be a bad idea to copy text from the url bar, because if you accidently
     paste and press enter in the url bar, then you should treat any credentials
     that were entered into a url/search bar query as intercepted/leaked.
   • The intent of this practice to overwrite your copy function with non-sensitive
     text, in order to lower your risk of accidently pasting credentials.
2. Run 'clear' (in AWS Cloud Shell)
   • The intent is to avoid leaking credentials during screen shares or shoulder surfing.
3. Close the AWS Cloud Shell tab.
"""
EOF
chmod +x /home/cloudshell-user/.local/bin/gencreds
```

### Step 3: Clone this Git Repo to your Local Machine
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
4. Open a Unix Terminal, running on your local machine, copy paste a customized
   version of the above command into your terminal. Verify that the echo $VAR,
   confirms your environment variables are correctly set before moving on.
5. Download this repo to your local machine  
   `[admin-user@local-machine:~]`  
   ```shell
   cd ~
   git clone https://$TOKEN_NAME:$TOKEN_PASS@github.com/doitintl/eks-cdk-quickstart.git
   cd ~/eks-cdk-quickstart
   ```

### Step 4: Use a Dockerfile in the repo to build a custom docker image for local use
* `[admin-user@local-machine:~/eks-cdk-quickstart]`  
  ```shell
  cd ~/eks-cdk-quickstart
  time docker build . --tag local-image
  ```

### Step 5: Run the local-image with an interactive shell
* `[admin-user@local-machine:~/eks-cdk-quickstart]`  
  ```shell
  docker run -it --hostname dockerized-cdk-runner local-image bash
  ```

### Step 6: Run getcreds on AWS CloudShell, and copy paste creds into local Docker Shell
* Visit AWS Cloud Shell  
  https://ca-central-1.console.aws.amazon.com/cloudshell/home?region=ca-central-1#
* Type `gencreds` to provision Ephemeral IAM Admin credentials that can then be
  copy pasted into docker shell, to give the docker container IAM rights.
* Close AWS Cloud Shell, and type `clear` into your docker terminal.  
  (This is a good habit to make sure ephemeral credentials aren't leaked over a
  screenshare or shoulder surf.)

------------------------------------------------------------------------------------

## Quickstart's Steps:

### Step 1: Use docker shell to bootstrap cdk
* Verify IAM rights, then Bootstrap cdk:
  `[user@dockerized-cdk-runner:/app $]`  
```shell
aws sts get-caller-identity
export AWS_REGION="ca-central-1"
cdk bootstrap
```
* Note 1: There are advantages to explicitly specifying your region like above:
  1. When working with a team, your teammates won't be able to see your locally
     configured region, so documenting in git improves reproducibility.
  2. It makes it intuitively obvious that cdk bootstrap is regionally scoped,
      not global. cdk can only deploy into regions that have been cdk bootstrapped.
* Note 2: cdk bootstrap, needs to be run at least once per region-account pair.  
  It's idempotent in that running it more than once won't hurt.
* Note 3: After cdk bootstrapping a region  
  If you navigate to AWS Web GUI Console > CloudFormation > Stacks (in the region)
  You'll see a Stack named "CDKToolkit"

### Step 2: Use docker shell to list stacks and deploy VPC
* run cdk list:  
  `[user@dockerized-cdk-runner:/app $]`  
```shell
export AWS_REGION="ca-central-1"
time cdk list
cdk deploy lower-envs-vpc
```
* Note: cdk list won't be instant, for me it took about 5 seconds.
* Also you'll notice a prompt 'Do you wish to deploy these changes (y/n)?'
* ETA on VPC deployment = 3.5 minutes

### Step 3: Use docker shell to list stacks and deploy dev1-eks (cluster)
* run cdk list:  
  `[user@dockerized-cdk-runner:/app $]`  
```shell
export AWS_REGION="ca-central-1"
time cdk list
cdk deploy dev1-eks
```
* ETA on VPC deployment = ~15 minutes
* At the end you should see feedback similar to the following:
```console
Do you wish to deploy these changes (y/n)? y
dev1-eks: deploying... [1/1]
dev1-eks: creating CloudFormation changeset...

 ✅  dev1-eks

✨  Deployment time: 893.2s

Outputs:
dev1-eks.KarpenterInstanceNodeRole = dev1-eks-dev1ekskarpenternoderoleF6445C46-xvJZpMysh8oo
dev1-eks.KarpenterInstanceProfilename = KarpenterNodeInstanceProfile-1f463f4eccef4793d856668b2c84dd9a
dev1-eks.dev1eksClusterName701CF81F = dev1-eks
dev1-eks.dev1eksConfigCommand9B300592 = aws eks update-kubeconfig --name dev1-eks --region ca-central-1 --role-arn arn:aws:iam::905418347382:role/dev1-eks-dev1eksAccessRole5BA1A9E3-w3E8P0T0L4nj
dev1-eks.dev1eksGetTokenCommandDE6D6947 = aws eks get-token --cluster-name dev1-eks --region ca-central-1 --role-arn arn:aws:iam::905418347382:role/dev1-eks-dev1eksAccessRole5BA1A9E3-w3E8P0T0L4nj
Stack ARN:
arn:aws:cloudformation:ca-central-1:905418347382:stack/dev1-eks/7c3ff440-a6cc-11ef-8c11-02f264ebaca7

✨  Total time: 898.35s
```
* Note: When done, you can see results here  
  https://ca-central-1.console.aws.amazon.com/cloudformation/home?region=ca-central-1
