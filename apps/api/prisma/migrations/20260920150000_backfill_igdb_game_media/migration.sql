-- Backfill trailer / gallery / banner for IGDB imports that predate the
-- game-media columns (or were never mapped). Uses the stored rawPayload only.

UPDATE "games" AS g
SET
  "galleryImageUrls" = CASE
    WHEN cardinality(g."galleryImageUrls") > 0 THEN g."galleryImageUrls"
    ELSE COALESCE((
      SELECT ARRAY(
        SELECT regexp_replace(
          CASE
            WHEN shot.url LIKE '//%' THEN 'https:' || shot.url
            ELSE shot.url
          END,
          't_(thumb|cover_small|screenshot_med|screenshot_big)',
          't_screenshot_huge'
        )
        FROM (
          SELECT value->>'url' AS url
          FROM jsonb_array_elements(COALESCE(s."rawPayload"->'screenshots', '[]'::jsonb))
        ) AS shot
        WHERE shot.url IS NOT NULL AND length(shot.url) > 0
        LIMIT 12
      )
    ), g."galleryImageUrls")
  END,
  "bannerImageUrl" = COALESCE(
    g."bannerImageUrl",
    (
      SELECT regexp_replace(
        CASE
          WHEN shot.url LIKE '//%' THEN 'https:' || shot.url
          ELSE shot.url
        END,
        't_(thumb|cover_small|screenshot_med|screenshot_big)',
        't_screenshot_huge'
      )
      FROM (
        SELECT value->>'url' AS url
        FROM jsonb_array_elements(COALESCE(s."rawPayload"->'screenshots', '[]'::jsonb))
      ) AS shot
      WHERE shot.url IS NOT NULL AND length(shot.url) > 0
      LIMIT 1
    )
  ),
  "trailerYoutubeId" = COALESCE(
    g."trailerYoutubeId",
    (
      SELECT left(vid.video_id, 32)
      FROM (
        SELECT
          value->>'video_id' AS video_id,
          value->>'name' AS name
        FROM jsonb_array_elements(COALESCE(s."rawPayload"->'videos', '[]'::jsonb))
      ) AS vid
      WHERE vid.video_id IS NOT NULL AND length(trim(vid.video_id)) > 0
      ORDER BY CASE WHEN vid.name ~* 'trailer' THEN 0 ELSE 1 END
      LIMIT 1
    )
  )
FROM "game_external_sources" AS s
WHERE s."gameId" = g.id
  AND s.provider = 'IGDB'
  AND s."rawPayload" IS NOT NULL
  AND (
    cardinality(g."galleryImageUrls") = 0
    OR g."trailerYoutubeId" IS NULL
    OR g."bannerImageUrl" IS NULL
  );
