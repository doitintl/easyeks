The point of this implementation, is to provide a human friendly UX, in the scenario of someone wanting to easily modify this config.

Typescript logic will bundle the 5 config files into a configmap & deploy it

The AWS Docs
https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Container-Insights-setup-logs-FluentBit.html#ContainerInsights-fluentbit-volume
Offer Tips on modifying the config

AWS & CDK's normal implementation options doesn't make it easy to modify these files.
EasyEKS makes it easy to implement the above should anyone wish to do so. (95% of people probably won't need to though)
