## Recommended onboarding path for anyone adopting the solution
Read docs and follow guides in the following order
1. Intro
2. Expectations/Expectations
3. Prerequisites/Quickstart.md

11. Expectations/Useful_BG_Context


* Understanding how it works and what to expect at a high level

add initial demo feedback.

Expected end state 
* if you use this product here's what you can expect it to do
* what you can expect it not to do / what you'll have to do

user expectations setting

* onboarding process in phases
* recommended reading
* o right I need to point out that people are expected to fork this repo.
  I should also point out recommendations in terms of maintaince over time / consuming updates.
  or mention that in proficient


--------------------------------------------------------------------------------------------------------------

## What to expect with the onboarding experience.
If you're interested in adopting Easy EKS's opinionated approach, here's what
you can expect while following the new user onboarding guides.

* **Phase 1: Discover Easy EKS**
  * Suggested Reading:
    1. Intro
    2. Expectations 
    3. Useful Background Contextual Info

* **Phase 2: Try the 1-hour Quickstart**
  * The quickstart is designed to:
    * minimize the need for prior knowledge
    * minimize the need to implement prerequisites
    * Help you deploy, within an hour, the following to region `ca-central-1`:
      * `lower-envs-vpc` (An opinionated vpc, with cost optimizations and dualstack.)
      * `dev1-eks` (An Easy EKS Cluster, based on IPv6 pods and IPv4 nodes and LBs)
      * These will be deployed using the Easy EKS IaC, using a slightly altered methodology.
    * Notes:
      * Stick to `ca-central-1` until you graduate from the basics, because changing it has to be done
        in more than 1 place, advanced covers how to switch regions.
      * A decent bit of that time ~4min vpc ~16min EKS is waiting for automation to finish, while you
        wait for it to finish, consider reading the materials in phase 3 while it runs.
      * Note: Currently if you down scale down karpenter provisioned nodes before destorying you'll need to
        do some manual cleanup.

* **Phase 3: Advanced Reading for the Interested**
  * Suggested reading:
    * ADRs is optional reading, it just explains why things are how they are.
    * /bin/cdk-main.ts 
    * /config/*
  * Here's where you decide if you want to move forward or not.

* **Phase 4: Setup Prerequisites**
  * The quickstart is the fast way.
  * This is the same, just done the right way.

* **Phase 5: Basic Usage Guides**
  * The quickstart is the fast way.
  * This is the same, just done the right way.
  * Basics of karpenter and tear down

* **Phase 6: Advanced Usage Guides**
  * How and where to make basic changes and modifications

* **Phase 7: Proficient Usage Guidelines**
  * Suggestions on how to implement a production setup.

--------------------------------------------------------------------------------------------------------------

## Expected End State if you follow the Recommended Approach
* End state of: x dev, y stage, z prod EKS clusters (z, y, z are integers)
  * Each cluster(environment) is optional
  * Can be managed individually
  * Reproducible Deployments are achieved using:
    * (IaC + Deployment Tools + Deployment docs) in git + manual human in the loop reproducible workflow to
      manage EKS Infrastructure Bootstrapping.
    * IaC in git + GitOps operator in cluster + human in the loop reproducible workflow to manage EKS
      application workloads.
* Recommended End State:
  * N dev clusters exist in a lower-envs-vpc
  * Y & Z stage and prod clusters exist in a higher-envs-vpc
  * N dev envs are isolated in a "low side" AWS account. (Devs and Ops have access.)
  * stage and prod are isolated in a "high side" AWS account. (Only Ops has access.)

--------------------------------------------------------------------------------------------------------------

### High level overview of usage steps
1. Setup a workstation with AWS rights (your laptop, EC2 VM with IAM role you can ssh into)  
   (Note: AWS Cloud Shell won't work due to lack of disk space and "System has not been booted with systemd as init system (PID 1)" Error)
2. Install flox.dev
3. Clone git repo onto workstation
   * For initial testing just fork the upstream repo 
   * For adoption fork the repo and clone your fork
4. cd into git repo (it has a .flox folder)
   `cd ~/eks-cdk-quickstart`
5. `flox activate`  
   Flox will use nix packages to overlay(merge/override) pre-requisite dependencies
   into your current working directory. (and append "flox [flox.dev]\n" to your $PS1 prompt var)  
   So things like `npm --version` in the working directory and sub dirs, will likely show
   a different value than if you ran the command in another location on your terminal.
   It'll use versions of the cli tool supplied by nix pkgs, rather than what's installed on
   your system.
9. Edit config and deploy again
10. Suggested Usage Tips (In the future link to a doc that only exists in my head.)

