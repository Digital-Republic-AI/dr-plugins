from __future__ import annotations

import argparse
from typing import List

from .command_support import current_or_fail, emit, guard_secrets, known_ids, load_context_state, split_values
from .constants import EXIT_OK, EXIT_USAGE
from .context import Context
from .errors import DiscoveryError
from .layout import LEDGER_EVIDENCE, LEDGER_HYPOTHESIS, LEDGER_QUESTION, QUESTIONS_MARKDOWN_FILE
from .ledger import LedgerView, append_record, effective_records, next_id, require_known_ids, require_valid_ledger
from .locations import repository_relative_path
from .ownership import owned_paths, working_tree
from .questions_view import write_questions_markdown
from .records import EvidenceInput, evidence_record, hypothesis_record, question_record, revision
from .state import reachability_required_by, require_unit, whole_scope_reason
from .vocabulary import (
    HYPOTHESIS_REJECTED,
    KIND_USER_CONFIRMATION,
    PATH_REQUIRED_KINDS,
    QUESTION_ANSWERED,
    QUESTION_DISMISSED,
    QUESTION_OPEN,
)


def _append_evidence(ctx: Context, state: dict, item: EvidenceInput) -> dict:
    workspace = ctx.workspace.path
    view = require_valid_ledger(workspace, LEDGER_EVIDENCE)
    dirty = working_tree(ctx.target, owned_paths(ctx, state))["dirty"]
    record = evidence_record(next_id(view.records, LEDGER_EVIDENCE), item, ctx.target.root, ctx.identity["revision"], dirty)
    return append_record(workspace, LEDGER_EVIDENCE, record)


def evidence_input(ctx: Context, state: dict, fields: EvidenceInput) -> EvidenceInput:
    require_unit(state, fields.unit)
    path = repository_relative_path(ctx.target.root, fields.path) if fields.path else None
    if path and fields.kind in PATH_REQUIRED_KINDS and not (ctx.target.root / path).exists():
        raise DiscoveryError(f"path does not exist in the working tree: {path}", EXIT_USAGE, hint="use --kind git for files that only exist in history")
    if fields.supersedes:
        require_known_ids([fields.supersedes], known_ids(ctx, LEDGER_EVIDENCE), LEDGER_EVIDENCE)
    if fields.question_id:
        require_known_ids([fields.question_id], known_ids(ctx, LEDGER_QUESTION), LEDGER_QUESTION)
    guard_secrets({"observation": fields.observation, "command": fields.command})
    return fields._replace(path=path)


def cmd_evidence_add(args: argparse.Namespace) -> int:
    ctx, state = load_context_state(args)
    fields = EvidenceInput(
        kind=args.kind, observation=args.observation, path=args.path, lines=args.lines, command=args.command,
        unit=args.unit, intent=args.intent, question_id=args.question_id, supersedes=args.supersedes,
    )
    emit(ctx, {"evidence": _append_evidence(ctx, state, evidence_input(ctx, state, fields))})
    return EXIT_OK


def cmd_hypothesis_add(args: argparse.Namespace) -> int:
    ctx, state = load_context_state(args)
    view = require_valid_ledger(ctx.workspace.path, LEDGER_HYPOTHESIS)
    require_unit(state, args.unit)
    evidence_ids = split_values(args.evidence)
    question_ids = split_values(args.question_id)
    require_known_ids(evidence_ids, known_ids(ctx, LEDGER_EVIDENCE), LEDGER_EVIDENCE)
    require_known_ids(question_ids, known_ids(ctx, LEDGER_QUESTION), LEDGER_QUESTION)
    if args.supersedes:
        current_or_fail(view, args.supersedes)
    _require_reachability(state, args)
    guard_secrets({"claim": args.claim})
    record = hypothesis_record(
        next_id(view.records, LEDGER_HYPOTHESIS), args.claim, evidence_ids, args.confidence, args.status,
        args.unit, args.reachability, question_ids, args.supersedes,
    )
    emit(ctx, {"hypothesis": append_record(ctx.workspace.path, LEDGER_HYPOTHESIS, record)})
    return EXIT_OK


def _require_reachability(state: dict, args: argparse.Namespace) -> None:
    required_by = reachability_required_by(state, args.unit)
    if required_by and args.reachability is None and args.status != HYPOTHESIS_REJECTED:
        raise DiscoveryError(
            f"hypothesis needs --reachability: {whole_scope_reason(required_by)}",
            EXIT_USAGE,
            hint="pass --reachability with the code of the area this claim is about",
        )


def cmd_hypothesis_revise(args: argparse.Namespace) -> int:
    ctx, _ = load_context_state(args)
    view = require_valid_ledger(ctx.workspace.path, LEDGER_HYPOTHESIS)
    current = current_or_fail(view, args.id)
    evidence_ids = split_values(args.evidence)
    question_ids = split_values(args.question_id)
    require_known_ids(evidence_ids, known_ids(ctx, LEDGER_EVIDENCE), LEDGER_EVIDENCE)
    require_known_ids(question_ids, known_ids(ctx, LEDGER_QUESTION), LEDGER_QUESTION)
    changes = {key: value for key, value in (("status", args.status), ("confidence", args.confidence), ("reachability", args.reachability)) if value}
    if evidence_ids:
        changes["evidence"] = _merged(current["evidence"], evidence_ids)
    if question_ids:
        changes["questionIds"] = _merged(current.get("questionIds", []), question_ids)
    if not changes:
        raise DiscoveryError("nothing to revise; pass --status, --confidence, --reachability, --evidence, or --question-id", EXIT_USAGE)
    emit(ctx, {"hypothesis": append_record(ctx.workspace.path, LEDGER_HYPOTHESIS, revision(current, **changes))})
    return EXIT_OK


def _merged(existing: List[str], extra: List[str]) -> List[str]:
    return list(dict.fromkeys(existing + extra))


def cmd_question_add(args: argparse.Namespace) -> int:
    ctx, state = load_context_state(args)
    view = require_valid_ledger(ctx.workspace.path, LEDGER_QUESTION)
    require_unit(state, args.unit)
    hypothesis_ids = split_values(args.hypothesis)
    require_known_ids(hypothesis_ids, known_ids(ctx, LEDGER_HYPOTHESIS), LEDGER_HYPOTHESIS)
    if args.supersedes:
        current_or_fail(view, args.supersedes)
    guard_secrets({"question": args.question})
    record = question_record(next_id(view.records, LEDGER_QUESTION), args.question, args.impact, args.unit, hypothesis_ids, args.supersedes)
    return _append_question(ctx, view, record, {})


def cmd_question_answer(args: argparse.Namespace) -> int:
    ctx, state = load_context_state(args)
    view = require_valid_ledger(ctx.workspace.path, LEDGER_QUESTION)
    current = _open_question(view, args.id)
    guard_secrets({"answer": args.answer})
    item = EvidenceInput(kind=KIND_USER_CONFIRMATION, observation=args.answer, unit=current.get("unit"), question_id=args.id)
    evidence = _append_evidence(ctx, state, item)
    record = revision(current, status=QUESTION_ANSWERED, answer=args.answer, answerEvidence=evidence["id"])
    return _append_question(ctx, view, record, {"evidence": evidence})


def cmd_question_dismiss(args: argparse.Namespace) -> int:
    ctx, _ = load_context_state(args)
    view = require_valid_ledger(ctx.workspace.path, LEDGER_QUESTION)
    current = _open_question(view, args.id)
    guard_secrets({"reason": args.reason})
    return _append_question(ctx, view, revision(current, status=QUESTION_DISMISSED, dismissalReason=args.reason), {})


def cmd_question_render(args: argparse.Namespace) -> int:
    ctx, _ = load_context_state(args)
    view = require_valid_ledger(ctx.workspace.path, LEDGER_QUESTION)
    write_questions_markdown(ctx.workspace.path, view.records)
    emit(ctx, {"written": QUESTIONS_MARKDOWN_FILE, "openQuestions": _open_count(view.records)})
    return EXIT_OK


def _open_question(view: LedgerView, question_id: str) -> dict:
    current = current_or_fail(view, question_id)
    if current["status"] != QUESTION_OPEN:
        raise DiscoveryError(f"question {question_id} is already {current['status']}", EXIT_USAGE)
    return current


def _append_question(ctx: Context, view: LedgerView, record: dict, extra: dict) -> int:
    append_record(ctx.workspace.path, LEDGER_QUESTION, record)
    records = view.records + [record]
    write_questions_markdown(ctx.workspace.path, records)
    emit(ctx, dict({"question": record, "openQuestions": _open_count(records)}, **extra))
    return EXIT_OK


def _open_count(records: List[dict]) -> int:
    return sum(1 for record in effective_records(records) if record["status"] == QUESTION_OPEN)
