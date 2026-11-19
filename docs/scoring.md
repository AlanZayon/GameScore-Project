# Scoring

**Idioma:** [Português](./scoring.md) · [English](./en/scoring.md)

O número público é o **percentual positivo** de recomendações. O ranking usa o **limite inferior do intervalo de Wilson** dessa proporção a 95% de confiança (`z = 1.959964`).

```text
p = pos / n
lower = (p + z²/(2n) - z * sqrt((p(1-p) + z²/(4n)) / n)) / (1 + z²/n)
```

`n = 0` retorna 0. `confidenceScore` é esse bound normalizado para 0–100.

Por isso 10/10 **não** supera 9500/10000 no ranking, e o Top Rated exige `RANKING_MINIMUM_REVIEWS` (padrão: 50).

## Labels

Labels são códigos estáveis (`VERY_POSITIVE`, `MIXED`, `FEW_REVIEWS`, …) devolvidos pela API e traduzidos na UI. Menos de 10 reviews sempre geram `FEW_REVIEWS`. `OVERWHELMINGLY_POSITIVE` exige ainda 200 reviews e ≥ 95% positivo.

## Ranking de reviews

A posição de uma review na lista mistura Wilson de utilidade, volume de votos, reputação do autor (com teto), qualidade de texto/contexto e um termo leve de recência. Nenhum termo pode dominar sozinho.

## Reputação

Deltas são gravados como linhas `ReputationEvent` e limitados a 0–5000. Votos úteis, reviews publicadas, remoções de moderador e abuso confirmado deixam trilha de auditoria.

Perfis públicos expõem um **tier** derivado do score atual (traduzido na UI):

| Tier | Score |
| ---- | ----- |
| `NEWCOMER` | 0–49 |
| `ACTIVE` | 50–199 |
| `TRUSTED` | 200–499 |
| `ESTABLISHED` | 500–1499 |
| `RESPECTED` | 1500–2999 |
| `ELITE` | 3000–5000 |

O ledger público mostra motivo, delta e data. Remoções de moderador e abuso confirmado são visíveis só para moderadores/admins; visitantes veem um ajuste opaco `moderationNet` quando esses eventos afetam o score.

Analytics de perfil (gêneros/plataformas, timelines, horas) usam só reviews `PUBLISHED` não deletadas, contam a review em cada gênero do jogo, colocam plataforma ausente em `unspecified` e escondem buckets com menos de 3 reviews.

## Review bombs

A detecção compara um dia com a mediana de volume de 30 dias **do próprio jogo**. Um pico grande e unilateral grava um `ReviewBombEvent`. Nada é apagado automaticamente; um moderador confirma ou descarta a janela. Janelas confirmadas são excluídas do payload de estatísticas alternativas.
