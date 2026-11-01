import { expect, test } from 'claude-code/testing'

import { DEFAULT_MODEL_TIERS } from './constants'
import { deniedCommand, mcpServerOf, parsePolicy, policyDenial, teammateIdentity } from './policy'

const policy = { allowedMcpServers: ['docs'], deniedCommands: ['git stash', 'git reset', 'git clean', 'git checkout --'], modelTiers: { ...DEFAULT_MODEL_TIERS } }

test('a policy file parses, and a malformed one says why', () => {
  expect(parsePolicy(JSON.stringify(policy))).toEqual(policy)
  expect(parsePolicy('{')).toMatchObject({ error: expect.stringContaining('not JSON') })
  expect(parsePolicy('{"allowedMcpServers": "docs"}')).toMatchObject({ error: expect.stringContaining('lists of strings') })
})

test('the model tiers default when absent, take a partial override, and a bad value is an error', () => {
  const { modelTiers: _omitted, ...withoutTiers } = policy
  expect(parsePolicy(JSON.stringify(withoutTiers))).toEqual({ ...withoutTiers, modelTiers: DEFAULT_MODEL_TIERS })
  expect(parsePolicy(JSON.stringify({ ...withoutTiers, modelTiers: { complex: 'claude-opus-5-5' } }))).toEqual({ ...withoutTiers, modelTiers: { ...DEFAULT_MODEL_TIERS, complex: 'claude-opus-5-5' } })
  expect(parsePolicy(JSON.stringify({ ...withoutTiers, modelTiers: { standard: 7 } }))).toMatchObject({ error: expect.stringContaining('modelTiers.standard') })
})

test('the teammate identity is read from the launch flags of any ancestor', () => {
  const lines = ['sh -c ps', '/usr/local/claude --agent-id w1@session-1 --agent-name w1 --team-name session-1 --parent-session-id 9b17 --model opus'].join('\n')
  expect(teammateIdentity(lines)).toEqual({ name: 'w1', parentSessionId: '9b17' })
  expect(teammateIdentity('/usr/local/claude --model opus')).toBeNull()
})

test('MCP servers are read from tool names', () => {
  expect(mcpServerOf('mcp__docs__search')).toBe('docs')
  expect(mcpServerOf('mcp__claude_ai_WW_1__search')).toBe('claude_ai_WW_1')
  expect(mcpServerOf('Bash')).toBeNull()
})

test('denied commands are found in compound commands, behind git options and env assignments', () => {
  expect(deniedCommand('git stash', policy.deniedCommands)).toBe('git stash')
  expect(deniedCommand('git -C /repo stash pop', policy.deniedCommands)).toBe('git stash')
  expect(deniedCommand('npm test && /usr/bin/git reset --hard', policy.deniedCommands)).toBe('git reset')
  expect(deniedCommand('GIT_PAGER=cat git clean -fd', policy.deniedCommands)).toBe('git clean')
  expect(deniedCommand('git checkout -- src/a.ts', policy.deniedCommands)).toBe('git checkout --')
  expect(deniedCommand('git checkout -b feature', policy.deniedCommands)).toBeNull()
  expect(deniedCommand('git status && git diff', policy.deniedCommands)).toBeNull()
  expect(deniedCommand('echo "git stash is denied"', policy.deniedCommands)).toBeNull()
  expect(deniedCommand('git -C /repo log', ['git'])).toBe('git')
})

test('the policy denies other MCP servers and denied commands, and lets the rest through', () => {
  expect(policyDenial('mcp__docs__search', {}, policy)).toBeNull()
  expect(policyDenial('mcp__plaud__list_files', {}, policy)).toContain('"plaud" is not allowed')
  expect(policyDenial('ReadMcpResourceTool', { server: 'plaud', uri: 'x' }, policy)).toContain('"plaud"')
  expect(policyDenial('Bash', { command: 'git stash list' }, policy)).toContain('git stash')
  expect(policyDenial('Bash', { command: 'git log -1' }, policy)).toBeNull()
  expect(policyDenial('Edit', { file_path: 'a.ts' }, policy)).toBeNull()
})
