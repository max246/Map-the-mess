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

## Superuser Password

The `SUPERUSER_PASSWORD` env var expects a bcrypt hash, not a plain text password. To generate one:

```bash
cd backend
python utils/hash_password.py "your-password-here"
```

Copy the output and set it in your `.env` file:

```
SUPERUSER_PASSWORD=$2b$12$...the-hash...
```

If the superuser already exists in the database, you'll need to delete the existing record for it to be re-created with the new hash on next startup.

## Dev Environment (develop branch)

When a PR is merged into the `develop` branch, a GitHub Actions workflow automatically builds and pushes Docker images tagged as `develop`.

### How it works
- The workflow is defined in `.github/workflows/develop.yml`
- It triggers on every push to `develop`
- Builds both images with the `develop` tag (e.g. `max246/map-the-mess-backend:develop`)
- The frontend is built with an empty `VITE_API_URL` (uses relative URLs via the frontend nginx proxy)
- The backend version is set to `develop-<commit-sha>`
- Watchtower on the dev EC2 auto-pulls new images within 5 minutes


### Dev EC2 setup

1. Spin up an EC2 instance
2. Install Docker and Docker Compose (see README for commands)
3. Copy `docker-compose.dev.yml`, `proxy-conf/`, and `.env` to the instance
4. Run `docker login -u max246` with a Docker Hub access token
5. Start with `docker compose -f docker-compose.dev.yml up -d`

### DNS

Add an A record in Route 53 pointing to the dev EC2 Elastic IP:

| Type | Name                | Value              |
|------|---------------------|--------------------|
| A    | `dev.mapthemess.uk` | Dev EC2 Elastic IP |

## Nginx Proxy Configuration

Upload size limits are configured at two levels:

1. **Frontend nginx** (`frontend/nginx.conf`) — `client_max_body_size 50m` for proxying to the backend
2. **nginx-proxy** (per-vhost config in `proxy-conf/`) — `client_max_body_size 50m` to allow large uploads through the reverse proxy

Per-vhost config files in `proxy-conf/` are mounted into the nginx-proxy container:
- `proxy-conf/mapthemess.uk` — production
- `proxy-conf/dev.mapthemess.uk` — dev

If you get `413 Content Too Large` errors, check both levels are configured.

### Password protecting the dev site

The dev environment is behind basic auth. The htpasswd file is not committed to git — you need to create it manually on the dev EC2:

```bash
echo -n '<username>:' > proxy-conf/htpasswd.dev && openssl passwd -apr1 '<password>' >> proxy-conf/htpasswd.dev
```

Then restart nginx-proxy:

```bash
docker compose -f docker-compose.dev.yml up -d nginx-proxy
```

