import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { parseNoteArgs } from './core'

const PANE = {
  plugin: 'notes',
  component: 'Pane',
  requestId: 'notes-board',
  props: {
    title: 'Post-its',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

// Stands for the engine: an in-memory store, a project root, a pane that opens.
function engine(on: On, seed: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...seed }
  on('store.get', (_, e) => ({ value: store[e.key] }))
  on('store.set', (_, e) => {
    store[e.key] = JSON.parse(JSON.stringify(e.value))
    return { value: undefined }
  })
  on('session.root', () => ({ value: '/home/dev/acme-shop' }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  return store
}

const note = ($: Engine, args: string) =>
  $.command.run({ command: 'note', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })

test('parses the /note arguments', async () => {
  expect(parseNoteArgs('')).toEqual({ kind: 'open' })
  expect(parseNoteArgs('  comprar café  ')).toEqual({ kind: 'add', text: 'comprar café' })
  expect(parseNoteArgs('rm 3')).toEqual({ kind: 'remove', id: 3 })
  expect(parseNoteArgs('apagar #12')).toEqual({ kind: 'remove', id: 12 })
  expect(parseNoteArgs('rm o cache do build')).toEqual({ kind: 'add', text: 'rm o cache do build' })
  expect(parseNoteArgs('lista')).toEqual({ kind: 'list' })
})

test('/note <text> stores a post-it and the pane draws it, on every surface', async ($, on) => {
  const store = engine(on)
  await $.session.start({ cwd: '/home/dev/acme-shop', surface: 'desktop', isInteractive: true })

  expect((await note($, 'Revisar o PR do checkout')).text).toBe('Nota #1 anotada.')
  expect((await note($, 'Ligar para o fornecedor às 15h')).text).toBe('Nota #2 anotada.')
  expect(store.notes).toHaveLength(2)

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Revisar o PR/ }))?.text).toBe('Revisar o PR do checkout')
    expect((await ui.find({ type: 'Text', text: /notas/ }))?.text).toBe('2 notas')
    await ui.unmount()
  }
})

test('notes from an earlier session load, and the pane button deletes one', async ($, on) => {
  const store = engine(on, {
    notes: [{ id: 7, text: 'Atualizar o changelog', createdAt: 0, color: 0, project: 'acme-shop' }],
  })
  await $.session.start({ cwd: '/home/dev/acme-shop', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /changelog/ }))?.text).toBe('Atualizar o changelog')
  await ui.press({ key: 'del-7' })
  expect(store.notes).toEqual([])
  expect((await ui.find({ type: 'Text', text: /Nenhuma nota/ }))?.text).toBe('Nenhuma nota ainda. Use /note <texto>.')
  await ui.unmount()
})

test('/note rm and /note lista answer in the chat', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await note($, 'Primeira')
  await note($, 'Segunda')

  expect((await note($, 'rm 1')).text).toBe('Nota #1 apagada.')
  expect((await note($, 'rm 9')).text).toBe('Não existe nota #9.')
  expect((await note($, 'lista')).text).toMatch(/^#2 Segunda/)
})
