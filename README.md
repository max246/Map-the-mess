# 🗺️ Map the Mess

**Report litter. Map it. Clean it up. Together.**

## What Is This?

Map the Mess is a community-driven web platform where anyone in Britain can report litter they spot on the streets — snap a photo, drop a pin, and it goes on the map. Litter-picking volunteers can then browse the map, see hotspots, and plan cleanups where they're needed most.

Because clean streets shouldn't depend on the council noticing.

## How It Works

1. **📸 Report** — See litter? Open the app, take a photo, and pin the location
2. **🗺️ Map** — Every report appears on an interactive map showing litter hotspots
3. **🧹 Clean** — Volunteers browse the map, claim areas, and mark them as cleaned

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React (Vite), TailwindCSS, Leaflet.js, React Router |
| Backend | Python FastAPI, SQLAlchemy, PostgreSQL |
| Maps | Leaflet / OpenStreetMap |

## Features

- 📍 Interactive map with litter reports
- 📸 Photo upload with geolocation
- 🔍 Filter by status (pending / cleaned)
- 👷 Volunteer dashboard to plan cleanups
- 📱 Mobile-first responsive design

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

### Nginx proxy config

Custom per-host Nginx settings live in `proxy-conf/`. The file `proxy-conf/mapthemess.uk` sets `client_max_body_size 50m` to allow image uploads. This file is bind-mounted into the `nginx-proxy` container.

### Architecture

#### Local development (`docker-compose.yml`)

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

#### Production (`docker-compose.prod.yml`)

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

## Connect With Us

- [Facebook](https://www.facebook.com/profile.php?id=61577665256083)
- [GitHub](https://github.com/max246/Map-the-mess)

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-thing`)
3. Commit your changes (`git commit -m "Add my thing"`)
4. Push and open a PR

All contributions welcome — code, design, ideas, bug reports. Let's clean up Britain together. 🇬🇧

## License

MIT
