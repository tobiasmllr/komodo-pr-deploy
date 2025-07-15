# komodo-pr-deploy

This Github Action and the provided deploy script can be used to automatically deploy pull requests to a komodo server and publishing the branches to https://PORTXY.example.com for testing development builds. Komodo, Pangolin, and the Docker registry can be self-hosted.

The action requires the `docker/komodo-cli.Dockerfile` to be built and pushed to your docker registry as `komodo-cli:latest` (see below).

My aim is to provide a template to use and adapt within your own self-hosting centered projects. Please read all provided scripts carefully and understand what each step does. Read the docs of the linked projects to understand how to set up the required components.

Be responsible and carefully configure each service to your needs. Especially the Pangolin server requires some reading to understand how to set up the domain and server correctly and securely.

**disclaimer**: I used Claude Code to help write the Github action and deploy script, recognizable by the heavy icon use. I wrote this readme myself, reviewed all code, and tested the setup extensively.

## Requirements

-   A [komo.do](https://komo.do) server to manage docker containers and builds
-   A [Pangolin](https://docs.fossorial.io/Getting%20Started/overview) server to publish the builds (self-hosted tunneled reverse proxy with identity and access management).
-   A Docker image registry, e.g. [Distribution](https://hub.docker.com/_/registry) to store the docker images

## Configuration

-   **komodo**: Generate an API key and secret in the Komodo server settings. Connect a server for building and deploying the docker images.
-   **pangolin**: Create a Pangolin server and generate an API token.
    -   Configure your domain as wildcard ([see docs](https://docs.fossorial.io/Pangolin/Configuration/wildcard-certs)) (e.g., `*.example.com`) and create an organization and site for the project.
    -   Enable the Integration API ([see docs](https://docs.fossorial.io/Pangolin/API/integration-api))
    -   Generate an API token with required permissions. `Site: Get Site, List Sites`, `Organization: List Organization Domains`,`Resouce: Allow All`, `Target: Allow All`, `Resource Rule: Allow All`
-   **docker registry**: Set up a Docker registry to store the docker images. Generate a username and password for authentication ([see docs](https://distribution.github.io/distribution/about/configuration/#htpasswd)).

### Github secrets

`REPO_NAME`, `GITHUB_TOKEN` and `GIT_ACCOUNT` should be provided to Github actions by default. The following secrets are required to be manually configured in the repository settings:

-   Komodo:
    -   `KOMODO_URL`: The URL of your Komodo server (e.g., `https://komodo.example.com`)
    -   `KOMODO_API_KEY`: The API key for your Komodo server
    -   `KOMODO_API_SECRET`: The API secret for your Komodo server
    -   `KOMODO_SERVER_ID_BUILD`: The name of the server to use for building the Docker images
    -   `KOMODO_SERVER_ID_DEPLOY`: The name of the server to use for deploying the Docker images
-   Pangolin:
    -   `PANGOLIN_URL`: The URL of your Pangolin server (e.g., `https://pangolin.example.com`)
    -   `PANGOLIN_API_TOKEN`: The API token for your Pangolin server
    -   `PANGOLIN_DOMAIN_ID`: The domain ID for your Pangolin server
    -   `PANGOLIN_ORG_ID`: The organization ID for your Pangolin server
    -   `PANGOLIN_SITE_ID`: The site ID for your Pangolin server
-   Docker Registry:
    -   `DOCKER_REGISTRY`: The URL of your Docker registry (e.g., `https://docker.example.com`)
    -   `DOCKER_USERNAME`: The username for your Docker registry
    -   `DOCKER_PASSWORD`: The password for your Docker registry
-   Build and Project specific secrets:
    -   `DOCKER_IMAGEBASENAME`: The base name for your Docker image

### Local env variables

There are two env var files required. `.env` and `docker.env`. The first one is used by the deploy script and the second one is used by the komodo server to build and deploy the docker images.

-   Create a `.env` file based on `.env.example` to run the deploy script locally. The same secrets are configured in the repository settings to be accessible by the Github Action.
-   Create an `docker.env` file based on `docker.env.example`The args in `docker.env` are used to build the docker image in komodo and also provide the environment variables for the docker deployment. Note: `[[KOMODO_SECRET]]` can be used to pass through variables defined in the komodo server.

### Github Action settings

The action is configured to run on pull requests to `dev` and `main`, as long as the source branch is not `main` or `dev`. So only feature branches will trigger the action. Deployments for `main` and `dev` branches should likely be handled differently with manually configured pangolin and komodo settings. Also deployment webhooks ([see komodo docs](https://komo.do/docs/webhooks)) can be set up for these that don't use up Github Action minutes.

## Usage

### build and push komodo-cli image

I pre-build the docker image for the komodo-cli to save that time building a client for komodo. You could add this as a step in Github actions if you don't want to use your own registry.

```bash
source .env
docker login $DOCKER_REGISTRY -u $DOCKER_USERNAME
docker build -f docker/komodo-cli.Dockerfile -t $DOCKER_REGISTRY/komodo-cli:latest .
docker push $DOCKER_REGISTRY/komodo-cli:latest
```

### Github Action

To use the Github Action, copy the `komodo-pr-deploy.yml` file to your `.github/workflows` directory in your repository.

### Run script locally

You can run the deploy script locally for a branch of another github project by adjusting `.env` and `docker.env` files, and installing the dependencies with `npm install dotenv komodo_client`.

```bash
node deploy.mjs <branch-name> --build
```
