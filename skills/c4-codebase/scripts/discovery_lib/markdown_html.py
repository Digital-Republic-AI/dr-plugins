from __future__ import annotations

import html
import re
from typing import List, Optional, Tuple

HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
LIST_ITEM = re.compile(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$")
TABLE_ROW = re.compile(r"^\s*\|.*\|\s*$")
TABLE_SEPARATOR = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$")
HORIZONTAL_RULE = re.compile(r"^\s*([-*_])(\s*\1){2,}\s*$")
FENCE = re.compile(r"^\s*(```|~~~)\s*([A-Za-z0-9_+-]*)\s*$")
BLOCKQUOTE = re.compile(r"^\s*>\s?(.*)$")
HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
CODE_SPAN = re.compile(r"`([^`]+)`")
BOLD = re.compile(r"\*\*(.+?)\*\*")
ITALIC = re.compile(r"(?<![A-Za-z0-9*])[*_]([^*_\n]+?)[*_](?![A-Za-z0-9*])")
LINK = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
CLAIM = re.compile(r"\[(observed|inferred|confirmed|ASK USER)\s+([^\]]+)\]")
CODE_PLACEHOLDER = "\x00{}\x00"
CODE_PLACEHOLDER_PATTERN = re.compile("\x00([0-9]+)\x00")
MAX_HEADING_LEVEL = 6
INDENT_UNIT = 2
CLAIM_CLASS = {"observed": "observed", "inferred": "inferred", "confirmed": "confirmed", "ASK USER": "ask"}


def markdown_to_html(text: str, heading_offset: int = 0) -> str:
    lines = HTML_COMMENT.sub("", text).splitlines()
    blocks: List[str] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        if not line.strip():
            index += 1
            continue
        fence = FENCE.match(line)
        if fence:
            index = _code_block(lines, index, fence.group(1), fence.group(2), blocks)
            continue
        heading = HEADING.match(line)
        if heading:
            level = min(len(heading.group(1)) + heading_offset, MAX_HEADING_LEVEL)
            blocks.append(f"<h{level}>{inline(heading.group(2))}</h{level}>")
            index += 1
            continue
        if HORIZONTAL_RULE.match(line):
            blocks.append("<hr>")
            index += 1
            continue
        if TABLE_ROW.match(line) and index + 1 < len(lines) and TABLE_SEPARATOR.match(lines[index + 1]):
            index = _table(lines, index, blocks)
            continue
        if LIST_ITEM.match(line):
            index = _list(lines, index, blocks)
            continue
        if BLOCKQUOTE.match(line):
            index = _blockquote(lines, index, blocks)
            continue
        index = _paragraph(lines, index, blocks)
    return "\n".join(blocks) + ("\n" if blocks else "")


def inline(text: str) -> str:
    escaped = html.escape(text, quote=False)
    spans: List[str] = []

    def stash(match) -> str:
        spans.append(f"<code>{match.group(1)}</code>")
        return CODE_PLACEHOLDER.format(len(spans) - 1)

    escaped = CODE_SPAN.sub(stash, escaped)
    escaped = CLAIM.sub(lambda m: f'<span class="claim claim-{CLAIM_CLASS[m.group(1)]}">{m.group(1)} {m.group(2)}</span>', escaped)
    escaped = LINK.sub(lambda m: f'<a href="{html.escape(m.group(2), quote=True)}">{m.group(1)}</a>', escaped)
    escaped = BOLD.sub(r"<strong>\1</strong>", escaped)
    escaped = ITALIC.sub(r"<em>\1</em>", escaped)
    return CODE_PLACEHOLDER_PATTERN.sub(lambda m: spans[int(m.group(1))], escaped)


def _code_block(lines: List[str], index: int, fence: str, language: str, blocks: List[str]) -> int:
    body: List[str] = []
    index += 1
    while index < len(lines) and not lines[index].strip().startswith(fence):
        body.append(lines[index])
        index += 1
    attribute = f' class="language-{html.escape(language, quote=True)}"' if language else ""
    blocks.append(f"<pre><code{attribute}>{html.escape(chr(10).join(body), quote=False)}</code></pre>")
    return index + 1


def _table(lines: List[str], index: int, blocks: List[str]) -> int:
    header = _cells(lines[index])
    index += 2
    rows: List[List[str]] = []
    while index < len(lines) and TABLE_ROW.match(lines[index]):
        rows.append(_cells(lines[index]))
        index += 1
    head = "".join(f"<th>{inline(cell)}</th>" for cell in header)
    body = "".join("<tr>" + "".join(f"<td>{inline(cell)}</td>" for cell in _pad(row, len(header))) + "</tr>" for row in rows)
    blocks.append(f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>")
    return index


def _cells(line: str) -> List[str]:
    stripped = line.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    return [cell.strip() for cell in _split_cells(stripped)]


def _split_cells(text: str) -> List[str]:
    cells: List[str] = []
    current: List[str] = []
    in_code = False
    for char in text:
        if char == "`":
            in_code = not in_code
        if char == "|" and not in_code:
            cells.append("".join(current))
            current = []
        else:
            current.append(char)
    cells.append("".join(current))
    return cells


def _pad(row: List[str], width: int) -> List[str]:
    return (row + [""] * width)[:width]


def _list(lines: List[str], index: int, blocks: List[str]) -> int:
    items: List[Tuple[int, bool, str]] = []
    while index < len(lines):
        match = LIST_ITEM.match(lines[index])
        if match:
            items.append((len(match.group(1).expandtabs(INDENT_UNIT)), match.group(2)[0].isdigit(), match.group(3)))
            index += 1
        elif lines[index].strip() and items and lines[index].startswith(" "):
            depth, ordered, text = items[-1]
            items[-1] = (depth, ordered, f"{text} {lines[index].strip()}")
            index += 1
        else:
            break
    blocks.append(_render_list(items))
    return index


def _render_list(items: List[Tuple[int, bool, str]]) -> str:
    output: List[str] = []
    stack: List[Tuple[int, str]] = []
    for depth, ordered, text in items:
        tag = "ol" if ordered else "ul"
        while stack and depth < stack[-1][0]:
            output.append(f"</li></{stack.pop()[1]}>")
        if not stack or depth > stack[-1][0]:
            stack.append((depth, tag))
            output.append(f"<{tag}><li>{inline(text)}")
        else:
            output.append(f"</li><li>{inline(text)}")
    while stack:
        output.append(f"</li></{stack.pop()[1]}>")
    return "".join(output)


def _blockquote(lines: List[str], index: int, blocks: List[str]) -> int:
    body: List[str] = []
    while index < len(lines):
        match = BLOCKQUOTE.match(lines[index])
        if not match:
            break
        body.append(match.group(1))
        index += 1
    blocks.append(f"<blockquote>{markdown_to_html(chr(10).join(body)).strip()}</blockquote>")
    return index


def _paragraph(lines: List[str], index: int, blocks: List[str]) -> int:
    body: List[str] = []
    while index < len(lines) and lines[index].strip() and not _starts_block(lines[index]):
        body.append(lines[index].strip())
        index += 1
    if body:
        blocks.append(f"<p>{inline(' '.join(body))}</p>")
    else:
        index += 1
    return index


def _starts_block(line: str) -> bool:
    return bool(HEADING.match(line) or FENCE.match(line) or LIST_ITEM.match(line) or BLOCKQUOTE.match(line) or HORIZONTAL_RULE.match(line) or TABLE_ROW.match(line))
