# Testes e validação

## Datas

- Criado em: 2026-11-03
- Última atualização: 2026-11-03

## Comandos

Não há `package.json` no plugin. Conforme o [README](../../README.md) (seção Testing), executados na raiz do repositório:

```bash
claude plugin test plugins/fleet
npx tsc --noEmit -p plugins/fleet/tsconfig.json
```

- [tsconfig.json](../../tsconfig.json) só estende `.claude-plugin/types/tsconfig.json`, que define `strict`, `noUncheckedIndexedAccess`, `noEmit`, JSX com `jsxFactory: "h"`, `moduleResolution: "bundler"`, os tipos `claude-code`, `claude-code-tools` e `claude-code-mcp`, e inclui `hooks`, `types` e `tests` (este último diretório não existe no plugin).
- Os testes importam `test`, `expect`, `mock` e o tipo `Engine` de `claude-code/testing`; o runner é o do engine (a saída tem o formato `(pass) ...`, parecido com o do runner do Bun, mas isso não foi confirmado).
- O `.claude-plugin/types/.gitignore` ignora tudo em `types/`; não foi verificado como as declarações de `claude-code` chegam a um clone novo.
- Não há linter configurado no plugin (nenhum arquivo de configuração de lint encontrado em `plugins/fleet`).

## Resultado das execuções (2026-11-03)

| Validação | Comando | Resultado |
|-----------|---------|-----------|
| Typecheck | `npx tsc --noEmit -p plugins/fleet/tsconfig.json` | PASS, exit 0, 12,74 s |
| Testes | `claude plugin test plugins/fleet` | PASS, exit 0, 4,9 s: 88 aprovados, 0 falhas, 12 arquivos |

Registro pelo skill `dr-validation-evidence` em `.dr_ai/test-reports/` (fora de uma task): `typecheck.md` (Run 010) e `test.md` (Run 011), com resumo em [README.md](../../../../.dr_ai/test-reports/README.md). A pasta `.dr_ai` é artefato local e pode não existir em um clone.

## Cobertura por módulo

Contagem de blocos `test(` por arquivo (soma 88). Não há medição de cobertura de linhas; a coluna descreve o que os testes exercitam, conforme os títulos.

| Módulo | Arquivo de teste | Testes | Observação |
|--------|------------------|--------|------------|
| `briefs.ts` | `briefs.test.ts` | 5 | Briefs, `isReport`, títulos |
| `commands.ts` | `commands.test.ts` | 5 | Parse dos subcomandos e flags |
| `format.ts` | `format.test.ts` | 1 | Cobertura mínima: um teste para cinco funções |
| `interpreter.ts` | `interpreter.test.ts` | 2 | Prompt e parse da resposta |
| `modelChoice.ts` | `modelChoice.test.ts` | 4 | Resolução e mesclagem de tiers |
| `policy.ts` | `policy.test.ts` | 6 | Política, identidade, MCP, comandos |
| `run.ts` | `run.test.ts` | 3 | Reducers do run |
| `taskFile.ts` | `taskFile.test.ts` | 5 | Parser, `setMark`, `readyUnits`, caminho |
| `taskList.ts` | `taskList.test.ts` | 5 | `TaskCreate`, `TaskUpdate`, `TodoWrite`, ferramenta do mod, outras |
| `workerPrompt.ts` | `workerPrompt.test.ts` | 1 | Attachments |
| `workers.ts` | `workers.test.ts` | 12 | Reducers de worker, roster, prune, rename |
| `register.tsx`, `pane.tsx`, `workerView.tsx`, `constants.ts` | `fleet.test.ts` | 39 | Integração com engine simulado |

`fleet.test.ts` (760 linhas) usa um harness (`Harness`, linha 11 em diante) que simula roster, env, settings, store, arquivos, classificador e processos, e cobre: spawn (lista, fila, sem agent teams, modo in-process), texto livre e rename, relay e `BLOCKED`, idle, send, stop, polling e prune, teammate do líder, `plan`/`run` (dispatch, marcas no arquivo, halt, vaga livre, stop devolve item), modelo (explícito, classificado, herdado), instruções do projeto, guarda do worker, banda e transcrição escondida, polling de subagente em background, recusa de painel e attachments.

Lacunas observadas pelos títulos (não confirmadas por análise de cobertura):

- `format.ts`: `elapsed`, `fit`, `statusGlyph`, `pushLog` sem teste dedicado visível.
- Ciclo de dependências do plano (A depende de B e B de A) sem teste explícito de run halted por ciclo; existe teste de halt por itens que esperam um item não concluído (`fleet.test.ts:519`).
- Ordem entre `session.receive` e `classic.TeammateIdle`.

## Change History

- Created: 2026-11-03
