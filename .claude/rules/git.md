<!-- dr-ai-version: 3.8.1 -->
# Git

- Do NOT Auto-commit changes
- NEVER mention or co-author Claude or Claude Code
- Mention tests in a PR only when they were actually run: cite the suite or command and its result, or attach evidence such as screenshots or reports. Never claim testing that did not happen
- Execute everyday git operations directly with Bash, without delegating: status, log, diff, show, blame, fetch, pull, push, branch create/switch/list/delete, stash, tags, a commit, a pull request, a merge or revert that applies cleanly
- Delegate to the git-specialist agent (Task tool, subagent_type="dr:git-specialist") only the complicated or long git operations: conflict resolution, rebases and other history rewriting, cherry-picking a series of commits, splitting a large change into several commits, a pull request spanning many commits, recovering lost work, force push
- If an everyday git operation runs into conflicts, a rejected push, or turns into a multi-step recovery, stop and delegate it to the git-specialist agent
- Subagents often work in parallel on the same working tree, so a change you did not make usually belongs to another agent. When running as a subagent, NEVER stash, and never reset, restore, checkout, or clean a file you did not change just because it is not yours: leave it as it is, stage only the files you changed, and report it if it blocks your work
- When working on a Workforce/WiseWork task, ALWAYS include its reference in new line in the pull request description: the task ID (`/tasks/UUID`) or the ticket number (`#NNNN`)
