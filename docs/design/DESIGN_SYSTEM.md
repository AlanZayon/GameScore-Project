# GameScore Design System — Evidence

Visual system for GameScore after the Evidence redesign. Dark-first, data-forward, compact.

## Identity

GameScore is a discovery instrument. The public score is a **positive percentage**; ranking respects **evidence** (Wilson lower bound). The UI makes that hierarchy obvious: `%` first, sample size and confidence second, decoration never.

## Color

Semantic CSS variables (defined in `apps/web/src/app/globals.css`).

| Token | Role |
| --- | --- |
| `--gs-canvas` | Page background |
| `--gs-surface` | Panels, cards, inputs |
| `--gs-surface-raised` | Menus, popovers |
| `--gs-surface-hover` | Hover / selected soft fill |
| `--gs-border` / `--gs-border-strong` | Dividers; prefer borders over shadows |
| `--gs-text` / `--gs-text-muted` / `--gs-text-subtle` | Text hierarchy |
| `--gs-brand` | Teal accent — links, focus, primary CTAs |
| `--gs-positive` / `--gs-mixed` / `--gs-negative` | Score sentiment (distinct from brand teal) |

### Dark (default)

- Brand ≈ `#2dd4bf` (hover `#5eead4`)
- Canvas ≈ `#0a0c10`, surfaces cool gray without violet

### Light

- Brand ≈ `#0f766e` (hover `#0d9488`) for WCAG on white buttons
- Canvas ≈ `#f4f5f7`

## Typography

| Role | Family | Use |
| --- | --- | --- |
| Display | Zilla Slab (`--font-display`) | Page titles, wordmark |
| Sans | IBM Plex Sans (`--font-sans`) | UI, body, forms |
| Score | IBM Plex Sans + `tabular-nums` | `%`, counts, rankings |

Scale (approximate):

| Level | Size | Weight |
| --- | --- | --- |
| Display / H1 | 1.75–2.25rem | 600–700 (slab) |
| H2 | 1.25–1.5rem | 600 (slab or sans) |
| Body | 0.875–1rem | 400 |
| Small / meta | 0.75–0.8125rem | 400–500 |
| Score hero | 2.5–3.5rem | 700 tabular |

## Spacing

Scale: `4, 8, 12, 16, 24, 32, 48`.

Compact density: prefer `8–12` inside interactive rows; `16–24` between sections.

## Radius

| Token | Value | Use |
| --- | --- | --- |
| small | 4px | Inputs dense, chips |
| medium / card | 8px (`0.5rem`) | Cards, panels |
| large | 12px | Rare (menus) |

No pill badges. Prefer `rounded-md` over `rounded-full`.

## Shadows

Default: none. Borders carry hierarchy. Overlay menus may use a single subtle shadow.

## Motion

| Name | Duration | Use |
| --- | --- | --- |
| instant | 0 | Reduced motion |
| fast | ~120ms | Hover border/bg |
| normal | ~200ms | Tabs, menus open |

No parallax, no decorative entrance loops. Respect `prefers-reduced-motion`.

## Components (base)

- **Button** — primary (brand), secondary (border), ghost, danger; compact padding
- **Card** — border + surface; no default shadow
- **Badge / ScoreBadge** — rounded-md, sentiment tones
- **Input** — strong border, canvas fill
- **ScorePanel** — `%` dominant; n + hint secondary
- **GameCard / GameRow** — cover + name + `%` tabular; row preferred on mobile lists

## Accessibility

- Focus ring: 2px brand outline, 2px offset
- Primary touch targets ≥ 44px height where practical
- Contrast: brand on dark/light checked for buttons and links
- Semantic HTML preferred over ARIA when possible
