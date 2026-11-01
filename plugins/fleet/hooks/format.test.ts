import { expect, test } from 'claude-code/testing'

import { MAX_LOG, pushLog, truncate } from './format'

test('texts truncate and logs cap', () => {
  expect(truncate('a'.repeat(500)).length).toBe(400)
  expect(truncate('  two\n lines  ')).toBe('two lines')
  let log: string[] = []
  for (let i = 0; i < MAX_LOG + 10; i += 1) log = pushLog(log, `line ${i}`)
  expect(log.length).toBe(MAX_LOG)
  expect(log[0]).toBe('line 10')
})
