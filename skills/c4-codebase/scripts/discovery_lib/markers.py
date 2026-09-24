from __future__ import annotations

from itertools import islice
from pathlib import Path
from typing import Optional

from .constants import (
    ARTIFACT_MARKER_PREFIX,
    GENERATED_MARKER,
    MARKER_KIND_GENERATED,
    MARKER_KIND_TEMPLATE,
    MARKER_SCAN_LINES,
    TEMPLATE_MARKER,
)

DSL_SUFFIXES = {".dsl"}


def artifact_marker_kind(path: Path) -> Optional[str]:
    try:
        with path.open("r", encoding="utf-8", errors="replace") as handle:
            head = "".join(islice(handle, MARKER_SCAN_LINES))
    except OSError:
        return None
    if ARTIFACT_MARKER_PREFIX not in head:
        return None
    if GENERATED_MARKER in head:
        return MARKER_KIND_GENERATED
    if TEMPLATE_MARKER in head:
        return MARKER_KIND_TEMPLATE
    return None


def is_foreign_file(path: Path) -> bool:
    return path.exists() and artifact_marker_kind(path) is None


def generated_header(path: Path, revision: Optional[str], generated_at: str) -> str:
    body = f"{GENERATED_MARKER} revision={revision or 'unknown'} generatedAt={generated_at}"
    if path.suffix.lower() in DSL_SUFFIXES:
        return f"// {body}\n"
    return f"<!-- {body} -->\n"
