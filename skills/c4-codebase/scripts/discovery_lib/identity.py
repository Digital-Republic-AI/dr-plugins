from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from .constants import ROOT_COMMIT_ID_LENGTH
from .gitinfo import normalize_remote
from .locations import Target


def current_identity(target: Target) -> Dict[str, Optional[str]]:
    git = target.git
    return {
        "name": target.root.name,
        "remote": git.remote(),
        "rootCommit": git.root_commit(),
        "branch": git.branch(),
        "revision": git.head(),
    }


def identity_findings(saved: dict, current: dict) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []
    saved_root, current_root = saved.get("rootCommit"), current.get("rootCommit")
    saved_remote, current_remote = normalize_remote(saved.get("remote")), normalize_remote(current.get("remote"))
    remotes_differ = bool(saved_remote and current_remote and saved_remote != current_remote)
    if saved_root and current_root and saved_root != current_root:
        errors.append(
            f"repository identity differs: state root commit {_short(saved_root)} != current root commit {_short(current_root)}"
        )
    elif saved_root and current_root and remotes_differ:
        warnings.append(f"remote changed from {saved_remote} to {current_remote} (fork or mirror); root commit matches")
    elif not (saved_root and current_root) and remotes_differ:
        errors.append(f"repository identity differs: state remote {saved_remote} != current remote {current_remote}")
    if not saved_root and current_root and not errors:
        warnings.append("state has no root commit recorded; run rebaseline after confirming this is the same repository")
    if saved.get("name") != current.get("name") and not errors:
        warnings.append(
            f"repository directory name changed from {saved.get('name')!r} to {current.get('name')!r} (moved, renamed, or cloned)"
        )
    return errors, warnings


def _short(commit: str) -> str:
    return commit[:ROOT_COMMIT_ID_LENGTH]
