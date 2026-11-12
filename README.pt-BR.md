# dr-plugins

[English](README.md) | Português

Marketplace de plugins e skills para Claude Code da Digital Republic. Cada item cobre uma parte recorrente do trabalho de software, como especificar uma mudança, documentar uma arquitetura, rodar workers em paralelo, publicar um site ou levantar decisões. A instalação é separada por item, então você adiciona só o que vai usar.

> Última atualização: 2026-11-12

## Instalação

```text
/plugin marketplace add Digital-Republic-AI/dr-plugins
/plugin install <nome>@dr-plugins
```

Reinicie o Claude Code depois de instalar um plugin. Skills distribuídas sozinhas (sem manifesto de plugin) ganham o nome da entrada do catálogo como namespace: `c4-codebase` é chamada como `/c4-codebase:c4-codebase`.

## Catálogo

| Nome | Tipo | Versão | Em uma linha |
|---|---|---|---|
| [spek](plugins/spek/) | Plugin | 0.6.0 | Desenvolvimento guiado por especificação que parte do código que já existe |
| [fleet](plugins/fleet/) | Plugin | 0.2.0 | Uma sessão líder que coordena workers do Claude Code em painéis divididos |
| [c4-codebase](skills/c4-codebase/) | Skill | 1.0.0 | Documentação de arquitetura e modelo C4 extraídos de um repositório |
| [tsc-report](skills/tsc-report/) | Skill | 1.0.0 | Checagem de tipos do TypeScript com relatórios agrupados e a primeira ação recomendada |
| [brainstorm-ideias](skills/brainstorm-ideias/) | Skill | 1.0.0 | Sessões de ideação apoiadas em mais de 40 métodos documentados |
| [cloudflare-static-publish](skills/cloudflare-static-publish/) | Skill | 1.0.0 | Sites estáticos na Cloudflare com deploy, proteção por login e DNS |
| [open-questions](skills/open-questions/) | Skill | 1.0.0 | As dúvidas em aberto do trabalho numa página respondida uma pergunta por vez |
| [pr-review-board](skills/pr-review-board/) | Skill | 1.0.0 | PRs abertas agrupadas por decisão de review num board colorido, no navegador e no terminal |

## Plugins

### spek

Desenvolvimento guiado por especificação, feito para bases de código que já existem. Primeiro, `/spek:extract` registra como o código atual se comporta, como uma linha de base. Depois a mudança é especificada com limites de escopo explícitos, esclarecida, planejada, dividida em tarefas, implementada e verificada contra a especificação e contra essa linha de base. Projetos novos seguem o mesmo fluxo sem a etapa de extração, e mudanças pequenas podem usar um modo condensado depois que você confirma.

- **Ajuda quando**: a mudança mexe em código que ninguém lembra direito, e o risco é quebrar um comportamento que nunca foi escrito. A linha de base e a etapa de verificação deixam esse risco visível antes do merge.
- **Comece com**: `/spek:start`, que detecta o estado do projeto e roda o primeiro comando certo.
- **Requer**: `bash` e `jq`.

### fleet

Transforma uma sessão do Claude Code em líder que coordena workers, cada um no seu painel. O trabalho vem de um plano de tarefas em Markdown, com dependências e tipos de agente opcionais. O líder distribui os itens que estão prontos, marca quando começam e terminam, e mostra um painel de status ao vivo. A skill `task-plan` divide um objetivo em itens paralelos, e a `orchestrate` executa e acompanha o plano.

- **Ajuda quando**: a tarefa se divide em partes independentes, como vários módulos, várias correções ou uma migração em lotes, e uma sessão trabalhando em sequência vira o gargalo.
- **Comece com**: `/fleet`.
- **Requer**: agent teams ativado (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) e um modo de equipe com painéis (`tmux`, `iterm2` ou `auto`).

## Skills

### c4-codebase

Faz a engenharia reversa de um repositório ou monorepo em documentos de arquitetura e num modelo C4 em Structurizr DSL. Cada elemento aponta para a evidência no código de onde veio. O progresso fica salvo em `.c4-codebase/`, então uma base grande pode ser mapeada ao longo de várias sessões.

- **Ajuda quando**: há onboarding, revisão de arquitetura ou mapeamento de integrações, e os diagramas existentes faltam ou estão desatualizados.
- **Requer**: Python 3.7+ e git. Validar e exportar o DSL exige Docker ou a Structurizr CLI com Java 17+.

### tsc-report

Roda a checagem de tipos do TypeScript do projeto (o script `typecheck`, `tsc` ou `tsc -b`) e salva a saída bruta e dois relatórios JSON, um agrupado por código de erro e outro por arquivo, em `./tsc-reports/<timestamp>/`. A resposta traz tabelas e um parágrafo sobre o estado atual e a primeira coisa a corrigir.

- **Ajuda quando**: centenas de erros de tipo precisam virar uma lista curta de causas, ou quando você quer comparar execuções ao longo do tempo.
- **Requer**: Node.js 18+ e um verificador de tipos do TypeScript.

### brainstorm-ideias

Facilitador de ideação apoiado numa base de pesquisa com mais de 40 métodos, entre eles How Might We, SCAMPER, TRIZ, premortem, Jobs-to-be-Done e Blue Ocean. Conduz uma sessão sobre o seu problema, com divergência e convergência separadas, ou explica uma técnica com um exemplo resolvido. Os casos e números que cita vêm da base de pesquisa, não da memória.

- **Ajuda quando**: você quer sair das primeiras respostas óbvias, planejar uma oficina com o time ou testar uma ideia antes de investir nela.
- **Comece com**: peça ideias ou um brainstorm. O Claude usa a skill sozinho quando o pedido combina com ela.

### cloudflare-static-publish

Publica um site estático, seja HTML puro ou o resultado de um build como Vite, Astro ou export do Next.js, no Cloudflare Workers Static Assets ou no Pages. Gera o `wrangler.jsonc`, um script de deploy manual e um workflow opcional do GitHub Actions, pode proteger o site com o One-time PIN do Cloudflare Access e configura o DNS do domínio próprio. Toda mudança na Cloudflare aparece primeiro como plano e só é aplicada depois que você confirma.

- **Ajuda quando**: documentação interna, protótipos e landing pages precisam de uma URL, de acesso opcional por e-mail e de deploy repetível, sem configurar as peças da Cloudflare à mão.
- **Requer**: Node.js 18+, uma conta Cloudflare, e `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` no ambiente para as etapas de API.

### open-questions

Reúne o que ainda está indefinido no trabalho atual, como lacunas, suposições a confirmar, decisões e mudanças a aprovar. Publica tudo como um Artifact do claude.ai que mostra uma pergunta por vez, com contexto suficiente para responder sem voltar ao terminal. Cada tipo de item ganha os controles adequados: opções com suas consequências, confirmar ou corrigir, aprovar ou alterar, ou texto livre. As respostas ficam salvas na página, para o Claude ler de volta e continuar. Cada pergunta pode ser atribuída a outra pessoa, como o dono do produto, que responde só a sua parte.

- **Ajuda quando**: um planejamento ou uma revisão acumula várias decisões. Elas são respondidas com calma e num lugar só, em vez de numa mensagem longa no chat.
- **Requer**: Claude Code logado com `/login` num plano do claude.ai com Artifacts. Sem o armazenamento da página, as respostas ainda podem ser copiadas de volta à mão.

### pr-review-board

Lista as pull requests abertas de um repositório agrupadas por decisão de review: não revisadas, modificações solicitadas e aprovadas. Gera um board HTML autocontido com uma barra empilhada dos três grupos, uma coluna por grupo e um card por PR (autor, idade, estado do CI, revisores e seus vereditos, labels, marcas de rascunho e de conflito), com destaque para as PRs que esperam a sua revisão e filtros por autor e busca. O terminal recebe os mesmos grupos como um resumo em Markdown, com formas e blocos no lugar das cores, mais um parágrafo curto sobre o que olhar primeiro.

- **Ajuda quando**: a pergunta diária é "o que está esperando por mim, o que já pode ser mesclado, o que travou", sem abrir PR por PR.
- **Comece com**: peça as PRs abertas, um board de PRs ou o que está aguardando a sua revisão. O Claude usa a skill sozinho quando o pedido se encaixa.
- **Requer**: Node.js 18+ e o GitHub CLI (`gh`) logado. Funciona offline a partir de um export salvo de `gh pr list --json`.

## Contribuição

A organização do repositório e o processo de lançar uma versão nova estão em [CONTRIBUTING.md](CONTRIBUTING.md), em inglês.

## Histórico de alterações

- Criado: 2026-11-08 - Versão em português do README.md
- Atualizado: 2026-11-12 - Adicionada a skill pr-review-board 1.0.0
