from __future__ import annotations

import re
from collections import OrderedDict
from pathlib import Path
from typing import Dict, List, NamedTuple, Set

from .constants import EXIT_USAGE, RECORD_ID_DIGITS
from .errors import DiscoveryError
from .fsutil import append_jsonl, read_jsonl
from .layout import ID_PREFIXES, LEDGER_EVIDENCE, LEDGER_FILES, LEDGER_HYPOTHESIS, LEDGER_QUESTION
from .schema import load_schema, validate

ID_NUMBER = re.compile(r"-([0-9]+)$")
STABLE_TEXT_FIELDS = {LEDGER_HYPOTHESIS: "claim", LEDGER_QUESTION: "question"}


class LedgerView(NamedTuple):
    kind: str
    records: List[dict]
    errors: List[str]


def read_ledger(workspace: Path, kind: str) -> LedgerView:
    file_name = LEDGER_FILES[kind]
    schema = load_schema(kind)
    records: List[dict] = []
    errors: List[str] = []
    for number, record, parse_error in read_jsonl(workspace / file_name):
        location = f"{file_name}:{number}"
        if parse_error:
            errors.append(f"{location}: invalid JSON: {parse_error}")
            continue
        problems = validate(record, schema)
        if problems:
            errors.extend(f"{location}: {problem}" for problem in problems)
            continue
        records.append(record)
    return LedgerView(kind, records, errors + _revision_errors(kind, records))


def _revision_errors(kind: str, records: List[dict]) -> List[str]:
    first_seen: Dict[str, dict] = {}
    errors: List[str] = []
    for record in records:
        record_id = record["id"]
        if record_id not in first_seen:
            first_seen[record_id] = record
            continue
        if kind == LEDGER_EVIDENCE:
            errors.append(f"{LEDGER_FILES[kind]}: evidence {record_id} is repeated; evidence is immutable, append a new record with supersedes")
            continue
        field = STABLE_TEXT_FIELDS[kind]
        if record[field] != first_seen[record_id][field]:
            errors.append(f"{LEDGER_FILES[kind]}: {record_id} changes its {field}; record a new id with supersedes instead")
    return errors


def current_records(records: List[dict]) -> "OrderedDict[str, dict]":
    latest: "OrderedDict[str, dict]" = OrderedDict()
    for record in records:
        latest[record["id"]] = record
    return latest


def superseded_ids(records: List[dict]) -> Set[str]:
    return {record["supersedes"] for record in records if record.get("supersedes")}


def effective_records(records: List[dict]) -> List[dict]:
    replaced = superseded_ids(records)
    return [record for record in current_records(records).values() if record["id"] not in replaced]


def next_id(records: List[dict], kind: str) -> str:
    return format_id(ID_PREFIXES[kind], [record["id"] for record in records])


def format_id(prefix: str, existing: List[str]) -> str:
    numbers = [int(match.group(1)) for match in (ID_NUMBER.search(item) for item in existing) if match]
    return f"{prefix}-{max(numbers, default=0) + 1:0{RECORD_ID_DIGITS}d}"


def append_record(workspace: Path, kind: str, record: dict) -> dict:
    problems = validate(record, load_schema(kind))
    if problems:
        raise DiscoveryError(f"invalid {kind} record: " + "; ".join(problems), EXIT_USAGE)
    append_jsonl(workspace / LEDGER_FILES[kind], record)
    return record


def require_valid_ledger(workspace: Path, kind: str) -> LedgerView:
    view = read_ledger(workspace, kind)
    if view.errors:
        raise DiscoveryError(
            f"{LEDGER_FILES[kind]} has errors: " + "; ".join(view.errors),
            EXIT_USAGE,
            hint="run workspace.py validate and fix the ledger before appending",
        )
    return view


def require_known_ids(ids: List[str], known: Set[str], label: str) -> None:
    missing = sorted(set(ids) - known)
    if missing:
        raise DiscoveryError(f"unknown {label} id(s): {', '.join(missing)}", EXIT_USAGE)
