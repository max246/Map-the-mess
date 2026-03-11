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

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`

### Backend

```bash
cd backend
cp .env.example .env  # edit with your DB credentials
pip install -r requirements.txt
uvicorn main:app --reload
```

Runs on `http://localhost:8000`

See [backend/README.md](backend/README.md) for more details.

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-thing`)
3. Commit your changes (`git commit -m "Add my thing"`)
4. Push and open a PR

All contributions welcome — code, design, ideas, bug reports. Let's clean up Britain together. 🇬🇧

## License

MIT
