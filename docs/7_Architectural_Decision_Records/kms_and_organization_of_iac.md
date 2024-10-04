/*UX Improvement: Modified EKS Blueprint's annoying default of making a new EKS key everytime you make a cluster
The idea is the following, overrideable default:
* all lower envs share a kms key
* staging envs share a kms key
* prod envs share a kms key
*/

# Scope and Purpose of Reusable Dependencies
## BLUF: Bottom Line Up Front (this doc is only for those curious about design)
* This document explains the reasoning of why this IaC is organized/implemented in this way,
  it's basically to adhere to IaC best practices.
* Immediate Problems this design solves:
  * Avoids orphaned KMS Keys.
  * Avoids KMS challenges with backup and restore and blue green cluster deployments.
  * Guidance on patterns for anyone forking this IaC.


## Background Context on why/how this design is representative of best practices
* IaC has 2 main schools of thought:
  * Treat infrastructure like cattle and just replace it, when it acts up.
  * Treat infrastructure like a long lived pet, and nurse it back to health if it becomes unhealthy.
* A bit of wisdom:
  * Neither approach is superior in 100% of cases; 
  * However, for specific scenarios either approach can be superior, from a perspectve of practicality.
    * As a general rule of thumb:
      * Stateless workloads are best to treat as cattle.
        * Ex: pods and kubernetes nodes
      * Stateful workloads and dependencies are best to treat as pets.
        * Ex: VPCs, Databases, Clusters, and KMS Keys
* When it comes to long lived pet infrastructure, there are several best practices and patterns for
  managing it in a way that minimizes risk and maximizes recoverability.
  * **Some best practices are well known:**
    * Using Dev, Stage, Prod environments ad testing changes in lower environments.
    * Blue Green deployments
    * Backup and Restore
    * IaC with automation for quick rebuilds and test environments.
  * **The following best practices aren't as well known:**
    * When writing IaC and automation
      * Managing all infrastructure as 1 unit is an anti-pattern for several reasons
        * Large Blast Radius:
          * `terraform destroy` or `cdk destroy` could delete too much.
          * Even when that's not a concern, because you only appy and never delete. If multiple
            components like vpc, eks, kms, etc were tightly coupled a bug in 1 could prevent
            an automation driven change control to all of them.
        * Lumping everything together can make it harder to maintain and reason about, which can
          create a risk of unintented changes. Here's a sceanrio:
          * Let's say VPC and EKS were combined in 1 automation stack.
          * Then someone made a manual change to the VPC that wasn't reflected in code.
          * Then someone wanted to make a change in EKS, managed using IaC, if the scope of the
            automation touches both, then it could cause an unintended rollback of a manual VPC
            change when the intent was to only change EKS Cluster setting.
            Like if there's a diff between reality and IaC due to a manual change.
      * Best practice is to divide IaC and automation into scoped boundaries.
        * VPC, KMS, EKS Cluster, and Workloads on EKS Cluster, each have different lifecycles 
          * VPC is usually the longest lived option and rarely changes
          * KMS keys can also be long lived and never need to change
          * EKS Clusters live a long time but less than the above
          * Workloads deployed on EKS clusters change frequently
        * By keeping the automation and IaC scoped to reasonable boundaries.
          * You can do stuff like initial deployment of VPC with automation, and a mix of
            manual changes. And then when messing with other automation, you won't risk
            accidentally rolling back a manual VPC change.
          * It makes sense for KMS keys to outlast EKS clusters
            * If you regularly create and delete sandbox test clusters, they can generate
              alot of orphaned KMS keys, to avoid that it makes sense to just reuse a KMS key.
            * Having a small predictable and manageable set of KMS keys makes encyrpted backups
              much easier to manage, and avoiding the need to periodically delete/clean up KMS
              keys helps prevent the accidental deletion of a KMS key that is needed to access
              data in an encyrpted backup.
            * If you implement a blue green deployment strategy for a high risk update like
              a major change to a CNI or service mesh, then you'll want to have both clusters
              use the same KMS key to a void problems.

