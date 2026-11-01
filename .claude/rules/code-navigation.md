<!-- dr-ai-version: 3.8.1 -->
# Code Navigation

- For symbol lookups (definitions, references, call sites, type usages) ALWAYS use the LSP tool (goToDefinition / findReferences / goToImplementation / incomingCalls). This rule applies in every permission mode, including bypass, and overrides any harness preference for grep.
- Every LSP call takes a position (filePath, line, character): locate a symbol by name with workspaceSymbol (always pass query) or documentSymbol before querying it.
- At the start of the session, load the LSP tool once with ToolSearch("select:LSP") before the first navigation need; do not fall back to grep because the tool is not loaded yet.
- grep/rg are only for literal text: strings, log messages, comments, i18n keys, config values. Prefer rg over grep for recursive search via Bash - rg honors .gitignore even when rewritten by the RTK hook, while a rewritten grep -r crawls node_modules and similar ignored directories.
- Run findReferences before renaming or removing any exported symbol.
- LSP has no diagnostics operation: run the project's type checker and linter after editing files to verify correctness before marking work complete
