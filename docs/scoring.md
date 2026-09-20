# Scoring

The public number is the **positive percentage** of recommendations. Ranking uses the **Wilson score lower bound** of that proportion at 95% confidence (`z = 1.959964`).

```
p = pos / n
lower = (p + z²/(2n) - z * sqrt((p(1-p) + z²/(4n)) / n)) / (1 + z²/n)
```

`n = 0` returns 0. `confidenceScore` is that bound normalised to 0–100.

That is why 10/10 does not outrank 9500/10000, and why Top Rated requires `RANKING_MINIMUM_REVIEWS` (default 50).

## Labels

Labels are stable codes (`VERY_POSITIVE`, `MIXED`, `FEW_REVIEWS`, …) returned by the API and translated in the UI. Fewer than 10 reviews always yield `FEW_REVIEWS`. `OVERWHELMINGLY_POSITIVE` additionally needs 200 reviews and ≥ 95% positive.

## Review ranking

A review's list position mixes Wilson usefulness, vote volume, capped author reputation, text/context quality and a mild recency term. No term can dominate.

## Reputation

Deltas are recorded as `ReputationEvent` rows and clamped to 0–5000. Useful votes, published reviews, moderator removals and confirmed abuse all leave an audit trail.

Public profiles expose a **tier** derived from the current score (translated in the UI):

| Tier | Score |
| --- | --- |
| `NEWCOMER` | 0–49 |
| `ACTIVE` | 50–199 |
| `TRUSTED` | 200–499 |
| `ESTABLISHED` | 500–1499 |
| `RESPECTED` | 1500–2999 |
| `ELITE` | 3000–5000 |

The public reputation ledger shows reason, delta and date. Moderator removals and confirmed abuse are visible only to moderators/admins; visitors see a single opaque `moderationNet` adjustment when those events affect the score.

Profile analytics (genre/platform breakdowns, timelines, hours) use only `PUBLISHED` non-deleted reviews, count a review in every genre of its game, put missing platforms in an `unspecified` bucket, and hide category buckets with fewer than 3 reviews.

## Review bombs

Detection compares one day against the game's own 30-day median volume. A spike that is both large and one-sided writes a `ReviewBombEvent`. Nothing is deleted automatically; a moderator confirms or dismisses the window. Confirmed windows are excluded from the alternate statistics payload.
