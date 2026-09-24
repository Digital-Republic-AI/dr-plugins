from __future__ import annotations

from typing import Iterable, List, Optional, Set

from .layout import CHECKPOINTS_DIR, EVIDENCE_FILE, HYPOTHESES_FILE, QUESTIONS_FILE
from .ledger import current_records, effective_records
from .state import reachability_required_by, unit_ids, whole_scope_reason
from .vocabulary import CONFIRMING_KINDS, HYPOTHESIS_CONFIRMED, HYPOTHESIS_REJECTED


def ids_of(records: Iterable[dict]) -> Set[str]:
    return {record["id"] for record in records}


def ledger_reference_errors(state: Optional[dict], evidence: List[dict], hypotheses: List[dict],
                            questions: List[dict], checkpoints: List[dict]) -> List[str]:
    units = set(unit_ids(state)) if state else None
    known = {"evidence": ids_of(evidence), "hypothesis": ids_of(hypotheses), "question": ids_of(questions)}
    errors: List[str] = []
    errors.extend(_evidence_errors(evidence, units, known))
    errors.extend(_hypothesis_errors(hypotheses, units, known))
    errors.extend(_question_errors(questions, units, known))
    errors.extend(_checkpoint_errors(checkpoints, units, known))
    for file_name, records in ((EVIDENCE_FILE, evidence), (HYPOTHESES_FILE, hypotheses), (QUESTIONS_FILE, questions)):
        errors.extend(_supersedes_order_errors(file_name, records))
    return errors


def _missing(location: str, values: Iterable[Optional[str]], known: Set[str], label: str) -> List[str]:
    return [f"{location}: unknown {label} {value!r}" for value in values if value and value not in known]


def _unit_error(location: str, unit: Optional[str], units: Optional[Set[str]]) -> List[str]:
    if unit is None or units is None or unit in units:
        return []
    return [f"{location}: unknown unit {unit!r}"]


def _evidence_errors(records: List[dict], units: Optional[Set[str]], known: dict) -> List[str]:
    errors: List[str] = []
    for record in records:
        location = f"{EVIDENCE_FILE} {record['id']}"
        errors.extend(_unit_error(location, record.get("unit"), units))
        errors.extend(_missing(location, [record.get("questionId")], known["question"], "question"))
    return errors


def _hypothesis_errors(records: List[dict], units: Optional[Set[str]], known: dict) -> List[str]:
    errors: List[str] = []
    for record in records:
        location = f"{HYPOTHESES_FILE} {record['id']}"
        errors.extend(_unit_error(location, record.get("unit"), units))
        errors.extend(_missing(location, record["evidence"], known["evidence"], "evidence"))
        errors.extend(_missing(location, record.get("questionIds", []), known["question"], "question"))
    return errors


def _question_errors(records: List[dict], units: Optional[Set[str]], known: dict) -> List[str]:
    errors: List[str] = []
    for record in records:
        location = f"{QUESTIONS_FILE} {record['id']}"
        errors.extend(_unit_error(location, record.get("unit"), units))
        errors.extend(_missing(location, record.get("hypothesisIds", []), known["hypothesis"], "hypothesis"))
        errors.extend(_missing(location, [record.get("answerEvidence")], known["evidence"], "evidence"))
    return errors


def _checkpoint_errors(records: List[dict], units: Optional[Set[str]], known: dict) -> List[str]:
    errors: List[str] = []
    for record in records:
        location = f"{CHECKPOINTS_DIR}/{record['id']}"
        errors.extend(_unit_error(location, record.get("unit"), units))
        errors.extend(_missing(location, record["evidenceIds"], known["evidence"], "evidence"))
        errors.extend(_missing(location, record["hypothesisIds"], known["hypothesis"], "hypothesis"))
        errors.extend(_missing(location, record["openQuestionIds"], known["question"], "question"))
    return errors


def _supersedes_order_errors(file_name: str, records: List[dict]) -> List[str]:
    errors: List[str] = []
    seen: Set[str] = set()
    for record in records:
        target = record.get("supersedes")
        if target and (target == record["id"] or target not in seen):
            errors.append(f"{file_name} {record['id']}: supersedes {target!r}, which is not an earlier record")
        seen.add(record["id"])
    return errors


def reachability_errors(state: Optional[dict], hypotheses: List[dict]) -> List[str]:
    if not state:
        return []
    errors: List[str] = []
    for record in effective_records(hypotheses):
        required_by = reachability_required_by(state, record.get("unit"))
        if required_by and record["status"] != HYPOTHESIS_REJECTED and record.get("reachability") is None:
            errors.append(
                f"{HYPOTHESES_FILE} {record['id']}: no reachability code; {whole_scope_reason(required_by)} "
                f"(hypothesis revise --id {record['id']} --reachability <code>)"
            )
    return errors


def confirmation_warnings(hypotheses: List[dict], evidence: List[dict]) -> List[str]:
    kinds = {record["id"]: record["kind"] for record in evidence}
    return [
        f"hypothesis {record['id']} is confirmed without user_confirmation or documentation evidence"
        for record in current_records(hypotheses).values()
        if record["status"] == HYPOTHESIS_CONFIRMED and not any(kinds.get(item) in CONFIRMING_KINDS for item in record["evidence"])
    ]
