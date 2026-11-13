/**
 * Everyone who lives in the seeded GTA, and what they listen to.
 *
 * `people.ts` has the first eight (and the hand-decorated rooms). This file
 * adds the rest of the neighbourhood and gives every resident a taste: the
 * tracks they'd plausibly have on, and the ones they'd push on a stranger.
 */
import type { Person } from '@/data/types';
import { people as firstEight } from './people';

type Resident = Omit<Person, 'seeded'>;

const more: Resident[] = [
  {
    id: 'amara',
    name: 'Amara Nwosu',
    handle: 'amara.after.hours',
    badge: 'AN',
    badgeColor: '#B9A7E8',
    tagline: 'r&b that sounds like 2 a.m., even at lunch',
    bio: 'Scarborough. Nurse, night shifts. My commute playlist is the only thing keeping the 401 safe.',
    homeCity: 'Toronto',
  },
  {
    id: 'jonah',
    name: 'Jonah Feldman',
    handle: 'jonah.has.notes',
    badge: 'JF',
    badgeColor: '#E7D36A',
    tagline: 'will explain Steely Dan to you. you will not be asked',
    bio: 'Thornhill. Accountant with a hi-fi he can’t justify and a wife who has stopped asking.',
    homeCity: 'Vaughan',
  },
  {
    id: 'kiran',
    name: 'Kiran Sandhu',
    handle: 'kiran.on.the.go',
    badge: 'KS',
    badgeColor: '#F6B26B',
    tagline: 'GO train DJ. audience of one. sold out nightly',
    bio: 'Brampton to Union and back, five days a week. That’s ten hours of listening and I use all of it.',
    homeCity: 'Brampton',
  },
  {
    id: 'bea',
    name: 'Bea Carvalho',
    handle: 'bea.on.dundas',
    badge: 'BC',
    badgeColor: '#FF9E80',
    tagline: 'has cried to Feist in the produce aisle. twice',
    bio: 'Little Portugal. Florist. Everything I love was recorded in a church or sounds like it was.',
    homeCity: 'Toronto',
  },
  {
    id: 'malik',
    name: 'Malik Thompson',
    handle: 'malik.crates',
    badge: 'MT',
    badgeColor: '#7FCFA9',
    tagline: 'my dad’s records. my problem now',
    bio: 'Eglinton West. Inherited four hundred LPs and a strong opinion about each one.',
    homeCity: 'Toronto',
  },
  {
    id: 'yuki',
    name: 'Yuki Tanaka',
    handle: 'yuki.loops',
    badge: 'YT',
    badgeColor: '#F7A6BF',
    tagline: 'one song. forty times. no notes',
    bio: 'Markham. Animator. If I’m quiet it’s because the bridge is coming.',
    homeCity: 'Markham',
  },
  {
    id: 'sofia',
    name: 'Sofia Marchetti',
    handle: 'sofia.in.woodbridge',
    badge: 'SM',
    badgeColor: '#FFD23F',
    tagline: 'nonna says it’s all noise. nonna is sometimes right',
    bio: 'Woodbridge. Hairdresser. The salon speaker is mine and everybody knows it.',
    homeCity: 'Vaughan',
  },
  {
    id: 'dez',
    name: 'Dez Clarke',
    handle: 'dez.plays.bass',
    badge: 'DC',
    badgeColor: '#8FD3E8',
    tagline: 'bass player. i know. i’m sorry',
    bio: 'Wedding band on weekends, jazz trio on Tuesdays to feel something.',
    homeCity: 'Toronto',
  },
  {
    id: 'ingrid',
    name: 'Ingrid Solberg',
    handle: 'ingrid.by.the.lake',
    badge: 'IS',
    badgeColor: '#5CC2B0',
    tagline: 'very quiet music. very loud opinions',
    bio: 'The Beaches. I walk the boardwalk with one album a day and I do not take requests.',
    homeCity: 'Toronto',
  },
  {
    id: 'mateo',
    name: 'Mateo Rojas',
    handle: 'mateo.sube.el.volumen',
    badge: 'MR',
    badgeColor: '#F0502F',
    tagline: 'perreo scholar. salsa by inheritance',
    bio: 'St. Clair West. Barber. The chair spins and so does the playlist.',
    homeCity: 'Toronto',
  },
  {
    id: 'farah',
    name: 'Farah Haddad',
    handle: 'farah.skips.intros',
    badge: 'FH',
    badgeColor: '#C6E377',
    tagline: 'skips the intro, then complains she missed it',
    bio: 'Mississauga. Law student. I listen to sad songs efficiently.',
    homeCity: 'Mississauga',
  },
  {
    id: 'owen',
    name: 'Owen MacLeod',
    handle: 'owen.cottage.country',
    badge: 'OM',
    badgeColor: '#E7D36A',
    tagline: 'the Hip are not up for debate',
    bio: 'The Danforth. High school history teacher. Yes, I play it for the kids. No, they don’t get it yet.',
    homeCity: 'Toronto',
  },
  {
    id: 'zainab',
    name: 'Zainab Hussain',
    handle: 'zainab.nightbus',
    badge: 'ZH',
    badgeColor: '#B9A7E8',
    tagline: 'the 320 night bus has the best acoustics in the city',
    bio: 'Scarborough. Bartender. I hear everyone’s music all night, so the ride home is mine.',
    homeCity: 'Toronto',
  },
  {
    id: 'theo',
    name: 'Theo Papadakis',
    handle: 'theo.eats.late',
    badge: 'TP',
    badgeColor: '#FF9E80',
    tagline: 'emo night survivor. two-time',
    bio: 'Greektown. I work at my uncle’s restaurant and scream in the walk-in freezer as needed.',
    homeCity: 'Toronto',
  },
  {
    id: 'grace',
    name: 'Grace Liu',
    handle: 'grace.practices',
    badge: 'GL',
    badgeColor: '#FFF6EC',
    tagline: 'conservatory kid, recovering',
    bio: 'North York. Fourteen years of piano exams. I’m only now allowed to like things.',
    homeCity: 'Toronto',
  },
  {
    id: 'rohan',
    name: 'Rohan Mehta',
    handle: 'rohan.at.square.one',
    badge: 'RM',
    badgeColor: '#8FD3E8',
    tagline: 'has a playlist for every mall he’s been dumped in',
    bio: 'Mississauga. Software, unfortunately. Sad dad rock without being a dad.',
    homeCity: 'Mississauga',
  },
  {
    id: 'niamh',
    name: 'Niamh O’Connor',
    handle: 'niamh.in.parkdale',
    badge: 'NO',
    badgeColor: '#7FCFA9',
    tagline: 'post-punk, pre-coffee',
    bio: 'Parkdale via Cork. Came for a year in 2019. Still haven’t found a decent tea.',
    homeCity: 'Toronto',
  },
  {
    id: 'jamal',
    name: 'Jamal Edwards',
    handle: 'jamal.aux.cord',
    badge: 'JE',
    badgeColor: '#FFD23F',
    tagline: 'banned from the aux at three separate barbecues',
    bio: 'Brampton. I maintain that the transition was good and the crowd was wrong.',
    homeCity: 'Brampton',
  },
  {
    id: 'clemence',
    name: 'Clémence Bouchard',
    handle: 'clemence.en.ville',
    badge: 'CB',
    badgeColor: '#F7A6BF',
    tagline: 'moved from Montréal. yes it was better. no i’m not leaving',
    bio: 'Leslieville. Translator. I will defend this city in French so nobody here can hear me do it.',
    homeCity: 'Toronto',
  },
  {
    id: 'arjun',
    name: 'Arjun Nair',
    handle: 'arjun.left.the.band',
    badge: 'AR',
    badgeColor: '#5CC2B0',
    tagline: 'left the band. the band is doing fine. it’s fine',
    bio: 'Markham. Used to play guitar very loudly in a basement in Unionville. Now I do it in headphones like an adult.',
    homeCity: 'Markham',
  },
  {
    id: 'lucia',
    name: 'Lucia Ferrante',
    handle: 'lucia.from.maple',
    badge: 'LF',
    badgeColor: '#F6B26B',
    tagline: 'drives in for the show, complains about parking through the encore',
    bio: 'Maple. Dental hygienist. I’ve seen your favourite band and I had to leave early to beat traffic.',
    homeCity: 'Vaughan',
  },
  {
    id: 'kwame',
    name: 'Kwame Mensah',
    handle: 'kwame.highlife',
    badge: 'KM',
    badgeColor: '#C6E377',
    tagline: 'highlife on sundays, whatever on the commute. range',
    bio: 'Weston. Electrician. My van has better speakers than your apartment.',
    homeCity: 'Toronto',
  },
  {
    id: 'hyejin',
    name: 'Hye-jin Park',
    handle: 'hyejin.bside',
    badge: 'HP',
    badgeColor: '#8FD3E8',
    tagline: 'b-sides only. i’m exhausting, i know',
    bio: 'North York. Graphic designer. If it charted I’ll get to it in ten years and act like I found it.',
    homeCity: 'Toronto',
  },
  {
    id: 'dmitri',
    name: 'Dmitri Volkov',
    handle: 'dmitri.listens.loud',
    badge: 'DV',
    badgeColor: '#F0502F',
    tagline: 'your neighbour. sorry about the subwoofer',
    bio: 'Richmond Hill. I’ve had three noise complaints and one compliment, and I framed the compliment.',
    homeCity: 'Richmond Hill',
  },
  {
    id: 'tessa',
    name: 'Tessa Greenberg',
    handle: 'tessa.in.the.annex',
    badge: 'TG',
    badgeColor: '#FFF6EC',
    tagline: 'grad student. this is my one personality',
    bio: 'The Annex. Writing a thesis on something I can’t explain at parties. The music is easier to explain.',
    homeCity: 'Toronto',
  },
  {
    id: 'andre',
    name: 'Andre Baptiste',
    handle: 'andre.selecta',
    badge: 'AB',
    badgeColor: '#7FCFA9',
    tagline: 'selector at family functions since age nine',
    bio: 'Little Jamaica. I read a room faster than you read a menu.',
    homeCity: 'Toronto',
  },
  {
    id: 'marisol',
    name: 'Marisol Vega',
    handle: 'marisol.takes.the.mic',
    badge: 'MV',
    badgeColor: '#F7A6BF',
    tagline: 'karaoke is a sport and i am nationally ranked',
    bio: 'Port Credit. Thursdays at the pub by the lake. Do not sign up after me. It isn’t fair to you.',
    homeCity: 'Mississauga',
  },
  {
    id: 'eli',
    name: 'Eli Rosen',
    handle: 'eli.behind.the.counter',
    badge: 'ER',
    badgeColor: '#E7D36A',
    tagline: 'will sell you a record, then judge you for it',
    bio: 'Kensington Market. Record shop, weekends. The staff picks are all mine; the others have given up.',
    homeCity: 'Toronto',
  },
];

export const residents: Resident[] = [...firstEight, ...more];

export type Taste = {
  /** What they'd have on, any given afternoon. */
  plays: string[];
  /** What they'd put out on purpose, and what they'd say about it. */
  shares: { trackId: string; note: string }[];
};

export const tastes: Record<string, Taste> = {
  maren: {
    plays: ['big-thief-vampire-empire', 'big-thief-not', 'alvvays-belinda-says', 'jbrekkie-be-sweet', 'bss-anthems', 'wednesday-chosen-to-deserve'],
    shares: [{ trackId: 'big-thief-simulation-swarm', note: 'the guitar solo sounds like someone falling up the stairs. best one of the decade.' }],
  },
  dev: {
    plays: ['mk-gee-are-you-looking-up', 'burial-archangel', 'aphex-avril-14th', 'boc-roygbiv', 'four-tet-baby', 'madvillain-all-caps'],
    shares: [{ trackId: 'boc-roygbiv', note: 'two and a half minutes. headphones, not the phone speaker. i’ll know.' }],
  },
  tobi: {
    plays: ['fela-water-no-get-enemy', 'burna-last-last', 'tems-free-mind', 'badu-didnt-cha-know', 'kaytranada-10-percent'],
    shares: [{ trackId: 'fela-water-no-get-enemy', note: 'yes it’s eleven minutes. you have eleven minutes.' }],
  },
  priya: {
    plays: ['sidhu-295', 'ap-dhillon-brown-munde', 'diljit-goat', 'drake-passionfruit'],
    shares: [{ trackId: 'sidhu-295', note: 'if you only ever hear one, make it this one. then call me.' }],
  },
  callum: {
    plays: ['pup-kids', 'fucked-up-queen-of-hearts', 'turnstile-mystery', 'title-fight-head-in-the-ceiling-fan', 'mcr-helena'],
    shares: [{ trackId: 'fucked-up-queen-of-hearts', note: 'toronto’s finest. a children’s choir and a man yelling. perfect song.' }],
  },
  hana: {
    plays: ['slowdive-when-the-sun-hits', 'mbv-only-shallow', 'cocteau-heaven-or-las-vegas', 'deftones-be-quiet', 'cure-just-like-heaven'],
    shares: [{ trackId: 'mbv-only-shallow', note: 'turn it up until it stops being a song and becomes weather.' }],
  },
  sol: {
    plays: ['peggy-gou-nanana', 'caribou-cant-do-without-you', 'four-tet-baby', 'kaytranada-10-percent', 'charli-von-dutch'],
    shares: [{ trackId: 'caribou-cant-do-without-you', note: 'one line, repeated, and somehow i’m crying at a bus stop. dundas, ontario did this.' }],
  },
  wren: {
    plays: ['bill-evans-peace-piece', 'miles-so-what', 'alice-coltrane-satchidananda', 'glenn-gould-aria', 'nickelback-how-you-remind-me'],
    shares: [
      { trackId: 'bill-evans-peace-piece', note: 'six minutes. put the phone down. (you’re holding the phone. i know.)' },
      { trackId: 'nickelback-how-you-remind-me', note: 'i contain multitudes. this is one of them. the chorus is undeniable and you know it.' },
    ],
  },
  amara: {
    plays: ['sza-good-days', 'frank-ocean-pink-white', 'daniel-caesar-best-part', 'cdw-work', 'sade-no-ordinary-love', 'tems-free-mind'],
    shares: [{ trackId: 'cdw-work', note: 'toronto made this. be proud for four minutes.' }],
  },
  jonah: {
    plays: ['steely-dan-peg', 'talking-heads-this-must-be', 'fleetwood-everywhere', 'lcd-all-my-friends', 'destroyer-kaputt'],
    shares: [{ trackId: 'steely-dan-peg', note: 'listen to the backing vocals. that’s michael mcdonald, stacked four deep. you’re welcome.' }],
  },
  kiran: {
    plays: ['ap-dhillon-brown-munde', 'diljit-goat', 'sidhu-295', 'drake-passionfruit', 'kaytranada-10-percent', 'burna-last-last'],
    shares: [{ trackId: 'diljit-goat', note: 'lakeshore west line, 7:42, window seat. this is the only way to hear it.' }],
  },
  bea: {
    plays: ['feist-mushaboom', 'bss-anthems', 'metric-help-im-alive', 'alvvays-archie', 'phoebe-motion-sickness', 'bon-iver-holocene'],
    shares: [{ trackId: 'feist-mushaboom', note: 'i want the life in this song so badly it’s embarrassing.' }],
  },
  malik: {
    plays: ['tribe-electric-relaxation', 'madvillain-all-caps', 'dangelo-lady', 'badu-didnt-cha-know', 'kendrick-money-trees', 'bbng-time-moves-slow'],
    shares: [{ trackId: 'bbng-time-moves-slow', note: 'local boys and a soul legend. play it for your parents, watch them nod.' }],
  },
  yuki: {
    plays: ['newjeans-ditto', 'magdalena-bay-death-romance', 'charli-von-dutch', 'crj-run-away-with-me', 'jbrekkie-be-sweet'],
    shares: [{ trackId: 'crj-run-away-with-me', note: 'the saxophone at the start is a national treasure and we don’t say it enough.' }],
  },
  sofia: {
    plays: ['charli-von-dutch', 'chappell-good-luck-babe', 'abba-dancing-queen', 'peggy-gou-nanana', 'paramore-hard-times'],
    shares: [{ trackId: 'abba-dancing-queen', note: 'not ironically. never ironically.' }],
  },
  dez: {
    plays: ['bbng-time-moves-slow', 'miles-so-what', 'steely-dan-peg', 'dangelo-lady', 'fela-water-no-get-enemy'],
    shares: [{ trackId: 'dangelo-lady', note: 'the bass is behind the beat on purpose. it’s called feel. look it up.' }],
  },
  ingrid: {
    plays: ['aphex-avril-14th', 'boc-roygbiv', 'burial-archangel', 'alice-coltrane-satchidananda', 'cocteau-heaven-or-las-vegas'],
    shares: [{ trackId: 'alice-coltrane-satchidananda', note: 'the harp comes in and the lake goes flat. i’ve tested this.' }],
  },
  mateo: {
    plays: ['bad-bunny-titi', 'peggy-gou-nanana', 'kaytranada-10-percent', 'drake-passionfruit'],
    shares: [{ trackId: 'bad-bunny-titi', note: 'wait for the switch-up. no, keep waiting. THERE.' }],
  },
  farah: {
    plays: ['mitski-my-love-mine', 'sza-good-days', 'chappell-good-luck-babe', 'weeknd-house-of-balloons', 'daniel-caesar-best-part'],
    shares: [],
  },
  owen: {
    plays: ['hip-bobcaygeon', 'neil-young-harvest-moon', 'rush-limelight', 'joni-a-case-of-you', 'wolf-parade-ill-believe'],
    shares: [{ trackId: 'hip-bobcaygeon', note: 'if you grew up here you already know. if you didn’t, this is the entrance exam.' }],
  },
  zainab: {
    plays: ['mustafa-stay-alive', 'weeknd-house-of-balloons', 'frank-ocean-pink-white', 'burial-archangel', 'jessie-reyez-figures'],
    shares: [{ trackId: 'mustafa-stay-alive', note: 'regent park wrote this. sit with it.' }],
  },
  theo: {
    plays: ['mcr-helena', 'american-football-never-meant', 'title-fight-head-in-the-ceiling-fan', 'paramore-hard-times', 'pup-kids'],
    shares: [{ trackId: 'american-football-never-meant', note: 'you’ve seen the house on the cover. now hear why everyone’s so sad about it.' }],
  },
  grace: {
    plays: ['glenn-gould-aria', 'bill-evans-peace-piece', 'nina-sinnerman', 'radiohead-weird-fishes', 'sufjan-chicago'],
    shares: [{ trackId: 'glenn-gould-aria', note: 'you can hear him humming along. his engineers hated it. it’s my favourite part.' }],
  },
  rohan: {
    plays: ['national-bloodbuzz-ohio', 'lcd-all-my-friends', 'cure-just-like-heaven', 'elliott-between-the-bars', 'fontaines-starburster'],
    shares: [{ trackId: 'lcd-all-my-friends', note: 'seven minutes about getting older. i was 22 when i first cried at it. why.' }],
  },
  niamh: {
    plays: ['fontaines-starburster', 'bcnr-the-place', 'geese-taxes', 'cameron-winter-love-takes-miles', 'stereolab-french-disko', 'sonic-youth-teen-age-riot'],
    shares: [{ trackId: 'fontaines-starburster', note: 'the gasp between lines is the hook. dubliners, obviously.' }],
  },
  jamal: {
    plays: ['kendrick-money-trees', 'drake-passionfruit', 'burna-last-last', 'tems-free-mind', 'death-grips-get-got'],
    shares: [{ trackId: 'death-grips-get-got', note: 'this is the one that got me banned. i regret nothing.' }],
  },
  clemence: {
    plays: ['wolf-parade-ill-believe', 'stereolab-french-disko', 'caribou-cant-do-without-you', 'destroyer-kaputt', 'celine-all-coming-back'],
    shares: [{ trackId: 'celine-all-coming-back', note: 'seven and a half minutes. a queen. you will sing by the end, i’ve seen it happen.' }],
  },
  arjun: {
    plays: ['deftones-be-quiet', 'turnstile-mystery', 'mbv-only-shallow', 'title-fight-head-in-the-ceiling-fan', 'radiohead-weird-fishes'],
    shares: [],
  },
  lucia: {
    plays: ['beaches-blame-brett', 'metric-help-im-alive', 'chappell-good-luck-babe', 'orville-peck-dead-of-night', 'shania-man-i-feel'],
    shares: [{ trackId: 'beaches-blame-brett', note: 'named after the neighbourhood, not the lake. saw them at the horseshoe before all this.' }],
  },
  kwame: {
    plays: ['burna-last-last', 'fela-water-no-get-enemy', 'tems-free-mind', 'kaytranada-10-percent', 'mustafa-stay-alive'],
    shares: [],
  },
  hyejin: {
    plays: ['newjeans-ditto', 'slowdive-when-the-sun-hits', 'yo-la-tengo-autumn-sweater', 'pavement-gold-soundz', 'alex-g-runner'],
    shares: [{ trackId: 'yo-la-tengo-autumn-sweater', note: 'an organ, a drum loop and a feeling. nobody has topped it since 1997.' }],
  },
  dmitri: {
    plays: ['death-grips-get-got', 'deftones-be-quiet', 'aphex-avril-14th', 'four-tet-baby', 'burial-archangel'],
    shares: [],
  },
  tessa: {
    plays: ['big-thief-simulation-swarm', 'wednesday-chosen-to-deserve', 'mj-lenderman-shes-leaving-you', 'cameron-winter-love-takes-miles', 'nick-drake-pink-moon', 'sufjan-chicago'],
    shares: [{ trackId: 'cameron-winter-love-takes-miles', note: 'he sings like he’s remembering the words as they arrive. cited in my thesis (it isn’t).' }],
  },
  andre: {
    plays: ['tems-free-mind', 'burna-last-last', 'drake-passionfruit', 'sade-no-ordinary-love', 'badu-didnt-cha-know'],
    shares: [{ trackId: 'sade-no-ordinary-love', note: 'works at a wedding. works at a wake. that’s the test.' }],
  },
  marisol: {
    plays: ['celine-all-coming-back', 'shania-man-i-feel', 'avril-complicated', 'abba-dancing-queen', 'crj-run-away-with-me', 'nickelback-how-you-remind-me'],
    shares: [{ trackId: 'shania-man-i-feel', note: 'first three notes and the whole bar stands up. that’s power. timmins, ontario.' }],
  },
  eli: {
    plays: ['pixies-where-is-my-mind', 'pavement-gold-soundz', 'sonic-youth-teen-age-riot', 'yo-la-tengo-autumn-sweater', 'talking-heads-this-must-be', 'cure-just-like-heaven'],
    shares: [{ trackId: 'pavement-gold-soundz', note: 'staff pick, every week, until someone stops me. nobody has.' }],
  },
};

/** The residents you can sign in as from the account switcher, for testing both sides. */
export const borrowable = ['maren', 'dev', 'tobi', 'priya'];

/**
 * What a resident sends you once they've noticed what you're playing, and the
 * one thing they say if you accept. {title} and {artist} are your song.
 */
export type Opener = { trackId: string; note: string; afterAccept: string };

export const openers: Record<string, Opener> = {
  priya: {
    trackId: 'ap-dhillon-brown-munde',
    note: 'you had {artist} on near me and i respect it. your homework is this. report back.',
    afterAccept: 'ok you accepted. so did you actually listen or are you being polite',
  },
  callum: {
    trackId: 'fucked-up-queen-of-hearts',
    note: '{title}? fine. good, even. now try something that yells at you.',
    afterAccept: 'there you are. be honest, how far in before you turned it down',
  },
  hana: {
    trackId: 'cocteau-heaven-or-las-vegas',
    note: 'anyone playing {artist} in public deserves this. you can’t make out a single word and it doesn’t matter.',
    afterAccept: 'hi. sorry. i only really know how to talk about pedals. what did you think',
  },
  wren: {
    trackId: 'nickelback-how-you-remind-me',
    note: 'i saw {title} and thought, this person has taste. so here is something to test it. sent with love.',
    afterAccept: 'you accepted the Nickelback. we can be friends. i have no follow-up, i didn’t think i’d get this far',
  },
  tobi: {
    trackId: 'fela-water-no-get-enemy',
    note: '{artist} is a good start. this one is eleven minutes long and i need you to commit.',
    afterAccept: 'did you make it to the horns. be honest',
  },
  jonah: {
    trackId: 'steely-dan-peg',
    note: 'noticed {title}. solid. have you considered that this has a better rhythm section? that was rhetorical.',
    afterAccept: 'thank you for accepting. i have four more recommendations and a short reading list',
  },
  bea: {
    trackId: 'feist-mushaboom',
    note: 'you had {title} on and i thought, this person also cries in shops. this is for your walk home.',
    afterAccept: 'oh good, you said yes. i panicked right after sending it',
  },
  eli: {
    trackId: 'pavement-gold-soundz',
    note: '{artist}. ok. i’ve seen worse come through the shop today. try this, it’s the staff pick.',
    afterAccept: 'so? that was a real question. i grade these',
  },
  marisol: {
    trackId: 'shania-man-i-feel',
    note: '{title} is nice but can you SING it. this one you can sing. thursdays, i’ll save you a slot.',
    afterAccept: 'you accepted!! what’s your karaoke song. it’s the only question that matters',
  },
  niamh: {
    trackId: 'fontaines-starburster',
    note: 'saw {artist} go past. grand. here’s one from home. it sounds like a panic attack you can dance to.',
    afterAccept: 'well? was it too much. it’s meant to be too much',
  },
  zainab: {
    trackId: 'mustafa-stay-alive',
    note: 'you were playing {title} while i waited for the bus. this one’s for your ride home, whenever that is.',
    afterAccept: 'hey. glad it landed. what do you listen to when it’s late',
  },
  sol: {
    trackId: 'caribou-cant-do-without-you',
    note: '{title}, nice. this is for later, when you’re deciding whether to stay out. (go home. play this.)',
    afterAccept: 'ha, you took it. so did you stay out or go home',
  },
  amara: {
    trackId: 'cdw-work',
    note: '{artist} at this hour? same wavelength. here’s one from down the road.',
    afterAccept: 'accepted. good. are you working nights too or is it just insomnia',
  },
  malik: {
    trackId: 'bbng-time-moves-slow',
    note: 'you played {title}, so i’m guessing you’d like this. my dad says it’s the only new record he approves of.',
    afterAccept: 'there you go. what’s the oldest record you own. i’m keeping a list',
  },
};
