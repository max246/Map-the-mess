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
| Backend | Python FastAPI, SQLAlchemy, Alembic, PostgreSQL |
| Auth | JWT (access + refresh tokens), bcrypt, email verification |
| Maps | Leaflet / OpenStreetMap, Nominatim reverse geocoding, what3words |
| Infra | Docker, nginx-proxy, Let's Encrypt (ACME), Watchtower |
| Testing | Jest, Playwright, pytest |
| API Client | Orval (auto-generated from OpenAPI spec) |

## Features

### Reporting & Map
- 📍 Interactive map with litter reports (Leaflet / OpenStreetMap)
- 🔥 Heatmap view — toggle between pin markers and a density heatmap to spot litter hotspots at a glance
- 📸 Photo upload with geolocation, auto-thumbnails, and Full-HD optimisation
- 🔍 Filter by status (pending / cleaned / stale / favourites) and report type (litter / gas canister)
- ⏰ Stale-report detection — reports with no activity for 30 days are flagged on the timeline and surfaced via an amber pin on the map; any registered user can clear the flag with "I'm on it"
- 🏷️ Report types — categorise reports as litter or gas canister
- ✏️ Edit reports — update description, type, what3words, and manage images (owner / moderator / admin)
- 🖼️ Image management — add extra photos to existing reports or delete individual images
- ⭐ Favourite reports — bookmark reports and view them in the volunteer dashboard
- 🔁 Reopen reports — mark a cleaned report as still dirty, with optional photo proof
- 📜 Status timeline — visual history of report lifecycle (created, cleaned, reopened, stale, in-progress) with per-cycle photo galleries
- 💬 Report comments — logged-in users can discuss open reports; paginated, newest first
- 🏠 Reverse geocoding — reports automatically get a human-readable address
- 🔤 what3words integration for precise location sharing
- 📤 Export reports — download all reports as JSON from the volunteer dashboard

### Communities
- 🏘️ Create and join local cleanup communities
- 🔍 Search communities by name or find nearby communities by location
- 📝 Community posts with Markdown support
- 📅 Cleanup events with meeting points, linked reports, and map view
- 🔁 Recurring events — weekly, biweekly, or monthly recurrence with optional end date
- 📆 Save to calendar — download events as .ics or open directly in Google Calendar
- 👥 Membership workflow — request to join, owner approves/rejects
- 🖼️ Community profile images
- 🔄 Transfer ownership — community owners (and admins/moderators) can transfer ownership to an approved member
- 🗑️ Community deletion — owners, moderators, and admins can delete a community
- 🏆 Community leaderboard — members ranked by reports cleaned
- 📑 Tabbed community page — Main (events & posts), Members, and Leaderboard tabs

### Volunteers
- 👷 Volunteer dashboard to plan cleanups and manage favourites
- 🏆 Leaderboard ranking volunteers by reports cleaned
- 🎖️ Badge system — earn badges for reporting, cleaning, and loyalty
- 👤 Public volunteer profiles
- ❌ Account deletion — users can delete their own account (with confirmation), must transfer community ownership first if they own one

### Auth & Admin
- 🔐 Registration with email verification, password reset, JWT auth with refresh tokens
- 🟦 Sign in with Google — auto-merges with an existing verified password account on the same email; new social-only users are created verified and can later add a password
- 👮 Role-based access — superuser, admin, moderator, volunteer
- 🛠️ Admin panel for managing reports, users, and communities
- 🆔 UUID-based IDs to prevent enumeration

### General
- 📱 Progressive Web App (PWA) — installable, offline-capable with service worker caching for map tiles, images, and API data
- 📴 Offline report submission — reports are queued in IndexedDB and automatically synced when back online
- 📱 Mobile-first responsive design
- 🔗 Share button — share reports, communities, events, and leaderboards via link, Facebook, or X
- 🔒 Nginx version hiding (`server_tokens off`)
- 📄 Static pages — disclaimer, privacy policy, contact, litter facts
- 🧹 Recommended tools page — curated litter-picking equipment with ratings

## Getting Started

See [DEVELOPMENT.md](DEVELOPMENT.md) for full setup instructions, architecture diagrams, and deployment guides.

**Quick start with Docker:**

```bash
cp .env.example .env   # edit with your secrets
docker compose up --build
```

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:3000       |
| Backend  | http://localhost:8000       |
| API Docs | http://localhost:8000/docs  |

## Connect With Us

- Email: info@mapthemess.uk
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
