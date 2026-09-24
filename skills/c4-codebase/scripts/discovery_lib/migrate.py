from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, List, NamedTuple, Optional

from .constants import DEFAULT_OUTPUT_DIR, VERSIONING_SHARED
from .fsutil import utc_now
from .layout import checkpoint_path
from .schema import definition_enum, load_schema
from .state import new_state, phase_names
from .vocabulary import (
    PHASE_COMPLETE,
    PHASE_PUBLICATION,
    STATE_SCHEMA,
    STATUS_IN_PROGRESS,
    STATUS_INVALIDATED,
    STATUS_PENDING,
    UNIT_TYPE_OTHER,
)

UNIT_ID_INVALID_CHARACTERS = re.compile(r"[^a-z0-9-]+")
CHECKPOINT_ID = re.compile(r"^cp-[0-9]{3,}$")
FALLBACK_UNIT_ID = "unit"
ROOT_SCOPE = "."
MIGRATION_REASON = "migrated from schemaVersion 1"


class MigrationResult(NamedTuple):
    state: dict
    questions: List[str]
    warnings: List[str]


def migrate_state(workspace: Path, legacy: dict, identity: dict, version: str) -> MigrationResult:
    warnings: List[str] = []
    state = new_state(identity, None, DEFAULT_OUTPUT_DIR, VERSIONING_SHARED, version)
    state["createdAt"] = _text(legacy.get("createdAt")) or state["createdAt"]
    state["repository"]["baselineRevision"] = _text(_mapping(legacy.get("repository")).get("baselineRevision"))
    state["phases"].update(_migrate_phases(legacy.get("phases"), warnings))
    state["currentPhase"] = _migrate_current_phase(legacy.get("currentPhase"), warnings)
    renamed = _migrate_units(state, legacy.get("units"), warnings)
    _migrate_active_unit(state, renamed.get(_text(legacy.get("activeUnit")) or ""), warnings)
    _migrate_invalidations(state, legacy.get("invalidatedUnits"), renamed, warnings)
    state["lastCheckpoint"] = _migrate_checkpoint(workspace, legacy.get("lastCheckpoint"), warnings)
    warnings.append("repository identity is now the root commit and remote; the legacy absolute root path was discarded")
    questions = [item.strip() for item in _items(legacy.get("unresolvedQuestions")) if isinstance(item, str) and item.strip()]
    return MigrationResult(state, questions, warnings)


def _text(value: Any) -> Optional[str]:
    return value if isinstance(value, str) and value else None


def _mapping(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _items(value: Any) -> list:
    return value if isinstance(value, list) else []


def _statuses() -> List[str]:
    return definition_enum(load_schema(STATE_SCHEMA), "status")


def _migrate_phases(raw: Any, warnings: List[str]) -> Dict[str, dict]:
    migrated: Dict[str, dict] = {}
    for name, entry in _mapping(raw).items():
        status = _mapping(entry).get("status")
        if name in phase_names() and status in _statuses():
            migrated[name] = {"status": status, "updatedAt": None}
        else:
            warnings.append(f"dropped legacy phase entry {name!r}")
    return migrated


def _migrate_current_phase(raw: Any, warnings: List[str]) -> str:
    if raw == PHASE_COMPLETE:
        warnings.append("publication is now a tracked phase; currentPhase set to publication until publish-check passes")
        return PHASE_PUBLICATION
    if raw in phase_names():
        return raw
    warnings.append(f"unknown legacy currentPhase {raw!r}; reset to {phase_names()[0]}")
    return phase_names()[0]


def _migrate_units(state: dict, raw: Any, warnings: List[str]) -> Dict[str, str]:
    renamed: Dict[str, str] = {}
    for item in _items(raw):
        if not isinstance(item, dict):
            warnings.append("dropped a legacy unit that is not an object")
            continue
        unit = _migrate_unit(item, warnings)
        if unit["id"] in renamed.values():
            warnings.append(f"dropped duplicated legacy unit {unit['id']!r}")
            continue
        renamed[str(item.get("id"))] = unit["id"]
        state["units"].append(unit)
    return renamed


def _migrate_unit(item: dict, warnings: List[str]) -> dict:
    raw_id = str(item.get("id") or FALLBACK_UNIT_ID)
    unit_id = UNIT_ID_INVALID_CHARACTERS.sub("-", raw_id.lower()).strip("-") or FALLBACK_UNIT_ID
    if unit_id != raw_id:
        warnings.append(f"unit id {raw_id!r} renamed to {unit_id!r}")
    types = definition_enum(load_schema(STATE_SCHEMA), "unitType")
    raw_type = _text(item.get("type"))
    status = item.get("status") if item.get("status") in _statuses() else STATUS_PENDING
    if status != item.get("status"):
        warnings.append(f"unit {unit_id!r} had invalid status {item.get('status')!r}; reset to pending")
    return {
        "id": unit_id,
        "description": f"legacy type: {raw_type}" if raw_type and raw_type not in types else None,
        "paths": [_text(item.get("scope")) or ROOT_SCOPE],
        "type": raw_type if raw_type in types else UNIT_TYPE_OTHER,
        "status": status,
        "reachability": None,
        "dependsOn": [],
        "analyzedRevision": _text(item.get("analyzedRevision")),
        "checkpointIds": [],
    }


def _migrate_active_unit(state: dict, active: Optional[str], warnings: List[str]) -> None:
    for unit in state["units"]:
        if unit["status"] == STATUS_IN_PROGRESS and unit["id"] != active:
            unit["status"] = STATUS_PENDING
            warnings.append(f"unit {unit['id']!r} was in_progress without being active; reset to pending")
    matching = [unit for unit in state["units"] if unit["id"] == active and unit["status"] == STATUS_IN_PROGRESS]
    state["activeUnit"] = active if matching else None


def _migrate_invalidations(state: dict, raw: Any, renamed: Dict[str, str], warnings: List[str]) -> None:
    for legacy_id in _items(raw):
        unit_id = renamed.get(str(legacy_id))
        unit = next((item for item in state["units"] if item["id"] == unit_id), None)
        if unit is None:
            warnings.append(f"dropped invalidation for unknown legacy unit {legacy_id!r}")
            continue
        unit["status"] = STATUS_INVALIDATED
        if state["activeUnit"] == unit_id:
            state["activeUnit"] = None
        state["invalidations"].append(
            {"unit": unit_id, "reason": MIGRATION_REASON, "changedPaths": [], "revision": state["repository"]["currentRevision"], "at": utc_now()}
        )


def _migrate_checkpoint(workspace: Path, raw: Any, warnings: List[str]) -> Optional[str]:
    value = _text(raw)
    if value and CHECKPOINT_ID.match(value) and checkpoint_path(workspace, value).exists():
        return value
    if value:
        warnings.append(f"legacy lastCheckpoint {value!r} is not a checkpoint file id; cleared")
    return None
