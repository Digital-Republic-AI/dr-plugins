from __future__ import annotations

from typing import Optional

from .state import phase_names
from .vocabulary import (
    NEXT_NONE,
    NEXT_PHASE,
    NEXT_UNIT,
    PHASE_COMPLETE,
    STATUS_COMPLETE,
    STATUS_INVALIDATED,
    STATUS_PENDING,
)


def next_step(state: dict) -> dict:
    if state["currentPhase"] == PHASE_COMPLETE:
        return _step(NEXT_NONE, None, "analysis is complete")
    return _unit_step(state) or _phase_step(state)


def _step(kind: str, identifier: Optional[str], reason: str) -> dict:
    return {"kind": kind, "id": identifier, "reason": reason}


def _unit_step(state: dict) -> Optional[dict]:
    units = state["units"]
    if state["activeUnit"]:
        return _step(NEXT_UNIT, state["activeUnit"], "resume the active unit")
    for unit in units:
        if unit["status"] == STATUS_INVALIDATED:
            return _step(NEXT_UNIT, unit["id"], "revalidate the earliest invalidated unit")
    complete = {unit["id"] for unit in units if unit["status"] == STATUS_COMPLETE}
    for unit in units:
        if unit["status"] == STATUS_PENDING and set(unit["dependsOn"]) <= complete:
            return _step(NEXT_UNIT, unit["id"], "investigate the earliest pending unit whose dependencies are complete")
    return None


def _phase_step(state: dict) -> dict:
    for name in phase_names():
        status = state["phases"][name]["status"]
        if status != STATUS_COMPLETE:
            return _step(NEXT_PHASE, name, f"earliest incomplete phase (status {status})")
    return _step(NEXT_PHASE, PHASE_COMPLETE, "all phases complete; mark the analysis complete")
