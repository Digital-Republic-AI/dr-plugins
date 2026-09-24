from __future__ import annotations

import argparse
from typing import Callable, Dict

from .checkpoints import next_checkpoint_id, write_checkpoint
from .command_support import guard_secrets, known_ids, run_mutation, split_values
from .constants import EXIT_UNHEALTHY, EXIT_USAGE
from .context import Context
from .errors import DiscoveryError
from .fsutil import utc_now
from .layout import LEDGER_EVIDENCE, LEDGER_HYPOTHESIS, LEDGER_QUESTION
from .ledger import require_known_ids
from .locations import repository_relative_path
from .ownership import owned_paths, working_tree
from .phases import apply_phase_status
from .resume import next_step
from .state import find_unit, require_unit
from .vocabulary import (
    PHASE_COMPLETE,
    PHASE_INVESTIGATION,
    STATUS_BLOCKED,
    STATUS_COMPLETE,
    STATUS_IN_PROGRESS,
    STATUS_PENDING,
)


def cmd_phase_set(args: argparse.Namespace) -> int:
    return run_mutation(args, lambda ctx, state: apply_phase_status(ctx, state, args.phase, args.status))


def cmd_unit_add(args: argparse.Namespace) -> int:
    def mutate(ctx: Context, state: dict) -> dict:
        if find_unit(state, args.id):
            raise DiscoveryError(f"unit {args.id!r} already exists", EXIT_USAGE, hint="use unit set to change it")
        paths = [repository_relative_path(ctx.target.root, raw) for raw in split_values(args.path)]
        missing = [path for path in paths if not (ctx.target.root / path).exists()]
        if missing:
            raise DiscoveryError(f"unit paths do not exist: {', '.join(missing)}", EXIT_USAGE)
        dependencies = split_values(args.depends_on)
        for dependency in dependencies:
            require_unit(state, dependency)
        unit = {
            "id": args.id,
            "description": args.description,
            "paths": paths,
            "type": args.type,
            "status": STATUS_PENDING,
            "reachability": None,
            "dependsOn": dependencies,
            "analyzedRevision": None,
            "checkpointIds": [],
        }
        state["units"].append(unit)
        return {"unit": unit, "next": next_step(state)}
    return run_mutation(args, mutate)


def cmd_unit_set(args: argparse.Namespace) -> int:
    def mutate(ctx: Context, state: dict) -> dict:
        unit = require_unit(state, args.id)
        if args.status is None and args.reachability is None and args.description is None:
            raise DiscoveryError("nothing to change; pass --status, --reachability, or --description", EXIT_USAGE)
        if args.description is not None:
            unit["description"] = args.description
        if args.reachability is not None:
            unit["reachability"] = args.reachability
        if args.status is not None:
            UNIT_TRANSITIONS[args.status](ctx, state, unit)
            unit["status"] = args.status
        return {"unit": unit, "activeUnit": state["activeUnit"], "next": next_step(state)}
    return run_mutation(args, mutate)


def _start_unit(ctx: Context, state: dict, unit: dict) -> None:
    if state["currentPhase"] != PHASE_INVESTIGATION:
        raise DiscoveryError(
            f"units are investigated during the investigation phase; currentPhase is {state['currentPhase']}",
            EXIT_UNHEALTHY,
            hint="phase set --phase investigation --status in_progress",
        )
    active = state["activeUnit"]
    if active and active != unit["id"]:
        raise DiscoveryError(f"unit {active!r} is already in progress", EXIT_UNHEALTHY, hint="complete or block it first; investigate one unit at a time")
    state["activeUnit"] = unit["id"]


def _complete_unit(ctx: Context, state: dict, unit: dict) -> None:
    if not unit["checkpointIds"]:
        raise DiscoveryError(f"unit {unit['id']!r} has no checkpoint", EXIT_UNHEALTHY, hint=f"checkpoint write --unit {unit['id']} --summary ...")
    if unit["reachability"] is None:
        raise DiscoveryError(f"unit {unit['id']!r} has no reachability classification", EXIT_UNHEALTHY, hint="pass --reachability")
    unit["analyzedRevision"] = ctx.identity["revision"]
    _release_unit(ctx, state, unit)


def _release_unit(ctx: Context, state: dict, unit: dict) -> None:
    if state["activeUnit"] == unit["id"]:
        state["activeUnit"] = None


UNIT_TRANSITIONS: Dict[str, Callable[[Context, dict, dict], None]] = {
    STATUS_IN_PROGRESS: _start_unit,
    STATUS_COMPLETE: _complete_unit,
    STATUS_PENDING: _release_unit,
    STATUS_BLOCKED: _release_unit,
}


def cmd_checkpoint_write(args: argparse.Namespace) -> int:
    def mutate(ctx: Context, state: dict) -> dict:
        workspace = ctx.workspace.path
        unit = require_unit(state, args.unit)
        phase = args.phase or state["currentPhase"]
        if phase == PHASE_COMPLETE:
            raise DiscoveryError("the analysis is complete; pass --phase explicitly", EXIT_USAGE)
        guard_secrets({"summary": args.summary})
        record = {
            "id": next_checkpoint_id(workspace),
            "createdAt": utc_now(),
            "phase": phase,
            "unit": args.unit,
            "repositoryRevision": ctx.identity["revision"],
            "dirty": working_tree(ctx.target, owned_paths(ctx, state))["dirty"],
            "summary": args.summary,
            "completedActions": split_values(args.completed),
            "nextActions": split_values(args.next),
        }
        record.update(_checkpoint_references(ctx, args))
        write_checkpoint(workspace, record)
        state["lastCheckpoint"] = record["id"]
        if unit:
            unit["checkpointIds"].append(record["id"])
        return {"checkpoint": record, "next": next_step(state)}
    return run_mutation(args, mutate)


def _checkpoint_references(ctx: Context, args: argparse.Namespace) -> dict:
    fields = (
        ("evidenceIds", args.evidence, LEDGER_EVIDENCE),
        ("hypothesisIds", args.hypothesis, LEDGER_HYPOTHESIS),
        ("openQuestionIds", args.question, LEDGER_QUESTION),
    )
    references = {}
    for field, raw, kind in fields:
        ids = split_values(raw)
        if ids:
            require_known_ids(ids, known_ids(ctx, kind), kind)
        references[field] = ids
    return references
