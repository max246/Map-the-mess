from unittest.mock import patch

from fastapi.testclient import TestClient

with patch("main._seed_superuser"):
    from main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["message"] == "Map the Mess API is running 🗺️"
