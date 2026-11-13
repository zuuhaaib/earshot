/**
 * How every resident has decorated. Maren's and Devanshi's rooms are laid out
 * by hand in people.ts; everyone else's is assembled here from what they
 * wrote (the pinned story, the three songs, the shelf names, the liner notes)
 * plus their look, with guestbook entries from the neighbours.
 */
import type { Room, RoomSection, RoomTheme, Sticker, StickerKind } from '@/data/types';
import { looks, type LookName } from '@/theme/looks';
import { residents, tastes } from './listeners';
import { rooms as handmade } from './people';

type Decor = {
  look: LookName;
  tweak?: Partial<RoomTheme>;
  /** Section order: I intro, P pinned, W wall, S shelf (next one), L liner, G guestbook, R recent. */
  order: string;
  pinned: [trackId: string, note: string];
  introTitle: string;
  intro: [trackId: string, why: string][];
  shelves: [title: string, trackIds: string[]][];
  linerTitle: string;
  liner: [trackId: string | null, text: string][];
  recent: 'shown' | 'hidden';
};

const decor: Record<string, Decor> = {
  tobi: {
    look: 'forest',
    order: 'PIWSLSGR',
    pinned: [
      'fela-water-no-get-enemy',
      'My dad’s Camry, 1998, somewhere on the QEW. He turned it up at the horns and said “this is your inheritance.” There was no other inheritance.',
    ],
    introTitle: 'start here, then we can talk',
    intro: [
      ['fela-water-no-get-enemy', 'eleven minutes. that’s the entry fee.'],
      ['burna-last-last', 'for the walk to the gym, when i’m lying to myself about leg day.'],
      ['badu-didnt-cha-know', 'proof i have a soft side. tell no one.'],
    ],
    shelves: [
      ['songs that add ten pounds to the bar', ['burna-last-last', 'kaytranada-10-percent', 'kendrick-money-trees', 'death-grips-get-got']],
      ['sunday, windows open', ['tems-free-mind', 'sade-no-ordinary-love', 'badu-didnt-cha-know', 'dangelo-lady']],
    ],
    linerTitle: 'thoughts between sets',
    liner: [
      ['fela-water-no-get-enemy', 'People say they don’t have time for a long song, then watch a man build a swimming pool on their phone for four hours.'],
      [null, 'The gym playlist is not a democracy and it is not a suggestion box.'],
    ],
    recent: 'shown',
  },
  priya: {
    look: 'sunburn',
    order: 'IPSWLSGR',
    pinned: [
      'sidhu-295',
      'Summer 2021, my cousin’s Civic outside the plaza on Airport Road. Windows down, everybody quiet for once. I didn’t know a song could do that to a parking lot.',
    ],
    introTitle: 'three songs. no skipping.',
    intro: [
      ['ap-dhillon-brown-munde', 'the one that took over every car in brampton for a year.'],
      ['diljit-goat', 'the one my mom and i agree on. the only one.'],
      ['drake-passionfruit', 'the one for when i pretend i’m from toronto proper.'],
    ],
    shelves: [
      ['wedding bangers, ranked by aunty approval', ['diljit-goat', 'ap-dhillon-brown-munde', 'shania-man-i-feel', 'abba-dancing-queen']],
      ['the drive home from the reception', ['sidhu-295', 'drake-passionfruit', 'weeknd-house-of-balloons']],
    ],
    linerTitle: 'rules of the aux',
    liner: [
      [null, 'Rule one: ask “who is this?” in a good way and you get a turn. Ask it in a bad way and you get the bus.'],
      ['sidhu-295', 'He wrote it like he knew. I still can’t get through the last verse in public.'],
    ],
    recent: 'shown',
  },
  callum: {
    look: 'tomato',
    order: 'PWISLSGR',
    pinned: [
      'pup-kids',
      'Lee’s Palace. The floor was mostly beer. Somebody’s elbow got me in the first chorus and I have never been happier. Lost a shoe. Kept the ticket.',
    ],
    introTitle: 'if you’ve only got nine minutes',
    intro: [
      ['pup-kids', 'the happiest song ever written about wanting to lie down in traffic.'],
      ['fucked-up-queen-of-hearts', 'toronto, a choir, a man yelling. what else is there.'],
      ['turnstile-mystery', 'hardcore for people who also want to dance. so, everyone.'],
    ],
    shelves: [
      ['for the back of the line (kitchen)', ['title-fight-head-in-the-ceiling-fan', 'mcr-helena', 'deftones-be-quiet', 'paramore-hard-times']],
      ['gang vocals, sorted by how hoarse i got', ['pup-kids', 'fucked-up-queen-of-hearts', 'turnstile-mystery', 'american-football-never-meant']],
    ],
    linerTitle: 'notes from the pit',
    liner: [
      [null, 'Etiquette: somebody falls, everybody picks them up. That’s the whole religion.'],
      ['mcr-helena', 'I was fourteen and it was the most important thing that had ever happened. It still might be.'],
    ],
    recent: 'shown',
  },
  hana: {
    look: 'lilac',
    order: 'IWPSLSGR',
    pinned: [
      'slowdive-when-the-sun-hits',
      'Grade 11, my brother’s burned CD, the bus up Yonge in a snowstorm. The windows fogged over and I decided this was who I was now. It was.',
    ],
    introTitle: 'three songs, played too loud',
    intro: [
      ['slowdive-when-the-sun-hits', 'the one that sounds like the inside of a cloud.'],
      ['mbv-only-shallow', 'the one that made me buy a pedal i can’t afford.'],
      ['cocteau-heaven-or-las-vegas', 'the one where the words don’t matter. they never did.'],
    ],
    shelves: [
      ['pedals i bought because of a song', ['mbv-only-shallow', 'slowdive-when-the-sun-hits', 'deftones-be-quiet', 'cure-just-like-heaven']],
      ['for when the heat’s broken', ['cocteau-heaven-or-las-vegas', 'yo-la-tengo-autumn-sweater', 'boc-roygbiv']],
    ],
    linerTitle: 'said into a wall of reverb',
    liner: [
      ['mbv-only-shallow', 'People ask what the lyrics are. I’ve listened for nine years. I don’t know. I don’t want to know.'],
      [null, 'My amp is too big for my apartment. That’s the apartment’s problem.'],
    ],
    recent: 'shown',
  },
  sol: {
    look: 'mint',
    order: 'IPSWLSGR',
    pinned: [
      'caribou-cant-do-without-you',
      'A basement off Geary, 1:10 a.m. I’d already put my coat on to leave. Then this came on and I took the coat off again. Only time that’s ever happened.',
    ],
    introTitle: 'three for the pregame (it’s also the main event)',
    intro: [
      ['peggy-gou-nanana', 'the one where everybody knows the hook by the second time round.'],
      ['kaytranada-10-percent', 'the one that works at brunch and at 11 p.m. rare.'],
      ['four-tet-baby', 'the one for the ride home, forehead on the window.'],
    ],
    shelves: [
      ['club music for people with a 9 a.m.', ['peggy-gou-nanana', 'kaytranada-10-percent', 'charli-von-dutch', 'caribou-cant-do-without-you']],
      ['kitchen, sunday, eggs', ['four-tet-baby', 'sade-no-ordinary-love', 'fleetwood-everywhere']],
    ],
    linerTitle: 'a manifesto, sort of',
    liner: [
      [null, 'Leaving at one isn’t giving up. It’s leaving while you still love everyone.'],
      ['charli-von-dutch', 'I can’t hear this without walking faster. It’s a safety issue.'],
    ],
    recent: 'shown',
  },
  wren: {
    look: 'notebook',
    order: 'PILSWSGR',
    pinned: [
      'bill-evans-peace-piece',
      'A practice room at the Conservatory, nineteen, hiding from my own recital. Someone played this next door, through the wall. I stayed for all of it and was late for my slot.',
    ],
    introTitle: 'three pieces of evidence',
    intro: [
      ['bill-evans-peace-piece', 'exhibit a: restraint.'],
      ['miles-so-what', 'exhibit b: two chords is plenty.'],
      ['nickelback-how-you-remind-me', 'exhibit c: i’m from alberta and you’ll have to live with it.'],
    ],
    shelves: [
      ['for students who say they hate jazz', ['miles-so-what', 'bill-evans-peace-piece', 'nina-sinnerman', 'bbng-time-moves-slow']],
      ['after the last lesson of the day', ['alice-coltrane-satchidananda', 'glenn-gould-aria', 'aphex-avril-14th']],
    ],
    linerTitle: 'margin notes',
    liner: [
      ['glenn-gould-aria', 'He hums. Everybody mentions it. Nobody mentions that he’s in tune.'],
      ['nickelback-how-you-remind-me', 'I have a degree in music and I’m telling you the chorus resolves properly. That’s all I’ll say.'],
    ],
    recent: 'shown',
  },
  amara: {
    look: 'midnight',
    order: 'PISWLSG',
    pinned: [
      'sza-good-days',
      '4 a.m., the break room, third night shift running. One earbud in, cold coffee. A patient’s daughter asked what I was smiling at and I couldn’t explain it.',
    ],
    introTitle: 'three for the drive home at dawn',
    intro: [
      ['frank-ocean-pink-white', 'the one that makes the 401 look good. a miracle.'],
      ['daniel-caesar-best-part', 'the one i’d never admit is my wedding song. i’m not engaged.'],
      ['cdw-work', 'the one from down the road. be proud.'],
    ],
    shelves: [
      ['night shift, hours one to four', ['sza-good-days', 'tems-free-mind', 'sade-no-ordinary-love', 'weeknd-house-of-balloons']],
      ['night shift, hours five to twelve', ['frank-ocean-pink-white', 'daniel-caesar-best-part', 'cdw-work', 'mustafa-stay-alive']],
    ],
    linerTitle: 'notes from the break room',
    liner: [
      [null, 'If you play music out loud on the night bus, I hope your earbuds are stolen by someone who deserves them.'],
      ['sade-no-ordinary-love', 'Thirty years old and it still sounds like it was recorded tomorrow.'],
    ],
    recent: 'hidden',
  },
  jonah: {
    look: 'newsprint',
    order: 'LPIWSSGR',
    pinned: [
      'steely-dan-peg',
      'My father’s den in Thornhill, 1994. I wasn’t allowed to touch the turntable, so I watched. He lowered the needle like he was defusing something.',
    ],
    introTitle: 'a brief introduction (four pages)',
    intro: [
      ['steely-dan-peg', 'start here. yes, there’s a quiz.'],
      ['talking-heads-this-must-be', 'the only love song without a single cliché in it. i checked.'],
      ['destroyer-kaputt', 'vancouver’s finest. sounds like a yacht with a library on it.'],
    ],
    shelves: [
      ['records my wife has asked me to stop explaining', ['steely-dan-peg', 'fleetwood-everywhere', 'talking-heads-this-must-be', 'destroyer-kaputt']],
      ['acceptable at dinner parties', ['sade-no-ordinary-love', 'lcd-all-my-friends', 'bbng-time-moves-slow']],
    ],
    linerTitle: 'liner notes on liner notes',
    liner: [
      ['steely-dan-peg', 'Seven guitarists attempted the solo. Jay Graydon got it. I think about the other six more than is healthy.'],
      [null, 'A hi-fi is not a midlife crisis. A midlife crisis would have been cheaper.'],
    ],
    recent: 'shown',
  },
  kiran: {
    look: 'kraft',
    tweak: { displayFont: 'poster', texture: 'grid' },
    order: 'ISPSWLGR',
    pinned: [
      'diljit-goat',
      'Lakeshore West, the 7:42, standing room only. A stranger heard it leaking out of my headphones and nodded. We’ve nodded every morning since. I don’t know his name.',
    ],
    introTitle: 'three songs, one per transfer',
    intro: [
      ['ap-dhillon-brown-munde', 'bramalea to union: wake up.'],
      ['kaytranada-10-percent', 'union, the long escalator.'],
      ['drake-passionfruit', 'the walk to the office, pretending.'],
    ],
    shelves: [
      ['the 7:42', ['diljit-goat', 'ap-dhillon-brown-munde', 'burna-last-last', 'kaytranada-10-percent']],
      ['the 5:53 (delayed)', ['sidhu-295', 'drake-passionfruit', 'frank-ocean-pink-white']],
    ],
    linerTitle: 'service announcements',
    liner: [
      [null, 'Ten hours a week on a train. That’s a part-time job in listening and I’m employee of the month.'],
      ['burna-last-last', 'The sample does all the crying so you don’t have to. Efficient.'],
    ],
    recent: 'shown',
  },
  bea: {
    look: 'peach',
    order: 'IPWSLSGR',
    pinned: [
      'feist-mushaboom',
      'Back of the shop, the first winter I ran it alone, buckets everywhere. I played it to keep warm. A customer came in crying about something else and we both pretended.',
    ],
    introTitle: 'three songs i’ve cried to in public',
    intro: [
      ['feist-mushaboom', 'produce aisle. the peppers saw everything.'],
      ['bon-iver-holocene', 'the 506 streetcar. a man offered me a tissue.'],
      ['bss-anthems', 'my own shop. i was arranging tulips.'],
    ],
    shelves: [
      ['sounds like a church you’d actually go to', ['bon-iver-holocene', 'sufjan-chicago', 'joni-a-case-of-you', 'big-thief-not']],
      ['for wrapping bouquets', ['feist-mushaboom', 'alvvays-archie', 'metric-help-im-alive', 'phoebe-motion-sickness']],
    ],
    linerTitle: 'care instructions',
    liner: [
      [null, 'Tulips keep growing after you cut them. I think about that more than I should.'],
      ['phoebe-motion-sickness', 'The meanest song I love. She’s so polite about it.'],
    ],
    recent: 'shown',
  },
  malik: {
    look: 'kraft',
    tweak: { paper: '#D9B88A', displayFont: 'typeBold', texture: 'dots', wall: 'grid' },
    order: 'WPILSSGR',
    pinned: [
      'tribe-electric-relaxation',
      'My dad’s basement on Oakwood. I was nine and banned from the crates. He caught me holding this one and instead of yelling he said, “Fine. Flip it over.”',
    ],
    introTitle: 'three from the crates',
    intro: [
      ['tribe-electric-relaxation', 'the first one i was allowed to touch.'],
      ['madvillain-all-caps', 'the first one i bought with my own money.'],
      ['bbng-time-moves-slow', 'the first new one my dad nodded at.'],
    ],
    shelves: [
      ['dad’s records (do not lend)', ['tribe-electric-relaxation', 'dangelo-lady', 'badu-didnt-cha-know', 'miles-so-what']],
      ['mine (also do not lend)', ['madvillain-all-caps', 'kendrick-money-trees', 'bbng-time-moves-slow', 'frank-ocean-pink-white']],
    ],
    linerTitle: 'sleeve notes',
    liner: [
      [null, 'Four hundred records and he filed them by how he felt that year. I’ve given up re-sorting.'],
      ['dangelo-lady', 'The drums are late on purpose. Try explaining that to a metronome.'],
    ],
    recent: 'shown',
  },
  yuki: {
    look: 'candy',
    order: 'ISWPLSGR',
    pinned: [
      'crj-run-away-with-me',
      'My bedroom in Markham, 2 a.m., rendering a scene that would not finish. I played it forty times in a row. The render failed. Didn’t matter.',
    ],
    introTitle: 'three songs, on loop',
    intro: [
      ['newjeans-ditto', 'play count: don’t ask.'],
      ['magdalena-bay-death-romance', 'play count: my phone sent a warning.'],
      ['jbrekkie-be-sweet', 'play count: the neighbours know the words.'],
    ],
    shelves: [
      ['bridges i would die for', ['crj-run-away-with-me', 'charli-von-dutch', 'chappell-good-luck-babe', 'paramore-hard-times']],
      ['for rendering', ['newjeans-ditto', 'magdalena-bay-death-romance', 'boc-roygbiv', 'four-tet-baby']],
    ],
    linerTitle: 'frame notes',
    liner: [
      ['crj-run-away-with-me', 'The sax intro is two bars long and has done more for me than most people.'],
      [null, 'If I’ve gone quiet, the bridge is coming. Please respect the bridge.'],
    ],
    recent: 'shown',
  },
  sofia: {
    look: 'lemon',
    tweak: { displayFont: 'poster', texture: 'dots' },
    order: 'IPSWLSGR',
    pinned: [
      'abba-dancing-queen',
      'Nonna’s kitchen in Woodbridge, me on a chair so I could reach the radio. She said it was noise. She was also dancing. She denies this.',
    ],
    introTitle: 'three for the salon speaker',
    intro: [
      ['charli-von-dutch', 'monday. everybody needs it.'],
      ['chappell-good-luck-babe', 'the one clients ask me to play again.'],
      ['abba-dancing-queen', 'closing time. non-negotiable.'],
    ],
    shelves: [
      ['songs that got a client to finally go blonde', ['chappell-good-luck-babe', 'charli-von-dutch', 'peggy-gou-nanana', 'paramore-hard-times']],
      ['nonna-approved (short shelf)', ['abba-dancing-queen', 'celine-all-coming-back']],
    ],
    linerTitle: 'overheard at the chair',
    liner: [
      [null, 'You learn everything about a person from what they hum under the dryer.'],
      ['paramore-hard-times', 'Saddest lyrics, happiest song. That’s a haircut after a breakup.'],
    ],
    recent: 'shown',
  },
  dez: {
    look: 'pool',
    order: 'PIWLSSGR',
    pinned: [
      'miles-so-what',
      'A wedding in Vaughan, 1 a.m., the band packing up. The drummer put this on the house speakers and none of us left for nine minutes. Unpaid overtime. Worth it.',
    ],
    introTitle: 'three basslines, since nobody asks',
    intro: [
      ['miles-so-what', 'paul chambers. the whole song is his.'],
      ['dangelo-lady', 'pino. behind the beat. on purpose.'],
      ['bbng-time-moves-slow', 'local, and it walks.'],
    ],
    shelves: [
      ['requests i play under protest', ['abba-dancing-queen', 'shania-man-i-feel', 'celine-all-coming-back']],
      ['what the trio plays when it’s just the bartender', ['miles-so-what', 'bill-evans-peace-piece', 'alice-coltrane-satchidananda', 'steely-dan-peg']],
    ],
    linerTitle: 'notes from stage left',
    liner: [
      [null, 'Nobody notices the bass until it stops. Then everybody’s a critic.'],
      ['fela-water-no-get-enemy', 'The bassline doesn’t change for eleven minutes, and that is the hardest thing in music.'],
    ],
    recent: 'shown',
  },
  ingrid: {
    look: 'fog',
    order: 'PLISWSG',
    pinned: [
      'aphex-avril-14th',
      'The boardwalk in February, nobody else out, the lake the colour of a nickel. It’s two minutes long. I played it eleven times and walked to the end and back.',
    ],
    introTitle: 'three, quietly',
    intro: [
      ['aphex-avril-14th', 'a piano with the lid open. you can hear the room.'],
      ['boc-roygbiv', 'sounds like a science film from a school that closed.'],
      ['alice-coltrane-satchidananda', 'the harp comes in and the lake goes flat.'],
    ],
    shelves: [
      ['one album a day (this week)', ['burial-archangel', 'boc-roygbiv', 'cocteau-heaven-or-las-vegas', 'aphex-avril-14th']],
      ['too loud for the boardwalk', ['mbv-only-shallow', 'slowdive-when-the-sun-hits']],
    ],
    linerTitle: 'field notes',
    liner: [
      [null, 'Ambient music isn’t background. You’re the background.'],
      ['burial-archangel', 'It sounds like rain remembering a nightclub.'],
    ],
    recent: 'hidden',
  },
  mateo: {
    look: 'sunburn',
    tweak: { paper: '#FFC857', displayFont: 'serifBlack', texture: 'dots', layout: 'poster' },
    order: 'IPSWLGR',
    pinned: [
      'bad-bunny-titi',
      'The shop on St. Clair, a Saturday, six guys waiting. It came on and the whole line started arguing about the switch-up. I gave the worst fade of my career. No regrets.',
    ],
    introTitle: 'three for the chair',
    intro: [
      ['bad-bunny-titi', 'wait for the switch. no, keep waiting.'],
      ['kaytranada-10-percent', 'makes anyone sit up straight. good for the neckline.'],
      ['drake-passionfruit', 'for the clients who want to feel something but not say it.'],
    ],
    shelves: [['saturdays, wall to wall', ['bad-bunny-titi', 'peggy-gou-nanana', 'kaytranada-10-percent', 'burna-last-last']]],
    linerTitle: 'barber’s notes',
    liner: [
      [null, 'Salsa is what my parents danced to. Perreo is what I danced to. One day my kids will embarrass me with something worse.'],
      ['peggy-gou-nanana', 'Nobody knows what the chorus means and the whole shop sings it anyway.'],
    ],
    recent: 'shown',
  },
  farah: {
    look: 'lilac',
    tweak: { displayFont: 'typeBold', texture: 'ruled', wall: 'grid', layout: 'pages' },
    order: 'PISWLG',
    pinned: [
      'mitski-my-love-mine',
      'The law library, exam week, 11 p.m. Two minutes and eighteen seconds. I gave myself exactly that long, then went back to torts.',
    ],
    introTitle: 'THREE SONGS, BILLED IN SIX-MINUTE INCREMENTS',
    intro: [
      ['mitski-my-love-mine', 'efficient. devastating. under three minutes.'],
      ['sza-good-days', 'for when the reading is done. so, rarely.'],
      ['weeknd-house-of-balloons', 'i skip to 3:20. i’m aware of what i’m missing.'],
    ],
    shelves: [['SAD, BUT ON A SCHEDULE', ['mitski-my-love-mine', 'daniel-caesar-best-part', 'chappell-good-luck-babe', 'sza-good-days']]],
    linerTitle: 'SUBMISSIONS',
    liner: [
      [null, 'I skip intros. I know. The defence rests.'],
      ['chappell-good-luck-babe', 'The key change is the closing argument. Case dismissed.'],
    ],
    recent: 'hidden',
  },
  owen: {
    look: 'house',
    tweak: { paper: '#EFE3C8', ink: '#3B2A1E', accent: '#B33A2B', displayFont: 'serifBlack' },
    order: 'PIWSLSGR',
    pinned: [
      'hip-bobcaygeon',
      'A dock on Sturgeon Lake, August long weekend, somebody’s uncle’s radio. I was sixteen. Nobody said anything until it ended and then somebody said “again.”',
    ],
    introTitle: 'the canadian content requirement',
    intro: [
      ['hip-bobcaygeon', 'not up for debate.'],
      ['neil-young-harvest-moon', 'for the drive up, once you’re past barrie.'],
      ['rush-limelight', 'yes, the drummer wrote the words. that’s the whole point.'],
    ],
    shelves: [
      ['for the drive up', ['neil-young-harvest-moon', 'hip-bobcaygeon', 'joni-a-case-of-you', 'feist-mushaboom']],
      ['songs i’ve played for a classroom of fifteen-year-olds', ['rush-limelight', 'wolf-parade-ill-believe', 'bss-anthems']],
    ],
    linerTitle: 'lesson plans',
    liner: [
      [null, 'I play it for the Grade 10s every June. They don’t get it. They’re not supposed to yet.'],
      ['joni-a-case-of-you', 'She drew a map of Canada on a bar coaster and made it a love song. Top that.'],
    ],
    recent: 'shown',
  },
  zainab: {
    look: 'midnight',
    tweak: { ink: '#F7D9A0', accent: '#FF7A59', displayFont: 'typeBold', layout: 'pages' },
    order: 'PILSWG',
    pinned: [
      'mustafa-stay-alive',
      'The 320 night bus, 3 a.m., after a double. Just me and the driver. He turned his radio down, I think so I could hear mine. Neither of us mentioned it.',
    ],
    introTitle: 'THREE FOR AFTER CLOSE',
    intro: [
      ['mustafa-stay-alive', 'regent park wrote this. sit with it.'],
      ['frank-ocean-pink-white', 'for counting the till.'],
      ['burial-archangel', 'the city at 3 a.m. sounds exactly like this.'],
    ],
    shelves: [['THE RIDE HOME', ['weeknd-house-of-balloons', 'burial-archangel', 'jessie-reyez-figures', 'mustafa-stay-alive']]],
    linerTitle: 'LAST CALL',
    liner: [
      [null, 'I hear everyone’s music for eight hours. The ride home is mine. Do not talk to me on the ride home.'],
      ['jessie-reyez-figures', 'She sounds like she’s singing through her teeth. I’ve poured drinks for that exact feeling.'],
    ],
    recent: 'hidden',
  },
  theo: {
    look: 'zine',
    order: 'IPWSLSGR',
    pinned: [
      'mcr-helena',
      'The walk-in freezer at my uncle’s place on the Danforth, 2009. I was supposed to be getting lamb. I stayed for the whole song and came out with frost on my eyebrows.',
    ],
    introTitle: 'THREE SONGS FROM THE FREEZER',
    intro: [
      ['mcr-helena', 'i was fourteen. i’m still fourteen.'],
      ['american-football-never-meant', 'the house on the cover. you know the one.'],
      ['title-fight-head-in-the-ceiling-fan', 'for lying on the floor. try it.'],
    ],
    shelves: [
      ['EMO NIGHT, FIRST HALF', ['mcr-helena', 'paramore-hard-times', 'pup-kids', 'american-football-never-meant']],
      ['EMO NIGHT, AFTER MY KNEES GAVE OUT', ['title-fight-head-in-the-ceiling-fan', 'elliott-between-the-bars', 'deftones-be-quiet']],
    ],
    linerTitle: 'KITCHEN CONFESSIONS',
    liner: [
      [null, 'Two emo nights survived. At the second one a teenager called me “sir.”'],
      ['paramore-hard-times', 'She made a disco song about being miserable and I’ve never felt so understood by a tambourine.'],
    ],
    recent: 'shown',
  },
  grace: {
    look: 'notebook',
    tweak: { paper: '#FBF8F0', accent: '#3A6EA5', displayFont: 'serifBlack', layout: 'pages' },
    order: 'PILSWG',
    pinned: [
      'glenn-gould-aria',
      'An exam room, fourteen, waiting to play for three strangers with clipboards. My teacher had told me to listen to this the night before. I listened in the hallway instead and played better than I ever had.',
    ],
    introTitle: 'three things i’m allowed to like now',
    intro: [
      ['radiohead-weird-fishes', 'the first non-classical thing i loved. i felt like i was cheating.'],
      ['sufjan-chicago', 'i played the trumpet part on piano for a year.'],
      ['nina-sinnerman', 'ten minutes. she never lets up. neither should you.'],
    ],
    shelves: [['fourteen years of piano exams', ['glenn-gould-aria', 'bill-evans-peace-piece', 'nina-sinnerman', 'aphex-avril-14th']]],
    linerTitle: 'practice log',
    liner: [
      ['glenn-gould-aria', 'You can hear him humming along. His engineers hated it. It’s my favourite part.'],
      [null, 'Nobody tells you that when the exams stop, you have to decide what you like on your own. I’m 26 and still deciding.'],
    ],
    recent: 'hidden',
  },
  rohan: {
    look: 'pool',
    tweak: { displayFont: 'typeBold', texture: 'dots' },
    order: 'ISPWLGR',
    pinned: [
      'national-bloodbuzz-ohio',
      'The food court at Square One, 2014, right after she left. I sat there with a cold poutine and this on repeat until security asked if I was okay. I said yes. I wasn’t.',
    ],
    introTitle: 'THREE MALLS, THREE SONGS',
    intro: [
      ['national-bloodbuzz-ohio', 'square one. food court.'],
      ['cure-just-like-heaven', 'erin mills. the parking garage, level 2.'],
      ['elliott-between-the-bars', 'sherway. outside the cinnabon. don’t ask.'],
    ],
    shelves: [['SAD DAD ROCK (NOT A DAD)', ['national-bloodbuzz-ohio', 'lcd-all-my-friends', 'fontaines-starburster', 'radiohead-weird-fishes']]],
    linerTitle: 'RELEASE NOTES',
    liner: [
      ['lcd-all-my-friends', 'Seven minutes about getting older. I first cried at it when I was 22. Why.'],
      [null, 'Fixed: nothing. Known issues: all of them.'],
    ],
    recent: 'shown',
  },
  niamh: {
    look: 'zine',
    tweak: { displayFont: 'poster', highlight: '#7CFFB2', texture: 'grain', layout: 'loose' },
    order: 'IPWLSSGR',
    pinned: [
      'fontaines-starburster',
      'The airport, the day I flew over. I had one bag and no flat. This came on in the queue and I thought, right, at least that’ll come with me.',
    ],
    introTitle: 'three before the kettle’s boiled',
    intro: [
      ['fontaines-starburster', 'the gasp between the lines is the hook.'],
      ['bcnr-the-place', 'seven minutes and a whole room singing by the end.'],
      ['geese-taxes', 'new york lads. they’ll do.'],
    ],
    shelves: [
      ['post-punk, pre-coffee', ['fontaines-starburster', 'sonic-youth-teen-age-riot', 'stereolab-french-disko', 'geese-taxes']],
      ['songs that make parkdale feel like home', ['bcnr-the-place', 'cameron-winter-love-takes-miles', 'cure-just-like-heaven']],
    ],
    linerTitle: 'letters home',
    liner: [
      [null, 'Came for a year in 2019. Still can’t find a decent tea. Staying anyway.'],
      ['stereolab-french-disko', 'A protest song you can do the dishes to. Very practical people, the French.'],
    ],
    recent: 'shown',
  },
  jamal: {
    look: 'lemon',
    tweak: { displayFont: 'poster', accent: '#1F2A6B', texture: 'dots', wall: 'scatter', layout: 'poster' },
    order: 'PIWSLGR',
    pinned: [
      'death-grips-get-got',
      'My cousin’s graduation barbecue, Brampton, 2019. I had the aux for four minutes. Went from Drake straight into this. Her grandmother left. I maintain the transition was good.',
    ],
    introTitle: 'three songs i’m no longer allowed to play',
    intro: [
      ['death-grips-get-got', 'banned: the graduation barbecue.'],
      ['kendrick-money-trees', 'banned: i did all the voices. at a christening.'],
      ['burna-last-last', 'not banned. this one’s how i get the aux back.'],
    ],
    shelves: [['the redemption playlist', ['burna-last-last', 'tems-free-mind', 'drake-passionfruit', 'kendrick-money-trees']]],
    linerTitle: 'statements for the record',
    liner: [
      [null, 'The crowd was wrong. I’ve reviewed the tape.'],
      ['tems-free-mind', 'Put this on and even the aunties forgive you. I’ve tested it.'],
    ],
    recent: 'shown',
  },
  clemence: {
    look: 'fog',
    tweak: { accent: '#2F5DA8', highlight: '#F7C6D0', displayFont: 'hand', layout: 'loose', wall: 'scatter' },
    order: 'IPSWLSGR',
    pinned: [
      'wolf-parade-ill-believe',
      'A loft party in the Mile End, 2006, the floor actually bending. Everyone I knew was in one room. I moved here eight years later and I still measure parties against that one.',
    ],
    introTitle: 'three songs, translated badly',
    intro: [
      ['wolf-parade-ill-believe', 'montréal, when it was cheap.'],
      ['stereolab-french-disko', 'the french is fine. the politics are better.'],
      ['celine-all-coming-back', 'a queen. i will not be taking questions in either language.'],
    ],
    shelves: [
      ['things montréal does better', ['wolf-parade-ill-believe', 'destroyer-kaputt', 'celine-all-coming-back']],
      ['things toronto does better (short shelf)', ['caribou-cant-do-without-you', 'bss-anthems']],
    ],
    linerTitle: 'notes du traducteur',
    liner: [
      [null, 'I defend this city in French so that nobody here can hear me doing it.'],
      ['caribou-cant-do-without-you', 'One sentence, repeated. As a translator I should hate it. I don’t.'],
    ],
    recent: 'shown',
  },
  arjun: {
    look: 'forest',
    tweak: { paper: '#20242B', card: '#2C313A', ink: '#E8E4D8', accent: '#E0533D', highlight: '#3B4350', displayFont: 'typeBold' },
    order: 'PIWSLG',
    pinned: [
      'deftones-be-quiet',
      'A basement in Unionville, 2011, four of us and one amp between two guitars. We played this badly for an hour. Best the band ever sounded. We broke up in March.',
    ],
    introTitle: 'THREE RIFFS I STILL CAN’T PLAY RIGHT',
    intro: [
      ['deftones-be-quiet', 'the one we covered. badly.'],
      ['mbv-only-shallow', 'i’ve watched every tutorial. nobody knows.'],
      ['turnstile-mystery', 'the band’s new singer likes this one. it’s fine. i’m fine.'],
    ],
    shelves: [['HEADPHONES ONLY, LIKE AN ADULT', ['deftones-be-quiet', 'title-fight-head-in-the-ceiling-fan', 'radiohead-weird-fishes', 'mbv-only-shallow']]],
    linerTitle: 'BAND MEETING MINUTES',
    liner: [
      [null, 'Motion to stop checking their follower count. Motion fails.'],
      ['radiohead-weird-fishes', 'Three guitars playing three different rhythms and somehow it’s one song. We could never.'],
    ],
    recent: 'hidden',
  },
  lucia: {
    look: 'peach',
    tweak: { displayFont: 'poster', texture: 'grid', wall: 'scatter' },
    order: 'IPSWLGR',
    pinned: [
      'beaches-blame-brett',
      'The Horseshoe, before any of this. Forty people. I had to leave during the encore to beat the 400. I heard the last song from the sidewalk and it still counts.',
    ],
    introTitle: 'three i left early for',
    intro: [
      ['beaches-blame-brett', 'left during the encore. traffic.'],
      ['metric-help-im-alive', 'left at the bridge. also traffic.'],
      ['orville-peck-dead-of-night', 'stayed. got home at 2. paid for it at work.'],
    ],
    shelves: [['the 400 northbound, 11:40 p.m.', ['metric-help-im-alive', 'chappell-good-luck-babe', 'beaches-blame-brett', 'shania-man-i-feel']]],
    linerTitle: 'parking reviews',
    liner: [
      [null, 'Twenty-eight dollars to park beside a venue that holds three hundred people. I’d like to speak to the city.'],
      ['shania-man-i-feel', 'Every patient hums along to this in the chair. With my hands in their mouth. That’s commitment.'],
    ],
    recent: 'shown',
  },
  kwame: {
    look: 'mint',
    tweak: { paper: '#F2C94C', card: '#FFF6D6', ink: '#14342B', accent: '#C0392B', highlight: '#FFFFFF', displayFont: 'serifBlack', texture: 'grain' },
    order: 'PIWSLGR',
    pinned: [
      'fela-water-no-get-enemy',
      'My uncle’s living room in Weston, Sunday after church, the plastic still on the couch. He put it on and the whole room started moving, plastic and all.',
    ],
    introTitle: 'three from the van',
    intro: [
      ['burna-last-last', 'first job of the day.'],
      ['tems-free-mind', 'lunch, doors open.'],
      ['mustafa-stay-alive', 'last job. quiet drive.'],
    ],
    shelves: [['sundays', ['fela-water-no-get-enemy', 'tems-free-mind', 'sade-no-ordinary-love', 'kaytranada-10-percent']]],
    linerTitle: 'job notes',
    liner: [
      [null, 'My van has better speakers than your apartment. I rewired them myself. It took a weekend and it was the best weekend of my year.'],
      ['kaytranada-10-percent', 'You can wire a whole panel to this and not notice the time.'],
    ],
    recent: 'shown',
  },
  hyejin: {
    look: 'candy',
    tweak: { paper: '#E9E4F5', displayFont: 'typeBold', texture: 'grid', wall: 'grid', layout: 'pages' },
    order: 'WIPSLG',
    pinned: [
      'yo-la-tengo-autumn-sweater',
      'A used CD from a shop on Bloor that isn’t there now. Four dollars. I bought it for the cover and played track nine until the disc gave up.',
    ],
    introTitle: 'THREE YOU HAVEN’T HEARD (YOU HAVE)',
    intro: [
      ['yo-la-tengo-autumn-sweater', 'track nine. always track nine.'],
      ['pavement-gold-soundz', 'fine, it’s the single. it’s still the best one.'],
      ['alex-g-runner', 'i liked him before. i’m required to say that.'],
    ],
    shelves: [['B-SIDES, DEEP CUTS, AND ONE HIT I’M ASHAMED OF', ['newjeans-ditto', 'slowdive-when-the-sun-hits', 'pavement-gold-soundz', 'alex-g-runner']]],
    linerTitle: 'ERRATA',
    liner: [
      [null, 'If it charted, I’ll get to it in ten years and act like I found it.'],
      ['newjeans-ditto', 'This charted. I got to it in ten days. Nobody is to mention this.'],
    ],
    recent: 'hidden',
  },
  dmitri: {
    look: 'midnight',
    tweak: { paper: '#1A1A1A', card: '#262626', ink: '#F0F0F0', accent: '#FF3B30', highlight: '#3A3A3A', displayFont: 'poster', layout: 'poster' },
    order: 'PIWSLGR',
    pinned: [
      'death-grips-get-got',
      'My condo in Richmond Hill, a Tuesday, new subwoofer just out of the box. I got forty seconds in before the first knock. That knock is framed in my memory.',
    ],
    introTitle: 'three songs my neighbours know',
    intro: [
      ['death-grips-get-got', 'unit 1204 knows this one.'],
      ['deftones-be-quiet', 'unit 1206 asked what it was. progress.'],
      ['aphex-avril-14th', 'the apology song. two minutes. very quiet.'],
    ],
    shelves: [['subwoofer tests, in order of complaints', ['death-grips-get-got', 'burial-archangel', 'four-tet-baby', 'deftones-be-quiet']]],
    linerTitle: 'notices from the board',
    liner: [
      [null, 'Three noise complaints and one compliment. I framed the compliment.'],
      ['burial-archangel', 'The bass on this is so low it’s more of a rumour.'],
    ],
    recent: 'shown',
  },
  tessa: {
    look: 'notebook',
    tweak: { displayFont: 'typeBold', texture: 'grid', accent: '#1F7A5C' },
    order: 'ILPSWSG',
    pinned: [
      'big-thief-simulation-swarm',
      'Robarts, the thirteenth floor, a carrel with no window. I was 300 words into a chapter I’d been avoiding. I listened twice and wrote two thousand more. The chapter was cut.',
    ],
    introTitle: 'THREE PRIMARY SOURCES',
    intro: [
      ['big-thief-simulation-swarm', 'see: the guitar solo, which falls up the stairs.'],
      ['wednesday-chosen-to-deserve', 'see: every verse. a confession each.'],
      ['cameron-winter-love-takes-miles', 'see: the way he finds the words as they arrive.'],
    ],
    shelves: [
      ['WRITING', ['nick-drake-pink-moon', 'sufjan-chicago', 'big-thief-simulation-swarm']],
      ['NOT WRITING', ['mj-lenderman-shes-leaving-you', 'wednesday-chosen-to-deserve', 'cameron-winter-love-takes-miles']],
    ],
    linerTitle: 'FOOTNOTES',
    liner: [
      [null, 'My thesis is about something I can’t explain at parties. The music is easier to explain and I can’t explain that either.'],
      ['nick-drake-pink-moon', 'Twenty-eight minutes, one man, one guitar, and a piano for about ten seconds. Peer review: flawless.'],
    ],
    recent: 'hidden',
  },
  andre: {
    look: 'forest',
    tweak: { paper: '#0F4C3A', card: '#17604A', accent: '#F2C94C', highlight: '#1F7A5C', displayFont: 'poster', wall: 'scatter', layout: 'poster' },
    order: 'PISWLGR',
    pinned: [
      'sade-no-ordinary-love',
      'My aunt’s backyard off Eglinton, I was nine, standing on a milk crate behind two turntables. I played this and my grandmother danced. I’ve been chasing that ever since.',
    ],
    introTitle: 'three that never miss',
    intro: [
      ['sade-no-ordinary-love', 'works at a wedding. works at a wake.'],
      ['burna-last-last', 'for when the uncles need a reason to stand up.'],
      ['badu-didnt-cha-know', 'last song before the lights. everybody sways.'],
    ],
    shelves: [['the family function, start to finish', ['drake-passionfruit', 'tems-free-mind', 'burna-last-last', 'sade-no-ordinary-love']]],
    linerTitle: 'selector’s rules',
    liner: [
      [null, 'Read the room before you read the playlist. I read a room faster than you read a menu.'],
      ['drake-passionfruit', 'Start with something everybody already knows. Earn the rest.'],
    ],
    recent: 'shown',
  },
  marisol: {
    look: 'candy',
    tweak: { paper: '#FFB3C7', accent: '#7B2CBF', displayFont: 'poster', layout: 'poster' },
    order: 'IPSWLGR',
    pinned: [
      'celine-all-coming-back',
      'The pub by the lake, a Thursday, my first time up. Seven and a half minutes. By the last chorus the bartender had stopped pouring. I have been insufferable since.',
    ],
    introTitle: 'my three-song set',
    intro: [
      ['shania-man-i-feel', 'opener. three notes and the room is mine.'],
      ['avril-complicated', 'the breather. everyone knows it. everyone’s flat.'],
      ['celine-all-coming-back', 'closer. do not sign up after me.'],
    ],
    shelves: [['songs i’ve retired other people from singing', ['abba-dancing-queen', 'crj-run-away-with-me', 'nickelback-how-you-remind-me', 'shania-man-i-feel']]],
    linerTitle: 'scouting reports',
    liner: [
      [null, 'Karaoke is a sport. Thursdays are regionals.'],
      ['nickelback-how-you-remind-me', 'Easy range, big chorus, the whole bar joins in against its will. A perfect karaoke song. I said what I said.'],
    ],
    recent: 'shown',
  },
  eli: {
    look: 'kraft',
    order: 'WPILSSGR',
    pinned: [
      'pixies-where-is-my-mind',
      'The shop in Kensington, my first Saturday, fifteen and paid in store credit. The owner put this on to see what I’d do. I turned it up. I’ve worked there ever since.',
    ],
    introTitle: 'staff picks (all mine)',
    intro: [
      ['pavement-gold-soundz', 'every week, until someone stops me.'],
      ['sonic-youth-teen-age-riot', 'the first seven minutes of anyone’s education.'],
      ['yo-la-tengo-autumn-sweater', 'for people who say they don’t like organs.'],
    ],
    shelves: [
      ['things i sell and then judge you for', ['pixies-where-is-my-mind', 'cure-just-like-heaven', 'fleetwood-everywhere']],
      ['things i’d sell you with respect', ['talking-heads-this-must-be', 'pavement-gold-soundz', 'stereolab-french-disko', 'sonic-youth-teen-age-riot']],
    ],
    linerTitle: 'from behind the counter',
    liner: [
      [null, 'No, we don’t have it. Yes, I’ve heard of it. No, it isn’t better on vinyl.'],
      ['talking-heads-this-must-be', 'A love song by someone who seems surprised to be having feelings. Relatable.'],
    ],
    recent: 'shown',
  },
};

// ---- assembling a room from what they wrote ------------------------------------

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const WALL_TITLES = ['the wall', 'on the wall', 'records i’d save in a fire', 'the good wall'];
const PINNED_TITLES = ['the pinned record', 'pinned', 'the one'];
const GUEST_TITLES = ['guestbook', 'sign here', 'visitors’ book'];
const RECENT_TITLES = ['recently played', 'lately'];
const STICKERS: StickerKind[] = ['star', 'burst', 'heart', 'eye', 'smile', 'bolt', 'flower'];

function sticker(seed: string, theme: RoomTheme, corner: boolean): Sticker {
  const h = hash(seed);
  const colours = [theme.highlight, theme.accent, theme.card, '#FFD23F'];
  return {
    kind: STICKERS[h % STICKERS.length],
    color: colours[(h >>> 3) % colours.length],
    x: corner ? 0.8 + ((h >>> 5) % 8) / 100 : 0.55 + ((h >>> 5) % 25) / 100,
    y: corner ? -0.1 + ((h >>> 9) % 6) / 100 : 0.45 + ((h >>> 9) % 30) / 100,
    size: 50 + ((h >>> 13) % 22),
    rotate: -18 + ((h >>> 17) % 36),
  };
}

function build(id: string, d: Decor): Room {
  const theme: RoomTheme = { ...looks[d.look], ...d.tweak };
  const shout = theme.displayFont === 'typeBold'; // typewriter rooms shout their headings
  const title = (list: string[], salt: string) => {
    const t = list[hash(id + salt) % list.length];
    return shout ? t.toUpperCase() : t;
  };
  const taste = tastes[id];

  // The wall: everything they play and push, plus what's on their shelves.
  const all = [...taste.plays, ...taste.shares.map((s) => s.trackId), ...d.shelves.flatMap((s) => s[1])];
  const unique = [...new Set(all)];
  const wall = unique.slice(0, unique.length >= 9 ? 9 : 6);

  // The neighbours who've signed: two or three, with the song they push on everyone.
  const signers = residents
    .filter((r) => r.id !== id && tastes[r.id]?.shares.length)
    .sort((a, b) => hash(id + a.id) - hash(id + b.id))
    .slice(0, 2 + (hash(id) % 2));

  let shelf = 0;
  const sections: RoomSection[] = [];
  for (const letter of d.order) {
    if (letter === 'I') sections.push({ kind: 'intro', title: d.introTitle, songs: d.intro.map(([trackId, why]) => ({ trackId, why })) });
    if (letter === 'P') sections.push({ kind: 'pinned', title: title(PINNED_TITLES, 'p'), trackId: d.pinned[0], note: d.pinned[1] });
    if (letter === 'W') sections.push({ kind: 'wall', title: title(WALL_TITLES, 'w'), trackIds: wall });
    if (letter === 'S' && d.shelves[shelf]) {
      sections.push({ kind: 'shelf', title: d.shelves[shelf][0], trackIds: d.shelves[shelf][1] });
      shelf++;
    }
    if (letter === 'L') {
      sections.push({ kind: 'liner', title: d.linerTitle, notes: d.liner.map(([trackId, text]) => (trackId ? { trackId, text } : { text })) });
    }
    if (letter === 'G') {
      sections.push({
        kind: 'guestbook',
        title: title(GUEST_TITLES, 'g'),
        entries: signers.map((s) => ({ fromId: s.id, trackId: tastes[s.id].shares[0].trackId, why: tastes[s.id].shares[0].note })),
      });
    }
    if (letter === 'R') sections.push({ kind: 'recent', title: title(RECENT_TITLES, 'r'), visibility: d.recent, trackIds: taste.plays.slice(0, 4) });
  }
  // People who hide their listening still say so, rather than leaving a gap.
  if (d.recent === 'hidden' && !d.order.includes('R')) {
    sections.push({ kind: 'recent', title: title(RECENT_TITLES, 'r'), visibility: 'hidden', trackIds: [] });
  }

  // A few stickers: one on the first section's corner, one on the wall, sometimes a third.
  sections[0].stickers = [sticker(id + 'a', theme, true)];
  const wallSection = sections.find((s) => s.kind === 'wall');
  if (wallSection) wallSection.stickers = [sticker(id + 'b', theme, false)];
  if (hash(id + 'c') % 2 && sections[2] && sections[2].kind !== 'wall') sections[2].stickers = [sticker(id + 'c', theme, true)];

  return { personId: id, theme, sections };
}

/** Every resident's room, hand-made ones first. */
export const seedRooms: Room[] = [...handmade, ...Object.entries(decor).map(([id, d]) => build(id, d))];

/** What a new account starts with: the house look and empty furniture, ready to be made theirs. */
export function starterRoom(personId: string): Room {
  return {
    personId,
    theme: { ...looks.house },
    sections: [
      { kind: 'intro', title: 'three songs, if we’ve never met', songs: [] },
      { kind: 'pinned', title: 'the pinned record', trackId: null, note: '' },
      { kind: 'wall', title: 'the wall', trackIds: [] },
      { kind: 'recent', title: 'recently played', visibility: 'shown', trackIds: [] },
      { kind: 'guestbook', title: 'guestbook', entries: [] },
    ],
  };
}
