# Escolha de modelo e política do worker

## Datas

- Criado em: 2026-11-03
- Última atualização: 2026-11-03

Módulos: [hooks/modelChoice.ts](../../hooks/modelChoice.ts), [hooks/policy.ts](../../hooks/policy.ts), [hooks/workerPrompt.ts](../../hooks/workerPrompt.ts) e as funções correspondentes em [hooks/register.tsx](../../hooks/register.tsx). Arquivos consumidos: [worker/policy.json](../../worker/policy.json) e [worker/instructions.md](../../worker/instructions.md).

## Escolha de modelo

Tiers (`constants.ts:112-113`): `simple`, `standard`, `complex`, com padrões `haiku`, `sonnet`, `opus` (`DEFAULT_MODEL_TIERS`). O `worker/policy.json` do plugin repete esses valores em `modelTiers`.

`chooseModel` (`register.tsx:536`), por prioridade:

1. `req.model` (flag `--model`): `resolveModel` (`modelChoice.ts:13`) devolve a tabela de tiers se o valor for um tier (`simple`, `standard`, `complex`); caso contrário devolve o valor tal qual (alias ou id completo).
2. `req.complexityText` presente: `$.model.classify(texto, COMPLEXITY_TIERS)`; se o rótulo for um tier válido, usa o modelo do tier. Rótulo inválido ou falha de classificação é anotada no log e o modelo é herdado.
3. Nenhum dos dois: `undefined`, e o worker usa o modelo do agente ou o do líder.

Quem fornece `complexityText`: apenas o run, para itens sem `@agente` (`advanceRun`), montado por `classificationText` (descrições aparadas, unidas por quebra de linha, no máximo `CLASSIFY_TEXT_MAX` = 2000 caracteres). Spawn manual não classifica.

`modelTiers($)` (`register.tsx:618`) lê a tabela uma vez por carga (cache em `live.modelTiers`) a partir da política; se a política não puder ser lida, usa `DEFAULT_MODEL_TIERS`.

`mergeModelTiers` (`modelChoice.ts:26`): sem o campo, devolve os padrões; mescla tiers informados sobre os padrões; erro para valor que não seja objeto, tier desconhecido ou valor que não seja texto não vazio.

## Política do worker

Arquivo (`policy.json`): `allowedMcpServers` (lista de servidores MCP permitidos), `deniedCommands` (comandos de shell proibidos) e `modelTiers`. Padrão do plugin: nenhum servidor MCP permitido; proibidos `git stash`, `git reset`, `git clean`, `git checkout --`, `git restore`.

Resolução do arquivo (`readOverridable`, `register.tsx:685`): `.claude/fleet/worker-policy.json` do projeto, se existir; senão `worker/policy.json` do plugin (`PROJECT_POLICY_PATH`, `DEFAULT_POLICY_PATH`). O mesmo mecanismo vale para as instruções (`.claude/fleet/worker-instructions.md` e `worker/instructions.md`). A política do projeto substitui a do plugin por inteiro, sem mesclagem campo a campo.

`parsePolicy` (`policy.ts:19`) exige `allowedMcpServers` e `deniedCommands` como listas de textos; JSON inválido ou campo inválido devolve `{ error }`. Política ilegível ou inválida: registrada no log e, no worker, substituída pelo fallback estrito (nenhum MCP, `git` inteiro proibido; `register.tsx:730-735`).

### Aplicação (`policyDenial`, `policy.ts:94`)

Chamada no hook `tool.call` do worker, para toda ferramenta exceto `mcp__fleet__tasks`:

- **MCP**: o servidor é o trecho entre `mcp__` e o próximo `__` (`mcpServerOf`). `ListMcpResourcesTool` e `ReadMcpResourceTool` usam o campo `server` da entrada. Servidor fora de `allowedMcpServers` resulta em `deny`.
- **Bash**: `deniedCommand` divide o comando em segmentos por `&&`, `||`, `;`, `|` e quebra de linha; ignora atribuições de ambiente iniciais (`VAR=1 cmd`); compara o nome do executável pelo `basename`. Para `git`, ignora opções globais (`-C`, `-c`, `--git-dir`, `--work-tree`, `--namespace` consomem o valor seguinte) e exige que as palavras extras da entrada apareçam entre os argumentos (por exemplo `git checkout --`). Para outros executáveis, as palavras da entrada precisam casar em posição.

A mensagem de recusa explica o motivo e manda reportar ao líder.

Limitação observada no código: a análise é textual por palavras. Subshells, `$(...)`, aspas que contêm separadores e execução indireta não são tratados; isso não foi exercitado em teste além dos casos de [hooks/policy.test.ts](../../hooks/policy.test.ts).

### Identidade do worker

`teammateIdentity` (`policy.ts:41`) lê `--agent-name` e `--parent-session-id` das linhas de comando dos ancestrais (script `ANCESTRY_SCRIPT`, `constants.ts:56`). A confirmação adicional é a presença do nome em `workers:<parentSessionId>` no store (ver [02-ciclo-de-vida.md](02-ciclo-de-vida.md)).

### Attachments escondidos

`isHiddenAttachment` ([hooks/workerPrompt.ts](../../hooks/workerPrompt.ts)) devolve verdadeiro se o tipo está em `WORKER_HIDDEN_ATTACHMENT_TYPES` (`output_style`) ou o texto casa com `WORKER_HIDDEN_ATTACHMENT_TEXT`. O comentário em `constants.ts:100-102` afirma que o nome do tipo não foi verificado contra um worker real.

## Instruções do worker

`worker/instructions.md` é lido por `workerInstructions` (`register.tsx:690`) e inserido em todo brief entre a tarefa e a regra de relatório. Conteúdo atual (resumo): escopo estrito, sem commit nem instalação de dependências, não tocar arquivos de outros workers, não editar `.claude/fleet/tasks/`, manter a lista com a ferramenta `mcp__fleet__tasks`, `BLOCKED` ao líder quando travar, rodar as validações da mudança, trabalhar em silêncio e reportar ao líder só por `SendMessage`. Falha de leitura é anotada e o brief segue sem instruções. A regra `DONE`/`BLOCKED` não está no arquivo: é gerada no código (`REPORT_RULE`, `briefs.ts:16`).

## Change History

- Created: 2026-11-03
