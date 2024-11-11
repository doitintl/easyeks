FROM ubuntu:24.10
RUN DEBIAN_FRONTEND=noninteractive TZ=Etc/UTC apt update -y && apt install -y \
    git \
    jq \
    nodejs \
    npm \
    awscli
RUN npm update -g && npm install -g aws-cdk@2.147.3
