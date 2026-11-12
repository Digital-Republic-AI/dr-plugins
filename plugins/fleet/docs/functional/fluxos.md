# Fluxos de uso ponta a ponta

## Datas

- Criado em: 2026-11-03
- Última atualização: 2026-11-03

Os fluxos seguem as skills `task-plan` e `orchestrate` e os comandos de [comandos.md](comandos.md).

## Fluxo 1: de um objetivo a um plano executado

1. Confira os pré-requisitos de [visao-geral.md](visao-geral.md) (agent teams, `teammateMode`, `SendMessage`).
2. Gere o plano:

   ```text
   /fleet:task-plan adicionar exportação CSV à página de relatórios
   ```

3. Revise no painel:

   ```text
   /fleet plan csv-export
   ```

   Leia os itens e corrija no arquivo qualquer erro apontado (id repetido, `needs:` desconhecido). Se algum item já estiver `[~]` de uma sessão anterior, ele é resto ou pertence a outra pessoa; decida antes de voltá-lo para `[ ]`.
4. Execute:

   ```text
   /fleet run csv-export
   ```

   O Fleet despacha os itens prontos até o limite de workers, marca `[~]` e enfileira o resto.
5. Acompanhe no painel (`/fleet`, aba `w`) e, se quiser ler os relatórios na conversa, ligue o relay:

   ```text
   /fleet relay on
   ```

6. Ao `DONE`, o item vira `[x]` e os que esperavam por ele são despachados. A execução termina com "run csv-export complete".
7. Feche: confira que todo item está `[x]` ou `[-]`, pare workers ainda vivos sem trabalho, e revise o resultado. Commit é decisão sua.

Tudo isso também pode ser conduzido pela skill:

```text
/fleet:orchestrate csv-export
```

## Fluxo 2: workers manuais, sem plano

```text
/fleet spawn docs api --model sonnet
/fleet send docs documente o módulo de pagamentos em docs/payments.md
/fleet send api revise os endpoints de pagamento e liste inconsistências
/fleet stop docs
```

Pelo painel: `n` cria um worker, `1`..`9` seleciona, `m` envia mensagem, `k` para.

## Fluxo 3: tudo em linguagem natural

```text
abre dois workers opus chamados a e b
manda o a revisar o README e o b conferir os links
para o a
```

O líder usa `mcp__fleet__command` para cada pedido.

## Responder um worker bloqueado

Um relatório `BLOCKED <motivo>` é uma pergunta ao líder. Responda com a decisão, o arquivo a usar ou o corte de escopo:

```text
/fleet send task-T2 use o endpoint v2; a v1 será removida
```

Não faça o item do worker na sessão do líder enquanto o worker o segura; se precisar assumir, pare o worker antes.

## Worker parado, travado ou ocioso

- `stale` (10 minutos sem sinal) ou `failed`: `/fleet stop <nome>`. O item volta para `[ ]`; a execução atual não tenta de novo. Quando ela terminar, `/fleet run <plano>` pega o item.
- `idle` sem relatório: peça com `/fleet send <nome> envie seu relatório ao team lead`, ou pare-o se já tem o que precisa. Vários workers `idle` sem relatório indicam `SendMessage` indisponível; ver [limitacoes-e-problemas.md](limitacoes-e-problemas.md).

## Retomar depois

Se uma execução terminou com itens `[ ]` ou foi interrompida, `/fleet run <plano>` de novo despacha os itens prontos que sobraram.

## Change History

- Created: 2026-11-03
