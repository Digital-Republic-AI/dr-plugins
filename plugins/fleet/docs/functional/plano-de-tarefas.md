# Plano de tarefas

## Datas

- Criado em: 2026-11-03
- Última atualização: 2026-11-03

Formato conferido em `hooks/constants.ts` (expressões `TASK_LINE`, `TASK_AGENT_TAG`, `TASK_NEEDS_TAG`) e `hooks/taskFile.ts`.

## Onde fica

Um plano é um arquivo Markdown em `.claude/fleet/tasks/<nome>.md`. O `<nome>` é o argumento de `/fleet plan` e `/fleet run`. A skill `task-plan` usa nomes com letras minúsculas, dígitos e hífens.

## Exemplo

```markdown
# Exportação CSV na página de relatórios

Exporta os filtros atuais do relatório como CSV. Não alterar o endpoint JSON.

- [ ] T1: Criar GET /api/reports/export.csv em api/reports/export.ts, com teste unitário @nodejs-specialist
- [ ] T2: Criar o botão Download em web/src/pages/reports/Toolbar.tsx, com teste de componente @react-specialist
- [ ] T3: Documentar o endpoint em docs/api/reports.md
- [ ] T4: Teste ponta a ponta: aplicar filtro, baixar, conferir o cabeçalho needs: T1, T2
```

T1, T2 e T3 rodam em paralelo; T4 espera por T1 e T2.

## Formato da linha de item

```text
- [<marca>] <ID>: <descrição> [@<agente>] [needs: A, B]
```

- Marcador de lista `-` ou `*`.
- Marcas: `[ ]` pendente, `[~]` em andamento, `[x]` concluído (`[X]` também é lido), `[-]` cancelado.
- ID: começa com uma letra, seguida de letras, dígitos, `_` ou `-` (`T1`, `api-2`). Deve ser único no arquivo.
- Descrição: é o briefing do worker para o item, junto com as linhas de contexto do arquivo. Escreva para quem nunca viu a conversa: arquivos envolvidos e como verificar que terminou.
- `@agente`: tipo de agente com que o worker começa. Pode vir em qualquer ordem em relação a `needs:`, no fim da linha.
- `needs: A, B`: ids do mesmo arquivo, separados por vírgula, dos quais o item depende.
- Qualquer outra linha (título, texto, linha em branco) é mantida e ignorada. O título do plano é o primeiro `# ...`.

## Como o Fleet usa o arquivo

- Pronto: item pendente cujos `needs:` estão todos concluídos ou cancelados.
- Marcas: o líder escreve `[~]` ao despachar, `[x]` ao receber `DONE` e `[ ]` se o worker for parado. Só a marca muda; o resto do arquivo permanece igual byte a byte.
- O arquivo é lido de novo a cada despacho, então uma edição feita entre os ciclos é vista. Mesmo assim, não edite o plano durante uma execução, porque o Fleet escreve nele. Para adicionar itens, espere a execução terminar (ou pare-a), edite e rode de novo.
- Os workers são instruídos a nunca editar o plano.
- Erros bloqueiam o `run`: id repetido, `needs:` para id inexistente, item que depende de si mesmo.
- Cada item é um worker; não é possível agrupar vários itens sob um worker. Agrupe o trabalho na descrição do item.

## Gerar o plano com a skill task-plan

```text
/fleet:task-plan adicionar exportação CSV à página de relatórios
```

A skill entende o objetivo, explora o código para saber quais arquivos cada item toca, corta o trabalho e grava `.claude/fleet/tasks/<slug>.md` com todos os itens em `[ ]`. Depois mostra o plano e indica os dois comandos seguintes (`/fleet plan <slug>` e `/fleet run <slug>`), sem executá-los.

Regras de corte que a skill aplica:

- Itens pequenos o bastante para uma sessão e grandes o bastante para justificar um painel.
- Itens paralelos não editam o mesmo arquivo; se precisam do mesmo arquivo, funda-os ou use `needs:`.
- Cada item tem um critério de pronto que o próprio worker consegue verificar.
- Dependências só onde são reais. Uma cadeia T1 -> T2 -> T3 -> T4 roda um worker por vez.
- Itens que fazem commit, instalam dependências ou mudam configuração compartilhada precisam dizer isso na descrição; por padrão, workers não fazem.

## Change History

- Created: 2026-11-03
