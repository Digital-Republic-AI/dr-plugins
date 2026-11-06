# Skill Authoring

- Write every file of a skill in English: `SKILL.md` (frontmatter and body), `references/`, script code, comments and messages, and the eval prompts and graders. The skill instructs the model to talk to the user in the user's language (Portuguese with full diacritics when the user writes in Portuguese), but its own prompt stays in English.
- Create the skill with the `skill-creator` skill: capture the intent, draft, run 2-3 eval cases with and without the skill, review the results with the user, iterate.
- Place it at `skills/<name>/`, with `SKILL.md`, a `LICENSE` (MIT, same as the other skills) and only the folders it needs: `scripts/`, `references/`, `evals/`.
- Register it in `.claude-plugin/marketplace.json` and add its row to the `README.md` skills table, plus a line in the README change history.
- Frontmatter fields: `name` (lowercase letters, digits and hyphens, at most 64 characters, equal to the folder name), `description`, `license`, `compatibility` (at most 500 characters, only when the skill has runtime requirements), `allowed-tools`, `metadata.version` (semver, starting at `"1.0.0"`). Claude Code also reads `disable-model-invocation` and `user-invocable`.
- `description` is the trigger: say what the skill does and when to use it, including phrases the user would type (in Portuguese too), and what it is not for. Keep it under 1024 characters; aim for about 600.
- Set `disable-model-invocation: true` when the skill only runs on the user's request, and always when it acts outside the machine (deploys, publishes, writes to external services).
- Scope `allowed-tools` to the narrowest pattern, such as `Bash(node ${CLAUDE_SKILL_DIR}/scripts/*)`; never plain `Bash`. Everything left out still asks for permission, which keeps outward-facing commands behind a prompt.
- Keep the `SKILL.md` body under 500 lines. Move details into `references/` and say in the body when to read each file; give reference files over 300 lines a table of contents.
- Explain the reason behind an instruction instead of stacking MUSTs, and write in the imperative.
- Put deterministic, repeatable work into bundled scripts (Node 18+ with no dependencies, or the standard library of the language): JSON output, constants in a dedicated file, explicit exit codes, errors reported and never swallowed.
- Credentials come only from environment variables. A script never takes a secret as an argument, prints it, or writes it to a file; the skill suggests the user set it with `! export ...` instead of pasting it into the chat.
- Any action that changes external state runs in two steps: a plan without side effects first, then the apply after the user confirms.
- Eval cases go in `evals/<case>/` (`prompt.md`, `case.yaml`, `graders/`, `files/`) and never perform real deploys, payments or messages. Keep the eval workspace outside the repository, in the session scratchpad.
- Before opening the PR, run `claude plugin validate .` and the skill's evals, and report what was not verified (for example, API calls never made against a live account).
