/**
 * What the GTA has been posting. Each post goes to its author's home city.
 *
 * `minutesAgo` is measured from the moment the app is first opened, so the
 * feed always looks recent. Negative numbers are posts that haven't happened
 * yet: they appear on their own as time passes, so the feed moves while
 * you're using the app.
 */
export type SeedPost = { by: string; trackId: string; note: string; minutesAgo: number };

export const seedPosts: SeedPost[] = [
  // ---- Toronto ----
  { by: 'maren', trackId: 'big-thief-simulation-swarm', minutesAgo: 55, note: 'put it on in the shop while shelving. three customers asked what it was. sold zero books for ten minutes. worth it.' },
  { by: 'eli', trackId: 'pavement-gold-soundz', minutesAgo: 130, note: 'restocked today. again. kensington buys one copy a week like clockwork and i choose to believe it’s the same person.' },
  { by: 'callum', trackId: 'pup-kids', minutesAgo: 200, note: 'they’re from here and they sound like the gardiner at rush hour. play it when your landlord texts.' },
  { by: 'amara', trackId: 'cdw-work', minutesAgo: 320, note: 'she made this down the road. we forget how much comes out of this city. four minutes of being proud, please.' },
  { by: 'zainab', trackId: 'mustafa-stay-alive', minutesAgo: 410, note: 'written about regent park by someone from regent park. if you live here you owe it one proper listen.' },
  { by: 'owen', trackId: 'hip-bobcaygeon', minutesAgo: 500, note: 'the bit about toronto is why i moved here. the rest of it is why i still drive north every august.' },
  { by: 'hana', trackId: 'slowdive-when-the-sun-hits', minutesAgo: 700, note: 'for anyone on the bus up yonge tonight. it’s snowing a little. this is the correct song.' },
  { by: 'malik', trackId: 'bbng-time-moves-slow', minutesAgo: 840, note: 'jazz school kids from this city made this. everyone here should be smug about it.' },
  { by: 'bea', trackId: 'feist-mushaboom', minutesAgo: 1000, note: 'this was coming out of two different cafés on dundas west this morning. it’s november. somebody’s an optimist.' },
  { by: 'dez', trackId: 'miles-so-what', minutesAgo: 1150, note: 'trio gig last night, eleven people. opened with this. the eleven were lovely.' },
  { by: 'niamh', trackId: 'fontaines-starburster', minutesAgo: 1300, note: 'saw them in a room far too big for them and it still felt like a basement. parkdale, back me up.' },
  { by: 'theo', trackId: 'american-football-never-meant', minutesAgo: 1500, note: 'emo night is friday. consider this your warning and your invitation.' },
  { by: 'clemence', trackId: 'wolf-parade-ill-believe', minutesAgo: 1700, note: 'toronto, i’m lending you a montréal song. be careful with it. i want it back.' },
  { by: 'kwame', trackId: 'burna-last-last', minutesAgo: 1900, note: 'every car on weston road had this on all summer and i’m not ready for that to be over.' },
  { by: 'andre', trackId: 'sade-no-ordinary-love', minutesAgo: 2200, note: 'eglinton west, saturday, a shop door open, this drifting out. nobody was in a hurry for four minutes.' },
  { by: 'ingrid', trackId: 'boc-roygbiv', minutesAgo: 2500, note: 'the lake was flat this morning and the island ferry was the only thing moving. two and a half minutes. fits exactly.' },
  { by: 'tessa', trackId: 'cameron-winter-love-takes-miles', minutesAgo: 2900, note: 'thirteenth floor of the library, everyone around me pretending to work. sending this to the whole building.' },
  { by: 'grace', trackId: 'glenn-gould-aria', minutesAgo: 3300, note: 'there’s a statue of him on a bench downtown. i sat next to it at lunch and played this. he’d have hated that. too many tourists.' },
  { by: 'hyejin', trackId: 'yo-la-tengo-autumn-sweater', minutesAgo: 3700, note: 'it’s finally sweater weather and i will be insufferable about this song until march.' },
  { by: 'dev', trackId: 'burial-archangel', minutesAgo: 4200, note: 'the dufferin bus after midnight is this song. i don’t make the rules.' },
  { by: 'wren', trackId: 'bill-evans-peace-piece', minutesAgo: 4800, note: 'my 4:30 student quit today. i played this afterwards. the junction was very quiet. recommended for endings.' },
  { by: 'mateo', trackId: 'bad-bunny-titi', minutesAgo: 5400, note: 'st. clair on a saturday. the shop next door complained. i turned it up.' },

  // ---- Vaughan ----
  { by: 'jonah', trackId: 'steely-dan-peg', minutesAgo: 90, note: 'played this at the thornhill hi-fi meetup (four men, one basement). nobody spoke during the solo. a perfect evening.' },
  { by: 'sofia', trackId: 'abba-dancing-queen', minutesAgo: 380, note: 'woodbridge salon report: three clients, one nonna, everybody singing. this city has taste. it just hides it.' },
  { by: 'sol', trackId: 'peggy-gou-nanana', minutesAgo: 900, note: 'vaughan has no clubs and i’ve made my peace. this is for the subway platform at 11:40, heading home on time.' },
  { by: 'lucia', trackId: 'beaches-blame-brett', minutesAgo: 1800, note: 'worth the drive downtown, not worth the parking. play it on the 400 on the way back.' },
  { by: 'jonah', trackId: 'destroyer-kaputt', minutesAgo: 3900, note: 'for a mall parking lot at dusk. you’ll understand when you’re in one.' },

  // ---- Mississauga ----
  { by: 'tobi', trackId: 'fela-water-no-get-enemy', minutesAgo: 160, note: 'gym, 6 a.m., nobody on the squat rack, this in the big headphones. the best eleven minutes of the week.' },
  { by: 'marisol', trackId: 'shania-man-i-feel', minutesAgo: 620, note: 'thursday at the pub in port credit. i did this one. the lake heard me.' },
  { by: 'farah', trackId: 'mitski-my-love-mine', minutesAgo: 1400, note: 'exam season. if you see someone crying efficiently by the library printers, mind your business.' },
  { by: 'rohan', trackId: 'national-bloodbuzz-ohio', minutesAgo: 2600, note: 'they’re renovating the food court again. where am i supposed to be sad now.' },
  { by: 'tobi', trackId: 'burna-last-last', minutesAgo: 4400, note: 'three different cars playing this at one red light. mississauga has spoken.' },

  // ---- Brampton ----
  { by: 'priya', trackId: 'sidhu-295', minutesAgo: 110, note: 'brampton doesn’t need telling. this is for everybody else reading our feed. start here.' },
  { by: 'kiran', trackId: 'diljit-goat', minutesAgo: 560, note: 'the 7:42 from bramalea. if you see a guy nodding with his eyes closed, that’s me, and this is why.' },
  { by: 'jamal', trackId: 'kendrick-money-trees', minutesAgo: 1600, note: 'played it at a cookout in the park. kept it clean. nobody got hurt. growth.' },
  { by: 'priya', trackId: 'ap-dhillon-brown-munde', minutesAgo: 3100, note: 'years later and it still comes out of every second car on queen street. the other queen street.' },

  // ---- Markham ----
  { by: 'yuki', trackId: 'newjeans-ditto', minutesAgo: 240, note: 'mall food court, bubble tea, this on loop in one ear. markham is fine, actually.' },
  { by: 'arjun', trackId: 'deftones-be-quiet', minutesAgo: 1250, note: 'walked past our old basement in unionville. someone else’s band was in there playing this. badly. i nearly cried.' },
  { by: 'yuki', trackId: 'crj-run-away-with-me', minutesAgo: 3500, note: 'for whoever else is stuck on highway 7 right now. roll the window down for the sax.' },

  // ---- Richmond Hill ----
  { by: 'dmitri', trackId: 'death-grips-get-got', minutesAgo: 480, note: 'to my neighbours: it’s this. this is what it’s been.' },
  { by: 'dmitri', trackId: 'aphex-avril-14th', minutesAgo: 2700, note: 'a peace offering to the whole building. two minutes. i’ll keep it under 40 percent.' },

  // ---- yet to happen (these arrive while you're using the app) ----
  { by: 'hana', trackId: 'mbv-only-shallow', minutesAgo: -4, note: 'just walked past a guitar shop and someone was trying this riff on a tiny amp. whoever you are: respect.' },
  { by: 'kiran', trackId: 'burna-last-last', minutesAgo: -10, note: 'train’s delayed. obviously. this is making the platform bearable.' },
  { by: 'sofia', trackId: 'chappell-good-luck-babe', minutesAgo: -18, note: 'last client of the day asked for “that one again.” third time. no complaints from me.' },
  { by: 'eli', trackId: 'talking-heads-this-must-be', minutesAgo: -28, note: 'someone just bought this on vinyl for their partner and blushed at the till. kensington is alright sometimes.' },
  { by: 'marisol', trackId: 'celine-all-coming-back', minutesAgo: -45, note: 'warming up. port credit, you’ve been warned.' },
  { by: 'callum', trackId: 'fucked-up-queen-of-hearts', minutesAgo: -65, note: 'close is done, kitchen’s clean, this is going on the speaker. east end, if you can hear it: hi.' },
  { by: 'amara', trackId: 'sza-good-days', minutesAgo: -95, note: 'break. fifteen minutes. this, and nobody talk to me.' },
  { by: 'yuki', trackId: 'magdalena-bay-death-romance', minutesAgo: -130, note: 'the render’s at 91 percent. this is the only thing keeping me in the chair.' },
];
