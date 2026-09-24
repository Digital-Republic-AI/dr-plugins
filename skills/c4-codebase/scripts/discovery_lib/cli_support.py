from __future__ import annotations

import argparse
import sys
from typing import Any, Callable

from .constants import EXIT_OPERATIONAL_ERROR
from .errors import DiscoveryError
from .fsutil import to_json
from .skillmeta import skill_version

EXIT_CODE_EPILOG = (
    "exit codes: 0 success; 1 unexpected internal error; 2 invalid usage; "
    "3 workspace, state, or ledger unhealthy; 4 publication blocked by foreign content; "
    "5 operational error (filesystem, permissions, missing skill files)"
)


def build_parser(prog: str, description: str) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog=prog,
        description=description,
        epilog=EXIT_CODE_EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {_version_label()}")
    return parser


def _version_label() -> str:
    try:
        return skill_version()
    except DiscoveryError as exc:
        return f"unknown ({exc.message})"


def emit_json(data: Any) -> None:
    sys.stdout.write(to_json(data))


def run_cli(handler: Callable[[], int], json_requested: bool) -> int:
    try:
        return handler()
    except DiscoveryError as exc:
        if json_requested:
            emit_json(exc.to_dict())
        sys.stderr.write(f"error: {exc.message}\n")
        if exc.hint:
            sys.stderr.write(f"hint: {exc.hint}\n")
        return exc.exit_code
    except OSError as exc:
        error = DiscoveryError(f"{exc.filename or 'filesystem'}: {exc.strerror or exc}", EXIT_OPERATIONAL_ERROR)
        return run_cli(_raiser(error), json_requested)


def _raiser(error: DiscoveryError) -> Callable[[], int]:
    def raise_error() -> int:
        raise error
    return raise_error


def json_flag_present(argv: list) -> bool:
    return "--json" in argv
