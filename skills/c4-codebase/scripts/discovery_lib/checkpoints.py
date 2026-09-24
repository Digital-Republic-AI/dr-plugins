from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .constants import EXIT_USAGE
from .errors import DiscoveryError
from .fsutil import read_json, write_json_atomic
from .layout import CHECKPOINT_ID_PREFIX, CHECKPOINT_SUFFIX, CHECKPOINTS_DIR, checkpoint_path
from .ledger import format_id
from .schema import load_schema, validate
from .state import phase_names
from .vocabulary import CHECKPOINT_SCHEMA


def read_checkpoints(workspace: Path) -> Tuple[Dict[str, dict], List[str]]:
    records: Dict[str, dict] = {}
    errors: List[str] = []
    for path in _checkpoint_files(workspace):
        data, problems = _load_checkpoint(path)
        errors.extend(problems)
        if data is not None and not problems:
            records[data["id"]] = data
    return records, errors


def _checkpoint_files(workspace: Path) -> List[Path]:
    directory = workspace / CHECKPOINTS_DIR
    return sorted(directory.glob(f"*{CHECKPOINT_SUFFIX}")) if directory.is_dir() else []


def _load_checkpoint(path: Path) -> Tuple[Optional[dict], List[str]]:
    location = f"{CHECKPOINTS_DIR}/{path.name}"
    try:
        data = read_json(path)
    except DiscoveryError as exc:
        return None, [f"{location}: {exc.message}"]
    problems = [f"{location}: {problem}" for problem in validate(data, load_schema(CHECKPOINT_SCHEMA))]
    if problems:
        return data, problems
    if data["id"] != path.stem:
        problems.append(f"{location}: id {data['id']!r} does not match the file name")
    if data["phase"] not in phase_names():
        problems.append(f"{location}: unknown phase {data['phase']!r}")
    return data, problems


def next_checkpoint_id(workspace: Path) -> str:
    return format_id(CHECKPOINT_ID_PREFIX, [path.stem for path in _checkpoint_files(workspace)])


def write_checkpoint(workspace: Path, record: dict) -> None:
    problems = validate(record, load_schema(CHECKPOINT_SCHEMA))
    if problems:
        raise DiscoveryError("invalid checkpoint: " + "; ".join(problems), EXIT_USAGE)
    path = checkpoint_path(workspace, record["id"])
    if path.exists():
        raise DiscoveryError(f"checkpoint {record['id']} already exists", EXIT_USAGE)
    write_json_atomic(path, record)
