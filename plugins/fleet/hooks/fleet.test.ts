import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'
import { WORKER_BACKGROUND_POLL_MS, WORKER_SHADE_LAST_STEP, WORKER_SHADE_RAMP, WORKER_SPINNER_MS } from './constants'
import { shadeOf } from './workerView'

const PANE = 'fleet'
const LEAD_SESSION = 'lead-session'

type RosterRow = { id: string; teammateId?: string; name?: string; status: 'running' | 'idle' | 'completed'; description?: string; type?: string }

type Harness = {
  roster?: RosterRow[]
  env?: Record<string, string>
  settings?: Record<string, unknown>
  // What the test wants to see of the plugin's calls, filled as they happen.
  spawned?: unknown[]
  received?: string[]
  sends?: unknown[]
  stops?: unknown[]
  processRuns?: string[][]
  // What the complexity classifier received, and the label it answers.
  classified?: string[]
  classifyAnswer?: string | (() => string | undefined)
  registeredTools?: string[]
  deny?: string
  store?: Record<string, unknown>
  // File contents by path suffix; any other path does not exist. A write
  // replaces the entry whose suffix the path ends with, or adds the path.
  files?: Record<string, string>
  // Every `$.fs.write`, as it happened.
  written?: { path: string; text: string }[]
  // What the worker guard reads as the command lines of its ancestors.
  ancestry?: string
  // What the engine's own reminders received.
  attachments?: unknown[]
  // The interpreter's answer to a plain request, and the prompts it received.
  completeAnswer?: string
  completed?: string[]
}

// Every stub the plugin's hooks reach, registered before the first `$` call
// (the kit refuses a stub registered later) and once per event.
const engine = (on: On, h: Harness = {}) => {
  const clock = mock.clock(on)
  mock.env(on, h.env ?? { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' })
  mock.store(on, h.store)
  on('session.id', () => ({ value: LEAD_SESSION }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('tool.register', (_$, e) => {
    h.registeredTools?.push(e.name)
    return { value: { tool: `mcp__fleet__${e.name}` } }
  })
  on('ui.invalidate', () => ({ value: undefined }))
  on('session.root', () => ({ value: '/repo' }))
  const files = h.files ?? {}
  const keyOf = (path: string) => Object.keys(files).find(suffix => path.endsWith(suffix))
  const file = (path: string) => {
    const key = keyOf(path)
    return key === undefined ? undefined : files[key]
  }
  // A directory exists when a known file lies under it.
  on('fs.exists', (_$, e) => ({ value: file(e.path) !== undefined || Object.keys(files).some(k => k.startsWith(`${e.path.replace(/^\/repo\//, '')}/`)) }))
  on('fs.write', (_$, e) => {
    files[keyOf(e.path) ?? e.path] = e.text
    h.written?.push({ path: e.path, text: e.text })
    return { value: undefined }
  })
  on('fs.list', (_$, e) => {
    const dir = `${e.path.replace(/^\/repo\//, '')}/`
    const names = Object.keys(files).filter(k => k.startsWith(dir)).map(k => k.slice(dir.length)).filter(n => !n.includes('/'))
    return { value: names.map(name => ({ name, kind: 'file' as const, size: 0, mtimeMs: 0, isLink: false })) }
  })
  on('fs.read', (_$, e) => {
    const text = file(e.path)
    return text === undefined ? { deny: `no such file: ${e.path}` } : { value: text }
  })
  on('settings.read', () => ({ value: h.settings ?? { teammateMode: 'tmux' } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('agent.list', () => ({ value: (h.roster ?? []).map(r => ({ description: '', type: 'teammate', ...r })) }))
  let n = 0
  on('agent.spawn', (_$, e) => {
    h.spawned?.push(e)
    if (h.deny) return { deny: h.deny }
    // The kit starts no agent for a plugin's own `$.agent.spawn`: the plugin
    // gets `{ model }` alone and takes the id from the roster later.
    return { model: 'claude-sonnet-5-5', agentId: `a${++n}`, teammateId: `${e.name ?? 'w'}@team` }
  })
  on('session.receive', (_$, e) => {
    h.received?.push(e.text)
    return { text: e.text }
  })
  on('session.send', (_$, e) => {
    h.sends?.push(e.to)
    return e.to === 'ghost' ? { isDelivered: false as const, reason: 'nobody by that name' } : { isDelivered: true as const }
  })
  on('tool.call', { tool: 'TaskStop' }, (_$, e) => {
    h.stops?.push(e.task_id)
    return { result: { success: true, message: 'stopped' } }
  })
  let taskId = 0
  on('tool.call', { tool: 'TaskCreate' }, (_$, e) => {
    const id = String(++taskId)
    return { result: { task: { id, subject: String((e as Record<string, unknown>)['subject']) } } }
  })
  on('tool.call', { tool: 'TaskUpdate' }, (_$, e) => ({ result: { success: true, taskId: String((e as Record<string, unknown>)['taskId']) } }))
  on('process.run', (_$, e) => {
    h.processRuns?.push([...e.argv])
    const stdout = e.argv[0] === 'sh' ? (h.ancestry ?? '') : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('model.complete', (_$, e) => {
    h.completed?.push(String(e.prompt))
    return { value: { isAnswered: true as const, text: h.completeAnswer ?? '{"reply": "nothing to do"}', usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }
  })
  on('model.classify', (_$, e) => {
    h.classified?.push(e.text)
    return { value: typeof h.classifyAnswer === 'function' ? h.classifyAnswer() : h.classifyAnswer }
  })
  // Stands for Claude Code's own drawing of a site the plugin passes on.
  on('ui.render', () => ({ type: 'engine' as const, ref: 0 }))
  on('prompt.attachment', (_$, e) => {
    h.attachments?.push(e)
    return { text: e.text }
  })
  return clock
}

const pane = (bodyColumns = 70) => ({
  plugin: 'fleet',
  component: 'Pane' as const,
  requestId: PANE,
  props: { title: 'Fleet', isFocused: true, bodyColumns, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} },
})

const fleet = ($: Engine, args: string) => $.command.run({ command: 'fleet', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })

const report = (teammate: string, text: string) => ({ origin: { kind: 'peer' as const, teammate, isVerified: false }, text })

const PLAN_FILE = '.claude/fleet/tasks/my-task.md'

const planFiles = (lines: string) => ({ [PLAN_FILE]: `# My task\n\n${lines}\n` })

const lastPlan = (files: Record<string, string>) => files[PLAN_FILE]

test('/fleet spawn with a list starts one worker per name on the same model and queues the names past the limit', async ($, on) => {
  const spawned: unknown[] = []
  engine(on, { spawned })
  const { text } = await fleet($, 'spawn d1 d2 d3 d4 d5 --model opus')
  expect(spawned.map(e => (e as { name?: string }).name)).toEqual(['d1', 'd2', 'd3', 'd4'])
  const models = new Set(spawned.map(e => (e as { model?: string }).model))
  expect(models.size).toBe(1)
  expect(text?.split('\n')).toHaveLength(5)
  expect(text).toContain('d4 started')
  expect(text).toContain('d5 queued')
})

test('a plain request after /fleet runs the commands the interpreter reads from it', async ($, on) => {
  const spawned: unknown[] = []
  const completed: string[] = []
  engine(on, { spawned, completed, completeAnswer: '{"commands": ["spawn a b --model opus", "rename a docs", "frobnicate"]}' })
  const { text } = await fleet($, 'abre dois workers opus chamados a e b e chama o a de docs')
  expect(completed[0]).toContain('abre dois workers opus chamados a e b')
  expect(spawned.map(e => (e as { name?: string }).name)).toEqual(['a', 'b'])
  expect(text).toContain('→ /fleet spawn a b --model opus')
  expect(text).toContain('a is now called docs.')
  expect(text).toContain('→ /fleet frobnicate: not run')
})

test('a plain request nothing can do answers the interpreter reply and runs nothing', async ($, on) => {
  const spawned: unknown[] = []
  engine(on, { spawned, completeAnswer: '{"reply": "Não consigo fazer isso."}' })
  const { text } = await fleet($, 'faz um café')
  expect(text).toBe('Não consigo fazer isso.')
  expect(spawned).toEqual([])
})

test('the lead model reaches the fleet through its own tool, and a rename is used by send and the pane', async ($, on) => {
  const spawned: unknown[] = []
  const sends: unknown[] = []
  const store: Record<string, unknown> = {}
  engine(on, { spawned, sends, store })
  await startSession($)
  const started = await $.tool.call({ tool: 'mcp__fleet__command', args: 'spawn w1 w2' })
  expect(started.result).toContain('w1 started')
  expect(spawned).toHaveLength(2)
  const renamed = await $.tool.call({ tool: 'mcp__fleet__command', args: 'rename w1 docs' })
  expect(renamed.result).toBe('w1 is now called docs.')
  expect((await $.tool.call({ tool: 'mcp__fleet__command', args: 'rename w2 docs' })).result).toBe('Another worker is already called docs.')
  expect((await fleet($, 'send docs hello')).text).toBe('Sent to docs.')
  // The label is the fleet's own: the engine is still addressed by the original name.
  expect(sends).toEqual(['w1'])
  const ui = await $.ui.mount({ ...pane(), surface: 'terminal' })
  expect(await ui.find({ text: /docs/ })).toBeDefined()
  await ui.unmount()
})

test('a worker band shows the label its lead gave it', async ($, on) => {
  const clock = engine(on, { ...recordedWorker, store: { ...recordedWorker.store, [`labels:${LEAD_SESSION}`]: { w1: 'docs' } } })
  await startSession($)
  await clock.advance(WORKER_BACKGROUND_POLL_MS)
  await clock.settle()
  const ui = await drawBand($, false)
  expect(await ui.find({ text: /^fleet worker docs · tasks · idle/ })).toBeDefined()
  await ui.unmount()
  // A worker never runs fleet commands: its policy refuses the tool.
  expect((await $.tool.call({ tool: 'mcp__fleet__command', args: 'spawn x' })).deny).toBeDefined()
})

test('/fleet spawn starts a teammate, records it and draws it in the pane', async ($, on) => {
  const spawned: unknown[] = []
  engine(on, { spawned })
  const { text } = await fleet($, 'spawn w1 --type react-specialist')
  expect(text).toContain('w1 started')
  // The kit hands the stub the Agent tool's own call shape for a plugin spawn.
  expect(spawned[0]).toMatchObject({ name: 'w1' })
  expect(JSON.stringify(spawned[0])).toContain('react-specialist')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...pane(), surface })
    expect(await ui.find({ text: /w1/ })).toBeDefined()
    expect(await ui.find({ text: /running/ })).toBeDefined()
    await ui.unmount()
  }
})

test('without agent teams the spawn answers the setup instructions and starts nothing', async ($, on) => {
  const spawned: unknown[] = []
  engine(on, { spawned, env: {}, settings: {} })
  const { text } = await fleet($, 'spawn w1')
  expect(text).toContain('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS')
  expect(spawned).toEqual([])
})

test('with in-process teammates the spawn asks for a pane mode', async ($, on) => {
  const spawned: unknown[] = []
  engine(on, { spawned, settings: { teammateMode: 'in-process' } })
  const { text } = await fleet($, 'spawn w1')
  expect(text).toContain('teammateMode')
  expect(spawned).toEqual([])
})

test('a worker report is kept in the pane with relay off and passed on with relay on', async ($, on) => {
  const received: string[] = []
  engine(on, { received })
  await fleet($, 'spawn w1')
  const kept = await $.session.receive(report('w1', 'DONE all tests pass'))
  expect(kept).toMatchObject({ consumed: expect.stringContaining('fleet') })
  expect(received).toEqual([])
  await fleet($, 'relay on')
  const passed = await $.session.receive(report('w1', 'DONE again'))
  expect(passed).toMatchObject({ text: 'DONE again' })
  expect(received).toEqual(['DONE again'])
  const ui = await $.ui.mount({ ...pane(), surface: 'terminal' })
  expect(await ui.find({ text: /DONE again/ })).toBeDefined()
  await ui.unmount()
})

test('the engine idle notice marks the worker idle in the pane and is kept from the lead model', async ($, on) => {
  const received: string[] = []
  engine(on, { received })
  await fleet($, 'spawn w1')
  const notice = '{"type":"idle_notification","from":"w1","timestamp":"2026-10-21T22:19:04.267Z","idleReason":"available"}'
  const kept = await $.session.receive(report('w1', notice))
  expect(kept).toMatchObject({ consumed: expect.stringContaining('idle') })
  expect(received).toEqual([])
  const ui = await $.ui.mount({ ...pane(), surface: 'terminal' })
  expect(await ui.find({ text: /idle_notification/ })).toBeUndefined()
  expect(await ui.find({ text: /idle/ })).toBeDefined()
  await ui.unmount()
})

test('a BLOCKED report always reaches the lead, and the lead own sends are left alone', async ($, on) => {
  const received: string[] = []
  engine(on, { received })
  await fleet($, 'spawn w1')
  await $.session.receive(report('w1', 'BLOCKED need the API key'))
  await $.session.receive({ origin: { kind: 'coordinator', teammate: 'team-lead', isVerified: true }, text: 'go on' })
  expect(received).toEqual(['BLOCKED need the API key', 'go on'])
})

test('/fleet send addresses the worker by agent id and reports a failed delivery', async ($, on) => {
  const sends: unknown[] = []
  engine(on, { sends })
  await fleet($, 'spawn w1')
  expect((await fleet($, 'send w1 hello there')).text).toContain('Sent to w1')
  expect((await fleet($, 'send ghost hi')).text).toContain('Not delivered')
  expect(sends.length).toBe(2)
})

test('/fleet stop calls TaskStop with the worker address and closes the worker', async ($, on) => {
  const stops: unknown[] = []
  engine(on, { stops })
  await fleet($, 'spawn w1')
  expect((await fleet($, 'stop w1')).text).toContain('w1 stopped')
  expect(stops).toEqual(['w1'])
  expect((await fleet($, 'stop nobody')).text).toContain('No worker')
  const ui = await $.ui.mount({ ...pane(), surface: 'terminal' })
  expect(await ui.find({ text: /killed/ })).toBeDefined()
  await ui.unmount()
})

test('the poll reads the roster while a worker lives and marks it done when the roster says so', async ($, on) => {
  const roster: RosterRow[] = []
  const clock = engine(on, { roster })
  await fleet($, 'spawn w1')
  roster.push({ id: 'a1', teammateId: 'w1@team', name: 'w1', status: 'completed' })
  await clock.advance(2100)
  await clock.settle()
  const ui = await $.ui.mount({ ...pane(), surface: 'terminal' })
  expect(await ui.find({ text: /completed/ })).toBeDefined()
  await ui.unmount()
})

test('a live worker is drawn ahead of ten ended ones, and the poll prunes the ended ones past the cap', async ($, on) => {
  const clock = engine(on)
  // Four at a time, the default limit; a millisecond apart so the ended ones have an order.
  for (const batch of [['w1', 'w2', 'w3', 'w4'], ['w5', 'w6', 'w7', 'w8'], ['w9', 'w10']]) {
    for (const name of batch) await fleet($, `spawn ${name}`)
    for (const name of batch) {
      await clock.advance(1)
      await fleet($, `stop ${name}`)
    }
  }
  await fleet($, 'spawn w11')
  const before = await $.ui.mount({ ...pane(), surface: 'terminal' })
  expect((await before.find({ key: 'pick-w11' }))?.props['hotkey']).toBe('1')
  expect((await before.find({ key: 'pick-w10' }))?.props['hotkey']).toBe('2')
  expect(await before.find({ key: 'pick-w3' })).toBeDefined()
  expect(await before.find({ key: 'pick-w2' })).toBeUndefined()
  expect(await before.find({ key: 'pick-w1' })).toBeUndefined()
  expect(await before.findAll({ type: 'Button', text: /^.w\d+$/ })).toHaveLength(9)
  // The selection follows the rows drawn: the second row is w10, not w2.
  await before.press({ key: 'pick-w10' })
  expect((await before.find({ key: 'pick-w10' }))?.text).toBe('▸w10')
  await before.unmount()
  await clock.advance(2100)
  await clock.settle()
  const after = await $.ui.mount({ ...pane(), surface: 'terminal' })
  expect(await after.find({ key: 'pick-w11' })).toBeDefined()
  expect(await after.find({ key: 'pick-w6' })).toBeDefined()
  expect(await after.find({ key: 'pick-w5' })).toBeUndefined()
  expect(await after.findAll({ type: 'Button', text: /^.w\d+$/ })).toHaveLength(6)
  await after.unmount()
})

test('a teammate the lead spawned itself joins the fleet', async ($, on) => {
  engine(on)
  await $.agent.spawn({
    prompt: 'look around',
    description: 'scout the repo',
    subagentType: 'teammate',
    name: 'scout',
    tool_use_id: 'tu1',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: true,
    fork: false,
    isTeammate: true,
  })
  const ui = await $.ui.mount({ ...pane(), surface: 'terminal' })
  expect(await ui.find({ text: /scout/ })).toBeDefined()
  await ui.unmount()
})

test('/fleet run dispatches the ready items of the plan file, marks them in the file and finishes on the last DONE', async ($, on) => {
  const spawned: { name?: string; prompt?: string }[] = []
  const written: { path: string; text: string }[] = []
  const files = planFiles('- [ ] T1: parser @python-specialist\n- [ ] T2: tests @python-unit-test-specialist needs: T1')
  engine(on, { spawned, written, files })
  const { text } = await fleet($, 'run my-task')
  expect(text).toContain('1 item(s) dispatched to 1 worker(s)')
  expect(spawned.map(s => s.name)).toEqual(['task-T1'])
  expect(String(spawned[0]?.prompt)).toContain('task plan "my-task"')
  expect(String(spawned[0]?.prompt)).toContain('- T1: parser')
  expect(String(spawned[0]?.prompt)).toContain('DONE T1')
  expect(lastPlan(files)).toContain('- [~] T1: parser @python-specialist')
  expect(lastPlan(files)).toContain('- [ ] T2: tests')
  await $.session.receive(report('task-T1', 'DONE T1 parser written'))
  expect(lastPlan(files)).toContain('- [x] T1: parser @python-specialist')
  expect(lastPlan(files)).toContain('- [~] T2: tests @python-unit-test-specialist needs: T1')
  expect(spawned.map(s => s.name)).toEqual(['task-T1', 'task-T2'])
  const ui = await $.ui.mount({ ...pane(), surface: 'terminal' })
  expect(await ui.find({ text: /◐ T2 @python-unit-test-specialist tests needs: T1/ })).toBeDefined()
  await ui.unmount()
  await $.session.receive(report('task-T2', 'DONE T2 tests written'))
  expect(lastPlan(files)).toBe('# My task\n\n- [x] T1: parser @python-specialist\n- [x] T2: tests @python-unit-test-specialist needs: T1\n')
  expect(written.every(w => w.path === `/repo/${PLAN_FILE}`)).toBe(true)
  const after = await $.ui.mount({ ...pane(), surface: 'terminal' })
  expect(await after.find({ text: /run my-task complete/ })).toBeDefined()
  await after.unmount()
})

test('/fleet plan lists the plan files, reads one, and reports a plan that needs an unknown item', async ($, on) => {
  const files = { ...planFiles('- [ ] T1: parser\n- [x] T2: done already\n- [ ] T3: later needs: T1'), '.claude/fleet/tasks/other.md': '- [ ] A: a\n', '.claude/fleet/tasks/broken.md': '- [ ] A: a needs: Z\n' }
  engine(on, { files })
  expect((await fleet($, 'plan')).text).toBe('Task plans: my-task, other, broken. Run /fleet plan <name> to list one.')
  expect((await fleet($, 'plan my-task')).text).toBe('my-task: 3 item(s), 2 open. Press g in the Fleet pane or run /fleet run my-task.')
  const ui = await $.ui.mount({ ...pane(), surface: 'terminal' })
  expect(await ui.find({ text: /plan my-task/ })).toBeDefined()
  expect(await ui.find({ text: /✓ T2 done already/ })).toBeDefined()
  expect(await ui.find({ text: /○ T3 later needs: T1/ })).toBeDefined()
  await ui.unmount()
  expect((await fleet($, 'plan broken')).text).toBe('Could not read plan broken: A needs Z, which is not in the plan')
  expect((await fleet($, 'plan missing')).text).toContain('no plan file at .claude/fleet/tasks/missing.md')
})

test('/fleet plan without a tasks directory points to the task-plan skill', async ($, on) => {
  engine(on, {})
  expect((await fleet($, 'plan')).text).toContain('.claude/fleet/tasks/ does not exist')
  expect((await fleet($, 'plan')).text).toContain('task-plan skill')
})

test('a worker model is the one asked for, else the tier the task is classified into, else inherited', async ($, on) => {
  const spawned: { name?: string; model?: string }[] = []
  const classified: string[] = []
  engine(on, { spawned, classified, classifyAnswer: 'complex', files: planFiles('- [ ] T1: Redesign the auth flow, which touches every service and the session store') })
  await fleet($, 'spawn w1 --model opus')
  await fleet($, 'spawn w2 --type react-specialist --model standard')
  await fleet($, 'spawn w3')
  expect(spawned.map(s => s.model)).toEqual(['opus', 'sonnet', undefined])
  // A manual worker has no task text: nothing was classified so far.
  expect(classified).toEqual([])
  await fleet($, 'run my-task')
  expect(classified).toEqual(['Redesign the auth flow, which touches every service and the session store'])
  expect(spawned[3]?.model).toBe('opus')
})

test('the policy table maps tiers to models, and an unclear or failed classification inherits', async ($, on) => {
  const spawned: { model?: string }[] = []
  const classified: string[] = []
  const answers = ['standard', undefined]
  const files = { ...workerFiles, ...planFiles('- [ ] T1: Fix a typo\n- [ ] T2: Fix another typo'), '.claude/fleet/tasks/tier.md': '- [ ] T3: Fix a third typo\n', 'worker/policy.json': JSON.stringify({ allowedMcpServers: [], deniedCommands: [], modelTiers: { standard: 'claude-sonnet-5-5' } }) }
  engine(on, { spawned, classified, files, classifyAnswer: () => answers.shift() })
  await fleet($, 'run my-task')
  const ui = await $.ui.mount({ ...pane(), surface: 'terminal' })
  expect(await ui.find({ text: /complexity unclear/ })).toBeDefined()
  await ui.unmount()
  await $.session.receive(report('task-T1', 'DONE T1'))
  await $.session.receive(report('task-T2', 'DONE T2'))
  // An explicit tier skips the classifier and maps through the same table.
  await fleet($, 'run tier --model simple')
  expect(spawned.map(s => s.model)).toEqual(['claude-sonnet-5-5', undefined, 'haiku'])
  expect(classified).toHaveLength(2)
})

const mixedPlan = () => planFiles('- [ ] T1: Rename a constant\n- [ ] T2: Design the cache @nodejs-architect')

test('/fleet run leaves an item with an agent on the agent model, classifies one without, and --model covers every item', async ($, on) => {
  const spawned: { name?: string; model?: string }[] = []
  const classified: string[] = []
  engine(on, { spawned, classified, classifyAnswer: 'simple', files: mixedPlan() })
  await fleet($, 'run my-task')
  expect(spawned.map(s => [s.name, s.model])).toEqual([['task-T1', 'haiku'], ['task-T2', undefined]])
  expect(classified).toEqual(['Rename a constant'])
})

test('/fleet run --model puts every item of the run on that model', async ($, on) => {
  const spawned: { name?: string; model?: string }[] = []
  const classified: string[] = []
  engine(on, { spawned, classified, files: mixedPlan() })
  await fleet($, 'run my-task --model opus')
  expect(spawned.map(s => s.model)).toEqual(['opus', 'opus'])
  expect(classified).toEqual([])
})

const twoItemPlan = () => planFiles('- [ ] T1: parser\n- [ ] T2: tests needs: T1')

test('/fleet run stops with the reason when an item cannot start, without retrying it', async ($, on) => {
  const spawned: unknown[] = []
  const files = twoItemPlan()
  const clock = engine(on, { files, spawned, deny: 'spawn refused by policy' })
  const { text } = await fleet($, 'run my-task')
  expect(text).toContain('Run my-task stopped')
  expect(text).toContain('spawn refused by policy')
  await clock.advance(6500)
  await clock.settle()
  expect(spawned.length).toBe(1)
  // A refused item is not marked in the file.
  expect(lastPlan(files)).toContain('- [ ] T1: parser')
  const ui = await $.ui.mount({ ...pane(), surface: 'terminal' })
  expect(await ui.find({ text: /run my-task stopped/ })).toBeDefined()
  await ui.unmount()
})

test('/fleet run waits for a free slot and dispatches each item once', async ($, on) => {
  const spawned: { name?: string }[] = []
  const files = twoItemPlan()
  const clock = engine(on, { files, spawned })
  for (const name of ['w1', 'w2', 'w3', 'w4']) await fleet($, `spawn ${name}`)
  expect((await fleet($, 'run my-task')).text).toContain('0 item(s) dispatched')
  expect(lastPlan(files)).toContain('- [ ] T1: parser')
  await fleet($, 'stop w1')
  await clock.advance(2100)
  await clock.settle()
  await clock.advance(2100)
  await clock.settle()
  expect(spawned.filter(s => s.name === 'task-T1').length).toBe(1)
  expect(lastPlan(files)).toContain('- [~] T1: parser')
  await $.session.receive(report('task-T1', 'DONE T1 parser written'))
  expect(spawned.map(s => s.name)).toContain('task-T2')
})

test('stopping the worker of an item gives the item back to the plan, and the run does not retry it', async ($, on) => {
  const spawned: { name?: string }[] = []
  const files = twoItemPlan()
  const clock = engine(on, { files, spawned })
  await fleet($, 'run my-task')
  expect(lastPlan(files)).toContain('- [~] T1: parser')
  expect((await fleet($, 'stop task-T1')).text).toBe('task-T1 stopped.')
  expect(lastPlan(files)).toContain('- [ ] T1: parser')
  await clock.advance(2100)
  await clock.settle()
  expect(spawned.map(s => s.name)).toEqual(['task-T1'])
})

test('a run halts when the open items all wait on one that is not done', async ($, on) => {
  const files = planFiles('- [x] T1: done\n- [~] T2: someone else is on it\n- [ ] T3: after T2 needs: T2')
  engine(on, { files })
  const { text } = await fleet($, 'run my-task')
  expect(text).toBe('Run my-task stopped: T3 wait on items that are not done')
})

const workerFiles = {
  'worker/instructions.md': 'Do not commit. Never run git stash.',
  'worker/policy.json': JSON.stringify({ allowedMcpServers: ['docs'], deniedCommands: ['git stash'] }),
}

const workerAncestry = `/bin/claude --agent-id w1@team --agent-name w1 --team-name team --parent-session-id ${LEAD_SESSION} --model opus`

test('a worker brief carries the instructions file, and the project copy wins over the plugin default', async ($, on) => {
  const spawned: { prompt?: string }[] = []
  engine(on, { spawned, files: { ...workerFiles, '.claude/fleet/worker-instructions.md': 'Project rule: run the linter.' } })
  await fleet($, 'spawn w1')
  expect(String(spawned[0]?.prompt)).toContain('Project rule: run the linter.')
  expect(String(spawned[0]?.prompt)).not.toContain('Never run git stash')
})

test('the lead records its workers, so a recorded worker is guarded and an unknown teammate is not', async ($, on) => {
  engine(on, { files: workerFiles, ancestry: workerAncestry, store: { [`workers:${LEAD_SESSION}`]: ['w1'] } })
  const stash = await $.tool.call({ tool: 'Bash', command: 'git -C /repo stash' })
  expect(stash.deny).toContain('git stash')
  const plaud = await $.tool.call({ tool: 'mcp__plaud__list_files' })
  expect(plaud.deny).toContain('"plaud" is not allowed')
})

test('a session that is not a recorded worker is left alone by the guard', async ($, on) => {
  engine(on, { files: workerFiles, ancestry: workerAncestry.replace('--agent-name w1', '--agent-name scout') })
  const stops = await $.tool.call({ tool: 'TaskStop', task_id: 'x' })
  expect(stops.deny).toBeUndefined()
})

// The transcript sites a worker draws empty, each with the props of one row.
const transcriptSites = [
  { component: 'AssistantMessage' as const, props: { text: 'Here is how I fixed it: `rm -rf build`', isFirstOfReply: true } },
  { component: 'ToolUse' as const, props: { tool_use_id: 't1', tool: 'Bash', input: { command: 'ls' }, isRunning: false, isErrored: false, isInterrupted: false } },
  { component: 'ToolResult' as const, props: { tool_use_id: 't1', tool: 'Bash', output: { stdout: 'secret.txt', stderr: '' }, isErrored: false } },
  { component: 'ToolGroup' as const, props: { calls: [], isActive: false, isExpanded: false } },
  { component: 'UserMessage' as const, props: { text: 'Fix the parser in src/a.ts', origin: { kind: 'composer' as const }, isExpanded: false } },
  { component: 'Spinner' as const, props: { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' as const } },
  { component: 'TurnDuration' as const, props: { word: 'Baked', durationMs: 3000 } },
  { component: 'ToolProgress' as const, props: { tool_use_id: 't1', kind: 'background_hint' as const, hint: '(ctrl+b to run in background)' } },
]

const band = { component: 'AbovePrompt' as const, props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 60, scroll: { offset: 0, bodyRows: 10 }, view: {} } }

const drawBand = async ($: Engine, isWorking: boolean) => $.ui.mount({ plugin: 'fleet', surface: 'terminal', ...band, props: { ...band.props, isWorking } })

const roundFrame = async (ui: Awaited<ReturnType<typeof drawBand>>) => (await ui.findAll({ type: 'Box' })).find(b => b.props['borderStyle'] === 'round')

const recordedWorker = { files: workerFiles, ancestry: workerAncestry, store: { [`workers:${LEAD_SESSION}`]: ['w1'] } }

// The guard is settled by session.start; the screen reads its verdict alone.
const startSession = ($: Engine) => $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

test('a worker draws its transcript rows empty and lists its tasks above the prompt as they move', async ($, on) => {
  const registeredTools: string[] = []
  const clock = engine(on, { ...recordedWorker, registeredTools })
  await startSession($)
  expect(registeredTools).toEqual(['tasks'])
  for (const site of transcriptSites) {
    const ui = await $.ui.mount({ plugin: 'fleet', surface: 'terminal', ...site } as Parameters<Engine['ui']['mount']>[0])
    const drawn = await ui.drawn()
    expect(drawn).toMatchObject({ type: 'Box' })
    expect('children' in drawn ? (drawn.children ?? []) : []).toEqual([])
    await ui.unmount()
  }
  const created = await $.tool.call({ tool: 'TaskCreate', subject: 'Read the plan', description: 'Read it' } as Parameters<Engine['tool']['call']>[0])
  // The model still reads the tool's own result: only the drawing changes.
  expect(created.result).toEqual({ task: { id: '1', subject: 'Read the plan' } })
  await $.tool.call({ tool: 'TaskCreate', subject: 'Write the parser', description: 'Write it' } as Parameters<Engine['tool']['call']>[0])
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' } as Parameters<Engine['tool']['call']>[0])
  await $.tool.call({ tool: 'TaskUpdate', taskId: '2', status: 'in_progress' } as Parameters<Engine['tool']['call']>[0])
  const ui = await $.ui.mount({ plugin: 'fleet', surface: 'terminal', ...band })
  expect((await ui.find({ type: 'Text', text: /✓ Read the plan/ }))?.props).toMatchObject({ dimColor: true, strikethrough: true })
  expect((await ui.find({ type: 'Text', text: /◐ Write the parser/ }))?.props).toMatchObject({ color: 'success', weight: 'semibold' })
  // Working starts from the idle look: the frame only takes color as the timer steps the ramp.
  const startFrame = await roundFrame(ui)
  expect(startFrame?.props['borderDimColor']).toBe(true)
  expect(startFrame?.props['backgroundColor']).toBeUndefined()
  // The spinner is hidden in a worker, so the band says the turn is running,
  // with a turning glyph, and counts the tasks done.
  expect(await ui.find({ text: /⠋ working… · 1\/2 █████░░░░░/ })).toBeDefined()
  // One spinner period later the worker's timer has advanced the frame (the
  // kit redraws a mounted band on state changes, not on `invalidate`, so the
  // next frame is read off a fresh draw).
  await clock.advance(130)
  await clock.settle()
  const later = await drawBand($, true)
  expect(await later.find({ text: /⠙ working…/ })).toBeDefined()
  const [firstShade, secondShade] = WORKER_SHADE_RAMP
  const stepOne = await roundFrame(later)
  expect(stepOne?.props).toMatchObject({ borderColor: firstShade.border, backgroundColor: firstShade.background })
  expect(stepOne?.props['borderDimColor']).toBeUndefined()
  await later.unmount()
  await clock.advance(WORKER_SPINNER_MS)
  await clock.settle()
  const stepTwo = await drawBand($, true)
  expect((await roundFrame(stepTwo))?.props).toMatchObject({ borderColor: secondShade.border, backgroundColor: secondShade.background })
  await stepTwo.unmount()
  for (let period = 0; period < WORKER_SHADE_LAST_STEP; period++) {
    await clock.advance(WORKER_SPINNER_MS)
    await clock.settle()
  }
  const lastShade = WORKER_SHADE_RAMP[WORKER_SHADE_LAST_STEP - 1]!
  const full = await drawBand($, true)
  const fullFrame = await roundFrame(full)
  expect(fullFrame?.props).toMatchObject({ borderColor: lastShade.border, backgroundColor: lastShade.background })
  expect(fullFrame?.props['borderDimColor']).toBeUndefined()
  expect((await full.find({ type: 'Text', text: /✓ Read the plan/ }))?.props).toMatchObject({ color: lastShade.text, dimColor: true })
  expect((await full.find({ type: 'Text', text: /◐ Write the parser/ }))?.props).toMatchObject({ color: lastShade.activeText })
  await full.unmount()
  // The fleet's own tool is served by the mod, passes the guard and replaces the list.
  const sent = await $.tool.call({ tool: 'mcp__fleet__tasks', tasks: [{ subject: 'Probe git', status: 'completed' }, { subject: 'Probe done', status: 'pending' }] })
  expect(sent.deny).toBeUndefined()
  expect(sent.result).toBe('Task list replaced: 2 task(s).')
  expect(await ui.find({ text: /✓ Probe git/ })).toBeDefined()
  expect(await ui.find({ text: /○ Probe done/ })).toBeDefined()
  expect(await ui.find({ text: /Read the plan/ })).toBeUndefined()
  await ui.unmount()
  // Idle: no glyph, and the timer leaves the frame alone.
  const fading = await drawBand($, false)
  expect((await roundFrame(fading))?.props).toMatchObject({ backgroundColor: lastShade.background })
  await fading.unmount()
  await clock.advance(WORKER_SPINNER_MS)
  await clock.settle()
  const stepDown = await drawBand($, false)
  expect((await roundFrame(stepDown))?.props).toMatchObject({ backgroundColor: WORKER_SHADE_RAMP[WORKER_SHADE_LAST_STEP - 2]!.background })
  await stepDown.unmount()
  for (let period = 0; period < WORKER_SHADE_LAST_STEP; period++) {
    await clock.advance(WORKER_SPINNER_MS)
    await clock.settle()
  }
  const idle = await drawBand($, false)
  expect(await idle.find({ text: /· idle · 1\/2/ })).toBeDefined()
  expect(await idle.find({ text: /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/ })).toBeUndefined()
  // Idle, the frame is dim again, with neither border color nor background.
  const idleFrame = (await idle.findAll({ type: 'Box' })).find(b => b.props['borderStyle'] === 'round')
  expect(idleFrame?.props['borderDimColor']).toBe(true)
  expect(idleFrame?.props['borderColor']).toBeUndefined()
  expect(idleFrame?.props['backgroundColor']).toBeUndefined()
  await idle.unmount()
  // No tasks: neither counter nor bar.
  await $.tool.call({ tool: 'mcp__fleet__tasks', tasks: [] })
  const empty = await $.ui.mount({ plugin: 'fleet', surface: 'terminal', ...band })
  expect(await empty.find({ text: /\d\/\d|░/ })).toBeUndefined()
  expect(await empty.find({ text: /No tasks yet/ })).toBeDefined()
  await empty.unmount()
})

test('a worker whose turn ended on a background subagent keeps the working look until the subagent ends', async ($, on) => {
  const roster: RosterRow[] = []
  const clock = engine(on, { ...recordedWorker, roster })
  await startSession($)
  roster.push({ id: 'bg1', type: 'general-purpose', status: 'running' })
  await clock.advance(WORKER_BACKGROUND_POLL_MS)
  await clock.settle()
  const waiting = await drawBand($, false)
  expect(await waiting.find({ text: /working…/ })).toBeDefined()
  await waiting.unmount()
  await clock.advance(WORKER_SPINNER_MS)
  await clock.settle()
  const shaded = await drawBand($, false)
  expect((await roundFrame(shaded))?.props['backgroundColor']).toBeDefined()
  await shaded.unmount()
  roster[0]!.status = 'completed'
  await clock.advance(WORKER_BACKGROUND_POLL_MS)
  await clock.settle()
  const done = await drawBand($, false)
  expect(await done.find({ text: /· idle/ })).toBeDefined()
  await done.unmount()
})

test('shadeOf maps a step to its ramp entry, with no entry for the idle look and the last entry as the ceiling', () => {
  expect(shadeOf(0)).toBeUndefined()
  expect(shadeOf(-3)).toBeUndefined()
  expect(shadeOf(1)).toBe(WORKER_SHADE_RAMP[0])
  expect(shadeOf(WORKER_SHADE_LAST_STEP)).toBe(WORKER_SHADE_RAMP[WORKER_SHADE_LAST_STEP - 1])
  expect(shadeOf(WORKER_SHADE_LAST_STEP + 5)).toBe(WORKER_SHADE_RAMP[WORKER_SHADE_LAST_STEP - 1])
})

const styleReminder = { type: 'output_style', text: 'dr:Direct and Objective output style is active.', origin: { kind: 'engine' as const } }
const todoReminder = { type: 'todo_reminder', text: 'Your todo list is empty.', origin: { kind: 'engine' as const } }

test('a worker screen drawn before session.start settles the guard passes through, and is a worker screen after', async ($, on) => {
  engine(on, recordedWorker)
  const site = transcriptSites[0]!
  const before = await $.ui.mount({ plugin: 'fleet', surface: 'terminal', ...site } as Parameters<Engine['ui']['mount']>[0])
  expect(await before.drawn()).toMatchObject({ type: 'engine' })
  await before.unmount()
  await startSession($)
  const after = await $.ui.mount({ plugin: 'fleet', surface: 'terminal', ...site } as Parameters<Engine['ui']['mount']>[0])
  expect(await after.drawn()).toMatchObject({ type: 'Box' })
  await after.unmount()
})

test('a worker refuses every pane, its own included, and tells the opener why', async ($, on) => {
  engine(on, recordedWorker)
  await startSession($)
  const { text } = await fleet($, '')
  expect(text).toContain('fleet worker: panes stay closed, the screen is the task list')
})

test('a session that is not a worker opens panes as before', async ($, on) => {
  engine(on, { files: workerFiles })
  await startSession($)
  expect((await fleet($, '')).text).toBe('Fleet pane opened.')
})

test('a worker skips the output style reminder and keeps every other', async ($, on) => {
  const attachments: { type: string }[] = []
  engine(on, { ...recordedWorker, attachments })
  expect((await $.prompt.attachment(styleReminder)).text).toBeNull()
  expect((await $.prompt.attachment(todoReminder)).text).toBe(todoReminder.text)
  expect(attachments.map(a => a.type)).toEqual(['todo_reminder'])
})

test('a session that is not a worker keeps every reminder', async ($, on) => {
  engine(on, { files: workerFiles })
  expect((await $.prompt.attachment(styleReminder)).text).toBe(styleReminder.text)
})

test('a session that is not a worker draws its transcript and the band as before, and keeps no task list', async ($, on) => {
  const registeredTools: string[] = []
  engine(on, { files: workerFiles, registeredTools })
  await startSession($)
  expect(registeredTools).toEqual(['command'])
  for (const site of transcriptSites) {
    const ui = await $.ui.mount({ plugin: 'fleet', surface: 'terminal', ...site } as Parameters<Engine['ui']['mount']>[0])
    expect(await ui.drawn()).toMatchObject({ type: 'engine' })
    await ui.unmount()
  }
  await $.tool.call({ tool: 'TaskCreate', subject: 'Read the plan', description: 'Read it' } as Parameters<Engine['tool']['call']>[0])
  const ui = await $.ui.mount({ plugin: 'fleet', surface: 'terminal', ...band })
  expect(await ui.find({ text: /fleet worker/ })).toBeUndefined()
  expect(await ui.find({ text: /Read the plan/ })).toBeUndefined()
  await ui.unmount()
})
