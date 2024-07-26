// TO DO:
// * make a helm / kustomize inspired UX
//   kustomize like by supporting a baseline, sandbox, dev, stage, prod style input parameter setup.
//   helm like by separating logic into:
//   * input values.yaml files consumer's of this repo would mess with
//   * input variable inheritance (sandbox, dev, stage, prod) (would inherit from baseline)
//     makes cognitive complexity easier to manage, and it'd be intuitive that you could edit baseline.
//   * the underlying logic that has sensible defaults that 99% of users won't want nor need to mess with
//     convention > configuration: sane and sensible defaults, 1% that needs to edit can fork, like helm charts
//
//   * logically separate: 
//     * generic baseline input parameter's that multiple orgs might share
//     * org specific baseline input parameter's
//     
// Basically have well organized config, code, etc. that makes stuff intuitively obvious, where to look for stuff
// what you might want to mess with, ignore etc. (like helm and kustomize do) 
// (so introduce conventions that make intuitive sense, and result in great FTUX.)
// I want to make it so a FTUX doesn't need to know/understand JS/TS / abstract away as much complexity
// as possible to allow them to optionally learn it, or treat it as JFM.
//
// I also wounder if I should divide the logic into 3 phases
// phase 1: pre-requisite provision, validation, etc.
// phase 2: cluster provision
// phase 3: workload deploy
// 
// hum maybe make an EKS_Inputs class / type that's basically an array, then could do array as a parameter?