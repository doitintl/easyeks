## EKS's kubectl and Web Console Access is relatively hard by default
* Let's use GKE as an example of what a great UX looks like:
  * By default a GCP IAM admin can see everything in the GKE web console, and run a single
    command copy pastable from the web console to gain kubectl access to GKE.
    * This all works because GCP IAM roles are mapped/bound to GKE rbac rights by default.
* What specific challenges does EKS have that make kubectl and web console access hard:
  * Note: The "cluster creator" of an EKS cluster, is an exception to the following (access
    is relatively hard for everyone else.)
  * No one else gets access to either, not account owner/root user, or aws iam admins.
  * Lack of kubectl access greatly limits Web Console Access
  * kubectl access configuration needs to be explicitly configured:
    * For each individual EKS cluster.
    * EKS API (in the eks web console)
      * Can give access to IAM users or IAM roles
    * aws-auth config map in kube-system namespace
      * Can give rights to IAM users, IAM roles, and AWS Accounts (Maybe? https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_eks.AwsAuth.html#addwbraccountaccountid).
      * Is fragile (if you update it with bad syntax, it stops allowing rights)
    * EKS API and aws-auth (CM) both:
      * [<u>Don't support AWS IAM groups mapping to EKS rights.</u>](https://github.com/kubernetes-sigs/aws-iam-authenticator/issues/176)
      * Don't support wildcards when trying to map IAM users/roles to EKS rights.  
        (Usually AWS IAM supports wildcards, EKS IAM mappings don't)
      * Require 1 explicit entry to grant rights to a single IAM user or role,
        so granting access to multiple users becomes tedious busy work.
      * [<u>This is a big problem for SSO users as they assume a randomly generated role</u>](https://github.com/aws/containers-roadmap/issues/474)
        , so it's often the case that every individual role involves a degree of manual
        configuration.

---------------------------------------------------------------------------------------------------

## EasyEKS makes EKS Web Console and kubectl access easier (initial draft)
* By aiming for an end state of
  * AWS Auth ConfigMap that grants viewer access to the AWS account (wip)
  * A declarative EKS read-only viewer role
    * That's assumable by humans?
    * That's assumable by EC2? Provision an EC2 box accessible via SSM?
  * A declarative EKS admin role?
    * Use IaC to easily defined, manage, and apply a list of EKS IAM admins to multiple clusters (done)
    * make it assumable by humans? (why or why not)
* (WIP: add more how and why after tinkering more)
* results of tinkering:
  * aws auth configmap's addAccount doesn't seem to do anything useful
  * going to look into a 3rd party tool next
    https://github.com/kubernetes-sigs/aws-iam-authenticator/blob/master/README.md#full-configuration-format
