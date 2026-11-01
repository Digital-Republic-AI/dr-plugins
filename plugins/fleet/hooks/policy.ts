// What a fleet worker may call, read from an editable policy file. Nothing here touches `$`.
import type { ModelTiers } from './modelChoice'
import { mergeModelTiers } from './modelChoice'

export type WorkerPolicy = { allowedMcpServers: string[]; deniedCommands: string[]; modelTiers: ModelTiers }

export type TeammateIdentity = { name: string; parentSessionId: string }

export const MCP_TOOL_PREFIX = 'mcp__'
const MCP_NAME_SEPARATOR = '__'
const GIT = 'git'
// Global git options that take the next word as their value.
const GIT_OPTIONS_WITH_VALUE = ['-C', '-c', '--git-dir', '--work-tree', '--namespace']
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
const COMMAND_SEPARATORS = /&&|\|\||;|\||\n/
// Tools that reach an MCP server named in their input rather than in their name.
const MCP_RESOURCE_TOOLS = ['ListMcpResourcesTool', 'ReadMcpResourceTool']

export function parsePolicy(text: string): WorkerPolicy | { error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (err) {
    return { error: `not JSON: ${String(err)}` }
  }
  const p = (raw ?? {}) as Record<string, unknown>
  const servers = p['allowedMcpServers']
  const commands = p['deniedCommands']
  if (!isStringList(servers) || !isStringList(commands)) return { error: 'allowedMcpServers and deniedCommands must be lists of strings' }
  const modelTiers = mergeModelTiers(p['modelTiers'])
  if ('error' in modelTiers) return modelTiers
  return { allowedMcpServers: servers, deniedCommands: commands, modelTiers }
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string')
}

// Reads the teammate flags the engine launches a split-pane worker with, from
// the command lines of the process and its ancestors.
export function teammateIdentity(commandLines: string): TeammateIdentity | null {
  for (const line of commandLines.split('\n')) {
    const name = flagValue(line, '--agent-name')
    const parentSessionId = flagValue(line, '--parent-session-id')
    if (name && parentSessionId) return { name, parentSessionId }
  }
  return null
}

function flagValue(line: string, flag: string): string | undefined {
  const words = line.trim().split(/\s+/)
  const at = words.indexOf(flag)
  return at >= 0 ? words[at + 1] : undefined
}

export function mcpServerOf(tool: string): string | null {
  if (!tool.startsWith(MCP_TOOL_PREFIX)) return null
  const server = tool.slice(MCP_TOOL_PREFIX.length).split(MCP_NAME_SEPARATOR)[0]
  return server || null
}

// Answers the denied entry a shell command runs, if any. Each segment of a
// compound command is checked; git global options (`git -C dir stash`) are
// skipped, and an entry's extra words (`git checkout --`) must all appear.
export function deniedCommand(command: string, denied: readonly string[]): string | null {
  for (const segment of command.split(COMMAND_SEPARATORS)) {
    const words = segment.trim().split(/\s+/).filter(Boolean)
    while (words[0] && ENV_ASSIGNMENT.test(words[0])) words.shift()
    const hit = denied.find(entry => matches(words, entry.trim().split(/\s+/)))
    if (hit) return hit
  }
  return null
}

function matches(words: readonly string[], entry: readonly string[]): boolean {
  if (!words.length || !entry.length) return false
  if (basename(words[0]!) !== entry[0]) return false
  if (entry.length === 1) return true
  if (entry[0] !== GIT) return entry.every((w, i) => words[i] === w)
  const args = gitArgs(words)
  return args[0] === entry[1] && entry.slice(2).every(w => args.slice(1).includes(w))
}

function gitArgs(words: readonly string[]): string[] {
  let i = 1
  while (i < words.length && words[i]!.startsWith('-')) i += GIT_OPTIONS_WITH_VALUE.includes(words[i]!) ? 2 : 1
  return words.slice(i)
}

function basename(word: string): string {
  return word.slice(word.lastIndexOf('/') + 1)
}

export function policyDenial(tool: string, input: Record<string, unknown>, policy: WorkerPolicy): string | null {
  const server = mcpServerOf(tool) ?? (MCP_RESOURCE_TOOLS.includes(tool) && typeof input['server'] === 'string' ? input['server'] : null)
  if (server && !policy.allowedMcpServers.includes(server)) {
    return `Fleet workers may only use the MCP servers ${policy.allowedMcpServers.join(', ') || '(none)'}; "${server}" is not allowed.`
  }
  if (tool === 'Bash' && typeof input['command'] === 'string') {
    const hit = deniedCommand(input['command'], policy.deniedCommands)
    if (hit) return `Fleet workers may not run "${hit}": other workers share this working tree. Report it to the team lead instead.`
  }
  return null
}
