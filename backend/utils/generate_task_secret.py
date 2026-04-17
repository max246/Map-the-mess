"""Generate a random secret suitable for ADMIN_TASK_SECRET."""

import secrets

token = secrets.token_urlsafe(32)
print(f"Secret:   {token}")
print(f"For .env: ADMIN_TASK_SECRET={token}")
