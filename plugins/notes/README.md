# Notes

Last updated: 2026-11-12

Post-it notes inside Claude Code. Type `/note <text>` and the text lands on a board of colored sticky notes, shown in a pane beside the chat. Notes are saved in the plugin's own store, so they stay between sessions and projects. Each note shows its number, when you wrote it and the project folder it came from.

Version: 0.1.1 (see [CHANGELOG.md](CHANGELOG.md)). License: MIT.

## Installation

```
/plugin marketplace add Digital-Republic-AI/dr-plugins
/plugin install notes@dr-plugins
```

Restart Claude Code after installing.

## Usage

| Command | What it does |
|---|---|
| `/note <text>` | Adds a post-it and opens the board. Example: `/note Revisar o PR do checkout antes das 15h` |
| `/note` | Opens the board |
| `/note lista` | Lists every note in the chat, newest first |
| `/note rm <n>` | Deletes note `#n` (`/note apagar <n>` works too) |
| `/note ajuda` | Shows these commands |

The board opens in a pane where the screen has room for one: the terminal, the desktop app and VS Code. The mobile app shows no panes, and neither does a terminal under about 110 columns. There, `/note` and `/note lista` draw the same cards in the chat.

On the board, `nova` (hotkey `n`) opens a field to type a note without leaving the pane, on surfaces that draw text fields. Each note has an `apagar` button that deletes it.

A note keeps up to 2,000 characters, and the board keeps the latest 500 notes. Notes don't reach the model: `/note` answers by itself and adds nothing to the conversation.

## Development

```
claude plugin validate plugins/notes
claude plugin test plugins/notes
```

`hooks/core.ts` holds the parsing and formatting, `hooks/register.tsx` the command and the pane, `hooks/notes.test.tsx` the tests.
