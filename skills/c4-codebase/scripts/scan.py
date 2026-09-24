#!/usr/bin/env python3
"""Deterministic repository reconnaissance for C4 Codebase.

Collects broad, verifiable signals (manifests, intent documents, API specifications,
entrypoints, deployment descriptors, workspace definitions, git history) without
making semantic architecture claims. Safe to run before reading any source file.
Environment template values are never read, and scan.json holds no absolute paths.

Examples:
  scan.py --repo . --save
  scan.py --repo . --stdout markdown
  scan.py --repo . --scope services/api --json-output /tmp/scan.json --max-files 50000
"""
import sys

from discovery_lib.constants import EXIT_OPERATIONAL_ERROR, MIN_PYTHON_VERSION

if sys.version_info < MIN_PYTHON_VERSION:
    sys.stderr.write(
        "error: scan.py requires Python {0} or newer; running {1}\n".format(
            ".".join(str(part) for part in MIN_PYTHON_VERSION), sys.version.split()[0]
        )
    )
    sys.exit(EXIT_OPERATIONAL_ERROR)

from discovery_lib.scan_cli import main

if __name__ == "__main__":
    sys.exit(main(__doc__))
