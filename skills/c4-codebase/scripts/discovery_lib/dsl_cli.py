from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path
from typing import List, Optional, Sequence

from .cli_support import build_parser, emit_json, run_cli
from .constants import EXIT_OK, EXIT_OPERATIONAL_ERROR, EXIT_UNHEALTHY, GIT_TIMEOUT_SECONDS
from .dsl_export import FORMAT_DOT, FORMATS, export_views
from .dsl_lint import LintReport, lint_file
from .errors import DiscoveryError
from .fsutil import write_text_atomic

PROG = "dsl.py"
DEFAULT_WORKSPACE = "docs/architecture/workspace.dsl"
DEFAULT_OUTPUT_DIR_NAME = "diagrams"
DOT_BINARY = "dot"
SVG_SUFFIX = ".svg"
RENDER_TIMEOUT_SECONDS = GIT_TIMEOUT_SECONDS * 4
LINT_HINT = "fix the errors in the DSL; the offline lint covers the subset in references/structurizr-dsl.md"


def main(argv: Optional[Sequence[str]] = None, description: str = "") -> int:
    args = build_dsl_parser(description).parse_args(argv)
    return run_cli(lambda: args.handler(args), args.json)


def build_dsl_parser(description: str) -> argparse.ArgumentParser:
    parser = build_parser(PROG, description)
    commands = parser.add_subparsers(dest="command", metavar="<command>")
    commands.required = True
    lint = commands.add_parser("lint", help="check a workspace.dsl offline against the skill's DSL subset; exit 3 on errors")
    _common(lint)
    lint.set_defaults(handler=cmd_lint)
    export = commands.add_parser("export", help="write one diagram file per view in DOT or Mermaid syntax; refuses a workspace with lint errors")
    _common(export)
    export.add_argument("--format", required=True, choices=FORMATS, help="dot (Graphviz) or mermaid (C4 syntax)")
    export.add_argument("--output", help=f"directory for the files (default: <DSL directory>/{DEFAULT_OUTPUT_DIR_NAME})")
    export.add_argument("--render", action="store_true", help=f"dot only: render every file to .svg with the {DOT_BINARY} binary on PATH")
    export.set_defaults(handler=cmd_export)
    return parser


def _common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--workspace", default=DEFAULT_WORKSPACE, help=f"DSL file (default: {DEFAULT_WORKSPACE})")
    parser.add_argument("--json", action="store_true", help="print JSON instead of text")


def cmd_lint(args: argparse.Namespace) -> int:
    _, report = _lint(Path(args.workspace))
    _emit_lint(args, report)
    return EXIT_OK if report.valid else EXIT_UNHEALTHY


def cmd_export(args: argparse.Namespace) -> int:
    workspace = Path(args.workspace)
    model, report = _lint(workspace)
    if not report.valid:
        raise DiscoveryError(f"{workspace.name} has {len(report.errors)} lint error(s); nothing exported: " + "; ".join(report.errors), EXIT_UNHEALTHY, hint=LINT_HINT)
    if args.render and args.format != FORMAT_DOT:
        raise DiscoveryError("--render applies to --format dot only", EXIT_UNHEALTHY, hint="render Mermaid in a browser or with mermaid-cli")
    renderer = _renderer(args.render)
    output = Path(args.output) if args.output else workspace.resolve().parent / DEFAULT_OUTPUT_DIR_NAME
    output.mkdir(parents=True, exist_ok=True)
    written: List[str] = []
    rendered: List[str] = []
    for diagram in export_views(model, args.format):
        target = output / diagram.file_name
        write_text_atomic(target, diagram.content)
        written.append(str(target))
        if renderer:
            rendered.append(_render(renderer, target))
    summary = {"workspace": str(workspace), "format": args.format, "output": str(output), "written": written, "rendered": rendered, "warnings": report.warnings}
    if args.json:
        emit_json(summary)
    else:
        print(f"Exported {len(written)} {args.format} file(s) to {output}" + (f", rendered {len(rendered)} SVG" if renderer else ""))
        for warning in report.warnings:
            print(f"warning: {warning}")
    return EXIT_OK


def _lint(workspace: Path):
    if not workspace.is_file():
        raise DiscoveryError(f"workspace file not found: {workspace}", EXIT_OPERATIONAL_ERROR)
    return lint_file(workspace)


def _emit_lint(args: argparse.Namespace, report: LintReport) -> None:
    if args.json:
        emit_json(report._asdict())
        return
    for error in report.errors:
        print(f"error: {error}")
    for warning in report.warnings:
        print(f"warning: {warning}")
    print(f"{'Valid' if report.valid else 'Invalid'} {report.path}: {report.counts['elements']} elements, {report.counts['relationships']} relationships, {report.counts['views']} views")


def _renderer(requested: bool) -> Optional[str]:
    if not requested:
        return None
    binary = shutil.which(DOT_BINARY)
    if binary is None:
        raise DiscoveryError(f"{DOT_BINARY} not found on PATH; install Graphviz to render", EXIT_OPERATIONAL_ERROR, hint="brew install graphviz, apt-get install graphviz, or drop --render")
    return binary


def _render(binary: str, source: Path) -> str:
    target = source.with_suffix(SVG_SUFFIX)
    try:
        result = subprocess.run([binary, "-Tsvg", "-o", str(target), str(source)], capture_output=True, text=True, timeout=RENDER_TIMEOUT_SECONDS)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise DiscoveryError(f"{DOT_BINARY} failed for {source.name}: {exc}", EXIT_OPERATIONAL_ERROR) from exc
    if result.returncode != 0 or not target.is_file():
        raise DiscoveryError(f"{DOT_BINARY} failed for {source.name} (exit {result.returncode}): {result.stderr.strip()}", EXIT_OPERATIONAL_ERROR)
    return str(target)
