export type Source = 'manual' | 'task'

// The engine's AgentStatus values (the contract cannot import them) plus the
// two the mod adds: `stale` for a quiet pane, `unknown` for no roster entry.
export type WorkerStatus = 'pending' | 'running' | 'waiting' | 'idle' | 'completed' | 'failed' | 'killed' | 'stale' | 'unknown'

export type WorkerTask = { source: Source; ref: string; title: string }

export type Worker = {
  name: string
  agentId: string
  teammateId?: string
  status: WorkerStatus
  task?: WorkerTask
  startedAt: number
  lastSeenAt: number
  lastText?: string
  isDone: boolean
  // The name given by `/fleet rename`; the engine's address stays `name`.
  label?: string
}

export type QueueItem = {
  name: string
  brief: string
  title: string
  task?: WorkerTask
  agentType?: string
  // Task plan item ids of the run unit this worker was queued for.
  unit?: string[]
  // The model asked for (an alias, an id or a complexity tier); absent, the
  // task text below is classified when the worker starts.
  model?: string
  complexityText?: string
}

export type RunState = {
  task: string
  // The model `/fleet run --model` asked for every unit of this run.
  model?: string
  // worker name -> task plan item ids the worker was given
  units: Record<string, string[]>
  running: string[]
  finished: string[]
  // Why the run stopped dispatching; it ends once its running units report.
  halted?: string
}

export type FleetTab = 'workers' | 'tasks'

export type FleetView = { tab: FleetTab; selected?: string; taskName?: string; isComposing?: boolean }

// One item of a task plan (`.claude/fleet/tasks/<name>.md`): a checklist line
// with an id, the agent type it names and the ids it waits for.
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export type TaskItem = { id: string; description: string; status: TaskStatus; agent: string | null; needs: string[] }

// One entry of a worker's own task list, rebuilt from its task tool calls.
export type WorkerTaskStatus = 'pending' | 'in_progress' | 'completed'

export type WorkerTaskItem = { id: string; subject: string; status: WorkerTaskStatus }

// The worker's task list as its own tool sends it: the whole list, in order.
export type WorkerTasksInput = { tasks: { subject: string; status: WorkerTaskStatus }[] }

// Text, as the engine expects of an MCP-shaped tool's result.
export type WorkerTasksResult = string

// The lead's fleet tool: what the person would type after `/fleet`.
export type LeadCommandInput = { args: string }

declare module 'claude-code' {
  // The tool the mod registers inside a worker, typed like a built-in so
  // `tool.call` hooks and tests can name it.
  interface BuiltinToolInputs {
    mcp__fleet__tasks: WorkerTasksInput
    mcp__fleet__command: LeadCommandInput
  }
  interface BuiltinToolResults {
    mcp__fleet__tasks: WorkerTasksResult
    mcp__fleet__command: string
  }
  interface PluginState {
    fleet: {
      workers: Worker[]
      queue: QueueItem[]
      log: string[]
      view: FleetView
      relay: boolean
      run: RunState | null
      taskItems: TaskItem[]
      workerTasks: WorkerTaskItem[]
      // Whether this session is a fleet worker: null until session.start settles it.
      isWorker: boolean | null
    }
  }
}
