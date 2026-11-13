import type { RoomTheme } from '@/data/types';
import { fonts } from '@/theme';
import type { Inks } from './print';

/** Rough luminance, to pick a light or dark status bar for a room's paper. */
export function isDark(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 128;
}

/** Turn a room's theme into the inks every printed component reads. */
export const inksFor = (theme: RoomTheme): Inks => ({
  paper: theme.paper,
  card: theme.card,
  ink: theme.ink,
  accent: theme.accent,
  highlight: theme.highlight,
  display: fonts[theme.displayFont],
});
