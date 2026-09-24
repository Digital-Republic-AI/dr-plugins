#!/usr/bin/env python3
"""Build a single HTML page with the rendered C4 diagrams embedded inline.

Takes the .svg files written by export-diagrams.sh --svg and a JSON manifest
with the title, the introduction, and a title plus description per diagram,
and fills templates/report.html. Legends (*-key.svg) are attached to their
diagram automatically. The output carries the c4-codebase:generated marker and
an existing file without it is never overwritten.

Examples:
  render-report.py --diagrams docs/architecture/diagrams --manifest .c4-codebase/report.json
  render-report.py --diagrams docs/architecture/diagrams --manifest .c4-codebase/report.json --output docs/architecture/diagrams/index.html --json
"""
import sys

from discovery_lib.constants import EXIT_OPERATIONAL_ERROR, MIN_PYTHON_VERSION

if sys.version_info < MIN_PYTHON_VERSION:
    sys.stderr.write("c4-codebase requires Python %d.%d or newer\n" % MIN_PYTHON_VERSION)
    sys.exit(EXIT_OPERATIONAL_ERROR)

from discovery_lib.report import main

if __name__ == "__main__":
    sys.exit(main(description=__doc__))
