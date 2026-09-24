from __future__ import annotations

import os
from pathlib import Path, PurePosixPath
from typing import List, NamedTuple, Optional

from .constants import (
    EXIT_USAGE,
    EXTERNAL_WORKSPACE_HOME_DEFAULT,
    EXTERNAL_WORKSPACE_HOME_ENV,
    ROOT_COMMIT_ID_LENGTH,
    WORKSPACE_DIR_NAME,
    WORKSPACE_SOURCE_ARGUMENT,
    WORKSPACE_SOURCE_DEFAULT,
    WORKSPACE_SOURCE_EXTERNAL,
    WORKSPACE_SOURCE_REPOSITORY,
)
from .errors import DiscoveryError
from .gitinfo import GitClient

REPOSITORY_ROOT_PATHS = ("", ".")


class Target(NamedTuple):
    root: Path
    scope: Optional[str]
    git: GitClient
    is_git: bool
    warnings: List[str]


class WorkspaceLocation(NamedTuple):
    path: Path
    source: str


def resolve_target(repo_arg: str, scope_arg: Optional[str] = None) -> Target:
    requested = Path(repo_arg).expanduser().resolve()
    if not requested.is_dir():
        raise DiscoveryError(f"repository path is not a directory: {requested}", EXIT_USAGE)
    probe = GitClient(requested)
    top = probe.toplevel()
    root = top or requested
    git = GitClient(root)
    git.warnings.extend(probe.warnings)
    warnings: List[str] = []
    implicit = requested.relative_to(root).as_posix() if requested != root else None
    scope = normalize_scope(root, scope_arg) if scope_arg else implicit
    if implicit and not scope_arg:
        warnings.append(f"--repo points inside the git repository; using root {root.name!r} with scope {implicit!r}")
    return Target(root=root, scope=scope, git=git, is_git=top is not None, warnings=warnings)


def normalize_scope(root: Path, scope: str) -> Optional[str]:
    pure = PurePosixPath(scope.replace("\\", "/"))
    if pure.is_absolute() or ".." in pure.parts:
        raise DiscoveryError(f"--scope must be a relative path inside the repository: {scope}", EXIT_USAGE)
    normalized = pure.as_posix().strip("/")
    if normalized in ("", "."):
        return None
    if not (root / normalized).is_dir():
        raise DiscoveryError(f"--scope directory does not exist: {normalized}", EXIT_USAGE)
    return normalized


def repository_relative_path(root: Path, raw: str) -> str:
    candidate = Path(raw).expanduser()
    if candidate.is_absolute():
        try:
            return candidate.resolve().relative_to(root.resolve()).as_posix()
        except ValueError:
            raise DiscoveryError(f"path is outside the repository: {raw}", EXIT_USAGE)
    pure = PurePosixPath(raw.replace("\\", "/"))
    if ".." in pure.parts:
        raise DiscoveryError(f"path must stay inside the repository: {raw}", EXIT_USAGE)
    normalized = pure.as_posix().strip("/")
    return normalized or "."


def external_workspace_home() -> Path:
    return Path(os.environ.get(EXTERNAL_WORKSPACE_HOME_ENV, EXTERNAL_WORKSPACE_HOME_DEFAULT)).expanduser()


def external_workspace_path(root: Path, root_commit: Optional[str]) -> Path:
    suffix = f"-{root_commit[:ROOT_COMMIT_ID_LENGTH]}" if root_commit else ""
    return external_workspace_home() / f"{root.name}{suffix}"


def resolve_workspace(root: Path, root_commit: Optional[str], workspace_arg: Optional[str] = None,
                      prefer_external: bool = False) -> WorkspaceLocation:
    if workspace_arg:
        return WorkspaceLocation(Path(workspace_arg).expanduser().resolve(), WORKSPACE_SOURCE_ARGUMENT)
    in_repository = root / WORKSPACE_DIR_NAME
    external = external_workspace_path(root, root_commit)
    if in_repository.exists():
        return WorkspaceLocation(in_repository, WORKSPACE_SOURCE_REPOSITORY)
    if external.exists():
        return WorkspaceLocation(external, WORKSPACE_SOURCE_EXTERNAL)
    if prefer_external:
        return WorkspaceLocation(external, WORKSPACE_SOURCE_EXTERNAL)
    return WorkspaceLocation(in_repository, WORKSPACE_SOURCE_DEFAULT)


def resolve_output_directory(root: Path, directory: str) -> Path:
    candidate = Path(directory).expanduser()
    return candidate if candidate.is_absolute() else root / candidate


def workspace_prefix_in_repository(root: Path, workspace: Path) -> Optional[str]:
    try:
        return workspace.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return None
