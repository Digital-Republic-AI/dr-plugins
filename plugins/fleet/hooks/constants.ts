// Names, limits and display sizes of the fleet mod's engine side.

export const PANE = 'fleet'
export const PANE_TITLE = 'Fleet'
export const COMMAND = 'fleet'
export const POLL_MS = 2000

export const TEAM_MODES_WITH_PANES = ['tmux', 'iterm2', 'auto']

// Task plans: one Markdown checklist per plan in the project, read and written
// by the lead alone. A line is `- [<mark>] <ID>: <description> [@agent] [needs: A, B]`.
export const TASKS_DIR = '.claude/fleet/tasks'
export const TASK_FILE_EXT = '.md'
export const TASK_MARKS = { ' ': 'pending', '~': 'in_progress', x: 'completed', X: 'completed', '-': 'cancelled' } as const
export const TASK_MARK_OF = { pending: ' ', in_progress: '~', completed: 'x', cancelled: '-' } as const
export const TASK_LINE = /^(\s*[-*]\s+\[)([ ~xX-])(\]\s+)([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/
export const TASK_AGENT_TAG = /(?:^|\s)@([A-Za-z0-9][A-Za-z0-9:_-]*)(?=\s|$)/
export const TASK_NEEDS_TAG = /(?:^|\s)needs:\s*([A-Za-z][A-Za-z0-9_-]*(?:\s*,\s*[A-Za-z][A-Za-z0-9_-]*)*)(?=\s|$)/i
export const TASK_TITLE_LINE = /^#\s+(.+?)\s*$/m
// The glyph the pane draws before a task plan item, per status.
export const TASK_GLYPHS = { pending: '○', in_progress: '◐', completed: '✓', cancelled: '–' } as const
// What the worker of a task plan item is called: `task-<id>`.
export const TASK_WORKER_PREFIX = 'task-'

export const STORE_RELAY = 'relay'
export const STORE_MAX_WORKERS = 'maxWorkers'

export const NEW_WORKER_BASE = 'w1'

// Characters kept of a text, per place it is shown.
export const TOAST_TEXT = 80
export const LOG_MESSAGE_TEXT = 120
export const LOG_SENT_TEXT = 100
export const ERROR_TEXT = 200

// Pane layout, in rows and terminal columns.
export const LOG_ROWS = 6
export const TASK_ROWS = 12
export const MAX_SELECTABLE = 9
export const MIN_PANE_COLUMNS = 20
export const MIN_TASK_COLUMNS = 8
export const WORKER_ROW_COLUMNS = 30
export const SEPARATOR_COLUMNS = 40

// Ended workers kept in the state, newest first; the rest are pruned.
export const MAX_ENDED_WORKERS = 5
// An ended worker is pruned once its end is older than this.
export const ENDED_WORKER_TTL_MS = 60 * 60 * 1000

// Worker guard: the lead records the workers it starts, keyed by its session id,
// and a worker finds itself there from its own launch flags.
export const STORE_WORKERS_PREFIX = 'workers:'
export const DEFAULT_POLICY_PATH = 'worker/policy.json'
export const PROJECT_POLICY_PATH = '.claude/fleet/worker-policy.json'
// Command lines of the shell's parent and its ancestors, closest first.
export const ANCESTRY_SCRIPT = 'p=$PPID; for i in 1 2 3 4; do ps -o command= -p "$p"; p=$(ps -o ppid= -p "$p" | tr -d " "); [ -z "$p" ] && break; done'

// A worker's screen: the band above its prompt lists its tasks, nothing else.
// The band's title: `fleet worker <name> · tasks`, the name being the worker's
// fleet label when it was renamed.
export const WORKER_TITLE = 'fleet worker'
export const WORKER_TASKS_WORD = 'tasks'
export const WORKER_NO_TASKS_TEXT = 'No tasks yet.'
// Rows the list leaves to the frame's two border rows, the title and the `n more` line.
export const WORKER_LIST_CHROME_ROWS = 4
// Columns the frame's two borders take from the band's width.
export const WORKER_BAND_FRAME_COLUMNS = 2
export const WORKER_BAND_BORDER_STYLE = 'round'
// Frame look per working step, from the first frame after work starts to the
// full look: a green border and a light background that the text has to read
// on. Step 0 is the idle look, a dim frame with no background. Raw hex, since
// a theme key cannot be stepped.
export const WORKER_SHADE_RAMP = [
  { border: '#3f6b4f', background: '#46584c', text: '#e8f0ea', activeText: '#b8f0cd' },
  { border: '#4a8a62', background: '#8aa592', text: '#10201a', activeText: '#0b3d22' },
  { border: '#3a9a5f', background: '#bcd6c5', text: '#10201a', activeText: '#0b3d22' },
  { border: '#2e9e5b', background: '#d9f2e0', text: '#10201a', activeText: '#0b3d22' },
] as const
export const WORKER_SHADE_LAST_STEP = WORKER_SHADE_RAMP.length
export const WORKER_TASK_GLYPHS = { pending: '○', in_progress: '◐', completed: '✓' } as const
// A theme key, so the task in progress reads on dark and light themes alike.
export const WORKER_ACTIVE_COLOR = 'success'
// The band's activity word: the spinner is not drawn in a worker.
export const WORKER_WORKING_TEXT = 'working…'
export const WORKER_IDLE_TEXT = 'idle'
export const WORKER_ACTIVITY_SEPARATOR = ' · '
// The glyph cycled next to `working…`, in place of the hidden engine spinner,
// and how often the worker advances it.
export const WORKER_SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const
export const WORKER_SPINNER_MS = 120
// How often a worker reads its own agents, to keep the working look while a
// background subagent runs after the turn ended.
export const WORKER_BACKGROUND_POLL_MS = 1000
// The progress bar after the completed/total counter in the band title.
export const WORKER_PROGRESS_CELLS = 10
export const WORKER_PROGRESS_FILLED = '█'
export const WORKER_PROGRESS_EMPTY = '░'
// What `$.ui.open` resolves to inside a worker, for any plugin's pane.
export const WORKER_PANE_REFUSED = 'fleet worker: panes stay closed, the screen is the task list'
// Attachment kinds the engine adds each turn that a worker must not read (the
// output style reminder). The kind name is the engine's and is unverified
// against a real worker: kept here, in one place, to adjust.
export const WORKER_HIDDEN_ATTACHMENT_TYPES = ['output_style'] as const
// Fallback on the reminder's text, for when the kind is named differently.
export const WORKER_HIDDEN_ATTACHMENT_TEXT = /output style is active/i

// Model per worker: an alias, a full model id or a complexity tier, mapped to a
// model through the policy file's `modelTiers`.
export const MODEL_FLAG = '--model'
// The agent type every worker of a `spawn` starts as.
export const TYPE_FLAG = '--type'
export const COMPLEXITY_TIERS = ['simple', 'standard', 'complex'] as const
export const DEFAULT_MODEL_TIERS = { simple: 'haiku', standard: 'sonnet', complex: 'opus' } as const satisfies Record<(typeof COMPLEXITY_TIERS)[number], string>
// Characters of task text handed to the classifier.
export const CLASSIFY_TEXT_MAX = 2000
export const HELP_MODEL_NOTE = "--model takes an alias (haiku, sonnet, opus), a full model id or a tier (simple, standard, complex). Without it the fleet classifies the task by complexity and uses the tier's model; a plan item with an @agent keeps the agent's model."

// The worker's own task list tool, registered by the mod inside a worker: a
// teammate has no TaskCreate or TodoWrite, so the list comes through this.
export const WORKER_TASKS_TOOL_NAME = 'tasks'
export const WORKER_TASKS_TOOL = `mcp__fleet__${WORKER_TASKS_TOOL_NAME}`
export const WORKER_TASKS_TOOL_DESCRIPTION = 'Replaces your whole task list, shown on your screen. Call it before starting (every step as pending), when a step starts (in_progress) and when it ends (completed).'
export const WORKER_TASKS_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { subject: { type: 'string', description: 'One short line.' }, status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] } },
        required: ['subject', 'status'],
      },
    },
  },
  required: ['tasks'],
} as const

// Free text after `/fleet` (or in the lead tool) is read by this model into
// fleet commands, which then run as if typed.
export const FLEET_INTERPRETER_MODEL = 'haiku'
export const FLEET_INTERPRETER_MAX_TOKENS = 1024
export const FLEET_INTERPRETER_SYSTEM =
  'You translate a request about a fleet of Claude Code worker teammates into /fleet commands. Answer with one JSON object and nothing else, no code fence: {"commands": ["<line>", ...]} with each line in the syntax listed, without the leading "/fleet", in the order to run them; or {"reply": "<one short sentence in the language of the request>"} when no listed command does what is asked. Refer to workers by the names or labels listed. Never invent a subcommand or a flag.'
export const HELP_NATURAL_NOTE = 'Anything else after /fleet is read as a plain request and run as the commands it asks for.'

// The fleet's own tool in the lead session, so a request made in the
// conversation reaches the fleet; its description ends with the HELP text.
export const LEAD_COMMAND_TOOL_NAME = 'command'
export const LEAD_COMMAND_TOOL = `mcp__fleet__${LEAD_COMMAND_TOOL_NAME}`
export const LEAD_COMMAND_TOOL_DESCRIPTION =
  'Runs a /fleet command as the person would type it after "/fleet": start, message, stop or rename worker teammates, list and run task plans (.claude/fleet/tasks/<name>.md), open the Fleet pane. Use it whenever the person asks for something about the fleet or its workers. A plain-language request is read into commands too. The syntax:'
export const LEAD_COMMAND_TOOL_SCHEMA = {
  type: 'object',
  properties: { args: { type: 'string', description: 'What follows "/fleet", e.g. "spawn a b --model opus" or "rename a docs".' } },
  required: ['args'],
} as const
export const WORKER_COMMAND_REFUSED = 'fleet workers do not run fleet commands'

// The store key of the labels the lead gave its workers, per lead session:
// `{ [address name]: label }`, read by each worker for its own band.
export const STORE_LABELS_PREFIX = 'labels:'
