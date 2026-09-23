---
description: Extracts the baseline spec of existing code into .spek/specs/NNN-slug/baseline.md - the brownfield entry point of the SDD flow
argument-hint: "<path to module or directory> [feature-slug]"
allowed-tools: Read, Glob, Grep, Task, Bash(${CLAUDE_PLUGIN_ROOT}/scripts/new-feature.sh:*), Bash(${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh:*), Bash(find:*), Bash(wc:*)
---

# Extract

You are starting the SDD cycle from code that already exists. Instead of specifying a change from a
description, you first write down what the code does today -- the baseline -- so the change that
follows has a known starting point.

Arguments: `$ARGUMENTS` (first token: the scope path; optional second token: the feature slug).

## Steps

1. Require a scope path. Take the first token of `$ARGUMENTS` as the path to the module or directory
   to extract. If `$ARGUMENTS` is empty or the path does not exist, STOP and ask the user which
   module to extract. Never default to the repository root and never guess a path -- extract exists
   to anchor a specific planned change, not to document a whole codebase.

2. Apply the HARD SCOPE LIMIT before reading anything. Count the source files under the scope path,
   excluding obvious vendored/dependency directories:

   ```bash
   find <path> -type f \
     -not -path '*/node_modules/*' -not -path '*/.git/*' \
     -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/vendor/*' \
     | wc -l
   ```

   Adjust the exclusions to the project (`.venv`, `target`, `__pycache__`, `coverage`, lockfiles,
   binary assets) when they are clearly not source.

   If the count is **more than 50 files**, REFUSE to continue and explain why: comprehensive
   extraction of large scopes exceeds human review capacity and produces low-confidence baselines --
   nobody reviews a 60-file baseline honestly, and an unreviewed baseline is exactly the artifact
   that later phases must not trust. This is a design decision from research on brownfield SDD, not
   a technical limitation. Tell the user to pick a narrower module, or to run `/spek:extract` several
   times over sub-modules, one baseline per run. Do not offer to "extract anyway" or to sample the
   files.

3. Derive the feature slug: use the optional second token of `$ARGUMENTS` if present, otherwise
   kebab-case the basename of the scope path (e.g. `src/services/PaymentGateway` -> `payment-gateway`).
   Then run `${CLAUDE_PLUGIN_ROOT}/scripts/new-feature.sh <slug>` to resolve the next sequential
   number and create `.spek/specs/NNN-slug/`. Never compute the number or create the directory yourself --
   the script is the single source of truth for numbering. If it reports `"existing": true`, ask
   whether the user wants to re-extract the baseline for that feature before overwriting anything.

4. Delegate the extraction to the `spek:code-archeologist` subagent, invoking it ONCE. The subagent
   scaffolds `baseline.md` through its preloaded `sdd-templates` skill, fills it in place, and
   returns only a short completion notice
   -- the path written, the `BR-00X` and `[CANNOT INFER]` counts, and any problem it hit. It must
   NEVER return the baseline content to you, and you must NEVER write or rewrite baseline content
   yourself. Pass it:
   - the scope path;
   - the explicit list of files in scope (from step 2), so the subagent reads all of them and nothing
     outside;
   - the feature directory: the `dir` returned by `new-feature.sh` in step 3 (never paste template
     content into the prompt);
   - whether the user chose to re-extract an existing feature in step 3, so the subagent scaffolds
     with `--force` instead of refusing to overwrite.

   Do not read the code yourself and do not "help" the subagent by summarizing files for it -- the
   whole point is that the claims in the baseline come from files that were actually read.

5. After the subagent reports completion, confirm that `.spek/specs/NNN-slug/baseline.md` exists
   (`Glob` on the path, or `Read` of its first lines). If the file is missing, stop and report the
   failure -- never fill the gap by writing the baseline yourself.

6. Create the state file by running, in this order:

   ```bash
   ${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh <dir> init <feature> <slug> normal extract
   ${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh <dir> set-context brownfield
   ```

   using the `dir`, `feature` and `slug` returned by `new-feature.sh`. The 5th argument of `init`
   makes the feature start in phase `extract` -- the baseline exists but no change has been specified
   yet, so the feature is NOT in phase `specify`; `/spek:specify` advances it later with `set-phase`.
   Extract always implies `normal` mode -- a change worth extracting a baseline for is not trivial.
   `mode` (`light|normal`) and `context` (`greenfield|brownfield`) are independent fields: mode is how
   much ceremony the change gets, context is whether it starts from existing code. The script is the
   ONLY writer of `state.json`; never create or hand-edit that file yourself.

7. Summarize the result for the user:
   - the number of `BR-00X` responsibilities in the baseline;
   - the number of `[CANNOT INFER]` gaps.

   Both counts MUST come from an actual `Grep` over the written `.spek/specs/NNN-slug/baseline.md`
   (patterns `BR-[0-9]{3}` and `CANNOT INFER`, `output_mode: "count"`) -- never from memory of what
   the subagent returned.

   Then state the next step: review the baseline (it is a draft until a human confirms it), and run
   `/spek:specify` to describe the change you actually want to make.

## Rules

- The baseline describes the **present**, not the desired future. It carries no product decision, no
  improvement, no refactoring plan -- all of that belongs to `spec.md`, written later by
  `/spek:specify`.
- A baseline with many honest gaps on a complex module is a signal to **narrow the scope**, not to
  fill the gaps with plausibility. If the gaps make the baseline unusable, re-run `/spek:extract` on
  a smaller sub-module.
- The baseline is immutable once the change spec exists. After `/spek:specify` has written `spec.md`
  in the same feature directory, `baseline.md` is the approved historical record of how the system
  was, and the phase-prerequisite hook blocks further writes to it. If you need a fresh baseline,
  run `/spek:extract` again for a new feature instead of rewriting the old one.
- Never run extract to "document the whole system". It exists to anchor a specific planned change;
  a baseline nobody is going to build on is just stale documentation.
- The extracted `BR-00X` entries are the raw material for the `### What Must Be Preserved` zone of
  the next `spec.md`: `/spek:specify` promotes the relevant ones into `PR-00X` preservation
  requirements, which `/spek:verify` then checks with concrete evidence.
