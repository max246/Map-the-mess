"""organise images into subdirectories

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-04-10

Moves existing image files from the flat images/ directory into:
  images/reports/      — report images and thumbnails
  images/avatars/      — user avatar images
  images/communities/  — community profile images

No database schema changes — filenames stored in the DB stay the same.
The application code resolves the subdirectory from the filename prefix.
"""

import os
import shutil
from typing import Sequence, Union

from alembic import op

revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Resolve IMAGES_DIR the same way app/config.py does:
# alembic/versions/  ->  alembic/  ->  backend/  + images
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IMAGES_DIR = os.path.join(_BACKEND_DIR, "images")

SUBDIRS = {
    "avatars": lambda f: f.startswith("avatar_"),
    "communities": lambda f: f.startswith("community_"),
}
DEFAULT_SUBDIR = "reports"


def upgrade() -> None:
    if not os.path.isdir(IMAGES_DIR):
        return  # nothing to migrate

    # Create target subdirectories
    for subdir in (*SUBDIRS, DEFAULT_SUBDIR):
        os.makedirs(os.path.join(IMAGES_DIR, subdir), exist_ok=True)

    # Move files from the flat directory into the correct subdirectory
    for filename in os.listdir(IMAGES_DIR):
        src = os.path.join(IMAGES_DIR, filename)
        if not os.path.isfile(src):
            continue  # skip subdirectories

        target_subdir = DEFAULT_SUBDIR
        for subdir, matches in SUBDIRS.items():
            if matches(filename):
                target_subdir = subdir
                break

        dst = os.path.join(IMAGES_DIR, target_subdir, filename)
        shutil.move(src, dst)


def downgrade() -> None:
    """Move all files back to the flat images/ directory."""
    if not os.path.isdir(IMAGES_DIR):
        return

    for subdir in (*SUBDIRS, DEFAULT_SUBDIR):
        subdir_path = os.path.join(IMAGES_DIR, subdir)
        if not os.path.isdir(subdir_path):
            continue
        for filename in os.listdir(subdir_path):
            src = os.path.join(subdir_path, filename)
            if os.path.isfile(src):
                shutil.move(src, os.path.join(IMAGES_DIR, filename))
        os.rmdir(subdir_path)
