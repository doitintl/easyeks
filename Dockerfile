FROM docker.io/node:20-bookworm-slim
# ^-- Dockerhub sourced base image is:
#     slim: size optimized
#     bookworm: debian 12 (current stable)
#     20: nodejs v20 (the long term support version)

RUN DEBIAN_FRONTEND=noninteractive TZ=Etc/UTC apt update -y && apt install -y \
    jq \
    awscli

WORKDIR /app
# ^-- configure default working directory

RUN groupadd user
RUN useradd --gid user user
# ^-- setup non-root user and group

COPY cdk.json package.json package-lock.json tsconfig.json /app
RUN npm install
ENV PATH="/app/node_modules/.bin:$PATH"
# ^-- package.json & package-lock.json tell npm install what dependencies to install
#     rebuild times are faster when rarely edited logic is put at the top
#     PATH update adds cdk to the path, so it becomes a recognized command.

COPY ./bin /app/bin
COPY ./lib /app/lib
COPY ./config /app/config
# ^-- copy dependencies

RUN chown --recursive user:user /app
USER user
# ^-- update permissions and default user.

CMD ["sleep", "infinity"]
# ^-- This image is meant to be used locally with an interactive shell.
