import { expect, test } from 'claude-code/testing'

import type { Worker } from '../types'
import { HELP } from './commands'
import { interpreterPrompt, parseInterpretation } from './interpreter'

const worker = (name: string, extra: Partial<Worker> = {}): Worker => ({ name, agentId: `id-${name}`, status: 'running', startedAt: 0, lastSeenAt: 0, isDone: false, ...extra })

test('the prompt carries the syntax, the live workers with their labels and the request', () => {
  const prompt = interpreterPrompt('stop the payment one', [worker('doc-payment', { label: 'pay', task: { source: 'manual', ref: 'x', title: 'docs' } }), worker('old', { isDone: true })], 4)
  expect(prompt).toContain(HELP)
  expect(prompt).toContain('- doc-payment (renamed pay): running, on docs')
  expect(prompt).not.toContain('- old')
  expect(prompt).toContain('at most 4 at once')
  expect(prompt.endsWith('Request:\nstop the payment one')).toBe(true)
  expect(interpreterPrompt('x', [], 4)).toContain('- none')
})

test('an answer reads as command lines, a reply, or an error', () => {
  expect(parseInterpretation('{"commands": ["spawn a b --model opus", "/fleet rename a docs", "  "]}')).toEqual({ commands: ['spawn a b --model opus', 'rename a docs'] })
  expect(parseInterpretation('```json\n{"commands": ["stop a"]}\n```')).toEqual({ commands: ['stop a'] })
  expect(parseInterpretation('{"reply": "Não consigo apagar arquivos."}')).toEqual({ reply: 'Não consigo apagar arquivos.' })
  expect('error' in parseInterpretation('sure, done')).toBe(true)
  expect('error' in parseInterpretation('{"commands": []}')).toBe(true)
  expect('error' in parseInterpretation('{"commands": [1, 2]}')).toBe(true)
  expect('error' in parseInterpretation('{not json}')).toBe(true)
})
