import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = 'GameScore';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function loadZilla(): Promise<Buffer | null> {
  const candidates = [
    join(process.cwd(), 'src/app/fonts/ZillaSlab-Bold.ttf'),
    join(process.cwd(), 'apps/web/src/app/fonts/ZillaSlab-Bold.ttf'),
  ];
  for (const path of candidates) {
    try {
      return await readFile(path);
    } catch {
      // try next
    }
  }
  return null;
}

export default async function OpenGraphImage() {
  const font = await loadZilla();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 72,
          background: 'linear-gradient(145deg, #0a0c10 0%, #121826 55%, #0f766e 140%)',
          color: '#f8fafc',
          fontFamily: font ? 'Zilla Slab' : 'Georgia, serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 72,
            height: 72,
            borderRadius: 16,
            background: '#0a0c10',
            color: '#2dd4bf',
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            marginBottom: 36,
          }}
        >
          GS
        </div>
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
          GameScore
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 28,
            color: '#94a3b8',
            maxWidth: 820,
            lineHeight: 1.35,
            fontFamily: 'IBM Plex Sans, Arial, sans-serif',
          }}
        >
          Avaliações de jogos por jogadores reais
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font
        ? [
            {
              name: 'Zilla Slab',
              data: font,
              style: 'normal' as const,
              weight: 700 as const,
            },
          ]
        : undefined,
    },
  );
}
