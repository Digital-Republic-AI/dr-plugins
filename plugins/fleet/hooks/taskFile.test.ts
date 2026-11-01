import { expect, test } from 'claude-code/testing'

import { isTaskFile, parseTaskFile, readyUnits, setMark, taskFilePath, taskNameOf, withStatus } from './taskFile'

const PLAN = `# Parser rewrite

Some prose the parser leaves alone.

- [ ] T1: Write the tokenizer @python-specialist
- [ ] T2: Write the parser needs: T1
- [~] T3: Update the README
- [x] T4: Add fixtures
- [-] T5: Old approach, dropped
* [X] T6: Star bullet, capital mark needs: T4, T5
- [ ] not an item: no id before the colon? this one has spaces
- [ ] T7:Tight colon @dr:python-specialist needs:T6
`

test('a plan file is read into items with status, agent and needs, and the rest of the file is ignored', () => {
  const plan = parseTaskFile(PLAN)
  expect(plan.title).toBe('Parser rewrite')
  expect(plan.errors).toEqual([])
  expect(plan.items.map(i => i.id)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'])
  expect(plan.items[0]).toEqual({ id: 'T1', description: 'Write the tokenizer', status: 'pending', agent: 'python-specialist', needs: [] })
  expect(plan.items[1]).toEqual({ id: 'T2', description: 'Write the parser', status: 'pending', agent: null, needs: ['T1'] })
  expect(plan.items.map(i => i.status)).toEqual(['pending', 'pending', 'in_progress', 'completed', 'cancelled', 'completed', 'pending'])
  expect(plan.items[5]).toEqual({ id: 'T6', description: 'Star bullet, capital mark', status: 'completed', agent: null, needs: ['T4', 'T5'] })
  expect(plan.items[6]).toEqual({ id: 'T7', description: 'Tight colon', status: 'pending', agent: 'dr:python-specialist', needs: ['T6'] })
})

test('a plan without a title, with a repeated id or with unknown needs reports it', () => {
  expect(parseTaskFile('- [ ] T1: a\n').title).toBeNull()
  expect(parseTaskFile('- [ ] T1: a\n- [ ] T1: b\n').errors).toEqual(['T1 is listed twice'])
  expect(parseTaskFile('- [ ] T1: a needs: T9\n- [ ] T2: b needs: T2\n').errors).toEqual(['T1 needs T9, which is not in the plan', 'T2 needs itself'])
  expect(parseTaskFile('nothing here\n')).toEqual({ title: null, items: [], errors: [] })
})

test('setMark changes one line mark and nothing else, and leaves an unknown id alone', () => {
  const marked = setMark(PLAN, 'T2', 'in_progress')
  expect(marked).toContain('- [~] T2: Write the parser needs: T1')
  expect(marked.replace('- [~] T2:', '- [ ] T2:')).toBe(PLAN)
  expect(setMark(PLAN, 'T6', 'cancelled')).toContain('* [-] T6: Star bullet, capital mark needs: T4, T5')
  expect(setMark(PLAN, 'T7', 'completed')).toContain('- [x] T7:Tight colon @dr:python-specialist needs:T6')
  expect(setMark(PLAN, 'T99', 'completed')).toBe(PLAN)
  expect(withStatus(parseTaskFile(PLAN).items, ['T1', 'T2'], 'completed').filter(i => i.status === 'completed').map(i => i.id)).toEqual(['T1', 'T2', 'T4', 'T6'])
})

test('readyUnits answers the pending items whose needs are settled, one unit each, minus the running ones', () => {
  const items = parseTaskFile(PLAN).items
  const ready = readyUnits(items, [])
  expect(ready.units).toEqual([
    { id: 'T1', agent: 'python-specialist', tasks: ['T1'] },
    { id: 'T7', agent: 'dr:python-specialist', tasks: ['T7'] },
  ])
  expect(ready.waiting).toEqual(['T2'])
  expect(ready.done).toBe(false)
  expect(readyUnits(items, ['T1', 'T7']).units).toEqual([])
  const later = withStatus(items, ['T1', 'T3', 'T7'], 'completed')
  expect(readyUnits(later, []).units.map(u => u.id)).toEqual(['T2'])
  // A cancelled need counts as settled; a completed plan is done once nothing runs.
  expect(readyUnits(parseTaskFile('- [-] A: a\n- [ ] B: b needs: A\n').items, []).units.map(u => u.id)).toEqual(['B'])
  expect(readyUnits(parseTaskFile('- [x] A: a\n- [-] B: b\n').items, [])).toEqual({ units: [], done: true, waiting: [] })
  expect(readyUnits(parseTaskFile('- [x] A: a\n').items, ['A']).done).toBe(false)
})

test('plan files live under .claude/fleet/tasks as <name>.md', () => {
  expect(taskFilePath('/repo', 'my-task')).toBe('/repo/.claude/fleet/tasks/my-task.md')
  expect(isTaskFile('my-task.md')).toBe(true)
  expect(isTaskFile('.md')).toBe(false)
  expect(isTaskFile('notes.txt')).toBe(false)
  expect(taskNameOf('my-task.md')).toBe('my-task')
})
