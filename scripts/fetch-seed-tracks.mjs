// Fetches real metadata, artwork and 30-second previews for the seeded world
// from the iTunes Search API (no key needed) and bakes them into
// src/seed/tracks.json, so the app looks inhabited on first launch even offline.
//
//   node scripts/fetch-seed-tracks.mjs          fetch only what's missing
//   node scripts/fetch-seed-tracks.mjs --all    refetch everything
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'src', 'seed', 'tracks.json');

// [slug, artist, title, pinnedItunesId?]  Pin an id when search picks a remix or a live cut.
const WANT = [
  ['big-thief-vampire-empire', 'Big Thief', 'Vampire Empire'],
  ['big-thief-not', 'Big Thief', 'Not'],
  ['big-thief-simulation-swarm', 'Big Thief', 'Simulation Swarm'],
  ['alvvays-archie', 'Alvvays', 'Archie, Marry Me'],
  ['alvvays-belinda-says', 'Alvvays', 'Belinda Says'],
  ['bbng-time-moves-slow', 'BADBADNOTGOOD', 'Time Moves Slow'],
  ['daniel-caesar-best-part', 'Daniel Caesar', 'Best Part'],
  ['mustafa-stay-alive', 'Mustafa', 'Stay Alive'],
  ['cdw-work', 'Charlotte Day Wilson', 'Work'],
  ['bss-anthems', 'Broken Social Scene', 'Anthems for a Seventeen Year-Old Girl'],
  ['metric-help-im-alive', 'Metric', "Help I'm Alive"],
  ['feist-mushaboom', 'Feist', 'Mushaboom'],
  ['weeknd-house-of-balloons', 'The Weeknd', 'House of Balloons / Glass Table Girls'],
  ['drake-passionfruit', 'Drake', 'Passionfruit'],
  ['pup-kids', 'PUP', 'Kids', 1448895509],
  ['fucked-up-queen-of-hearts', 'Fucked Up', 'Queen of Hearts'],
  ['caribou-cant-do-without-you', 'Caribou', "Can't Do Without You"],
  ['jessie-reyez-figures', 'Jessie Reyez', 'Figures'],
  ['kaytranada-10-percent', 'KAYTRANADA', '10%'],
  ['mk-gee-are-you-looking-up', 'Mk.gee', 'Are You Looking Up'],
  ['neil-young-harvest-moon', 'Neil Young', 'Harvest Moon'],
  ['joni-a-case-of-you', 'Joni Mitchell', 'A Case of You'],
  ['hip-bobcaygeon', 'The Tragically Hip', 'Bobcaygeon'],
  ['rush-limelight', 'Rush', 'Limelight'],
  ['crj-run-away-with-me', 'Carly Rae Jepsen', 'Run Away With Me'],
  ['beaches-blame-brett', 'The Beaches', 'Blame Brett'],
  ['wolf-parade-ill-believe', 'Wolf Parade', "I'll Believe in Anything"],
  ['destroyer-kaputt', 'Destroyer', 'Kaputt'],
  ['orville-peck-dead-of-night', 'Orville Peck', 'Dead of Night'],
  ['glenn-gould-aria', 'Glenn Gould', 'Goldberg Variations Aria'],
  ['phoebe-motion-sickness', 'Phoebe Bridgers', 'Motion Sickness'],
  ['mitski-my-love-mine', 'Mitski', 'My Love Mine All Mine'],
  ['jbrekkie-be-sweet', 'Japanese Breakfast', 'Be Sweet'],
  ['wednesday-chosen-to-deserve', 'Wednesday', 'Chosen to Deserve'],
  ['mj-lenderman-shes-leaving-you', 'MJ Lenderman', "She's Leaving You"],
  ['alex-g-runner', 'Alex G', 'Runner'],
  ['frank-ocean-pink-white', 'Frank Ocean', 'Pink + White'],
  ['sza-good-days', 'SZA', 'Good Days'],
  ['kendrick-money-trees', 'Kendrick Lamar', 'Money Trees'],
  ['charli-von-dutch', 'Charli xcx', 'Von dutch'],
  ['magdalena-bay-death-romance', 'Magdalena Bay', 'Death & Romance'],
  ['fontaines-starburster', 'Fontaines D.C.', 'Starburster'],
  ['geese-taxes', 'Geese', 'Taxes'],
  ['cameron-winter-love-takes-miles', 'Cameron Winter', 'Love Takes Miles'],
  ['turnstile-mystery', 'Turnstile', 'MYSTERY'],
  ['deftones-be-quiet', 'Deftones', 'Be Quiet and Drive (Far Away)'],
  ['mbv-only-shallow', 'My Bloody Valentine', 'Only Shallow'],
  ['slowdive-when-the-sun-hits', 'Slowdive', 'When the Sun Hits'],
  ['cocteau-heaven-or-las-vegas', 'Cocteau Twins', 'Heaven or Las Vegas'],
  ['cure-just-like-heaven', 'The Cure', 'Just Like Heaven'],
  ['talking-heads-this-must-be', 'Talking Heads', 'This Must Be the Place (Naive Melody)'],
  ['fleetwood-everywhere', 'Fleetwood Mac', 'Everywhere'],
  ['steely-dan-peg', 'Steely Dan', 'Peg'],
  ['sade-no-ordinary-love', 'Sade', 'No Ordinary Love'],
  ['badu-didnt-cha-know', 'Erykah Badu', "Didn't Cha Know"],
  ['dangelo-lady', "D'Angelo", 'Lady'],
  ['tribe-electric-relaxation', 'A Tribe Called Quest', 'Electric Relaxation'],
  ['madvillain-all-caps', 'Madvillain', 'All Caps'],
  ['burial-archangel', 'Burial', 'Archangel'],
  ['aphex-avril-14th', 'Aphex Twin', 'Avril 14th'],
  ['boc-roygbiv', 'Boards of Canada', 'Roygbiv'],
  ['four-tet-baby', 'Four Tet', 'Baby'],
  ['peggy-gou-nanana', 'Peggy Gou', '(It Goes Like) Nanana'],
  ['abba-dancing-queen', 'ABBA', 'Dancing Queen'],
  ['nickelback-how-you-remind-me', 'Nickelback', 'How You Remind Me'],
  ['shania-man-i-feel', 'Shania Twain', 'Man! I Feel Like a Woman!'],
  ['avril-complicated', 'Avril Lavigne', 'Complicated'],
  ['celine-all-coming-back', 'Céline Dion', "It's All Coming Back to Me Now"],
  ['newjeans-ditto', 'NewJeans', 'Ditto'],
  ['bad-bunny-titi', 'Bad Bunny', 'Tití Me Preguntó'],
  ['fela-water-no-get-enemy', 'Fela Kuti', 'Water No Get Enemy'],
  ['burna-last-last', 'Burna Boy', 'Last Last'],
  ['tems-free-mind', 'Tems', 'Free Mind'],
  ['diljit-goat', 'Diljit Dosanjh', 'G.O.A.T.'],
  ['ap-dhillon-brown-munde', 'AP Dhillon', 'Brown Munde'],
  ['sidhu-295', 'Sidhu Moose Wala', '295'],
  ['miles-so-what', 'Miles Davis', 'So What'],
  ['alice-coltrane-satchidananda', 'Alice Coltrane', 'Journey in Satchidananda', 1440719297],
  ['bill-evans-peace-piece', 'Bill Evans', 'Peace Piece'],
  ['nina-sinnerman', 'Nina Simone', 'Sinnerman', 1445668995],
  ['nick-drake-pink-moon', 'Nick Drake', 'Pink Moon'],
  ['elliott-between-the-bars', 'Elliott Smith', 'Between the Bars'],
  ['sufjan-chicago', 'Sufjan Stevens', 'Chicago'],
  ['bon-iver-holocene', 'Bon Iver', 'Holocene'],
  ['radiohead-weird-fishes', 'Radiohead', 'Weird Fishes / Arpeggi'],
  ['national-bloodbuzz-ohio', 'The National', 'Bloodbuzz Ohio'],
  ['lcd-all-my-friends', 'LCD Soundsystem', 'All My Friends'],
  ['chappell-good-luck-babe', 'Chappell Roan', 'Good Luck, Babe!'],
  ['paramore-hard-times', 'Paramore', 'Hard Times'],
  ['mcr-helena', 'My Chemical Romance', 'Helena'],
  ['american-football-never-meant', 'American Football', 'Never Meant'],
  ['title-fight-head-in-the-ceiling-fan', 'Title Fight', 'Head in the Ceiling Fan'],
  ['death-grips-get-got', 'Death Grips', 'Get Got'],
  ['bcnr-the-place', 'Black Country, New Road', 'The Place Where He Inserted the Blade'],
  ['stereolab-french-disko', 'Stereolab', 'French Disko'],
  ['yo-la-tengo-autumn-sweater', 'Yo La Tengo', 'Autumn Sweater'],
  ['pavement-gold-soundz', 'Pavement', 'Gold Soundz'],
  ['sonic-youth-teen-age-riot', 'Sonic Youth', 'Teen Age Riot'],
  ['pixies-where-is-my-mind', 'Pixies', 'Where Is My Mind?'],
];

const norm = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lookup(artist, title, pinned) {
  const url = pinned
    ? `https://itunes.apple.com/lookup?country=CA&id=${pinned}`
    : 'https://itunes.apple.com/search?media=music&entity=song&limit=8&country=CA&term=' +
      encodeURIComponent(`${artist} ${title}`);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url).catch(() => null); // network blip: treat like a rate limit
    if (res?.ok) {
      const { results } = await res.json();
      if (pinned) return results[0] ?? null;
      const a = norm(artist);
      const t = norm(title).split(' ')[0];
      return (
        results.find((r) => norm(r.artistName).includes(a) && norm(r.trackName).includes(t) && r.previewUrl) ??
        results.find((r) => norm(r.artistName).includes(a) && r.previewUrl) ??
        null
      );
    }
    await sleep(15000); // rate limited: back off and try again
  }
  return null;
}

const save = (obj) => {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(obj, null, 2) + '\n');
};

const all = process.argv.includes('--all');
const have = !all && existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : {};
const out = {};
const missed = [];

for (const [slug, artist, title, pinned] of WANT) {
  if (have[slug]) {
    out[slug] = have[slug];
    continue;
  }
  const r = await lookup(artist, title, pinned);
  if (!r) {
    missed.push(slug);
    console.log('MISS', slug);
  } else {
    out[slug] = {
      id: slug,
      sourceId: String(r.trackId),
      title: r.trackName,
      artist: r.artistName,
      album: r.collectionName ?? '',
      year: r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : null,
      genre: r.primaryGenreName ?? '',
      artworkUrl: r.artworkUrl100.replace('100x100bb', '600x600bb'),
      previewUrl: r.previewUrl,
    };
    console.log('ok  ', slug, '→', r.artistName, '—', r.trackName);
    save(out); // save as we go, so a dropped connection costs one track, not all of them
  }
  await sleep(3200);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`\n${Object.keys(out).length} tracks written, ${missed.length} missed`, missed);
