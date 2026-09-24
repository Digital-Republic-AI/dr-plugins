from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from .layout import SCAN_MARKDOWN_FILE
from .markers import generated_header

NONE_DETECTED = "- None detected"
BACKTICK = "`"
UNKNOWN = "unknown"
WHOLE_REPOSITORY = "whole repository"


def code(value: Any) -> str:
    text = str(value)
    if BACKTICK in text:
        return f"`` {text} ``"
    return f"`{text}`"


def plain(value: Any) -> str:
    if value is None:
        return UNKNOWN
    if isinstance(value, bool):
        return "yes" if value else "no"
    return code(value)


def section(title: str, body: Sequence[str]) -> List[str]:
    return ["", f"## {title}", ""] + (list(body) or [NONE_DETECTED])


def path_lines(items: Sequence[str]) -> List[str]:
    return [f"- {code(item)}" for item in items]


def truncation_note(data: Dict[str, Any], field: str) -> List[str]:
    entry = data["truncated"].get(field)
    if not entry:
        return []
    return ["", f"_Showing {entry['shown']} of {total_label(entry)} entries._"]


def total_label(entry: Dict[str, Optional[int]]) -> str:
    return UNKNOWN if entry["total"] is None else str(entry["total"])


def listed(title: str, field: str, render: Callable[[Any], str]) -> Callable[[Dict[str, Any]], List[str]]:
    def render_section(data: Dict[str, Any]) -> List[str]:
        lines = [render(item) for item in data[field]]
        return section(title, lines + truncation_note(data, field) if lines else [])
    return render_section


def header(data: Dict[str, Any]) -> List[str]:
    repository = data["repository"]
    return [
        generated_header(Path(SCAN_MARKDOWN_FILE), repository["revision"], data["generatedAt"]).rstrip("\n"),
        "# Deterministic Repository Scan",
        "",
        f"- Generated: {data['generatedAt']}",
        f"- Scan format version: {data['scanFormatVersion']}",
        f"- Skill version: {plain(data['skillVersion'])}",
        f"- File source: {code(data['fileSource'])}",
    ]


def repository_section(data: Dict[str, Any]) -> List[str]:
    repository = data["repository"]
    rows: List[Tuple[str, str]] = [
        ("Name", code(repository["name"])),
        ("Scope", code(repository["scope"]) if repository["scope"] else WHOLE_REPOSITORY),
        ("Revision", plain(repository["revision"])),
        ("Branch", plain(repository["branch"])),
        ("Remote", plain(repository["remote"])),
        ("Root commit", plain(repository["rootCommit"])),
        ("Uncommitted changes", plain(repository["dirty"])),
    ]
    return section("Repository", [f"- {label}: {value}" for label, value in rows])


def counts_section(data: Dict[str, Any]) -> List[str]:
    counts = data["counts"]
    return section("Counts", [f"- Files: {counts['files']}", f"- Source files: {counts['sourceFiles']}"])


def languages_section(data: Dict[str, Any]) -> List[str]:
    lines = [f"- {language}: {count} files" for language, count in data["languagesByFileCount"].items()]
    return section("Language signals", lines)


def workspace_definition_line(item: Dict[str, Any]) -> str:
    members = ", ".join(code(member) for member in item["members"]) or "no members listed"
    return f"- {code(item['path'])} ({item['kind']}): {members}"


def excluded_line(item: Dict[str, Any]) -> str:
    if item["fileCount"] is None:
        count = "file count not measured"
    else:
        count = f"{item['fileCount']}{'+' if item['fileCountCapped'] else ''} files"
    return f"- {code(item['path'])}: {item['reason']}, {count}"


def commit_line(line: str) -> str:
    revision, _, subject = line.partition(" ")
    return f"- {code(revision)} {subject}".rstrip()


def simple_section(title: str, field: str) -> Callable[[Dict[str, Any]], List[str]]:
    def render_section(data: Dict[str, Any]) -> List[str]:
        return section(title, path_lines(data[field]))
    return render_section


def limits_section(data: Dict[str, Any]) -> List[str]:
    limits = data["limits"]
    lines = [f"- {name}: {value}" for name, value in limits.items()]
    truncated = data["truncated"]
    if truncated:
        lines.append("")
        lines.extend(f"- `{field}` truncated: showing {entry['shown']} of {total_label(entry)}"
                     for field, entry in sorted(truncated.items()))
    else:
        lines.extend(["", "- No list was truncated."])
    return section("Limits and truncation", lines)


def warnings_section(data: Dict[str, Any]) -> List[str]:
    return section("Warnings", [f"- {warning}" for warning in data["warnings"]])


SECTIONS: Tuple[Callable[[Dict[str, Any]], List[str]], ...] = (
    repository_section,
    counts_section,
    languages_section,
    listed("Manifests", "manifests", lambda item: f"- {code(item)}"),
    listed("Intent documents", "intentDocuments",
           lambda item: f"- {code(item['path'])} ({item['matchedBy']})"),
    listed("Generated artifacts (never treated as intent)", "generatedArtifacts",
           lambda item: f"- {code(item['path'])} ({item['marker']})"),
    listed("API specifications", "apiSpecifications", lambda item: f"- {code(item)}"),
    listed("Entrypoint candidates", "entrypointCandidates",
           lambda item: f"- {code(item['path'])}: rule {code(item['rule'])}, {item['confidence']} confidence"),
    listed("Deployment and infrastructure", "deploymentAndInfrastructure", lambda item: f"- {code(item)}"),
    listed("Environment templates (values never read)", "environmentTemplates", lambda item: f"- {code(item)}"),
    listed("CI/CD", "ciCd", lambda item: f"- {code(item)}"),
    listed("Workspace definitions", "workspaceDefinitions", workspace_definition_line),
    simple_section("Monorepo signals", "monorepoSignals"),
    listed("Submodules", "submodules", lambda item: f"- {code(item['path'])}: {plain(item['url'])}"),
    listed("Top-level density", "topLevelDensity", lambda item: f"- {code(item['path'])}: {item['files']} files"),
    listed("Directory tree", "directoryTree", lambda item: f"- {code(item['path'])}: {item['files']} files"),
    listed("Excluded directories", "excludedDirectories", excluded_line),
    listed("Recent commits", "recentCommits", commit_line),
    listed("High-churn paths", "highChurnPaths",
           lambda item: f"- {code(item['path'])}: {item['changes']} changes in sampled history"),
    limits_section,
    listed("Walk errors", "walkErrors", lambda item: f"- {code(item['path'])}: {item['error']}"),
    warnings_section,
)


def render_markdown(data: Dict[str, Any]) -> str:
    lines = header(data)
    for render_section in SECTIONS:
        lines.extend(render_section(data))
    return "\n".join(lines) + "\n"
