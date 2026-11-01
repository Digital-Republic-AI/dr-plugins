// The Fleet pane's tree, drawn from plain data; every effect comes in as an action.
import type { EngineInterface } from 'claude-code'

import type { FleetView, RunState, TaskItem, Worker } from '../types'
import { LOG_ROWS, MAX_SELECTABLE, MIN_PANE_COLUMNS, MIN_TASK_COLUMNS, SEPARATOR_COLUMNS, TASK_GLYPHS, TASK_ROWS, TASKS_DIR, WORKER_ROW_COLUMNS } from './constants'
import { displayName, elapsed, fit, liveCount, statusGlyph, visibleWorkers } from './core'

export type PaneParts = ReturnType<EngineInterface['ui']['resolve']>

export type PaneData = {
  workers: Worker[]
  view: FleetView
  log: string[]
  relay: boolean
  run: RunState | null
  taskItems: TaskItem[]
  maxWorkers: number
  bodyColumns: number
  now: number
}

export type PaneActions = {
  patchView: (patch: Partial<FleetView>) => void
  spawnNew: () => void
  send: (name: string, text: string) => void
  stop: (name: string) => void
  setRelay: (on: boolean) => void
  startRun: (task: string) => void
  close: () => void
}

type Tab = { parts: PaneParts; data: PaneData; act: PaneActions; width: number }

export function paneTree(parts: PaneParts, data: PaneData, act: PaneActions) {
  const { Box, Text, Button } = parts
  const width = Math.max(MIN_PANE_COLUMNS, data.bodyColumns)
  const tab = { parts, data, act, width }
  const { view: v } = data
  const tabButton = (key: FleetView['tab'], hotkey: string, label: string) => (
    <Button key={`tab-${key}`} plain hotkey={hotkey} label={v.tab === key ? `[${label}]` : ` ${label} `} onPress={() => act.patchView({ tab: key })} />
  )
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        {tabButton('workers', 'w', `workers ${liveCount(data.workers)}/${data.maxWorkers}`)}
        {tabButton('tasks', 't', 'tasks')}
        <Button key="close" plain hotkey="x" label="x" onPress={act.close} />
      </Box>
      {v.tab === 'workers' ? workersTab(tab) : tasksTab(tab)}
      <Text dimColor>{'─'.repeat(Math.min(width, SEPARATOR_COLUMNS))}</Text>
      {data.log.slice(-LOG_ROWS).map((line, i) => (
        <Text key={`log-${i}`} dimColor>
          {fit(line, width)}
        </Text>
      ))}
    </Box>
  )
}

function workersTab({ parts, data, act, width }: Tab) {
  const { Box, Text, Button } = parts
  const Input = 'Input' in parts ? parts.Input : undefined
  const { view: v } = data
  const rows = visibleWorkers(data.workers, MAX_SELECTABLE)
  const selected = rows.find(w => w.name === v.selected)
  return (
    <Box flexDirection="column">
      {rows.length === 0 && <Text dimColor>No workers. Press n or run /fleet spawn &lt;name&gt;.</Text>}
      {rows.map((w, i) => (
        <Box key={`row-${w.name}`} flexDirection="row" gap={1}>
          <Button key={`pick-${w.name}`} plain hotkey={String(i + 1)} label={w.name === v.selected ? `▸${displayName(w)}` : ` ${displayName(w)}`} onPress={() => act.patchView({ selected: w.name, isComposing: false })} />
          <Text dimColor={w.isDone}>
            {statusGlyph(w.status)} {w.status} {elapsed(w.startedAt, data.now)}
          </Text>
          <Text dimColor>{fit(w.task ? `${w.task.source}:${w.task.ref}` : '', Math.max(MIN_TASK_COLUMNS, width - WORKER_ROW_COLUMNS))}</Text>
        </Box>
      ))}
      {selected?.lastText && <Text dimColor>{fit(`${displayName(selected)}: ${selected.lastText}`, width)}</Text>}
      {v.isComposing && selected && Input && (
        <Input
          key="compose"
          label={`→ ${displayName(selected)}`}
          placeholder="message, Enter sends"
          autoFocus
          onSubmit={(value: string) => {
            act.patchView({ isComposing: false })
            if (value.trim()) act.send(selected.name, value.trim())
          }}
        />
      )}
      <Box flexDirection="row" gap={1}>
        <Button key="new" plain hotkey="n" label="n:new" onPress={act.spawnNew} />
        <Button key="msg" plain hotkey="m" label="m:message" dimColor={!selected} onPress={() => selected && act.patchView({ isComposing: !v.isComposing })} />
        <Button key="kill" plain hotkey="k" label="k:stop" dimColor={!selected} onPress={() => selected && act.stop(selected.name)} />
        <Button key="relay" plain hotkey="r" label={data.relay ? 'r:relay on' : 'r:relay off'} onPress={() => act.setRelay(!data.relay)} />
      </Box>
    </Box>
  )
}

function tasksTab({ parts, data, act, width }: Tab) {
  const { Box, Text, Button } = parts
  const { view: v, run: current, taskItems: items } = data
  const name = v.taskName
  return (
    <Box flexDirection="column">
      <Text dimColor>{name ? `plan ${name}${current ? ` · running ${current.running.length} · finished ${current.finished.length}` : ''}` : `No plan loaded: /fleet plan [name] (${TASKS_DIR}/)`}</Text>
      {items.slice(0, TASK_ROWS).map(i => (
        <Text key={`task-${i.id}`} dimColor={i.status === 'completed' || i.status === 'cancelled'}>
          {fit(itemLine(i), width)}
        </Text>
      ))}
      {items.length > TASK_ROWS && <Text dimColor>… {items.length - TASK_ROWS} more</Text>}
      {name && !current && <Button key="run" plain hotkey="g" label="g:run" onPress={() => act.startRun(name)} />}
    </Box>
  )
}

function itemLine(item: TaskItem): string {
  const agent = item.agent ? ` @${item.agent}` : ''
  const needs = item.needs.length ? ` needs: ${item.needs.join(', ')}` : ''
  return `${TASK_GLYPHS[item.status]} ${item.id}${agent} ${item.description}${needs}`
}
