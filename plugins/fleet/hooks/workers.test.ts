import { expect, test } from 'claude-code/testing'

import type { Worker } from '../types'
import { DEFAULT_MAX_WORKERS, IDLE_NOTIFICATION, STALE_MS, displayName, findWorker, hasBackgroundWork, labelMap, markDone, renameWorker, markIdle, pruneEnded, queueNext, reduceMessage, reduceRoster, reduceSpawned, teammateEvent, uniqueName, visibleWorkers } from './workers'

const worker = (name: string, extra: Partial<Worker> = {}): Worker => ({
  name,
  agentId: `id-${name}`,
  teammateId: `${name}@team`,
  status: 'running',
  startedAt: 0,
  lastSeenAt: 0,
  isDone: false,
  ...extra,
})

test('names stay unique', () => {
  expect(uniqueName('w1', [worker('w1'), worker('w1-2')])).toBe('w1-3')
  expect(DEFAULT_MAX_WORKERS).toBe(4)
})

test('a spawn adds a worker once and a later spawn with the same id only enriches it', () => {
  let ws = reduceSpawned([], { name: 'w1', agentId: 'a1', now: 5 })
  ws = reduceSpawned(ws, { name: 'w1', agentId: 'a1', teammateId: 'w1@t', now: 9 })
  expect(ws.length).toBe(1)
  expect(ws[0]).toMatchObject({ name: 'w1', agentId: 'a1', teammateId: 'w1@t', status: 'running', startedAt: 5, isDone: false })
})

test('the roster closes ended workers and marks a quiet running one stale', () => {
  const ws = [worker('w1'), worker('w2'), worker('w3', { lastSeenAt: 1_000_000 })]
  const roster = [
    { id: 'id-w1', teammateId: 'w1@team', description: '', type: 'teammate', status: 'completed' as const },
    { id: 'id-w2', teammateId: 'w2@team', description: '', type: 'teammate', status: 'running' as const },
    { id: 'id-w3', teammateId: 'w3@team', description: '', type: 'teammate', status: 'running' as const, name: 'w3-renamed' },
  ]
  const now = 1_000_000 + STALE_MS - 1
  const next = reduceRoster(ws, roster, now)
  // The time a worker ended is kept in lastSeenAt, which orders and prunes it later.
  expect(next[0]).toMatchObject({ status: 'completed', isDone: true, lastSeenAt: now })
  expect(next[1]).toMatchObject({ status: 'stale', isDone: false })
  expect(next[2]).toMatchObject({ status: 'running', name: 'w3-renamed' })
  const provisional = reduceRoster([worker('w4', { agentId: 'w4', teammateId: undefined })], [{ id: 'real-4', name: 'w4', description: '', type: 'teammate', status: 'idle' as const }], 0)
  expect(provisional[0]).toMatchObject({ agentId: 'real-4', status: 'idle' })
})

test('a message updates the sender alone', () => {
  const ws = reduceMessage([worker('w1'), worker('w2')], 'w2', 'DONE T2 all green '.repeat(40), 77)
  expect(ws[0]?.lastText).toBeUndefined()
  expect(ws[1]?.lastSeenAt).toBe(77)
  expect(ws[1]?.lastText?.length).toBe(400)
})

test('a worker goes idle when addressed by name or by teammate id, unless it is done', () => {
  const byName = markIdle([worker('w1'), worker('w2')], 'w1', 42)
  expect(byName[0]).toMatchObject({ status: 'idle', lastSeenAt: 42 })
  expect(byName[1]?.status).toBe('running')
  const byTeammate = markIdle([worker('w1'), worker('w2')], 'w2@team', 43)
  expect(byTeammate[0]?.status).toBe('running')
  expect(byTeammate[1]).toMatchObject({ status: 'idle', lastSeenAt: 43 })
  expect(markIdle([worker('w1', { status: 'completed', isDone: true })], 'w1@team', 44)[0]?.status).toBe('completed')
})

test('a worker marked done keeps the time it ended, and a roster that ends an already ended worker leaves that time alone', () => {
  const done = markDone([worker('w1'), worker('w2')], 'w1', 50, 'killed')
  expect(done[0]).toMatchObject({ status: 'killed', isDone: true, lastSeenAt: 50 })
  expect(done[1]).toMatchObject({ status: 'running', isDone: false, lastSeenAt: 0 })
  const again = reduceRoster(done, [{ id: 'id-w1', teammateId: 'w1@team', description: '', type: 'teammate', status: 'completed' as const }], 90)
  expect(again[0]).toMatchObject({ status: 'completed', isDone: true, lastSeenAt: 50 })
})

const ended = (name: string, endedAt: number): Worker => worker(name, { status: 'completed', isDone: true, lastSeenAt: endedAt })

test('the pane rows put the live workers first, then the ended ones newest first, within the limit', () => {
  const ws = [ended('e1', 10), worker('live-a'), ended('e2', 30), ended('e3', 20), worker('live-b')]
  expect(visibleWorkers(ws, 9).map(w => w.name)).toEqual(['live-a', 'live-b', 'e2', 'e3', 'e1'])
  expect(visibleWorkers(ws, 3).map(w => w.name)).toEqual(['live-a', 'live-b', 'e2'])
  expect(visibleWorkers([], 9)).toEqual([])
})

test('pruning keeps every live worker and only the newest ended ones that ended within the ttl', () => {
  const ws = [ended('e1', 10), worker('live-a'), ended('e2', 30), ended('e3', 20), ended('e4', 40), worker('live-b', { lastSeenAt: 0 })]
  expect(pruneEnded(ws, 100, 1000, 2).map(w => w.name)).toEqual(['live-a', 'e2', 'e4', 'live-b'])
  // e1 ended 90 ago and is out of the ttl; the others are within it and under the cap.
  expect(pruneEnded(ws, 100, 85, 9).map(w => w.name)).toEqual(['live-a', 'e2', 'e3', 'e4', 'live-b'])
  expect(pruneEnded(ws, 100, 1000, 0).map(w => w.name)).toEqual(['live-a', 'live-b'])
  expect(pruneEnded(ws, 100, 1000, 9)).toEqual(ws)
})

test('the queue hands out its first item and keeps the rest', () => {
  const a = { name: 'a', brief: 'A', title: 'a', task: { source: 'manual' as const, ref: 'a', title: 'a' } }
  const b = { ...a, name: 'b' }
  expect(queueNext([a, b])).toEqual({ item: a, rest: [b] })
  expect(queueNext([])).toEqual({ item: undefined, rest: [] })
})

test('an engine notice is told from a worker message by its JSON type', () => {
  expect(teammateEvent('{"type":"idle_notification","from":"w3","idleReason":"available"}')).toEqual({ type: IDLE_NOTIFICATION })
  expect(teammateEvent('  {"type":"shutdown_approved"} ')).toEqual({ type: 'shutdown_approved' })
  expect(teammateEvent('DONE all tests pass')).toBeNull()
  expect(teammateEvent('{"from":"w3"}')).toBeNull()
  expect(teammateEvent('{not json')).toBeNull()
})

test('a worker has background work while one of its own subagents is pending, running or waiting', () => {
  const agent = (status: 'pending' | 'running' | 'waiting' | 'idle' | 'completed', teammateId?: string) => ({ id: `a-${status}`, description: '', type: 'general-purpose', status, teammateId })
  expect(hasBackgroundWork([])).toBe(false)
  expect(hasBackgroundWork([agent('running')])).toBe(true)
  expect(hasBackgroundWork([agent('pending')])).toBe(true)
  expect(hasBackgroundWork([agent('waiting')])).toBe(true)
  expect(hasBackgroundWork([agent('completed'), agent('idle')])).toBe(false)
  expect(hasBackgroundWork([agent('running', 'w2@team')])).toBe(false)
})

test('a rename labels a live worker, is found by either name, and refuses a taken name or an unknown worker', () => {
  const ws = [worker('w1'), worker('w2'), worker('w3', { isDone: true })]
  const renamed = renameWorker(ws, 'w1', 'docs')
  if (!('workers' in renamed)) throw new Error(renamed.error)
  expect(displayName(renamed.workers[0]!)).toBe('docs')
  expect(findWorker(renamed.workers, 'docs')?.name).toBe('w1')
  expect(labelMap(renamed.workers)).toEqual({ w1: 'docs' })
  expect(uniqueName('docs', renamed.workers)).toBe('docs-2')
  expect(renameWorker(renamed.workers, 'w2', 'docs')).toEqual({ error: 'Another worker is already called docs.' })
  expect(renameWorker(renamed.workers, 'w2', 'w1')).toEqual({ error: 'Another worker is already called w1.' })
  expect(renameWorker(ws, 'ghost', 'x')).toEqual({ error: 'No live worker named ghost.' })
  expect(renameWorker(ws, 'w3', 'x')).toEqual({ error: 'No live worker named w3.' })
  const back = renameWorker(renamed.workers, 'docs', 'w1')
  if (!('workers' in back)) throw new Error(back.error)
  expect(back.workers[0]).not.toHaveProperty('label')
  expect(labelMap(back.workers)).toEqual({})
})
