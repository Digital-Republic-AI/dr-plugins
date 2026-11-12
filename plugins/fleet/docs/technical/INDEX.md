# Documentação técnica do plugin fleet

## Datas

- Criado em: 2026-11-03
- Última atualização: 2026-11-03

Público: quem mantém ou estende o código TypeScript do plugin `fleet` (versão 0.2.0, conforme [plugin.json](../../.claude-plugin/plugin.json)). A documentação funcional, voltada a quem usa o plugin, fica em [../functional/](../functional/).

Todo o conteúdo foi conferido contra o código em `plugins/fleet`. O que não foi possível confirmar está marcado como "não confirmado" em cada documento.

## Documentos

| Documento | Tema |
|-----------|------|
| [01-arquitetura.md](01-arquitetura.md) | Módulos, responsabilidades, dependências e diagrama |
| [02-ciclo-de-vida.md](02-ciclo-de-vida.md) | Registro, hooks, spawn, envio, coleta de resultado, relay e painéis |
| [03-modelo-de-dados.md](03-modelo-de-dados.md) | Tipos, átomos de estado, estado só do módulo e chaves do store |
| [04-task-plan.md](04-task-plan.md) | Parser do task plan, resolução de dependências e execução do run |
| [05-modelo-e-politica.md](05-modelo-e-politica.md) | Escolha de modelo, política do worker e instruções do worker |
| [06-constantes.md](06-constantes.md) | Constantes relevantes de `hooks/constants.ts` e dos módulos |
| [07-testes-e-validacao.md](07-testes-e-validacao.md) | Typecheck, testes, resultado das execuções e cobertura por módulo |
| [08-extensao.md](08-extensao.md) | Pontos de extensão e armadilhas conhecidas |

## Fontes lidas

`hooks/*.ts`, `hooks/*.tsx`, `hooks/hooks.json`, `types/index.d.ts`, `tsconfig.json`, `.claude-plugin/plugin.json`, `worker/policy.json` e `worker/instructions.md`. Os `SKILL.md` em `skills/` e as declarações de tipos do engine em `.claude-plugin/types/` não foram analisados em profundidade: ficam fora do escopo desta documentação.

## Change History

- Created: 2026-11-03
