// What a fleet worker's model reads of the lead's prompt setup. Nothing here touches `$`.

export function isHiddenAttachment(type: string, text: string | null, hiddenTypes: readonly string[], hiddenText: RegExp): boolean {
  return hiddenTypes.includes(type) || (text !== null && hiddenText.test(text))
}
