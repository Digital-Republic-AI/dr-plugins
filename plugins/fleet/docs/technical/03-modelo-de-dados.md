# Modelo de dados

## Datas

- Criado em: 2026-11-03
- Última atualização: 2026-11-03

Os tipos de domínio estão em [types/index.d.ts](../../types/index.d.ts). Os tipos de comando, plano, política e interpretação ficam nos módulos que os usam.

## Tipos de domínio (`types/index.d.ts`)

| Tipo | Linha | Descrição |
|------|-------|-----------|
| `Source` | 1 | `'manual'` ou `'task'` (origem do worker) |
| `WorkerStatus` | 5 | Valores do engine (`pending`, `running`, `waiting`, `idle`, `completed`, `failed`, `killed`) mais `stale` (pane silencioso) e `unknown` (sem entrada no roster) |
| `WorkerTask` | 7 | `{ source, ref, title }` |
| `Worker` | 9 | `name`, `agentId`, `teammateId?`, `status`, `task?`, `startedAt`, `lastSeenAt`, `lastText?`, `isDone`, `label?`. O endereço no engine continua sendo `name`; `label` é só o nome de exibição de `/fleet rename`. Em worker encerrado, `lastSeenAt` é o instante do encerramento |
| `QueueItem` | 23 | Pedido de spawn aguardando vaga: `name`, `brief`, `title`, `task?`, `agentType?`, `unit?` (ids do plano), `model?`, `complexityText?` |
| `RunState` | 37 | `task`, `model?`, `units` (worker para ids), `running`, `finished`, `halted?` |
| `FleetTab`, `FleetView` | 49-51 | Aba (`workers`/`tasks`), worker selecionado, plano mostrado, modo de composição |
| `TaskStatus`, `TaskItem` | 55-57 | Item do plano: `id`, `description`, `status`, `agent`, `needs` |
| `WorkerTaskStatus`, `WorkerTaskItem` | 60-62 | Item da lista do próprio worker: `id`, `subject`, `status` |
| `WorkerTasksInput`, `WorkerTasksResult`, `LeadCommandInput` | 65-71 | Contrato das duas ferramentas do mod |

A seção `declare module 'claude-code'` (linha 73) acrescenta `mcp__fleet__tasks` e `mcp__fleet__command` a `BuiltinToolInputs` e `BuiltinToolResults`, e declara `PluginState.fleet` com os oito átomos.

## Estado persistente da sessão (átomos)

Declarados em [hooks/register.tsx](../../hooks/register.tsx):107-117, com `plugin: 'fleet'`. O comentário no código explica que o escaneamento de estado do engine só lê um átomo onde a referência é escrita, por isso as declarações ficam nesse arquivo.

| Átomo | Tipo | Valor inicial | Escrito por |
|-------|------|---------------|-------------|
| `workers` | `Worker[]` | `[]` | spawn, roster, mensagens, idle, stop, rename |
| `queue` | `QueueItem[]` | `[]` | `spawnWorker` (enfileira), `drainQueue` (consome) |
| `log` | `string[]` | `[]` | `note` (máximo `MAX_LOG` = 60 linhas, `format.ts:4`) |
| `view` | `FleetView` | `{ tab: 'workers' }` | painel, `loadPlan` |
| `relay` | `boolean` | `false` | `setRelay` |
| `run` | `RunState \| null` | `null` | `startRun`, `advanceRun`, `onReport`, `stopWorker` |
| `taskItems` | `TaskItem[]` | `[]` | `loadPlan`, `advanceRun`, `writeMarks` |
| `workerTasks` | `WorkerTaskItem[]` | `[]` | `trackTasks` (só em worker) |
| `isWorker` | `boolean \| null` | `null` | `session.start` |

## Estado só do módulo (`live`)

Declarado em `register.tsx:120-144` e reinicializado em cada `register`. Perde-se no hot reload e é reconstruído em `session.start`. Campos: `tick`, `maxWorkers`, `isAdvancing` (trava de reentrância de `advanceRun`), `tickCheck`, `workerPolicy`, `modelTiers`, `spinner`, `spinnerFrame`, `shadeStep`, `isWorking`, `backgroundPoll`, `isPollingBackground`, `hasBackgroundWork`, `identity`, `label`.

## Chaves do store (`$.store`)

| Chave | Conteúdo | Quem grava | Quem lê |
|-------|----------|------------|---------|
| `relay` | `boolean` | líder (`setRelay`) | líder (`loadPrefs`) |
| `maxWorkers` | número inteiro positivo | não encontrado nenhum escritor no plugin; lido em `loadPrefs` | líder |
| `workers:<sessionId do líder>` | lista de nomes de workers | líder (`recordWorker`) | worker (`resolveWorkerPolicy`) |
| `labels:<sessionId do líder>` | `{ [nome]: label }` | líder (`renameCommand`) | worker (`readOwnLabel`) |

O prefixo e as chaves vêm de `STORE_*` em [hooks/constants.ts](../../hooks/constants.ts):25-26, 52 e 161.

## Tipos de módulos

- `Command` ([hooks/commands.ts](../../hooks/commands.ts):3): união discriminada por `kind`.
- `Interpretation` ([hooks/interpreter.ts](../../hooks/interpreter.ts):7): `{ commands } | { reply } | { error }`.
- `TaskPlan`, `PlanUnit`, `ReadyPlan` ([hooks/taskFile.ts](../../hooks/taskFile.ts):7-11).
- `WorkerPolicy`, `TeammateIdentity` ([hooks/policy.ts](../../hooks/policy.ts):5-7).
- `ComplexityTier`, `ModelTiers` ([hooks/modelChoice.ts](../../hooks/modelChoice.ts):4-6).
- `Spawned` ([hooks/workers.ts](../../hooks/workers.ts):103), `SpawnOutcome` e `SpawnRequest` (`register.tsx:148-150`).
- `PaneData`, `PaneActions` ([hooks/pane.tsx](../../hooks/pane.tsx):10-30), `WorkerBandData` ([hooks/workerView.tsx](../../hooks/workerView.tsx):32).

## Invariantes observados

- Um worker encerrado (`isDone`) nunca volta a estar vivo; `markIdle` e `renameWorker` o ignoram.
- `findWorker` procura por `name`, depois `label`, depois `agentId`/`teammateId`.
- `uniqueName` considera nomes e labels como ocupados (`base`, `base-2`, `base-3`...).
- Um `Worker` mantém no máximo `MAX_ENDED_WORKERS` (5) encerrados, e nenhum com mais de `ENDED_WORKER_TTL_MS` (1 hora) desde o encerramento (`pruneEnded`).

## Change History

- Created: 2026-11-03
