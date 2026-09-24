from __future__ import annotations

import argparse
from pathlib import Path
from typing import List, Optional, Tuple

from .command_support import emit, load_context_state
from .commands_ledger import evidence_input
from .constants import BATCH_ERRORS_LIMIT, EXIT_OK, EXIT_USAGE
from .context import Context
from .errors import DiscoveryError
from .fsutil import append_jsonl, read_jsonl
from .layout import ID_PREFIXES, LEDGER_EVIDENCE, LEDGER_FILES
from .ledger import format_id, require_valid_ledger
from .ownership import owned_paths, working_tree
from .records import EvidenceInput, evidence_record
from .schema import load_schema, validate

BATCH_FIELDS = {
    "kind": "kind",
    "observation": "observation",
    "path": "path",
    "lines": "lines",
    "command": "command",
    "unit": "unit",
    "intent": "intent",
    "questionId": "question_id",
    "supersedes": "supersedes",
}
REQUIRED_BATCH_FIELDS = ("kind", "observation")
BATCH_HINT = "one JSON object per line with the fields of evidence add: kind, observation, path, lines, command, unit, intent, questionId, supersedes"


def cmd_evidence_add_batch(args: argparse.Namespace) -> int:
    ctx, state = load_context_state(args)
    inputs = _load_inputs(ctx, state, Path(args.file))
    records = _build_records(ctx, state, inputs)
    ledger = ctx.workspace.path / LEDGER_FILES[LEDGER_EVIDENCE]
    for record in records:
        append_jsonl(ledger, record)
    emit(ctx, {"evidence": records, "count": len(records)})
    return EXIT_OK


def _load_inputs(ctx: Context, state: dict, path: Path) -> List[EvidenceInput]:
    if not path.is_file():
        raise DiscoveryError(f"batch file not found: {path}", EXIT_USAGE, hint=BATCH_HINT)
    inputs: List[EvidenceInput] = []
    errors: List[str] = []
    for number, fields, parse_error in read_jsonl(path):
        problem, item = _parse_line(ctx, state, fields, parse_error)
        if problem:
            errors.append(f"line {number}: {problem}")
        elif item:
            inputs.append(item)
    if errors:
        shown = errors[:BATCH_ERRORS_LIMIT]
        more = f" (+{len(errors) - len(shown)} more)" if len(errors) > len(shown) else ""
        raise DiscoveryError("batch rejected, nothing appended: " + "; ".join(shown) + more, EXIT_USAGE, hint=BATCH_HINT)
    if not inputs:
        raise DiscoveryError(f"batch file has no records: {path}", EXIT_USAGE, hint=BATCH_HINT)
    return inputs


def _parse_line(ctx: Context, state: dict, fields, parse_error) -> Tuple[str, Optional[EvidenceInput]]:
    if parse_error:
        return f"invalid JSON: {parse_error}", None
    if not isinstance(fields, dict):
        return "record must be a JSON object", None
    unknown = sorted(set(fields) - set(BATCH_FIELDS))
    if unknown:
        return f"unknown field(s): {', '.join(unknown)}", None
    missing = [name for name in REQUIRED_BATCH_FIELDS if not fields.get(name)]
    if missing:
        return f"missing field(s): {', '.join(missing)}", None
    if not isinstance(fields.get("intent", False), bool):
        return "intent must be true or false", None
    try:
        return "", evidence_input(ctx, state, EvidenceInput(**{BATCH_FIELDS[key]: value for key, value in fields.items()}))
    except DiscoveryError as exc:
        return exc.message, None


def _build_records(ctx: Context, state: dict, inputs: List[EvidenceInput]) -> List[dict]:
    view = require_valid_ledger(ctx.workspace.path, LEDGER_EVIDENCE)
    dirty = working_tree(ctx.target, owned_paths(ctx, state))["dirty"]
    schema = load_schema(LEDGER_EVIDENCE)
    existing = [record["id"] for record in view.records]
    records: List[dict] = []
    errors: List[str] = []
    for position, item in enumerate(inputs, start=1):
        record_id = format_id(ID_PREFIXES[LEDGER_EVIDENCE], existing)
        record = evidence_record(record_id, item, ctx.target.root, ctx.identity["revision"], dirty)
        problems = validate(record, schema)
        if problems:
            errors.append(f"record {position}: " + "; ".join(problems))
        existing.append(record_id)
        records.append(record)
    if errors:
        raise DiscoveryError("batch rejected, nothing appended: " + "; ".join(errors[:BATCH_ERRORS_LIMIT]), EXIT_USAGE, hint=BATCH_HINT)
    return records
