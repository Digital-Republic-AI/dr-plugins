// A run of a task plan: which items each worker holds, which are running and
// which are finished. Nothing here touches `$`.
import type { RunState } from '../types'
import { TASK_WORKER_PREFIX } from './constants'
import type { PlanUnit } from './taskFile'

export function unitWorkerName(unit: PlanUnit): string {
  return `${TASK_WORKER_PREFIX}${unit.tasks.join('-')}`
}

export function pickUnits(units: readonly PlanUnit[], room: number): PlanUnit[] {
  return units.slice(0, Math.max(0, room))
}

export function finishUnit(run: RunState, worker: string): RunState {
  const tasks = run.units[worker] ?? []
  return {
    ...run,
    running: run.running.filter(id => !tasks.includes(id)),
    finished: [...run.finished, ...tasks.filter(id => !run.finished.includes(id))],
  }
}

export function startUnit(run: RunState, worker: string, tasks: readonly string[]): RunState {
  return { ...run, units: { ...run.units, [worker]: [...tasks] }, running: [...run.running, ...tasks] }
}

// A unit reserved under a queued worker's name follows the name it started with.
export function rebindUnit(run: RunState, from: string, to: string): RunState {
  const { [from]: tasks = [], ...units } = run.units
  return { ...run, units: { ...units, [to]: tasks } }
}

// A unit whose worker was refused stops counting as running and halts the run.
export function releaseUnit(run: RunState, worker: string, reason: string): RunState {
  const { [worker]: tasks = [], ...units } = run.units
  return { ...run, units, running: run.running.filter(id => !tasks.includes(id)), halted: run.halted ?? reason }
}
