# Pontos de extensão

## Datas

- Criado em: 2026-11-03
- Última atualização: 2026-11-03

Cada receita aponta onde mexer. Convenção do código: lógica pura em módulos exportados por [hooks/core.ts](../../hooks/core.ts), efeitos só em [hooks/register.tsx](../../hooks/register.tsx), constantes em [hooks/constants.ts](../../hooks/constants.ts), um arquivo `*.test.ts` por módulo.

## Novo subcomando de `/fleet`

1. Acrescentar um tipo à união `Command` e uma linha em `SUBCOMMANDS` em [hooks/commands.ts](../../hooks/commands.ts). `form` e `summary` alimentam `HELP`, que também é descrição da ferramenta `mcp__fleet__command` e contexto do interpretador de texto livre, então a ajuda se atualiza sozinha. Uma linha sem `summary` fica fora do `HELP`. `takesModel` e `takesType` habilitam `--model` e `--type`.
2. Tratar o novo `kind` no `switch` de `runCommand` (`register.tsx:348`); o TypeScript acusa o caso faltante porque o `switch` é exaustivo sobre a união, e a função retorna `string`.
3. Se o comando deve ser executável pelo texto livre, nada mais é preciso: `runInterpreted` roda qualquer `Command` que não seja `error`, `natural` ou `help`.
4. Testar em `commands.test.ts` e, se tiver efeito, em `fleet.test.ts`.

## Novo campo no formato do plano

O parser está em `parseLine` ([hooks/taskFile.ts](../../hooks/taskFile.ts):49). Acrescente a expressão em `constants.ts`, extraia-a e remova-a da descrição como é feito com `TASK_AGENT_TAG`, acrescente o campo a `TaskItem` ([types/index.d.ts](../../types/index.d.ts):57) e atualize `itemLine` no painel. `setMark` só troca a marca; um campo novo não exige mudança nele.

## Agrupar itens em uma unidade

`readyUnits` devolve uma unidade por item. O tipo `PlanUnit` e `unitWorkerName` já aceitam vários ids (`tasks: string[]`); o consumidor (`advanceRun`) filtra os itens pela lista da unidade e `planBrief` já escreve `DONE <ids>`. Basta alterar `readyUnits` para agrupar.

## Nova regra de política do worker

- Campos novos de `policy.json`: validar em `parsePolicy` ([hooks/policy.ts](../../hooks/policy.ts):19), estender `WorkerPolicy` e usar em `policyDenial`. O fallback estrito de `loadPolicy` (`register.tsx:734`) também precisa do campo.
- Lembrar que a política do projeto substitui a do plugin por inteiro; um campo obrigatório novo quebra políticas de projeto existentes.

## Novo tier de complexidade ou modelo

Altere `COMPLEXITY_TIERS` e `DEFAULT_MODEL_TIERS` (`constants.ts:112-113`); `mergeModelTiers` e `resolveModel` derivam os tiers da primeira constante. Atualize `worker/policy.json` e `HELP_MODEL_NOTE`.

## Nova fonte de lista de tarefas do worker

`reduceTaskCall` ([hooks/taskList.ts](../../hooks/taskList.ts):14) traduz chamadas de `TaskCreate`, `TaskUpdate`, `TodoWrite` e da ferramenta do mod na lista mostrada na banda. Para outra ferramenta, acrescente um `case` e um reducer tolerante: os campos são lidos com `fieldsOf`, `text` e `statusOf`, que nunca lançam erro.

## Novo hook ou componente a esconder no worker

Acrescente o nome a `HiddenSite` (`register.tsx:146`) e um `on('ui.render', { component: ... })` com `hideForWorker` e `.catch(hookFailed)`, como nas linhas 294-301.

## Novo elemento no painel

`paneTree`, `workersTab` e `tasksTab` ([hooks/pane.tsx](../../hooks/pane.tsx)) recebem dados e ações e não fazem efeitos. Para uma ação nova: acrescente-a a `PaneActions`, implemente-a no objeto passado em `renderPane` (`register.tsx:906-914`) e use um hotkey livre (`w`, `t`, `x`, `n`, `m`, `k`, `r`, `g` e `1`-`9` estão em uso).

## Armadilhas

- Hook de render não pode escrever estado, criar timers nem listar agentes; por isso o spinner e o polling de background usam `live` e timers criados em `armWorker`.
- Átomos precisam ser declarados em `register.tsx` e também em `PluginState` (`types/index.d.ts:84`).
- `live` é zerado a cada `register`; não guarde nele nada que precise sobreviver a hot reload.
- `advanceRun` é protegido por `live.isAdvancing`: uma chamada concorrente retorna `null` sem esperar.
- Hooks sem `.catch(hookFailed)` (`ui.render` `Pane` e `tool.call` de `mcp__fleet__tasks`) propagam falhas ao engine.
- Valores de `WORKER_HIDDEN_ATTACHMENT_TYPES` não foram verificados contra um worker real (comentário em `constants.ts:100-102`).
- O arquivo do plano é de propriedade do líder; workers são instruídos a não editá-lo, mas nada no código impede isso.

## Change History

- Created: 2026-11-03
