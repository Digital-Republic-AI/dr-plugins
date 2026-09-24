from __future__ import annotations

from collections import OrderedDict
from typing import Dict, List, Optional

from .constants import EXIT_UNHEALTHY, INVALIDATION_PATHS_LIMIT
from .errors import DiscoveryError
from .fsutil import utc_now
from .locations import REPOSITORY_ROOT_PATHS
from .state import phase_names, repository_record, require_unit
from .vocabulary import PHASE_COMPLETE, PHASE_INVESTIGATION, STATUS_COMPLETE, STATUS_IN_PROGRESS, STATUS_INVALIDATED, STATUS_PENDING


def affected_units(units: List[dict], changed_paths: List[str]) -> "OrderedDict[str, List[str]]":
    result: "OrderedDict[str, List[str]]" = OrderedDict()
    for unit in units:
        matches = [path for path in changed_paths if any(_within(path, scope) for scope in unit["paths"])]
        if matches:
            result[unit["id"]] = matches
    return result


def _within(path: str, scope: str) -> bool:
    normalized = scope.strip("/")
    return normalized in REPOSITORY_ROOT_PATHS or path == normalized or path.startswith(normalized + "/")


def invalidate_units(state: dict, targets: Dict[str, List[str]], reason: str, revision: Optional[str]) -> Dict[str, List[str]]:
    outcome: Dict[str, List[str]] = {"invalidated": [], "skippedPending": []}
    now = utc_now()
    for unit_id, paths in targets.items():
        unit = require_unit(state, unit_id)
        if unit["status"] == STATUS_PENDING:
            outcome["skippedPending"].append(unit_id)
            continue
        unit["status"] = STATUS_INVALIDATED
        record = {"unit": unit_id, "reason": reason, "changedPaths": paths[:INVALIDATION_PATHS_LIMIT], "revision": revision, "at": now}
        state["invalidations"].append(record)
        outcome["invalidated"].append(unit_id)
        if state["activeUnit"] == unit_id:
            state["activeUnit"] = None
    return outcome


def invalidate_downstream_phases(state: dict) -> List[str]:
    names = phase_names()
    start = names.index(PHASE_INVESTIGATION)
    changed: List[str] = []
    for name in names[start:]:
        entry = state["phases"][name]
        downstream_in_progress = name != PHASE_INVESTIGATION and entry["status"] == STATUS_IN_PROGRESS
        if entry["status"] == STATUS_COMPLETE or downstream_in_progress:
            entry["status"] = STATUS_INVALIDATED
            entry["updatedAt"] = utc_now()
            changed.append(name)
    current = state["currentPhase"]
    if current == PHASE_COMPLETE or names.index(current) > start:
        state["currentPhase"] = PHASE_INVESTIGATION
    return changed


def dependents_to_review(state: dict, invalidated: List[str]) -> List[str]:
    changed = set(invalidated)
    return [unit["id"] for unit in state["units"] if unit["status"] == STATUS_COMPLETE and changed.intersection(unit["dependsOn"])]


def rebaseline(state: dict, identity: dict, force: bool) -> dict:
    blocking = [unit["id"] for unit in state["units"] if unit["status"] == STATUS_INVALIDATED]
    if blocking and not force:
        raise DiscoveryError(
            f"units still invalidated: {', '.join(blocking)}",
            EXIT_UNHEALTHY,
            hint="revalidate them (unit set --status complete) before rebaselining, or pass --force",
        )
    previous = state["repository"]["baselineRevision"]
    state["repository"] = repository_record(identity, identity["revision"])
    return {"previousBaseline": previous, "baselineRevision": identity["revision"], "forcedWithInvalidatedUnits": blocking}
