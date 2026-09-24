from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Dict, List, NamedTuple, Optional, Set, Tuple

from .dsl import (
    INSTANCE_TARGET_KIND,
    KIND_PERSON,
    KIND_SOFTWARE_SYSTEM,
    STYLE_ELEMENT,
    STYLE_RELATIONSHIP,
    VIEW_DEPLOYMENT,
    VIEW_DYNAMIC,
    VIEW_SCOPE_KINDS,
    WILDCARD,
    DeploymentNode,
    Model,
    Problem,
    Relationship,
    parse_file,
)

TAG_INFERRED = "Inferred"
TAG_EXTERNAL = "External"
TAG_DATABASE = "Database"
TAG_QUEUE = "Queue"
TAG_RELATIONSHIP_DEFAULT = "Relationship"
BUILTIN_TAGS = {"Element", "Person", "Software System", "Container", "Component", TAG_RELATIONSHIP_DEFAULT}
DEFAULT_KIND_TAGS = {KIND_PERSON: "Person", KIND_SOFTWARE_SYSTEM: "Software System", "container": "Container", "component": "Component"}
CONFIRMED_ELEMENT_STYLE_TAGS = (TAG_EXTERNAL, TAG_INFERRED, TAG_DATABASE, TAG_QUEUE)


class LintReport(NamedTuple):
    path: str
    valid: bool
    errors: List[str]
    warnings: List[str]
    counts: Dict[str, int]


def lint_file(path: Path) -> Tuple[Model, LintReport]:
    model = parse_file(path)
    lint_model(model)
    report = LintReport(
        str(path),
        not model.errors,
        _format(path, model.errors),
        _format(path, model.warnings),
        {
            "elements": len(model.elements),
            "relationships": len(model.relationships),
            "views": len(model.views),
            "styles": len(model.styles),
            "environments": len(model.environments),
        },
    )
    return model, report


def lint_model(model: Model) -> None:
    if model.errors and not model.elements:
        return
    if not model.identifiers_hierarchical:
        model.warn(1, "the skill's template declares '!identifiers hierarchical'; identifiers of nested elements will not be prefixed")
    if not model.elements:
        model.warn(1, "the model declares no elements")
    _check_elements(model)
    _check_relationships(model)
    _check_environments(model)
    _check_views(model)
    _check_styles(model)
    model.errors.sort()
    model.warnings.sort()


def _check_elements(model: Model) -> None:
    for element in model.elements.values():
        if not element.description:
            model.warn(element.line, f"{element.kind} {element.id} has no description")


def _check_relationships(model: Model) -> None:
    seen: Counter = Counter()
    for relationship in model.relationships:
        for endpoint in (relationship.source, relationship.destination):
            if endpoint not in model.elements:
                model.error(relationship.line, f"relationship references an unknown element {endpoint!r}")
        if relationship.source == relationship.destination:
            model.warn(relationship.line, f"relationship from {relationship.source} to itself")
        if not relationship.description:
            model.warn(relationship.line, f"relationship {relationship.source} -> {relationship.destination} has no description")
        key = (relationship.source, relationship.destination, relationship.description)
        seen[key] += 1
        if seen[key] > 1:
            model.error(relationship.line, f"duplicate relationship {relationship.source} -> {relationship.destination} {relationship.description!r}")
    _check_implied_duplicates(model)


def _check_implied_duplicates(model: Model) -> None:
    explicit = [rel for rel in model.relationships if rel.source in model.elements and rel.destination in model.elements]
    for outer in explicit:
        for inner in explicit:
            if inner is outer or (inner.source, inner.destination) == (outer.source, outer.destination):
                continue
            if model.is_within(inner.source, outer.source) and model.is_within(inner.destination, outer.destination) and inner.description == outer.description:
                model.warn(
                    outer.line,
                    f"relationship {outer.source} -> {outer.destination} {outer.description!r} is implied by {inner.source} -> {inner.destination} (line {inner.line}); "
                    "Structurizr draws implied relationships itself, so the explicit one shows twice in exported views",
                )
                break


def _check_environments(model: Model) -> None:
    for environment in model.environments:
        if not environment.nodes:
            model.warn(environment.line, f"deployment environment {environment.id!r} has no nodes")
        for node in environment.nodes:
            _check_node(model, node)


def _check_node(model: Model, node: DeploymentNode) -> None:
    for kind, target, line in node.instances:
        element = model.elements.get(target)
        expected = INSTANCE_TARGET_KIND[kind]
        if element is None:
            model.error(line, f"{kind} references an unknown element {target!r}")
        elif element.kind != expected:
            model.error(line, f"{kind} must reference a {expected}, not the {element.kind} {target}")
    for child in node.children:
        _check_node(model, child)


def _check_views(model: Model) -> None:
    keys: Counter = Counter(view.key for view in model.views if view.key)
    for view in model.views:
        if view.key and keys[view.key] > 1:
            model.error(view.line, f"duplicate view key {view.key!r}")
        _check_view_scope(model, view)
        for target in view.includes + view.excludes:
            if target != WILDCARD and target not in model.elements:
                model.error(view.line, f"view {view.key or view.kind} includes or excludes an unknown element {target!r}")
        if view.kind == VIEW_DYNAMIC:
            _check_dynamic(model, view)
        elif not view.includes:
            model.warn(view.line, f"view {view.key or view.kind} includes nothing; add 'include *' or explicit elements")
        if view.auto_layout is None:
            model.warn(view.line, f"view {view.key or view.kind} has no autoLayout; exporters need explicit positions otherwise")


def _check_view_scope(model: Model, view) -> None:
    expected = VIEW_SCOPE_KINDS.get(view.kind)
    if view.kind == VIEW_DEPLOYMENT:
        if view.scope not in (None, WILDCARD) and _kind(model, view.scope) != KIND_SOFTWARE_SYSTEM:
            model.error(view.line, f"deployment view scope must be a softwareSystem or *, not {view.scope!r}")
        if view.environment is not None and not any(env.id == view.environment or env.name == view.environment for env in model.environments):
            model.error(view.line, f"deployment view references an unknown environment {view.environment!r}")
        return
    if view.kind == VIEW_DYNAMIC:
        if view.scope is not None and view.scope != WILDCARD and _kind(model, view.scope) not in (KIND_SOFTWARE_SYSTEM, "container"):
            model.error(view.line, f"dynamic view scope must be a softwareSystem or a container, not {view.scope!r}")
        return
    if expected and view.scope is not None and _kind(model, view.scope) != expected:
        model.error(view.line, f"{view.kind} view scope must be a {expected}, not {view.scope!r}")


def _check_dynamic(model: Model, view) -> None:
    if not view.steps:
        model.warn(view.line, f"dynamic view {view.key or view.kind} has no steps")
    for step in view.steps:
        for endpoint in (step.source, step.destination):
            if endpoint not in model.elements:
                model.error(step.line, f"dynamic step references an unknown element {endpoint!r}")
        if step.source in model.elements and step.destination in model.elements and not _relationship_exists(model, step):
            model.error(step.line, f"dynamic step {step.source} -> {step.destination} has no matching relationship in the model")


def _relationship_exists(model: Model, step: Relationship) -> bool:
    for relationship in model.relationships:
        if relationship.source == step.source and relationship.destination == step.destination:
            return True
    return False


def _check_styles(model: Model) -> None:
    element_tags: Set[str] = set()
    relationship_tags: Set[str] = set()
    for element in model.elements.values():
        element_tags.update(element.tags)
    for relationship in model.relationships:
        relationship_tags.update(relationship.tags)
    styled_elements = {style.tag for style in model.styles if style.kind == STYLE_ELEMENT}
    styled_relationships = {style.tag for style in model.styles if style.kind == STYLE_RELATIONSHIP}
    for style in model.styles:
        used = element_tags if style.kind == STYLE_ELEMENT else relationship_tags
        if style.tag not in BUILTIN_TAGS and style.tag not in used and style.tag not in CONFIRMED_ELEMENT_STYLE_TAGS:
            model.warn(style.line, f"{style.kind} style for tag {style.tag!r} matches nothing in the model")
    for tag in sorted(element_tags - styled_elements - BUILTIN_TAGS):
        model.warn(1, f"element tag {tag!r} has no style; it renders like an untagged element")
    for tag in sorted(relationship_tags - styled_relationships - BUILTIN_TAGS):
        model.warn(1, f"relationship tag {tag!r} has no style; it renders like an untagged relationship")
    if TAG_INFERRED in relationship_tags and TAG_RELATIONSHIP_DEFAULT not in styled_relationships:
        model.warn(1, "Inferred relationships need the default 'Relationship' style set to solid; otherwise every relationship looks dashed")


def _kind(model: Model, identifier: Optional[str]) -> Optional[str]:
    element = model.elements.get(identifier) if identifier else None
    return element.kind if element else None


def _format(path: Path, problems: List[Problem]) -> List[str]:
    return [f"{path.name}:{problem.line}: {problem.message}" for problem in problems]
