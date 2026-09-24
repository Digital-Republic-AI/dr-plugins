from __future__ import annotations

import re
from itertools import islice
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

from .constants import (
    GENERATED_MARKER,
    MARKER_KIND_GENERATED,
    MARKER_KIND_TEMPLATE,
    MARKER_SCAN_LINES,
    PUBLISH_OTHER_FILES_LIMIT,
    VERSIONING_SHARED,
)
from .context import Context
from .documents import Document, read_label_index, scan_documents
from .fsutil import relative_posix, utc_now
from .gitinfo import GitClient
from .layout import DSL_FILE_NAME, PUBLISHED_FILES, README_FILE_NAME
from .locations import resolve_output_directory
from .dsl_lint import lint_file
from .markers import artifact_marker_kind, generated_header
from .ownership import changed_since, owned_paths
from .vocabulary import PUBLICATION_ABSENT, PUBLICATION_FOREIGN, PUBLICATION_GENERATED, PUBLICATION_TEMPLATE

MARKER_REVISION = re.compile(r"revision=(\S+)")
SKILL_TARGET_STATUSES = (PUBLICATION_GENERATED, PUBLICATION_TEMPLATE)


def display_path(root: Path, path: Path) -> str:
    relative = relative_posix(path, root)
    return relative if relative is not None else str(path)


def classify_target(path: Path) -> Tuple[str, Optional[str]]:
    if not path.exists():
        return PUBLICATION_ABSENT, None
    kind = artifact_marker_kind(path)
    if kind == MARKER_KIND_GENERATED:
        return PUBLICATION_GENERATED, marker_revision(path)
    if kind == MARKER_KIND_TEMPLATE:
        return PUBLICATION_TEMPLATE, None
    return PUBLICATION_FOREIGN, None


def marker_revision(path: Path) -> Optional[str]:
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        for line in islice(handle, MARKER_SCAN_LINES):
            if GENERATED_MARKER in line:
                match = MARKER_REVISION.search(line)
                return match.group(1) if match else None
    return None


def published_targets(directory: Path) -> List[dict]:
    return [_target_entry(directory, name) for name in PUBLISHED_FILES]


def skill_documents(root: Path, directory: Path, targets: List[dict]) -> List[Document]:
    return [
        Document(display_path(root, directory / item["file"]), directory / item["file"], published=True)
        for item in targets
        if item["status"] in SKILL_TARGET_STATUSES
    ]


def publish_check(ctx: Context, state: dict, override: Optional[str] = None) -> dict:
    root = ctx.target.root
    directory = resolve_output_directory(root, override or state["output"]["directory"])
    revision = ctx.identity["revision"]
    targets = published_targets(directory)
    others = _other_files(directory)
    findings = scan_documents(skill_documents(root, directory, targets), read_label_index(ctx.workspace.path), state["versioning"] == VERSIONING_SHARED)
    now = utc_now()
    dsl_lint = _published_dsl_lint(directory, targets)
    return {
        "outputDirectory": display_path(root, directory),
        "outputDirectoryExists": directory.is_dir(),
        "targets": targets,
        "foreignFiles": [item["file"] for item in targets if item["status"] == PUBLICATION_FOREIGN],
        "otherFiles": others[:PUBLISH_OTHER_FILES_LIMIT],
        "otherFilesTruncated": len(others) > PUBLISH_OTHER_FILES_LIMIT,
        "blocked": any(item["status"] == PUBLICATION_FOREIGN for item in targets),
        "published": all(item["status"] == PUBLICATION_GENERATED for item in targets),
        "staleFiles": _stale_files(ctx.target.git, targets, revision, owned_paths(ctx, state, override)),
        "secretFindings": findings.secrets,
        "claimLabelErrors": findings.label_errors,
        "claimLabelWarnings": findings.label_warnings,
        "dslLintErrors": dsl_lint[0],
        "dslLintWarnings": dsl_lint[1],
        "headers": {
            "markdown": generated_header(Path(README_FILE_NAME), revision, now).rstrip("\n"),
            "dsl": generated_header(Path(DSL_FILE_NAME), revision, now).rstrip("\n"),
        },
    }


def _target_entry(directory: Path, name: str) -> dict:
    status, revision = classify_target(directory / name)
    return {"file": name, "status": status, "revision": revision}


def _stale_files(git: GitClient, targets: List[dict], revision: Optional[str], owned: Sequence[str]) -> List[str]:
    if not revision:
        return []
    verdicts: Dict[Optional[str], bool] = {}
    stale: List[str] = []
    for item in targets:
        marker = item["revision"]
        if item["status"] != PUBLICATION_GENERATED or marker == revision:
            continue
        if marker not in verdicts:
            verdicts[marker] = changed_since(git, marker, owned)
        if verdicts[marker]:
            stale.append(item["file"])
    return stale


def _other_files(directory: Path) -> List[str]:
    if not directory.is_dir():
        return []
    names = set(PUBLISHED_FILES)
    relative = (path.relative_to(directory).as_posix() for path in directory.rglob("*") if path.is_file())
    return sorted(item for item in relative if item not in names)


def _published_dsl_lint(directory: Path, targets: List[dict]) -> Tuple[List[str], List[str]]:
    generated = {item["file"] for item in targets if item["status"] == PUBLICATION_GENERATED}
    path = directory / DSL_FILE_NAME
    if DSL_FILE_NAME not in generated or not path.is_file():
        return [], []
    _, report = lint_file(path)
    return report.errors, report.warnings
