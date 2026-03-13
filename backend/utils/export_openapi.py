"""Export the OpenAPI schema to a JSON file for frontend code generation."""

import json
import sys
from pathlib import Path

# Allow running from anywhere by adding backend dir to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from main import app

output = backend_dir / "openapi.json"
with open(output, "w") as f:
    json.dump(app.openapi(), f, indent=2)

print(f"OpenAPI schema written to {output}")
