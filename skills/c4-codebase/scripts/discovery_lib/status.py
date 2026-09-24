from __future__ import annotations

import datetime as dt
import json
from collections import Counter
from pathlib import Path
from typing import Any, List, Optional

from .constants import (
    STATUS_EXISTS_COLUMN_WIDTH,
    STATUS_MODIFIED_COLUMN_WIDTH,
    STATUS_PATH_COLUMN_WIDTH,
    STATUS_SIZE_COLUMN_WIDTH,
)
from .context import Context
from .errors import DiscoveryError
from .fsutil import sha256_prefix
from .layout import REQUIRED_FILES, SCAN_JSON_FILE, SCAN_MARKDOWN_FILE
from .ownership import changed_since, owned_paths, working_tree
from .resume import next_step
from .skillmeta import skill_version
from .state import StateInspection, inspect_state
from .vocabulary import NEXT_INITIALIZE, NEXT_MIGRATE, NEXT_REPAIR

IDENTITY_FIELDS = ("name", "remote", "rootCommit", "branch", "revision")
MISSING_VALUE = "-"


def artifact_rows(workspace: Path) -> List[dict]:
    now = dt.datetime.now(dt.timezone.utc).timestamp()
    return [_artifact_row(workspace, relative, now) for relative in REQUIRED_FILES]


def _artifact_row(workspace: Path, relative: str, now: float) -> dict:
    path = workspace / relative
    if not path.exists():
        return {"path": relative, "exists": False, "modifiedAt": None, "ageSeconds": None, "sizeBytes": None, "sha256_16": None}
    info = path.stat()
    modified = dt.datetime.fromtimestamp(info.st_mtime, dt.timezone.utc).replace(microsecond=0).isoformat()
    return {
        "path": relative,
        "exists": True,
        "modifiedAt": modified,
        "ageSeconds": max(0, int(now - info.st_mtime)),
        "sizeBytes": info.st_size,
        "sha256_16": sha256_prefix(path),
    }


def inspect_workspace(ctx: Context) -> StateInspection:
    if not ctx.workspace.path.exists():
        return StateInspection(None, ["workspace not initialized"], [], False, [])
    return inspect_state(ctx.workspace.path, ctx.identity)


def build_status(ctx: Context) -> dict:
    workspace = ctx.workspace.path
    exists = workspace.exists()
    inspection = inspect_workspace(ctx)
    rows = artifact_rows(workspace)
    missing = [row["path"] for row in rows if not row["exists"]]
    state = None if inspection.errors else inspection.data
    owned = owned_paths(ctx, state)
    tree = working_tree(ctx.target, owned)
    warnings = _warnings(ctx, state)
    baseline = _baseline(inspection.data)
    current = ctx.identity["revision"]
    revision_changed = bool(baseline and current and baseline != current and changed_since(ctx.target.git, baseline, owned))
    return {
        "skillVersion": _skill_version(warnings),
        "repository": dict({field: ctx.identity[field] for field in IDENTITY_FIELDS}, isGit=ctx.target.is_git),
        "requestedScope": ctx.target.scope,
        "stateScope": state["scope"] if state else None,
        "workspace": {"path": str(workspace), "source": ctx.workspace.source, "exists": exists},
        "firstRun": not exists,
        "healthy": exists and not inspection.errors and not missing,
        "stateValid": exists and not inspection.errors,
        "needsMigration": inspection.needs_migration,
        "stateErrors": inspection.errors if exists else [],
        "stateWarnings": inspection.warnings,
        "currentPhase": state["currentPhase"] if state else None,
        "activeUnit": state["activeUnit"] if state else None,
        "unitCounts": dict(Counter(unit["status"] for unit in state["units"])) if state else {},
        "next": _next(exists, inspection, missing, state),
        "baselineRevision": baseline,
        "currentRevision": current,
        "revisionChanged": revision_changed,
        "dirty": tree["dirty"],
        "dirtyPaths": tree["dirtyPaths"],
        "dirtyPathsTruncated": tree["dirtyPathsTruncated"],
        "missingArtifacts": missing if exists else [],
        "requiredArtifacts": rows,
        "scanArtifacts": {"json": (workspace / SCAN_JSON_FILE).exists(), "markdown": (workspace / SCAN_MARKDOWN_FILE).exists()},
        "warnings": warnings,
    }


def _skill_version(warnings: List[str]) -> Optional[str]:
    try:
        return skill_version()
    except DiscoveryError as exc:
        warnings.append(f"skill version unavailable: {exc.message}")
        return None


def _warnings(ctx: Context, state: Optional[dict]) -> List[str]:
    warnings = list(ctx.target.git.warnings) + list(ctx.target.warnings)
    if state and ctx.target.scope and ctx.target.scope != state["scope"]:
        warnings.append(f"requested scope {ctx.target.scope!r} differs from the workspace scope {state['scope']!r}")
    return warnings


def _baseline(data: Any) -> Optional[str]:
    repository = data.get("repository") if isinstance(data, dict) else None
    value = repository.get("baselineRevision") if isinstance(repository, dict) else None
    return value if isinstance(value, str) else None


def _next(exists: bool, inspection: StateInspection, missing: List[str], state: Optional[dict]) -> dict:
    if not exists:
        return {"kind": NEXT_INITIALIZE, "id": None, "reason": "no workspace: ask the versioning question, then run init"}
    if inspection.needs_migration:
        return {"kind": NEXT_MIGRATE, "id": None, "reason": "legacy state: run migrate"}
    if inspection.errors or missing:
        return {"kind": NEXT_REPAIR, "id": None, "reason": "run init to recreate missing artifacts and resolve stateErrors"}
    return next_step(state)


def render_status(status: dict) -> None:
    next_item = status["next"]
    lines = [
        f"Workspace: {status['workspace']['path']} ({status['workspace']['source']})",
        f"Healthy: {_yes_no(status['healthy'])}",
        f"State: {'valid' if status['stateValid'] else 'invalid'}",
        f"Current phase: {status['currentPhase'] or MISSING_VALUE}",
        f"Active unit: {status['activeUnit'] or MISSING_VALUE}",
        f"Next: {next_item['kind']} {next_item['id'] or ''} ({next_item['reason']})",
        f"Revision changed: {_yes_no(status['revisionChanged'])}",
        f"Uncommitted changes: {MISSING_VALUE if status['dirty'] is None else _yes_no(status['dirty'])}",
    ]
    lines.extend(f"State error: {error}" for error in status["stateErrors"])
    lines.extend(f"Warning: {warning}" for warning in status["stateWarnings"] + status["warnings"])
    lines.append("")
    lines.extend(_artifact_table(status["requiredArtifacts"]))
    print("\n".join(lines))


def _artifact_table(rows: List[dict]) -> List[str]:
    header = (
        f"{'artifact':{STATUS_PATH_COLUMN_WIDTH}} {'exists':{STATUS_EXISTS_COLUMN_WIDTH}} "
        f"{'modified (UTC)':{STATUS_MODIFIED_COLUMN_WIDTH}} {'size':>{STATUS_SIZE_COLUMN_WIDTH}}"
    )
    lines = [header, "-" * len(header)]
    for row in rows:
        size = MISSING_VALUE if row["sizeBytes"] is None else str(row["sizeBytes"])
        lines.append(
            f"{row['path'][:STATUS_PATH_COLUMN_WIDTH]:{STATUS_PATH_COLUMN_WIDTH}} "
            f"{str(row['exists']).lower():{STATUS_EXISTS_COLUMN_WIDTH}} "
            f"{(row['modifiedAt'] or MISSING_VALUE):{STATUS_MODIFIED_COLUMN_WIDTH}} {size:>{STATUS_SIZE_COLUMN_WIDTH}}"
        )
    return lines


def _yes_no(value: bool) -> str:
    return "yes" if value else "no"


def render_mapping(result: dict) -> None:
    for key, value in result.items():
        rendered = json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else value
        print(f"{key}: {rendered}")
