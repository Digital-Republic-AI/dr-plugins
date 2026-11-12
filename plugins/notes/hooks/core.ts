// Plain logic of the board: parsing `/note` arguments, building and reading notes.
import type { Note } from '../types'

// Post-it colors, cycled as notes are added. Dark text reads on all of them.
export const PALETTE = ['#FFE873', '#FFB3C7', '#A7D8FF', '#B8F2A8', '#FFCF99'] as const
export const INK = '#2B2B2B'
export const MAX_NOTES = 500
export const MAX_TEXT = 2000

export type NoteCommand =
  | { kind: 'open' }
  | { kind: 'add'; text: string }
  | { kind: 'remove'; id: number }
  | { kind: 'list' }
  | { kind: 'help' }

export function parseNoteArgs(args: string): NoteCommand {
  const text = args.trim()
  if (!text) return { kind: 'open' }
  const [head = '', ...rest] = text.split(/\s+/)
  const word = head.toLowerCase()
  const target = rest[0] ?? ''
  if ((word === 'rm' || word === 'apagar') && rest.length === 1 && /^#?\d+$/.test(target)) {
    return { kind: 'remove', id: Number(target.replace('#', '')) }
  }
  if ((word === 'lista' || word === 'list') && rest.length === 0) return { kind: 'list' }
  if ((word === 'ajuda' || word === 'help') && rest.length === 0) return { kind: 'help' }
  return { kind: 'add', text: text.slice(0, MAX_TEXT) }
}

export function makeNote(notes: readonly Note[], text: string, project: string, now: number): Note {
  const id = notes.reduce((top, n) => Math.max(top, n.id), 0) + 1
  return { id, text, createdAt: now, color: (id - 1) % PALETTE.length, project }
}

// Keeps only well-formed notes from what the store held.
export function readNotes(stored: unknown): Note[] {
  if (!Array.isArray(stored)) return []
  return stored.filter(
    (n): n is Note =>
      typeof n === 'object' &&
      n !== null &&
      typeof n.id === 'number' &&
      typeof n.text === 'string' &&
      typeof n.createdAt === 'number' &&
      typeof n.color === 'number' &&
      typeof n.project === 'string',
  )
}

export function projectName(root: string): string {
  const parts = root.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

const pad = (n: number) => String(n).padStart(2, '0')

export function stamp(ms: number): string {
  const d = new Date(ms)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function listText(notes: readonly Note[]): string {
  if (notes.length === 0) return 'Nenhuma nota ainda. Use /note <texto>.'
  return [...notes]
    .reverse()
    .map(n => `#${n.id} ${n.text}  (${stamp(n.createdAt)}${n.project ? ` · ${n.project}` : ''})`)
    .join('\n')
}

export const HELP = [
  '/note <texto>     anota um post-it',
  '/note             abre o quadro de post-its',
  '/note lista       lista as notas aqui no chat',
  '/note rm <n>      apaga a nota #n',
].join('\n')
