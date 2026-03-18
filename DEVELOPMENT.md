# Development Guide

## CI/CD: Automated Docker Image Releases

When you publish a GitHub release from `main`, a GitHub Actions workflow automatically builds and pushes Docker images to Docker Hub, tagged as both `latest` and the release tag (e.g. `v1.0.0`).

### Setup (one-time)

1. Create a Docker Hub access token at https://hub.docker.com/settings/security (Read & Write permissions)
2. Add these secrets to your GitHub repo under **Settings → Secrets and variables → Actions**:
   - `DOCKERHUB_USERNAME` — your Docker Hub username 
   - `DOCKERHUB_TOKEN` — the access token from step 1

### How it works

- The workflow is defined in `.github/workflows/release.yml`
- It triggers on release publish events
- Builds both `max246/map-the-mess-backend` and `max246/map-the-mess-frontend` images
- Pushes them to Docker Hub with two tags: `latest` and the release tag
- The frontend build passes `VITE_API_URL=https://api.mapthemess.uk` as a build argument

## Dev Environment (develop branch)

When a PR is merged into the `develop` branch, a GitHub Actions workflow automatically builds and pushes Docker images tagged as `develop`.

### How it works

- The workflow is defined in `.github/workflows/develop.yml`
- It triggers on every push to `develop`
- Builds both images with the `develop` tag (e.g. `max246/map-the-mess-backend:develop`)
- The frontend is built with `VITE_API_URL=https://api.dev.mapthemess.uk`
- The backend version is set to `develop-<commit-sha>`
- Watchtower on the dev EC2 auto-pulls new images within 5 minutes

### Dev EC2 setup

1. Spin up an EC2 instance
2. Install Docker and Docker Compose (see README for commands)
3. Copy `docker-compose.dev.yml`, `proxy-conf/`, and `.env` to the instance
4. Run `docker login -u max246` with a Docker Hub access token
5. Start with `docker compose -f docker-compose.dev.yml up -d`

### DNS

Add two A records in Route 53 pointing to the dev EC2 Elastic IP:

| Type | Name                    | Value              |
|------|-------------------------|--------------------|
| A    | `dev.mapthemess.uk`     | Dev EC2 Elastic IP |
| A    | `api.dev.mapthemess.uk` | Dev EC2 Elastic IP |
