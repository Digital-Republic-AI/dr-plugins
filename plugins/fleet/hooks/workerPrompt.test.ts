import { expect, test } from 'claude-code/testing'

import { WORKER_HIDDEN_ATTACHMENT_TEXT, WORKER_HIDDEN_ATTACHMENT_TYPES } from './constants'
import { isHiddenAttachment } from './workerPrompt'

const hidden = (type: string, text: string | null) => isHiddenAttachment(type, text, WORKER_HIDDEN_ATTACHMENT_TYPES, WORKER_HIDDEN_ATTACHMENT_TEXT)

test('an attachment is hidden by its kind or by its text, and any other is kept', () => {
  expect(hidden('output_style', null)).toBe(true)
  expect(hidden('system_reminder', 'dr:Direct and Objective output style is active. Remember to follow it.')).toBe(true)
  expect(hidden('todo_reminder', 'The task list has not been used recently.')).toBe(false)
  expect(hidden('todo_reminder', null)).toBe(false)
})
