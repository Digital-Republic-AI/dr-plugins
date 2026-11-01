import type { TaskItem, WorkerTask } from '../types'
import { TASKS_DIR, TASK_FILE_EXT } from './constants'
import { truncate } from './format'

export const LEAD_NAME = 'team-lead'
export const DONE_PREFIX = 'DONE'
export const BLOCKED_PREFIX = 'BLOCKED'
export const TASK_TITLE_MAX = 60
export const DEFAULT_INSTRUCTIONS_PATH = 'worker/instructions.md'
export const PROJECT_INSTRUCTIONS_PATH = '.claude/fleet/worker-instructions.md'
const MANUAL_TASK_TITLE = 'awaiting instructions'

// Briefs are the first prompt of a worker: the task, then the instructions
// shared by every worker (read from an editable file), then the report rule
// the lead's `session.receive` hook relies on, which stays in code.
const REPORT_RULE = `When you finish, send one message to the team lead (recipient "${LEAD_NAME}") that starts with "${DONE_PREFIX}" followed by a summary of what you did, the files you changed and anything left open. Send a message that starts with "${BLOCKED_PREFIX}" instead when you cannot proceed without the lead.`

export function manualBrief(name: string, instructions: string, agentType?: string): string {
  const role = agentType ? `You act as the "${agentType}" specialist.` : ''
  return [`You are worker "${name}" of a Claude Code team run from this repository.`, role, 'Wait for instructions from the team lead, carry them out, and report back.', instructions.trim(), REPORT_RULE]
    .filter(Boolean)
    .join('\n')
}

// The brief of a task plan item: the plan file is named for context, and the
// worker is told not to write it, since the lead records the progress.
export function planBrief(task: string, items: readonly TaskItem[], agent: string | null, instructions: string): string {
  const role = agent ? `You act as the "${agent}" specialist.` : ''
  const lines = items.map(i => `- ${i.id}: ${i.description}`).join('\n')
  const ids = items.map(i => i.id).join(', ')
  return [
    `You are a worker of a Claude Code team executing the task plan "${task}" (${TASKS_DIR}/${task}${TASK_FILE_EXT}).`,
    role,
    'Read the plan file for the context of these items and implement them:',
    lines,
    `Do not edit the plan file: the team lead records your progress from your report.`,
    instructions.trim(),
    REPORT_RULE.replace(`"${DONE_PREFIX}"`, `"${DONE_PREFIX} ${ids}"`),
  ]
    .filter(Boolean)
    .join('\n')
}

export function isReport(text: string, prefix = DONE_PREFIX): boolean {
  return text.trimStart().toUpperCase().startsWith(prefix)
}

export function manualTask(name: string): WorkerTask {
  return { source: 'manual', ref: name, title: MANUAL_TASK_TITLE }
}

export function taskTitle(text: string): string {
  return truncate(text, TASK_TITLE_MAX)
}
