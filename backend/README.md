# Map the Mess — Backend

FastAPI backend for the litter reporting platform.

## Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database credentials and superuser settings

# Run the server
uvicorn main:app --reload
```

API docs available at `http://localhost:8000/docs`

## Superuser

A superuser account is automatically created on first startup using environment variables. The superuser has full admin privileges and cannot be deleted via the API.

| Variable | Description | Default |
|----------|-------------|---------|
| `SUPERUSER_EMAIL` | Email for the superuser account | _(required)_ |
| `SUPERUSER_PASSWORD` | Password for the superuser account | _(required)_ |
| `SUPERUSER_FULL_NAME` | Display name | `Super User` |

If `SUPERUSER_EMAIL` or `SUPERUSER_PASSWORD` are not set, superuser creation is skipped.

When using Docker Compose, set these in your root `.env` file — they are passed through to the backend service.

## Images

Uploaded images are saved to the `images/` folder in the backend root directory. This folder is created automatically on startup and is excluded from git.

Images are served via `GET /api/reports/images/{filename}`. When a report is deleted, its image files are removed from disk.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports/` | List all reports |
| GET | `/api/reports/{id}` | Get a single report |
| POST | `/api/reports/` | Create a report |
| PATCH | `/api/reports/{id}/clean` | Mark as cleaned |
| POST | `/api/auth/register` | Register (placeholder) |
| POST | `/api/auth/login` | Login (placeholder) |
| GET | `/api/volunteers/` | List volunteers (placeholder) |
