from __future__ import annotations

import heapq
import json
import os
import stat
from collections import Counter
from contextlib import closing
from pathlib import Path, PurePosixPath
from typing import Any, Callable, Dict, Iterator, List, NamedTuple, Optional, Set, Tuple

from . import scan_rules as rules
from .constants import (
    SCAN_DEFINITION_MAX_BYTES,
    SCAN_EXCLUDED_COUNT_LIMIT,
    SCAN_LIST_LIMIT,
    SCAN_TOP_DENSITY_LIMIT,
    SCAN_TREE_DEPTH,
    SCAN_TREE_LIMIT,
    SCAN_WALK_ERRORS_LIMIT,
    WORKSPACE_DIR_NAME,
)
from .gitinfo import GitClient, sanitize_remote
from .markers import artifact_marker_kind


class CollectionSettings(NamedTuple):
    root: Path
    scope: Optional[str]
    workspace_prefix: Optional[str]
    max_files: int


class FileEntry(NamedTuple):
    path: str
    name: str
    directories: Tuple[str, ...]
    suffix: str
    stem: str


class FileScanResult(NamedTuple):
    source: str
    fields: Dict[str, Any]
    truncated: Dict[str, Dict[str, Optional[int]]]
    warnings: List[str]


class _LargestFirst:
    __slots__ = ("key", "value")

    def __init__(self, key: Any, value: Any):
        self.key = key
        self.value = value

    def __lt__(self, other: "_LargestFirst") -> bool:
        return self.key > other.key


class SortedSample:
    def __init__(self, limit: int, key: Callable[[Any], Any]):
        self.limit = limit
        self.key = key
        self.total = 0
        self._heap: List[_LargestFirst] = []

    def add(self, value: Any) -> None:
        self.total += 1
        heapq.heappush(self._heap, _LargestFirst(self.key(value), value))
        if len(self._heap) > self.limit:
            heapq.heappop(self._heap)

    def values(self) -> List[Any]:
        return [item.value for item in sorted(self._heap, key=lambda item: item.key)]

    def truncation(self) -> Optional[Dict[str, int]]:
        return truncation_entry(self.total, len(self._heap))


class FirstSample:
    def __init__(self, limit: int):
        self.limit = limit
        self.total = 0
        self.items: List[Any] = []

    def offer(self, build: Callable[[], Any]) -> None:
        self.total += 1
        if len(self.items) < self.limit:
            self.items.append(build())

    def truncation(self) -> Optional[Dict[str, int]]:
        return truncation_entry(self.total, len(self.items))


def truncation_entry(total: int, shown: int) -> Optional[Dict[str, int]]:
    return {"total": total, "shown": shown} if total > shown else None


def ranked_counts(counter: Counter, limit: int) -> Tuple[List[Tuple[str, int]], Optional[Dict[str, int]]]:
    ranked = heapq.nsmallest(limit, counter.items(), key=lambda pair: (-pair[1], pair[0]))
    return ranked, truncation_entry(len(counter), len(ranked))


def path_key(value: Any) -> str:
    return value if isinstance(value, str) else value["path"]


def entrypoint_key(value: Dict[str, str]) -> Tuple[int, str]:
    return rules.CONFIDENCE_LEVELS.index(value["confidence"]), value["path"]


def join_relative(parent: str, name: str) -> str:
    return f"{parent}/{name}" if parent else name


def file_entry(path: str) -> FileEntry:
    parts = path.split("/")
    name = parts[-1]
    stem, suffix = os.path.splitext(name)
    return FileEntry(path, name, tuple(parts[:-1]), suffix.lower(), stem)


def pathspec_args(scope: Optional[str]) -> Tuple[str, ...]:
    if not scope:
        return ()
    return rules.GIT_PATHSPEC_SEPARATOR, f"{rules.GIT_LITERAL_PATHSPEC_PREFIX}{scope}"


def is_within_scope(path: str, scope: Optional[str]) -> bool:
    return not scope or path == scope or path.startswith(f"{scope}/")


def workspace_directory(path: str, workspace_prefix: Optional[str]) -> Optional[str]:
    directories = path.split("/")[:-1]
    if WORKSPACE_DIR_NAME in directories:
        return "/".join(directories[: directories.index(WORKSPACE_DIR_NAME) + 1])
    if workspace_prefix and path.startswith(f"{workspace_prefix}/"):
        return workspace_prefix
    return None


def portable_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    cleaned = sanitize_remote(url)
    if rules.LOCAL_REMOTE.match(cleaned):
        name = PurePosixPath(cleaned.replace(rules.WINDOWS_SEPARATOR, "/").rstrip("/")).name
        return f"{rules.LOCAL_REMOTE_PREFIX}{name}"
    return cleaned


def split_nul(raw: str) -> Iterator[str]:
    start = 0
    length = len(raw)
    while start < length:
        end = raw.find("\0", start)
        if end < 0:
            end = length
        if end > start:
            yield raw[start:end]
        start = end + 1


def capped_count(count: int) -> Tuple[int, bool]:
    if count > SCAN_EXCLUDED_COUNT_LIMIT:
        return SCAN_EXCLUDED_COUNT_LIMIT, True
    return count, False


class ScanLedger:
    def __init__(self, root: Path):
        self.root = str(root)
        self.excluded = FirstSample(SCAN_LIST_LIMIT)
        self.walk_errors = FirstSample(SCAN_WALK_ERRORS_LIMIT)
        self.warnings: List[str] = []

    def relative(self, filename: Any) -> str:
        if not filename:
            return "."
        relative = os.path.relpath(os.fsdecode(filename), self.root)
        return "." if relative == os.curdir else relative.replace(os.sep, "/")

    def record_walk_error(self, error: OSError) -> None:
        path = self.relative(error.filename)
        message = error.strerror or type(error).__name__
        self.walk_errors.offer(lambda: {"path": path, "error": message})

    def record_excluded(self, path: str, reason: str,
                        count_files: Optional[Callable[[], Tuple[int, bool]]] = None) -> None:
        def build() -> Dict[str, Any]:
            file_count, capped = count_files() if count_files else (None, False)
            return {"path": path, "reason": reason, "fileCount": file_count, "fileCountCapped": capped}
        self.excluded.offer(build)

    def warn(self, message: str) -> None:
        if message not in self.warnings:
            self.warnings.append(message)


def read_bounded_text(path: Path, label: str, ledger: ScanLedger) -> Optional[str]:
    if not path.is_file():
        return None
    try:
        with path.open("rb") as handle:
            content = handle.read(SCAN_DEFINITION_MAX_BYTES + 1)
    except OSError as exc:
        ledger.warn(f"cannot read {label}: {exc.strerror or type(exc).__name__}")
        return None
    if len(content) > SCAN_DEFINITION_MAX_BYTES:
        ledger.warn(f"skipped {label}: larger than {SCAN_DEFINITION_MAX_BYTES} bytes")
        return None
    return content.decode("utf-8-sig", errors="replace")


class BuildOutputRules(NamedTuple):
    anywhere: frozenset
    root_only: frozenset

    def excludes(self, parent: str, name: str) -> bool:
        return name in self.anywhere or (not parent and name in self.root_only)


def parse_gitignore_build_entry(line: str) -> Optional[Tuple[str, bool, bool]]:
    entry = line.strip()
    if not entry or entry.startswith(rules.GITIGNORE_COMMENT):
        return None
    negated = entry.startswith(rules.GITIGNORE_NEGATION)
    body = entry[len(rules.GITIGNORE_NEGATION):] if negated else entry
    name = body.strip(rules.GITIGNORE_SEPARATOR)
    if name not in rules.BUILD_OUTPUT_DIRS:
        return None
    return name, body.startswith(rules.GITIGNORE_SEPARATOR), negated


def load_build_output_rules(root: Path, ledger: ScanLedger) -> BuildOutputRules:
    text = read_bounded_text(root / rules.GITIGNORE_FILE_NAME, rules.GITIGNORE_FILE_NAME, ledger)
    anywhere: Set[str] = set()
    root_only: Set[str] = set()
    negated: Set[str] = set()
    for line in (text or "").splitlines():
        parsed = parse_gitignore_build_entry(line)
        if parsed is None:
            continue
        name, anchored, is_negation = parsed
        target = negated if is_negation else (root_only if anchored else anywhere)
        target.add(name)
    return BuildOutputRules(frozenset(anywhere - negated), frozenset(root_only - negated))


def count_files(path: str, ledger: ScanLedger) -> Tuple[int, bool]:
    total = 0
    for _, _, names in os.walk(path, onerror=ledger.record_walk_error):
        total += len(names)
        if total > SCAN_EXCLUDED_COUNT_LIMIT:
            break
    return capped_count(total)


class FilesystemSource:
    name = rules.FILE_SOURCE_FILESYSTEM

    def __init__(self, settings: CollectionSettings, ledger: ScanLedger):
        self.settings = settings
        self.ledger = ledger
        self.root = str(settings.root)
        self.build_rules = load_build_output_rules(settings.root, ledger)

    def paths(self) -> Iterator[str]:
        start = os.path.join(self.root, self.settings.scope) if self.settings.scope else self.root
        for base, directories, names in os.walk(start, onerror=self.ledger.record_walk_error):
            parent = self._relative(base)
            directories[:] = self._kept_directories(parent, directories)
            for name in sorted(names):
                yield join_relative(parent, name)

    def finish(self) -> None:
        return None

    def _relative(self, base: str) -> str:
        relative = os.path.relpath(base, self.root)
        return "" if relative == os.curdir else relative.replace(os.sep, "/")

    def _kept_directories(self, parent: str, directories: List[str]) -> List[str]:
        kept: List[str] = []
        for name in sorted(directories):
            relative = join_relative(parent, name)
            reason = self._exclusion_reason(parent, name, relative)
            if reason is None:
                kept.append(name)
            else:
                absolute = os.path.join(self.root, relative)
                self.ledger.record_excluded(relative, reason, lambda: count_files(absolute, self.ledger))
        return kept

    def _exclusion_reason(self, parent: str, name: str, relative: str) -> Optional[str]:
        if name == WORKSPACE_DIR_NAME or relative == self.settings.workspace_prefix:
            return rules.REASON_WORKSPACE
        if name in rules.ALWAYS_EXCLUDED_DIRS:
            return rules.REASON_DEPENDENCY_OR_TOOLING
        if self.build_rules.excludes(parent, name):
            return rules.REASON_GITIGNORE
        return None


class GitSource:
    name = rules.FILE_SOURCE_GIT

    def __init__(self, git: GitClient, raw_listing: str, settings: CollectionSettings, ledger: ScanLedger):
        self.git = git
        self.raw_listing: Optional[str] = raw_listing
        self.settings = settings
        self.ledger = ledger
        self.root = str(settings.root)
        self.workspace_counts: Counter = Counter()

    def paths(self) -> Iterator[str]:
        previous = None
        for path in split_nul(self.raw_listing or ""):
            if path == previous:
                continue
            previous = path
            if self._accepted(path):
                yield path

    def finish(self) -> None:
        self.raw_listing = None
        for directory in sorted(self.workspace_counts):
            count = self.workspace_counts[directory]
            self.ledger.record_excluded(directory, rules.REASON_WORKSPACE, lambda: capped_count(count))
        self._record_ignored_directories()

    def _accepted(self, path: str) -> bool:
        if path.endswith(rules.GIT_DIRECTORY_SUFFIX):
            self.ledger.record_excluded(path.rstrip(rules.GIT_DIRECTORY_SUFFIX), rules.REASON_NESTED_REPOSITORY)
            return False
        workspace = workspace_directory(path, self.settings.workspace_prefix)
        if workspace is not None:
            self.workspace_counts[workspace] += 1
            return False
        return self._is_present_file(path)

    def _is_present_file(self, path: str) -> bool:
        try:
            mode = os.lstat(os.path.join(self.root, path)).st_mode
        except (FileNotFoundError, NotADirectoryError):
            return False
        except OSError as exc:
            self.ledger.record_walk_error(exc)
            return False
        return stat.S_ISREG(mode) or stat.S_ISLNK(mode)

    def _record_ignored_directories(self) -> None:
        raw = self.git.run_raw(*rules.GIT_LIST_IGNORED_DIRECTORIES_ARGS, *pathspec_args(self.settings.scope))
        for path in split_nul(raw or ""):
            if path.endswith(rules.GIT_DIRECTORY_SUFFIX):
                self.ledger.record_excluded(path.rstrip(rules.GIT_DIRECTORY_SUFFIX), rules.REASON_GITIGNORE)


def open_file_source(git: Optional[GitClient], settings: CollectionSettings, ledger: ScanLedger):
    if git is None:
        return FilesystemSource(settings, ledger)
    raw = git.run_raw(*rules.GIT_LIST_FILES_ARGS, *pathspec_args(settings.scope))
    if raw is None:
        ledger.warn("git ls-files failed; files were collected by walking the filesystem instead")
        return FilesystemSource(settings, ledger)
    return GitSource(git, raw, settings, ledger)


def name_tokens(stem: str) -> Set[str]:
    tokens: Set[str] = set()
    for chunk in rules.NAME_CHUNK_SEPARATOR.split(stem):
        if chunk:
            tokens.add(chunk.lower())
            tokens.update(token.lower() for token in rules.CAMEL_CASE_TOKEN.findall(chunk))
    return tokens


def intent_match(entry: FileEntry) -> Optional[str]:
    if not entry.suffix:
        return rules.MATCHED_BY_NAME_TOKEN if entry.name.lower() in rules.INTENT_TOKENS else None
    if entry.suffix not in rules.DOC_EXTENSIONS:
        return None
    if name_tokens(entry.stem) & rules.INTENT_TOKENS:
        return rules.MATCHED_BY_NAME_TOKEN
    if any(part.lower() in rules.DOCS_FOLDER_NAMES for part in entry.directories):
        return rules.MATCHED_BY_DOCS_FOLDER
    return None


def entrypoint_match(entry: FileEntry) -> Optional[Tuple[str, str]]:
    for rule, pattern in rules.ENTRYPOINT_PATH_RULES:
        if pattern.search(entry.path):
            return rule, rules.CONFIDENCE_HIGH
    if entry.name in rules.ENTRYPOINT_HIGH_NAMES:
        return entry.name, rules.CONFIDENCE_HIGH
    if entry.name in rules.ENTRYPOINT_LOW_NAMES:
        return entry.name, rules.CONFIDENCE_LOW
    return None


def is_manifest(entry: FileEntry) -> bool:
    return rules.MANIFEST_NAME.match(entry.name) is not None


def is_api_specification(entry: FileEntry) -> bool:
    return entry.suffix in rules.API_SPEC_SUFFIXES or rules.API_SPEC_NAME.match(entry.name) is not None


def is_environment_template(entry: FileEntry) -> bool:
    return rules.ENVIRONMENT_TEMPLATE_NAME.match(entry.name) is not None


def is_ci_definition(entry: FileEntry) -> bool:
    return rules.CI_PATH.search(entry.path) is not None


def is_deployment_descriptor(entry: FileEntry) -> bool:
    if rules.DEPLOYMENT_NAME.match(entry.name):
        return True
    return any(part.lower() in rules.INFRA_DIR_NAMES for part in entry.directories)


def definition_kind(entry: FileEntry) -> Optional[str]:
    if entry.suffix == rules.SOLUTION_SUFFIX:
        return rules.KIND_DOTNET_SOLUTION
    return rules.DEFINITION_KIND_BY_NAME.get(entry.name)


def string_list(value: Any) -> Optional[List[str]]:
    if not isinstance(value, list):
        return None
    return [item for item in value if isinstance(item, str)]


def json_object(text: str) -> Dict[str, Any]:
    data = json.loads(text)
    return data if isinstance(data, dict) else {}


def npm_workspaces(text: str) -> Optional[List[str]]:
    value = json_object(text).get(rules.NPM_WORKSPACES_KEY)
    if isinstance(value, dict):
        value = value.get(rules.NPM_WORKSPACES_PACKAGES_KEY)
    return string_list(value)


def lerna_packages(text: str) -> List[str]:
    return string_list(json_object(text).get(rules.LERNA_PACKAGES_KEY)) or []


def yaml_scalar(value: str) -> str:
    stripped = value.strip()
    quoted = rules.QUOTED_STRING.match(stripped)
    if quoted:
        return quoted.group(1) if quoted.group(1) is not None else quoted.group(2)
    return stripped.split(rules.YAML_INLINE_COMMENT, 1)[0].strip()


def yaml_flow_sequence(text: str) -> List[str]:
    if not text.startswith(rules.YAML_FLOW_OPEN) or rules.YAML_FLOW_CLOSE not in text:
        return []
    inner = text[len(rules.YAML_FLOW_OPEN):text.index(rules.YAML_FLOW_CLOSE)]
    return [yaml_scalar(item) for item in inner.split(rules.YAML_FLOW_SEPARATOR) if item.strip()]


def yaml_block_sequence(lines: List[str]) -> List[str]:
    items: List[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith(rules.YAML_COMMENT):
            continue
        item = rules.YAML_LIST_ITEM.match(line)
        if not item:
            break
        items.append(yaml_scalar(item.group(1)))
    return items


def pnpm_packages(text: str) -> List[str]:
    lines = text.splitlines()
    for index, line in enumerate(lines):
        key = rules.PNPM_PACKAGES_KEY.match(line)
        if not key:
            continue
        inline = key.group(1).strip()
        if inline and not inline.startswith(rules.YAML_COMMENT):
            return yaml_flow_sequence(inline)
        return yaml_block_sequence(lines[index + 1:])
    return []


def go_path(value: str) -> str:
    return value.strip().strip(rules.GO_PATH_QUOTES)


def go_work_uses(text: str) -> List[str]:
    members: List[str] = []
    in_block = False
    for raw_line in text.splitlines():
        line = raw_line.split(rules.GO_LINE_COMMENT, 1)[0].strip()
        if in_block:
            in_block = not line.startswith(rules.GO_BLOCK_CLOSE)
            if in_block and line:
                members.append(go_path(line))
            continue
        use = rules.GO_WORK_USE.match(line)
        rest = use.group(1).strip() if use else ""
        if rest.startswith(rules.GO_BLOCK_OPEN):
            in_block = True
        elif rest:
            members.append(go_path(rest))
    return members


def toml_section_lines(text: str, section: str) -> Optional[List[str]]:
    current = None
    found = False
    lines: List[str] = []
    for line in text.splitlines():
        header = rules.TOML_SECTION_HEADER.match(line)
        if header:
            current = header.group(1)
            found = found or current == section
        elif current == section:
            lines.append(line)
    return lines if found else None


def toml_string_array(lines: List[str], key: Any) -> List[str]:
    collected: List[str] = []
    collecting = False
    for line in lines:
        content = line.split(rules.TOML_COMMENT, 1)[0]
        if not collecting:
            match = key.match(content)
            if not match:
                continue
            collecting = True
            content = content[match.end():]
        collected.append(content)
        if rules.TOML_ARRAY_CLOSE in content:
            break
    return quoted_strings(" ".join(collected))


def quoted_strings(text: str) -> List[str]:
    return [double if double else single for double, single in rules.QUOTED_STRING.findall(text)]


def cargo_members(text: str) -> Optional[List[str]]:
    section = toml_section_lines(text, rules.CARGO_WORKSPACE_SECTION)
    if section is None:
        return None
    return toml_string_array(section, rules.CARGO_MEMBERS_KEY)


def gradle_includes(text: str) -> Optional[List[str]]:
    members: List[str] = []
    depth = 0
    collecting = False
    for raw_line in text.splitlines():
        line = raw_line.split(rules.GRADLE_LINE_COMMENT, 1)[0]
        if not collecting and not rules.GRADLE_INCLUDE.match(line):
            continue
        members.extend(quoted_strings(line))
        depth = max(depth + line.count(rules.GRADLE_CALL_OPEN) - line.count(rules.GRADLE_CALL_CLOSE), 0)
        collecting = depth > 0 or line.rstrip().endswith(rules.GRADLE_CONTINUATION)
    return members or None


def solution_projects(text: str) -> List[str]:
    members: List[str] = []
    for line in text.splitlines():
        project = rules.SOLUTION_PROJECT.match(line.strip())
        if not project:
            continue
        path = project.group(1).replace(rules.WINDOWS_SEPARATOR, "/")
        if rules.SOLUTION_PROJECT_FILE.search(path):
            members.append(path)
    return members


DEFINITION_PARSERS: Dict[str, Callable[[str], Optional[List[str]]]] = {
    rules.KIND_NPM_WORKSPACES: npm_workspaces,
    rules.KIND_PNPM_WORKSPACE: pnpm_packages,
    rules.KIND_GO_WORK: go_work_uses,
    rules.KIND_CARGO_WORKSPACE: cargo_members,
    rules.KIND_GRADLE_SETTINGS: gradle_includes,
    rules.KIND_DOTNET_SOLUTION: solution_projects,
    rules.KIND_LERNA: lerna_packages,
}

NAME_SIGNALS: Tuple[Tuple[str, Callable[[FileEntry], bool]], ...] = (
    ("manifests", is_manifest),
    ("apiSpecifications", is_api_specification),
    ("deploymentAndInfrastructure", is_deployment_descriptor),
    ("environmentTemplates", is_environment_template),
    ("ciCd", is_ci_definition),
)


class Classifier:
    def __init__(self, settings: CollectionSettings, ledger: ScanLedger):
        self.root = settings.root
        self.scope = settings.scope
        self.base_depth = len(settings.scope.split("/")) if settings.scope else 0
        self.ledger = ledger
        self.file_count = 0
        self.source_count = 0
        self.files_truncated = False
        self.languages: Counter = Counter()
        self.top_level: Counter = Counter()
        self.tree: Counter = Counter()
        self.monorepo_signals: Set[str] = set()
        self.samples: Dict[str, SortedSample] = {
            "manifests": SortedSample(SCAN_LIST_LIMIT, path_key),
            "intentDocuments": SortedSample(SCAN_LIST_LIMIT, path_key),
            "generatedArtifacts": SortedSample(SCAN_LIST_LIMIT, path_key),
            "apiSpecifications": SortedSample(SCAN_LIST_LIMIT, path_key),
            "entrypointCandidates": SortedSample(SCAN_LIST_LIMIT, entrypoint_key),
            "deploymentAndInfrastructure": SortedSample(SCAN_LIST_LIMIT, path_key),
            "environmentTemplates": SortedSample(SCAN_LIST_LIMIT, path_key),
            "ciCd": SortedSample(SCAN_LIST_LIMIT, path_key),
            "workspaceDefinitions": SortedSample(SCAN_LIST_LIMIT, path_key),
        }

    def add(self, path: str) -> None:
        entry = file_entry(path)
        self.file_count += 1
        self._count_language(entry)
        self._count_structure(entry)
        for field, matches in NAME_SIGNALS:
            if matches(entry):
                self.samples[field].add(entry.path)
        self._classify_documents(entry)
        self._classify_entrypoint(entry)
        self._classify_workspace_definition(entry)

    def _count_language(self, entry: FileEntry) -> None:
        language = rules.LANGUAGE_BY_EXTENSION.get(entry.suffix)
        if language:
            self.languages[language] += 1
            self.source_count += 1

    def _count_structure(self, entry: FileEntry) -> None:
        directories = entry.directories
        nested = len(directories) > self.base_depth
        self.top_level["/".join(directories[: self.base_depth + 1]) if nested else (self.scope or ".")] += 1
        for depth in range(self.base_depth + 1, min(len(directories), self.base_depth + SCAN_TREE_DEPTH) + 1):
            self.tree["/".join(directories[:depth])] += 1
        if nested and directories[self.base_depth] in rules.MONOREPO_DIR_NAMES:
            self.monorepo_signals.add("/".join(directories[: self.base_depth + 1]) + "/")

    def _classify_documents(self, entry: FileEntry) -> None:
        matched_by = intent_match(entry)
        if matched_by is None and entry.suffix not in rules.MARKER_PROBE_SUFFIXES:
            return
        marker = artifact_marker_kind(self.root / entry.path)
        if marker:
            self.samples["generatedArtifacts"].add({"path": entry.path, "marker": marker})
        elif matched_by:
            self.samples["intentDocuments"].add({"path": entry.path, "matchedBy": matched_by})

    def _classify_entrypoint(self, entry: FileEntry) -> None:
        match = entrypoint_match(entry)
        if match:
            rule, confidence = match
            self.samples["entrypointCandidates"].add({"path": entry.path, "rule": rule, "confidence": confidence})

    def _classify_workspace_definition(self, entry: FileEntry) -> None:
        kind = definition_kind(entry)
        if kind is None:
            return
        members = [] if kind in rules.PRESENCE_ONLY_KINDS else self._definition_members(kind, entry)
        if members is None:
            return
        self.samples["workspaceDefinitions"].add({"path": entry.path, "kind": kind, "members": members})
        if members or kind in rules.PRESENCE_ONLY_KINDS:
            self.monorepo_signals.add(kind)

    def _definition_members(self, kind: str, entry: FileEntry) -> Optional[List[str]]:
        text = read_bounded_text(self.root / entry.path, entry.path, self.ledger)
        if text is None:
            return None
        try:
            return DEFINITION_PARSERS[kind](text)
        except ValueError as exc:
            self.ledger.warn(f"cannot parse {entry.path} as {kind}: {exc}")
            return None


def gitmodules_entries(text: str) -> List[Dict[str, Optional[str]]]:
    entries: List[Dict[str, Optional[str]]] = []
    for line in text.splitlines():
        if rules.GITMODULES_SECTION.match(line):
            entries.append({"path": None, "url": None})
            continue
        pair = rules.GITMODULES_KEY_VALUE.match(line)
        if pair and entries:
            entries[-1][pair.group(1)] = pair.group(2)
    return entries


def submodule_sample(settings: CollectionSettings, ledger: ScanLedger) -> SortedSample:
    sample = SortedSample(SCAN_LIST_LIMIT, path_key)
    text = read_bounded_text(settings.root / rules.GITMODULES_FILE_NAME, rules.GITMODULES_FILE_NAME, ledger)
    for entry in gitmodules_entries(text or ""):
        path = entry["path"]
        if path and is_within_scope(path, settings.scope):
            sample.add({"path": path, "url": portable_url(entry["url"])})
    return sample


def counted_entries(counter: Counter, limit: int) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, int]]]:
    ranked, truncation = ranked_counts(counter, limit)
    return [{"path": path, "files": files} for path, files in ranked], truncation


def build_fields(source: str, classifier: Classifier, ledger: ScanLedger, submodules: SortedSample) -> FileScanResult:
    truncated: Dict[str, Dict[str, Optional[int]]] = {}
    if classifier.files_truncated:
        truncated["files"] = {"total": None, "shown": classifier.file_count}
    samples = classifier.samples
    top_level, top_level_truncation = counted_entries(classifier.top_level, SCAN_TOP_DENSITY_LIMIT)
    tree, tree_truncation = counted_entries(classifier.tree, SCAN_TREE_LIMIT)
    fields: Dict[str, Any] = {
        "counts": {"files": classifier.file_count, "sourceFiles": classifier.source_count},
        "languagesByFileCount": dict(ranked_counts(classifier.languages, len(classifier.languages))[0]),
    }
    for name, sample in samples.items():
        fields[name] = sample.values()
        record_truncation(truncated, name, sample.truncation())
    fields["monorepoSignals"] = sorted(classifier.monorepo_signals)
    fields["submodules"] = submodules.values()
    fields["topLevelDensity"] = top_level
    fields["directoryTree"] = tree
    fields["excludedDirectories"] = sorted(ledger.excluded.items, key=path_key)
    fields["walkErrors"] = ledger.walk_errors.items
    record_truncation(truncated, "submodules", submodules.truncation())
    record_truncation(truncated, "topLevelDensity", top_level_truncation)
    record_truncation(truncated, "directoryTree", tree_truncation)
    record_truncation(truncated, "excludedDirectories", ledger.excluded.truncation())
    record_truncation(truncated, "walkErrors", ledger.walk_errors.truncation())
    return FileScanResult(source, fields, truncated, ledger.warnings)


def record_truncation(truncated: Dict[str, Any], name: str, entry: Optional[Dict[str, int]]) -> None:
    if entry is not None:
        truncated[name] = entry


def scan_files(git: Optional[GitClient], settings: CollectionSettings) -> FileScanResult:
    ledger = ScanLedger(settings.root)
    source = open_file_source(git, settings, ledger)
    classifier = Classifier(settings, ledger)
    with closing(source.paths()) as paths:
        for path in paths:
            if classifier.file_count >= settings.max_files:
                classifier.files_truncated = True
                break
            classifier.add(path)
    source.finish()
    return build_fields(source.name, classifier, ledger, submodule_sample(settings, ledger))
