<!-- dr-ai-version: 3.8.1 -->
# Documentation

- Do not use emojis in any document.
- Do not add comments that restate the code, narrate the change being made, or leave instructions and notes for later inside source code; comment only what the code cannot say by itself (the reason, a constraint, a non-obvious behavior).
- Do not create a documentation file unless the user asked for it or the task requires it.
- Before creating a document, check whether an existing one already covers the topic; update it instead of creating a duplicate.
- When a change alters behavior that is already documented (README, docs, API reference, environment variables, setup steps), update that documentation in the same change.
- Document only what was verified in the code; never describe a feature, endpoint, option, or command that does not exist, and state explicitly what could not be confirmed.
- NEVER include secrets, tokens, credentials, or personal data in a document; use placeholders.
- Reference code by file path instead of pasting large blocks, and use relative links between documents, checking that each one resolves.
- Give every code block its language tag, and write commands so they can be copied and run as they are.
- When adding, renaming, or removing a document, update the `INDEX.md` of its folder and every link that points to it.
