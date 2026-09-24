from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, NamedTuple, Optional, Tuple

from .constants import EXIT_UNHEALTHY, EXIT_USAGE, LEGACY_STATE_SCHEMA_VERSION, STATE_SCHEMA_VERSION
from .errors import DiscoveryError
from .fsutil import read_json, utc_now, write_json_atomic
from .identity import identity_findings
from .layout import STATE_FILE, checkpoint_path
from .locations import REPOSITORY_ROOT_PATHS
from .schema import definition_enum, load_schema, validate
from .vocabulary import PHASE_COMPLETE, STATE_SCHEMA, STATUS_COMPLETE, STATUS_IN_PROGRESS, STATUS_PENDING


class StateInspection(NamedTuple):
    data: Optional[dict]
    errors: List[str]
    warnings: List[str]
    needs_migration: bool
    identity_errors: List[str]


def phase_names() -> List[str]:
    return definition_enum(load_schema(STATE_SCHEMA), "phase")


def new_state(identity: dict, scope: Optional[str], output_dir: str, versioning: str, version: str) -> dict:
    now = utc_now()
    phases = phase_names()
    return {
        "schemaVersion": STATE_SCHEMA_VERSION,
        "workspaceVersion": version,
        "createdAt": now,
        "updatedAt": now,
        "repository": repository_record(identity, identity["revision"]),
        "scope": scope,
        "output": {"directory": output_dir},
        "versioning": versioning,
        "currentPhase": phases[0],
        "activeUnit": None,
        "phases": {name: {"status": STATUS_PENDING, "updatedAt": None} for name in phases},
        "units": [],
        "invalidations": [],
        "lastCheckpoint": None,
    }


def repository_record(identity: dict, baseline: Optional[str]) -> dict:
    return {
        "name": identity["name"],
        "remote": identity["remote"],
        "rootCommit": identity["rootCommit"],
        "branch": identity["branch"],
        "baselineRevision": baseline,
        "currentRevision": identity["revision"],
    }


def read_state_file(workspace: Path) -> Tuple[Optional[Any], Optional[str]]:
    path = workspace / STATE_FILE
    if not path.exists():
        return None, "state.json missing"
    try:
        return read_json(path), None
    except DiscoveryError as exc:
        return None, exc.message


def inspect_state(workspace: Path, identity: dict) -> StateInspection:
    data, problem = read_state_file(workspace)
    if problem:
        return StateInspection(None, [problem], [], False, [])
    if not isinstance(data, dict):
        return StateInspection(None, ["state.json must contain a JSON object"], [], False, [])
    if data.get("schemaVersion") == LEGACY_STATE_SCHEMA_VERSION:
        message = "state.json uses schemaVersion 1; run `workspace.py migrate` (a backup is created first)"
        return StateInspection(data, [message], [], True, [])
    errors = validate(data, load_schema(STATE_SCHEMA))
    if errors:
        return StateInspection(data, errors, [], False, [])
    identity_errors, warnings = identity_findings(data["repository"], identity)
    errors = consistency_errors(data, workspace) + identity_errors
    return StateInspection(data, errors, warnings, False, identity_errors)


def consistency_errors(data: dict, workspace: Path) -> List[str]:
    return _phase_errors(data) + _unit_errors(data) + _invalidation_errors(data) + _checkpoint_errors(data, workspace)


def _phase_errors(data: dict) -> List[str]:
    names = phase_names()
    errors = [f"phase {name!r} missing from phases" for name in names if name not in data["phases"]]
    if data["currentPhase"] == PHASE_COMPLETE:
        incomplete = [name for name in names if data["phases"].get(name, {}).get("status") != STATUS_COMPLETE]
        if incomplete:
            errors.append(f"currentPhase is complete but these phases are not: {', '.join(incomplete)}")
    return errors


def _unit_errors(data: dict) -> List[str]:
    ids = [unit["id"] for unit in data["units"]]
    errors = [f"unit id {unit_id!r} is duplicated" for unit_id in sorted({i for i in ids if ids.count(i) > 1})]
    errors.extend(_active_unit_errors(data))
    for unit in data["units"]:
        errors.extend(_dependency_errors(unit, set(ids)))
    return errors


def _active_unit_errors(data: dict) -> List[str]:
    active = data["activeUnit"]
    errors = [
        f"unit {unit['id']!r} is in_progress but activeUnit is {active!r}"
        for unit in data["units"]
        if unit["status"] == STATUS_IN_PROGRESS and unit["id"] != active
    ]
    if active is None:
        return errors
    unit = find_unit(data, active)
    if unit is None:
        errors.append(f"activeUnit {active!r} is not a known unit")
    elif unit["status"] != STATUS_IN_PROGRESS:
        errors.append(f"activeUnit {active!r} has status {unit['status']!r}; expected in_progress")
    return errors


def _dependency_errors(unit: dict, known: set) -> List[str]:
    return [
        f"unit {unit['id']!r} has invalid dependency {dependency!r}"
        for dependency in unit["dependsOn"]
        if dependency == unit["id"] or dependency not in known
    ]


def _invalidation_errors(data: dict) -> List[str]:
    known = {unit["id"] for unit in data["units"]}
    return [f"invalidation references unknown unit {item['unit']!r}" for item in data["invalidations"] if item["unit"] not in known]


def _checkpoint_errors(data: dict, workspace: Path) -> List[str]:
    referenced = [data["lastCheckpoint"]] if data["lastCheckpoint"] else []
    referenced.extend(checkpoint for unit in data["units"] for checkpoint in unit["checkpointIds"])
    return [
        f"checkpoint {checkpoint!r} referenced by state.json does not exist"
        for checkpoint in sorted(set(referenced))
        if not checkpoint_path(workspace, checkpoint).exists()
    ]


def load_valid_state(workspace: Path, identity: dict, allow_identity_mismatch: bool = False) -> dict:
    if not (workspace / STATE_FILE).exists():
        raise DiscoveryError("workspace is not initialized", EXIT_UNHEALTHY, hint="run workspace.py init")
    inspection = inspect_state(workspace, identity)
    errors = inspection.errors
    if allow_identity_mismatch:
        errors = [error for error in errors if error not in inspection.identity_errors]
    if errors:
        hint = "run workspace.py migrate" if inspection.needs_migration else "run workspace.py validate and repair state.json from a backup"
        raise DiscoveryError("state.json is not valid: " + "; ".join(errors), EXIT_UNHEALTHY, hint=hint)
    return inspection.data


def save_state(workspace: Path, data: dict, identity: dict) -> None:
    data["updatedAt"] = utc_now()
    data["repository"]["currentRevision"] = identity["revision"]
    errors = validate(data, load_schema(STATE_SCHEMA))
    errors = errors or consistency_errors(data, workspace)
    if errors:
        raise DiscoveryError("refusing to write invalid state: " + "; ".join(errors), EXIT_USAGE)
    write_json_atomic(workspace / STATE_FILE, data)


def find_unit(data: dict, unit_id: str) -> Optional[dict]:
    for unit in data["units"]:
        if unit["id"] == unit_id:
            return unit
    return None


def require_unit(data: dict, unit_id: Optional[str]) -> Optional[dict]:
    if unit_id is None:
        return None
    unit = find_unit(data, unit_id)
    if unit is None:
        raise DiscoveryError(f"unknown unit {unit_id!r}", EXIT_USAGE, hint="add it with workspace.py unit add")
    return unit


def unit_ids(data: Optional[dict]) -> Dict[str, dict]:
    return {unit["id"]: unit for unit in (data or {}).get("units", [])}


def whole_scope_unit_ids(data: dict) -> List[str]:
    scopes = set(REPOSITORY_ROOT_PATHS) | ({data["scope"]} if data.get("scope") else set())
    return [unit["id"] for unit in data["units"] if any(path.strip("/") in scopes for path in unit["paths"])]


def reachability_required_by(data: dict, unit_id: Optional[str]) -> List[str]:
    whole = whole_scope_unit_ids(data)
    if unit_id is None:
        return whole
    return [unit_id] if unit_id in whole else []


def whole_scope_reason(unit_ids_covering: List[str]) -> str:
    return f"unit {', '.join(unit_ids_covering)} covers the whole analysis scope, so its reachability code cannot tell areas apart"
