import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SpeedOn Recovery Platform',
    short_name: 'SpeedOn',
    description: 'Vehicle repossession admin and field agent lookup app',
    start_url: '/',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#1d4ed8',
  };
}