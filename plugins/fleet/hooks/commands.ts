import { HELP_MODEL_NOTE, HELP_NATURAL_NOTE, MODEL_FLAG, TYPE_FLAG } from './constants'

export type Command =
  | { kind: 'open' }
  | { kind: 'help' }
  | { kind: 'spawn'; names: string[]; agentType?: string; model?: string }
  | { kind: 'send'; name: string; text: string }
  | { kind: 'stop'; name: string }
  | { kind: 'rename'; name: string; label: string }
  // `plan` without a task lists the task plans of the project.
  | { kind: 'plan'; task?: string }
  | { kind: 'run'; task: string; model?: string }
  | { kind: 'relay'; on: boolean }
  | { kind: 'error'; message: string }
  // Words the subcommands do not read: a plain request for the interpreter.
  | { kind: 'natural'; text: string }

type Words = { first?: string; rest: string[]; model?: string; type?: string }

// One row per subcommand: `form` is the syntax shown in HELP and in the usage
// error, `parse` answers undefined when the words do not fit the form. A row
// without `summary` stays out of HELP. A row with `takesModel` (`takesType`)
// reads the `--model <value>` (`--type <value>`) pair from anywhere after its verb.
type Subcommand = { verb: string; form: string; summary?: string; takesModel?: true; takesType?: true; parse: (words: Words) => Command | undefined }

const HELP_GAP = 2

const SUBCOMMANDS: readonly Subcommand[] = [
  { verb: 'open', form: '', summary: 'open the status pane', parse: () => ({ kind: 'open' }) },
  {
    verb: 'spawn',
    form: `spawn <name> [name...] [${TYPE_FLAG} t] [${MODEL_FLAG} m]`,
    summary: 'start one worker teammate per name, each in its own pane, all on the same type and model',
    takesModel: true,
    takesType: true,
    parse: ({ first, rest, model, type }) => (first ? withModel({ kind: 'spawn', names: [...new Set([first, ...rest])], agentType: type }, model) : undefined),
  },
  {
    verb: 'send',
    form: 'send <name> <text>',
    summary: 'message a worker',
    parse: ({ first, rest }) => {
      const text = rest.join(' ')
      return first && text ? { kind: 'send', name: first, text } : undefined
    },
  },
  { verb: 'stop', form: 'stop <name>', summary: 'stop a worker', parse: ({ first }) => (first ? { kind: 'stop', name: first } : undefined) },
  {
    verb: 'rename',
    form: 'rename <name> <new-name>',
    summary: 'give a worker a new name in the fleet (pane, its screen, send, stop)',
    parse: ({ first, rest }) => (first && rest.length === 1 && rest[0] ? { kind: 'rename', name: first, label: rest[0] } : undefined),
  },
  { verb: 'plan', form: 'plan [task]', summary: 'list the task plans in .claude/fleet/tasks/, or the items of one', parse: ({ first, rest }) => (rest.length === 0 ? (first ? { kind: 'plan', task: first } : { kind: 'plan' }) : undefined) },
  { verb: 'run', form: `run <task> [${MODEL_FLAG} m]`, summary: 'dispatch the ready items of a task plan to workers', takesModel: true, parse: ({ first, model }) => (first ? withModel({ kind: 'run', task: first }, model) : undefined) },
  {
    verb: 'relay',
    form: 'relay on|off',
    summary: 'pass worker messages on to the lead model, or keep them in the pane',
    parse: ({ first }) => (first === 'on' || first === 'off' ? { kind: 'relay', on: first === 'on' } : undefined),
  },
  { verb: 'help', form: 'help', parse: () => ({ kind: 'help' }) },
]

function invocation(form: string): string {
  return form ? `/fleet ${form}` : '/fleet'
}

function helpText(): string {
  const listed = SUBCOMMANDS.filter(s => s.summary !== undefined)
  const width = Math.max(...listed.map(s => invocation(s.form).length)) + HELP_GAP
  const rows = listed.map(s => `${invocation(s.form).padEnd(width)}${s.summary}`).join('\n')
  return `${rows}\n\n${HELP_MODEL_NOTE}\n${HELP_NATURAL_NOTE}`
}

export const HELP = helpText()

export function parseCommand(args: string): Command {
  const words = args.trim().split(/\s+/).filter(Boolean)
  const [verb, ...after] = words
  if (!verb) return { kind: 'open' }
  const sub = SUBCOMMANDS.find(s => s.verb === verb)
  if (!sub) return { kind: 'natural', text: args.trim() }
  const model = sub.takesModel ? takeFlag(after, MODEL_FLAG) : { words: after }
  if (!model) return usage(sub.form)
  const type = sub.takesType ? takeFlag(model.words, TYPE_FLAG) : { words: model.words }
  if (!type) return usage(sub.form)
  const [first, ...rest] = type.words
  return sub.parse({ first, rest, model: model.value, type: type.value }) ?? usage(sub.form)
}

// Answers undefined when the flag has no value after it.
function takeFlag(words: readonly string[], flag: string): { words: string[]; value?: string } | undefined {
  const at = words.indexOf(flag)
  if (at < 0) return { words: [...words] }
  const value = words[at + 1]
  if (!value || value.startsWith('-')) return undefined
  return { words: [...words.slice(0, at), ...words.slice(at + 2)], value }
}

function withModel<C extends Command>(command: C, model: string | undefined): C {
  return model ? { ...command, model } : command
}

function usage(form: string): Command {
  return { kind: 'error', message: `usage: /fleet ${form}` }
}
