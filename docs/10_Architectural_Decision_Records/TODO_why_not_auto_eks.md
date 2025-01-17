I suspect people are curious about auto eks, got my first ticket for it, it's basically very similar to GKE Autopilot in terms of pros and cons.

pro:
* managed karpenter.sh, core dns, vpc cni

ambivalent:
* Like GKE auto pilot it adds cost (It's a variable tax per node, but as a rule of thumb think $6/month for a large instance. (price scales for bigger instance sizes)).
* That said a 100 node large cluster would only add $600/month, let's say that an 8 hour day for an engineer could be ~$600, + not having to write IaC and automation to setup karpenter, and not having to spend 8 hours to maintain it. I'd say In most cases of small-medium clusters (<100 large nodes), it could  pay for itself. (but 100 nodes is a good threshold rule of thumb for the cut off since 100 large nodes would cost $7.2k/year, enough to consider investing engineering time into making it go away.)
* You can switch back and forth between EKS auto on and EKS auto off. (This is good, but I fear this could cause problems in the form of edge cases that are hard to predict and hard to test.)

cons:
* EKS becomes a black box (kubectl get pod --all-namespaces --> 0 pods running but everything works)
* That means karpenter, coredns vpc cni are running but now you can no longer see them.
* You can't see karpenter logs! (I've had to debug karpenter in edge cases and access to those logs were key)
* You can't ssh to a auto managed node
* If/When something goes wrong you'll either be at the mercy of AWS support, which can be relatively long resolution time, or end up turning off auto mode, which if untested could be worrysome. (I suspect it'd only be safe to turn off in scenarios were you never needed it in the first place.)

EasyEKS is meant for efficiency at scale. (including FinOps)
AutoEKS adds cost, so EasyEKS won't be implementing it. (Also it's blackbox nature could make debugging harder.)