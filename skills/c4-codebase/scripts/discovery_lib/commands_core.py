from __future__ import annotations

import argparse
from pathlib import Path
from typing import List, Optional

from .backup import create_backup
from .command_support import emit, run_mutation, split_values
from .constants import (
    DEFAULT_OUTPUT_DIR,
    EXIT_OK,
    EXIT_OPERATIONAL_ERROR,
    EXIT_PUBLICATION_BLOCKED,
    EXIT_UNHEALTHY,
    EXIT_USAGE,
    LEGACY_STATE_SCHEMA_VERSION,
    STATE_SCHEMA_VERSION,
    VERSIONING_SHARED,
)
from .context import Context, build_context, require_workspace
from .errors import DiscoveryError
from .invalidation import affected_units, dependents_to_review, invalidate_downstream_phases, invalidate_units, rebaseline
from .layout import LEDGER_QUESTION, LEGACY_QUESTIONS_MARKDOWN_FILE, QUESTIONS_MARKDOWN_FILE
from .ledger import append_record, next_id, read_ledger
from .migrate import migrate_state
from .ownership import owned_paths
from .publication import display_path, publish_check
from .questions_view import write_questions_markdown
from .records import question_record
from .resume import next_step
from .skeleton import ensure_skeleton, load_templates, skeleton_contents
from .skillmeta import skill_root, skill_version
from .state import load_valid_state, new_state, read_state_file, require_unit, save_state
from .status import build_status, render_status
from .validation import validation_report

MIGRATED_QUESTION_IMPACT = "scope"
MANUAL_INVALIDATION_REASON = "manual invalidation"


def cmd_status(args: argparse.Namespace) -> int:
    ctx = build_context(args)
    emit(ctx, build_status(ctx), render_status)
    return EXIT_OK


def cmd_check(args: argparse.Namespace) -> int:
    ctx = build_context(args)
    status = build_status(ctx)
    emit(ctx, status, render_status)
    return EXIT_OK if status["healthy"] else EXIT_UNHEALTHY


def cmd_init(args: argparse.Namespace) -> int:
    ctx = build_context(args, prefer_external=args.external)
    templates = load_templates(skill_root())
    existing, _ = read_state_file(ctx.workspace.path)
    versioning = _existing_text(existing, "versioning") or args.versioning or VERSIONING_SHARED
    state = new_state(ctx.identity, ctx.target.scope, args.output_dir or DEFAULT_OUTPUT_DIR, versioning, skill_version())
    result = ensure_skeleton(ctx.workspace.path, skeleton_contents(templates, state, versioning))
    result["warnings"] = _ignored_init_options(existing, args, ctx.target.scope)
    status = build_status(ctx)
    status["initialization"] = result
    emit(ctx, status, _render_init)
    return EXIT_OK


def _render_init(status: dict) -> None:
    render_status(status)
    initialization = status["initialization"]
    print(f"\nCreated: {', '.join(initialization['created']) or '-'}")
    print(f"Preserved: {', '.join(initialization['preserved']) or '-'}")
    for warning in initialization["warnings"]:
        print(f"Warning: {warning}")


def _existing_text(existing: object, key: str) -> Optional[str]:
    value = existing.get(key) if isinstance(existing, dict) else None
    return value if isinstance(value, str) else None


def _ignored_init_options(existing: object, args: argparse.Namespace, scope: Optional[str]) -> List[str]:
    if not isinstance(existing, dict):
        return []
    output = existing.get("output") if isinstance(existing.get("output"), dict) else {}
    checks = (
        ("versioning", args.versioning, existing.get("versioning")),
        ("output directory", args.output_dir, output.get("directory")),
        ("scope", scope, existing.get("scope")),
    )
    return [
        f"ignored {label} {requested!r}: state.json already records {recorded!r}"
        for label, requested, recorded in checks
        if requested is not None and requested != recorded
    ]


def cmd_validate(args: argparse.Namespace) -> int:
    ctx = build_context(args)
    require_workspace(ctx)
    report = validation_report(ctx)
    emit(ctx, report)
    return EXIT_OK if report["valid"] else EXIT_UNHEALTHY


def cmd_migrate(args: argparse.Namespace) -> int:
    ctx = build_context(args)
    require_workspace(ctx)
    workspace = ctx.workspace.path
    legacy = _legacy_state(workspace)
    if legacy is None:
        emit(ctx, {"migrated": False, "reason": f"state.json already uses schemaVersion {STATE_SCHEMA_VERSION}"})
        return EXIT_OK
    backup = create_backup(workspace)
    migration = migrate_state(workspace, legacy, ctx.identity, skill_version())
    save_state(workspace, migration.state, ctx.identity)
    legacy_questions = _preserve_legacy_questions(workspace)
    question_ids = _append_migrated_questions(workspace, migration.questions)
    templates = load_templates(skill_root())
    repair = ensure_skeleton(workspace, skeleton_contents(templates, migration.state, migration.state["versioning"]))
    warnings = migration.warnings + ([f"review the impact of migrated questions: {', '.join(question_ids)}"] if question_ids else [])
    emit(ctx, {
        "migrated": True,
        "backup": display_path(ctx.target.root, backup),
        "warnings": warnings,
        "legacyQuestionsFile": legacy_questions,
        "migratedQuestions": question_ids,
        "initialization": repair,
    })
    return EXIT_OK


def _legacy_state(workspace: Path) -> Optional[dict]:
    data, problem = read_state_file(workspace)
    if problem:
        raise DiscoveryError(problem, EXIT_UNHEALTHY)
    if not isinstance(data, dict):
        raise DiscoveryError("state.json must contain a JSON object; restore it from a backup before migrating", EXIT_UNHEALTHY)
    version = data.get("schemaVersion")
    if version == STATE_SCHEMA_VERSION:
        return None
    if version != LEGACY_STATE_SCHEMA_VERSION:
        raise DiscoveryError(f"unsupported schemaVersion {version!r}", EXIT_UNHEALTHY)
    return data


def _preserve_legacy_questions(workspace: Path) -> Optional[str]:
    source = workspace / QUESTIONS_MARKDOWN_FILE
    target = workspace / LEGACY_QUESTIONS_MARKDOWN_FILE
    if not source.exists() or target.exists():
        return None
    source.replace(target)
    return LEGACY_QUESTIONS_MARKDOWN_FILE


def _append_migrated_questions(workspace: Path, questions: List[str]) -> List[str]:
    records = list(read_ledger(workspace, LEDGER_QUESTION).records)
    created: List[str] = []
    for text in questions:
        record = question_record(next_id(records, LEDGER_QUESTION), text, MIGRATED_QUESTION_IMPACT)
        append_record(workspace, LEDGER_QUESTION, record)
        records.append(record)
        created.append(record["id"])
    write_questions_markdown(workspace, records)
    return created


def cmd_backup(args: argparse.Namespace) -> int:
    ctx = build_context(args)
    require_workspace(ctx)
    emit(ctx, {"backup": display_path(ctx.target.root, create_backup(ctx.workspace.path))})
    return EXIT_OK


def cmd_invalidate(args: argparse.Namespace) -> int:
    def mutate(ctx: Context, state: dict) -> dict:
        explicit = split_values(args.unit)
        since = args.since or (None if explicit else state["repository"]["baselineRevision"])
        if not since and not explicit:
            raise DiscoveryError("no baseline revision recorded", EXIT_USAGE, hint="pass --since <revision> or --unit <id>")
        changed = _changed_paths(ctx, state, since) if since else []
        targets = affected_units(state["units"], changed)
        for unit_id in explicit:
            require_unit(state, unit_id)
            targets.setdefault(unit_id, [])
        reason = args.reason or (f"repository changed since {since}" if since else MANUAL_INVALIDATION_REASON)
        outcome = invalidate_units(state, targets, reason, ctx.identity["revision"])
        return {
            "since": since,
            "changedPathCount": len(changed),
            "invalidatedUnits": outcome["invalidated"],
            "skippedPendingUnits": outcome["skippedPending"],
            "invalidatedPhases": invalidate_downstream_phases(state) if outcome["invalidated"] else [],
            "dependentsToReview": dependents_to_review(state, outcome["invalidated"]),
            "currentPhase": state["currentPhase"],
            "next": next_step(state),
        }
    return run_mutation(args, mutate)


def _changed_paths(ctx: Context, state: dict, since: str) -> List[str]:
    git = ctx.target.git
    if not ctx.target.is_git:
        raise DiscoveryError("--since requires a git repository", EXIT_USAGE, hint="invalidate explicit units with --unit")
    if not git.is_valid_revision(since):
        raise DiscoveryError(f"unknown revision {since!r}", EXIT_USAGE)
    owned = owned_paths(ctx, state)
    committed = git.changed_paths_since(since, owned)
    if committed is None:
        raise DiscoveryError(f"git diff against {since} failed: {'; '.join(git.warnings)}", EXIT_OPERATIONAL_ERROR)
    dirty = git.dirty_paths(owned)
    if dirty is None:
        raise DiscoveryError(f"git status failed: {'; '.join(git.warnings)}", EXIT_OPERATIONAL_ERROR)
    return sorted(set(committed) | set(dirty))


def cmd_rebaseline(args: argparse.Namespace) -> int:
    return run_mutation(
        args,
        lambda ctx, state: rebaseline(state, ctx.identity, args.force),
        allow_identity_mismatch=args.accept_identity,
    )


def cmd_output_set(args: argparse.Namespace) -> int:
    def mutate(ctx: Context, state: dict) -> dict:
        state["output"]["directory"] = args.dir
        return publish_check(ctx, state)
    return run_mutation(args, mutate)


def cmd_publish_check(args: argparse.Namespace) -> int:
    ctx = build_context(args)
    require_workspace(ctx)
    state = load_valid_state(ctx.workspace.path, ctx.identity)
    report = publish_check(ctx, state, args.output_dir)
    emit(ctx, report)
    return EXIT_PUBLICATION_BLOCKED if report["blocked"] else EXIT_OK
