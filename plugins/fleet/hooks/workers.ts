import type { AgentInfo, AgentStatus } from 'claude-code'

import type { QueueItem, Worker, WorkerStatus, WorkerTask } from '../types'
import { truncate } from './format'

export const STALE_MS = 10 * 60 * 1000
export const DEFAULT_MAX_WORKERS = 4
// The `type` of the JSON notice the engine sends the lead when a teammate goes idle.
export const IDLE_NOTIFICATION = 'idle_notification'
const ENDED: readonly WorkerStatus[] = ['completed', 'failed', 'killed']
const AT_WORK: readonly AgentStatus[] = ['pending', 'running', 'waiting']

// True while one of a worker's own subagents is still at work: a worker whose
// turn ended to wait on a background agent has not finished. Teammates in the
// roster are other sessions, not the worker's work.
export function hasBackgroundWork(agents: readonly AgentInfo[]): boolean {
  return agents.some(a => a.teammateId === undefined && AT_WORK.includes(a.status))
}

// A teammate message that is one of the engine's own JSON notices, by its
// `type`; null for a worker's own words.
export function teammateEvent(text: string): { type: string } | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    const type = (parsed as { type?: unknown } | null)?.type
    return typeof type === 'string' ? { type } : null
  } catch {
    return null
  }
}

export function isLive(worker: Worker): boolean {
  return !worker.isDone
}

export function liveCount(workers: readonly Worker[]): number {
  return workers.filter(isLive).length
}

function newestFirst(a: Worker, b: Worker): number {
  return b.lastSeenAt - a.lastSeenAt
}

// The rows the pane draws: the live workers in state order, then the ended
// ones newest first, cut to `limit` so a long tail of ended workers never
// hides a live one.
export function visibleWorkers(workers: readonly Worker[], limit: number): Worker[] {
  const ended = workers.filter(w => w.isDone).sort(newestFirst)
  return [...workers.filter(isLive), ...ended].slice(0, limit)
}

// Keeps every live worker and, of the ended ones, the `keep` newest that ended
// within `ttlMs` of `now`; state order is preserved. An ended worker's
// `lastSeenAt` is the time it ended.
export function pruneEnded(workers: readonly Worker[], now: number, ttlMs: number, keep: number): Worker[] {
  const kept = new Set(
    workers
      .filter(w => w.isDone && now - w.lastSeenAt <= ttlMs)
      .sort(newestFirst)
      .slice(0, keep),
  )
  return workers.filter(w => isLive(w) || kept.has(w))
}

export function findWorker(workers: readonly Worker[], name: string): Worker | undefined {
  return workers.find(w => w.name === name) ?? workers.find(w => w.label === name) ?? workers.find(w => w.agentId === name || w.teammateId === name)
}

// What the person sees a worker called: its fleet label, else its name.
export function displayName(worker: Worker): string {
  return worker.label ?? worker.name
}

// Gives a live worker a fleet label; renaming it back to its own name drops
// the label. A label may not be another worker's name or label.
export function renameWorker(workers: readonly Worker[], name: string, label: string): { workers: Worker[] } | { error: string } {
  const worker = findWorker(workers, name)
  if (!worker || worker.isDone) return { error: `No live worker named ${name}.` }
  if (workers.some(w => w !== worker && (w.name === label || w.label === label))) return { error: `Another worker is already called ${label}.` }
  return { workers: workers.map(w => (w === worker ? withLabel(w, label === w.name ? undefined : label) : w)) }
}

function withLabel(worker: Worker, label: string | undefined): Worker {
  const { label: _previous, ...rest } = worker
  return label === undefined ? rest : { ...rest, label }
}

// The labels of the live workers, keyed by name, as each worker reads its own.
export function labelMap(workers: readonly Worker[]): Record<string, string> {
  return Object.fromEntries(workers.filter(w => !w.isDone && w.label !== undefined).map(w => [w.name, w.label!]))
}

export function uniqueName(base: string, workers: readonly Worker[]): string {
  const taken = new Set(workers.flatMap(w => (w.label ? [w.name, w.label] : [w.name])))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

export type Spawned = { name: string; agentId: string; teammateId?: string; task?: WorkerTask; now: number }

export function reduceSpawned(workers: readonly Worker[], s: Spawned): Worker[] {
  const existing = workers.find(w => w.agentId === s.agentId)
  if (existing) {
    return workers.map(w => (w.agentId === s.agentId ? { ...w, teammateId: s.teammateId ?? w.teammateId, task: s.task ?? w.task } : w))
  }
  const worker: Worker = {
    name: s.name,
    agentId: s.agentId,
    teammateId: s.teammateId,
    status: 'running',
    task: s.task,
    startedAt: s.now,
    lastSeenAt: s.now,
    isDone: false,
  }
  return [...workers, worker]
}

// Merges the engine's roster into the workers: a status the roster gives
// wins, an ended status closes the worker (stamping `lastSeenAt` with the
// time it ended), and a worker `running` without any sign of life for
// STALE_MS is marked `stale` (a closed pane leaves its last word standing in
// the roster). A worker recorded with a provisional id (its name, when the
// spawn answered none) takes the roster's id.
export function reduceRoster(workers: readonly Worker[], roster: readonly AgentInfo[], now: number): Worker[] {
  return workers.map(w => {
    const info = roster.find(a => a.id === w.agentId || (w.teammateId !== undefined && a.teammateId === w.teammateId) || a.name === w.name)
    if (!info) return w
    const status: WorkerStatus = info.status
    const isDone = ENDED.includes(status)
    const name = info.name ?? w.name
    const identity = { name, agentId: info.id, teammateId: info.teammateId ?? w.teammateId }
    const quiet = now - w.lastSeenAt > STALE_MS
    if (!isDone && status === 'running' && quiet) return { ...w, ...identity, status: 'stale' }
    if (isDone && !w.isDone) return { ...w, ...identity, status, isDone: true, lastSeenAt: now }
    return { ...w, ...identity, status, isDone: w.isDone || isDone }
  })
}

function isSender(worker: Worker, from: string): boolean {
  return worker.name === from || worker.teammateId === from
}

export function reduceMessage(workers: readonly Worker[], from: string, text: string, now: number): Worker[] {
  return workers.map(w => (isSender(w, from) ? { ...w, lastText: truncate(text), lastSeenAt: now } : w))
}

export function markIdle(workers: readonly Worker[], from: string, now: number): Worker[] {
  return workers.map(w => (isSender(w, from) && !w.isDone ? { ...w, status: 'idle', lastSeenAt: now } : w))
}

// `now` is kept as the time the worker ended, which orders and prunes it later.
export function markDone(workers: readonly Worker[], name: string, now: number, status: WorkerStatus = 'completed'): Worker[] {
  return workers.map(w => (w.name === name ? { ...w, status, isDone: true, lastSeenAt: now } : w))
}

export function queueNext(queue: readonly QueueItem[]): { item?: QueueItem; rest: QueueItem[] } {
  const [item, ...rest] = queue
  return { item, rest }
}
