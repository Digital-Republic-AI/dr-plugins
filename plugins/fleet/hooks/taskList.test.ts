import { expect, test } from 'claude-code/testing'

import { type WorkerTaskItem, reduceTaskCall } from './taskList'

const create = (items: readonly WorkerTaskItem[], subject: string, result: unknown) => reduceTaskCall(items, 'TaskCreate', { subject, description: subject }, result)

test('TaskCreate adds a pending task with the id the result gives, read from structured or text results', () => {
  let items = create([], 'Read the plan', { task: { id: '1', subject: 'Read the plan' } })
  items = create(items, 'Write the parser', 'Task #2 created successfully: Write the parser')
  items = create(items, 'Run the tests', undefined)
  expect(items).toEqual([
    { id: '1', subject: 'Read the plan', status: 'pending' },
    { id: '2', subject: 'Write the parser', status: 'pending' },
    { id: '3', subject: 'Run the tests', status: 'pending' },
  ])
  expect(create(items, '  ', { task: { id: '9' } })).toEqual(items)
})

test('TaskUpdate moves the status, renames, removes deleted tasks and ignores failed updates', () => {
  const items: WorkerTaskItem[] = [
    { id: '1', subject: 'Read the plan', status: 'pending' },
    { id: '2', subject: 'Write the parser', status: 'pending' },
  ]
  const started = reduceTaskCall(items, 'TaskUpdate', { taskId: '1', status: 'in_progress' }, { success: true, taskId: '1', updatedFields: ['status'] })
  expect(started[0]).toEqual({ id: '1', subject: 'Read the plan', status: 'in_progress' })
  const renamed = reduceTaskCall(started, 'TaskUpdate', { taskId: '2', subject: 'Write the lexer' }, 'Updated task #2 subject')
  expect(renamed[1]).toEqual({ id: '2', subject: 'Write the lexer', status: 'pending' })
  expect(reduceTaskCall(renamed, 'TaskUpdate', { taskId: '1', status: 'deleted' }, { success: true }).map(i => i.id)).toEqual(['2'])
  expect(reduceTaskCall(items, 'TaskUpdate', { taskId: '1', status: 'completed' }, { success: false, error: 'not found' })).toEqual(items)
  expect(reduceTaskCall(items, 'TaskUpdate', { taskId: '7', status: 'completed' }, { success: true })).toEqual(items)
  expect(reduceTaskCall(items, 'TaskUpdate', { taskId: '1', status: 'bogus' }, { success: true })).toEqual(items)
})

test('TodoWrite replaces the whole list, from the input or from the result', () => {
  const items: WorkerTaskItem[] = [{ id: '1', subject: 'old', status: 'pending' }]
  const todos = [
    { content: 'Plan', status: 'completed', activeForm: 'Planning' },
    { content: 'Build', status: 'in_progress', activeForm: 'Building' },
    { content: '', status: 'pending', activeForm: '' },
  ]
  const expected = [
    { id: '1', subject: 'Plan', status: 'completed' },
    { id: '2', subject: 'Build', status: 'in_progress' },
  ]
  expect(reduceTaskCall(items, 'TodoWrite', { todos }, undefined)).toEqual(expected)
  expect(reduceTaskCall(items, 'TodoWrite', {}, { oldTodos: [], newTodos: todos })).toEqual(expected)
  expect(reduceTaskCall(items, 'TodoWrite', {}, 'done')).toEqual(items)
})

test('any other tool leaves the list as it is', () => {
  const items: WorkerTaskItem[] = [{ id: '1', subject: 'Plan', status: 'pending' }]
  expect(reduceTaskCall(items, 'Bash', { command: 'ls' }, 'out')).toEqual(items)
  expect(reduceTaskCall(items, 'TaskList', {}, { tasks: [] })).toEqual(items)
})

test('the fleet tasks tool replaces the whole list and ignores a malformed call', () => {
  const sent = reduceTaskCall([{ id: '9', subject: 'Old', status: 'completed' }], 'mcp__fleet__tasks', { tasks: [{ subject: 'Read the plan', status: 'completed' }, { subject: 'Write the parser', status: 'in_progress' }, { subject: '', status: 'pending' }, { subject: 'Run the tests', status: 'odd' }] }, { ok: true })
  expect(sent).toEqual([
    { id: '1', subject: 'Read the plan', status: 'completed' },
    { id: '2', subject: 'Write the parser', status: 'in_progress' },
    { id: '4', subject: 'Run the tests', status: 'pending' },
  ])
  expect(reduceTaskCall(sent, 'mcp__fleet__tasks', { tasks: 'nope' }, { ok: false })).toEqual(sent)
})
