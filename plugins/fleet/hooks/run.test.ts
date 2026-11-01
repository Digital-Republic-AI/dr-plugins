import { expect, test } from 'claude-code/testing'

import type { RunState } from '../types'
import { finishUnit, pickUnits, rebindUnit, releaseUnit, startUnit, unitWorkerName } from './run'

test('a unit is named for its items and the room cuts the units picked', () => {
  const units = [
    { id: 'T2', agent: 'a', tasks: ['T2'] },
    { id: 'T4', agent: null, tasks: ['T4'] },
  ]
  expect(unitWorkerName(units[0]!)).toBe('task-T2')
  expect(unitWorkerName({ id: 'x', agent: null, tasks: ['T2', 'T3'] })).toBe('task-T2-T3')
  expect(pickUnits(units, 1).map(u => u.id)).toEqual(['T2'])
  expect(pickUnits(units, 0)).toEqual([])
  expect(pickUnits(units, -1)).toEqual([])
})

test('a run tracks units from start to finish', () => {
  let run: RunState = { task: 't', units: {}, running: [], finished: [] }
  run = startUnit(run, 'task-T2', ['T2'])
  run = startUnit(run, 'task-T4', ['T4'])
  expect(run.running).toEqual(['T2', 'T4'])
  run = finishUnit(run, 'task-T2')
  expect(run.running).toEqual(['T4'])
  expect(run.finished).toEqual(['T2'])
  expect(finishUnit(run, 'nobody')).toEqual(run)
})

test('a queued unit follows its renamed worker, and a refused one is released and halts the run', () => {
  const reserved = startUnit({ task: 't', units: { 'task-T9': ['T9'] }, running: ['T9'], finished: [] }, 'task-T1', ['T1'])
  const moved = rebindUnit(reserved, 'task-T1', 'task-T1-2')
  expect(moved.units).toEqual({ 'task-T9': ['T9'], 'task-T1-2': ['T1'] })
  expect(moved.running).toEqual(['T9', 'T1'])
  const released = releaseUnit(reserved, 'task-T1', 'agent teams are off')
  expect(released.units).toEqual({ 'task-T9': ['T9'] })
  expect(released.running).toEqual(['T9'])
  expect(released.halted).toBe('agent teams are off')
  expect(releaseUnit(released, 'task-T9', 'later').halted).toBe('agent teams are off')
})
