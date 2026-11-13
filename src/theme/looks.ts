/**
 * Ready-made looks for a room: paper, ink, accent, texture, lettering. Every
 * room starts from one and can then change any part of it. Residents' rooms
 * are built from these too.
 */
import type { RoomTheme } from '@/data/types';

export type LookName =
  | 'house'
  | 'bubblegum'
  | 'blueprint'
  | 'kraft'
  | 'mint'
  | 'newsprint'
  | 'sunburn'
  | 'midnight'
  | 'lemon'
  | 'lilac'
  | 'forest'
  | 'tomato'
  | 'notebook'
  | 'candy'
  | 'peach'
  | 'pool'
  | 'fog'
  | 'zine';

const look = (
  paper: string,
  card: string,
  ink: string,
  accent: string,
  highlight: string,
  texture: RoomTheme['texture'],
  displayFont: RoomTheme['displayFont'],
  wall: RoomTheme['wall'] = 'grid',
  layout: RoomTheme['layout'] = 'loose',
): RoomTheme => ({ paper, card, ink, accent, highlight, texture, displayFont, wall, layout });

export const looks: Record<LookName, RoomTheme> = {
  house: look('#EFE6D2', '#F9F3E5', '#1F2A6B', '#F0502F', '#FFD23F', 'grain', 'poster'),
  bubblegum: look('#F3C6D0', '#FFF6EC', '#1D4B3A', '#E5482B', '#FFE066', 'grid', 'poster', 'scatter'),
  blueprint: look('#1B2559', '#243070', '#F4EBD6', '#FF7A59', '#3D5BD9', 'dots', 'typeBold', 'grid', 'pages'),
  kraft: look('#CBAA7C', '#EFE2C6', '#2B211B', '#B5301E', '#F3E3A2', 'grain', 'hand', 'scatter'),
  mint: look('#BFE5D2', '#F4FBF6', '#3A1F4D', '#E5482B', '#FFE066', 'dots', 'poster'),
  newsprint: look('#DCD8CC', '#F3F0E6', '#1E1E1E', '#B3261E', '#F2D94E', 'grain', 'serifBlack', 'grid', 'pages'),
  sunburn: look('#F6A04D', '#FFF0D6', '#1F2A6B', '#C9391C', '#FFE066', 'grain', 'poster', 'scatter'),
  midnight: look('#1E1533', '#2C2148', '#F7C6D9', '#FF5C8A', '#4B3A8C', 'grain', 'serifBlack'),
  lemon: look('#F9E26B', '#FFF9D9', '#1B1B1B', '#D7263D', '#FFFFFF', 'grain', 'typeBold'),
  lilac: look('#D5C8F0', '#F6F1FF', '#1F3D2B', '#D94F30', '#FFE066', 'grain', 'poster', 'scatter'),
  forest: look('#1F4034', '#2A5244', '#F3E9D2', '#F2A541', '#356B58', 'grain', 'serifBlack'),
  tomato: look('#E5482B', '#F26A4F', '#FFF3DE', '#FFD23F', '#B5301E', 'dots', 'poster', 'scatter', 'poster'),
  notebook: look('#FBFAF4', '#FFFFFF', '#23308C', '#D7263D', '#FFF07A', 'ruled', 'hand'),
  candy: look('#FBD3E0', '#FFF4F8', '#3B2A6B', '#FF5C8A', '#B8F2E6', 'dots', 'poster', 'scatter'),
  peach: look('#FFD8C2', '#FFF4EC', '#5A2A27', '#E5482B', '#FFF1A8', 'grain', 'hand'),
  pool: look('#A9DDE6', '#F1FBFD', '#14305A', '#F0502F', '#FFE066', 'grid', 'serifBlack'),
  fog: look('#DDE5E4', '#F4F7F5', '#2B3A42', '#C6533A', '#BFD9D2', 'grain', 'serifBlack', 'grid', 'pages'),
  zine: look('#F2F0E6', '#FFFFFF', '#161616', '#E5262B', '#FFE600', 'dots', 'typeBold', 'scatter', 'poster'),
};

export const lookNames = Object.keys(looks) as LookName[];

/** Colours on offer in the customiser, for paper, ink, accent and highlighter alike. */
export const swatches = [
  '#EFE6D2', '#FBFAF4', '#FFFFFF', '#DCD8CC', '#CBAA7C', '#FFD8C2', '#F3C6D0', '#FBD3E0',
  '#D5C8F0', '#A9DDE6', '#BFE5D2', '#F9E26B', '#FFD23F', '#F6A04D', '#F0502F', '#E5482B',
  '#D7263D', '#B5301E', '#FF5C8A', '#7B2CBF', '#3D5BD9', '#23308C', '#1F2A6B', '#14305A',
  '#2C9C8C', '#1F4034', '#1D4B3A', '#5A2A27', '#2B211B', '#1E1533', '#1B2559', '#161616',
];
