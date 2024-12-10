## Project Goals
* Create an standardized opinionated batteries included experience that 98% of users would happily use
  with minimal modifications.
  * convention over configuration
  * use sane, sensible, justifed defaults to prevent creation of needless toil based work.
* Real Production Grade Projects use multiple clusters, (N-test, N-dev, N-stage, N-prod, ci, etc.)
* Easy and Intuitive UX
  * FTUX:
    * can try / test in under and hour (45min understanding / setup + 15 min automation)
    * solid dev cluster within a day
    * Solid Onboarding Docs and Advice
      * Phased adoption/onboarding with next steps that leverage best practices
      * Secrets management advance and example.
      * Advantages of practice of keeping cluster infra mgmt and workload deploy mgmt as 2 logically
        seperate phases, using different tooling. 
      * (Advise only using this for managing cluster's baseline infra)
  * Well organized config, code, and docs:
    * Be helm / kustomize like in that it should be intuitively obvious where to look for stuff you
      might want to edit/mess with. And it should be intuitive obvious what stuff you want to ignore.
      Most users ignore the helm chart's golang templating as implementation detail used to hide / 
      abstract away complexity. So they know they can ignore it and free up the cognitive overhead.
      Most of the TypeScript code should be treated that way. 
    * Like how helm users can use it w/o understanding that complexity  
      user's shouldn't need to know or understand specialised JS/TS knowledge to use this.
* Be beginner friendly:
  * Detailed Code Comments:
    * Excessive Code Comments are bad when code is intended to be used by experienced developers.
    * This is a different scenario, here end users may have little to no prior experience with
      JS/TS, and already have a ton of work to do, and things to learn.
    * Solutions that only create more work or trade N problem(s) in exchange for P solution(s) should
      be questioned. This decision minimizes problems created (in the form of training/skill level).
  * Avoid Fancy programming in favor of KIS (keep it simple), intuitive, readable, and code that
    someone with little to no prior knowledge would find easy to read and understand, by the curious.
    There are times I know a fancy TypeScript way of shorterning the code, and purposefully don't do
    it, as I think a longer or alternative way would be easier for a beginner to read.
  * Abstract away complexity

* High level goal of all EasyEKS ADRs is to implement an opinionated approach fully of features that
  90% of EKS users would want or at least not mind having. 
