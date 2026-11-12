# Visão geral do plugin Fleet

## Datas

- Criado em: 2026-11-03
- Última atualização: 2026-11-03

Documentação funcional, para quem usa o plugin. Versão descrita: 0.2.0 (mais as alterações não lançadas do `CHANGELOG.md`).

## O que o plugin resolve

O Fleet transforma uma sessão do Claude Code em um líder que coordena vários workers, que são outras sessões do Claude Code, cada uma em seu próprio painel dividido. O líder cria workers, envia trabalho, recebe os relatórios e mostra o andamento em um painel de status.

O ganho aparece quando o trabalho pode ser cortado em partes independentes: em vez de uma sessão fazer tudo em sequência, várias fazem ao mesmo tempo, e o líder acompanha e marca o que foi concluído.

## Conceitos

| Conceito | Significado |
|---|---|
| Líder (lead) | A sessão em que você digita `/fleet` ou conversa. Cria os workers, despacha itens, responde bloqueios e escreve as marcas no plano. |
| Worker | Uma sessão do Claude Code iniciada pelo líder, em um painel dividido. Faz um item de trabalho e relata ao líder. |
| Painel Fleet | Painel de status com as abas `workers` e `tasks`, o log e as ações por atalho. Abre com `/fleet`. |
| Plano de tarefas (task plan) | Arquivo Markdown em `.claude/fleet/tasks/<nome>.md` com uma lista de itens, dependências e agente opcional. Ver [plano-de-tarefas.md](plano-de-tarefas.md). |
| Item | Uma linha do plano. Cada item vira exatamente um worker, chamado `task-<id>`. |
| Relay | Opção que repassa as mensagens dos workers ao modelo do líder, em vez de mantê-las só no painel. Ver [comandos.md](comandos.md). |

Dentro de um worker, a tela mostra apenas uma faixa de tarefas com progresso, no lugar da conversa completa. O worker mantém essa lista com a ferramenta `mcp__fleet__tasks` e relata ao líder por `SendMessage`, com mensagens que começam com `DONE` ou `BLOCKED`.

## Pré-requisitos

- Claude Code com agent teams ligado: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, no shell ou no bloco `env` do `settings.json`. Sem isso o plugin responde "Agent teams are off". Reinicie o Claude Code após definir.
- Modo de equipe com painéis: `teammateMode` igual a `tmux`, `iterm2` ou `auto` no `settings.json`. Com outro valor, os workers rodariam dentro do processo e não em painéis, e o plugin avisa qual configuração ajustar. Para `tmux`, a sessão precisa estar dentro do tmux.
- Os workers precisam poder usar a ferramenta `SendMessage`: é o único canal deles para os relatórios `DONE` e `BLOCKED`. As permissões herdadas pelos workers não podem negá-la (`permissions.deny`, `disallowedTools` ou um hook que a bloqueie). Sem ela, o worker termina o item, escreve o relatório só no próprio painel e aparece como `idle` para sempre, sem `[x]` no plano.

Nenhum servidor MCP e nenhum outro plugin são necessários.

## Instalação

```text
/plugin marketplace add Digital-Republic-AI/dr-plugins
/plugin install fleet@dr-plugins
```

Reinicie o Claude Code depois de instalar.

## Primeiro uso em um minuto

```text
/fleet spawn probe
```

Cria um worker de teste. Se a resposta indicar um ajuste de configuração, corrija e repita. Para verificar o canal de relatório, envie ao worker:

```text
/fleet send probe liste suas ferramentas e envie uma mensagem de volta ao team lead
```

Encerre o teste:

```text
/fleet stop probe
```

Esse roteiro vem da skill `orchestrate`; o conteúdo exato da resposta do probe não foi verificado em um ambiente real nesta documentação.

## Documentos relacionados

- [comandos.md](comandos.md)
- [plano-de-tarefas.md](plano-de-tarefas.md)
- [modelos.md](modelos.md)
- [fluxos.md](fluxos.md)
- [painel-e-atalhos.md](painel-e-atalhos.md)
- [limitacoes-e-problemas.md](limitacoes-e-problemas.md)

## Change History

- Created: 2026-11-03
