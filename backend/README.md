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
# Edit .env with your database credentials

# Run the server
uvicorn main:app --reload
```

API docs available at `http://localhost:8000/docs`

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
