from __future__ import annotations

from typing import Optional

from .constants import EXIT_OPERATIONAL_ERROR


class DiscoveryError(Exception):
    def __init__(self, message: str, exit_code: int = EXIT_OPERATIONAL_ERROR, hint: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.exit_code = exit_code
        self.hint = hint

    def to_dict(self) -> dict:
        return {"error": self.message, "hint": self.hint, "exitCode": self.exit_code}
