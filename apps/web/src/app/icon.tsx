import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const size = { width: 32, height: 32 };
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

export default async function Icon() {
  const font = await loadZilla();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0c10',
          borderRadius: 6,
          color: '#2dd4bf',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '-0.04em',
          fontFamily: font ? 'Zilla Slab' : 'Georgia, serif',
        }}
      >
        GS
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
