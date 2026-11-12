# Constantes relevantes

## Datas

- Criado em: 2026-11-03
- Última atualização: 2026-11-03

A regra do projeto manda guardar números e textos fixos em constantes nomeadas. A maior parte está em [hooks/constants.ts](../../hooks/constants.ts); algumas ficam no módulo que as usa. Números de linha referem-se a esse arquivo, salvo indicação.

## Identificadores do plugin

| Constante | Valor | Linha | Uso |
|-----------|-------|-------|-----|
| `PANE` / `PANE_TITLE` | `fleet` / `Fleet` | 3-4 | Id e título do painel |
| `COMMAND` | `fleet` | 5 | Nome do slash command |
| `POLL_MS` | 2000 | 6 | Período do polling do líder |
| `TEAM_MODES_WITH_PANES` | `tmux`, `iterm2`, `auto` | 8 | Valores de `teammateMode` que abrem panes |
| `NEW_WORKER_BASE` | `w1` | 28 | Nome base do botão "n:new" |

## Task plan

| Constante | Linha | Uso |
|-----------|-------|-----|
| `TASKS_DIR` (`.claude/fleet/tasks`), `TASK_FILE_EXT` (`.md`) | 12-13 | Local dos planos |
| `TASK_MARKS`, `TASK_MARK_OF` | 14-15 | Marca para status e vice-versa |
| `TASK_LINE`, `TASK_AGENT_TAG`, `TASK_NEEDS_TAG`, `TASK_TITLE_LINE` | 16-19 | Expressões do parser (ver [04-task-plan.md](04-task-plan.md)) |
| `TASK_GLYPHS` | 21 | Glifos do painel por status |
| `TASK_WORKER_PREFIX` | 23 | `task-` |

## Store

| Constante | Valor | Linha |
|-----------|-------|-------|
| `STORE_RELAY` | `relay` | 25 |
| `STORE_MAX_WORKERS` | `maxWorkers` | 26 |
| `STORE_WORKERS_PREFIX` | `workers:` | 52 |
| `STORE_LABELS_PREFIX` | `labels:` | 161 |

`maxWorkers` é lido em `loadPrefs` mas nenhum código do plugin o grava; o padrão efetivo é `DEFAULT_MAX_WORKERS` = 4 ([hooks/workers.ts](../../hooks/workers.ts):7). Quem define o valor é um escritor externo, não identificado no código.

## Limites de texto e do painel

| Constante | Valor | Linha |
|-----------|-------|-------|
| `TOAST_TEXT`, `LOG_MESSAGE_TEXT`, `LOG_SENT_TEXT`, `ERROR_TEXT` | 80, 120, 100, 200 | 31-34 |
| `LOG_ROWS`, `TASK_ROWS`, `MAX_SELECTABLE` | 6, 12, 9 | 37-39 |
| `MIN_PANE_COLUMNS`, `MIN_TASK_COLUMNS`, `WORKER_ROW_COLUMNS`, `SEPARATOR_COLUMNS` | 20, 8, 30, 40 | 40-43 |
| `MAX_ENDED_WORKERS` | 5 | 46 |
| `ENDED_WORKER_TTL_MS` | 3 600 000 (1 h) | 48 |
| `MAX_TEXT`, `MAX_LOG` | 400, 60 | [hooks/format.ts](../../hooks/format.ts):3-4 |
| `TASK_TITLE_MAX` | 60 | [hooks/briefs.ts](../../hooks/briefs.ts):8 |
| `STALE_MS` | 600 000 (10 min) | [hooks/workers.ts](../../hooks/workers.ts):6 |

## Guarda do worker

| Constante | Linha | Uso |
|-----------|-------|-----|
| `DEFAULT_POLICY_PATH` (`worker/policy.json`), `PROJECT_POLICY_PATH` (`.claude/fleet/worker-policy.json`) | 53-54 | Política padrão e sobrescrita |
| `DEFAULT_INSTRUCTIONS_PATH`, `PROJECT_INSTRUCTIONS_PATH` | [briefs.ts](../../hooks/briefs.ts):9-10 | Instruções padrão e sobrescrita |
| `ANCESTRY_SCRIPT` | 56 | Lê os comandos dos 4 primeiros ancestrais do shell |
| `WORKER_COMMAND_REFUSED` | 157 | Texto da recusa do comando em worker |
| `WORKER_PANE_REFUSED` | 99 | Texto da recusa de painel em worker |
| `WORKER_HIDDEN_ATTACHMENT_TYPES`, `WORKER_HIDDEN_ATTACHMENT_TEXT` | 103, 105 | Attachments escondidos (nome do tipo não verificado) |
| `LEAD_NAME` (`team-lead`), `DONE_PREFIX`, `BLOCKED_PREFIX` | [briefs.ts](../../hooks/briefs.ts):5-7 | Protocolo de relatório |
| `IDLE_NOTIFICATION` (`idle_notification`) | [workers.ts](../../hooks/workers.ts):9 | Aviso JSON de idle do engine |

## Modelos

| Constante | Linha | Valor |
|-----------|-------|-------|
| `MODEL_FLAG`, `TYPE_FLAG` | 109, 111 | `--model`, `--type` |
| `COMPLEXITY_TIERS` | 112 | `simple`, `standard`, `complex` |
| `DEFAULT_MODEL_TIERS` | 113 | `haiku`, `sonnet`, `opus` |
| `CLASSIFY_TEXT_MAX` | 115 | 2000 |
| `FLEET_INTERPRETER_MODEL`, `FLEET_INTERPRETER_MAX_TOKENS` | 140-141 | `haiku`, 1024 |
| `FLEET_INTERPRETER_SYSTEM` | 142 | Prompt de sistema do interpretador: exige um objeto JSON com `commands` ou `reply` |

## Ferramentas registradas

| Constante | Valor |
|-----------|-------|
| `WORKER_TASKS_TOOL_NAME` / `WORKER_TASKS_TOOL` | `tasks` / `mcp__fleet__tasks` |
| `LEAD_COMMAND_TOOL_NAME` / `LEAD_COMMAND_TOOL` | `command` / `mcp__fleet__command` |
| `WORKER_TASKS_TOOL_SCHEMA`, `LEAD_COMMAND_TOOL_SCHEMA` | Esquemas de entrada (linhas 123 e 152) |

## Aparência da banda do worker

Linhas 58-97: título (`WORKER_TITLE`), linhas reservadas à moldura (`WORKER_LIST_CHROME_ROWS` = 4, `WORKER_BAND_FRAME_COLUMNS` = 2), rampa de cores em hex (`WORKER_SHADE_RAMP`, 4 passos; passo 0 é o visual ocioso), `WORKER_SPINNER_FRAMES` (10 quadros), `WORKER_SPINNER_MS` = 120, `WORKER_BACKGROUND_POLL_MS` = 1000, barra de progresso de `WORKER_PROGRESS_CELLS` = 10 células. As cores são hex porque uma chave de tema não pode ser graduada, conforme o comentário do arquivo.

## Change History

- Created: 2026-11-03
