// Which model a fleet worker runs on, from an explicit choice or the complexity of its task. Nothing here touches `$`.
import { CLASSIFY_TEXT_MAX, COMPLEXITY_TIERS, DEFAULT_MODEL_TIERS } from './constants'

export type ComplexityTier = (typeof COMPLEXITY_TIERS)[number]

export type ModelTiers = Record<ComplexityTier, string>

export function isComplexityTier(label: string | undefined): label is ComplexityTier {
  return COMPLEXITY_TIERS.some(tier => tier === label)
}

// Undefined leaves the choice to the engine: the worker inherits the lead's model.
export function resolveModel(explicit: string | undefined, tier: ComplexityTier | undefined, tiers: ModelTiers): string | undefined {
  if (explicit) return isComplexityTier(explicit) ? tiers[explicit] : explicit
  return tier ? tiers[tier] : undefined
}

export function classificationText(parts: readonly (string | null | undefined)[]): string {
  return parts
    .map(part => part?.trim() ?? '')
    .filter(Boolean)
    .join('\n')
    .slice(0, CLASSIFY_TEXT_MAX)
}

export function mergeModelTiers(raw: unknown): ModelTiers | { error: string } {
  if (raw === undefined) return { ...DEFAULT_MODEL_TIERS }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'modelTiers must be an object of tier names to models' }
  const merged: ModelTiers = { ...DEFAULT_MODEL_TIERS }
  for (const [key, value] of Object.entries(raw)) {
    if (!isComplexityTier(key)) return { error: `modelTiers has an unknown tier "${key}" (known: ${COMPLEXITY_TIERS.join(', ')})` }
    if (typeof value !== 'string' || !value.trim()) return { error: `modelTiers.${key} must be a model name` }
    merged[key] = value.trim()
  }
  return merged
}
