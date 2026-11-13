/**
 * The first few residents. This file feeds the look-and-feel pass directly;
 * once the local database lands it becomes part of what gets seeded into it.
 */
import type { Person, Room } from '@/data/types';
import { colors } from '@/theme';

export const people: Omit<Person, 'seeded'>[] = [
  {
    id: 'maren',
    name: 'Maren Kowalczyk',
    handle: 'marenonthe501',
    badge: 'MK',
    badgeColor: colors.pink,
    tagline: 'the 501 streetcar is my listening room',
    bio: 'Bookseller, Queen West. I will lend you a record and then think about it every day until you give it back.',
    homeCity: 'Toronto',
  },
  {
    id: 'dev',
    name: 'Devanshi Rao',
    handle: 'dev.at.night',
    badge: 'DR',
    badgeColor: colors.highlighter,
    tagline: 'audio engineer. yes i can hear that. no i can’t fix it',
    bio: 'Audio engineer by day. At night, also an audio engineer, but sad about it. Scarborough born, Dufferin bus raised.',
    homeCity: 'Toronto',
  },
  {
    id: 'tobi',
    name: 'Tobi Adeyemi',
    handle: 'tobi.lifts.to.fela',
    badge: 'TA',
    badgeColor: '#7FCFA9',
    tagline: 'plays 12-minute songs at the gym. will not be taking questions',
    bio: 'Mississauga. Afrobeat, highlife, and whatever my dad had on in the Camry.',
    homeCity: 'Mississauga',
  },
  {
    id: 'priya',
    name: 'Priya Gill',
    handle: 'priyafrombrampton',
    badge: 'PG',
    badgeColor: '#F6B26B',
    tagline: 'brampton to the world. the aux is not a democracy',
    bio: 'Punjabi rap, old Bollywood, and a deep bench of wedding bangers. Ask me about the 2021 AP Dhillon summer.',
    homeCity: 'Brampton',
  },
  {
    id: 'callum',
    name: 'Callum Reid',
    handle: 'callum_in_the_pit',
    badge: 'CR',
    badgeColor: colors.tomato,
    tagline: 'seen PUP eleven times, twelve if you count the parking lot',
    bio: 'East end. Line cook. If it has gang vocals I already love it and you can stop pitching.',
    homeCity: 'Toronto',
  },
  {
    id: 'hana',
    name: 'Hana Mori',
    handle: 'hana.cant.hear.you',
    badge: 'HM',
    badgeColor: '#B9A7E8',
    tagline: 'shoegaze. sorry, what? no, i can’t hear you',
    bio: 'North York. Pedal collector, reluctant guitarist. Believes reverb is a personality and is correct.',
    homeCity: 'Toronto',
  },
  {
    id: 'sol',
    name: 'Sol Benítez',
    handle: 'sol.leaves.at.one',
    badge: 'SB',
    badgeColor: '#8FD3E8',
    tagline: 'club music for people who are home by 1',
    bio: 'Vaughan. I love dancing and I love my bed and I refuse to choose.',
    homeCity: 'Vaughan',
  },
  {
    id: 'wren',
    name: 'Wren Abbott',
    handle: 'wren.plays.badly',
    badge: 'WA',
    badgeColor: '#E7D36A',
    tagline: 'jazz piano and exactly one Nickelback song',
    bio: 'Piano teacher in the Junction. I contain multitudes and one of them is from Alberta.',
    homeCity: 'Toronto',
  },
];

export const person = (id: string) => {
  const p = people.find((x) => x.id === id);
  if (!p) throw new Error(`no seeded person "${id}"`);
  return p;
};

// ---- rooms ----------------------------------------------------------------

export const rooms: Room[] = [
  {
    personId: 'maren',
    theme: {
      paper: '#F3C6D0', // riso pink
      card: '#FFF6EC',
      ink: '#1D4B3A', // bottle green
      accent: '#E5482B',
      highlight: '#FFE066',
      texture: 'grid',
      displayFont: 'poster',
      wall: 'scatter',
      layout: 'loose',
    },
    sections: [
      {
        kind: 'intro',
        title: 'three songs, if we’ve never met',
        songs: [
          { trackId: 'big-thief-not', why: 'the one I’d play to explain myself. it doesn’t, but it’s loud.' },
          { trackId: 'alvvays-archie', why: 'the one that makes me insufferable at weddings.' },
          { trackId: 'joni-a-case-of-you', why: 'the one I’m not ready to talk about.' },
        ],
        stickers: [{ kind: 'star', color: '#FFE066', x: 0.86, y: -0.06, size: 54, rotate: 14 }],
      },
      {
        kind: 'pinned',
        title: 'the pinned record',
        trackId: 'bss-anthems',
        note: 'Grade 10. Back seat of my cousin’s Corolla, the 401, somewhere past Pickering. She said “you’re not ready for this one” and she was right, and I’ve been not ready ever since.',
        stickers: [{ kind: 'heart', color: '#E5482B', x: 0.02, y: 0.7, size: 40, rotate: -12 }],
      },
      {
        kind: 'wall',
        title: 'the wall',
        trackIds: [
          'yo-la-tengo-autumn-sweater',
          'feist-mushaboom',
          'alex-g-runner',
          'phoebe-motion-sickness',
          'wednesday-chosen-to-deserve',
          'mj-lenderman-shes-leaving-you',
          'sufjan-chicago',
          'nick-drake-pink-moon',
          'elliott-between-the-bars',
        ],
        stickers: [
          { kind: 'burst', color: '#FFE066', x: 0.7, y: 0.52, size: 78, rotate: -10, label: 'no\nskips' },
          { kind: 'eye', color: '#FFF6EC', x: 0.27, y: 0.26, size: 40, rotate: 8 },
        ],
      },
      {
        kind: 'shelf',
        title: 'albums for the walk home',
        trackIds: ['bon-iver-holocene', 'nick-drake-pink-moon', 'big-thief-simulation-swarm', 'yo-la-tengo-autumn-sweater', 'feist-mushaboom'],
      },
      {
        kind: 'liner',
        title: 'liner notes',
        notes: [
          {
            trackId: 'wednesday-chosen-to-deserve',
            text: 'Every verse is a confession you’d only make to someone who has already decided to stay. Also, it rips.',
          },
          {
            text: 'Unpopular: the best seat at Massey Hall is the bad one behind the pillar. You have to lean. Leaning is commitment.',
          },
          { trackId: 'mj-lenderman-shes-leaving-you', text: 'He sounds like a man apologising at a barbecue. Five stars.' },
        ],
      },
      {
        kind: 'shelf',
        title: 'songs i can only listen to after midnight',
        trackIds: ['elliott-between-the-bars', 'mitski-my-love-mine', 'radiohead-weird-fishes', 'joni-a-case-of-you'],
        stickers: [{ kind: 'flower', color: '#FFF6EC', x: 0.84, y: -0.12, size: 44, rotate: 20 }],
      },
      {
        kind: 'guestbook',
        title: 'guestbook',
        entries: [
          { fromId: 'callum', trackId: 'pup-kids', why: 'you need to be yelled at. lovingly. three minutes, you’ll be fine.' },
          {
            fromId: 'hana',
            trackId: 'cocteau-heaven-or-las-vegas',
            why: 'for the streetcar. window seat. do not look at your phone once.',
          },
          {
            fromId: 'tobi',
            trackId: 'badu-didnt-cha-know',
            why: 'you said you “don’t really do neo-soul.” respectfully: start here.',
          },
        ],
      },
      {
        kind: 'recent',
        title: 'recently played',
        visibility: 'shown',
        trackIds: ['big-thief-vampire-empire', 'alvvays-belinda-says', 'jbrekkie-be-sweet', 'bss-anthems'],
      },
    ],
  },
  {
    personId: 'dev',
    theme: {
      paper: '#1B2559', // blueprint
      card: '#243070',
      ink: '#F4EBD6',
      accent: '#FF7A59',
      highlight: '#3D5BD9',
      texture: 'dots',
      displayFont: 'typeBold',
      wall: 'grid',
      layout: 'pages',
    },
    sections: [
      {
        kind: 'pinned',
        title: 'PINNED',
        trackId: 'burial-archangel',
        note: 'Night bus, 2 a.m., Dufferin and Bloor, rain on the window doing half the work. I missed my stop on purpose and walked back.',
      },
      {
        kind: 'liner',
        title: 'NOTES FROM THE BOOTH',
        notes: [
          { trackId: 'steely-dan-peg', text: 'Seven guitarists tried that solo before they kept one. I think about the other six a lot.' },
          { text: 'If your favourite album was mastered loud, I don’t think less of you. I think less of the album.' },
          { trackId: 'aphex-avril-14th', text: 'You can hear the piano’s mechanism clunking. He left it in. That’s the whole lesson.' },
        ],
        stickers: [{ kind: 'bolt', color: '#FF7A59', x: 0.86, y: -0.08, size: 46, rotate: 12 }],
      },
      {
        kind: 'intro',
        title: 'START HERE',
        songs: [
          { trackId: 'mk-gee-are-you-looking-up', why: 'sounds like a cassette of a song that hasn’t been written yet.' },
          { trackId: 'madvillain-all-caps', why: 'two minutes ten. not a second wasted. take notes, everyone.' },
          { trackId: 'aphex-avril-14th', why: 'for when I need to remember I’m a person.' },
        ],
      },
      {
        kind: 'shelf',
        title: 'SONGS THAT SOUND LIKE FLUORESCENT LIGHTS',
        trackIds: ['boc-roygbiv', 'burial-archangel', 'four-tet-baby', 'stereolab-french-disko'],
      },
      {
        kind: 'wall',
        title: 'MIXES I’D DEFEND IN COURT',
        trackIds: ['steely-dan-peg', 'sade-no-ordinary-love', 'dangelo-lady', 'talking-heads-this-must-be', 'fleetwood-everywhere', 'tribe-electric-relaxation'],
        stickers: [{ kind: 'smile', color: '#FFD23F', x: 0.74, y: 0.74, size: 56, rotate: -14 }],
      },
      {
        kind: 'guestbook',
        title: 'GUESTBOOK',
        entries: [
          {
            fromId: 'sol',
            trackId: 'caribou-cant-do-without-you',
            why: 'you need one (1) song that builds for no reason other than joy. prescription.',
          },
          { fromId: 'wren', trackId: 'bill-evans-peace-piece', why: 'two chords for six minutes. I know you’ll respect the restraint.' },
        ],
      },
      { kind: 'recent', title: 'RECENTLY PLAYED', visibility: 'hidden', trackIds: [] },
    ],
  },
];

