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

1. Copy the example env file and set your secrets:

```bash
cp .env.example .env
# Edit .env with your own values (especially SECRET_KEY and POSTGRES_PASSWORD)
```

2. Start everything:

```bash
docker compose up --build
```

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:3000       |
| Backend  | http://localhost:8000       |
| API Docs | http://localhost:8000/docs  | Only available when `DEBUG=true` |
| Postgres | localhost:5432              |

### Manual setup

#### Frontend

```bash
cd frontend
cp .env.example .env.development
# Edit .env.development with your what3words API key
npm install
npm run dev
```

Runs on `http://localhost:5173`

#### Backend

```bash
cd backend
cp .env.example .env  # edit with your DB credentials
pip install -r requirements.txt
uvicorn main:app --reload
```

Runs on `http://localhost:8000`

See [backend/README.md](backend/README.md) for more details.

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

Custom per-host Nginx settings live in `proxy-conf/`. The file `proxy-conf/api.mapthemess.uk` sets `client_max_body_size 50m` for the API to allow image uploads. This file is bind-mounted into the `nginx-proxy` container.

### Architecture

```
                    ┌─────────────────┐
                    │   nginx-proxy   │ ← ports 80/443, SSL termination
                    │ + acme-companion│ ← auto Let's Encrypt certs
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │                             │
    mapthemess.uk               api.mapthemess.uk
              │                             │
     ┌────────▼────────┐          ┌─────────▼─────────┐
     │    frontend     │          │     backend        │
     │  (nginx + SPA)  │          │   (FastAPI:8000)   │
     └─────────────────┘          └─────────┬──────────┘
                                            │
                                   ┌────────▼────────┐
                                   │   db (postgres)  │
                                   └─────────────────┘
```

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
