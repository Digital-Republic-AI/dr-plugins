// A plain request after /fleet, read by a model into fleet commands. Nothing here touches `$`.
import type { Worker } from '../types'
import { HELP } from './commands'
import { ERROR_TEXT } from './constants'
import { truncate } from './format'

export type Interpretation = { commands: string[] } | { reply: string } | { error: string }

const FLEET_PREFIX = /^\/?fleet\s+/

// The commands' syntax, the live workers (so "the payment one" can be told
// apart) and the request itself.
export function interpreterPrompt(text: string, workers: readonly Worker[], maxWorkers: number): string {
  const live = workers.filter(w => !w.isDone).map(workerLine)
  return [`Commands:\n${HELP}`, `Live workers, at most ${maxWorkers} at once:\n${live.length > 0 ? live.join('\n') : '- none'}`, `Request:\n${text}`].join('\n\n')
}

function workerLine(w: Worker): string {
  const label = w.label ? ` (renamed ${w.label})` : ''
  const task = w.task ? `, on ${w.task.title}` : ''
  return `- ${w.name}${label}: ${w.status}${task}`
}

// The model's answer: command lines to run, a reply to show, or why it is neither.
export function parseInterpretation(answer: string): Interpretation {
  const json = jsonObject(answer)
  if (!json) return { error: `no JSON in the answer: ${truncate(answer, ERROR_TEXT)}` }
  const commands = json['commands']
  if (Array.isArray(commands)) {
    const lines = commands.filter((c): c is string => typeof c === 'string').map(c => c.trim().replace(FLEET_PREFIX, '')).filter(Boolean)
    if (lines.length > 0) return { commands: lines }
  }
  const reply = json['reply']
  if (typeof reply === 'string' && reply.trim()) return { reply: reply.trim() }
  return { error: `neither commands nor a reply in the answer: ${truncate(answer, ERROR_TEXT)}` }
}

// The outermost {...} of the text, so a stray code fence or sentence around it does no harm.
function jsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) return null
  try {
    const value: unknown = JSON.parse(text.slice(start, end + 1))
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}
