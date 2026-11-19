# Feature Design — Redesign Evidence

**Idioma:** [Português](./redesign-design.md) · [English](../en/design/redesign-design.md)

## Objetivo

Substituir o visual genérico “AI-slop” roxo/escuro por uma UI Evidence: compacta, acento teal, slab+sans, apresentação da nota com `%` primeiro, home data-first, paridade mobile e desktop. Produto completo incluindo admin.

## Usuário

Jogadores descobrindo e avaliando jogos; moderadores/admins gerindo conteúdo.

## Ação primária

Encontrar um jogo → ler a nota com evidência → recomendar / não recomendar.

## Ações secundárias

Navegar rankings, buscar, gerir perfil/settings, moderar (admin).

## Arquitetura de informação

### Home (data-first)

1. Proposição do produto em uma linha + totais opcionais em muted
2. Busca (ou caminho claro para a busca do header)
3. Seções densas: populares, top rated, novos, trending (rows no mobile; cards compactos no desktop)
4. Reviews recentes (compactas)

### Detalhe do jogo

1. Capa + título + meta
2. ScorePanel (`%` hero; n + confiança secundários)
3. Mídia, plataformas, reviews, formulário

### Catálogo / Rankings / Busca

Controles de filtro + lista/grid densa de jogos com `%` tabular.

### Scoring

Explicador editorial; display type no título; corpo denso e legível.

### Auth / Settings / Legal

Formulários compactos; mesmos tokens; sem chrome de marketing decorativo.

### Admin

Tabelas densas, filter chips, dialogs; tokens compartilhados; sem cards decorativos empilhados.

## Direção visual

Evidence / data-forward · dark-first · teal · Zilla Slab + IBM Plex Sans · compacto / utilitário · motion funcional.

## Layout

- `container-page` max ~80rem; ritmo vertical mais cerrado (`py-6`–`py-8`)
- Mobile: coluna única, listas GameRow, nota sob o título
- Desktop: detalhe multi-coluna; nota sticky à direita; grids mais densos

## Componentes

ScorePanel, GameCard, GameRow, ScoreBadge, SiteHeader (wordmark slab), SiteFooter, Tabs, painéis admin.

## Comportamento responsivo

Paridade: mudanças intencionais de layout em `md`/`lg` (lista ↔ grid, busca no header, colunas do detalhe), não só encolher.

## Interação

Hover: borda / surface-hover. Tabs: fill brand. Menus: surface raised. Barra de score: largura reflete % positivo.

## Estados

Skeletons de loading, empty com borda tracejada, erro em painel soft negative, disabled com opacity — manter padrões, restylar para tokens.

## Acessibilidade

Focus teal; navegação por teclado inalterada; reduced motion preservado; `%` da nota legível sem depender só da cor (texto do label).

## Restrições técnicas

Next.js App Router, Tailwind 4, next-intl, DTOs existentes. Sem nova UI library. Sem mudanças de API.

## Notas de implementação

Tokens em `globals.css`; fontes no `layout.tsx` raiz; redesign confinado a `apps/web`.

## Questões em aberto

Nenhuma — decisões fechadas no plano.
