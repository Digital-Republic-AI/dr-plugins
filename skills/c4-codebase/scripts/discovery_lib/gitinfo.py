from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import List, Optional, Sequence

from .constants import GIT_TIMEOUT_SECONDS

URL_USERINFO = re.compile(r"^([a-zA-Z][a-zA-Z0-9+.-]*://)[^/@]+@")
SCP_LIKE_REMOTE = re.compile(r"^(?:[^@/]+@)?([^:/]+):(.+)$")
NOT_A_REPOSITORY = "not a git repository"
NO_COMMITS_MARKERS = ("unknown revision", "ambiguous argument 'HEAD'", "does not have any commits")
QUIET_FLAGS = {"--quiet", "-q"}


class GitClient:
    def __init__(self, repo: Path, timeout: int = GIT_TIMEOUT_SECONDS):
        self.repo = repo
        self.timeout = timeout
        self.warnings: List[str] = []

    def run(self, *args: str) -> Optional[str]:
        raw = self.run_raw(*args)
        if raw is None:
            return None
        return raw.strip() or None

    def run_raw(self, *args: str) -> Optional[str]:
        command = ["git", "-C", str(self.repo), *args]
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=self.timeout)
        except FileNotFoundError:
            self._warn_once("git executable not found; repository metadata unavailable")
            return None
        except subprocess.TimeoutExpired:
            self.warnings.append(f"git {' '.join(args)} timed out after {self.timeout}s")
            return None
        if result.returncode != 0:
            self._record_failure(args, result.stderr)
            return None
        self._record_stderr(args, result.stderr)
        return result.stdout

    def _record_stderr(self, args: Sequence[str], stderr: str) -> None:
        lines = [line.strip() for line in (stderr or "").splitlines() if line.strip()]
        if not lines:
            return
        extra = f" (+{len(lines) - 1} more)" if len(lines) > 1 else ""
        self.warnings.append(f"git {' '.join(args)} reported: {lines[0]}{extra}")

    def _record_failure(self, args: Sequence[str], stderr: str) -> None:
        message = (stderr or "").strip()
        if NOT_A_REPOSITORY in message or any(marker in message for marker in NO_COMMITS_MARKERS):
            return
        if args[:2] == ("config", "--get") or (not message and QUIET_FLAGS.intersection(args)):
            return
        self.warnings.append(f"git {' '.join(args)} failed: {message.splitlines()[0] if message else 'no output'}")

    def _warn_once(self, message: str) -> None:
        if message not in self.warnings:
            self.warnings.append(message)

    def toplevel(self) -> Optional[Path]:
        top = self.run("rev-parse", "--show-toplevel")
        return Path(top).resolve() if top else None

    def head(self) -> Optional[str]:
        return self.run("rev-parse", "--verify", "--quiet", "HEAD")

    def branch(self) -> Optional[str]:
        return self.run("symbolic-ref", "--short", "-q", "HEAD")

    def remote(self) -> Optional[str]:
        url = self.run("config", "--get", "remote.origin.url")
        return sanitize_remote(url) if url else None

    def root_commit(self) -> Optional[str]:
        if not self.head():
            return None
        roots = self.run("rev-list", "--max-parents=0", "HEAD")
        return sorted(roots.split())[0] if roots else None

    def is_valid_revision(self, revision: str) -> bool:
        return self.run("rev-parse", "--verify", "--quiet", f"{revision}^{{commit}}") is not None

    def dirty_paths(self, exclude_prefixes: Sequence[str] = ()) -> Optional[List[str]]:
        raw = self.run_raw("status", "--porcelain", "-z", "--untracked-files=all")
        if raw is None:
            return None
        return [p for p in parse_porcelain_z(raw) if not _has_prefix(p, exclude_prefixes)]

    def changed_paths_since(self, revision: str, exclude_prefixes: Sequence[str] = ()) -> Optional[List[str]]:
        raw = self.run_raw("diff", "--name-only", "--no-renames", "-z", revision, "HEAD")
        if raw is None:
            return None
        return [p for p in raw.split("\0") if p and not _has_prefix(p, exclude_prefixes)]

    def tracked_and_untracked_files(self) -> Optional[List[str]]:
        raw = self.run_raw("ls-files", "-z", "--cached", "--others", "--exclude-standard")
        if raw is None:
            return None
        return sorted({p for p in raw.split("\0") if p})


def parse_porcelain_z(raw: str) -> List[str]:
    entries = raw.split("\0")
    paths: List[str] = []
    index = 0
    while index < len(entries):
        entry = entries[index]
        index += 1
        if len(entry) < 4:
            continue
        status, path = entry[:2], entry[3:]
        paths.append(path.rstrip("/"))
        if "R" in status or "C" in status:
            index += 1
    return paths


def _has_prefix(path: str, prefixes: Sequence[str]) -> bool:
    return any(path == prefix or path.startswith(prefix.rstrip("/") + "/") for prefix in prefixes if prefix)


def sanitize_remote(url: str) -> str:
    return URL_USERINFO.sub(r"\1", url.strip())


def normalize_remote(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    value = sanitize_remote(url)
    if "://" in value:
        value = value.split("://", 1)[1]
    else:
        match = SCP_LIKE_REMOTE.match(value)
        if match:
            value = f"{match.group(1)}/{match.group(2)}"
    value = value.rstrip("/")
    if value.endswith(".git"):
        value = value[: -len(".git")]
    host, _, rest = value.partition("/")
    return f"{host.lower()}/{rest}" if rest else host.lower()
