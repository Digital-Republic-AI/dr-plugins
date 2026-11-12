import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Note } from '../types'
import { HELP, INK, MAX_NOTES, PALETTE, listText, makeNote, parseNoteArgs, projectName, readNotes, stamp } from './core'

const PANE = 'notes-board'
const COMMAND = 'note'
const STORE_KEY = 'notes'
const CARD_COLUMNS = 26
const OPENED = 'Quadro de post-its aberto.'
// Said where the surface draws no pane, or the terminal is too narrow for one.
const NO_PANE = 'O quadro não cabe aqui (esta tela não mostra painéis ou o terminal está estreito). Use /note lista para ver as notas.'

// Change the tag when a note's fields change: it declines what an earlier
// version kept in the session's state.
const board = atom({ plugin: 'notes', key: 'board' } as const, [] as Note[], { shape: 'notes-1' })
const view = atom({ plugin: 'notes', key: 'view' } as const, { isComposing: false })

type $ = EngineInterface

const openBoard = ($: $) => $.ui.open({ id: PANE, title: 'Post-its' })

// The store is the source of truth across sessions; the atom redraws the pane.
async function save($: $, notes: Note[]) {
  await $.store.set(STORE_KEY, notes)
  await update($, board, () => notes)
}

async function addNote($: $, text: string): Promise<Note> {
  const notes = readNotes(await $.store.get(STORE_KEY))
  const note = makeNote(notes, text, projectName(await $.session.root()), Date.now())
  await save($, [...notes, note].slice(-MAX_NOTES))
  return note
}

async function removeNote($: $, id: number): Promise<boolean> {
  const notes = readNotes(await $.store.get(STORE_KEY))
  const kept = notes.filter(n => n.id !== id)
  if (kept.length === notes.length) return false
  await save($, kept)
  return true
}

type Parts = ReturnType<EngineInterface['ui']['resolve']>

// The post-its as cards, newest first; drawn in the pane and in the chat row.
function cardGrid(parts: Parts, $: $, notes: readonly Note[], width: number) {
  const { Box, Text, Button } = parts
  return (
    <Box flexDirection="row" flexWrap="wrap" gap={1}>
      {notes.map(note => {
        const color = PALETTE[note.color % PALETTE.length]
        return (
          <Box key={`note-${note.id}`} flexDirection="column" width={width} borderStyle="round" borderColor={color} backgroundColor={color} paddingX={1}>
            <Text color={INK} wrap="wrap">
              {note.text}
            </Text>
            <Box flexDirection="row" justifyContent="space-between">
              <Text color={INK} dimColor>
                #{note.id} {stamp(note.createdAt)}
              </Text>
              <Button key={`del-${note.id}`} plain label="apagar" onPress={() => void removeNote($, note.id)} />
            </Box>
            {note.project && (
              <Text color={INK} dimColor wrap="truncate-end">
                {note.project}
              </Text>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'Anota um post-it, ou abre o quadro sem texto',
      argumentHint: '[texto | lista | rm <n>]',
    })
    const stored = readNotes(await $.store.get(STORE_KEY))
    await update($, board, () => stored)

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const cmd = parseNoteArgs(e.args)
    switch (cmd.kind) {
      case 'open': {
        const opened = await openBoard($)
        if (opened.isPlaced) return { text: OPENED }
        const list = listText(readNotes(await $.store.get(STORE_KEY)))
        return { text: `${list}

O quadro não aparece nesta tela, então as notas estão listadas aqui.` }
      }
      case 'add': {
        const note = await addNote($, cmd.text)
        const opened = await openBoard($)
        return { text: opened.isPlaced ? `Nota #${note.id} anotada.` : `Nota #${note.id} anotada. ${NO_PANE}` }
      }
      case 'remove':
        return { text: (await removeNote($, cmd.id)) ? `Nota #${cmd.id} apagada.` : `Não existe nota #${cmd.id}.` }
      case 'list':
        return { text: listText(readNotes(await $.store.get(STORE_KEY))) }
      case 'help':
        return { text: HELP }
    }
  }).catch(($, e, next) => ({ text: `Não consegui salvar a nota: ${String(next.error)}` }))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const parts = $.ui.resolve(e)
    const { Box, Text, Button } = parts
    const Input = 'Input' in parts ? parts.Input : undefined
    const notes = [...(await read($, board))].reverse()
    const v = await read($, view)
    const columns = e.props?.bodyColumns ?? 40
    const width = Math.max(16, Math.min(CARD_COLUMNS, columns))

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" gap={1}>
          <Text bold>
            {notes.length} {notes.length === 1 ? 'nota' : 'notas'}
          </Text>
          {Input && (
            <Button key="new" plain hotkey="n" label={v.isComposing ? 'cancelar' : 'nova'} onPress={() => void update($, view, s => ({ ...s, isComposing: !s.isComposing }))} />
          )}
        </Box>
        {v.isComposing && Input && (
          <Input
            key="compose"
            placeholder="Escreva a nota e tecle Enter"
            submitLabel="Anotar"
            autoFocus
            onSubmit={(value: string) => {
              void update($, view, s => ({ ...s, isComposing: false }))
              const text = value.trim()
              if (text) void addNote($, text)
            }}
          />
        )}
        {notes.length === 0 && <Text dimColor>Nenhuma nota ainda. Use /note &lt;texto&gt;.</Text>}
        {cardGrid(parts, $, notes, width)}
      </Box>
    )
  })
  // Where no pane shows (the mobile app, a narrow terminal), `/note` and
  // `/note lista` draw the cards in the chat row instead of plain lines.
  on('ui.render', { component: 'CommandOutput', props: { command: COMMAND } }, async ($, e, next) => {
    const cmd = parseNoteArgs(e.props.args)
    const isBoard = cmd.kind === 'list' || (cmd.kind === 'open' && e.props.text !== OPENED)
    if (!isBoard || e.props.isErrored) return next(e)
    const parts = $.ui.resolve(e)
    const { Box, Text } = parts
    const notes = [...(await read($, board))].reverse()
    const width = Math.max(16, Math.min(CARD_COLUMNS, e.viewport?.columns ?? 40))

    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>
          {notes.length} {notes.length === 1 ? 'nota' : 'notas'}
        </Text>
        {notes.length === 0 && <Text dimColor>Nenhuma nota ainda. Use /note &lt;texto&gt;.</Text>}
        {cardGrid(parts, $, notes, width)}
      </Box>
    )
  })
}
