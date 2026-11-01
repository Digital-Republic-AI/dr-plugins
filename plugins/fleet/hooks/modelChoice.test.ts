import { expect, test } from 'claude-code/testing'

import { CLASSIFY_TEXT_MAX, DEFAULT_MODEL_TIERS } from './constants'
import { classificationText, isComplexityTier, mergeModelTiers, resolveModel } from './modelChoice'

const tiers = { simple: 'haiku', standard: 'sonnet', complex: 'claude-opus-5-5' }

test('complexity tiers are recognized by name only', () => {
  expect(isComplexityTier('simple')).toBe(true)
  expect(isComplexityTier('complex')).toBe(true)
  expect(isComplexityTier('opus')).toBe(false)
  expect(isComplexityTier(undefined)).toBe(false)
})

test('an explicit model wins, a tier name maps through the tiers, and nothing leaves the model to the engine', () => {
  expect(resolveModel('claude-sonnet-5-5', 'complex', tiers)).toBe('claude-sonnet-5-5')
  expect(resolveModel('haiku', undefined, tiers)).toBe('haiku')
  expect(resolveModel('complex', 'simple', tiers)).toBe('claude-opus-5-5')
  expect(resolveModel(undefined, 'standard', tiers)).toBe('sonnet')
  expect(resolveModel(undefined, undefined, tiers)).toBeUndefined()
  expect(resolveModel('', undefined, tiers)).toBeUndefined()
})

test('the classification text joins the non-empty parts and is cut to the limit', () => {
  expect(classificationText(['  Fix the parser ', null, '', undefined, 'see #489'])).toBe('Fix the parser\nsee #489')
  expect(classificationText([])).toBe('')
  expect(classificationText(['x'.repeat(CLASSIFY_TEXT_MAX + 1)])).toHaveLength(CLASSIFY_TEXT_MAX)
})

test('model tiers default, take partial overrides, and refuse what is not a tier map', () => {
  expect(mergeModelTiers(undefined)).toEqual(DEFAULT_MODEL_TIERS)
  expect(mergeModelTiers({})).toEqual(DEFAULT_MODEL_TIERS)
  expect(mergeModelTiers({ complex: 'claude-opus-5-5' })).toEqual({ ...DEFAULT_MODEL_TIERS, complex: 'claude-opus-5-5' })
  expect(mergeModelTiers('opus')).toMatchObject({ error: expect.stringContaining('must be an object') })
  expect(mergeModelTiers(null)).toMatchObject({ error: expect.stringContaining('must be an object') })
  expect(mergeModelTiers(['opus'])).toMatchObject({ error: expect.stringContaining('must be an object') })
  expect(mergeModelTiers({ huge: 'opus' })).toMatchObject({ error: expect.stringContaining('unknown tier "huge"') })
  expect(mergeModelTiers({ simple: 3 })).toMatchObject({ error: expect.stringContaining('modelTiers.simple') })
})
