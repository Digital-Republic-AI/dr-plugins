import type { WorkerStatus } from '../types'

export const MAX_TEXT = 400
export const MAX_LOG = 60
const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60

export function truncate(text: string, max = MAX_TEXT): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`
}

export function pushLog(log: readonly string[], line: string): string[] {
  return [...log, line].slice(-MAX_LOG)
}

export function statusGlyph(status: WorkerStatus): string {
  switch (status) {
    case 'running':
      return '●'
    case 'idle':
      return '○'
    case 'waiting':
      return '◐'
    case 'pending':
      return '◌'
    case 'stale':
      return '?'
    case 'completed':
      return '✓'
    case 'failed':
      return '✗'
    case 'killed':
      return '■'
    default:
      return '·'
  }
}

export function elapsed(from: number, now: number): string {
  const s = Math.max(0, Math.round((now - from) / MS_PER_SECOND))
  if (s < SECONDS_PER_MINUTE) return `${s}s`
  const m = Math.floor(s / SECONDS_PER_MINUTE)
  if (m < MINUTES_PER_HOUR) return `${m}m`
  return `${Math.floor(m / MINUTES_PER_HOUR)}h${String(m % MINUTES_PER_HOUR).padStart(2, '0')}`
}

export function fit(text: string, width: number): string {
  if (width <= 1) return text.slice(0, Math.max(0, width))
  return text.length <= width ? text : `${text.slice(0, width - 1)}…`
}
