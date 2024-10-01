Start with Loki:
https://grafana.com/docs/loki/latest/setup/install/helm/install-monolithic/
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update grafana

helm search repo grafana | egrep "CHART|loki "
helm upgrade --install loki grafana/loki --version=6.10.0 --values=loki.helm-values.yaml --namespace=monitoring --create-namespace=true
===========================
Kube Prom Stack:
https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm search repo grafana | egrep "CHART|kube-prom"
helm upgrade --install kps prometheus-community/kube-prometheus-stack --version=61.9.0 --values=kps.helm-values.yaml --namespace=monitoring --create-namespace=true
helm upgrade --install kps oci://registry-1.docker.io/bitnamicharts/kube-prometheus --version=9.6.2 --values=kps.helm-values.yaml --namespace=monitoring --create-namespace=true
===========================
