#!/usr/bin/env bash
set -euo pipefail

readonly EXIT_USAGE=2
readonly EXIT_VALIDATION=3
readonly EXIT_OPERATIONAL=5
readonly DEFAULT_IMAGE="structurizr/cli:2025.11.09"
readonly DEFAULT_PLANTUML_IMAGE="plantuml/plantuml:1.2026.8"
readonly MIN_JAVA_MAJOR=17
readonly CONTAINER_WORKSPACE_DIR="/workspace"
readonly CONTAINER_OUTPUT_DIR="/output"
readonly CONTAINER_DATA_DIR="/data"
readonly PLANTUML_FORMAT_PREFIX="plantuml"
readonly PUML_SUFFIX=".puml"
readonly SVG_SUFFIX=".svg"

PROG="${0##*/}"
readonly PROG

usage() {
  cat <<EOF
Usage: ${PROG} [options]

Validate a Structurizr DSL workspace, then export its views.

Options:
  -w, --workspace PATH  DSL file to process
                        (default: docs/architecture/workspace.dsl, relative to the current directory)
  -f, --format FORMAT   Structurizr CLI export format (default: plantuml/c4plantuml)
  -o, --output DIR      Directory for exported files (default: <DSL directory>/diagrams)
      --validate-only   Validate only; do not export or create the output directory
      --svg             After a PlantUML export, render every .puml in the output
                        directory to .svg with PlantUML (needs a PlantUML runner)
  -h, --help            Show this help and exit

Structurizr runner selection (first match wins):
  1. STRUCTURIZR_CLI, when set
  2. structurizr.sh found on PATH
  3. docker with a reachable daemon, running STRUCTURIZR_IMAGE

PlantUML runner selection for --svg (first match wins):
  1. PLANTUML_JAR, when set (run with java on PATH)
  2. plantuml found on PATH
  3. docker with a reachable daemon, running PLANTUML_IMAGE

Environment:
  STRUCTURIZR_CLI    Path to the Structurizr CLI launcher (structurizr.sh); needs Java ${MIN_JAVA_MAJOR}+ on PATH
  STRUCTURIZR_IMAGE  Docker image (default: ${DEFAULT_IMAGE})
  PLANTUML_JAR       Path to plantuml.jar; needs java on PATH
  PLANTUML_IMAGE     Docker image for --svg (default: ${DEFAULT_PLANTUML_IMAGE})

Exit codes:
  0  success
  2  invalid usage
  3  validation failed
  5  operational error or missing prerequisite (DSL file, runner, Java, Docker daemon,
     output directory, export or render failure)
EOF
}

fail() {
  local code="$1"
  shift
  printf '%s: error: %s\n' "$PROG" "$*" >&2
  exit "$code"
}

usage_error() {
  printf '%s: error: %s\n' "$PROG" "$*" >&2
  printf "Run '%s --help' for usage.\n" "$PROG" >&2
  exit "$EXIT_USAGE"
}

absolute_path() {
  case "$1" in
    /*) printf '%s\n' "$1" ;;
    *) printf '%s/%s\n' "$PWD" "$1" ;;
  esac
}

java_major_version() {
  local marker='version "'
  local output version
  output="$(java -version 2>&1)" || return 1
  version="${output#*"$marker"}"
  [ "$version" != "$output" ] || return 1
  version="${version%%\"*}"
  version="${version#1.}"
  version="${version%%[!0-9]*}"
  [ -n "$version" ] || return 1
  printf '%s\n' "$version"
}

require_java() {
  local major
  if ! command -v java >/dev/null 2>&1; then
    fail "$EXIT_OPERATIONAL" "java not found on PATH; the Structurizr CLI requires Java ${MIN_JAVA_MAJOR}+"
  fi
  if major="$(java_major_version)" && [ "$major" -lt "$MIN_JAVA_MAJOR" ]; then
    fail "$EXIT_OPERATIONAL" "java ${major} found on PATH; the Structurizr CLI requires Java ${MIN_JAVA_MAJOR}+"
  fi
}

run_validate() {
  if [ -n "$cli" ]; then
    "$cli" validate -workspace "$workspace_path"
  else
    docker run --rm --user "$(id -u):$(id -g)" \
      --volume "$workspace_dir:$CONTAINER_WORKSPACE_DIR:ro" \
      "$image" validate -workspace "$CONTAINER_WORKSPACE_DIR/$workspace_name"
  fi
}

run_export() {
  if [ -n "$cli" ]; then
    "$cli" export -workspace "$workspace_path" -format "$format" -output "$output_path"
  else
    docker run --rm --user "$(id -u):$(id -g)" \
      --volume "$workspace_dir:$CONTAINER_WORKSPACE_DIR:ro" \
      --volume "$output_path:$CONTAINER_OUTPUT_DIR" \
      "$image" export -workspace "$CONTAINER_WORKSPACE_DIR/$workspace_name" \
      -format "$format" -output "$CONTAINER_OUTPUT_DIR"
  fi
}

run_render() {
  local file names=()
  for file in "$@"; do
    names+=("$CONTAINER_DATA_DIR/${file##*/}")
  done
  case "$plantuml_runner" in
    jar) java -jar "$PLANTUML_JAR" -tsvg "$@" ;;
    path) "$plantuml_cli" -tsvg "$@" ;;
    docker)
      docker run --rm --user "$(id -u):$(id -g)" \
        --volume "$output_path:$CONTAINER_DATA_DIR" \
        "$plantuml_image" -tsvg "${names[@]}"
      ;;
  esac
}

docker_reachable() {
  if [ "$docker_state" = "unknown" ]; then
    docker_state="down"
    if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
      docker_state="up"
    fi
  fi
  [ "$docker_state" = "up" ]
}

select_plantuml_runner() {
  plantuml_image="${PLANTUML_IMAGE:-$DEFAULT_PLANTUML_IMAGE}"
  plantuml_runner=""
  plantuml_cli=""
  if [ -n "${PLANTUML_JAR:-}" ]; then
    if [ ! -f "$PLANTUML_JAR" ]; then
      fail "$EXIT_OPERATIONAL" "PLANTUML_JAR is not a file: $PLANTUML_JAR"
    fi
    if ! command -v java >/dev/null 2>&1; then
      fail "$EXIT_OPERATIONAL" "java not found on PATH; PLANTUML_JAR needs a Java runtime"
    fi
    plantuml_runner="jar"
  elif command -v plantuml >/dev/null 2>&1; then
    plantuml_runner="path"
    plantuml_cli="$(command -v plantuml)"
  elif docker_reachable; then
    plantuml_runner="docker"
  else
    fail "$EXIT_OPERATIONAL" "no PlantUML runner found for --svg: set PLANTUML_JAR, put plantuml on PATH, or start Docker"
  fi
}

render_svgs() {
  local file puml_files=() missing=() rendered=0
  for file in "$output_path"/*"$PUML_SUFFIX"; do
    [ -e "$file" ] && puml_files+=("$file")
  done
  if [ "${#puml_files[@]}" -eq 0 ]; then
    fail "$EXIT_OPERATIONAL" "export wrote no $PUML_SUFFIX files to $output_path; nothing to render"
  fi
  status=0
  run_render "${puml_files[@]}" || status=$?
  if [ "$status" -ne 0 ]; then
    fail "$EXIT_OPERATIONAL" "PlantUML rendering failed (exit $status)"
  fi
  for file in "${puml_files[@]}"; do
    if [ -f "${file%"$PUML_SUFFIX"}$SVG_SUFFIX" ]; then
      rendered=$((rendered + 1))
    else
      missing+=("${file##*/}")
    fi
  done
  if [ "${#missing[@]}" -ne 0 ]; then
    fail "$EXIT_OPERATIONAL" "PlantUML wrote no SVG for: ${missing[*]}"
  fi
  printf 'Rendered %s SVG files in %s\n' "$rendered" "$output_path"
}

workspace="docs/architecture/workspace.dsl"
format="plantuml/c4plantuml"
output=""
validate_only=0
render_svg=0
docker_state="unknown"

while [ "$#" -gt 0 ]; do
  case "$1" in
    -w|--workspace|-f|--format|-o|--output)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then
        usage_error "option $1 requires a non-empty value"
      fi
      case "$1" in
        -w|--workspace) workspace="$2" ;;
        -f|--format) format="$2" ;;
        *) output="$2" ;;
      esac
      shift 2
      ;;
    --validate-only)
      validate_only=1
      shift
      ;;
    --svg)
      render_svg=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      usage_error "unknown option: $1"
      ;;
    *)
      usage_error "unexpected argument: $1"
      ;;
  esac
done

if [ "$render_svg" -eq 1 ] && [ "$validate_only" -eq 1 ]; then
  usage_error "--svg cannot be combined with --validate-only"
fi
if [ "$render_svg" -eq 1 ]; then
  case "$format" in
    "$PLANTUML_FORMAT_PREFIX"|"$PLANTUML_FORMAT_PREFIX"/*) ;;
    *) usage_error "--svg needs a PlantUML export format, not '$format'" ;;
  esac
fi

workspace_path="$(absolute_path "$workspace")"
if [ ! -f "$workspace_path" ]; then
  fail "$EXIT_OPERATIONAL" "workspace file not found: $workspace_path"
fi
if [ ! -r "$workspace_path" ]; then
  fail "$EXIT_OPERATIONAL" "workspace file is not readable: $workspace_path"
fi
workspace_dir="$(cd -P -- "$(dirname -- "$workspace_path")" >/dev/null && pwd -P)"
workspace_name="${workspace_path##*/}"
workspace_path="$workspace_dir/$workspace_name"

if [ -n "$output" ]; then
  output_path="$(absolute_path "$output")"
else
  output_path="$workspace_dir/diagrams"
fi
if [ "$validate_only" -eq 0 ] && [ -e "$output_path" ] && [ ! -d "$output_path" ]; then
  fail "$EXIT_OPERATIONAL" "output path exists and is not a directory: $output_path"
fi

image="${STRUCTURIZR_IMAGE:-$DEFAULT_IMAGE}"
cli=""
if [ -n "${STRUCTURIZR_CLI:-}" ]; then
  if [ ! -f "$STRUCTURIZR_CLI" ] || [ ! -x "$STRUCTURIZR_CLI" ]; then
    fail "$EXIT_OPERATIONAL" "STRUCTURIZR_CLI is not an executable file: $STRUCTURIZR_CLI"
  fi
  cli="$STRUCTURIZR_CLI"
elif command -v structurizr.sh >/dev/null 2>&1; then
  cli="$(command -v structurizr.sh)"
fi

if [ -n "$cli" ]; then
  require_java
elif ! command -v docker >/dev/null 2>&1; then
  fail "$EXIT_OPERATIONAL" "no Structurizr runner found: set STRUCTURIZR_CLI, put structurizr.sh on PATH, or install Docker"
elif ! docker_reachable; then
  fail "$EXIT_OPERATIONAL" "the Docker daemon is not reachable ('docker info' failed); start Docker or set STRUCTURIZR_CLI"
fi
if [ "$render_svg" -eq 1 ]; then
  select_plantuml_runner
fi

status=0
run_validate || status=$?
case "$status" in
  0) ;;
  125|126|127) fail "$EXIT_OPERATIONAL" "could not start the Structurizr runner (exit $status)" ;;
  *) fail "$EXIT_VALIDATION" "validation failed for $workspace_path (exit $status)" ;;
esac

if [ "$validate_only" -eq 1 ]; then
  printf 'Validated %s\n' "$workspace_path"
  exit 0
fi

if ! mkdir -p -- "$output_path"; then
  fail "$EXIT_OPERATIONAL" "cannot create output directory: $output_path"
fi
output_path="$(cd -P -- "$output_path" >/dev/null && pwd -P)"

status=0
run_export || status=$?
if [ "$status" -ne 0 ]; then
  fail "$EXIT_OPERATIONAL" "export to format '$format' failed (exit $status)"
fi
printf 'Exported %s to %s (format %s)\n' "$workspace_path" "$output_path" "$format"

if [ "$render_svg" -eq 1 ]; then
  render_svgs
fi
