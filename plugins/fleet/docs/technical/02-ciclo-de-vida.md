# Ciclo de vida

## Datas

- Criado em: 2026-11-03
- Última atualização: 2026-11-03

Todas as referências abaixo são de [hooks/register.tsx](../../hooks/register.tsx), salvo indicação.

## 1. Registro e início de sessão

`register` (`:152`) zera o estado de módulo (`live`) a cada carga (primeira, hot reload, teste) e registra os hooks. O estado de sessão persiste nos átomos (ver [03-modelo-de-dados.md](03-modelo-de-dados.md)).

`session.start` (`:171`), nesta ordem:

1. Inicia `workerPolicy($)` sem aguardar, antes do primeiro desenho.
2. `next(e)`, depois `$.command.register` do comando `fleet`.
3. `loadPrefs` (`:324`): lê `relay` e `maxWorkers` do store (`maxWorkers` inválido volta a `DEFAULT_MAX_WORKERS`, 4).
4. `reconcile` (`:433`): lê o roster, mescla, adota teammates desconhecidos e poda workers encerrados.
5. Aguarda a guarda, grava `isWorker` e chama `armWorker` ou `armLead`.

`session.end` (`:193`) cancela apenas o spinner (`stopSpinner`). O polling de background (`stopBackgroundPoll`) é cancelado só no início de `register`; não foi confirmado se o engine descarta o timer ao encerrar a sessão.

## 2. Resolução do papel (guarda do worker)

`resolveWorkerPolicy` (`:718`):

1. Executa `ANCESTRY_SCRIPT` (comandos do processo pai e ancestrais, até 4 níveis) via `$.process.run`.
2. `teammateIdentity` (`policy.ts:41`) procura `--agent-name` e `--parent-session-id` nas linhas.
3. Sem identidade, a sessão não é worker (`null`).
4. Com identidade, consulta o store em `workers:<parentSessionId>`; o nome precisa constar na lista gravada pelo líder em `recordWorker` (`:700`, chamado antes do `$.agent.spawn`). Caso contrário, `null`.
5. Guarda a identidade em `live.identity` e carrega a política (`loadPolicy`, `:730`).

Se a política não puder ser lida, o worker recebe o fallback estrito: nenhum servidor MCP e `deniedCommands: ['git']` (`:734`). Se a própria guarda lançar erro, `workerPolicy` (`:709`) informa no status, grava no log de debug e devolve `null` (a sessão passa como não worker). A promessa nunca rejeita.

## 3. Hooks registrados

| Hook | Linha | Efeito |
|------|-------|--------|
| `session.start` | 171 | Ver seção 1 |
| `session.end` | 193 | Cancela o spinner |
| `command.run` (`fleet`) | 198 | `runCommand(parseCommand(args))` |
| `agent.spawn` | 202 | Teammates que o modelo líder criou (com `name`) entram no fleet; o `$.agent.spawn` do próprio mod não passa por aqui |
| `session.receive` | 214 | Mensagens de teammates (seção 6) |
| `classic.TeammateIdle` | 235 | Marca idle e, se a última fala era `DONE`, chama `onReport` |
| `tool.call` (todas) | 246 | Política do worker e rastreio da lista de tarefas |
| `tool.call` (`mcp__fleet__tasks`) | 257 | Serve a ferramenta de lista do worker |
| `tool.call` (`mcp__fleet__command`) | 262 | Serve a ferramenta do líder; recusa em worker (`WORKER_COMMAND_REFUSED`) |
| `prompt.attachment` | 272 | Em worker, descarta attachments de `output_style` |
| `ui.open` | 281 | Em worker, recusa qualquer painel |
| `ui.render` `Pane` (`requestId: fleet`) | 283 | `renderPane` |
| `ui.render` `AbovePrompt` | 288 | Banda de tarefas do worker |
| `ui.render` `AssistantMessage`, `ToolUse`, `ToolResult`, `ToolGroup`, `UserMessage`, `Spinner`, `TurnDuration`, `ToolProgress` | 294-301 | Escondem a transcrição no worker (`hideForWorker`) |

Quase todo hook encadeia `.catch(... hookFailed ...)`: uma falha vai para a linha de status e para o log do painel (ou para o log de debug, quando o hook roda dentro de um desenho) e o evento segue adiante. Exceções: o hook de `ui.render` `Pane` (`:283`) e o `tool.call` de `mcp__fleet__tasks` (`:257`) não têm `.catch`.

## 4. Comandos

`runCommand` (`:348`) é o ponto único: o slash command, o texto livre e a ferramenta do líder chegam aqui. Os tipos de comando vêm de [hooks/commands.ts](../../hooks/commands.ts): `open`, `help`, `spawn`, `send`, `stop`, `rename`, `plan`, `run`, `relay`, `error`, `natural`.

Texto livre (`natural`): `runRequest` (`:382`) chama `$.model.complete` com o modelo `haiku` (`FLEET_INTERPRETER_MODEL`), prompt montado por `interpreterPrompt` e resposta lida por `parseInterpretation`. Cada linha devolvida passa por `parseCommand` e é executada por `runInterpreted` (`:401`); linhas que resultam em `error`, `natural` ou `help` são mostradas e não executadas, o que impede laço de volta ao interpretador.

## 5. Spawn de worker

`spawnWorker` (`:490`):

1. `teamsReady` (`:472`) exige `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` ligado (env ou `settings.env`) e `teammateMode` em `tmux`, `iterm2` ou `auto`. Caso contrário devolve `refused` com instruções.
2. Se `liveCount >= live.maxWorkers`, o pedido vai para a fila (`queue`) e devolve `queued`.
3. `uniqueName` garante nome único; `chooseModel` (`:536`) escolhe o modelo (ver [05-modelo-e-politica.md](05-modelo-e-politica.md)).
4. `recordWorker` grava o nome no store antes do spawn.
5. `$.agent.spawn({ name, prompt: brief, description, subagentType, model })`. Se vier `deny`, devolve `refused`.
6. `reduceSpawned` registra o worker (`agentId` provisório = nome quando o engine não devolve id); `ensureTick` liga o polling.

O brief do worker é montado por `manualBrief` (spawn manual) ou `planBrief` (item de plano) em [hooks/briefs.ts](../../hooks/briefs.ts): tarefa, instruções compartilhadas (`worker/instructions.md`, sobrescrevível por `.claude/fleet/worker-instructions.md`) e a regra de relatório (`DONE`/`BLOCKED` ao `team-lead`), que fica no código porque o hook `session.receive` depende dela.

`spawnManualList` (`:527`) cria um nome por vez, para que cada spawn veja os workers do anterior.

## 6. Envio de tarefa, coleta de resultado e relay

- **Envio** (`sendTo`, `:641`): `$.session.send` endereçado pelo `agentId`; falha de entrega vai ao log.
- **Parada** (`stopWorker`, `:652`): `$.tool.call` de `TaskStop` com `task_id = agentId`; marca o worker como `killed`; se pertencia a um run, devolve os itens a `pending` no arquivo (`writeMarks`) e chama `finishUnit`.
- **Coleta** (`session.receive`, `:214`): ignora origem que não seja teammate e mensagens do `team-lead`. O aviso JSON `idle_notification` marca o worker idle e é consumido (o modelo líder não o vê). Qualquer outra mensagem atualiza `lastText`/`lastSeenAt`, grava no log, mostra um toast e, se começar com `DONE`, chama `onReport`.
- **`onReport`** (`:672`): se o remetente tem unidade no run, marca os itens como `completed` no arquivo, chama `finishUnit`, marca o worker como encerrado e chama `advanceRun`.
- **Relay** (`relay` on/off, persistido no store): com relay desligado, a mensagem é consumida e fica só no painel; com relay ligado, ou se começar com `BLOCKED`, segue para o modelo líder (`next(e)`). `isReport` compara o prefixo sem diferenciar maiúsculas.
- **Idle por hook clássico** (`classic.TeammateIdle`, `:235`): relê `lastText` e, se for `DONE`, processa o relatório.

## 7. Polling

`ensureTick` (`:452`) encadeia verificações em `live.tickCheck` para nunca criar dois timers. `syncTick` liga `$.clock.every(POLL_MS)` (2000 ms) enquanto houver worker vivo e cancela quando não houver. Cada tick (`refresh`, `:466`): `reconcile`, `drainQueue` (um item da fila por tick, se houver vaga) e, havendo run, `advanceRun`.

`reduceRoster` (`workers.ts:129`) mescla o roster do engine: status do roster vence; status final fecha o worker; um `running` sem sinal por `STALE_MS` (10 min) vira `stale`.

## 8. Renderização

- **Painel do líder** (`renderPane`, `:903`): lê os átomos em paralelo e chama `paneTree` ([hooks/pane.tsx](../../hooks/pane.tsx)) com ações (`patchView`, `spawnNew`, `send`, `stop`, `setRelay`, `startRun`, `close`). Abas `workers` (hotkeys `1`-`9`, `n`, `m`, `k`, `r`) e `tasks` (`g` inicia o run), alternadas por `w` e `t`; `x` fecha. O log mostra as últimas `LOG_ROWS` linhas.
- **Worker** ([hooks/workerView.tsx](../../hooks/workerView.tsx)): a tela do worker mostra só a banda `AbovePrompt` com título `fleet worker <nome> · tasks · <atividade> · <progresso>`, a lista de tarefas e o frame verde que clareia enquanto trabalha (`shadeOf`, `WORKER_SHADE_RAMP`). Hooks de `ui.render` devolvem `<Box />` vazio para a transcrição.
- **Estado do spinner**: um hook de render não pode escrever estado nem criar timers; por isso `live.spinnerFrame`, `live.shadeStep` e `live.isWorking` ficam no módulo, e dois timers (`WORKER_SPINNER_MS` = 120 ms; `WORKER_BACKGROUND_POLL_MS` = 1000 ms) chamam `$.ui.invalidate('ui.render')`. O segundo também relê o label do worker no store (`readOwnLabel`).
- **Tela do worker antes da guarda**: o átomo `isWorker` começa `null`; um desenho anterior à resolução passa direto e é redesenhado depois.

## 9. Pontos não confirmados

- Ordem exata de entrega dos hooks `session.receive` e `classic.TeammateIdle` pelo engine (depende do engine, não do plugin).
- O nome do tipo de attachment `output_style` é suposição declarada no próprio código (`constants.ts:100-105`); há fallback por texto (`WORKER_HIDDEN_ATTACHMENT_TEXT`).

## Change History

- Created: 2026-11-03
