# Development & Deployment Guide

Full setup, architecture, and deployment documentation for Map the Mess.

## Getting Started

### Docker (recommended)

The quickest way to get the full stack running locally:

1. Copy the example env file and set your secrets:

```bash
cp .env.example .env
# Edit .env with your own values (especially SECRET_KEY and POSTGRES_PASSWORD)
```

2. Start everything:

```bash
docker compose up --build
```

This builds both the frontend and backend from source, starts a PostgreSQL database, runs Alembic migrations, and serves the app.

| Service  | URL                        | Notes |
|----------|----------------------------|-------|
| Frontend | http://localhost:3000       | nginx serving the built SPA |
| Backend  | http://localhost:8000       | FastAPI with auto-reload |
| API Docs | http://localhost:8000/docs  | Only available when `DEBUG=true` |
| Postgres | localhost:5433             | Mapped to 5433 to avoid clashing with a local Postgres |

To tear down and remove volumes:

```bash
docker compose down -v
```

### Manual setup (for development)

For day-to-day development you'll typically run the frontend and backend separately so you get hot-reload on both.

#### Prerequisites

- Node.js 20+
- Python 3.12+
- PostgreSQL 16 (or use the Docker database: `docker compose up db`)

#### Database

If you don't have a local PostgreSQL, you can start just the database container:

```bash
docker compose up db
```

This gives you a PostgreSQL instance on `localhost:5433` initialised from `db/init.sql`.

#### Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL to point at your Postgres instance
# e.g. DATABASE_URL=postgresql://mapuser:mappass@localhost:5433/mapthemess

pip install -r requirements.txt
alembic upgrade head          # run migrations
uvicorn main:app --reload     # start with hot-reload
```

Runs on `http://localhost:8000`. Set `DEBUG=true` in `.env` to enable the interactive API docs at `/docs`.

See [backend/README.md](backend/README.md) for more details.

#### Frontend

```bash
cd frontend
cp .env.example .env.development
# Edit .env.development with your what3words API key

npm install
npm run dev
```

Runs on `http://localhost:5173` with Vite hot-reload. The dev server proxies API requests to the backend automatically via `VITE_API_URL`.

#### Available frontend scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript check + production build |
| `npm run test` | Run Jest unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format code with Prettier |
| `npm run api:generate` | Regenerate typed API client with Orval |

### Dev seed script

A CLI tool for quickly setting up local development data. Run from the `backend/` directory (or inside the backend container):

```bash
cd backend

python utils/dev_seed.py users          # create 5 random verified volunteers (prints email + password)
python utils/dev_seed.py wipe-reports   # delete all reports and their images
python utils/dev_seed.py wipe-users     # delete all users except the superuser
python utils/dev_seed.py reset          # wipe everything, then seed fresh users
python utils/dev_seed.py users --count 10   # create a custom number of users
```

Or via Docker:

```bash
docker compose exec backend python utils/dev_seed.py reset
```

### API client generation

The frontend uses [Orval](https://orval.dev) to generate a typed API client from the backend's OpenAPI schema. After making backend changes, regenerate with:

```bash
cd backend
python utils/export_openapi.py
cp openapi.json ../frontend/

cd ../frontend
npm run api:generate
```

Generated files live in `frontend/src/api/` and should not be edited by hand.

## Frontend Environment

The frontend uses Vite environment files to configure the API URL:

- `.env.development` — used during `npm run dev`, points to `http://localhost:8000`
- `.env.production` — used during `npm run build`, points to `https://api.mapthemess.uk`

The `VITE_API_URL` variable controls which API base URL the frontend talks to. Vite bakes this in at build time.

---

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

## Production Deployment

### Pushing Docker images

Run the script from the project root:

```bash
./push-images.sh
```

This builds, tags, and pushes the frontend and backend images to Docker Hub under `max246/map-the-mess-backend` and `max246/map-the-mess-frontend`.

### Deploying on EC2

1. Copy `docker-compose.prod.yml`, the `proxy-conf/` directory, and your `.env` file to the EC2 instance.

2. Install Docker and Docker Compose:

   ```bash
   sudo yum install -y docker
   sudo systemctl enable --now docker
   sudo usermod -aG docker $USER
   # Log out and back in
   sudo mkdir -p /usr/local/lib/docker/cli-plugins
   sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
     -o /usr/local/lib/docker/cli-plugins/docker-compose
   sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
   ```

3. Start the services:

   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

### DNS (Route 53)

Add two A records in AWS Route 53 pointing to your EC2 Elastic IP:

| Type | Name                | Value          |
|------|---------------------|----------------|
| A    | `mapthemess.uk`     | EC2 Elastic IP |
| A    | `api.mapthemess.uk` | EC2 Elastic IP |

### SSL (Let's Encrypt)

SSL is handled automatically by the `nginx-proxy` and `acme-companion` containers in `docker-compose.prod.yml`. Certificates are requested and renewed automatically for both `mapthemess.uk` and `api.mapthemess.uk`.

### EC2 Security Group

Ensure inbound rules allow:

| Port | Protocol | Source     |
|------|----------|------------|
| 80   | TCP      | 0.0.0.0/0 |
| 443  | TCP      | 0.0.0.0/0 |

### Updating the deployment

After pushing new images:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

To fully recreate containers (e.g. after config changes):

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

To clean up old images on EC2:

```bash
docker system prune -a -f
```

### Password protecting the dev site

The dev environment is behind basic auth. The htpasswd file is not committed to git — you need to create it manually on the dev EC2:

```bash
echo -n '<username>:' > proxy-conf/htpasswd.dev && openssl passwd -apr1 '<password>' >> proxy-conf/htpasswd.dev
```

Then restart nginx-proxy:

```bash
docker compose -f docker-compose.dev.yml up -d nginx-proxy
```

## Architecture

### Local development (`docker-compose.yml`)

```
     ┌──────────────────┐        ┌───────────────────┐
     │    frontend       │        │     backend        │
     │  (nginx + SPA)    │───────▶│   (FastAPI)        │
     │  localhost:3000   │        │  localhost:8000    │
     └──────────────────┘        └────────┬───────────┘
                                          │
                                 ┌────────▼────────┐
                                 │  db (postgres)   │
                                 │  localhost:5433  │
                                 └─────────────────┘
                                          │
                              volumes: pgdata, ./data/images
```

- **db** — PostgreSQL 16 Alpine, initialised from `db/init.sql`, data in a named volume
- **backend** — Built from `./backend`, runs Alembic migrations on startup, stores uploads in `./data/images`
- **frontend** — Built from `./frontend` (multi-stage: Node build → nginx), serves the SPA on port 3000

### Production (`docker-compose.prod.yml`)

```
                    ┌──────────────────┐
                    │   nginx-proxy    │ ← ports 80/443, SSL termination
                    │ + acme-companion │ ← auto Let's Encrypt certs
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │                             │
    mapthemess.uk               api.mapthemess.uk
              │                             │
     ┌────────▼────────┐          ┌─────────▼──────────┐
     │    frontend      │          │     backend         │
     │  (nginx + SPA)   │          │   (FastAPI:8000)    │
     └─────────────────┘          └─────────┬───────────┘
                                            │
                                   ┌────────▼────────┐
                                   │   db (postgres)  │
                                   └─────────────────┘
                                            │
              ┌─────────────────────────────┼─────────────────────┐
              │                             │                     │
     ┌────────▼────────┐          ┌─────────▼─────────┐ ┌────────▼────────┐
     │   db-backup      │          │    watchtower      │ │  ./data/images  │
     │ hourly snapshots │          │ auto-pull new tags │ │  upload storage │
     └─────────────────┘          └───────────────────┘ └─────────────────┘
```

- **nginx-proxy** — Reverse proxy routing by `VIRTUAL_HOST`, with `CLIENT_MAX_BODY_SIZE: 50m` for uploads
- **acme-companion** — Automatic Let's Encrypt certificate provisioning and renewal
- **db-backup** — Hourly PostgreSQL dumps, retained 24h/7d/4w in `./data/db-backups`
- **watchtower** — Polls Docker Hub every 5 minutes and auto-deploys new image tags (label-gated)

