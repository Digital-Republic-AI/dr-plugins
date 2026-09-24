from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import stat
import tempfile
from pathlib import Path
from typing import Any, List, Optional, Tuple

from .constants import DEFAULT_FILE_MODE, FINGERPRINT_HEX_LENGTH, HASH_CHUNK_BYTES, JSON_INDENT, TIMESTAMP_FOR_PATH_FORMAT
from .errors import DiscoveryError


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def utc_stamp_for_path() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime(TIMESTAMP_FOR_PATH_FORMAT)


def to_json(data: Any) -> str:
    return json.dumps(data, indent=JSON_INDENT, ensure_ascii=False) + "\n"


def write_text_atomic(path: Path, content: str) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        mode = _target_mode(path)
        fd, tmp_name = tempfile.mkstemp(prefix=".tmp-", dir=str(path.parent))
    except OSError as exc:
        raise DiscoveryError(f"cannot write {path}: {exc.strerror or exc}") from exc
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(content)
        os.chmod(tmp_name, mode)
        os.replace(tmp_name, str(path))
    except OSError as exc:
        raise DiscoveryError(f"cannot write {path}: {exc.strerror or exc}{_discard(tmp_name)}") from exc


def _target_mode(path: Path) -> int:
    if path.exists():
        return stat.S_IMODE(path.stat().st_mode)
    current_umask = os.umask(0)
    os.umask(current_umask)
    return DEFAULT_FILE_MODE & ~current_umask


def _discard(name: str) -> str:
    try:
        os.remove(name)
    except OSError as exc:
        return f"; temporary file {name} could not be removed: {exc.strerror or exc}"
    return ""


def write_json_atomic(path: Path, data: Any) -> None:
    write_text_atomic(path, to_json(data))


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:
        raise DiscoveryError(f"cannot read {path}: {exc.strerror or exc}") from exc


def read_json(path: Path) -> Any:
    try:
        return json.loads(read_text(path))
    except ValueError as exc:
        raise DiscoveryError(f"{path.name} is not valid JSON: {exc}") from exc


def read_jsonl(path: Path) -> List[Tuple[int, Optional[Any], Optional[str]]]:
    rows: List[Tuple[int, Optional[Any], Optional[str]]] = []
    if not path.exists():
        return rows
    for number, line in enumerate(read_text(path).splitlines(), start=1):
        if not line.strip():
            continue
        try:
            rows.append((number, json.loads(line), None))
        except ValueError as exc:
            rows.append((number, None, str(exc)))
    return rows


def append_jsonl(path: Path, record: Any) -> None:
    try:
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
    except OSError as exc:
        raise DiscoveryError(f"cannot append to {path}: {exc.strerror or exc}") from exc


def sha256_prefix(path: Path) -> Optional[str]:
    if not path.is_file():
        return None
    digest = hashlib.sha256()
    try:
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(HASH_CHUNK_BYTES), b""):
                digest.update(chunk)
    except OSError:
        return None
    return digest.hexdigest()[:FINGERPRINT_HEX_LENGTH]


def relative_posix(path: Path, base: Path) -> Optional[str]:
    try:
        return path.resolve().relative_to(base.resolve()).as_posix()
    except ValueError:
        return None
