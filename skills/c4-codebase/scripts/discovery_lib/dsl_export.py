from __future__ import annotations

import html
import re
from typing import Dict, List, NamedTuple, Optional, Set, Tuple

from .dsl import (
    KIND_COMPONENT,
    KIND_CONTAINER,
    KIND_PERSON,
    KIND_SOFTWARE_SYSTEM,
    VIEW_COMPONENT,
    VIEW_CONTAINER,
    VIEW_CONTEXT,
    VIEW_DEPLOYMENT,
    VIEW_DYNAMIC,
    VIEW_LANDSCAPE,
    WILDCARD,
    DeploymentNode,
    Element,
    Model,
    Relationship,
    View,
)
from .dsl_lint import TAG_DATABASE, TAG_EXTERNAL, TAG_INFERRED, TAG_QUEUE

FORMAT_DOT = "dot"
FORMAT_MERMAID = "mermaid"
FORMATS = (FORMAT_DOT, FORMAT_MERMAID)
FILE_PREFIX = "structurizr-"
FILE_SUFFIX = {FORMAT_DOT: ".dot", FORMAT_MERMAID: ".mmd"}
INFERRED_LABEL = "[inferred]"
DYNAMIC_STEP_SEPARATOR = ". "
NODE_FILL = {KIND_PERSON: "#08427b", KIND_SOFTWARE_SYSTEM: "#1168bd", KIND_CONTAINER: "#438dd5", KIND_COMPONENT: "#85bbf0"}
NODE_FONT = {KIND_PERSON: "#ffffff", KIND_SOFTWARE_SYSTEM: "#ffffff", KIND_CONTAINER: "#ffffff", KIND_COMPONENT: "#000000"}
EXTERNAL_FILL = "#999999"
EXTERNAL_FONT = "#ffffff"
EDGE_COLOR = "#707070"
BOUNDARY_COLOR = "#444444"
NODE_SHAPE = {TAG_DATABASE: "cylinder", TAG_QUEUE: "cds"}
DEFAULT_SHAPE = "box"
PERSON_SHAPE = "box"
RANKDIR = {"lr": "LR", "rl": "RL", "tb": "TB", "bt": "BT"}
DEFAULT_RANKDIR = "TB"
DOT_FONT = "Helvetica"
DOT_NEWLINE = "\\n"
TITLE_POINT_SIZE = 12
LABEL_POINT_SIZE = 9
MERMAID_TYPE = {VIEW_LANDSCAPE: "C4Context", VIEW_CONTEXT: "C4Context", VIEW_CONTAINER: "C4Container", VIEW_COMPONENT: "C4Component", VIEW_DYNAMIC: "C4Dynamic", VIEW_DEPLOYMENT: "C4Deployment"}
MERMAID_ID_CLEANER = re.compile(r"[^A-Za-z0-9_]")
KIND_LABEL = {KIND_PERSON: "Person", KIND_SOFTWARE_SYSTEM: "Software System", KIND_CONTAINER: "Container", KIND_COMPONENT: "Component"}
MERMAID_SHAPES_IN_ROW = 3
MERMAID_BOUNDARIES_IN_ROW = 1
MERMAID_LABEL_OFFSETS = ((0, -10), (0, 10), (-40, -10), (40, 10))
MERMAID_INFERRED_BORDER = "#999999"


class Diagram(NamedTuple):
    key: str
    file_name: str
    content: str


class Graph(NamedTuple):
    elements: List[str]
    boundaries: List[Tuple[str, List[str]]]
    edges: List[Relationship]


def export_views(model: Model, fmt: str) -> List[Diagram]:
    diagrams: List[Diagram] = []
    for index, view in enumerate(model.views, start=1):
        key = view.key or f"{view.kind}{index}"
        if view.kind == VIEW_DEPLOYMENT:
            content = _deployment(model, view, fmt)
        else:
            content = _static(model, view, fmt)
        diagrams.append(Diagram(key, f"{FILE_PREFIX}{key}{FILE_SUFFIX[fmt]}", content))
    return diagrams


def view_graph(model: Model, view: View) -> Graph:
    if view.kind == VIEW_DYNAMIC:
        elements = _ordered_unique([endpoint for step in view.steps for endpoint in (step.source, step.destination) if endpoint in model.elements])
        return Graph(elements, _boundaries(model, view, elements), list(view.steps))
    level, inside = _level(model, view)
    candidates = _candidates(model, view, level, inside)
    edges = _lift(model, model.relationships, candidates)
    if view.kind in (VIEW_CONTEXT, VIEW_CONTAINER, VIEW_COMPONENT) and WILDCARD in view.includes:
        core = {view.scope} | set(inside)
        connected = set(core)
        for edge in edges:
            if edge.source in core or edge.destination in core:
                connected.update((edge.source, edge.destination))
        elements = [identifier for identifier in candidates if identifier in connected]
        edges = [edge for edge in edges if edge.source in connected and edge.destination in connected]
    else:
        elements = candidates
    explicit = [target for target in view.includes if target != WILDCARD and target in model.elements]
    for target in explicit:
        if target not in elements:
            elements.append(target)
    elements = [identifier for identifier in elements if identifier not in view.excludes]
    edges = [edge for edge in edges if edge.source in elements and edge.destination in elements]
    return Graph(elements, _boundaries(model, view, elements), edges)


def _level(model: Model, view: View) -> Tuple[str, List[str]]:
    if view.kind == VIEW_CONTAINER and view.scope in model.elements:
        return KIND_CONTAINER, list(model.elements[view.scope].children)
    if view.kind == VIEW_COMPONENT and view.scope in model.elements:
        return KIND_COMPONENT, list(model.elements[view.scope].children)
    return KIND_SOFTWARE_SYSTEM, []


def _candidates(model: Model, view: View, level: str, inside: List[str]) -> List[str]:
    top = [identifier for identifier, element in model.elements.items() if element.parent is None]
    if level == KIND_SOFTWARE_SYSTEM:
        return top
    scope = model.elements[view.scope]
    candidates = list(inside)
    if level == KIND_COMPONENT and scope.parent:
        candidates.extend(child for child in model.elements[scope.parent].children if child != view.scope)
        outside_root = scope.parent
    else:
        outside_root = view.scope
    candidates.extend(identifier for identifier in top if identifier != outside_root)
    return candidates


def _lift(model: Model, relationships: List[Relationship], displayed: List[str]) -> List[Relationship]:
    shown = set(displayed)
    lifted: List[Relationship] = []
    seen: Set[Tuple[str, str, str]] = set()
    for relationship in relationships:
        source = _nearest(model, relationship.source, shown)
        destination = _nearest(model, relationship.destination, shown)
        if source is None or destination is None or source == destination:
            continue
        key = (source, destination, relationship.description)
        if key in seen:
            continue
        seen.add(key)
        lifted.append(relationship._replace(source=source, destination=destination))
    return lifted


def _nearest(model: Model, identifier: str, shown: Set[str]) -> Optional[str]:
    if identifier not in model.elements:
        return None
    for candidate in [identifier] + model.ancestors(identifier):
        if candidate in shown:
            return candidate
    return None


def _boundaries(model: Model, view: View, elements: List[str]) -> List[Tuple[str, List[str]]]:
    if view.kind in (VIEW_CONTEXT, VIEW_LANDSCAPE) or view.scope not in model.elements:
        return []
    members = [identifier for identifier in elements if model.elements[identifier].parent == view.scope]
    return [(view.scope, members)] if members else []


def _ordered_unique(items: List[str]) -> List[str]:
    return list(dict.fromkeys(items))


def _static(model: Model, view: View, fmt: str) -> str:
    graph = view_graph(model, view)
    if fmt == FORMAT_DOT:
        return _dot(model, view, graph)
    return _mermaid(model, view, graph)


def _dot(model: Model, view: View, graph: Graph) -> str:
    lines = [f'digraph "{_dot_escape(view.key or view.kind)}" {{']
    lines.append(f'  rankdir={RANKDIR.get((view.auto_layout or "").lower(), DEFAULT_RANKDIR)}')
    lines.append(f'  graph [fontname="{DOT_FONT}", fontsize={TITLE_POINT_SIZE}, labelloc=t, label="{_dot_escape(_title(model, view))}", pad=0.4, nodesep=0.6, ranksep=0.9]')
    lines.append(f'  node [fontname="{DOT_FONT}", fontsize={LABEL_POINT_SIZE + 1}, style="filled,rounded", shape={DEFAULT_SHAPE}, margin="0.25,0.15"]')
    lines.append(f'  edge [fontname="{DOT_FONT}", fontsize={LABEL_POINT_SIZE}, color="{EDGE_COLOR}", fontcolor="{EDGE_COLOR}"]')
    grouped = {member for _, members in graph.boundaries for member in members}
    for parent, members in graph.boundaries:
        title = _dot_escape(_boundary_title(model, parent))
        lines.append(f'  subgraph "cluster_{_dot_escape(parent)}" {{')
        lines.append(f'    label="{title}"')
        lines.append(f'    color="{BOUNDARY_COLOR}"')
        lines.append("    style=dashed")
        for identifier in members:
            lines.append("    " + _dot_node(model, identifier))
        lines.append("  }")
    for identifier in graph.elements:
        if identifier not in grouped:
            lines.append("  " + _dot_node(model, identifier))
    for index, edge in enumerate(graph.edges, start=1):
        lines.append("  " + _dot_edge(edge, index if view.kind == VIEW_DYNAMIC else None))
    lines.append("}")
    return "\n".join(lines) + "\n"


def _dot_node(model: Model, identifier: str) -> str:
    element = model.elements[identifier]
    external = TAG_EXTERNAL in element.tags
    fill = EXTERNAL_FILL if external else NODE_FILL[element.kind]
    font = EXTERNAL_FONT if external else NODE_FONT[element.kind]
    shape = next((NODE_SHAPE[tag] for tag in element.tags if tag in NODE_SHAPE), PERSON_SHAPE if element.kind == KIND_PERSON else DEFAULT_SHAPE)
    style = "filled,rounded,dashed" if TAG_INFERRED in element.tags else "filled,rounded"
    if shape != DEFAULT_SHAPE:
        style = style.replace(",rounded", "")
    kind = KIND_LABEL[element.kind] + (f": {element.technology}" if element.technology else "")
    label = f'<<b>{html.escape(element.name)}</b><br/><font point-size="{LABEL_POINT_SIZE}">[{html.escape(kind)}]</font>'
    if element.description:
        label += f'<br/><br/><font point-size="{LABEL_POINT_SIZE}">{html.escape(element.description)}</font>'
    label += ">"
    return f'"{_dot_escape(identifier)}" [label={label}, fillcolor="{fill}", fontcolor="{font}", color="{fill}", shape={shape}, style="{style}"]'


def _dot_edge(edge: Relationship, index: Optional[int]) -> str:
    text = _dot_escape(edge.description)
    if index is not None:
        text = f"{index}{DYNAMIC_STEP_SEPARATOR}{text}"
    if edge.technology:
        text += DOT_NEWLINE + _dot_escape(f"[{edge.technology}]")
    style = "dashed" if TAG_INFERRED in edge.tags else "solid"
    return f'"{_dot_escape(edge.source)}" -> "{_dot_escape(edge.destination)}" [label="{text}", style={style}]'


def _dot_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace('"', '\\"')


def _mermaid(model: Model, view: View, graph: Graph) -> str:
    lines = [MERMAID_TYPE[view.kind], f"    title {_mermaid_title(_title(model, view))}"]
    grouped = {member for _, members in graph.boundaries for member in members}
    for parent, members in graph.boundaries:
        boundary = "Container_Boundary" if model.elements[parent].kind == KIND_CONTAINER else "System_Boundary"
        lines.append(f"    {boundary}({_mermaid_id(parent)}, {_mermaid_quote(model.elements[parent].name)}) {{")
        for identifier in members:
            lines.append("        " + _mermaid_element(model, identifier))
        lines.append("    }")
    for identifier in graph.elements:
        if identifier not in grouped:
            lines.append("    " + _mermaid_element(model, identifier))
    for index, edge in enumerate(graph.edges, start=1):
        lines.append("    " + _mermaid_relationship(edge, index if view.kind == VIEW_DYNAMIC else None))
    lines.extend(_mermaid_layout(model, graph))
    return "\n".join(lines) + "\n"


def _mermaid_layout(model: Model, graph: Graph) -> List[str]:
    lines: List[str] = []
    for identifier in graph.elements:
        if TAG_INFERRED in model.elements[identifier].tags:
            lines.append(f'    UpdateElementStyle({_mermaid_id(identifier)}, $borderColor="{MERMAID_INFERRED_BORDER}")')
    for position, edge in enumerate(graph.edges):
        offset_x, offset_y = MERMAID_LABEL_OFFSETS[position % len(MERMAID_LABEL_OFFSETS)]
        lines.append(f'    UpdateRelStyle({_mermaid_id(edge.source)}, {_mermaid_id(edge.destination)}, $offsetX="{offset_x}", $offsetY="{offset_y}")')
    lines.append(f'    UpdateLayoutConfig($c4ShapeInRow="{MERMAID_SHAPES_IN_ROW}", $c4BoundaryInRow="{MERMAID_BOUNDARIES_IN_ROW}")')
    return lines


def _mermaid_title(text: str) -> str:
    return text.replace("\n", " ").strip()


def _mermaid_element(model: Model, identifier: str) -> str:
    element = model.elements[identifier]
    base = {KIND_PERSON: "Person", KIND_SOFTWARE_SYSTEM: "System", KIND_CONTAINER: "Container", KIND_COMPONENT: "Component"}[element.kind]
    if element.kind != KIND_PERSON:
        if TAG_DATABASE in element.tags:
            base += "Db"
        elif TAG_QUEUE in element.tags:
            base += "Queue"
    if TAG_EXTERNAL in element.tags:
        base += "_Ext"
    description = element.description
    if TAG_INFERRED in element.tags:
        description = f"{description} {INFERRED_LABEL}".strip()
    values = [_mermaid_id(identifier), _mermaid_quote(element.name)]
    if element.kind in (KIND_CONTAINER, KIND_COMPONENT):
        values.append(_mermaid_quote(element.technology))
    values.append(_mermaid_quote(description))
    return f"{base}({', '.join(values)})"


def _mermaid_relationship(edge: Relationship, index: Optional[int]) -> str:
    label = edge.description
    if TAG_INFERRED in edge.tags:
        label = f"{label} {INFERRED_LABEL}".strip()
    values = [_mermaid_id(edge.source), _mermaid_id(edge.destination), _mermaid_quote(label)]
    if edge.technology:
        values.append(_mermaid_quote(edge.technology))
    if index is not None:
        return f"RelIndex({index}, {', '.join(values)})"
    return f"Rel({', '.join(values)})"


def _mermaid_id(identifier: str) -> str:
    return MERMAID_ID_CLEANER.sub("_", identifier)


def _mermaid_quote(text: str) -> str:
    return '"' + text.replace('"', "'").replace("\n", " ") + '"'


def _deployment(model: Model, view: View, fmt: str) -> str:
    environment = next((env for env in model.environments if env.id == view.environment or env.name == view.environment), None)
    nodes = environment.nodes if environment else []
    if fmt == FORMAT_DOT:
        lines = [f'digraph "{_dot_escape(view.key or view.kind)}" {{', f'  rankdir={RANKDIR.get((view.auto_layout or "").lower(), DEFAULT_RANKDIR)}']
        lines.append(f'  graph [fontname="{DOT_FONT}", fontsize={TITLE_POINT_SIZE}, labelloc=t, label="{_dot_escape(_title(model, view))}", pad=0.4]')
        lines.append(f'  node [fontname="{DOT_FONT}", fontsize={LABEL_POINT_SIZE + 1}, style="filled,rounded", shape={DEFAULT_SHAPE}]')
        for position, node in enumerate(nodes):
            lines.extend(_dot_deployment_node(model, view, node, f"n{position}", 1))
        lines.append("}")
        return "\n".join(lines) + "\n"
    lines = [MERMAID_TYPE[VIEW_DEPLOYMENT], f"    title {_mermaid_title(_title(model, view))}"]
    for position, node in enumerate(nodes):
        lines.extend(_mermaid_deployment_node(model, view, node, f"n{position}", 1))
    lines.append(f'    UpdateLayoutConfig($c4ShapeInRow="{MERMAID_SHAPES_IN_ROW}", $c4BoundaryInRow="{MERMAID_BOUNDARIES_IN_ROW}")')
    return "\n".join(lines) + "\n"


def _dot_deployment_node(model: Model, view: View, node: DeploymentNode, path: str, depth: int) -> List[str]:
    indent = "  " * depth
    title = node.name + (f" [{node.technology}]" if node.technology else "")
    lines = [f'{indent}subgraph "cluster_{path}" {{', f'{indent}  label="{_dot_escape(title)}"', f'{indent}  color="{BOUNDARY_COLOR}"']
    for position, (kind, target, _) in enumerate(node.instances):
        if target in model.elements and _in_deployment_scope(model, view, target):
            lines.append(f"{indent}  " + _dot_node(model, target).replace(f'"{_dot_escape(target)}" [', f'"{_dot_escape(target)}@{path}i{position}" [', 1))
    if not node.instances and not node.children:
        lines.append(f'{indent}  "{path}" [label="{_dot_escape(node.name)}", shape=plaintext, style=""]')
    for position, child in enumerate(node.children):
        lines.extend(_dot_deployment_node(model, view, child, f"{path}c{position}", depth + 1))
    lines.append(f"{indent}}}")
    return lines


def _mermaid_deployment_node(model: Model, view: View, node: DeploymentNode, path: str, depth: int) -> List[str]:
    indent = "    " * depth
    lines = [f"{indent}Deployment_Node({path}, {_mermaid_quote(node.name)}, {_mermaid_quote(node.technology)}, {_mermaid_quote(node.description)}) {{"]
    for position, (kind, target, _) in enumerate(node.instances):
        if target in model.elements and _in_deployment_scope(model, view, target):
            lines.append(f"{indent}    " + _mermaid_element(model, target).replace(f"({_mermaid_id(target)},", f"({_mermaid_id(target)}_{path}i{position},", 1))
    for position, child in enumerate(node.children):
        lines.extend(_mermaid_deployment_node(model, view, child, f"{path}c{position}", depth + 1))
    lines.append(f"{indent}}}")
    return lines


def _in_deployment_scope(model: Model, view: View, target: str) -> bool:
    return view.scope in (None, WILDCARD) or model.is_within(target, view.scope)


def _boundary_title(model: Model, identifier: str) -> str:
    element = model.elements[identifier]
    return f"{element.name} [{KIND_LABEL[element.kind]}]"


def _title(model: Model, view: View) -> str:
    if view.title:
        return view.title
    scope = model.elements.get(view.scope) if view.scope else None
    subject = scope.name if scope else model.name
    return f"{subject} - {view.kind}"
