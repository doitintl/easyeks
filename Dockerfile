FROM docker.io/node:22-bookworm-slim
# ^-- Dockerhub sourced base image is:
#     slim: size optimized
#     bookworm: Debian 12 (current stable)
#     22: nodejs v22 (the long term support version as of Nov 2024)

RUN DEBIAN_FRONTEND=noninteractive TZ=Etc/UTC apt update -y && apt install -y \
    jq awscli \
    python3 libcurl4-openssl-dev build-essential git \
    apt-transport-https ca-certificates curl gnupg
# ^-- jq awscli: Represent EasyEKS dependencies.
#     python3, etc: Fix a Debian specific dependency issue related to npm install sync-request-curl
#     apt-transport-https, etc: Help get kubectl 

# https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/#install-using-native-package-management
RUN curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.33/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
RUN echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.33/deb/ /' | tee /etc/apt/sources.list.d/kubernetes.list
RUN DEBIAN_FRONTEND=noninteractive TZ=Etc/UTC apt update -y && apt install -y kubectl
RUN echo 'alias k=kubectl' | tee -a /root/.bashrc
# ^-- install kubectl

ENV AWS_PAGER=""
# ^-- fixes https://stackoverflow.com/questions/57953187/aws-cli-has-no-output

WORKDIR /app
# ^-- configure default working directory

COPY cdk.json cdk.context.json package.json package-lock.json tsconfig.json /app
RUN npm install
ENV PATH="/app/node_modules/.bin:$PATH"
# ^-- package.json & package-lock.json tell npm install what dependencies to install
#     rebuild times are faster when rarely edited logic is put at the top
#     PATH update adds cdk to the path, so it becomes a recognized command.

RUN echo "update-notifier=false" | tee /root/.npmrc
# ^-- Get's rid of an ignorable notice about available updates. 
#     Pinned versions are better than latest for stablity.
RUN echo 'export PS1="\[\e[38;5;226m\]\u\[\e[38;5;196m\]@\[\e[38;5;214m\]\h\e[38;5;196m\]:\[\e\[\e[38;5;14m\]\w \[\033[0m\]$ "' | tee -a /root/.bashrc
# ^-- pretty prompt

COPY ./bin /app/bin
COPY ./lib /app/lib
COPY ./config /app/config
# ^-- copy dependencies

CMD ["sleep", "infinity"]
# ^-- This image is meant to be used locally with an interactive shell.
# NOTE: root user is purposefully used for the sake of UX of an interactive shell.
