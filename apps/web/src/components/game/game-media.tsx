'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { isRemoteCoverUrl } from '@/lib/cover-image';

function youtubeEmbedSrc(videoId: string): string {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params}`;
}

export function GameMedia({
  gameName,
  trailerYoutubeId,
  galleryImageUrls,
}: {
  gameName: string;
  trailerYoutubeId: string | null;
  galleryImageUrls: string[];
}) {
  const t = useTranslations('game');
  const gallery = galleryImageUrls.filter(isRemoteCoverUrl);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [galleryImageUrls]);

  if (trailerYoutubeId) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{t('mediaTrailer')}</h2>
        <div className="aspect-video overflow-hidden rounded-card border border-border-subtle bg-surface">
          <iframe
            title={t('mediaTrailerTitle', { name: gameName })}
            src={youtubeEmbedSrc(trailerYoutubeId)}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </section>
    );
  }

  if (gallery.length === 0) return null;

  const current = gallery[Math.min(index, gallery.length - 1)]!;
  const go = (delta: number) => {
    setIndex((value) => (value + delta + gallery.length) % gallery.length);
  };

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{t('mediaGallery')}</h2>
      <div className="relative overflow-hidden rounded-card border border-border-subtle bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current}
          alt={t('mediaGalleryAlt', { name: gameName, index: index + 1, total: gallery.length })}
          className="aspect-video w-full object-cover"
        />
        {gallery.length > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md bg-black/55 px-2 py-1 text-sm text-white hover:bg-black/70"
              onClick={() => go(-1)}
              aria-label={t('mediaPrev')}
            >
              ‹
            </button>
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-black/55 px-2 py-1 text-sm text-white hover:bg-black/70"
              onClick={() => go(1)}
              aria-label={t('mediaNext')}
            >
              ›
            </button>
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {gallery.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  aria-label={t('mediaGoTo', { index: i + 1 })}
                  className={`h-2 w-2 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
