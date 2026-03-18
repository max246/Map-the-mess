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
