from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, NamedTuple, Optional, Set, Tuple

from .constants import RECORD_ID_DIGITS
from .layout import (
    ID_PREFIXES,
    LEDGER_EVIDENCE,
    LEDGER_FILES,
    LEDGER_HYPOTHESIS,
    LEDGER_QUESTION,
    TEMPLATE_TARGETS,
)
from .ledger import current_records, read_ledger, superseded_ids
from .secret_scan import text_secret_findings
from .vocabulary import (
    HYPOTHESIS_CONFIRMED,
    LABEL_ASK_USER,
    LABEL_CONFIRMED,
    LABEL_INFERRED,
    LABEL_OBSERVED,
    QUESTION_ANSWERED,
    QUESTION_OPEN,
)

MARKDOWN_SUFFIX = ".md"
LEDGER_BY_PREFIX = {prefix: kind for kind, prefix in ID_PREFIXES.items()}
ID_PREFIX_ALTERNATION = "|".join(sorted(LEDGER_BY_PREFIX))
ID_LIKE_TOKEN = re.compile(rf"^(?:{ID_PREFIX_ALTERNATION})-")
LEDGER_ID = re.compile(rf"^({ID_PREFIX_ALTERNATION})-([0-9]{{{RECORD_ID_DIGITS},}})$")
LABEL_NAMES = (LABEL_OBSERVED, LABEL_INFERRED, LABEL_CONFIRMED, LABEL_ASK_USER)
CLAIM_LABEL = re.compile(r"\[(" + "|".join(re.escape(name) for name in LABEL_NAMES) + r")(?=[\s,\]])([^\]\n]*)\]")
TOKEN_SEPARATOR = re.compile(r"[\s,;]+")
CODE_FENCE = re.compile(r"^\s*(?:```|~~~)")
INLINE_CODE = re.compile(r"`[^`\n]*`")
LABEL_LEDGERS = {
    LABEL_OBSERVED: (LEDGER_EVIDENCE,),
    LABEL_INFERRED: (LEDGER_HYPOTHESIS,),
    LABEL_CONFIRMED: (LEDGER_QUESTION, LEDGER_HYPOTHESIS),
    LABEL_ASK_USER: (LEDGER_QUESTION,),
}
EXPECTED_STATUS = {
    (LABEL_CONFIRMED, LEDGER_QUESTION): QUESTION_ANSWERED,
    (LABEL_CONFIRMED, LEDGER_HYPOTHESIS): HYPOTHESIS_CONFIRMED,
    (LABEL_ASK_USER, LEDGER_QUESTION): QUESTION_OPEN,
}
LOCAL_LABEL_HINT = "with local versioning published labels cite paths, the confidence, or 'by the team'"


class Document(NamedTuple):
    location: str
    path: Path
    published: bool = False


class LabelIndex(NamedTuple):
    current: Dict[str, Dict[str, dict]]
    superseded: Set[str]


class DocumentFindings(NamedTuple):
    secrets: List[str]
    label_errors: List[str]
    label_warnings: List[str]


class ClaimLabel(NamedTuple):
    location: str
    name: str
    tokens: List[str]

    def text(self) -> str:
        return "[" + " ".join([self.name, *self.tokens]) + "]"


def label_index(records: Dict[str, List[dict]]) -> LabelIndex:
    current = {kind: dict(current_records(items)) for kind, items in records.items()}
    superseded: Set[str] = set()
    for items in records.values():
        superseded |= superseded_ids(items)
    return LabelIndex(current, superseded)


def read_label_index(workspace: Path) -> LabelIndex:
    return label_index({kind: read_ledger(workspace, kind).records for kind in LEDGER_FILES})


def working_documents(workspace: Path) -> List[Document]:
    return [Document(relative, workspace / relative) for relative in TEMPLATE_TARGETS if (workspace / relative).is_file()]


def scan_documents(documents: Iterable[Document], index: LabelIndex, shared: bool) -> DocumentFindings:
    findings = DocumentFindings([], [], [])
    for document in documents:
        text, problem = _read(document.path)
        if problem:
            findings.secrets.append(f"{document.location}: cannot be checked for secrets or claim labels: {problem}")
            continue
        findings.secrets.extend(text_secret_findings(document.location, text))
        if document.path.suffix != MARKDOWN_SUFFIX:
            continue
        cite_ids = shared or not document.published
        for label in _claim_labels(document.location, text):
            errors, warnings = _check_label(label, index, cite_ids, document.published)
            findings.label_errors.extend(errors)
            findings.label_warnings.extend(warnings)
    return findings


def _read(path: Path) -> Tuple[str, Optional[str]]:
    try:
        return path.read_text(encoding="utf-8", errors="replace"), None
    except OSError as exc:
        return "", str(exc.strerror or exc)


def _prose_lines(text: str) -> Iterator[Tuple[int, str]]:
    fenced = False
    for number, line in enumerate(text.splitlines(), start=1):
        if CODE_FENCE.match(line):
            fenced = not fenced
            continue
        if not fenced:
            yield number, INLINE_CODE.sub("", line)


def _claim_labels(location: str, text: str) -> Iterator[ClaimLabel]:
    for number, line in _prose_lines(text):
        for match in CLAIM_LABEL.finditer(line):
            tokens = [token for token in TOKEN_SEPARATOR.split(match.group(2)) if token]
            yield ClaimLabel(f"{location}:{number}", match.group(1), tokens)


def _is_placeholder(token: str) -> bool:
    match = LEDGER_ID.match(token)
    return bool(match) and int(match.group(2)) == 0


def _check_label(label: ClaimLabel, index: LabelIndex, cite_ids: bool, published: bool) -> Tuple[List[str], List[str]]:
    ids = [token for token in label.tokens if ID_LIKE_TOKEN.match(token)]
    placeholders = [token for token in ids if _is_placeholder(token)]
    if placeholders:
        errors = [f"{label.location}: {label.text()} keeps the template placeholder {placeholders[0]}"] if published else []
        return errors, []
    if not cite_ids:
        return [f"{label.location}: {label.text()} cites ledger id {token}; {LOCAL_LABEL_HINT}" for token in ids], []
    if not ids:
        return [f"{label.location}: {label.text()} cites no ledger id"], []
    errors: List[str] = []
    warnings: List[str] = []
    for token in ids:
        token_errors, token_warnings = _check_id(label, token, index)
        errors.extend(token_errors)
        warnings.extend(token_warnings)
    return errors, warnings


def _check_id(label: ClaimLabel, token: str, index: LabelIndex) -> Tuple[List[str], List[str]]:
    match = LEDGER_ID.match(token)
    if not match:
        return [f"{label.location}: {label.text()} cites {token!r}, which is not a ledger id"], []
    kind = LEDGER_BY_PREFIX[match.group(1)]
    allowed = LABEL_LEDGERS[label.name]
    if kind not in allowed:
        expected = " or ".join(f"{ID_PREFIXES[item]}-NNN" for item in allowed)
        return [f"{label.location}: {label.text()} must cite {expected}, not {token}"], []
    record = index.current.get(kind, {}).get(token)
    if record is None:
        return [f"{label.location}: {label.text()} cites unknown {kind} id {token}"], []
    return [], _status_warnings(label, kind, token, record, index)


def _status_warnings(label: ClaimLabel, kind: str, token: str, record: dict, index: LabelIndex) -> List[str]:
    warnings: List[str] = []
    if token in index.superseded:
        warnings.append(f"{label.location}: {label.text()} cites superseded {kind} {token}")
    expected = EXPECTED_STATUS.get((label.name, kind))
    if expected and record["status"] != expected:
        warnings.append(f"{label.location}: {label.text()} expects {kind} {token} to be {expected}, but it is {record['status']}")
    return warnings
