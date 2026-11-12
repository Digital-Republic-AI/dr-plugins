# Escolha de modelo por worker

## Datas

- Criado em: 2026-11-03
- Última atualização: 2026-11-03

Conferido em `worker/policy.json`, `hooks/constants.ts` e no `README.md`.

## O que `--model` aceita

- Um alias: `haiku`, `sonnet`, `opus`.
- Um id completo de modelo.
- Um tier de complexidade: `simple`, `standard`, `complex`.

`--model` vale em `/fleet spawn` e `/fleet run`.

```text
/fleet spawn w1 --model opus
/fleet spawn w1 w2 --model complex
/fleet run csv-export --model sonnet
```

## Tiers

Tabela padrão (`modelTiers` em `worker/policy.json`):

| Tier | Modelo padrão |
|---|---|
| `simple` | `haiku` |
| `standard` | `sonnet` |
| `complex` | `opus` |

## Ordem de decisão

1. Um `--model` explícito vence.
2. Sem ele, quando há texto de tarefa, o líder classifica o texto do item em um tier de complexidade e converte o tier em modelo pela tabela `modelTiers`.
3. Se a classificação falhar ou o tier for indefinido, o worker herda o modelo do líder.
4. Um item de plano com `@agente` mantém o modelo do agente; a classificação só vale para itens sem agente.
5. Workers em fila são classificados quando começam.

## Mudar a tabela de tiers

Crie `.claude/fleet/worker-policy.json` no projeto. Ele sobrescreve o padrão do plugin. Um `modelTiers` parcial mantém os demais padrões:

```json
{
  "modelTiers": { "standard": "opus" }
}
```

Um `modelTiers` malformado invalida a política inteira. Uma política que não pode ser lida volta a nenhum servidor MCP e nenhum comando git permitido.

## Observação

O classificador de complexidade não foi medido em um worker real; só `--model` explícito e a herança foram exercitados (conforme o `CHANGELOG.md`). Para trabalho crítico, informe o modelo explicitamente.

## Change History

- Created: 2026-11-03
