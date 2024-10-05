## What Easy EKS will and won't help you with
* What's covered:  
  * Easier management of a production ready baseline configuration of multiple EKS Clusters.
  * Preconfigured addon's needed to achieve basic production ready functionality:  
    (node autoscaling, storage and load balancer provisioning, observability dashboards, etc.)
* What is NOT covered: 
  * Custom userfacing applications
  * This means you still need kubernetes expertise on your team, they're just saved from engineering toil and
    able to focus more on user facing applications.

--------------------------------------------------------------------------------------------------------------

## Expected End State if you follow the Recommended Approach
* End state of: x dev, y stage, z prod EKS clusters (z, y, z are integers)
  * Each cluster(environment) is optional and can be managed with overlapping or individualized config.
  * Reproducible Deployments:
    * (IaC + Deployment Tools + Deployment docs) in git + manual human in the loop reproducible workflow to
      manage EKS Infrastructure Bootstrapping.
* Recommended End State:
  * Have a "low side" AWS Account:
    * Give Devs and Ops teammates access.
    * It'd host a shared `lower-envs-vpc`, (An Opinionated VPC, with cost optimizations and dualstack network.)
    * In which `dev1-eks`, and multiple instances of Easy EKS clusters can exist. (With IPv6 pods. IPv4 nodes and Load Balancers.)
  * Have a "high side" AWS Account:
    * Give Ops teammates access.
    * It'd host a shared `higher-envs-vpc`.
    * In which `stage1-eks`, `prod1-eks`, etc can exist. (The names can be changed as needed.)

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
      * `lower-envs-vpc`
      * `dev1-eks`
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
    (example fork to a private git repo, so you can make edits)

* **Phase 5: Basic Usage Guides**
  * The quickstart is the fast way.
  * This is the same, just done the right way.
  * Basics of karpenter and tear down

* **Phase 6: Advanced Usage Guides**
  * How and where to make basic changes and modifications

* **Phase 7: Proficient Usage Guidelines**
  * Suggestions on how to implement a production setup.
  * Suggestions on maintaining over time and if / how to consume updates from this repo.
  * Suggested Usage Tips (Future doc that only exists in my head.)

