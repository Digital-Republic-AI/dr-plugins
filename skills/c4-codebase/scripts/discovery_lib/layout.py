from __future__ import annotations

from pathlib import Path

from .constants import WORKSPACE_GITIGNORE_NAME

STATE_FILE = "state.json"
EVIDENCE_FILE = "evidence.jsonl"
HYPOTHESES_FILE = "hypotheses.jsonl"
QUESTIONS_FILE = "questions.jsonl"
QUESTIONS_MARKDOWN_FILE = "questions.md"
LEGACY_QUESTIONS_MARKDOWN_FILE = "questions.legacy.md"
INVENTORY_FILE = "inventory.md"
SCAN_JSON_FILE = "scan.json"
SCAN_MARKDOWN_FILE = "scan.md"
CHECKPOINTS_DIR = "checkpoints"
PERSPECTIVES_DIR = "perspectives"
MODEL_DIR = "model"
BACKUPS_DIR = "backups"
TEMPLATES_DIR = "templates"
CHECKPOINT_SUFFIX = ".json"
DSL_FILE_NAME = "workspace.dsl"
README_FILE_NAME = "README.md"

PERSPECTIVE_NAMES = ("stack", "structure", "architecture", "conventions", "integrations", "testing", "concerns")

TEMPLATE_TARGETS = {
    INVENTORY_FILE: INVENTORY_FILE,
    **{f"{PERSPECTIVES_DIR}/{name}.md": f"{name}.md" for name in PERSPECTIVE_NAMES},
    f"{MODEL_DIR}/{DSL_FILE_NAME}": DSL_FILE_NAME,
}
PUBLICATION_TEMPLATES = (README_FILE_NAME,)

EMPTY_LEDGER_FILES = (EVIDENCE_FILE, HYPOTHESES_FILE, QUESTIONS_FILE)
REQUIRED_DIRS = (CHECKPOINTS_DIR, PERSPECTIVES_DIR, MODEL_DIR)
REQUIRED_FILES = (
    STATE_FILE,
    *EMPTY_LEDGER_FILES,
    QUESTIONS_MARKDOWN_FILE,
    WORKSPACE_GITIGNORE_NAME,
    *TEMPLATE_TARGETS,
)
PUBLISHED_FILES = (README_FILE_NAME, *[f"{name.upper()}.md" for name in PERSPECTIVE_NAMES], DSL_FILE_NAME)
BACKUP_ITEMS = (
    STATE_FILE,
    *EMPTY_LEDGER_FILES,
    QUESTIONS_MARKDOWN_FILE,
    INVENTORY_FILE,
    CHECKPOINTS_DIR,
    PERSPECTIVES_DIR,
    MODEL_DIR,
)

LEDGER_EVIDENCE = "evidence"
LEDGER_HYPOTHESIS = "hypothesis"
LEDGER_QUESTION = "question"
LEDGER_FILES = {
    LEDGER_EVIDENCE: EVIDENCE_FILE,
    LEDGER_HYPOTHESIS: HYPOTHESES_FILE,
    LEDGER_QUESTION: QUESTIONS_FILE,
}
ID_PREFIXES = {
    LEDGER_EVIDENCE: "ev",
    LEDGER_HYPOTHESIS: "hyp",
    LEDGER_QUESTION: "q",
}
CHECKPOINT_ID_PREFIX = "cp"


def checkpoint_path(workspace: Path, checkpoint_id: str) -> Path:
    return workspace / CHECKPOINTS_DIR / f"{checkpoint_id}{CHECKPOINT_SUFFIX}"
