from __future__ import annotations

import argparse
import sys
from typing import Callable, List, Optional, Sequence

from .cli_support import build_parser, json_flag_present, run_cli
from .commands_core import (
    cmd_backup,
    cmd_check,
    cmd_init,
    cmd_invalidate,
    cmd_migrate,
    cmd_output_set,
    cmd_publish_check,
    cmd_rebaseline,
    cmd_status,
    cmd_validate,
)
from .commands_batch import cmd_evidence_add_batch
from .commands_ledger import (
    cmd_evidence_add,
    cmd_hypothesis_add,
    cmd_hypothesis_revise,
    cmd_question_add,
    cmd_question_answer,
    cmd_question_dismiss,
    cmd_question_render,
)
from .commands_progress import cmd_checkpoint_write, cmd_phase_set, cmd_unit_add, cmd_unit_set
from .constants import DEFAULT_OUTPUT_DIR, VERSIONING_POLICIES
from .schema import definition_enum, load_schema
from .state import phase_names
from .vocabulary import (
    EVIDENCE_SCHEMA,
    HYPOTHESIS_INFERRED,
    HYPOTHESIS_SCHEMA,
    PHASE_COMPLETE,
    QUESTION_SCHEMA,
    SETTABLE_STATUSES,
    STATE_SCHEMA,
)

PROG = "workspace.py"
REPEATABLE = "repeatable or comma-separated"


def main(argv: Optional[Sequence[str]] = None, description: str = "") -> int:
    arguments = list(sys.argv[1:] if argv is None else argv)
    return run_cli(lambda: _dispatch(arguments, description), json_flag_present(arguments))


def _dispatch(arguments: List[str], description: str) -> int:
    args = build_workspace_parser(description).parse_args(arguments)
    return args.handler(args)


def build_workspace_parser(description: str) -> argparse.ArgumentParser:
    parser = build_parser(PROG, description)
    commands = parser.add_subparsers(dest="command", metavar="<command>")
    commands.required = True
    common = _common_options()
    _add_lifecycle_commands(commands, common)
    _add_progress_commands(commands, common)
    _add_ledger_commands(commands, common)
    _add_maintenance_commands(commands, common)
    return parser


def _common_options() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--repo", default=".", help="directory to analyze; resolved to its git top-level (default: current directory)")
    common.add_argument("--scope", help="repository-relative subdirectory that narrows the analysis")
    common.add_argument("--workspace", help="workspace directory (default: <repo>/.c4-codebase, or an existing external workspace)")
    common.add_argument("--json", action="store_true", help="print JSON instead of human-readable text")
    common.add_argument("--quiet", action="store_true", help="print only the id of each record the command creates or revises (one per line); overrides --json on success")
    return common


def _command(group, name: str, handler: Callable, common: argparse.ArgumentParser, help_text: str) -> argparse.ArgumentParser:
    parser = group.add_parser(name, parents=[common], help=help_text, description=help_text)
    parser.set_defaults(handler=handler)
    return parser


def _group(commands, name: str, help_text: str):
    parser = commands.add_parser(name, help=help_text, description=help_text)
    group = parser.add_subparsers(dest=f"{name}_action", metavar="<action>")
    group.required = True
    return group


def _state_enum(definition: str) -> List[str]:
    return definition_enum(load_schema(STATE_SCHEMA), definition)


def _property_enum(schema_name: str, field: str) -> List[str]:
    return list(load_schema(schema_name)["properties"][field]["enum"])


def _add_lifecycle_commands(commands, common: argparse.ArgumentParser) -> None:
    _command(commands, "status", cmd_status, common, "report workspace health, repository identity, revisions, and the next step")
    _command(commands, "check", cmd_check, common, "same report as status; exit 3 when the workspace is unhealthy")
    init = _command(commands, "init", cmd_init, common, "create missing workspace artifacts; never overwrites existing files")
    init.add_argument(
        "--versioning",
        choices=VERSIONING_POLICIES,
        help="shared: commit state, ledgers, checkpoints, perspectives, and model (scan output and backups ignored); "
        "local: ignore the whole workspace (default: shared)",
    )
    init.add_argument("--output-dir", help=f"publication directory recorded in state (default: {DEFAULT_OUTPUT_DIR})")
    init.add_argument("--external", action="store_true", help="create the workspace under C4_CODEBASE_HOME (default ~/.c4-codebase)")
    _command(commands, "validate", cmd_validate, common, "validate state, ledgers, checkpoints, references, secrets, and questions.md; exit 3 on errors")
    _command(commands, "migrate", cmd_migrate, common, "back up and migrate a schemaVersion 1 workspace")
    _command(commands, "backup", cmd_backup, common, "copy state, ledgers, checkpoints, perspectives, and model into backups/<timestamp>")


def _add_progress_commands(commands, common: argparse.ArgumentParser) -> None:
    phase = _group(commands, "phase", "change phase status")
    phase_set = _command(phase, "set", cmd_phase_set, common, "set a phase status; ordering and completion gates are enforced")
    phase_set.add_argument("--phase", required=True, choices=phase_names() + [PHASE_COMPLETE])
    phase_set.add_argument("--status", required=True, choices=SETTABLE_STATUSES)

    unit = _group(commands, "unit", "manage investigation units")
    add = _command(unit, "add", cmd_unit_add, common, "register an investigation unit")
    add.add_argument("--id", required=True, help="stable kebab-case identifier")
    add.add_argument("--path", required=True, action="append", help=f"repository-relative path owned by the unit ({REPEATABLE})")
    add.add_argument("--type", required=True, choices=_state_enum("unitType"))
    add.add_argument("--description", help="one-line responsibility")
    add.add_argument("--depends-on", action="append", help=f"unit id this unit depends on ({REPEATABLE})")
    update = _command(unit, "set", cmd_unit_set, common, "change status, reachability, or description of a unit")
    update.add_argument("--id", required=True)
    update.add_argument("--status", choices=SETTABLE_STATUSES)
    update.add_argument("--reachability", choices=_state_enum("reachability"))
    update.add_argument("--description")

    checkpoint = _group(commands, "checkpoint", "record bounded-work checkpoints")
    write = _command(checkpoint, "write", cmd_checkpoint_write, common, "write checkpoints/<id>.json and link it to state")
    write.add_argument("--summary", required=True, help="what was done and what remains")
    write.add_argument("--phase", choices=phase_names(), help="default: current phase")
    write.add_argument("--unit", help="unit the checkpoint belongs to")
    write.add_argument("--completed", action="append", help=f"completed action ({REPEATABLE})")
    write.add_argument("--next", action="append", help=f"next action ({REPEATABLE})")
    write.add_argument("--evidence", action="append", help=f"evidence id ({REPEATABLE})")
    write.add_argument("--hypothesis", action="append", help=f"hypothesis id ({REPEATABLE})")
    write.add_argument("--question", action="append", help=f"open question id ({REPEATABLE})")


def _add_ledger_commands(commands, common: argparse.ArgumentParser) -> None:
    evidence = _group(commands, "evidence", "append evidence records")
    add = _command(evidence, "add", cmd_evidence_add, common, "append an evidence record; id, revision, dirty flag, and fingerprint are filled in")
    add.add_argument("--kind", required=True, choices=_property_enum(EVIDENCE_SCHEMA, "kind"))
    add.add_argument("--observation", required=True, help="atomic observation; key names and paths only, never secret values")
    add.add_argument("--path", help="path relative to the repository root")
    add.add_argument("--lines", help="line or range, for example 12-38")
    add.add_argument("--command", help="command whose output is the evidence")
    add.add_argument("--unit", help="unit id")
    add.add_argument("--intent", action="store_true", help="documentation that states intended behavior (kind documentation only)")
    add.add_argument("--question-id", help="question answered by this evidence")
    add.add_argument("--supersedes", help="evidence id corrected by this record")
    batch = _command(evidence, "add-batch", cmd_evidence_add_batch, common, "append every record of a JSONL file, or nothing when any line is invalid")
    batch.add_argument("--file", required=True, help="JSONL file; each line has the fields of evidence add (kind, observation, path, lines, command, unit, intent, questionId, supersedes)")

    hypothesis = _group(commands, "hypothesis", "append hypothesis records")
    h_add = _command(hypothesis, "add", cmd_hypothesis_add, common, "append a new hypothesis")
    h_add.add_argument("--claim", required=True)
    h_add.add_argument("--evidence", required=True, action="append", help=f"supporting evidence id ({REPEATABLE})")
    h_add.add_argument("--confidence", required=True, choices=_property_enum(HYPOTHESIS_SCHEMA, "confidence"))
    h_add.add_argument("--status", default=HYPOTHESIS_INFERRED, choices=_property_enum(HYPOTHESIS_SCHEMA, "status"))
    h_add.add_argument("--unit")
    h_add.add_argument("--reachability", choices=_state_enum("reachability"))
    h_add.add_argument("--question-id", action="append", help=f"related question id ({REPEATABLE})")
    h_add.add_argument("--supersedes", help="hypothesis id replaced by this different claim")
    revise = _command(hypothesis, "revise", cmd_hypothesis_revise, common, "append a revision with the same id and claim")
    revise.add_argument("--id", required=True)
    revise.add_argument("--status", choices=_property_enum(HYPOTHESIS_SCHEMA, "status"))
    revise.add_argument("--confidence", choices=_property_enum(HYPOTHESIS_SCHEMA, "confidence"))
    revise.add_argument("--reachability", choices=_state_enum("reachability"))
    revise.add_argument("--evidence", action="append", help=f"additional evidence id ({REPEATABLE})")
    revise.add_argument("--question-id", action="append", help=f"additional question id ({REPEATABLE})")

    question = _group(commands, "question", "manage the question ledger and questions.md")
    q_add = _command(question, "add", cmd_question_add, common, "append an open question")
    q_add.add_argument("--question", required=True)
    q_add.add_argument("--impact", required=True, choices=_property_enum(QUESTION_SCHEMA, "impact"))
    q_add.add_argument("--unit")
    q_add.add_argument("--hypothesis", action="append", help=f"related hypothesis id ({REPEATABLE})")
    q_add.add_argument("--supersedes", help="question id replaced by this different question")
    answer = _command(question, "answer", cmd_question_answer, common, "record the user's answer as user_confirmation evidence")
    answer.add_argument("--id", required=True)
    answer.add_argument("--answer", required=True)
    dismiss = _command(question, "dismiss", cmd_question_dismiss, common, "dismiss an open question")
    dismiss.add_argument("--id", required=True)
    dismiss.add_argument("--reason", required=True)
    _command(question, "render", cmd_question_render, common, "regenerate questions.md from questions.jsonl")


def _add_maintenance_commands(commands, common: argparse.ArgumentParser) -> None:
    invalidate = _command(commands, "invalidate", cmd_invalidate, common, "invalidate units affected by repository changes")
    invalidate.add_argument("--since", help="revision to diff against (default: baseline revision)")
    invalidate.add_argument("--unit", action="append", help=f"unit id to invalidate explicitly ({REPEATABLE})")
    invalidate.add_argument("--reason", help="why the units are invalidated")
    rebase = _command(commands, "rebaseline", cmd_rebaseline, common, "record the current revision and identity as the baseline")
    rebase.add_argument("--force", action="store_true", help="rebaseline even when units are still invalidated")
    rebase.add_argument("--accept-identity", action="store_true", help="accept a different repository identity (explicit user decision)")
    output = _group(commands, "output", "configure publication")
    output_set = _command(output, "set", cmd_output_set, common, "change the publication directory recorded in state")
    output_set.add_argument("--dir", required=True, help="repository-relative or absolute directory")
    check = _command(commands, "publish-check", cmd_publish_check, common, "classify publication targets; exit 4 when foreign files would be overwritten")
    check.add_argument("--output-dir", help="check this directory instead of the one recorded in state")
