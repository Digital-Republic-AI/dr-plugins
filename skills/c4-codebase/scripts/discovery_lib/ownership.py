from __future__ import annotations

from typing import List, Optional, Sequence

from .constants import DIRTY_PATHS_LIMIT
from .context import Context
from .fsutil import relative_posix
from .gitinfo import GitClient
from .layout import PUBLISHED_FILES
from .locations import Target, resolve_output_directory, workspace_prefix_in_repository
from .markers import is_foreign_file


def owned_paths(ctx: Context, state: Optional[dict], *output_directories: Optional[str]) -> List[str]:
    root = ctx.target.root
    directories = ([state["output"]["directory"]] if state else []) + list(output_directories)
    owned = [workspace_prefix_in_repository(root, ctx.workspace.path)]
    for directory in dict.fromkeys(item for item in directories if item):
        output = resolve_output_directory(root, directory)
        owned.extend(relative_posix(output / name, root) for name in PUBLISHED_FILES if not is_foreign_file(output / name))
    return [path for path in owned if path]


def changed_since(git: GitClient, revision: Optional[str], owned: Sequence[str]) -> bool:
    if not revision or not git.is_valid_revision(revision):
        return True
    changed = git.changed_paths_since(revision, owned)
    return changed is None or bool(changed)


def working_tree(target: Target, owned: Sequence[str]) -> dict:
    unknown = {"dirty": None, "dirtyPaths": [], "dirtyPathsTruncated": False}
    if not target.is_git:
        return unknown
    paths = target.git.dirty_paths(owned)
    if paths is None:
        return unknown
    return {
        "dirty": bool(paths),
        "dirtyPaths": paths[:DIRTY_PATHS_LIMIT],
        "dirtyPathsTruncated": len(paths) > DIRTY_PATHS_LIMIT,
    }
