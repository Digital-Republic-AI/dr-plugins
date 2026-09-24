from __future__ import annotations

import re
from pathlib import Path

from .constants import SKILL_FILE_NAME
from .errors import DiscoveryError
from .fsutil import read_text

FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)
METADATA_VERSION = re.compile(r"^metadata:\s*\n(?:[ \t]+.*\n)*?[ \t]+version:\s*[\"']?([^\"'\n]+)[\"']?\s*$", re.MULTILINE)


def skill_root() -> Path:
    return Path(__file__).resolve().parents[2]


def skill_version(root: Path = None) -> str:
    base = root or skill_root()
    text = read_text(base / SKILL_FILE_NAME)
    frontmatter = FRONTMATTER.match(text)
    if not frontmatter:
        raise DiscoveryError(f"{SKILL_FILE_NAME} has no YAML frontmatter")
    match = METADATA_VERSION.search(frontmatter.group(1) + "\n")
    if not match:
        raise DiscoveryError(f"{SKILL_FILE_NAME} frontmatter has no metadata.version")
    return match.group(1).strip()
