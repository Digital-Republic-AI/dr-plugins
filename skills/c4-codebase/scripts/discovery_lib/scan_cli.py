from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from . import scan_rules as rules
from .cli_support import build_parser, emit_json, run_cli
from .constants import (
    EXIT_OK,
    EXIT_USAGE,
    SCAN_CHURN_COMMITS,
    SCAN_CHURN_PATHS_LIMIT,
    SCAN_EXCLUDED_COUNT_LIMIT,
    SCAN_FORMAT_VERSION,
    SCAN_LIST_LIMIT,
    SCAN_MAX_FILES_DEFAULT,
    SCAN_RECENT_COMMITS,
    SCAN_TOP_DENSITY_LIMIT,
    SCAN_TREE_DEPTH,
    SCAN_TREE_LIMIT,
    SCAN_WALK_ERRORS_LIMIT,
    WORKSPACE_DIR_NAME,
    WORKSPACE_SOURCE_DEFAULT,
)
from .errors import DiscoveryError
from .fsutil import relative_posix, to_json, utc_now, write_text_atomic
from .gitinfo import GitClient
from .layout import SCAN_JSON_FILE, SCAN_MARKDOWN_FILE
from .locations import Target, WorkspaceLocation, resolve_target, resolve_workspace, workspace_prefix_in_repository
from .scan_report import render_markdown
from .scanner import CollectionSettings, pathspec_args, portable_url, ranked_counts, scan_files, workspace_directory
from .skillmeta import skill_version

PROG = "scan.py"
STDOUT_JSON = "json"
STDOUT_MARKDOWN = "markdown"
REPOSITORY_PLACEHOLDER = "<repository>"
RECENT_COMMIT_FORMAT = "--format=%h %s"
CHURN_FORMAT = "--format="


def positive_int(value: str) -> int:
    try:
        number = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"expected a positive integer, got {value!r}") from exc
    if number <= 0:
        raise argparse.ArgumentTypeError(f"expected a positive integer, got {value!r}")
    return number


def build_scan_parser(description: str) -> argparse.ArgumentParser:
    parser = build_parser(PROG, description)
    parser.add_argument("--repo", default=".", metavar="PATH",
                        help="repository to scan; a subdirectory of a git repository is resolved to the git "
                             "top-level and becomes the scope (default: current directory)")
    parser.add_argument("--scope", metavar="SUBPATH",
                        help="restrict file collection to this subtree; reported paths stay relative to the "
                             "repository root")
    parser.add_argument("--workspace", metavar="DIR",
                        help="workspace directory used by --save and excluded from the scan (default: "
                             f"<repo>/{WORKSPACE_DIR_NAME} or the existing external workspace)")
    parser.add_argument("--save", action="store_true",
                        help=f"write {SCAN_JSON_FILE} and {SCAN_MARKDOWN_FILE} into the workspace and print a "
                             "short JSON summary")
    parser.add_argument("--json-output", metavar="PATH", help="also write the full JSON scan to PATH")
    parser.add_argument("--md-output", metavar="PATH", help="also write the Markdown report to PATH")
    parser.add_argument("--stdout", choices=(STDOUT_JSON, STDOUT_MARKDOWN),
                        help="print the full scan in this format instead of the default output")
    parser.add_argument("--max-files", type=positive_int, default=SCAN_MAX_FILES_DEFAULT, metavar="N",
                        help="stop collecting after N files and record truncated.files "
                             f"(default: {SCAN_MAX_FILES_DEFAULT})")
    return parser


def main(description: str, argv: Optional[Sequence[str]] = None) -> int:
    args = build_scan_parser(description).parse_args(argv)
    return run_cli(lambda: execute(args), args.stdout != STDOUT_MARKDOWN)


def execute(args: argparse.Namespace) -> int:
    target = resolve_target(args.repo, args.scope)
    root_commit = target.git.root_commit() if target.is_git else None
    workspace = resolve_workspace(target.root, root_commit, args.workspace)
    data = build_scan(target, workspace, root_commit, args.max_files)
    written = write_outputs(args, workspace, data)
    emit_stdout(args, target.root, data, written)
    return EXIT_OK


def build_scan(target: Target, workspace: WorkspaceLocation, root_commit: Optional[str],
               max_files: int) -> Dict[str, Any]:
    prefix = workspace_prefix_in_repository(target.root, workspace.path)
    settings = CollectionSettings(target.root, target.scope, prefix, max_files)
    git = target.git if target.is_git else None
    files = scan_files(git, settings)
    warnings: List[str] = list(target.warnings)
    version = skill_version_or_none(warnings)
    repository = repository_section(target, root_commit, prefix)
    commits = recent_commits(git, target.scope, repository["revision"])
    churn, churn_truncation = high_churn_paths(git, target.scope, prefix, repository["revision"])
    truncated = dict(files.truncated)
    if churn_truncation:
        truncated["highChurnPaths"] = churn_truncation
    warnings.extend(files.warnings)
    warnings.extend(target.git.warnings)
    return {
        "scanFormatVersion": SCAN_FORMAT_VERSION,
        "skillVersion": version,
        "generatedAt": utc_now(),
        "repository": repository,
        "fileSource": files.source,
        **files.fields,
        "recentCommits": commits,
        "highChurnPaths": churn,
        "limits": limits_section(max_files),
        "truncated": dict(sorted(truncated.items())),
        "warnings": portable_warnings(warnings, target.root),
    }


def skill_version_or_none(warnings: List[str]) -> Optional[str]:
    try:
        return skill_version()
    except DiscoveryError:
        warnings.append("skill version unavailable: SKILL.md is missing or has no metadata.version")
        return None


def repository_section(target: Target, root_commit: Optional[str], prefix: Optional[str]) -> Dict[str, Any]:
    git = target.git
    is_git = target.is_git
    return {
        "name": target.root.name,
        "scope": target.scope,
        "revision": git.head() if is_git else None,
        "branch": git.branch() if is_git else None,
        "remote": portable_url(git.remote()) if is_git else None,
        "rootCommit": root_commit,
        "dirty": dirty_flag(git, prefix) if is_git else None,
    }


def dirty_flag(git: GitClient, prefix: Optional[str]) -> Optional[bool]:
    paths = git.dirty_paths(exclude_prefixes=[item for item in (WORKSPACE_DIR_NAME, prefix) if item])
    return None if paths is None else bool(paths)


def recent_commits(git: Optional[GitClient], scope: Optional[str], revision: Optional[str]) -> List[str]:
    if git is None or revision is None:
        return []
    raw = git.run("log", "--no-decorate", f"--max-count={SCAN_RECENT_COMMITS}", RECENT_COMMIT_FORMAT,
                  *pathspec_args(scope))
    return raw.splitlines() if raw else []


def high_churn_paths(git: Optional[GitClient], scope: Optional[str], prefix: Optional[str],
                     revision: Optional[str]) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, int]]]:
    if git is None or revision is None:
        return [], None
    raw = git.run_raw(*rules.GIT_UNQUOTED_PATHS_ARGS, "log", "--no-decorate", f"--max-count={SCAN_CHURN_COMMITS}",
                      "--name-only", CHURN_FORMAT, *pathspec_args(scope))
    counts = Counter(line for line in (raw or "").splitlines()
                     if line and workspace_directory(line, prefix) is None)
    ranked, truncation = ranked_counts(counts, SCAN_CHURN_PATHS_LIMIT)
    return [{"path": path, "changes": changes} for path, changes in ranked], truncation


def limits_section(max_files: int) -> Dict[str, int]:
    return {
        "maxFiles": max_files,
        "listLimit": SCAN_LIST_LIMIT,
        "topLevelDensityLimit": SCAN_TOP_DENSITY_LIMIT,
        "directoryTreeDepth": SCAN_TREE_DEPTH,
        "directoryTreeLimit": SCAN_TREE_LIMIT,
        "excludedFileCountLimit": SCAN_EXCLUDED_COUNT_LIMIT,
        "walkErrorsLimit": SCAN_WALK_ERRORS_LIMIT,
        "recentCommits": SCAN_RECENT_COMMITS,
        "churnCommits": SCAN_CHURN_COMMITS,
        "churnPathsLimit": SCAN_CHURN_PATHS_LIMIT,
    }


def portable_warnings(warnings: List[str], root: Path) -> List[str]:
    unique: List[str] = []
    for warning in warnings:
        cleaned = warning.replace(str(root), REPOSITORY_PLACEHOLDER)
        if cleaned not in unique:
            unique.append(cleaned)
    return unique


def ensure_workspace_location(workspace: WorkspaceLocation) -> None:
    path = workspace.path
    if path.is_dir() or workspace.source == WORKSPACE_SOURCE_DEFAULT or path.parent.is_dir():
        return
    raise DiscoveryError(
        f"workspace parent directory does not exist: {path.parent}",
        EXIT_USAGE,
        hint="create the parent directory first or pass --workspace with an existing parent",
    )


def requested_outputs(args: argparse.Namespace, workspace: WorkspaceLocation) -> List[Tuple[Path, str]]:
    outputs: List[Tuple[Path, str]] = []
    if args.save:
        ensure_workspace_location(workspace)
        outputs.append((workspace.path / SCAN_JSON_FILE, STDOUT_JSON))
        outputs.append((workspace.path / SCAN_MARKDOWN_FILE, STDOUT_MARKDOWN))
    if args.json_output:
        outputs.append((Path(args.json_output).expanduser().resolve(), STDOUT_JSON))
    if args.md_output:
        outputs.append((Path(args.md_output).expanduser().resolve(), STDOUT_MARKDOWN))
    return outputs


def write_outputs(args: argparse.Namespace, workspace: WorkspaceLocation, data: Dict[str, Any]) -> List[Path]:
    outputs = requested_outputs(args, workspace)
    renderers: Dict[str, Callable[[Dict[str, Any]], str]] = {STDOUT_JSON: to_json, STDOUT_MARKDOWN: render_markdown}
    rendered: Dict[str, str] = {}
    for path, kind in outputs:
        if kind not in rendered:
            rendered[kind] = renderers[kind](data)
        write_text_atomic(path, rendered[kind])
    return [path for path, _ in outputs]


def display_path(path: Path, root: Path) -> str:
    return relative_posix(path, root) or str(path)


def save_summary(root: Path, data: Dict[str, Any], written: List[Path]) -> Dict[str, Any]:
    walk_errors = data["truncated"].get("walkErrors", {}).get("total", len(data["walkErrors"]))
    return {
        "written": [display_path(path, root) for path in written],
        "counts": data["counts"],
        "truncated": data["truncated"],
        "walkErrors": walk_errors,
        "warnings": data["warnings"],
    }


def emit_stdout(args: argparse.Namespace, root: Path, data: Dict[str, Any], written: List[Path]) -> None:
    if args.stdout == STDOUT_MARKDOWN:
        sys.stdout.write(render_markdown(data))
    elif args.stdout == STDOUT_JSON or not written:
        emit_json(data)
    else:
        emit_json(save_summary(root, data, written))
