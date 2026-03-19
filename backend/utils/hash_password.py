"""Utility to hash a password for use in environment variables."""

import sys

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

if len(sys.argv) != 2:
    print("Usage: python utils/hash_password.py <password>")
    sys.exit(1)

print(pwd_context.hash(sys.argv[1]))
