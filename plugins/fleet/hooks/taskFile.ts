// A task plan: the Markdown checklist in `.claude/fleet/tasks/<name>.md`, read
// into items, planned into the units ready to dispatch, and written back one
// mark at a time. Nothing here touches `$`.
import type { TaskItem, TaskStatus } from '../types'
import { TASK_AGENT_TAG, TASK_FILE_EXT, TASK_LINE, TASK_MARK_OF, TASK_MARKS, TASK_NEEDS_TAG, TASK_TITLE_LINE, TASKS_DIR } from './constants'

export type TaskPlan = { title: string | null; items: TaskItem[]; errors: string[] }

export type PlanUnit = { id: string; agent: string | null; tasks: string[] }

export type ReadyPlan = { units: PlanUnit[]; done: boolean; waiting: string[] }

const SETTLED: readonly TaskStatus[] = ['completed', 'cancelled']
const OPEN: readonly TaskStatus[] = ['pending', 'in_progress']
const NEEDS_SEPARATOR = /\s*,\s*/

export function taskFilePath(root: string, name: string): string {
  return `${root}/${TASKS_DIR}/${name}${TASK_FILE_EXT}`
}

export function isTaskFile(fileName: string): boolean {
  return fileName.endsWith(TASK_FILE_EXT) && fileName.length > TASK_FILE_EXT.length
}

export function taskNameOf(fileName: string): string {
  return fileName.slice(0, -TASK_FILE_EXT.length)
}

// Every checklist line with an id becomes an item; any other line is kept out.
// A repeated id or a `needs:` naming an unknown id is an error, and the plan
// is still answered, so the pane can show what was read.
export function parseTaskFile(text: string): TaskPlan {
  const items: TaskItem[] = []
  const errors: string[] = []
  for (const line of text.split('\n')) {
    const item = parseLine(line)
    if (!item) continue
    if (items.some(i => i.id === item.id)) errors.push(`${item.id} is listed twice`)
    else items.push(item)
  }
  const ids = new Set(items.map(i => i.id))
  for (const item of items) {
    for (const need of item.needs) if (!ids.has(need)) errors.push(`${item.id} needs ${need}, which is not in the plan`)
    if (item.needs.includes(item.id)) errors.push(`${item.id} needs itself`)
  }
  return { title: TASK_TITLE_LINE.exec(text)?.[1] ?? null, items, errors }
}

function parseLine(line: string): TaskItem | null {
  const match = TASK_LINE.exec(line)
  if (!match) return null
  const [, , mark, , id, rest] = match
  const status = TASK_MARKS[mark as keyof typeof TASK_MARKS]
  const agent = TASK_AGENT_TAG.exec(rest!)?.[1] ?? null
  const needs = TASK_NEEDS_TAG.exec(rest!)?.[1]?.split(NEEDS_SEPARATOR).filter(Boolean) ?? []
  const description = rest!.replace(TASK_AGENT_TAG, ' ').replace(TASK_NEEDS_TAG, ' ').replace(/\s+/g, ' ').trim()
  return { id: id!, description, status, agent, needs }
}

// The text with the mark of `id`'s line replaced; unchanged when no line has the id.
export function setMark(text: string, id: string, status: TaskStatus): string {
  return text
    .split('\n')
    .map(line => {
      const match = TASK_LINE.exec(line)
      return match && match[4] === id ? `${match[1]}${TASK_MARK_OF[status]}${match[3]}${id}${line.slice(match[1]!.length + 1 + match[3]!.length + id.length)}` : line
    })
    .join('\n')
}

export function withStatus(items: readonly TaskItem[], ids: readonly string[], status: TaskStatus): TaskItem[] {
  return items.map(i => (ids.includes(i.id) ? { ...i, status } : i))
}

// The pending items whose needs are all settled, one unit each, in file order;
// `running` names the ids already given to a worker, so a unit is never
// dispatched twice. `done` once no item is pending or in progress.
export function readyUnits(items: readonly TaskItem[], running: readonly string[]): ReadyPlan {
  const settled = new Set(items.filter(i => SETTLED.includes(i.status)).map(i => i.id))
  const pending = items.filter(i => i.status === 'pending' && !running.includes(i.id))
  const ready = pending.filter(i => i.needs.every(n => settled.has(n)))
  return {
    units: ready.map(i => ({ id: i.id, agent: i.agent, tasks: [i.id] })),
    done: !items.some(i => OPEN.includes(i.status)) && running.length === 0,
    waiting: pending.filter(i => !ready.includes(i)).map(i => i.id),
  }
}
