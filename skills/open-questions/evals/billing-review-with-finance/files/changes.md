# Mudanças na cobrança (branch feat/billing-v2)

1. Juros por atraso: antes 2% de multa fixa; agora 2% de multa + 0,033% ao dia de juros (src/billing/late-fee.ts:12, calcLateFee).
2. Arredondamento: antes arredondava o total da fatura; agora arredonda cada item antes de somar (src/billing/invoice.ts:88, sumItems). Diferença de até R$ 0,04 por fatura em 3% das faturas de outubro.
3. Retentativa de cartão: antes 3 tentativas em 3 dias; agora 4 tentativas em 7 dias (src/billing/retry.ts:5, RETRY_SCHEDULE).
4. Faturas em aberto durante o deploy: o script de migração recalcula todas as faturas com status "aberta" (scripts/migrate-open-invoices.ts). Hoje são 1.312 faturas.
5. Desconto de pagamento antecipado (5% até o dia 5): mantido, mas agora não se aplica se houver multa pendente de mês anterior.
6. Nota fiscal: emissão passa a ocorrer na confirmação do pagamento, não na geração da fatura.
7. E-mail de cobrança: novo texto com o valor de juros discriminado; template em emails/invoice-overdue.html.

Notas:
- Itens 1, 2, 5 e 6 são regra de negócio; quem decide é a Marina (financeiro).
- Itens 3, 4 e 7 eu (Thiago) consigo validar.
