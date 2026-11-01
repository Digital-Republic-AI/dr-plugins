// What a fleet worker's own screen draws, from plain data: its task list in the
// band above the prompt, and nothing where the transcript would show its work.
import type { RenderNode } from 'claude-code'

import type { WorkerTaskItem, WorkerTaskStatus } from '../types'
import {
  WORKER_ACTIVE_COLOR,
  WORKER_ACTIVITY_SEPARATOR,
  WORKER_BAND_BORDER_STYLE,
  WORKER_BAND_FRAME_COLUMNS,
  WORKER_IDLE_TEXT,
  WORKER_LIST_CHROME_ROWS,
  WORKER_NO_TASKS_TEXT,
  WORKER_PROGRESS_CELLS,
  WORKER_PROGRESS_EMPTY,
  WORKER_PROGRESS_FILLED,
  WORKER_SPINNER_FRAMES,
  WORKER_TASK_GLYPHS,
  WORKER_TASKS_WORD,
  WORKER_TITLE,
  WORKER_SHADE_LAST_STEP,
  WORKER_SHADE_RAMP,
  WORKER_WORKING_TEXT,
} from './constants'
import { fit } from './format'
import type { PaneParts } from './pane'

// `spinnerFrame` is the worker's frame counter, advanced by a timer in the
// hooks module; the band reads it modulo the frame sequence. `shadeStep` is the
// frame's step on WORKER_SHADE_RAMP, moved by the same timer: up while working,
// down after, 0 being the idle look.
export type WorkerBandData = {
  // The worker's fleet label, else its name; null until the guard knows it.
  name: string | null
  tasks: readonly WorkerTaskItem[]
  bodyColumns: number
  maxRows: number
  isWorking: boolean
  spinnerFrame: number
  shadeStep: number
}

export type Shade = (typeof WORKER_SHADE_RAMP)[number]

// The ramp entry of a step; undefined for the idle look.
export function shadeOf(step: number): Shade | undefined {
  const clamped = Math.min(Math.max(Math.trunc(step), 0), WORKER_SHADE_LAST_STEP)
  return clamped === 0 ? undefined : WORKER_SHADE_RAMP[clamped - 1]
}

// An empty Box in a transcript site's place: the row is not drawn, while the
// stored message and what the model reads stay as they are.
export function hiddenRow(parts: PaneParts) {
  const { Box } = parts
  return <Box />
}

export function spinnerGlyph(frame: number): string {
  return WORKER_SPINNER_FRAMES[Math.abs(frame) % WORKER_SPINNER_FRAMES.length] ?? WORKER_SPINNER_FRAMES[0]
}

function activityText(data: WorkerBandData): string {
  return data.isWorking ? `${spinnerGlyph(data.spinnerFrame)} ${WORKER_WORKING_TEXT}` : WORKER_IDLE_TEXT
}

// `completed/total` followed by a bar of WORKER_PROGRESS_CELLS cells.
export function progressText(tasks: readonly WorkerTaskItem[]): string {
  const done = tasks.filter(t => t.status === 'completed').length
  const filled = Math.round((done / tasks.length) * WORKER_PROGRESS_CELLS)
  return `${done}/${tasks.length} ${WORKER_PROGRESS_FILLED.repeat(filled)}${WORKER_PROGRESS_EMPTY.repeat(WORKER_PROGRESS_CELLS - filled)}`
}

function bandTitle(data: WorkerBandData, columns: number): string {
  const parts = [data.name ? `${WORKER_TITLE} ${data.name}` : WORKER_TITLE, WORKER_TASKS_WORD, activityText(data)]
  if (data.tasks.length > 0) parts.push(progressText(data.tasks))
  return fit(parts.join(WORKER_ACTIVITY_SEPARATOR), columns)
}

function taskStyle(status: WorkerTaskStatus, shade: Shade | undefined) {
  switch (status) {
    case 'completed':
      return { dimColor: true, strikethrough: true, color: shade?.text }
    case 'in_progress':
      return { color: shade?.activeText ?? WORKER_ACTIVE_COLOR, weight: 'semibold' as const }
    default:
      return { color: shade?.text }
  }
}

function frameStyle(shade: Shade | undefined) {
  return shade ? { borderColor: shade.border, backgroundColor: shade.background } : { borderDimColor: true }
}

export function workerBand(parts: PaneParts, data: WorkerBandData, theirs: RenderNode) {
  const { Box, Text } = parts
  const rows = Math.max(1, data.maxRows - WORKER_LIST_CHROME_ROWS)
  const columns = Math.max(1, data.bodyColumns - WORKER_BAND_FRAME_COLUMNS)
  const shown = data.tasks.slice(0, rows)
  const hidden = data.tasks.length - shown.length
  const shade = shadeOf(data.shadeStep)
  const dim = shade === undefined
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle={WORKER_BAND_BORDER_STYLE} {...frameStyle(shade)}>
        <Text key="band-title" dimColor={dim} color={shade?.text}>
          {bandTitle(data, columns)}
        </Text>
        {data.tasks.length === 0 && <Text dimColor={dim} color={shade?.text}>{WORKER_NO_TASKS_TEXT}</Text>}
        {shown.map(task => (
          <Text key={`task-${task.id}`} {...taskStyle(task.status, shade)}>
            {fit(`${WORKER_TASK_GLYPHS[task.status]} ${task.subject}`, columns)}
          </Text>
        ))}
        {hidden > 0 && <Text dimColor={dim} color={shade?.text}>… {hidden} more</Text>}
      </Box>
      {theirs}
    </Box>
  )
}
