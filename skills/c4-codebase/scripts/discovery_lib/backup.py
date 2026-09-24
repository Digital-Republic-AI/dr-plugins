from __future__ import annotations

import shutil
from pathlib import Path

from .errors import DiscoveryError
from .fsutil import utc_stamp_for_path
from .layout import BACKUP_ITEMS, BACKUPS_DIR


def create_backup(workspace: Path) -> Path:
    destination = _unique_directory(workspace / BACKUPS_DIR / utc_stamp_for_path())
    try:
        destination.mkdir(parents=True)
        for item in BACKUP_ITEMS:
            _copy_item(workspace / item, destination / item)
    except OSError as exc:
        raise DiscoveryError(f"backup failed: {exc.strerror or exc}") from exc
    return destination


def _unique_directory(base: Path) -> Path:
    candidate = base
    counter = 1
    while candidate.exists():
        candidate = base.with_name(f"{base.name}-{counter}")
        counter += 1
    return candidate


def _copy_item(source: Path, target: Path) -> None:
    if source.is_dir():
        shutil.copytree(str(source), str(target))
    elif source.is_file():
        shutil.copy2(str(source), str(target))
