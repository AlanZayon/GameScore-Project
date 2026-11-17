import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GameScore',
    short_name: 'GameScore',
    description: 'Avaliações de jogos por jogadores reais',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0c10',
    theme_color: '#0a0c10',
    icons: [
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
