from __future__ import annotations

from pathlib import Path
from typing import List, NamedTuple, Optional

from .fsutil import sha256_prefix, utc_now
from .vocabulary import QUESTION_OPEN


class EvidenceInput(NamedTuple):
    kind: str
    observation: str
    path: Optional[str] = None
    lines: Optional[str] = None
    command: Optional[str] = None
    unit: Optional[str] = None
    intent: bool = False
    question_id: Optional[str] = None
    supersedes: Optional[str] = None


def evidence_record(record_id: str, item: EvidenceInput, root: Path, revision: Optional[str], dirty: Optional[bool]) -> dict:
    return {
        "id": record_id,
        "kind": item.kind,
        "intent": item.intent,
        "path": item.path,
        "lines": item.lines,
        "command": item.command,
        "observation": item.observation,
        "unit": item.unit,
        "questionId": item.question_id,
        "repositoryRevision": revision,
        "dirty": dirty,
        "fingerprint": sha256_prefix(root / item.path) if item.path else None,
        "supersedes": item.supersedes,
        "capturedAt": utc_now(),
    }


def hypothesis_record(record_id: str, claim: str, evidence: List[str], confidence: str, status: str, unit: Optional[str],
                      reachability: Optional[str], question_ids: List[str], supersedes: Optional[str]) -> dict:
    return {
        "id": record_id,
        "claim": claim,
        "evidence": evidence,
        "confidence": confidence,
        "status": status,
        "unit": unit,
        "reachability": reachability,
        "questionIds": question_ids,
        "supersedes": supersedes,
        "recordedAt": utc_now(),
    }


def question_record(record_id: str, question: str, impact: str, unit: Optional[str] = None,
                    hypothesis_ids: Optional[List[str]] = None, supersedes: Optional[str] = None) -> dict:
    return {
        "id": record_id,
        "question": question,
        "impact": impact,
        "status": QUESTION_OPEN,
        "unit": unit,
        "hypothesisIds": hypothesis_ids or [],
        "answer": None,
        "answerEvidence": None,
        "dismissalReason": None,
        "supersedes": supersedes,
        "recordedAt": utc_now(),
    }


def revision(record: dict, **changes) -> dict:
    updated = dict(record)
    updated.update(changes)
    updated["recordedAt"] = utc_now()
    return updated
