from __future__ import annotations

from collections import OrderedDict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .checkpoints import read_checkpoints
from .constants import VERSIONING_SHARED
from .context import Context
from .documents import Document, label_index, scan_documents, working_documents
from .dsl_lint import lint_file
from .layout import CHECKPOINTS_DIR, DSL_FILE_NAME, LEDGER_EVIDENCE, LEDGER_FILES, LEDGER_HYPOTHESIS, LEDGER_QUESTION, MODEL_DIR
from .ledger import LedgerView, effective_records, read_ledger
from .locations import resolve_output_directory
from .publication import published_targets, skill_documents
from .questions_view import questions_markdown_in_sync
from .references import confirmation_warnings, ledger_reference_errors, reachability_errors
from .secret_scan import record_secret_findings
from .state import inspect_state
from .status import artifact_rows
from .vocabulary import QUESTION_OPEN

OUT_OF_SYNC_QUESTIONS = "questions.md is out of date; run workspace.py question render"


def validation_report(ctx: Context) -> dict:
    workspace = ctx.workspace.path
    inspection = inspect_state(workspace, ctx.identity)
    state = None if inspection.errors else inspection.data
    ledgers = {kind: read_ledger(workspace, kind) for kind in LEDGER_FILES}
    checkpoints, checkpoint_errors = read_checkpoints(workspace)
    evidence = ledgers[LEDGER_EVIDENCE].records
    hypotheses = ledgers[LEDGER_HYPOTHESIS].records
    questions = ledgers[LEDGER_QUESTION].records
    index = label_index({kind: view.records for kind, view in ledgers.items()})
    documents = working_documents(workspace) + _published_documents(ctx, state)
    findings = scan_documents(documents, index, shared=bool(state) and state["versioning"] == VERSIONING_SHARED)
    errors = OrderedDict()
    errors["state"] = inspection.errors
    errors["artifacts"] = [f"missing {row['path']}" for row in artifact_rows(workspace) if not row["exists"]]
    errors["evidence"] = ledgers[LEDGER_EVIDENCE].errors
    errors["hypotheses"] = ledgers[LEDGER_HYPOTHESIS].errors
    errors["questions"] = ledgers[LEDGER_QUESTION].errors
    errors["checkpoints"] = checkpoint_errors
    errors["references"] = ledger_reference_errors(state, evidence, hypotheses, questions, list(checkpoints.values()))
    errors["reachability"] = reachability_errors(state, hypotheses)
    errors["secrets"] = _secret_errors(ledgers, checkpoints) + findings.secrets
    errors["claimLabels"] = findings.label_errors
    errors["questionsMarkdown"] = [] if questions_markdown_in_sync(workspace, questions) else [OUT_OF_SYNC_QUESTIONS]
    dsl_errors, dsl_warnings = model_lint(workspace)
    errors["dsl"] = dsl_errors
    return {
        "valid": not any(errors.values()),
        "errors": errors,
        "warnings": inspection.warnings + confirmation_warnings(hypotheses, evidence) + findings.label_warnings + dsl_warnings,
        "counts": {
            "evidence": len(evidence),
            "hypotheses": len(effective_records(hypotheses)),
            "openQuestions": sum(1 for record in effective_records(questions) if record["status"] == QUESTION_OPEN),
            "checkpoints": len(checkpoints),
            "documents": len(documents),
        },
    }


def _published_documents(ctx: Context, state: Optional[dict]) -> List[Document]:
    if not state:
        return []
    directory = resolve_output_directory(ctx.target.root, state["output"]["directory"])
    return skill_documents(ctx.target.root, directory, published_targets(directory))


def _secret_errors(ledgers: Dict[str, LedgerView], checkpoints: Dict[str, dict]) -> List[str]:
    findings: List[str] = []
    for kind, view in ledgers.items():
        for record in view.records:
            findings.extend(record_secret_findings(f"{LEDGER_FILES[kind]} {record['id']}", record))
    for checkpoint_id, record in checkpoints.items():
        findings.extend(record_secret_findings(f"{CHECKPOINTS_DIR}/{checkpoint_id}", record))
    return findings


def model_lint(workspace: Path) -> Tuple[List[str], List[str]]:
    path = workspace / MODEL_DIR / DSL_FILE_NAME
    if not path.is_file():
        return [], []
    _, report = lint_file(path)
    warnings = report.warnings if report.counts["elements"] else []
    return [f"{MODEL_DIR}/{line}" for line in report.errors], [f"{MODEL_DIR}/{line}" for line in warnings]
