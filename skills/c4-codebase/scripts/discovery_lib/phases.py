from __future__ import annotations

from typing import Callable, Dict, List

from .constants import EXIT_UNHEALTHY, EXIT_USAGE
from .context import Context
from .errors import DiscoveryError
from .fsutil import utc_now
from .publication import publish_check
from .resume import next_step
from .state import phase_names, whole_scope_unit_ids
from .validation import validation_report
from .vocabulary import (
    PHASE_CLASSIFICATION,
    PHASE_COMPLETE,
    PHASE_INVESTIGATION,
    PHASE_PARTITIONING,
    PHASE_PUBLICATION,
    PHASE_VALIDATION,
    PUBLICATION_GENERATED,
    STATUS_BLOCKED,
    STATUS_COMPLETE,
    STATUS_IN_PROGRESS,
)


def apply_phase_status(ctx: Context, state: dict, phase: str, status: str) -> dict:
    if phase == PHASE_COMPLETE:
        return _complete_analysis(state, status)
    warnings: List[str] = []
    if status in (STATUS_IN_PROGRESS, STATUS_COMPLETE):
        _require_previous_complete(state, phase)
    if status == STATUS_COMPLETE:
        warnings = COMPLETION_GATES.get(phase, _no_gate)(ctx, state)
    state["phases"][phase] = {"status": status, "updatedAt": utc_now()}
    if status == STATUS_IN_PROGRESS:
        state["currentPhase"] = phase
    if status == STATUS_COMPLETE:
        _advance_current_phase(state, phase)
    return {"phase": phase, "status": status, "currentPhase": state["currentPhase"], "warnings": warnings, "next": next_step(state)}


def _advance_current_phase(state: dict, phase: str) -> None:
    names = phase_names()
    index = names.index(phase)
    current = state["currentPhase"]
    if current != PHASE_COMPLETE and names.index(current) <= index < len(names) - 1:
        state["currentPhase"] = names[index + 1]


def _complete_analysis(state: dict, status: str) -> dict:
    if status != STATUS_COMPLETE:
        raise DiscoveryError("--phase complete only accepts --status complete", EXIT_USAGE)
    incomplete = [name for name in phase_names() if state["phases"][name]["status"] != STATUS_COMPLETE]
    if incomplete:
        raise DiscoveryError(f"cannot mark the analysis complete; incomplete phases: {', '.join(incomplete)}", EXIT_UNHEALTHY)
    state["currentPhase"] = PHASE_COMPLETE
    return {"phase": PHASE_COMPLETE, "status": STATUS_COMPLETE, "currentPhase": PHASE_COMPLETE, "warnings": [], "next": next_step(state)}


def _require_previous_complete(state: dict, phase: str) -> None:
    names = phase_names()
    pending = [name for name in names[: names.index(phase)] if state["phases"][name]["status"] != STATUS_COMPLETE]
    if pending:
        raise DiscoveryError(
            f"cannot start or complete {phase}; earlier phases are not complete: {', '.join(pending)}",
            EXIT_UNHEALTHY,
            hint="complete or revalidate the earlier phases first",
        )


def _no_gate(ctx: Context, state: dict) -> List[str]:
    return []


def _gate_partitioning(ctx: Context, state: dict) -> List[str]:
    if not state["units"]:
        raise DiscoveryError("partitioning requires at least one unit", EXIT_UNHEALTHY, hint="register units with workspace.py unit add")
    return [
        f"unit {unit_id} covers the whole analysis scope: every hypothesis for it needs --reachability, "
        "and each architecture-relevant area inside it needs its own hypothesis with a reachability code"
        for unit_id in whole_scope_unit_ids(state)
    ]


def _gate_investigation(ctx: Context, state: dict) -> List[str]:
    open_units = [unit["id"] for unit in state["units"] if unit["status"] not in (STATUS_COMPLETE, STATUS_BLOCKED)]
    if open_units:
        raise DiscoveryError(f"units not complete: {', '.join(open_units)}", EXIT_UNHEALTHY)
    return [f"unit {unit['id']} is blocked; record why in CONCERNS.md" for unit in state["units"] if unit["status"] == STATUS_BLOCKED]


def _gate_classification(ctx: Context, state: dict) -> List[str]:
    unclassified = [unit["id"] for unit in state["units"] if unit["status"] != STATUS_BLOCKED and unit["reachability"] is None]
    if unclassified:
        raise DiscoveryError(f"units without reachability: {', '.join(unclassified)}", EXIT_UNHEALTHY, hint="unit set --reachability <code>")
    return []


def _gate_validation(ctx: Context, state: dict) -> List[str]:
    report = validation_report(ctx)
    if not report["valid"]:
        count = sum(len(items) for items in report["errors"].values())
        raise DiscoveryError(f"workspace validation has {count} error(s)", EXIT_UNHEALTHY, hint="run workspace.py validate --json and fix every error")
    return report["warnings"]


def _gate_publication(ctx: Context, state: dict) -> List[str]:
    report = publish_check(ctx, state)
    problems = [f"{item['file']} ({item['status']})" for item in report["targets"] if item["status"] != PUBLICATION_GENERATED]
    problems.extend(f"{name} (stale: generated before later repository changes)" for name in report["staleFiles"])
    problems.extend(report["secretFindings"])
    problems.extend(report["claimLabelErrors"])
    problems.extend(report["dslLintErrors"])
    if problems:
        raise DiscoveryError(
            f"publication incomplete: {'; '.join(problems)}",
            EXIT_UNHEALTHY,
            hint="regenerate stale files with the current headers from publish-check, redact secret values, fix claim labels, then rerun publish-check",
        )
    return report["claimLabelWarnings"]


COMPLETION_GATES: Dict[str, Callable[[Context, dict], List[str]]] = {
    PHASE_PARTITIONING: _gate_partitioning,
    PHASE_INVESTIGATION: _gate_investigation,
    PHASE_CLASSIFICATION: _gate_classification,
    PHASE_VALIDATION: _gate_validation,
    PHASE_PUBLICATION: _gate_publication,
}
