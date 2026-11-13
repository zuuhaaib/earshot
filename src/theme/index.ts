/**
 * earshot's print shop.
 *
 * The whole app is a two-colour riso job on cheap cream stock: everything is
 * printed in one blue ink, with tomato red for the things you can do and a
 * yellow highlighter for the things that are happening right now. There is no
 * black and no grey anywhere; "lighter" text is the same ink, watered down.
 */
import type { TextStyle } from 'react-native';

export const colors = {
  paper: '#EFE6D2', // the page
  card: '#F9F3E5', // a fresh index card
  kraft: '#CBAA7C', // cardboard sleeve
  ink: '#1F2A6B', // the one ink
  inkSoft: '#5B6399', // the one ink, watered down
  inkFaint: '#A9ABC2', // pencil
  tomato: '#F0502F', // do this
  tomatoDeep: '#C9391C',
  highlighter: '#FFD23F', // happening now
  teal: '#2C9C8C', // shared on purpose
  pink: '#F7A6BF', // sticker pink
  tape: 'rgba(233, 214, 150, 0.78)', // masking tape
  white: '#FFFDF7',
} as const;

/** Font family names, exactly as loaded in app/_layout.tsx. */
export const fonts = {
  poster: 'BowlbyOne_400Regular', // gig-poster wood type: names, headlines, buttons
  serif: 'Besley_500Medium', // Clarendon, the record-sleeve face: reading text
  serifItalic: 'Besley_500Medium_Italic',
  serifBold: 'Besley_800ExtraBold', // song titles
  serifBlack: 'Besley_900Black',
  type: 'CourierPrime_400Regular', // typewriter: facts, timestamps, catalogue details
  typeBold: 'CourierPrime_700Bold',
  hand: 'NanumPenScript_400Regular', // biro: anything a person wrote themselves
} as const;

/** Type presets. Poster and hand faces are never used below 13 and 20. */
export const type = {
  wordmark: { fontFamily: fonts.poster, fontSize: 44, lineHeight: 48, letterSpacing: -1 },
  poster: { fontFamily: fonts.poster, fontSize: 30, lineHeight: 34, letterSpacing: -0.5 },
  posterSm: { fontFamily: fonts.poster, fontSize: 19, lineHeight: 24 },
  button: { fontFamily: fonts.poster, fontSize: 15, lineHeight: 20 },
  title: { fontFamily: fonts.serifBlack, fontSize: 21, lineHeight: 25 },
  titleSm: { fontFamily: fonts.serifBold, fontSize: 16, lineHeight: 20 },
  body: { fontFamily: fonts.serif, fontSize: 15, lineHeight: 22 },
  bodyItalic: { fontFamily: fonts.serifItalic, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.serif, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.typeBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
  meta: { fontFamily: fonts.type, fontSize: 12, lineHeight: 16 },
  hand: { fontFamily: fonts.hand, fontSize: 22, lineHeight: 24 },
  handLg: { fontFamily: fonts.hand, fontSize: 28, lineHeight: 29 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 } as const;

/** Small, repeatable tilts so nothing sits perfectly straight. Stable per key. */
export function tilt(key: string, max = 1.6): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const unit = ((h >>> 0) % 1000) / 1000; // 0..1
  const deg = (unit * 2 - 1) * max;
  return Math.abs(deg) < 0.35 ? (deg < 0 ? -0.5 : 0.5) : deg;
}

export const textures = {
  grain: require('../../assets/tex/grain.png'),
  grid: require('../../assets/tex/grid.png'),
  ruled: require('../../assets/tex/ruled.png'),
  dots: require('../../assets/tex/dots.png'),
} as const;
