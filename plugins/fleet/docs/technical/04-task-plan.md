# Task plan: parser, dependências e run

## Datas

- Criado em: 2026-11-03
- Última atualização: 2026-11-03

Módulos: [hooks/taskFile.ts](../../hooks/taskFile.ts), [hooks/run.ts](../../hooks/run.ts) e, em [hooks/register.tsx](../../hooks/register.tsx), as funções `readPlan`, `writeMarks`, `loadPlan`, `startRun`, `advanceRun` e `endIfHalted`.

## Formato do arquivo

Um arquivo Markdown por plano em `.claude/fleet/tasks/<nome>.md` (`TASKS_DIR`, `TASK_FILE_EXT` em [hooks/constants.ts](../../hooks/constants.ts):12-13). O título do plano é a primeira linha `# ...` (`TASK_TITLE_LINE`). Cada item é uma linha:

```text
- [<marca>] <ID>: <descrição> [@agente] [needs: A, B]
```

| Marca | Status | Constante |
|-------|--------|-----------|
| `[ ]` | `pending` | `TASK_MARKS` |
| `[~]` | `in_progress` | idem |
| `[x]` ou `[X]` | `completed` | idem |
| `[-]` | `cancelled` | idem |

Expressões (`constants.ts:16-19`):

- `TASK_LINE`: `^(\s*[-*]\s+\[)([ ~xX-])(\]\s+)([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$`. Aceita `-` ou `*` como marcador e indentação.
- `TASK_AGENT_TAG`: `@agente` em qualquer posição da descrição, com letras, dígitos, `:`, `_`, `-` (permite `dr:nodejs-specialist`).
- `TASK_NEEDS_TAG`: `needs: A, B` (sem diferenciar maiúsculas), ids separados por vírgula.

## Parser (`parseTaskFile`, `taskFile.ts:32`)

1. Percorre as linhas; cada linha que casa com `TASK_LINE` vira um `TaskItem` (`parseLine`, `:49`). Linhas que não casam são ignoradas.
2. Em `parseLine`, `@agente` e `needs:` são extraídos e removidos da descrição, e os espaços são normalizados.
3. Id repetido gera o erro `<id> is listed twice` e o duplicado é descartado.
4. Depois de ler tudo, cada `needs` com id inexistente gera `<id> needs <x>, which is not in the plan`; auto-dependência gera `<id> needs itself`.
5. Retorna `{ title, items, errors }`: o plano sai mesmo com erros, para o painel poder mostrar o que foi lido.

Não há detecção de ciclos de dependência com mais de um item. Um ciclo A-B não é reportado como erro: nenhum dos dois fica pronto e o run termina halted por `plan.waiting` (ver abaixo).

`readPlan` (`register.tsx:783`) transforma erros do parser, arquivo ausente e plano sem itens em `{ error }`. Qualquer erro do parser bloqueia `plan` e `run` do plano.

## Gravação de marcas

`setMark(text, id, status)` (`taskFile.ts:61`) troca somente o caractere da marca da linha cujo id confere; o restante do arquivo é preservado byte a byte. `writeMarks` (`register.tsx:800`) lê o arquivo, aplica `setMark` a cada id, grava e atualiza `taskItems` em estado. Falha de leitura ou escrita é registrada no log e o estado segue mesmo assim.

Quem escreve marcas: apenas o líder.

| Evento | Marca gravada |
|--------|---------------|
| Unidade despachada (`advanceRun`) | `[~]` |
| Worker envia `DONE` (`onReport`) | `[x]` |
| Worker parado com `/fleet stop` (`stopWorker`) | `[ ]` |

O arquivo é relido em todo despacho (`advanceRun` chama `readPlan`), então edições feitas entre ticks são vistas.

## Resolução de dependências (`readyUnits`, `taskFile.ts:78`)

Entradas: os itens e os ids já em execução (`running`).

- `settled` = ids com status `completed` ou `cancelled`.
- `pending` = itens `pending` que não estão em `running`.
- `ready` = `pending` cujos `needs` estão todos em `settled`.
- Saída: `units` (uma unidade por item pronto, na ordem do arquivo, com `tasks: [id]`), `done` e `waiting` (pendentes que não estão prontos).
- `done` é verdadeiro quando nenhum item está `pending` ou `in_progress` e `running` está vazio.

Cada unidade contém exatamente um item no código atual. O tipo `PlanUnit` já permite vários ids (`tasks: string[]`) e `unitWorkerName` junta ids com `-`, mas nada no código atual agrupa itens.

## Run

`RunState` e seus reducers estão em [hooks/run.ts](../../hooks/run.ts):

| Função | Efeito |
|--------|--------|
| `unitWorkerName` | `task-<ids unidos por '-'>` (`TASK_WORKER_PREFIX`) |
| `pickUnits(units, room)` | Primeiras `room` unidades (nunca negativo) |
| `startUnit` | Registra worker para ids e acrescenta a `running` |
| `finishUnit` | Remove de `running` e acrescenta a `finished` sem duplicar |
| `rebindUnit` | Move a reserva para outro nome (worker iniciado com nome diferente do reservado) |
| `releaseUnit` | Tira a unidade de `running` e marca `halted` com o motivo |

Fluxo em `register.tsx`:

1. `startRun` (`:831`) lê o plano (`loadPlan`), recusa se já houver run e grava `run = { task, model, units: {}, running: [], finished: [] }`.
2. `advanceRun` (`:844`) é protegido por `live.isAdvancing`. Em ordem: run com `halted` vai a `endIfHalted`; relê o plano; `plan.done` encerra o run com toast; sem unidades prontas e sem nada em execução, grava `halted` com o motivo (`<ids> wait on items that are not done` ou `no item is ready`); caso contrário calcula `room = maxWorkers - liveCount` e despacha até `room` unidades.
3. Para cada unidade, o brief vem de `planBrief` (que manda o worker ler o arquivo do plano e não editá-lo, e troca `DONE` por `DONE <ids>` na regra de relatório). Item com `@agente` mantém o modelo do agente; item sem agente é classificado por complexidade a partir da descrição (ver [05-modelo-e-politica.md](05-modelo-e-politica.md)). `--model` do run vale para todas as unidades.
4. Spawn recusado: grava `halted` com o motivo e não tenta de novo; o run termina quando as unidades em execução reportarem (`endIfHalted`).
5. Spawn enfileirado (limite de workers): a unidade já conta como em execução; `drainQueue` (`:625`) a inicia depois e usa `rebindUnit` se o nome mudou ou `releaseUnit` se foi recusada.

`/fleet plan` sem nome lista os arquivos `.md` de `.claude/fleet/tasks/` (`listPlans`); com nome, carrega os itens, abre a aba `tasks` e abre o painel.

## Change History

- Created: 2026-11-03
