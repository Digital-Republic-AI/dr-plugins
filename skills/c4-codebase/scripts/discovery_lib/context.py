from __future__ import annotations

import argparse
from typing import NamedTuple

from .constants import EXIT_UNHEALTHY
from .errors import DiscoveryError
from .identity import current_identity
from .locations import Target, WorkspaceLocation, resolve_target, resolve_workspace


class Context(NamedTuple):
    target: Target
    identity: dict
    workspace: WorkspaceLocation
    as_json: bool
    quiet: bool


def build_context(args: argparse.Namespace, prefer_external: bool = False) -> Context:
    target = resolve_target(args.repo, args.scope)
    identity = current_identity(target)
    location = resolve_workspace(target.root, identity["rootCommit"], args.workspace, prefer_external)
    return Context(target, identity, location, args.json, getattr(args, "quiet", False))


def require_workspace(ctx: Context) -> None:
    if not ctx.workspace.path.exists():
        raise DiscoveryError(
            f"workspace not found at {ctx.workspace.path}",
            EXIT_UNHEALTHY,
            hint="run workspace.py init (add --external when the repository is not writable)",
        )
