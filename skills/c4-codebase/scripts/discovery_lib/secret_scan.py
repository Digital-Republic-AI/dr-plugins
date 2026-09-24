from __future__ import annotations

import re
from typing import Iterable, List

SECRET_PATTERNS = (
    ("private key block", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("AWS access key id", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b")),
    ("Slack token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}")),
    ("API secret key", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}")),
    ("JSON Web Token", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")),
    ("credentials in URL", re.compile(r"[a-zA-Z][a-zA-Z0-9+.-]*://[^/\s:@]+:[^/\s@]+@")),
    (
        "quoted secret assignment",
        re.compile(
            r"(?i)\b(password|passwd|pwd|secret|api[_-]?key|access[_-]?key|auth[_-]?token|token|client[_-]?secret)\b"
            r"\s*[:=]\s*['\"][^'\"\s]{8,}['\"]"
        ),
    ),
)
SCANNED_FIELDS = ("observation", "command", "claim", "question", "answer", "dismissalReason", "summary")


def secret_kinds(text: str) -> List[str]:
    return [name for name, pattern in SECRET_PATTERNS if pattern.search(text)]


def text_secret_findings(location: str, text: str) -> List[str]:
    return [
        f"{location}:{number}: appears to contain a secret value ({kind})"
        for number, line in enumerate(text.splitlines(), start=1)
        for kind in secret_kinds(line)
    ]


def record_secret_findings(location: str, record: dict, fields: Iterable[str] = SCANNED_FIELDS) -> List[str]:
    findings: List[str] = []
    for field in fields:
        value = record.get(field)
        if isinstance(value, str):
            findings.extend(f"{location}: {field} appears to contain a secret value ({kind})" for kind in secret_kinds(value))
    return findings
