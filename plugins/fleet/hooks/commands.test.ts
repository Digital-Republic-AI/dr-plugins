import { expect, test } from 'claude-code/testing'

import { HELP, parseCommand } from './commands'
import { HELP_MODEL_NOTE, HELP_NATURAL_NOTE } from './constants'

test('parseCommand reads every subcommand and reports usage errors', () => {
  expect(parseCommand('')).toEqual({ kind: 'open' })
  expect(parseCommand('spawn w1 --type react-specialist')).toEqual({ kind: 'spawn', names: ['w1'], agentType: 'react-specialist' })
  expect(parseCommand('send w1 do the  thing')).toEqual({ kind: 'send', name: 'w1', text: 'do the thing' })
  expect(parseCommand('stop w1')).toEqual({ kind: 'stop', name: 'w1' })
  expect(parseCommand('plan my-task')).toEqual({ kind: 'plan', task: 'my-task' })
  expect(parseCommand('plan')).toEqual({ kind: 'plan' })
  expect(parseCommand('plan a b').kind).toBe('error')
  expect(parseCommand('run my-task')).toEqual({ kind: 'run', task: 'my-task' })
  expect(parseCommand('relay on')).toEqual({ kind: 'relay', on: true })
  expect(parseCommand('relay maybe').kind).toBe('error')
  expect(parseCommand('send w1').kind).toBe('error')
  expect(parseCommand('rename w1 docs')).toEqual({ kind: 'rename', name: 'w1', label: 'docs' })
})

test('usage errors quote the syntax HELP lists', () => {
  const lines = HELP.split('\n')
  expect(lines[0]).toBe('/fleet                                                open the status pane')
  expect(lines).toContain('/fleet relay on|off                                   pass worker messages on to the lead model, or keep them in the pane')
  expect(HELP.endsWith(`\n\n${HELP_MODEL_NOTE}\n${HELP_NATURAL_NOTE}`)).toBe(true)
  expect(parseCommand('spawn')).toEqual({ kind: 'error', message: 'usage: /fleet spawn <name> [name...] [--type t] [--model m]' })
  expect(parseCommand('relay maybe')).toEqual({ kind: 'error', message: 'usage: /fleet relay on|off' })
  expect(parseCommand('rename w1')).toEqual({ kind: 'error', message: 'usage: /fleet rename <name> <new-name>' })
  expect(parseCommand('rename w1 a b')).toEqual({ kind: 'error', message: 'usage: /fleet rename <name> <new-name>' })
  for (const form of ['spawn <name> [name...] [--type t] [--model m]', 'send <name> <text>', 'stop <name>', 'plan [task]', 'run <task> [--model m]', 'relay on|off']) expect(HELP).toContain(`/fleet ${form} `)
})

test('spawn and run take --model before or after their positionals, and refuse it without a value', () => {
  expect(parseCommand('spawn w1 --model haiku')).toEqual({ kind: 'spawn', names: ['w1'], agentType: undefined, model: 'haiku' })
  expect(parseCommand('spawn w1 --type react-specialist --model claude-opus-5-5')).toEqual({ kind: 'spawn', names: ['w1'], agentType: 'react-specialist', model: 'claude-opus-5-5' })
  expect(parseCommand('spawn --model complex w1 --type react-specialist')).toEqual({ kind: 'spawn', names: ['w1'], agentType: 'react-specialist', model: 'complex' })
  expect(parseCommand('spawn w1')).not.toHaveProperty('model')
  expect(parseCommand('run my-task --model sonnet')).toEqual({ kind: 'run', task: 'my-task', model: 'sonnet' })
  expect(parseCommand('run --model simple my-task')).toEqual({ kind: 'run', task: 'my-task', model: 'simple' })
  expect(parseCommand('run my-task')).toEqual({ kind: 'run', task: 'my-task' })
  expect(parseCommand('spawn w1 --model')).toEqual({ kind: 'error', message: 'usage: /fleet spawn <name> [name...] [--type t] [--model m]' })
  expect(parseCommand('run my-task --model')).toEqual({ kind: 'error', message: 'usage: /fleet run <task> [--model m]' })
  expect(parseCommand('run --model --x my-task')).toEqual({ kind: 'error', message: 'usage: /fleet run <task> [--model m]' })
  expect(parseCommand('send w1 use --model opus')).toEqual({ kind: 'send', name: 'w1', text: 'use --model opus' })
})

test('spawn takes several names that share the type and the model, and refuses --type without a value', () => {
  expect(parseCommand('spawn w1 w2 w3 --type react-specialist --model opus')).toEqual({ kind: 'spawn', names: ['w1', 'w2', 'w3'], agentType: 'react-specialist', model: 'opus' })
  expect(parseCommand('spawn --model opus w1 w2 w1')).toEqual({ kind: 'spawn', names: ['w1', 'w2'], agentType: undefined, model: 'opus' })
  expect(parseCommand('spawn w1 --type')).toEqual({ kind: 'error', message: 'usage: /fleet spawn <name> [name...] [--type t] [--model m]' })
  expect(parseCommand('spawn --model opus')).toEqual({ kind: 'error', message: 'usage: /fleet spawn <name> [name...] [--type t] [--model m]' })
})

test('words no subcommand reads are a plain request, kept whole', () => {
  expect(parseCommand('abre dois workers opus chamados a e b')).toEqual({ kind: 'natural', text: 'abre dois workers opus chamados a e b' })
  expect(parseCommand('  frobnicate  now ')).toEqual({ kind: 'natural', text: 'frobnicate  now' })
})
