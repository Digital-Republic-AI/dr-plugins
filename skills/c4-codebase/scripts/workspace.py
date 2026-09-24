#!/usr/bin/env python3
"""Manage the .c4-codebase workspace of a target repository.

Bootstraps and repairs the workspace, validates state and ledgers, records
phases, units, checkpoints, evidence, hypotheses, and questions, invalidates
work after repository changes, and checks publication targets.

examples:
  workspace.py status --repo . --json
  workspace.py init --repo . --versioning shared --json
  workspace.py unit add --repo . --id api --path services/api --type service --json
  workspace.py evidence add --repo . --kind source --path services/api/main.py --lines 1-40 --observation "Starts an HTTP server" --unit api --json
"""
import sys

from discovery_lib.constants import EXIT_OPERATIONAL_ERROR, MIN_PYTHON_VERSION

if sys.version_info < MIN_PYTHON_VERSION:
    sys.stderr.write("c4-codebase requires Python %d.%d or newer\n" % MIN_PYTHON_VERSION)
    sys.exit(EXIT_OPERATIONAL_ERROR)

from discovery_lib.workspace_cli import main

if __name__ == "__main__":
    sys.exit(main(description=__doc__))
