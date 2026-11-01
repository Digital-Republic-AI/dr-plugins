import { expect, test } from 'claude-code/testing'

import { BLOCKED_PREFIX, TASK_TITLE_MAX, isReport, manualBrief, manualTask, planBrief, taskTitle } from './briefs'

const INSTRUCTIONS = '- Do not commit.\n- Never run git stash.\n'

test('reports are recognised by prefix', () => {
  expect(isReport('  done T2')).toBe(true)
  expect(isReport('BLOCKED: need creds', 'BLOCKED')).toBe(true)
  expect(isReport('working on it')).toBe(false)
})

test('the plan brief names the plan file, the items, the role and the report rule, and keeps the worker off the file', () => {
  const brief = planBrief('my-task', [{ id: 'T2', description: 'Write the parser', status: 'pending', agent: 'python-specialist', needs: [] }], 'python-specialist', INSTRUCTIONS)
  expect(brief).toContain('task plan "my-task" (.claude/fleet/tasks/my-task.md)')
  expect(brief).toContain('"python-specialist"')
  expect(brief).toContain('- T2: Write the parser')
  expect(brief).toContain('Do not edit the plan file')
  expect(brief).toContain('DONE T2')
  expect(brief).toContain('team-lead')
})

test('briefs tell the worker how to report a block', () => {
  expect(manualBrief('w1', INSTRUCTIONS)).toContain(`starts with "${BLOCKED_PREFIX}"`)
  expect(isReport(`${BLOCKED_PREFIX}: need creds`, BLOCKED_PREFIX)).toBe(true)
})

test('a manual task awaits instructions and task titles are cut to their limit', () => {
  expect(manualTask('w1')).toEqual({ source: 'manual', ref: 'w1', title: 'awaiting instructions' })
  expect(taskTitle('x'.repeat(100)).length).toBe(TASK_TITLE_MAX)
  expect(taskTitle('  short\n title ')).toBe('short title')
})

test('every brief carries the instructions before the report rule, and empty instructions leave no blank line', () => {
  const briefs = [
    manualBrief('w1', INSTRUCTIONS, 'react-specialist'),
    planBrief('my-task', [{ id: 'T2', description: 'Write the parser', status: 'pending', agent: null, needs: [] }], null, INSTRUCTIONS),
  ]
  for (const brief of briefs) {
    expect(brief).toContain('- Do not commit.\n- Never run git stash.\nWhen you finish')
  }
  expect(manualBrief('w1', INSTRUCTIONS, 'react-specialist')).toContain('"react-specialist"')
  expect(planBrief('my-task', [], null, '  ')).not.toContain('\n\n')
  expect(manualBrief('w1', '')).not.toContain('\n\n')
})
