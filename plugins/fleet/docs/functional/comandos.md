# Comandos do /fleet

## Datas

- Criado em: 2026-11-03
- Última atualização: 2026-11-03

Cada comando abaixo foi conferido em `hooks/commands.ts` (sintaxe e validação dos argumentos) e no `README.md` (efeito).

## Resumo

| Comando | Efeito |
|---|---|
| `/fleet` | Abre o painel de status |
| `/fleet spawn <nome> [nome...] [--type t] [--model m]` | Inicia um worker por nome |
| `/fleet send <nome> <texto>` | Envia uma mensagem a um worker |
| `/fleet stop <nome>` | Encerra um worker |
| `/fleet rename <nome> <novo-nome>` | Dá um novo nome ao worker no Fleet |
| `/fleet plan [plano]` | Lista os planos ou carrega um no painel |
| `/fleet run <plano> [--model m]` | Despacha os itens prontos de um plano |
| `/fleet relay on\|off` | Liga ou desliga o repasse de mensagens ao líder |
| `/fleet help` | Mostra a sintaxe |
| `/fleet <texto livre>` | Pedido em linguagem natural |

Quando os argumentos não se encaixam na forma do comando, a resposta é `usage: /fleet <forma>`. As flags `--model` e `--type` valem em qualquer posição depois do verbo, mas precisam de um valor que não comece com `-`.

## spawn

Inicia um worker teammate por nome, cada um em seu painel. Todos os nomes recebem o mesmo tipo de agente e o mesmo modelo. Nomes repetidos valem uma vez só.

```text
/fleet spawn w1
/fleet spawn w1 w2 w3 --model sonnet
/fleet spawn docs --type markdown-specialist --model opus
```

- `--type` define o tipo de agente. O tipo foi movido do segundo argumento posicional para a flag: `/fleet spawn w1 react-specialist` inicia dois workers, `w1` e `react-specialist`.
- `--model` aceita alias, id completo ou tier. Ver [modelos.md](modelos.md).
- O limite padrão é 4 workers vivos. Os nomes além do limite entram em fila e começam quando outros terminam. Como alterar esse limite pelo usuário: não confirmado (o código lê um valor guardado em `STORE_MAX_WORKERS`, mas nenhum comando ou arquivo de configuração para defini-lo foi encontrado nos arquivos lidos).
- Se o nome já existe, o worker recebe um nome único; o plugin informa o nome pelo qual ele é endereçado.

## send

Envia texto a um worker.

```text
/fleet send w1 use o arquivo config/prod.json como base
```

O nome pode ser o original ou o novo nome dado por `rename`.

## stop

Encerra um worker.

```text
/fleet stop w1
```

Se o worker segurava um item de plano, o item volta para `[ ]`. A execução (run) em andamento não tenta de novo esse item; o próximo `run` o pega.

## rename

Dá um novo nome ao worker dentro do Fleet.

```text
/fleet rename w1 docs
```

O novo nome vale no painel, na tela do próprio worker (título da faixa), em `send` e `stop`. Limites: o motor continua endereçando o teammate pelo nome original, e o título do painel no iTerm2 não muda.

## plan

Sem argumento, lista os planos de `.claude/fleet/tasks/`. Com um nome, carrega o plano e mostra os itens na aba `tasks` do painel.

```text
/fleet plan
/fleet plan csv-export
```

O comando também relata erros do arquivo: id repetido, `needs:` que cita um id inexistente e item que depende de si mesmo. Esses erros bloqueiam o `run`.

## run

Despacha os itens prontos de um plano, um worker por item, com nome `task-<id>`.

```text
/fleet run csv-export
/fleet run csv-export --model sonnet
```

- Um item está pronto quando está pendente e todos os ids de `needs:` estão concluídos ou cancelados.
- O líder marca `[~]` ao despachar, `[x]` quando o worker relata `DONE` e devolve `[ ]` se o worker for parado.
- Ao `DONE`, os itens que esperavam pelos concluídos são despachados. A execução termina com "run <nome> complete" quando nada está pendente nem em andamento.
- Uma execução cujos itens abertos esperam todos por itens que ninguém está executando para e informa quais.
- `--model` coloca todos os itens no mesmo modelo.

Detalhes do formato do arquivo em [plano-de-tarefas.md](plano-de-tarefas.md).

## relay

```text
/fleet relay on
/fleet relay off
```

Com `on`, as mensagens dos workers são repassadas ao modelo do líder, o que permite lê-las na conversa. Com `off`, ficam no painel. Segundo a skill `orchestrate`, uma mensagem `BLOCKED` sempre chega ao líder; esse ponto vem da skill e não foi conferido no código do repasse.

## help

```text
/fleet help
```

Mostra a lista de subcomandos e a nota sobre `--model`.

## Pedido em linguagem natural

Palavras depois de `/fleet` que nenhum subcomando reconhece são tratadas como pedido. Um modelo pequeno (`haiku`) lê o pedido, considerando a sintaxe e os workers vivos, e responde com uma lista de comandos ou com uma resposta curta. Os comandos rodam em ordem, e cada um é mostrado antes do resultado.

```text
/fleet abre dois workers opus chamados a e b
/fleet roda o plano csv-export
```

- Um pedido que nenhum comando atende gera uma resposta curta e não executa nada.
- Uma linha devolvida que seja de novo um pedido livre, um erro ou a ajuda é mostrada e não executada, para que a resposta nunca entre em laço.
- O verbo desconhecido deixou de responder `unknown subcommand`; vira pedido livre. Em particular, `/fleet close` não existe mais e é lido como pedido livre.

## Pedir na conversa

Fora de um worker, o líder tem a ferramenta `mcp__fleet__command`, que recebe o que viria depois de `/fleet` (linha de comando ou pedido livre). Pedir ao Claude na conversa basta, sem digitar `/fleet`:

```text
abre 3 workers opus para documentar o módulo de pagamentos
renomeia o w1 para docs
roda o plano csv-export
```

Os workers não têm essa ferramenta e não rodam comandos `/fleet` nem criam teammates próprios.

## Skills do líder

- `/fleet:task-plan <objetivo>`: divide um objetivo em itens paralelos e grava o plano. Ver [plano-de-tarefas.md](plano-de-tarefas.md).
- `/fleet:orchestrate [plano] [--model m]`: conduz a execução de um plano ponta a ponta. Ver [fluxos.md](fluxos.md).

## Change History

- Created: 2026-11-03
