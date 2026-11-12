# Limitações e problemas comuns

## Datas

- Criado em: 2026-11-03
- Última atualização: 2026-11-03

## Limitações

- Um item de plano é um worker; não há agrupamento de itens sob um mesmo worker.
- O limite padrão é de 4 workers simultâneos; o excedente fica em fila.
- Os workers compartilham a árvore de trabalho. Dois itens paralelos que editam o mesmo arquivo se sobrescrevem; funda-os ou use `needs:`.
- O transcrito expandido (ctrl+o) e `--verbose` ficam vazios dentro de um worker.
- O classificador de complexidade não foi medido em um worker real; só `--model` explícito e a herança foram exercitados.
- `/fleet rename` não muda o título do painel no iTerm2, e o motor continua endereçando o teammate pelo nome original.
- Um worker não roda comandos `/fleet`, não usa a ferramenta `mcp__fleet__command` e não cria teammates.
- Política dos workers (`worker/policy.json`, sobrescrita por `.claude/fleet/worker-policy.json`): por padrão nenhum servidor MCP é permitido, e os comandos git `git stash`, `git reset`, `git clean`, `git checkout --` e `git restore` são negados. Um projeto que precisa de MCP nos workers lista os servidores em `allowedMcpServers`.
- As instruções que todo worker recebe vêm de `worker/instructions.md`, sobrescritas por `.claude/fleet/worker-instructions.md`. Resumo: fazer só o item, não commitar, não instalar dependências nem mudar configuração compartilhada, não mexer em arquivos de outros workers, não editar o plano, manter a lista de tarefas, relatar `BLOCKED` quando a decisão é do líder, rodar as validações e reportar só ao líder.

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| "Agent teams are off" | Variável ausente | Definir `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` no shell ou no `env` do `settings.json` e reiniciar o Claude Code |
| Mensagem de que os workers rodariam dentro do processo | `teammateMode` não é de painéis | Definir `"teammateMode": "tmux"`, `"iterm2"` ou `"auto"` no `settings.json`; com `tmux`, rodar dentro do tmux; reiniciar |
| Worker iniciado como subagente simples, não teammate de painel | Aviso do plugin sobre `teammateMode` | Conferir `teammateMode` |
| Worker termina e fica `idle`, item continua `[~]` | Sem `SendMessage`: o relatório ficou só no painel do worker | Liberar `SendMessage` nas permissões herdadas pelos workers, parar o worker e rodar de novo |
| Worker escreve `BLOCKED: no SendMessage tool` no painel | Mesmo motivo | Mesma correção |
| `run` se recusa a começar | Plano com id repetido, `needs:` desconhecido ou auto-dependência | Corrigir o arquivo; `/fleet plan <nome>` mostra os erros |
| `run` para dizendo que itens esperam por itens que ninguém executa | Dependência de item que ficou `[ ]` ou foi parado | Rodar o item de que dependem ou ajustar o `needs:` e rodar de novo |
| Item voltou para `[ ]` | O worker foi parado | A execução atual não tenta de novo; `/fleet run <plano>` pega o item |
| Worker `stale` | Sem sinal há 10 minutos | Parar com `/fleet stop <nome>` |
| Comando git recusado dentro de um worker | Política de comandos negados | Intencional; ajustar `deniedCommands` no arquivo de política do projeto se necessário |
| `/fleet close` não funciona como esperado | O subcomando foi removido; vira pedido livre | Fechar o painel com a tecla `x` |

## Não confirmado

- Como alterar o limite de workers por configuração do usuário: o código lê um valor guardado, mas não foi encontrado comando ou arquivo para defini-lo.
- Comportamento exato do relay para mensagens `BLOCKED` no código: a afirmação de que sempre chegam ao líder vem da skill `orchestrate`.
- Conteúdo da resposta do worker de teste (`probe`) em ambiente real.

## Change History

- Created: 2026-11-03
