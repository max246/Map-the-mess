"""Utility to hash a password for use in environment variables."""

import sys

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

if len(sys.argv) != 2:
    print("Usage: python utils/hash_password.py <password>")
    sys.exit(1)

hashed = pwd_context.hash(sys.argv[1])
env_safe = hashed.replace("$", "$$")
print(f"Hash:     {hashed}")
print(f"For .env: SUPERUSER_PASSWORD={env_safe}")
