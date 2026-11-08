# Rascunho: exportação de relatórios em CSV

Objetivo: permitir que o usuário exporte os relatórios de vendas (tela Relatórios > Vendas) em CSV.

## O que já está claro
- O botão "Exportar CSV" fica no topo da tabela de vendas.
- A exportação respeita os filtros aplicados na tela (período, loja, vendedor).
- Backend em Supabase; a tabela vendas tem hoje cerca de 2,4 milhões de linhas (cliente maior: 610 mil linhas por ano).

## Pontos em aberto (anotações soltas)
- Gerar no navegador ou numa Edge Function? No navegador trava acima de ~50 mil linhas no teste que fiz.
- Separador: vírgula ou ponto e vírgula? O Excel em pt-BR abre melhor com ponto e vírgula.
- Valores monetários: "1234.56" ou "1.234,56"?
- Exportações grandes: download direto ou e-mail com link quando terminar?
- Quem pode exportar? Hoje todo mundo vê a tela, mas o comercial falou que vendedor não deveria baixar dados de outras lojas.
- Colunas: todas as 23 colunas da tabela ou só as 9 visíveis na tela?
- Limite de exportações por dia? Não sei se precisa.
- Registrar auditoria de quem exportou o quê (LGPD)? Tem CPF do cliente em 2 colunas.
