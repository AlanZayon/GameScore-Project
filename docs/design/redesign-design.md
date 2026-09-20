# Feature Design — Evidence Redesign

## Objective

Replace AI-slop purple/dark generics with an Evidence UI: compact, teal accent, slab+sans, `%`-first score presentation, data-first home, parity across mobile and desktop. Full product including admin.

## User

Players discovering and rating games; moderators/admins managing content.

## Primary Action

Find a game → read score with evidence → recommend / not recommend.

## Secondary Actions

Browse rankings, search, manage profile/settings, moderate (admin).

## Information Architecture

### Home (data-first)

1. One-line product proposition + optional muted totals
2. Search (or clear path to header search)
3. Dense sections: popular, top rated, new, trending (rows on mobile; compact cards on desktop)
4. Recent reviews (compact)

### Game detail

1. Cover + title + meta
2. ScorePanel (`%` hero; n + confidence secondary)
3. Media, platforms, reviews, form

### Catalog / Rankings / Search

Filter controls + dense list/grid of games with tabular `%`.

### Scoring

Editorial explainer; display type for title; dense readable body.

### Auth / Settings / Legal

Compact forms; same tokens; no decorative marketing chrome.

### Admin

Dense tables, filter chips, dialogs; shared tokens; no stacked decorative cards.

## Visual Direction

Evidence / data-forward · dark-first · teal · Zilla Slab + IBM Plex Sans · compact / utilitarian · functional motion.

## Layout

- `container-page` max ~80rem; tighter vertical rhythm (`py-6`–`py-8`)
- Mobile: single column, GameRow lists, score under title
- Desktop: multi-column detail; score sticky right; denser grids

## Components

ScorePanel, GameCard, GameRow, ScoreBadge, SiteHeader (slab wordmark), SiteFooter, Tabs, admin panels.

## Responsive Behavior

Parity: intentional layout changes at `md`/`lg` (list ↔ grid, header search visibility, detail columns), not only shrink.

## Interaction

Hover: border / surface-hover. Tabs: brand fill. Menus: raised surface. Score bar: width reflects positive %.

## States

Loading skeletons, empty dashed borders, error soft negative panel, disabled opacity — keep patterns, restyle to tokens.

## Accessibility

Focus teal; keyboard nav unchanged; reduced motion preserved; score `%` readable without color alone (label text).

## Technical Constraints

Next.js App Router, Tailwind 4, next-intl, existing DTOs. No new UI library. No API changes.

## Implementation Notes

Tokens in `globals.css`; fonts in root `layout.tsx`; redesign confined to `apps/web`.

## Open Questions

None — decisions locked in plan.
