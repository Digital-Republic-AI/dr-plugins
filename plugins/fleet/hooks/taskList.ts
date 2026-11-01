import type { WorkerTaskItem, WorkerTaskStatus } from '../types'
import { WORKER_TASKS_TOOL } from './constants'

export type { WorkerTaskItem, WorkerTaskStatus }

const STATUSES: readonly WorkerTaskStatus[] = ['pending', 'in_progress', 'completed']
const DELETED = 'deleted'

type Fields = Record<string, unknown>

// Rebuilds a worker's task list from the task tool calls the mod observes.
// Inputs and results are read leniently: a field the tool types do not
// guarantee, or a result given as plain text, never throws.
export function reduceTaskCall(items: readonly WorkerTaskItem[], tool: string, input: Record<string, unknown>, result: unknown): WorkerTaskItem[] {
  switch (tool) {
    case 'TaskCreate':
      return reduceCreate(items, input, result)
    case 'TaskUpdate':
      return reduceUpdate(items, input, result)
    case 'TodoWrite':
      return reduceTodos(items, input, result)
    case WORKER_TASKS_TOOL:
      return reduceFleetTasks(items, input)
    default:
      return [...items]
  }
}

// The fleet's own tool sends the whole list; a malformed call leaves it as it is.
function reduceFleetTasks(items: readonly WorkerTaskItem[], input: Fields): WorkerTaskItem[] {
  const tasks = input['tasks']
  if (!Array.isArray(tasks)) return [...items]
  return tasks
    .map(fieldsOf)
    .map((task, index) => ({ id: String(index + 1), subject: text(task['subject']) ?? '', status: statusOf(task['status']) ?? 'pending' }))
    .filter(item => item.subject !== '')
}

function reduceCreate(items: readonly WorkerTaskItem[], input: Fields, result: unknown): WorkerTaskItem[] {
  const created = fieldsOf(fieldsOf(result)['task'])
  const subject = text(input['subject']) ?? text(created['subject'])
  if (!subject) return [...items]
  const id = text(created['id']) ?? idInText(result) ?? nextId(items)
  const item: WorkerTaskItem = { id, subject, status: 'pending' }
  return items.some(i => i.id === id) ? items.map(i => (i.id === id ? item : i)) : [...items, item]
}

function reduceUpdate(items: readonly WorkerTaskItem[], input: Fields, result: unknown): WorkerTaskItem[] {
  const answer = fieldsOf(result)
  if (answer['success'] === false) return [...items]
  const id = text(input['taskId']) ?? text(answer['taskId'])
  if (!id) return [...items]
  if (input['status'] === DELETED) return items.filter(i => i.id !== id)
  const status = statusOf(input['status'])
  const subject = text(input['subject'])
  const existing = items.find(i => i.id === id)
  if (!existing) return subject ? [...items, { id, subject, status: status ?? 'pending' }] : [...items]
  return items.map(i => (i.id === id ? { ...i, subject: subject ?? i.subject, status: status ?? i.status } : i))
}

function reduceTodos(items: readonly WorkerTaskItem[], input: Fields, result: unknown): WorkerTaskItem[] {
  const todos = Array.isArray(input['todos']) ? input['todos'] : fieldsOf(result)['newTodos']
  if (!Array.isArray(todos)) return [...items]
  return todos
    .map(fieldsOf)
    .map((todo, index) => ({ id: String(index + 1), subject: text(todo['content']) ?? '', status: statusOf(todo['status']) ?? 'pending' }))
    .filter(item => item.subject !== '')
}

function fieldsOf(value: unknown): Fields {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Fields) : {}
}

function text(value: unknown): string | undefined {
  if (typeof value === 'number') return String(value)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

function statusOf(value: unknown): WorkerTaskStatus | undefined {
  return STATUSES.find(s => s === value)
}

function idInText(result: unknown): string | undefined {
  return typeof result === 'string' ? /#(\d+)/.exec(result)?.[1] : undefined
}

function nextId(items: readonly WorkerTaskItem[]): string {
  const numeric = items.map(i => Number(i.id)).filter(Number.isInteger)
  return String(Math.max(0, ...numeric) + 1)
}
