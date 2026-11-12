# Painel Fleet e atalhos

## Datas

- Criado em: 2026-11-03
- Última atualização: 2026-11-03

Atalhos conferidos em `hooks/pane.tsx`; limites numéricos em `hooks/constants.ts`.

## Abrir

`/fleet` sem argumentos abre o painel. Dentro de um worker nenhum painel abre: a tela do worker é a faixa de tarefas.

## Abas

| Aba | Atalho | Conteúdo |
|---|---|---|
| workers | `w` | Cada worker com status e tempo decorrido, o item que ele segura e o log do que aconteceu. O título mostra `workers <vivos>/<limite>`. |
| tasks | `t` | Nome do plano carregado, contadores da execução e uma linha por item com glifo de status, agente e dependências. |

Glifos dos itens: `○` pendente, `◐` em andamento, `✓` concluído, `–` cancelado.

## Atalhos

| Tecla | Ação |
|---|---|
| `x` | Fecha o painel |
| `w` / `t` | Troca de aba |
| `1` a `9` | Seleciona o worker da linha correspondente |
| `n` | Novo worker |
| `m` | Escreve uma mensagem ao worker selecionado |
| `k` | Para o worker selecionado |
| `r` | Liga ou desliga o relay |
| `g` | Executa o plano carregado (aparece na aba tasks, quando há plano e nenhuma execução em curso) |

`m` e `k` ficam esmaecidos sem worker selecionado.

## Estados e limites

- Um worker sem sinal há 10 minutos aparece como `stale`.
- Workers encerrados saem do painel: no máximo 5 são mantidos, e nenhum com mais de 1 hora.
- O painel desenha os workers vivos primeiro e depois os encerrados, do mais novo ao mais antigo, até 9 linhas.
- Limite padrão de 4 workers ao mesmo tempo; o excedente fica em fila.

## Tela do worker

Dentro de um worker a conversa é substituída por uma faixa acima do prompt: título `fleet worker <nome> · tasks`, atividade (`working…` com um indicador animado, ou `idle`), contador de tarefas concluídas com barra de progresso e a lista de tarefas. Tarefa concluída fica esmaecida e riscada; a em andamento aparece destacada. O transcrito expandido (ctrl+o) e `--verbose` ficam vazios dentro do worker.

## Change History

- Created: 2026-11-03
