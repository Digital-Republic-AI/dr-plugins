from __future__ import annotations

import argparse
import sys
from typing import Callable, Iterable, List, Optional, Set, Tuple

from .cli_support import emit_json
from .constants import EXIT_OK, EXIT_USAGE
from .context import Context, build_context, require_workspace
from .errors import DiscoveryError
from .ledger import LedgerView, current_records, read_ledger, superseded_ids
from .secret_scan import secret_kinds
from .state import load_valid_state, save_state
from .status import render_mapping

SECRET_HINT = "record key names and file paths only; never secret values"
RECORD_KEYS = ("evidence", "hypothesis", "question", "checkpoint", "unit")


def emit(ctx: Context, result: dict, human: Callable[[dict], None] = render_mapping) -> None:
    if ctx.quiet:
        emit_ids(result)
    elif ctx.as_json:
        emit_json(result)
    else:
        human(result)


def emit_ids(result: dict) -> None:
    for key, value in result.items():
        if key not in RECORD_KEYS:
            continue
        records = value if isinstance(value, list) else [value]
        ids = [record["id"] for record in records if isinstance(record, dict) and record.get("id")]
        if ids:
            sys.stdout.write("".join(f"{record_id}\n" for record_id in ids))
            return


def load_context_state(args: argparse.Namespace, allow_identity_mismatch: bool = False) -> Tuple[Context, dict]:
    ctx = build_context(args)
    require_workspace(ctx)
    return ctx, load_valid_state(ctx.workspace.path, ctx.identity, allow_identity_mismatch)


def run_mutation(args: argparse.Namespace, mutate: Callable[[Context, dict], dict], allow_identity_mismatch: bool = False) -> int:
    ctx, state = load_context_state(args, allow_identity_mismatch)
    result = mutate(ctx, state)
    save_state(ctx.workspace.path, state, ctx.identity)
    emit(ctx, result)
    return EXIT_OK


def split_values(values: Optional[Iterable[str]]) -> List[str]:
    items: List[str] = []
    for value in values or []:
        items.extend(part.strip() for part in value.split(",") if part.strip())
    return list(dict.fromkeys(items))


def guard_secrets(fields: dict) -> None:
    for name, value in fields.items():
        kinds = secret_kinds(value) if isinstance(value, str) else []
        if kinds:
            raise DiscoveryError(f"{name} appears to contain a secret value ({', '.join(kinds)})", EXIT_USAGE, hint=SECRET_HINT)


def known_ids(ctx: Context, kind: str) -> Set[str]:
    return {record["id"] for record in read_ledger(ctx.workspace.path, kind).records}


def current_or_fail(view: LedgerView, record_id: str) -> dict:
    record = current_records(view.records).get(record_id)
    if record is None:
        raise DiscoveryError(f"unknown {view.kind} id {record_id!r}", EXIT_USAGE)
    if record_id in superseded_ids(view.records):
        raise DiscoveryError(f"{view.kind} {record_id} has been superseded; revise the replacement instead", EXIT_USAGE)
    return record
