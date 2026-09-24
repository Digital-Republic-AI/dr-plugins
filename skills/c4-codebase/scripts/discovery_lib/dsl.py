from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, List, NamedTuple, Optional, Tuple

from .fsutil import read_text

KIND_PERSON = "person"
KIND_SOFTWARE_SYSTEM = "softwareSystem"
KIND_CONTAINER = "container"
KIND_COMPONENT = "component"
KIND_DEPLOYMENT_NODE = "deploymentNode"
KIND_INFRASTRUCTURE_NODE = "infrastructureNode"
KIND_CONTAINER_INSTANCE = "containerInstance"
KIND_SYSTEM_INSTANCE = "softwareSystemInstance"
ELEMENT_KINDS = (KIND_PERSON, KIND_SOFTWARE_SYSTEM, KIND_CONTAINER, KIND_COMPONENT)
CHILD_KINDS = {KIND_SOFTWARE_SYSTEM: KIND_CONTAINER, KIND_CONTAINER: KIND_COMPONENT}
DEPLOYMENT_KINDS = (KIND_DEPLOYMENT_NODE, KIND_INFRASTRUCTURE_NODE, KIND_CONTAINER_INSTANCE, KIND_SYSTEM_INSTANCE)
INSTANCE_TARGET_KIND = {KIND_CONTAINER_INSTANCE: KIND_CONTAINER, KIND_SYSTEM_INSTANCE: KIND_SOFTWARE_SYSTEM}

VIEW_LANDSCAPE = "systemLandscape"
VIEW_CONTEXT = "systemContext"
VIEW_CONTAINER = "container"
VIEW_COMPONENT = "component"
VIEW_DEPLOYMENT = "deployment"
VIEW_DYNAMIC = "dynamic"
VIEW_KINDS = (VIEW_LANDSCAPE, VIEW_CONTEXT, VIEW_CONTAINER, VIEW_COMPONENT, VIEW_DEPLOYMENT, VIEW_DYNAMIC)
VIEW_SCOPE_KINDS = {VIEW_CONTEXT: KIND_SOFTWARE_SYSTEM, VIEW_CONTAINER: KIND_SOFTWARE_SYSTEM, VIEW_COMPONENT: KIND_CONTAINER}
STYLE_ELEMENT = "element"
STYLE_RELATIONSHIP = "relationship"

ELEMENT_PROPERTY_KEYWORDS = ("description", "technology", "tags", "url")
ELEMENT_SKIPPED_BLOCKS = ("properties", "perspectives")
VIEW_PROPERTY_KEYWORDS = ("title", "description", "autoLayout", "animation", "default")
VIEWS_SKIPPED_BLOCKS = ("themes", "theme", "branding", "terminology", "properties")
WORKSPACE_SKIPPED_BLOCKS = ("configuration", "properties")
DIRECTIVE_IDENTIFIERS = "!identifiers"
IDENTIFIERS_HIERARCHICAL = "hierarchical"
WILDCARD = "*"
ARROW = "->"
ASSIGN = "="
OPEN = "{"
CLOSE = "}"
TAG_SEPARATOR = ","
DOT = "."
ANY_SCOPE = "*"

LINE_COMMENT = re.compile(r"(?:^|\s)(//|#).*$")
BLOCK_COMMENT_OPEN = "/*"
BLOCK_COMMENT_CLOSE = "*/"
TOKEN = re.compile(r'"((?:[^"\\]|\\.)*)"|(\S+)')
IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$")


class Problem(NamedTuple):
    line: int
    message: str


class Token(NamedTuple):
    text: str
    quoted: bool


class Element:
    def __init__(self, identifier: str, kind: str, name: str, description: str, technology: str, tags: List[str], parent: Optional[str], line: int):
        self.id = identifier
        self.kind = kind
        self.name = name
        self.description = description
        self.technology = technology
        self.tags = tags
        self.parent = parent
        self.line = line
        self.children: List[str] = []


class Relationship(NamedTuple):
    source: str
    destination: str
    description: str
    technology: str
    tags: List[str]
    line: int


class DeploymentNode:
    def __init__(self, identifier: Optional[str], kind: str, name: str, description: str, technology: str, tags: List[str], line: int):
        self.id = identifier
        self.kind = kind
        self.name = name
        self.description = description
        self.technology = technology
        self.tags = tags
        self.line = line
        self.children: List["DeploymentNode"] = []
        self.instances: List[Tuple[str, str, int]] = []


class Environment(NamedTuple):
    id: str
    name: str
    nodes: List[DeploymentNode]
    line: int


class View:
    def __init__(self, kind: str, key: str, scope: Optional[str], environment: Optional[str], title: str, line: int):
        self.kind = kind
        self.key = key
        self.scope = scope
        self.environment = environment
        self.title = title
        self.line = line
        self.includes: List[str] = []
        self.excludes: List[str] = []
        self.steps: List[Relationship] = []
        self.auto_layout: Optional[str] = None


class Style(NamedTuple):
    kind: str
    tag: str
    properties: Dict[str, str]
    line: int


class Model:
    def __init__(self) -> None:
        self.name = ""
        self.description = ""
        self.identifiers_hierarchical = False
        self.elements: "Dict[str, Element]" = {}
        self.relationships: List[Relationship] = []
        self.environments: List[Environment] = []
        self.views: List[View] = []
        self.styles: List[Style] = []
        self.errors: List[Problem] = []
        self.warnings: List[Problem] = []

    def error(self, line: int, message: str) -> None:
        self.errors.append(Problem(line, message))

    def warn(self, line: int, message: str) -> None:
        self.warnings.append(Problem(line, message))

    def ancestors(self, identifier: str) -> List[str]:
        chain: List[str] = []
        current = self.elements.get(identifier)
        while current is not None and current.parent is not None:
            chain.append(current.parent)
            current = self.elements.get(current.parent)
        return chain

    def top_level(self, identifier: str) -> str:
        chain = self.ancestors(identifier)
        return chain[-1] if chain else identifier

    def descendants(self, identifier: str) -> List[str]:
        found: List[str] = []
        pending = list(self.elements[identifier].children) if identifier in self.elements else []
        while pending:
            child = pending.pop(0)
            found.append(child)
            pending.extend(self.elements[child].children)
        return found

    def is_within(self, identifier: str, ancestor: str) -> bool:
        return identifier == ancestor or ancestor in self.ancestors(identifier)


def parse_file(path: Path) -> Model:
    return parse_text(read_text(path))


def parse_text(text: str) -> Model:
    model = Model()
    lines = _logical_lines(text, model)
    parser = _Parser(model, lines)
    parser.parse()
    return model


def _logical_lines(text: str, model: Model) -> List[Tuple[int, List[Token]]]:
    lines: List[Tuple[int, List[Token]]] = []
    in_block_comment = False
    for number, raw in enumerate(text.splitlines(), start=1):
        line = raw
        if in_block_comment:
            end = line.find(BLOCK_COMMENT_CLOSE)
            if end < 0:
                continue
            line = line[end + len(BLOCK_COMMENT_CLOSE):]
            in_block_comment = False
        start = line.find(BLOCK_COMMENT_OPEN)
        if start >= 0:
            end = line.find(BLOCK_COMMENT_CLOSE, start)
            if end >= 0:
                line = line[:start] + line[end + len(BLOCK_COMMENT_CLOSE):]
            else:
                line = line[:start]
                in_block_comment = True
        line = _strip_line_comment(line)
        tokens = _tokens(line, number, model)
        if tokens:
            lines.append((number, tokens))
    if in_block_comment:
        model.error(len(text.splitlines()), "unterminated block comment")
    return lines


def _strip_line_comment(line: str) -> str:
    result: List[str] = []
    quoted = False
    index = 0
    while index < len(line):
        char = line[index]
        if char == '"':
            quoted = not quoted
        elif not quoted and (line.startswith("//", index) or (char == "#" and (index == 0 or line[index - 1].isspace()))):
            break
        result.append(char)
        index += 1
    return "".join(result)


def _tokens(line: str, number: int, model: Model) -> List[Token]:
    if line.count('"') % 2 == 1:
        model.error(number, "unbalanced double quote")
        return []
    tokens: List[Token] = []
    for match in TOKEN.finditer(line):
        if match.group(1) is not None:
            tokens.append(Token(match.group(1).replace('\\"', '"'), True))
        else:
            tokens.extend(_split_braces(match.group(2)))
    return tokens


def _split_braces(text: str) -> List[Token]:
    if text in (OPEN, CLOSE):
        return [Token(text, False)]
    tokens: List[Token] = []
    remainder = text
    while remainder.endswith(OPEN) or remainder.endswith(CLOSE):
        tokens.insert(0, Token(remainder[-1], False))
        remainder = remainder[:-1]
    if remainder:
        tokens.insert(0, Token(remainder, False))
    return tokens


class _Parser:
    def __init__(self, model: Model, lines: List[Tuple[int, List[Token]]]):
        self.model = model
        self.lines = lines
        self.position = 0

    def parse(self) -> None:
        if not self.lines:
            self.model.error(1, "empty workspace file")
            return
        number, tokens = self.lines[0]
        if tokens[0].text != "workspace":
            self.model.error(number, "the file must start with a workspace block")
            return
        if not self._opens_block(number, tokens):
            return
        names = [token.text for token in tokens[1:-1]]
        self.model.name = names[0] if names else ""
        self.model.description = names[1] if len(names) > 1 else ""
        self.position = 1
        self._workspace_body()
        if self.position < len(self.lines):
            number, _ = self.lines[self.position]
            self.model.error(number, "content after the closing brace of the workspace")

    def _opens_block(self, number: int, tokens: List[Token]) -> bool:
        if tokens[-1].text != OPEN or tokens[-1].quoted:
            self.model.error(number, "a block must end its line with an opening brace")
            return False
        if any(token.text == CLOSE and not token.quoted for token in tokens):
            self.model.error(number, "single-line blocks are not allowed; put the closing brace on its own line")
            return False
        return True

    def _next(self) -> Optional[Tuple[int, List[Token]]]:
        if self.position >= len(self.lines):
            return None
        item = self.lines[self.position]
        self.position += 1
        return item

    def _is_close(self, tokens: List[Token]) -> bool:
        return len(tokens) == 1 and tokens[0].text == CLOSE and not tokens[0].quoted

    def _check_statement(self, number: int, tokens: List[Token]) -> bool:
        raw = [token for token in tokens if not token.quoted]
        if any(token.text == CLOSE for token in raw) and not self._is_close(tokens):
            self.model.error(number, "single-line blocks are not allowed; a closing brace must stand alone on its line")
            return False
        if any(";" in token.text for token in raw):
            self.model.error(number, "statement separators (;) are not allowed; one statement per line")
            return False
        return True

    def _skip_block(self) -> None:
        depth = 1
        while depth > 0:
            item = self._next()
            if item is None:
                return
            _, tokens = item
            if self._is_close(tokens):
                depth -= 1
            elif tokens[-1].text == OPEN and not tokens[-1].quoted:
                depth += 1

    def _block(self, handler) -> None:
        while True:
            item = self._next()
            if item is None:
                last = self.lines[-1][0] if self.lines else 1
                self.model.error(last, "missing closing brace")
                return
            number, tokens = item
            if self._is_close(tokens):
                return
            if not self._check_statement(number, tokens):
                if tokens[-1].text == OPEN and not tokens[-1].quoted:
                    self._skip_block()
                continue
            handler(number, tokens)

    def _workspace_body(self) -> None:
        def handler(number: int, tokens: List[Token]) -> None:
            keyword = tokens[0].text
            opens = tokens[-1].text == OPEN and not tokens[-1].quoted
            if keyword == DIRECTIVE_IDENTIFIERS:
                self.model.identifiers_hierarchical = len(tokens) > 1 and tokens[1].text == IDENTIFIERS_HIERARCHICAL
            elif keyword.startswith("!"):
                self.model.warn(number, f"directive {keyword} is not covered by the offline lint")
                if opens:
                    self._skip_block()
            elif keyword == "model" and opens and self._opens_block(number, tokens):
                self._model_body(None)
            elif keyword == "views" and opens and self._opens_block(number, tokens):
                self._views_body()
            elif keyword in WORKSPACE_SKIPPED_BLOCKS and opens:
                self._skip_block()
            elif keyword in ("name", "description") and len(tokens) > 1:
                setattr(self.model, keyword, tokens[1].text)
            else:
                self.model.warn(number, f"'{keyword}' at workspace level is not covered by the offline lint")
                if opens:
                    self._skip_block()
        self._block(handler)

    def _model_body(self, parent: Optional[str]) -> None:
        def handler(number: int, tokens: List[Token]) -> None:
            opens = tokens[-1].text == OPEN and not tokens[-1].quoted
            if _arrow_index(tokens) is not None:
                self._relationship(number, tokens, parent, self.model.relationships)
                if opens:
                    self._skip_block()
                return
            if len(tokens) > 2 and tokens[1].text == ASSIGN and not tokens[1].quoted:
                identifier, keyword, rest = tokens[0].text, tokens[2].text, tokens[3:]
            else:
                identifier, keyword, rest = None, tokens[0].text, tokens[1:]
            if keyword in ELEMENT_KINDS:
                self._element(number, identifier, keyword, rest, parent, opens)
            elif keyword == "deploymentEnvironment":
                self._environment(number, identifier, rest, opens)
            elif keyword in ELEMENT_PROPERTY_KEYWORDS and parent is not None and identifier is None:
                self._element_property(number, parent, keyword, rest)
            elif keyword in ELEMENT_SKIPPED_BLOCKS and opens:
                self._skip_block()
            else:
                self.model.warn(number, f"'{keyword}' in the model is not covered by the offline lint")
                if opens:
                    self._skip_block()
        self._block(handler)

    def _element(self, number: int, identifier: Optional[str], kind: str, rest: List[Token], parent: Optional[str], opens: bool) -> None:
        values = [token.text for token in rest if not (token.text == OPEN and not token.quoted)]
        if identifier is None:
            self.model.error(number, f"{kind} needs an identifier (id = {kind} ...)")
            if opens:
                self._skip_block()
            return
        if not IDENTIFIER.match(identifier) or DOT in identifier:
            self.model.error(number, f"invalid identifier {identifier!r}")
        parent_element = self.model.elements.get(parent) if parent else None
        expected_parent_kind = next((p for p, child in CHILD_KINDS.items() if child == kind), None)
        if expected_parent_kind and (parent_element is None or parent_element.kind != expected_parent_kind):
            self.model.error(number, f"{kind} must be declared inside a {expected_parent_kind} block")
        elif not expected_parent_kind and parent is not None:
            self.model.error(number, f"{kind} cannot be declared inside another element")
        full_id = f"{parent}{DOT}{identifier}" if parent and self.model.identifiers_hierarchical else identifier
        if full_id in self.model.elements:
            self.model.error(number, f"duplicate identifier {full_id!r} (first declared at line {self.model.elements[full_id].line})")
        name = values[0] if values else identifier
        description = values[1] if len(values) > 1 else ""
        if kind in (KIND_CONTAINER, KIND_COMPONENT):
            technology = values[2] if len(values) > 2 else ""
            tags = values[3] if len(values) > 3 else ""
            extra = values[4:]
        else:
            technology = ""
            tags = values[2] if len(values) > 2 else ""
            extra = values[3:]
        if extra:
            self.model.error(number, f"too many values for {kind}: {' '.join(repr(value) for value in extra)}")
        element = Element(full_id, kind, name, description, technology, _tags(tags), parent, number)
        self.model.elements[full_id] = element
        if parent_element is not None:
            parent_element.children.append(full_id)
        if opens:
            if kind in CHILD_KINDS:
                self._model_body(full_id)
            else:
                self._element_block(full_id)

    def _element_block(self, identifier: str) -> None:
        def handler(number: int, tokens: List[Token]) -> None:
            keyword = tokens[0].text
            opens = tokens[-1].text == OPEN and not tokens[-1].quoted
            if _arrow_index(tokens) is not None:
                self._relationship(number, tokens, self.model.elements[identifier].parent, self.model.relationships)
            elif keyword in ELEMENT_PROPERTY_KEYWORDS:
                self._element_property(number, identifier, keyword, tokens[1:])
            elif keyword in ELEMENT_SKIPPED_BLOCKS and opens:
                self._skip_block()
            else:
                self.model.warn(number, f"'{keyword}' inside {identifier} is not covered by the offline lint")
                if opens:
                    self._skip_block()
        self._block(handler)

    def _element_property(self, number: int, identifier: str, keyword: str, rest: List[Token]) -> None:
        element = self.model.elements[identifier]
        value = rest[0].text if rest else ""
        if keyword == "tags":
            element.tags = _tags(" ".join(token.text for token in rest)) if rest else element.tags
        elif keyword == "url":
            return
        else:
            setattr(element, keyword, value)

    def _relationship(self, number: int, tokens: List[Token], scope: Optional[str], target: List[Relationship]) -> None:
        arrow = _arrow_index(tokens)
        if arrow != 1 or len(tokens) < 3:
            self.model.error(number, "a relationship is written as <source> -> <destination> [description] [technology] [tags]")
            return
        source = self._resolve(tokens[0].text, scope)
        destination = self._resolve(tokens[2].text, scope)
        values = [token.text for token in tokens[3:] if not (token.text == OPEN and not token.quoted)]
        if len(values) > 3:
            self.model.error(number, f"too many values for the relationship: {' '.join(repr(value) for value in values[3:])}")
        description = values[0] if values else ""
        technology = values[1] if len(values) > 1 else ""
        tags = _tags(values[2]) if len(values) > 2 else []
        target.append(Relationship(source, destination, description, technology, tags, number))

    def _resolve(self, identifier: str, scope: Optional[str]) -> str:
        if identifier == WILDCARD or identifier in self.model.elements:
            return identifier
        current = scope
        while current is not None:
            candidate = f"{current}{DOT}{identifier}"
            if candidate in self.model.elements:
                return candidate
            current = self.model.elements[current].parent if current in self.model.elements else None
        return identifier

    def _environment(self, number: int, identifier: Optional[str], rest: List[Token], opens: bool) -> None:
        values = [token.text for token in rest if not (token.text == OPEN and not token.quoted)]
        name = values[0] if values else ""
        env_id = identifier or name
        if not env_id:
            self.model.error(number, "deploymentEnvironment needs a name or an identifier")
        if any(env.id == env_id for env in self.model.environments):
            self.model.error(number, f"duplicate deployment environment {env_id!r}")
        environment = Environment(env_id, name, [], number)
        self.model.environments.append(environment)
        if opens:
            self._deployment_body(environment.nodes, None)

    def _deployment_body(self, nodes: List[DeploymentNode], node: Optional[DeploymentNode]) -> None:
        def handler(number: int, tokens: List[Token]) -> None:
            opens = tokens[-1].text == OPEN and not tokens[-1].quoted
            if _arrow_index(tokens) is not None:
                self.model.warn(number, "relationships between deployment nodes are not covered by the offline lint")
                return
            if len(tokens) > 2 and tokens[1].text == ASSIGN and not tokens[1].quoted:
                identifier, keyword, rest = tokens[0].text, tokens[2].text, tokens[3:]
            else:
                identifier, keyword, rest = None, tokens[0].text, tokens[1:]
            values = [token.text for token in rest if not (token.text == OPEN and not token.quoted)]
            if keyword in (KIND_DEPLOYMENT_NODE, KIND_INFRASTRUCTURE_NODE):
                child = DeploymentNode(identifier, keyword, values[0] if values else "", values[1] if len(values) > 1 else "", values[2] if len(values) > 2 else "", _tags(values[3]) if len(values) > 3 else [], number)
                nodes.append(child)
                if opens:
                    if keyword == KIND_INFRASTRUCTURE_NODE:
                        self._skip_block()
                    else:
                        self._deployment_body(child.children, child)
            elif keyword in INSTANCE_TARGET_KIND:
                if node is None:
                    self.model.error(number, f"{keyword} must be inside a deploymentNode")
                elif not values:
                    self.model.error(number, f"{keyword} needs the identifier of the element it deploys")
                else:
                    node.instances.append((keyword, values[0], number))
                if opens:
                    self._skip_block()
            elif keyword in ELEMENT_PROPERTY_KEYWORDS or keyword in ELEMENT_SKIPPED_BLOCKS:
                if opens:
                    self._skip_block()
            else:
                self.model.warn(number, f"'{keyword}' in a deployment environment is not covered by the offline lint")
                if opens:
                    self._skip_block()
        self._block(handler)

    def _views_body(self) -> None:
        def handler(number: int, tokens: List[Token]) -> None:
            keyword = tokens[0].text
            opens = tokens[-1].text == OPEN and not tokens[-1].quoted
            values = [token.text for token in tokens[1:] if not (token.text == OPEN and not token.quoted)]
            if keyword in VIEW_KINDS:
                view = self._view_header(number, keyword, values)
                if opens:
                    self._view_body(view)
            elif keyword == "styles" and opens:
                self._styles_body()
            elif keyword in VIEWS_SKIPPED_BLOCKS:
                if opens:
                    self._skip_block()
            else:
                self.model.warn(number, f"'{keyword}' in views is not covered by the offline lint")
                if opens:
                    self._skip_block()
        self._block(handler)

    def _view_header(self, number: int, kind: str, values: List[str]) -> View:
        scope: Optional[str] = None
        environment: Optional[str] = None
        if kind in VIEW_SCOPE_KINDS or kind == VIEW_DYNAMIC:
            scope = values[0] if values else None
            values = values[1:]
            if scope is None:
                self.model.error(number, f"{kind} view needs a scope element")
        elif kind == VIEW_DEPLOYMENT:
            scope = values[0] if values else None
            environment = values[1] if len(values) > 1 else None
            values = values[2:]
            if scope is None or environment is None:
                self.model.error(number, "deployment view needs a scope (or *) and an environment")
        key = values[0] if values else ""
        title = values[1] if len(values) > 1 else ""
        if not key:
            self.model.warn(number, f"{kind} view has no explicit key; keys keep exported file names stable")
        view = View(kind, key, scope, environment, title, number)
        self.model.views.append(view)
        return view

    def _view_body(self, view: View) -> None:
        def handler(number: int, tokens: List[Token]) -> None:
            keyword = tokens[0].text
            opens = tokens[-1].text == OPEN and not tokens[-1].quoted
            texts = [token.text for token in tokens]
            if _arrow_index(tokens) is not None and view.kind == VIEW_DYNAMIC:
                self._relationship(number, tokens, view.scope, view.steps)
            elif keyword in ("include", "exclude"):
                targets = view.includes if keyword == "include" else view.excludes
                if _arrow_index(tokens) is not None:
                    self.model.warn(number, f"{keyword} expressions with -> are not covered by the offline lint")
                else:
                    targets.extend(self._resolve(text, view.scope) for text in texts[1:])
            elif keyword == "autoLayout":
                view.auto_layout = texts[1] if len(texts) > 1 else "tb"
            elif keyword in VIEW_PROPERTY_KEYWORDS:
                if keyword == "title" and len(tokens) > 1:
                    view.title = tokens[1].text
                if opens:
                    self._skip_block()
            else:
                self.model.warn(number, f"'{keyword}' in view {view.key or view.kind} is not covered by the offline lint")
                if opens:
                    self._skip_block()
        self._block(handler)

    def _styles_body(self) -> None:
        def handler(number: int, tokens: List[Token]) -> None:
            keyword = tokens[0].text
            opens = tokens[-1].text == OPEN and not tokens[-1].quoted
            if keyword in (STYLE_ELEMENT, STYLE_RELATIONSHIP) and len(tokens) > 1 and opens and self._opens_block(number, tokens):
                properties: Dict[str, str] = {}
                self._block(lambda n, t: properties.__setitem__(t[0].text, " ".join(token.text for token in t[1:])))
                self.model.styles.append(Style(keyword, tokens[1].text, properties, number))
            else:
                self.model.warn(number, f"'{keyword}' in styles is not covered by the offline lint")
                if opens:
                    self._skip_block()
        self._block(handler)


def _arrow_index(tokens: List[Token]) -> Optional[int]:
    return next((index for index, token in enumerate(tokens) if token.text == ARROW and not token.quoted), None)


def _tags(text: str) -> List[str]:
    return [tag.strip() for tag in text.split(TAG_SEPARATOR) if tag.strip()] if text else []
