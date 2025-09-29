#!/bin/bash
# I just copy pasted this during testing
# Based on https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Container-Insights-setup-logs-FluentBit.html#ContainerInsights-fluentbit-volume

# Step 0: (prerequisite) Make sure EKS Worker Nodes have the right IAM role.
# Note: pod identity isn't a valid option, because a IPv6, IDMSv2, and fluentbit bug prevent pod identity association addon from working as of Sept 25, 2025


# Step 1: Make amazon-cloudwatch namespace
kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/cloudwatch-namespace.yaml

# Step 2: Multi Line Command to Edit, Copy, and Paste
# (It seems to collect and populate historic logs as well)
ClusterName=dev1-eks
RegionName=ca-central-1
FluentBitHttpPort='2020'
FluentBitReadFromHead='Off'
[[ ${FluentBitReadFromHead} = 'On' ]] && FluentBitReadFromTail='Off'|| FluentBitReadFromTail='On'
[[ -z ${FluentBitHttpPort} ]] && FluentBitHttpServer='Off' || FluentBitHttpServer='On'
kubectl create configmap fluent-bit-cluster-info \
--from-literal=cluster.name=${ClusterName} \
--from-literal=http.server=${FluentBitHttpServer} \
--from-literal=http.port=${FluentBitHttpPort} \
--from-literal=read.head=${FluentBitReadFromHead} \
--from-literal=read.tail=${FluentBitReadFromTail} \
--from-literal=logs.region=${RegionName} -n amazon-cloudwatch

# Step 3: Deploy CW Logs Daemonset
kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/refs/tags/k8s/1.3.37/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/fluent-bit/fluent-bit.yaml

# Checked CloudWatch -> Logs Insights (and saw it had new and historic logs)
