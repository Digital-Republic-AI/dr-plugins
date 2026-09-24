from __future__ import annotations

import fnmatch
import re
from typing import Iterable, Pattern


def glob_regex(patterns: Iterable[str]) -> Pattern:
    return re.compile("|".join(fnmatch.translate(pattern) for pattern in patterns))


def alternation_regex(expressions: Iterable[str]) -> Pattern:
    return re.compile("|".join(f"(?:{expression})" for expression in expressions))


FILE_SOURCE_GIT = "git"
FILE_SOURCE_FILESYSTEM = "filesystem"

REASON_DEPENDENCY_OR_TOOLING = "dependency-or-tooling"
REASON_GITIGNORE = "gitignore"
REASON_WORKSPACE = "workspace"
REASON_NESTED_REPOSITORY = "nested-git-repository"

ALWAYS_EXCLUDED_DIRS = frozenset({
    ".git", "node_modules", ".venv", "venv", "__pycache__", ".tox", ".cache", ".yarn", ".gradle",
    ".idea", ".vscode", ".claude", ".dr_ai",
})
BUILD_OUTPUT_DIRS = frozenset({
    "dist", "build", "out", "target", "bin", "obj", "vendor", "coverage", ".next", ".nuxt", ".turbo",
})

GITIGNORE_FILE_NAME = ".gitignore"
GITIGNORE_COMMENT = "#"
GITIGNORE_NEGATION = "!"
GITIGNORE_SEPARATOR = "/"

GIT_LIST_FILES_ARGS = ("ls-files", "-z", "--cached", "--others", "--exclude-standard")
GIT_LIST_IGNORED_DIRECTORIES_ARGS = (
    "ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--directory", "--no-empty-directory",
)
GIT_PATHSPEC_SEPARATOR = "--"
GIT_LITERAL_PATHSPEC_PREFIX = ":(literal)"
GIT_UNQUOTED_PATHS_ARGS = ("-c", "core.quotepath=false")
GIT_DIRECTORY_SUFFIX = "/"

LANGUAGE_BY_EXTENSION = {
    ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript", ".mjs": "JavaScript",
    ".cjs": "JavaScript", ".py": "Python", ".go": "Go", ".java": "Java", ".kt": "Kotlin", ".kts": "Kotlin",
    ".cs": "C#", ".fs": "F#", ".rs": "Rust", ".php": "PHP", ".rb": "Ruby", ".ex": "Elixir", ".exs": "Elixir",
    ".dart": "Dart", ".swift": "Swift", ".scala": "Scala", ".c": "C", ".h": "C/C++", ".cpp": "C++", ".cc": "C++",
    ".hpp": "C++", ".m": "Objective-C", ".vue": "Vue", ".svelte": "Svelte", ".lua": "Lua", ".clj": "Clojure",
}

MANIFEST_PATTERNS = (
    "package.json", "pnpm-workspace.yaml", "yarn.lock", "pnpm-lock.yaml", "package-lock.json", "bun.lockb",
    "pyproject.toml", "requirements*.txt", "Pipfile", "poetry.lock", "uv.lock", "setup.py", "setup.cfg",
    "go.mod", "go.work", "Cargo.toml", "pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle*",
    "*.csproj", "*.fsproj", "*.sln", "composer.json", "Gemfile", "mix.exs", "pubspec.yaml", "Package.swift",
    "CMakeLists.txt", "BUILD", "BUILD.bazel", "WORKSPACE", "MODULE.bazel", "Makefile", "deno.json",
)
MANIFEST_NAME = glob_regex(MANIFEST_PATTERNS)

DOC_EXTENSIONS = frozenset({".md", ".mdx", ".rst", ".txt", ".adoc"})
INTENT_TOKENS = frozenset({
    "readme", "prd", "trd", "roadmap", "spec", "specs", "specification", "design", "architecture", "runbook",
    "adr", "rfc",
})
DOCS_FOLDER_NAMES = frozenset({"docs", "doc", "documentation", "adr", "adrs"})
NAME_CHUNK_SEPARATOR = re.compile(r"[^A-Za-z0-9]+")
CAMEL_CASE_TOKEN = re.compile(r"[A-Z]+(?![a-z])|[A-Z][a-z]*|[a-z]+|[0-9]+")
MATCHED_BY_NAME_TOKEN = "name-token"
MATCHED_BY_DOCS_FOLDER = "docs-folder"
MARKER_PROBE_SUFFIXES = frozenset({".dsl"})

API_SPEC_NAME = re.compile(r"^(?:openapi|swagger|asyncapi)[^/]*\.(?:ya?ml|json)$", re.IGNORECASE)
API_SPEC_SUFFIXES = frozenset({".proto", ".graphql", ".gql"})

INFRA_DIR_NAMES = frozenset({
    "k8s", "kubernetes", "helm", "terraform", "infra", "infrastructure", "charts", "deploy", "deployment",
    "deployments",
})
DEPLOYMENT_PATTERNS = (
    "Dockerfile*", "*.Dockerfile", "Containerfile*", "compose.yaml", "compose.yml", "compose.*.yaml",
    "compose.*.yml", "docker-compose*.yml", "docker-compose*.yaml", "Procfile", "fly.toml", "vercel.json",
    "netlify.toml", "app.yaml", "skaffold.yaml", "render.yaml", "railway.json", "railway.toml",
    "kustomization.yaml", "kustomization.yml", "Chart.yaml", "serverless.yml", "serverless.yaml", "*.tf",
    "Pulumi.*", "template.yaml", "template.yml", "cdk.json", "*.bicep",
)
DEPLOYMENT_NAME = glob_regex(DEPLOYMENT_PATTERNS)
ENVIRONMENT_TEMPLATE_NAME = re.compile(r"^\.env(?:\.[A-Za-z0-9_-]+)*\.(?:example|sample|template|defaults)$")

CI_PATH = alternation_regex((
    r"^\.github/workflows/[^/]+\.ya?ml$",
    r"^\.gitlab-ci\.ya?ml$",
    r"(?:^|/)Jenkinsfile$",
    r"^\.circleci/config\.ya?ml$",
    r"^azure-pipelines\.ya?ml$",
    r"^bitbucket-pipelines\.ya?ml$",
))

CONFIDENCE_HIGH = "high"
CONFIDENCE_LOW = "low"
CONFIDENCE_LEVELS = (CONFIDENCE_HIGH, CONFIDENCE_LOW)
ENTRYPOINT_PATH_RULES = (
    ("cmd/*/main.go", re.compile(r"(?:^|/)cmd/[^/]+/main\.go$")),
    ("src/main.rs", re.compile(r"(?:^|/)src/main\.rs$")),
    ("src/bin/*.rs", re.compile(r"(?:^|/)src/bin/[^/]+\.rs$")),
    ("public/index.php", re.compile(r"(?:^|/)public/index\.php$")),
    ("*Application.java", re.compile(r"(?:^|/)[^/]*Application\.java$")),
    ("*Application.kt", re.compile(r"(?:^|/)[^/]*Application\.kt$")),
    ("handler.*", re.compile(r"(?:^|/)handler\.[^/]+$")),
    ("bin/*", re.compile(r"(?:^|/)bin/[^/.]+(?:\.js)?$")),
)
ENTRYPOINT_HIGH_NAMES = frozenset({
    "main.py", "app.py", "server.py", "manage.py", "wsgi.py", "asgi.py", "__main__.py", "main.go", "Program.cs",
    "Main.java", "Main.kt", "main.ts", "main.tsx", "main.js", "server.ts", "server.js", "app.ts", "app.js",
    "main.swift", "lambda_function.py",
})
ENTRYPOINT_LOW_NAMES = frozenset({"index.ts", "index.js", "index.tsx"})

KIND_NPM_WORKSPACES = "npm-workspaces"
KIND_PNPM_WORKSPACE = "pnpm-workspace"
KIND_GO_WORK = "go-work"
KIND_CARGO_WORKSPACE = "cargo-workspace"
KIND_GRADLE_SETTINGS = "gradle-settings"
KIND_DOTNET_SOLUTION = "dotnet-solution"
KIND_LERNA = "lerna"
KIND_NX = "nx"
KIND_TURBO = "turbo"
KIND_RUSH = "rush"
DEFINITION_KIND_BY_NAME = {
    "package.json": KIND_NPM_WORKSPACES,
    "pnpm-workspace.yaml": KIND_PNPM_WORKSPACE,
    "go.work": KIND_GO_WORK,
    "Cargo.toml": KIND_CARGO_WORKSPACE,
    "settings.gradle": KIND_GRADLE_SETTINGS,
    "settings.gradle.kts": KIND_GRADLE_SETTINGS,
    "lerna.json": KIND_LERNA,
    "nx.json": KIND_NX,
    "turbo.json": KIND_TURBO,
    "rush.json": KIND_RUSH,
}
SOLUTION_SUFFIX = ".sln"
PRESENCE_ONLY_KINDS = frozenset({KIND_NX, KIND_TURBO, KIND_RUSH})
MONOREPO_DIR_NAMES = frozenset({"apps", "packages", "services", "libs", "modules"})

NPM_WORKSPACES_KEY = "workspaces"
NPM_WORKSPACES_PACKAGES_KEY = "packages"
LERNA_PACKAGES_KEY = "packages"
QUOTED_STRING = re.compile(r"\"([^\"]*)\"|'([^']*)'")
YAML_COMMENT = "#"
YAML_INLINE_COMMENT = " #"
YAML_FLOW_OPEN = "["
YAML_FLOW_CLOSE = "]"
YAML_FLOW_SEPARATOR = ","
YAML_LIST_ITEM = re.compile(r"^\s*-\s+(.+)$")
PNPM_PACKAGES_KEY = re.compile(r"^packages\s*:(.*)$")
GO_LINE_COMMENT = "//"
GO_WORK_USE = re.compile(r"^use\b(.*)$")
GO_BLOCK_OPEN = "("
GO_BLOCK_CLOSE = ")"
GO_PATH_QUOTES = "\"`"
TOML_COMMENT = "#"
TOML_SECTION_HEADER = re.compile(r"^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*(?:#.*)?$")
TOML_ARRAY_CLOSE = "]"
CARGO_WORKSPACE_SECTION = "workspace"
CARGO_MEMBERS_KEY = re.compile(r"^\s*members\s*=")
GRADLE_LINE_COMMENT = "//"
GRADLE_INCLUDE = re.compile(r"^\s*include\b")
GRADLE_CALL_OPEN = "("
GRADLE_CALL_CLOSE = ")"
GRADLE_CONTINUATION = ","
SOLUTION_PROJECT = re.compile(r"^Project\(\"\{[^}]*\}\"\)\s*=\s*\"[^\"]*\"\s*,\s*\"([^\"]+)\"")
SOLUTION_PROJECT_FILE = re.compile(r"\.[A-Za-z0-9]*proj$")
WINDOWS_SEPARATOR = "\\"

GITMODULES_FILE_NAME = ".gitmodules"
GITMODULES_SECTION = re.compile(r"^\s*\[submodule\s+\"([^\"]*)\"\s*\]\s*$")
GITMODULES_KEY_VALUE = re.compile(r"^\s*(path|url)\s*=\s*(.*?)\s*$")
LOCAL_REMOTE = re.compile(r"^(?:file://|/|~|[A-Za-z]:[\\/])")
LOCAL_REMOTE_PREFIX = "local:"
