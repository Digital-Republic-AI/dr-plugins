import { atom, read, update } from 'claude-code'
import type { EngineInterface, HookFailure, Register, RenderElement, RenderInput, Timer } from 'claude-code'

import type { FleetView, QueueItem, RunState, TaskItem, TaskStatus, Worker, WorkerTaskItem } from '../types'
import type { Command } from './commands'
import {
  ANCESTRY_SCRIPT,
  COMMAND,
  COMPLEXITY_TIERS,
  DEFAULT_MODEL_TIERS,
  DEFAULT_POLICY_PATH,
  ENDED_WORKER_TTL_MS,
  ERROR_TEXT,
  FLEET_INTERPRETER_MAX_TOKENS,
  FLEET_INTERPRETER_MODEL,
  FLEET_INTERPRETER_SYSTEM,
  LEAD_COMMAND_TOOL,
  LEAD_COMMAND_TOOL_DESCRIPTION,
  LEAD_COMMAND_TOOL_NAME,
  LEAD_COMMAND_TOOL_SCHEMA,
  LOG_MESSAGE_TEXT,
  LOG_SENT_TEXT,
  MAX_ENDED_WORKERS,
  NEW_WORKER_BASE,
  PANE,
  PANE_TITLE,
  POLL_MS,
  PROJECT_POLICY_PATH,
  STORE_LABELS_PREFIX,
  STORE_MAX_WORKERS,
  STORE_RELAY,
  STORE_WORKERS_PREFIX,
  TASKS_DIR,
  TEAM_MODES_WITH_PANES,
  TOAST_TEXT,
  WORKER_BACKGROUND_POLL_MS,
  WORKER_COMMAND_REFUSED,
  WORKER_HIDDEN_ATTACHMENT_TEXT,
  WORKER_HIDDEN_ATTACHMENT_TYPES,
  WORKER_PANE_REFUSED,
  WORKER_SHADE_LAST_STEP,
  WORKER_SPINNER_MS,
  WORKER_TASKS_TOOL,
  WORKER_TASKS_TOOL_DESCRIPTION,
  WORKER_TASKS_TOOL_NAME,
  WORKER_TASKS_TOOL_SCHEMA,
} from './constants'
import {
  BLOCKED_PREFIX,
  DEFAULT_INSTRUCTIONS_PATH,
  DEFAULT_MAX_WORKERS,
  HELP,
  LEAD_NAME,
  classificationText,
  finishUnit,
  findWorker,
  hasBackgroundWork,
  interpreterPrompt,
  labelMap,
  IDLE_NOTIFICATION,
  isComplexityTier,
  isLive,
  isReport,
  isTaskFile,
  liveCount,
  manualBrief,
  manualTask,
  markDone,
  markIdle,
  parseCommand,
  parseInterpretation,
  parseTaskFile,
  pickUnits,
  planBrief,
  PROJECT_INSTRUCTIONS_PATH,
  pruneEnded,
  pushLog,
  queueNext,
  readyUnits,
  rebindUnit,
  reduceTaskCall,
  reduceMessage,
  reduceRoster,
  reduceSpawned,
  releaseUnit,
  renameWorker,
  resolveModel,
  setMark,
  startUnit,
  taskFilePath,
  taskNameOf,
  taskTitle,
  teammateEvent,
  truncate,
  uniqueName,
  unitWorkerName,
  withStatus,
} from './core'
import type { ModelTiers } from './modelChoice'
import { paneTree } from './pane'
import type { TeammateIdentity, WorkerPolicy } from './policy'
import { parsePolicy, policyDenial, teammateIdentity } from './policy'
import { isHiddenAttachment } from './workerPrompt'
import { hiddenRow, workerBand } from './workerView'

// Declared here: the engine's state scan reads an atom only where its reference is written.
const workers = atom({ plugin: 'fleet', key: 'workers' } as const, [] as Worker[])
const queue = atom({ plugin: 'fleet', key: 'queue' } as const, [] as QueueItem[])
const log = atom({ plugin: 'fleet', key: 'log' } as const, [] as string[])
const view = atom({ plugin: 'fleet', key: 'view' } as const, { tab: 'workers' } as FleetView)
const relay = atom({ plugin: 'fleet', key: 'relay' } as const, false)
const run = atom({ plugin: 'fleet', key: 'run' } as const, null as RunState | null)
const taskItems = atom({ plugin: 'fleet', key: 'taskItems' } as const, [] as TaskItem[])
const workerTasks = atom({ plugin: 'fleet', key: 'workerTasks' } as const, [] as WorkerTaskItem[])
// Read by the render hooks, which may neither resolve the guard nor wait on
// it: a draw made before session.start settled it is drawn again after.
const isWorker = atom({ plugin: 'fleet', key: 'isWorker' } as const, null as boolean | null)

// Module-only state: lost on hot reload, rebuilt in session.start.
const live = {
  tick: null as Timer | null,
  maxWorkers: DEFAULT_MAX_WORKERS,
  isAdvancing: false,
  tickCheck: Promise.resolve(),
  // This session's guard: null when it is not a fleet worker.
  workerPolicy: null as Promise<WorkerPolicy | null> | null,
  // The complexity tier -> model table the lead picks worker models from.
  modelTiers: null as Promise<ModelTiers> | null,
  // The worker band's activity glyph: the timer that advances it, the frame it
  // is on, and whether the band last drew the session as working. A render
  // hook may not write state, so the band keeps this here.
  spinner: null as Timer | null,
  spinnerFrame: 0,
  shadeStep: 0,
  isWorking: false,
  // Whether the worker's own background subagents are at work, read by a
  // slower timer, since a render hook may not list agents.
  backgroundPoll: null as Timer | null,
  isPollingBackground: false,
  hasBackgroundWork: false,
  // A worker's address in its lead's fleet, and the label the lead gave it.
  identity: null as TeammateIdentity | null,
  label: null as string | null,
}

type HiddenSite = 'AssistantMessage' | 'ToolUse' | 'ToolResult' | 'ToolGroup' | 'UserMessage' | 'Spinner' | 'TurnDuration' | 'ToolProgress'

type SpawnRequest = QueueItem

type SpawnOutcome = { kind: 'started' | 'queued'; name: string; text: string } | { kind: 'refused'; text: string }

export const register: Register = on => {
  // A load (first, hot reload, a test) starts from a clean module state; the
  // session's $.state carries the workers across.
  live.tick = null
  live.isAdvancing = false
  live.maxWorkers = DEFAULT_MAX_WORKERS
  live.tickCheck = Promise.resolve()
  live.workerPolicy = null
  live.modelTiers = null
  stopSpinner()
  stopBackgroundPoll()
  live.spinnerFrame = 0
  live.shadeStep = 0
  live.isWorking = false
  live.isPollingBackground = false
  live.hasBackgroundWork = false
  live.identity = null
  live.label = null

  on('session.start', async ($, e, next) => {
    // Started here, ahead of the first draw, and awaited before the hook
    // returns: the guard reads the process tree, the store and a file, calls
    // a render hook may not make and that die with the hook that made them.
    const guard = workerPolicy($)
    const started = await next(e)
    await $.command
      .register({
        name: COMMAND,
        description: 'Orchestrate worker teammates in split panes (spawn, send, stop, rename, run task plans)',
        argumentHint: '[spawn|send|stop|rename|plan|run|relay|help|<request>] ...',
      })
      .catch(report($))
    await loadPrefs($)
    await reconcile($)
    const policy = await guard
    await update($, isWorker, () => policy !== null)
    if (policy) await armWorker($)
    else await armLead($)
    return started
  })

  on('session.end', (_$, e, next) => {
    stopSpinner()
    return next(e)
  }).catch(($, e, next) => (hookFailed($, 'session.end', next.error), next(e)))

  on('command.run', { command: COMMAND }, async ($, e) => ({ text: await runCommand($, parseCommand(e.args)) })).catch(($, e, next) => (hookFailed($, 'command', next.error), next(e)))

  // Teammates the lead model started itself (an Agent call carrying `name`)
  // join the fleet too. The mod's own $.agent.spawn skips this hook.
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (e.isTeammate && started.agentId) {
      const now = await $.clock.now()
      const name = e.name ?? started.teammateId?.split('@')[0] ?? started.agentId
      await update($, workers, ws => reduceSpawned(ws, { name, agentId: started.agentId!, teammateId: started.teammateId, task: { source: 'manual', ref: name, title: taskTitle(e.description ?? e.prompt) }, now }))
      await note($, `${name} joined (spawned by the lead)`)
      ensureTick($)
    }
    return started
  }).catch(($, e, next) => (hookFailed($, 'agent.spawn', next.error), next(e)))

  on('session.receive', async ($, e, next) => {
    const origin = e.origin
    if (!('teammate' in origin) || origin.teammate === LEAD_NAME) return next(e)
    const from = origin.teammate
    const now = await $.clock.now()
    // The engine's own idle notice arrives as JSON: the worker goes idle in
    // the pane, and the lead model is not shown the payload.
    if (teammateEvent(e.text)?.type === IDLE_NOTIFICATION) {
      await update($, workers, ws => markIdle(ws, from, now))
      return { consumed: 'fleet: worker idle, shown in the Fleet pane' }
    }
    await update($, workers, ws => reduceMessage(ws, from, e.text, now))
    await note($, `${from}: ${truncate(e.text, LOG_MESSAGE_TEXT)}`)
    $.ui.toast(`${from}: ${truncate(e.text, TOAST_TEXT)}`)
    if (isReport(e.text)) await onReport($, from)
    const isBlocked = isReport(e.text, BLOCKED_PREFIX)
    const pass = await read($, relay)
    if (pass || isBlocked) return next(e)
    return { consumed: 'fleet: shown in the Fleet pane' }
  }).catch(($, e, next) => (hookFailed($, 'session.receive', next.error), next(e)))

  on('classic.TeammateIdle', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, workers, ws => markIdle(ws, e.teammate_name, now))
    const worker = findWorker(await read($, workers), e.teammate_name)
    if (worker?.lastText && isReport(worker.lastText)) await onReport($, e.teammate_name)
    return next(e)
  }).catch(($, e, next) => (hookFailed($, 'TeammateIdle', next.error), next(e)))

  // Inside a worker the fleet enforces the worker policy on every tool call and
  // follows its task list; in any other session the guard resolves to null and
  // stays out of the way.
  on('tool.call', async ($, e, next) => {
    const policy = await workerPolicy($)
    const input = e as Record<string, unknown>
    const denial = policy && e.tool !== WORKER_TASKS_TOOL ? policyDenial(e.tool, input, policy) : null
    if (denial) return { deny: denial }
    const called = await next(e)
    if (policy && called.deny === undefined) await trackTasks($, e.tool, input, called.result)
    return called
  }).catch(($, e, next) => (hookFailed($, 'tool.call', next.error), next(e)))
  // Serves the worker's task list tool; the hook above has already followed the list.
  // An MCP-shaped tool answers text, the shape the engine validates.
  on('tool.call', { tool: WORKER_TASKS_TOOL }, (_$, e) => {
    const tasks: unknown = e.tasks
    return { result: Array.isArray(tasks) ? `Task list replaced: ${tasks.length} task(s).` : 'Task list unchanged: "tasks" must be a list.' }
  })
  // Serves the lead's fleet tool: the model's words run as a /fleet command line.
  on('tool.call', { tool: LEAD_COMMAND_TOOL }, async ($, e) => {
    if (await workerPolicy($)) return { deny: WORKER_COMMAND_REFUSED }
    return { result: await runCommand($, parseCommand(String(e.args ?? ''))) }
  }).catch(($, e, next) => (hookFailed($, 'fleet command tool', next.error), next(e)))

  // The output style a worker inherits from the lead's settings is out of the
  // mod's reach: the engine adds its body after `prompt.compose`, outside the
  // sections, context blocks and attachments the hooks see (checked in a real
  // worker). What the mod can do is drop the reminder that re-announces the
  // style, when the engine sends one as an attachment.
  on('prompt.attachment', async ($, e, next) => {
    if ((await workerPolicy($)) && isHiddenAttachment(e.type, e.text, WORKER_HIDDEN_ATTACHMENT_TYPES, WORKER_HIDDEN_ATTACHMENT_TEXT)) return { text: null }
    return next(e)
  }).catch(($, e, next) => (hookFailed($, 'prompt.attachment', next.error), next(e)))

  // A worker's screen is its task list: no plugin pane opens there, the dr
  // sidebar's included. `{ value }` answers the opener as a narrow terminal
  // would, so no pane is registered and the opener does not retry; the lead
  // and any other session pass the open on untouched.
  on('ui.open', async ($, e, next) => ((await isWorkerSession($)) ? { value: { isPlaced: false, reason: WORKER_PANE_REFUSED } } : next(e))).catch(($, e, next) => (hookFailed($, 'ui.open', next.error), next(e)))

  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) => renderPane($, e))

  // A worker's screen shows its task list alone: the transcript rows, the lead's
  // messages and the spinner are drawn empty there, and only there. The stored
  // messages are not touched.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isWorker))) return next(e)
    live.isWorking = e.props.isWorking
    const data = { name: live.label ?? live.identity?.name ?? null, tasks: await read($, workerTasks), isWorking: isBandWorking(), bodyColumns: e.props.bodyColumns, maxRows: e.props.maxRows, spinnerFrame: live.spinnerFrame, shadeStep: live.shadeStep }
    return workerBand($.ui.resolve(e), data, await next(e))
  }).catch(($, e, next) => (hookFailed($, 'AbovePrompt', next.error), next(e)))
  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => hideForWorker($, e, next)).catch(($, e, next) => (hookFailed($, 'AssistantMessage', next.error), next(e)))
  on('ui.render', { component: 'ToolUse' }, ($, e, next) => hideForWorker($, e, next)).catch(($, e, next) => (hookFailed($, 'ToolUse', next.error), next(e)))
  on('ui.render', { component: 'ToolResult' }, ($, e, next) => hideForWorker($, e, next)).catch(($, e, next) => (hookFailed($, 'ToolResult', next.error), next(e)))
  on('ui.render', { component: 'ToolGroup' }, ($, e, next) => hideForWorker($, e, next)).catch(($, e, next) => (hookFailed($, 'ToolGroup', next.error), next(e)))
  on('ui.render', { component: 'UserMessage' }, ($, e, next) => hideForWorker($, e, next)).catch(($, e, next) => (hookFailed($, 'UserMessage', next.error), next(e)))
  on('ui.render', { component: 'Spinner' }, ($, e, next) => hideForWorker($, e, next)).catch(($, e, next) => (hookFailed($, 'Spinner', next.error), next(e)))
  on('ui.render', { component: 'TurnDuration' }, ($, e, next) => hideForWorker($, e, next)).catch(($, e, next) => (hookFailed($, 'TurnDuration', next.error), next(e)))
  on('ui.render', { component: 'ToolProgress' }, ($, e, next) => hideForWorker($, e, next)).catch(($, e, next) => (hookFailed($, 'ToolProgress', next.error), next(e)))
}

// ------------------------------------------------------------------ helpers

function report($: EngineInterface) {
  return (err: unknown) => $.ui.status(`fleet: ${String(err)}`)
}

// A failed hook still passes its event on, so the session never stalls on the
// fleet; the failure goes to the status line and the pane log.
function hookFailed($: EngineInterface, hook: string, error: HookFailure): void {
  const line = `${hook} hook failed (${error.kind}): ${error.message ?? 'no detail'}`
  $.ui.status(`fleet: ${line}`)
  // The pane log is state, which a render hook may not write: the line then
  // goes to the debug log instead, and the status line keeps the failure.
  void note($, line).catch((err: unknown) => $.ui.log(`fleet: ${line} (not logged to the pane: ${String(err)})`, { to: 'debug' }))
}

async function note($: EngineInterface, line: string): Promise<void> {
  await update($, log, l => pushLog(l, line))
}

async function loadPrefs($: EngineInterface): Promise<void> {
  const storedRelay = await $.store.get(STORE_RELAY)
  if (typeof storedRelay === 'boolean') await update($, relay, () => storedRelay)
  const storedMax = Number(await $.store.get(STORE_MAX_WORKERS))
  live.maxWorkers = Number.isInteger(storedMax) && storedMax > 0 ? storedMax : DEFAULT_MAX_WORKERS
}

async function setRelay($: EngineInterface, on: boolean): Promise<void> {
  await update($, relay, () => on)
  await $.store.set(STORE_RELAY, on)
}

async function openPane($: EngineInterface): Promise<string> {
  const opened = await $.ui.open({ id: PANE, title: PANE_TITLE })
  return opened.isPlaced ? 'Fleet pane opened.' : `Fleet pane waits for a wider terminal: ${opened.reason}`
}

function openPaneQuietly($: EngineInterface): void {
  void openPane($).catch(report($))
}

// ------------------------------------------------------------------ commands

// Every way in (the slash command, a plain request, the lead's tool) runs here.
async function runCommand($: EngineInterface, cmd: Command): Promise<string> {
  switch (cmd.kind) {
    case 'open':
      return openPane($)
    case 'help':
      return HELP
    case 'error':
      return cmd.message
    case 'natural':
      return runRequest($, cmd.text)
    case 'relay':
      await setRelay($, cmd.on)
      return `Worker messages are now ${cmd.on ? 'passed on to the lead model' : 'kept in the Fleet pane'}.`
    case 'spawn': {
      const outcomes = await spawnManualList($, cmd.names, cmd.agentType, cmd.model)
      openPaneQuietly($)
      return outcomes.map(o => o.text).join('\n')
    }
    case 'send':
      return sendTo($, cmd.name, cmd.text)
    case 'stop':
      return stopWorker($, cmd.name)
    case 'rename':
      return renameCommand($, cmd.name, cmd.label)
    case 'plan':
      return loadPlan($, cmd.task)
    case 'run':
      return startRun($, cmd.task, cmd.model)
  }
}

// A plain request: the interpreter's lines run one after the other. A line
// that reads as a request again, an error or help is shown and not run, so an
// answer can never loop back into the interpreter.
async function runRequest($: EngineInterface, text: string): Promise<string> {
  const reading = await interpret($, text)
  if ('error' in reading) return `Could not read "${text}": ${reading.error}`
  if ('reply' in reading) return reading.reply
  const results: string[] = []
  for (const line of reading.commands) results.push(await runInterpreted($, line))
  return results.join('\n')
}

async function interpret($: EngineInterface, text: string) {
  try {
    const prompt = interpreterPrompt(text, await read($, workers), live.maxWorkers)
    const answer = await $.model.complete({ model: FLEET_INTERPRETER_MODEL, system: FLEET_INTERPRETER_SYSTEM, prompt, maxTokens: FLEET_INTERPRETER_MAX_TOKENS })
    return answer.isAnswered ? parseInterpretation(answer.text) : { error: `the interpreter gave no answer (${answer.reason})` }
  } catch (err) {
    return { error: `the interpreter refused the request (${String(err)})` }
  }
}

async function runInterpreted($: EngineInterface, line: string): Promise<string> {
  const cmd = parseCommand(line)
  const header = `→ /fleet ${line}`
  if (cmd.kind === 'error') return `${header}: not run, ${cmd.message}`
  if (cmd.kind === 'natural' || cmd.kind === 'help') return `${header}: not run, not a fleet command`
  return `${header}\n${await runCommand($, cmd)}`
}

async function renameCommand($: EngineInterface, name: string, label: string): Promise<string> {
  let outcome: ReturnType<typeof renameWorker> = { error: `No live worker named ${name}.` }
  const renamed = await update($, workers, ws => {
    outcome = renameWorker(ws, name, label)
    return 'error' in outcome ? ws : outcome.workers
  })
  if ('error' in outcome) return outcome.error
  await $.store.set(`${STORE_LABELS_PREFIX}${await $.session.id()}`, labelMap(renamed))
  await note($, `${name} renamed ${label}`)
  return `${name} is now called ${label}.`
}

// Outside a worker: the lead model gets the fleet's own tool.
async function armLead($: EngineInterface): Promise<void> {
  await $.tool.register({ name: LEAD_COMMAND_TOOL_NAME, description: `${LEAD_COMMAND_TOOL_DESCRIPTION}\n${HELP}`, inputSchema: LEAD_COMMAND_TOOL_SCHEMA, isDeferred: false }).catch(report($))
}

type Roster = Awaited<ReturnType<EngineInterface['agent']['list']>>

// Merges the engine's roster into the workers, adopts teammates the state
// does not know yet (a reload after /clear, a team started elsewhere) and
// prunes the ended workers past their number or age. Runs on session.start
// and on every poll tick, so the pruning needs no user action; a roster that
// cannot be read is noted and the pruning still runs.
async function reconcile($: EngineInterface): Promise<void> {
  let roster: Roster | null = null
  try {
    roster = await $.agent.list()
  } catch (err) {
    await note($, `roster unavailable: ${String(err)}`)
  }
  const now = await $.clock.now()
  await update($, workers, ws => pruneEnded(roster ? mergeRoster(ws, roster, now) : ws, now, ENDED_WORKER_TTL_MS, MAX_ENDED_WORKERS))
  ensureTick($)
}

function mergeRoster(ws: readonly Worker[], roster: Roster, now: number): Worker[] {
  const merged = reduceRoster(ws, roster, now)
  const unknown = roster.filter(a => a.teammateId && !merged.some(w => w.agentId === a.id || w.teammateId === a.teammateId))
  return unknown.reduce((acc, a) => reduceSpawned(acc, { name: a.name ?? a.id, agentId: a.id, teammateId: a.teammateId, task: { source: 'manual', ref: a.name ?? a.id, title: taskTitle(a.description) }, now }), merged)
}

// Checks run one after another, so two calls never start two timers.
function ensureTick($: EngineInterface): void {
  live.tickCheck = live.tickCheck.then(() => syncTick($)).catch(report($))
}

async function syncTick($: EngineInterface): Promise<void> {
  const anyLive = (await read($, workers)).some(isLive)
  if (anyLive && !live.tick) {
    live.tick = $.clock.every(POLL_MS, () => void refresh($))
  } else if (!anyLive && live.tick) {
    live.tick.cancel()
    live.tick = null
  }
}

async function refresh($: EngineInterface): Promise<void> {
  await reconcile($)
  await drainQueue($)
  if (await read($, run)) await advanceRun($)
}

async function teamsReady($: EngineInterface): Promise<string | null> {
  const settings = await $.settings.read()
  const settingsEnv = (settings['env'] ?? {}) as Record<string, unknown>
  const flag = (await $.env.get('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS')) ?? settingsEnv['CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS']
  if (!isOn(flag)) {
    return 'Agent teams are off. Set CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (shell or settings.json "env") and restart Claude Code.'
  }
  const mode = settings['teammateMode']
  if (typeof mode !== 'string' || !TEAM_MODES_WITH_PANES.includes(mode)) {
    return `Workers would run in-process, not in panes: set "teammateMode": "tmux" (or "iterm2", "auto") in settings.json, run inside tmux, and restart. Current value: ${String(mode ?? 'unset')}.`
  }
  return null
}

function isOn(value: unknown): boolean {
  return value === true || value === '1' || value === 'true'
}

async function spawnWorker($: EngineInterface, req: SpawnRequest): Promise<SpawnOutcome> {
  const notReady = await teamsReady($)
  if (notReady) return { kind: 'refused', text: notReady }
  const current = await read($, workers)
  if (liveCount(current) >= live.maxWorkers) {
    await update($, queue, q => [...q, { ...req }])
    await note($, `${req.name} queued (${live.maxWorkers} workers live)`)
    return { kind: 'queued', name: req.name, text: `${req.name} queued: ${live.maxWorkers} workers are already live.` }
  }
  const name = uniqueName(req.name, current)
  const model = await chooseModel($, req)
  await recordWorker($, name)
  const started = await $.agent.spawn({ name, prompt: req.brief, description: req.title, subagentType: req.agentType, model })
  if (started.deny !== undefined) {
    await note($, `${name} refused: ${started.deny}`)
    return { kind: 'refused', text: `Could not start ${name}: ${started.deny}` }
  }
  const now = await $.clock.now()
  // The engine answers the agent id once the teammate started; until the
  // roster confirms it, the name stands in (TaskStop and SendMessage take it).
  await update($, workers, ws => reduceSpawned(ws, { name, agentId: started.agentId ?? name, teammateId: started.teammateId, task: req.task, now }))
  const warning = started.teammateId ? '' : ' (started as a plain subagent, not a pane teammate: check teammateMode)'
  await note($, `${name} started${warning}`)
  ensureTick($)
  return { kind: 'started', name, text: `${name} started on ${started.model}${warning}.` }
}

// The name is settled before the brief is written, so the worker is told the
// name it is addressed by. A manual worker has no task text to classify: its
// model is the one asked for, else the lead's.
async function spawnManual($: EngineInterface, base: string, agentType?: string, model?: string): Promise<SpawnOutcome> {
  const name = uniqueName(base, await read($, workers))
  return spawnWorker($, { name, brief: manualBrief(name, await workerInstructions($), agentType), title: `worker ${name}`, task: manualTask(name), agentType, model })
}

// One at a time: each spawn reads the workers the previous one recorded, so the
// names stay unique and the names past the limit are queued.
async function spawnManualList($: EngineInterface, bases: readonly string[], agentType?: string, model?: string): Promise<SpawnOutcome[]> {
  const outcomes: SpawnOutcome[] = []
  for (const base of bases) outcomes.push(await spawnManual($, base, agentType, model))
  return outcomes
}

// The model a worker starts on: the one asked for; else the tier the task text
// is classified into, read off the policy's table; else none, and the worker
// runs on its agent's model or the lead's.
async function chooseModel($: EngineInterface, req: SpawnRequest): Promise<string | undefined> {
  const tiers = await modelTiers($)
  if (req.model) return resolveModel(req.model, undefined, tiers)
  if (!req.complexityText) return undefined
  try {
    const label = await $.model.classify(req.complexityText, COMPLEXITY_TIERS)
    if (isComplexityTier(label)) return resolveModel(undefined, label, tiers)
    await note($, `${req.name}: complexity unclear (${label ?? 'no label'}), model inherited`)
  } catch (err) {
    await note($, `${req.name}: complexity not classified (${String(err)}), model inherited`)
  }
  return undefined
}

// Inside a worker: its task list tool is offered to the model, the reminder
// answers given before the guard settled are asked again, and the band's
// activity glyph starts turning.
async function armWorker($: EngineInterface): Promise<void> {
  await $.tool.register({ name: WORKER_TASKS_TOOL_NAME, description: WORKER_TASKS_TOOL_DESCRIPTION, inputSchema: WORKER_TASKS_TOOL_SCHEMA, isDeferred: false }).catch(report($))
  $.ui.invalidate('prompt.attachment')
  live.spinner ??= $.clock.every(WORKER_SPINNER_MS, () => spinBand($))
  live.backgroundPoll ??= $.clock.every(WORKER_BACKGROUND_POLL_MS, () => void pollWorkerState($))
}

// The band works while the turn runs or a background subagent of the worker does.
function isBandWorking(): boolean {
  return live.isWorking || live.hasBackgroundWork
}

// One read at a time: a slow roster or store never stacks reads behind it.
async function pollWorkerState($: EngineInterface): Promise<void> {
  if (live.isPollingBackground) return
  live.isPollingBackground = true
  try {
    live.hasBackgroundWork = hasBackgroundWork(await $.agent.list())
    const label = await readOwnLabel($)
    if (label !== live.label) {
      live.label = label
      $.ui.invalidate('ui.render')
    }
  } catch (err) {
    report($)(`worker state unread: ${String(err)}`)
  } finally {
    live.isPollingBackground = false
  }
}

// The label the lead gave this worker, from the lead's labels in the store.
async function readOwnLabel($: EngineInterface): Promise<string | null> {
  if (!live.identity) return null
  const labels = await $.store.get(`${STORE_LABELS_PREFIX}${live.identity.parentSessionId}`)
  if (!labels || typeof labels !== 'object' || Array.isArray(labels)) return null
  const label = (labels as Record<string, unknown>)[live.identity.name]
  return typeof label === 'string' ? label : null
}

function stopBackgroundPoll(): void {
  live.backgroundPoll?.cancel()
  live.backgroundPoll = null
}

// The timer lives as long as the worker: a render hook may not start or stop
// one, so the band only tells (through `live.isWorking`) whether a period
// advances the glyph and the frame's shade, or lets the shade fade back to idle
// and then passes.
function spinBand($: EngineInterface): void {
  if (isBandWorking()) {
    live.spinnerFrame += 1
    live.shadeStep = Math.min(live.shadeStep + 1, WORKER_SHADE_LAST_STEP)
  } else if (live.shadeStep > 0) {
    live.shadeStep -= 1
  } else {
    return
  }
  $.ui.invalidate('ui.render')
}

function stopSpinner(): void {
  live.spinner?.cancel()
  live.spinner = null
}

function modelTiers($: EngineInterface): Promise<ModelTiers> {
  live.modelTiers ??= readPolicy($).then(policy => policy?.modelTiers ?? DEFAULT_MODEL_TIERS)
  return live.modelTiers
}

// A queued run unit is already counted as running; once its worker starts
// (maybe under another name) or is refused, the run follows.
async function drainQueue($: EngineInterface): Promise<void> {
  const current = await read($, workers)
  if (liveCount(current) >= live.maxWorkers) return
  const { item, rest } = queueNext(await read($, queue))
  if (!item) return
  await update($, queue, () => rest)
  const outcome = await spawnWorker($, item)
  if (!item.unit) return
  if (outcome.kind === 'refused') {
    await update($, run, r => (r ? releaseUnit(r, item.name, outcome.text) : r))
    await note($, `run halted: ${outcome.text}`)
  } else if (outcome.name !== item.name) {
    await update($, run, r => (r ? rebindUnit(r, item.name, outcome.name) : r))
  }
}

async function sendTo($: EngineInterface, name: string, text: string): Promise<string> {
  const worker = findWorker(await read($, workers), name)
  const sent = await $.session.send({ to: worker ? { agentId: worker.agentId } : name, text })
  if (!sent.isDelivered) {
    await note($, `send to ${name} failed: ${sent.reason}`)
    return `Not delivered to ${name}: ${sent.reason}`
  }
  await note($, `→ ${name}: ${truncate(text, LOG_SENT_TEXT)}`)
  return `Sent to ${name}.`
}

async function stopWorker($: EngineInterface, name: string): Promise<string> {
  const worker = findWorker(await read($, workers), name)
  if (!worker) return `No worker named ${name}.`
  const stopped = await $.tool.call({ tool: 'TaskStop', task_id: worker.agentId })
  if (stopped.deny !== undefined || stopped.isError) {
    const reason = stopped.deny ?? stopped.text ?? 'TaskStop failed'
    await note($, `stop ${worker.name} failed: ${reason}`)
    return `Could not stop ${worker.name}: ${reason}`
  }
  const now = await $.clock.now()
  await update($, workers, ws => markDone(ws, worker.name, now, 'killed'))
  const current = await read($, run)
  const held = current?.units[worker.name]
  if (current && held?.length) await writeMarks($, current.task, held, 'pending')
  await update($, run, r => (r ? finishUnit(r, worker.name) : r))
  await note($, `${worker.name} stopped`)
  ensureTick($)
  return `${worker.name} stopped.`
}

async function onReport($: EngineInterface, from: string): Promise<void> {
  const current = await read($, run)
  if (!current || !(from in current.units)) return
  await writeMarks($, current.task, current.units[from] ?? [], 'completed')
  await update($, run, r => (r ? finishUnit(r, from) : r))
  const now = await $.clock.now()
  await update($, workers, ws => markDone(ws, from, now))
  await advanceRun($)
}

// ------------------------------------------------------------------ worker setup

// A project file overrides the plugin's default, so the team edits its own copy.
async function readOverridable($: EngineInterface, projectPath: string, pluginPath: string): Promise<string> {
  const own = `${await $.session.root()}/${projectPath}`
  return $.fs.read((await $.fs.exists(own)) ? own : `${$.plugin.root}/${pluginPath}`)
}

async function workerInstructions($: EngineInterface): Promise<string> {
  try {
    return await readOverridable($, PROJECT_INSTRUCTIONS_PATH, DEFAULT_INSTRUCTIONS_PATH)
  } catch (err) {
    await note($, `worker instructions unreadable: ${String(err)}`)
    return ''
  }
}

// Recorded before the spawn, so the worker finds itself on its first tool call.
async function recordWorker($: EngineInterface, name: string): Promise<void> {
  const key = `${STORE_WORKERS_PREFIX}${await $.session.id()}`
  const known = await $.store.get(key)
  const names = Array.isArray(known) ? known.filter((n): n is string => typeof n === 'string') : []
  if (!names.includes(name)) await $.store.set(key, [...names, name])
}

// The promise is settled once and never rejects: every hook of a worker awaits
// it, and a guard that failed to resolve reports the reason and stands aside.
function workerPolicy($: EngineInterface): Promise<WorkerPolicy | null> {
  live.workerPolicy ??= resolveWorkerPolicy($).catch((err: unknown) => {
    $.ui.status(`fleet: worker guard not resolved: ${String(err)}`)
    $.ui.log(`fleet: worker guard not resolved: ${String(err)}`, { to: 'debug' })
    return null
  })
  return live.workerPolicy
}

async function resolveWorkerPolicy($: EngineInterface): Promise<WorkerPolicy | null> {
  const ran = await $.process.run(['sh', '-c', ANCESTRY_SCRIPT])
  const identity = teammateIdentity(ran.stdout)
  if (!identity) return null
  const names = await $.store.get(`${STORE_WORKERS_PREFIX}${identity.parentSessionId}`)
  if (!Array.isArray(names) || !names.includes(identity.name)) return null
  live.identity = identity
  return loadPolicy($)
}

// A worker whose policy cannot be read reaches no MCP server and runs no git
// command, rather than running unguarded.
async function loadPolicy($: EngineInterface): Promise<WorkerPolicy> {
  const policy = await readPolicy($)
  if (policy) return policy
  $.ui.status('fleet: worker policy unreadable, running with the strict fallback')
  return { allowedMcpServers: [], deniedCommands: ['git'], modelTiers: DEFAULT_MODEL_TIERS }
}

// The policy file as written, or null (noted) when it is missing or malformed.
async function readPolicy($: EngineInterface): Promise<WorkerPolicy | null> {
  try {
    const parsed = parsePolicy(await readOverridable($, PROJECT_POLICY_PATH, DEFAULT_POLICY_PATH))
    if (!('error' in parsed)) return parsed
    await note($, `worker policy invalid: ${parsed.error}`)
  } catch (err) {
    await note($, `worker policy unreadable: ${String(err)}`)
  }
  return null
}

// ------------------------------------------------------------------ worker screen

// Runs after the tool answered, so a failure here never repeats the call: it
// goes to the status line and the list stays as it was.
async function trackTasks($: EngineInterface, tool: string, input: Record<string, unknown>, result: unknown): Promise<void> {
  try {
    const current = await read($, workerTasks)
    const tracked = reduceTaskCall(current, tool, input, result)
    if (JSON.stringify(tracked) !== JSON.stringify(current)) await update($, workerTasks, () => tracked)
  } catch (err) {
    report($)(`task list not updated: ${String(err)}`)
  }
}

async function hideForWorker<C extends HiddenSite>($: EngineInterface, e: RenderInput<C>, next: (e: RenderInput<C>) => Promise<RenderElement>): Promise<RenderElement> {
  return (await read($, isWorker)) ? hiddenRow($.ui.resolve(e)) : next(e)
}

// The verdict for a hook that may run inside a draw (another plugin's
// `$.ui.open` from its render hook): the atom once settled, else the guard
// session.start primed. Before that nothing is known and the event goes on:
// a draw may not make the guard's calls, and a wait could outlast the hook.
async function isWorkerSession($: EngineInterface): Promise<boolean> {
  const verdict = await read($, isWorker)
  if (verdict !== null) return verdict
  return live.workerPolicy ? (await live.workerPolicy) !== null : false
}

// ------------------------------------------------------------------ task plans

type LoadedPlan = { items: TaskItem[]; text: string } | { error: string }

// The plan file as it stands on disk: the person may edit it between ticks,
// so every dispatch reads it again rather than trusting the state.
async function readPlan($: EngineInterface, task: string): Promise<LoadedPlan> {
  const path = taskFilePath(await $.session.root(), task)
  if (!(await $.fs.exists(path))) return { error: `no plan file at ${TASKS_DIR}/${task}.md (write one with the fleet task-plan skill)` }
  let text: string
  try {
    text = await $.fs.read(path)
  } catch (err) {
    return { error: String(err) }
  }
  const plan = parseTaskFile(text)
  if (plan.errors.length) return { error: plan.errors.join('; ') }
  if (!plan.items.length) return { error: 'the plan lists no items (`- [ ] T1: ...` lines)' }
  return { items: plan.items, text }
}

// Changes the marks of `ids` in the plan file and in the state; a file that
// cannot be read or written is noted, and the state still follows.
async function writeMarks($: EngineInterface, task: string, ids: readonly string[], status: TaskStatus): Promise<void> {
  if (!ids.length) return
  try {
    const path = taskFilePath(await $.session.root(), task)
    const text = await $.fs.read(path)
    await $.fs.write(path, ids.reduce((acc, id) => setMark(acc, id, status), text))
  } catch (err) {
    await note($, `plan ${task} not written (${String(err)})`)
  }
  await update($, taskItems, items => withStatus(items, ids, status))
}

async function listPlans($: EngineInterface): Promise<string> {
  const dir = `${await $.session.root()}/${TASKS_DIR}`
  if (!(await $.fs.exists(dir))) return `No task plans: ${TASKS_DIR}/ does not exist. Write one with the fleet task-plan skill.`
  const names = (await $.fs.list(dir)).filter(e => e.kind === 'file' && isTaskFile(e.name)).map(e => taskNameOf(e.name))
  if (!names.length) return `No task plans in ${TASKS_DIR}/. Write one with the fleet task-plan skill.`
  return `Task plans: ${names.join(', ')}. Run /fleet plan <name> to list one.`
}

async function loadPlan($: EngineInterface, task?: string): Promise<string> {
  if (!task) return listPlans($)
  const loaded = await readPlan($, task)
  if ('error' in loaded) return `Could not read plan ${task}: ${loaded.error}`
  await update($, taskItems, () => loaded.items)
  await update($, view, (v: FleetView): FleetView => ({ ...v, tab: 'tasks', taskName: task }))
  openPaneQuietly($)
  const open = loaded.items.filter(i => i.status === 'pending' || i.status === 'in_progress').length
  return `${task}: ${loaded.items.length} item(s), ${open} open. Press g in the Fleet pane or run /fleet run ${task}.`
}

async function startRun($: EngineInterface, task: string, model?: string): Promise<string> {
  const loaded = await loadPlan($, task)
  if (!(await read($, taskItems)).length) return loaded
  if (await read($, run)) return `A run is already going; stop its workers or wait for it to end before starting ${task}.`
  await update($, run, () => ({ task, model, units: {}, running: [], finished: [] }))
  await note($, `run ${task} started`)
  const halted = await advanceRun($)
  if (halted) return `Run ${task} stopped: ${halted}`
  const current = await read($, run)
  return current ? `Run ${task}: ${current.running.length} item(s) dispatched to ${Object.keys(current.units).length} worker(s).` : `Run ${task}: nothing to dispatch.`
}

// Answers the halt reason when this call ended a halted run.
async function advanceRun($: EngineInterface): Promise<string | null> {
  if (live.isAdvancing) return null
  live.isAdvancing = true
  try {
    const current = await read($, run)
    if (!current) return null
    if (current.halted) return endIfHalted($)
    const loaded = await readPlan($, current.task)
    if ('error' in loaded) {
      await note($, `plan ${current.task}: ${loaded.error}`)
      return null
    }
    await update($, taskItems, () => loaded.items)
    const plan = readyUnits(loaded.items, current.running)
    if (plan.done) {
      await note($, `run ${current.task} complete`)
      $.ui.toast(`Fleet: run ${current.task} complete`)
      await update($, run, () => null)
      return null
    }
    if (!plan.units.length && !current.running.length) {
      const reason = plan.waiting.length ? `${plan.waiting.join(', ')} wait on items that are not done` : 'no item is ready'
      await update($, run, r => (r ? { ...r, halted: r.halted ?? reason } : r))
      return endIfHalted($)
    }
    const room = live.maxWorkers - liveCount(await read($, workers))
    for (const unit of pickUnits(plan.units, room)) {
      const unitItems = loaded.items.filter(i => unit.tasks.includes(i.id))
      const name = unitWorkerName(unit)
      const title = `${current.task} ${unit.tasks.join(',')}`
      // An item with an agent keeps the agent's own model; one without is classified here.
      const complexityText = unit.agent ? undefined : classificationText(unitItems.map(i => i.description))
      const outcome = await spawnWorker($, { name, brief: planBrief(current.task, unitItems, unit.agent, await workerInstructions($)), title, task: { source: 'task', ref: unit.tasks.join(','), title }, agentType: unit.agent ?? undefined, unit: unit.tasks, model: current.model, complexityText })
      if (outcome.kind === 'refused') {
        await update($, run, r => (r ? { ...r, halted: r.halted ?? outcome.text } : r))
        await note($, `run halted: ${outcome.text}`)
        return endIfHalted($)
      }
      await update($, run, r => (r ? startUnit(r, outcome.name, unit.tasks) : r))
      await writeMarks($, current.task, unit.tasks, 'in_progress')
    }
    return null
  } finally {
    live.isAdvancing = false
  }
}

// A halted run dispatches nothing more and ends once no unit is running.
async function endIfHalted($: EngineInterface): Promise<string | null> {
  const current = await read($, run)
  if (!current?.halted || current.running.length > 0) return null
  await note($, `run ${current.task} stopped: ${current.halted}`)
  $.ui.toast(`Fleet: run ${current.task} stopped`)
  await update($, run, () => null)
  return current.halted
}

// ------------------------------------------------------------------ drawing

async function renderPane($: EngineInterface, e: RenderInput<'Pane'>) {
  const [ws, v, lines, pass, current, items, now] = await Promise.all([read($, workers), read($, view), read($, log), read($, relay), read($, run), read($, taskItems), $.clock.now()])
  const data = { workers: ws, view: v, log: lines, relay: pass, run: current, taskItems: items, maxWorkers: live.maxWorkers, bodyColumns: e.props.bodyColumns, now }
  return paneTree($.ui.resolve(e), data, {
    patchView: patch => void update($, view, (cur: FleetView): FleetView => ({ ...cur, ...patch })),
    spawnNew: () => void spawnManual($, NEW_WORKER_BASE),
    send: (name, text) => void sendTo($, name, text),
    stop: name => void stopWorker($, name),
    setRelay: on => void setRelay($, on),
    startRun: task => void startRun($, task),
    close: () => void $.ui.close({ id: PANE }),
  })
}
