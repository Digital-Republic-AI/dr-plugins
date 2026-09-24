from __future__ import annotations

from collections import OrderedDict
from pathlib import Path
from typing import Dict, List

from .constants import EXIT_OPERATIONAL_ERROR, WORKSPACE_GITIGNORE_CONTENT, WORKSPACE_GITIGNORE_NAME
from .errors import DiscoveryError
from .fsutil import to_json, write_text_atomic
from .layout import EMPTY_LEDGER_FILES, QUESTIONS_MARKDOWN_FILE, REQUIRED_DIRS, STATE_FILE, TEMPLATE_TARGETS, TEMPLATES_DIR
from .questions_view import render_questions

WRITE_HINT = "the target is not writable; rerun init with --external or --workspace <directory>"


def load_templates(skill_dir: Path) -> Dict[str, str]:
    templates: Dict[str, str] = {}
    missing: List[str] = []
    for target, source in TEMPLATE_TARGETS.items():
        path = skill_dir / TEMPLATES_DIR / source
        if path.is_file():
            templates[target] = path.read_text(encoding="utf-8")
        else:
            missing.append(f"{TEMPLATES_DIR}/{source}")
    if missing:
        raise DiscoveryError(
            f"skill installation is incomplete; missing {', '.join(missing)}",
            EXIT_OPERATIONAL_ERROR,
            hint=f"reinstall the skill at {skill_dir}",
        )
    return templates


def skeleton_contents(templates: Dict[str, str], state: dict, versioning: str) -> "OrderedDict[str, str]":
    contents: "OrderedDict[str, str]" = OrderedDict()
    contents[STATE_FILE] = to_json(state)
    for ledger in EMPTY_LEDGER_FILES:
        contents[ledger] = ""
    contents[QUESTIONS_MARKDOWN_FILE] = render_questions([])
    contents[WORKSPACE_GITIGNORE_NAME] = WORKSPACE_GITIGNORE_CONTENT[versioning]
    contents.update(templates)
    return contents


def ensure_skeleton(workspace: Path, contents: Dict[str, str]) -> dict:
    created: List[str] = []
    preserved: List[str] = []
    try:
        workspace.mkdir(parents=True, exist_ok=True)
        for directory in REQUIRED_DIRS:
            (workspace / directory).mkdir(exist_ok=True)
        for relative, content in contents.items():
            path = workspace / relative
            if path.exists():
                preserved.append(relative)
                continue
            write_text_atomic(path, content)
            created.append(relative)
    except OSError as exc:
        raise DiscoveryError(f"cannot create workspace at {workspace}: {exc.strerror or exc}", EXIT_OPERATIONAL_ERROR, hint=WRITE_HINT) from exc
    except DiscoveryError as exc:
        raise DiscoveryError(exc.message, exc.exit_code, hint=WRITE_HINT) from exc
    return {"created": created, "preserved": preserved}
