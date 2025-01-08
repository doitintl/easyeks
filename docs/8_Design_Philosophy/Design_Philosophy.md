# Easy EKS's Design Philosophy

## What is Design Philosophy?
* The words "good" and "better" are subjective.
  * If you ask 100 Engineers if something is good, or if tools TF, P, or CDK are better.
  * Then you'll get inconsistent answers, because "good" and "better" are subjective.
* Philosophy, in this context, represents an explicitly defined criteria for good.
* The intent of documenting Easy EKS's Design Philosophy, is to:
  * Establish guiding principles, that can act as a "decision making north star",
    for decisions associated with the project.
    * This establishes a foundation for predictably consist justifications of:
      * Why each Project Goal's existance makes sense and is worth prioritizing pursuit.
      * ADRs (Architectural Decision Records)
    * The predictable consistency comes from the following:
      * If we ask 100 Engineers to evaluate if choices like TF, P, or CDK are "good" or
        "better", with respect to the Design Philosophy.
      * Then we could expect more consistent answers, because the question becomes less
        subjective.

## Easy EKS's Principles of Good Design
Each principle contains a few points of clarification.

### 1. Use solutions that genuinely simplify problems
* Solutions that are based on "software products" and "opinionated approaches" tend to
  be good, because they tend to genuinely simplify problems.
* Solutions that are based on tools, that lack an opinionated approach, or are more
  like a software library you could use to build a product, tend to be bad, because
  they tend to introduce new problems along side any problems they solve. Which can
  make things more complex.

### 2. Standardization
Standardization is a prerequisite for:
* IaC and Automation
* Comprehensive Documentation

### 3. Has affordable TCO (Total Cost of Ownership)
* FOSS (Free Open Source Software) can be more expensive than paid SaaS (Software as a
  Service), in terms of TCO, when hidden costs associated with adoption are relatively
  high.
* Common Hidden Costs: Training, figuring out how to come up with a secure
  implementation, integration complexity, hosting, and ongoing maintainence.
* FOSS is cheapest when Standardization, Infrastructure as Code, Automation, and Docs
  are packaged into a "software product" that's able to minimize the hidden costs.

### 4. Has Great UX (User Experience)
* A good UX similar to what you'd expect to find associated with a paid product, is a
  critical factor in predicting a project's adoption and long-term success.  
* I believe Ansible is more popular than Salt, Chef, and Puppet, because it's agentless
  approach makes it quick and easy to onboard to resulting in a better FTUX (First Time
  User Experience).
* I believe Kubernetes won the container wars against AWS's ECS, Docker's Swarm, and
  Apache's Mesos, primarily due to offering a better UX.
* A big Part of Kubernetes and Ansible's success is due to their great UX.
* Critical elements of a good user experience are:  
  * Intentional Product Onboarding:  
    That streamlines users ability to quickly and easily go from  
    zero prior knowledge --> learn the basics --> try it out --> basic proficiency -->
    experience a sense of value from using the product.
  * Quick and Easy to Learn, Setup, and Use thanks to best practices:  
    * Having high quality comprehensive docs that are well organized and searchable.
    * Minimizing or automating prerequisites.
    * Abstracting away and hiding complexity as much as practical.
    * Presenting an intuitive user interface and workflow.

### 5. Pragmatic Security Posture
* Aiming for as secure as possible can be a never ending rabbit hole (patch all the
  things, granular roles, advanced auditing, protecting from insider threats, etc.)
* Many advanced security practices have diminishing returns and tend to be overkill.
* A more pragmatic alternative to patching and securing all the things, is to:
  * Focus on perimeter security with based on layers of defense.
  * Focus on external threats, and have relatively lax security in terms of internal
    threats. Not perfect, yet practical and aligns with pareto principle.
