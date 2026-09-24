#!/usr/bin/env python3
"""Offline lint and fallback exporters for the skill's Structurizr DSL subset.

lint checks a workspace.dsl without the Structurizr CLI: syntax shape, identifiers,
relationships, views, dynamic steps, deployment instances, tags and styles. It is a
first barrier, not a replacement for the CLI.

export writes one file per view in DOT (Graphviz) or Mermaid C4 syntax next to the
other diagram files; --render turns the DOT files into SVG with the dot binary.

Examples:
  dsl.py lint --workspace .c4-codebase/model/workspace.dsl --json
  dsl.py export --workspace docs/architecture/workspace.dsl --format mermaid
  dsl.py export --workspace docs/architecture/workspace.dsl --format dot --render
"""
import sys

from discovery_lib.constants import EXIT_OPERATIONAL_ERROR, MIN_PYTHON_VERSION

if sys.version_info < MIN_PYTHON_VERSION:
    sys.stderr.write("c4-codebase requires Python %d.%d or newer\n" % MIN_PYTHON_VERSION)
    sys.exit(EXIT_OPERATIONAL_ERROR)

from discovery_lib.dsl_cli import main

if __name__ == "__main__":
    sys.exit(main(description=__doc__))
