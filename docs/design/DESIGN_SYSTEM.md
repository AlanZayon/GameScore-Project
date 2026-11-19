# Design system GameScore — Evidence

**Idioma:** [Português](./DESIGN_SYSTEM.md) · [English](../en/design/DESIGN_SYSTEM.md)

Sistema visual do GameScore após o redesign Evidence. Dark-first, orientado a dados, compacto.

## Identidade

GameScore é um instrumento de descoberta. A nota pública é um **percentual positivo**; o ranking respeita **evidência** (limite inferior de Wilson). A UI deixa essa hierarquia óbvia: `%` primeiro, tamanho da amostra e confiança depois, decoração nunca.

## Cor

Variáveis CSS semânticas (definidas em `apps/web/src/app/globals.css`).

| Token | Papel |
| ----- | ----- |
| `--gs-canvas` | Fundo da página |
| `--gs-surface` | Painéis, cards, inputs |
| `--gs-surface-raised` | Menus, popovers |
| `--gs-surface-hover` | Hover / preenchimento suave de seleção |
| `--gs-border` / `--gs-border-strong` | Divisores; preferir bordas a sombras |
| `--gs-text` / `--gs-text-muted` / `--gs-text-subtle` | Hierarquia de texto |
| `--gs-brand` | Acento teal — links, focus, CTAs primários |
| `--gs-positive` / `--gs-mixed` / `--gs-negative` | Sentimento da nota (distinto do teal da marca) |

### Escuro (padrão)

- Brand ≈ `#2dd4bf` (hover `#5eead4`)
- Canvas ≈ `#0a0c10`, surfaces cinza frio sem violeta

### Claro

- Brand ≈ `#0f766e` (hover `#0d9488`) para WCAG em botões brancos
- Canvas ≈ `#f4f5f7`

## Tipografia

| Papel | Família | Uso |
| ----- | ------- | --- |
| Display | Zilla Slab (`--font-display`) | Títulos de página, wordmark |
| Sans | IBM Plex Sans (`--font-sans`) | UI, corpo, formulários |
| Score | IBM Plex Sans + `tabular-nums` | `%`, contagens, rankings |

Escala (aproximada):

| Nível | Tamanho | Peso |
| ----- | ------- | ---- |
| Display / H1 | 1.75–2.25rem | 600–700 (slab) |
| H2 | 1.25–1.5rem | 600 (slab ou sans) |
| Body | 0.875–1rem | 400 |
| Small / meta | 0.75–0.8125rem | 400–500 |
| Score hero | 2.5–3.5rem | 700 tabular |

## Espaçamento

Escala: `4, 8, 12, 16, 24, 32, 48`.

Densidade compacta: preferir `8–12` dentro de linhas interativas; `16–24` entre seções.

## Raio

| Token | Valor | Uso |
| ----- | ----- | --- |
| small | 4px | Inputs densos, chips |
| medium / card | 8px (`0.5rem`) | Cards, painéis |
| large | 12px | Raro (menus) |

Sem badges em pílula. Preferir `rounded-md` a `rounded-full`.

## Sombras

Padrão: nenhuma. Bordas carregam a hierarquia. Menus overlay podem usar uma sombra sutil.

## Motion

| Nome | Duração | Uso |
| ---- | ------- | --- |
| instant | 0 | Reduced motion |
| fast | ~120ms | Hover de borda/bg |
| normal | ~200ms | Tabs, abertura de menus |

Sem parallax, sem loops decorativos de entrada. Respeitar `prefers-reduced-motion`.

## Componentes (base)

- **Button** — primary (brand), secondary (borda), ghost, danger; padding compacto
- **Card** — borda + surface; sem sombra padrão
- **Badge / ScoreBadge** — rounded-md, tons de sentimento
- **Input** — borda forte, fill canvas
- **ScorePanel** — `%` dominante; n + hint secundários
- **GameCard / GameRow** — capa + nome + `%` tabular; row preferido em listas mobile

## Acessibilidade

- Focus ring: outline brand 2px, offset 2px
- Alvos de toque primários ≥ 44px de altura quando prático
- Contraste: brand no escuro/claro checado para botões e links
- HTML semântico preferido a ARIA quando possível
