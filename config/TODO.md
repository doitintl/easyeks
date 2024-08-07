# TO DO:
* make a helm / kustomize inspired UX
  kustomize like by supporting a baseline, sandbox, dev, stage, prod style input parameter setup.
  helm like by separating logic into:
  * input values.yaml files consumer's of this repo would mess with
  * input variable inheritance (sandbox, dev, stage, prod) (would inherit from baseline)
    makes cognitive complexity easier to manage, and it'd be intuitive that you could edit baseline.
  * last min customizations needed to make N test environments / multiple instances of an environment would be useful.  
  * the underlying logic that has sensible defaults that 99% of users won't want nor need to mess with
    convention > configuration: sane and sensible defaults, 1% that needs to edit can fork, like helm charts
  * logically separate: 
    * generic baseline input parameter's that multiple orgs might share
    * org specific baseline input parameter's
    
Basically have well organized config, code, etc. that makes stuff intuitively obvious, where to look for stuff
what you might want to mess with, ignore etc. (like helm and kustomize do) 
(so introduce conventions that make intuitive sense, and result in great FTUX.)
I want to make it so a FTUX doesn't need to know/understand JS/TS / abstract away as much complexity
as possible to allow them to optionally learn it, or treat it as JFM.
I also wounder if I should divide the logic into 3 phases
phase 1: pre-requisite provision, validation, etc.
phase 2: cluster provision
phase 3: workload deploy

hum maybe make an EKS_Inputs class / type that's basically an array, then could do array as a parameter?

## Plan to do .yaml and .ts config
hum... there are times when TS can help autocomplete a good value
      and times when it can't
      I can use a yaml config file during the times when TS can't help?
      Then I can use a config.ts file during the times when TS can help?

---

## Question of which is best...
### Option 1: 
/config/
baseline.yaml  <-- for config that TS can't help validate / needs to be fed in by a human and readable.
                   ^-- would add complexity of needing type interface & 2 config files
baseline.ts    <-- for config that TS can help validate

### Option 2:
/config/
baseline.ts    <-- for both config types

### Decision / Choice made
* I'll go with option 2. I started with it, but I initially abandoned it due to it getting messy
  it looked too much like code with TS specific nuances. When I wanted it to look like easy to read config.
* That was a coding style problem, going to adopt a new style in line with blueprints.
* A problem I ran into was I was trying to pass all parameters in at construction time.
* I'll follow the blueprints patterns where you add a little config here, a little config there
  and slowly construct the object, via methods to set / append values.
  (that's basically the blueprints programming design pattern for constructing these objects / populating config)
  (I'll just wrap it to simplify it / abstract away complexity.)

---

hum... I have idea of 
sane defaults used by 95% of users
Then org/project defaults


