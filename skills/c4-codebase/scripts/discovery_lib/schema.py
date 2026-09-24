from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, List, Set

from .errors import DiscoveryError
from .fsutil import read_json
from .skillmeta import skill_root

SCHEMA_DIR_NAME = "schemas"
SCHEMA_SUFFIX = ".schema.json"
ANNOTATION_KEYWORDS = {"$schema", "$id", "$defs", "title", "description"}
VALIDATION_KEYWORDS = {
    "$ref", "type", "enum", "const", "required", "properties", "additionalProperties", "propertyNames",
    "items", "minItems", "pattern", "minLength", "minimum", "allOf", "anyOf", "if", "then",
}
SUPPORTED_KEYWORDS = ANNOTATION_KEYWORDS | VALIDATION_KEYWORDS
SUBSCHEMA_MAP_KEYWORDS = {"$defs", "properties"}
SUBSCHEMA_KEYWORDS = {"additionalProperties", "propertyNames", "items", "if", "then"}
SUBSCHEMA_LIST_KEYWORDS = {"allOf", "anyOf"}

_cache: Dict[str, dict] = {}


def load_schema(name: str) -> dict:
    if name not in _cache:
        path = skill_root() / SCHEMA_DIR_NAME / f"{name}{SCHEMA_SUFFIX}"
        if not path.exists():
            raise DiscoveryError(f"schema not found: {path}")
        _cache[name] = read_json(path)
    return _cache[name]


def schema_path(name: str) -> Path:
    return skill_root() / SCHEMA_DIR_NAME / f"{name}{SCHEMA_SUFFIX}"


def validate(instance: Any, schema: dict) -> List[str]:
    errors: List[str] = []
    _Validator(schema).check(instance, schema, "$", errors)
    return errors


def definition_enum(schema: dict, definition: str) -> List[Any]:
    return list(schema["$defs"][definition]["enum"])


def unsupported_keywords(schema: Any) -> Set[str]:
    found: Set[str] = set()
    if not isinstance(schema, dict):
        return found
    for key, value in schema.items():
        if key not in SUPPORTED_KEYWORDS:
            found.add(key)
        if key in SUBSCHEMA_MAP_KEYWORDS:
            for child in value.values():
                found |= unsupported_keywords(child)
        elif key in SUBSCHEMA_KEYWORDS:
            found |= unsupported_keywords(value)
        elif key in SUBSCHEMA_LIST_KEYWORDS:
            for child in value:
                found |= unsupported_keywords(child)
    return found


def _type_matches(value: Any, expected: str) -> bool:
    if expected == "null":
        return value is None
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "string":
        return isinstance(value, str)
    if expected == "array":
        return isinstance(value, list)
    if expected == "object":
        return isinstance(value, dict)
    raise DiscoveryError(f"unsupported schema type: {expected}")


class _Validator:
    def __init__(self, root: dict):
        self.root = root

    def resolve(self, reference: str) -> dict:
        if not reference.startswith("#/"):
            raise DiscoveryError(f"only local schema references are supported: {reference}")
        node: Any = self.root
        for part in reference[2:].split("/"):
            node = node[part]
        return node

    def check(self, value: Any, schema: Any, path: str, errors: List[str]) -> None:
        if schema is True:
            return
        if schema is False:
            errors.append(f"{path}: is not allowed")
            return
        if "$ref" in schema:
            self.check(value, self.resolve(schema["$ref"]), path, errors)
        if not self._check_type(value, schema, path, errors):
            return
        self._check_literals(value, schema, path, errors)
        if isinstance(value, str):
            self._check_string(value, schema, path, errors)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            self._check_number(value, schema, path, errors)
        if isinstance(value, list):
            self._check_array(value, schema, path, errors)
        if isinstance(value, dict):
            self._check_object(value, schema, path, errors)
        self._check_combinators(value, schema, path, errors)

    def _check_type(self, value: Any, schema: dict, path: str, errors: List[str]) -> bool:
        if "type" not in schema:
            return True
        expected = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if any(_type_matches(value, item) for item in expected):
            return True
        errors.append(f"{path}: {value!r} is not of type {' or '.join(expected)}")
        return False

    def _check_literals(self, value: Any, schema: dict, path: str, errors: List[str]) -> None:
        if "const" in schema and not _same(value, schema["const"]):
            errors.append(f"{path}: expected {schema['const']!r}, found {value!r}")
        if "enum" in schema and not any(_same(value, item) for item in schema["enum"]):
            errors.append(f"{path}: {value!r} is not one of {schema['enum']!r}")

    def _check_string(self, value: str, schema: dict, path: str, errors: List[str]) -> None:
        if "minLength" in schema and len(value) < schema["minLength"]:
            errors.append(f"{path}: shorter than {schema['minLength']} characters")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errors.append(f"{path}: {value!r} does not match {schema['pattern']!r}")

    def _check_number(self, value: float, schema: dict, path: str, errors: List[str]) -> None:
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path}: {value!r} is less than {schema['minimum']!r}")

    def _check_array(self, value: list, schema: dict, path: str, errors: List[str]) -> None:
        if "minItems" in schema and len(value) < schema["minItems"]:
            errors.append(f"{path}: expected at least {schema['minItems']} item(s)")
        if "items" in schema:
            for index, item in enumerate(value):
                self.check(item, schema["items"], f"{path}[{index}]", errors)

    def _check_object(self, value: dict, schema: dict, path: str, errors: List[str]) -> None:
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f"{path}: missing required property {key!r}")
        properties = schema.get("properties", {})
        for key, item in value.items():
            child_path = f"{path}.{key}"
            if "propertyNames" in schema:
                self.check(key, schema["propertyNames"], f"{path} property name {key!r}", errors)
            if key in properties:
                self.check(item, properties[key], child_path, errors)
            elif "additionalProperties" in schema:
                self._check_additional(key, item, schema["additionalProperties"], child_path, path, errors)

    def _check_additional(self, key: str, item: Any, rule: Any, child_path: str, path: str, errors: List[str]) -> None:
        if rule is False:
            errors.append(f"{path}: unexpected property {key!r}")
        elif isinstance(rule, dict):
            self.check(item, rule, child_path, errors)

    def _check_combinators(self, value: Any, schema: dict, path: str, errors: List[str]) -> None:
        for sub in schema.get("allOf", []):
            self.check(value, sub, path, errors)
        if "anyOf" in schema and not any(self._passes(value, sub, path) for sub in schema["anyOf"]):
            errors.append(f"{path}: {value!r} does not match any allowed alternative")
        if "if" in schema and "then" in schema and self._passes(value, schema["if"], path):
            self.check(value, schema["then"], path, errors)

    def _passes(self, value: Any, schema: dict, path: str) -> bool:
        probe: List[str] = []
        self.check(value, schema, path, probe)
        return not probe


def _same(left: Any, right: Any) -> bool:
    if isinstance(left, bool) or isinstance(right, bool):
        return type(left) is type(right) and left == right
    return left == right
