# Notas da migração Postgres (RDS) para Supabase

Suposições feitas durante a migração, ainda não confirmadas:

- A1. A tabela audit_log (180 GB) não precisa ser migrada; só os últimos 90 dias.
- A2. Os usuários vão logar de novo depois da migração (as sessões atuais não serão preservadas).
- A3. A função pg_cron de limpeza noturna (cleanup_temp_files) pode ser desligada porque o Storage do Supabase tem lifecycle próprio.
- A4. O fuso dos timestamps sem timezone (colunas created_at das tabelas legadas) é America/Sao_Paulo.
- A5. A extensão postgis não é usada em produção (só aparece em uma migration de 2021 que criou a coluna location, hoje sempre nula).
- A6. A janela de manutenção pode ser num domingo das 2h às 6h.
- A7. As 3 réplicas de leitura podem ser substituídas por uma só no Supabase.

Evidências:
- A1: SELECT count(*) FROM audit_log WHERE created_at < now() - interval '90 days' => 412 milhões de linhas.
- A4: o app grava com new Date().toISOString() (UTC) desde 2023-03, antes disso gravava hora local.
- A5: location IS NOT NULL => 0 linhas.
