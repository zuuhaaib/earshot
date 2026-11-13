/**
 * The conversations already going in artists' local rooms. A thread belongs to
 * the city its starter calls home; the GTA view rolls every city's threads up.
 *
 * The artist is named by one of their seeded tracks, so the spelling always
 * matches the music source. Times count back from first launch: a thread
 * started `daysAgo`, each reply `after` that many hours. `inMinutes` marks a
 * reply that hasn't been written yet and turns up while you're using the app.
 */
export type SeedReply = { by: string; body: string; trackId?: string; after?: number; inMinutes?: number };
export type SeedThread = {
  artistOf: string;
  by: string;
  title: string;
  body: string;
  daysAgo: number;
  replies: SeedReply[];
};

export const seedThreads: SeedThread[] = [
  {
    artistOf: 'big-thief-not',
    by: 'maren',
    title: 'what song would you play for someone who’s never heard them?',
    body: 'my sister’s visiting and thinks they’re “that sad folk band.” i get one song. help.',
    daysAgo: 9,
    replies: [
      { by: 'tessa', after: 2, trackId: 'big-thief-simulation-swarm', body: 'simulation swarm. it’s the friendliest door in. if she doesn’t like the guitar solo you may need a new sister.' },
      { by: 'bea', after: 5, trackId: 'big-thief-not', body: 'not. play it loud. “sad folk band” will not survive the last two minutes.' },
      { by: 'hana', after: 20, body: 'controversial: don’t play a song, play a live video where the amp is clearly about to die. context matters.' },
      { by: 'callum', after: 31, trackId: 'big-thief-vampire-empire', body: 'vampire empire. the only time folk music has made me want to shove someone, affectionately.' },
      { by: 'maren', after: 100, body: 'update: went with simulation swarm. she asked to hear it again. i’m not saying i cried in the car but the car was involved.' },
    ],
  },
  {
    artistOf: 'big-thief-not',
    by: 'tessa',
    title: 'anyone going to the next show alone?',
    body: 'everyone i know “likes one song.” i’d rather stand next to a stranger who knows the words. not a date, just someone to nod at.',
    daysAgo: 3,
    replies: [
      { by: 'maren', after: 3, body: 'me. i’ll be near the sound desk pretending i’m not emotional. send me a song and we’ll sort it out.' },
      { by: 'bea', after: 9, body: 'i’m in if it’s seated. my knees have opinions now.' },
      { by: 'niamh', after: 30, body: 'came for the thread, staying for “my knees have opinions.” i’ll come. parkdale contingent.' },
      { by: 'tessa', inMinutes: 6, body: 'ok, that’s four of us. i’ll make a plan. someone send me a song so we’ve got a chat going.' },
    ],
  },
  {
    artistOf: 'alvvays-archie',
    by: 'bea',
    title: 'best live recording?',
    body: 'i know the albums by heart. what’s the best version of anything that isn’t on one?',
    daysAgo: 12,
    replies: [
      { by: 'maren', after: 4, trackId: 'alvvays-archie', body: 'any version of archie where the whole room does the “hey.” the crowd is the instrument.' },
      { by: 'hyejin', after: 11, trackId: 'alvvays-belinda-says', body: 'belinda says, any live take. the key change lands harder when you can hear four hundred people brace for it.' },
      { by: 'eli', after: 50, body: 'a bootleg tape came through the shop once. sold in an hour. i never even got to play it. still bitter.' },
      { by: 'clemence', after: 120, body: 'i saw them in a church basement in montréal and the pa caught fire, a little. best show i’ve seen. no recording exists, which is correct.' },
    ],
  },
  {
    artistOf: 'pup-kids',
    by: 'callum',
    title: 'pit etiquette for first-timers (please read)',
    body: 'bringing my little cousin to his first show. what does he need to know?',
    daysAgo: 6,
    replies: [
      { by: 'theo', after: 1, body: '1. someone falls, you pick them up. 2. shoes tied. 3. earplugs aren’t optional. ask my left ear.' },
      { by: 'niamh', after: 6, body: 'tell him to stand at the side for two songs and watch how it moves first. it’s weather. you learn to read it.' },
      { by: 'arjun', after: 26, body: 'don’t wear the band’s shirt to the band’s show. i don’t make the rules. (i do. nobody’s ever challenged me.)' },
      { by: 'callum', after: 96, trackId: 'pup-kids', body: 'report: he lost a shoe and gained a personality. thank you all.' },
    ],
  },
  {
    artistOf: 'bbng-time-moves-slow',
    by: 'malik',
    title: 'which record do you hand someone first?',
    body: 'cousin’s into jazz “in theory.” where do i start him?',
    daysAgo: 15,
    replies: [
      { by: 'dez', after: 3, trackId: 'bbng-time-moves-slow', body: 'IV, and start at time moves slow. the bassline does the convincing for you.' },
      { by: 'dev', after: 14, body: 'the early stuff where they’re covering rap songs in a rehearsal room. it’s messy and you can hear them working out that they’re a band.' },
      { by: 'wren', after: 40, body: 'i play them for students who say jazz is homework. it works about half the time, which for jazz is a miracle.' },
      { by: 'kwame', after: 200, body: 'my van approves. that’s it. that’s the review.' },
    ],
  },
  {
    artistOf: 'sidhu-295',
    by: 'priya',
    title: 'the song you’d play for someone who’s never heard him',
    body: 'we all know. this is for the people from other cities reading our board. be kind, be thorough.',
    daysAgo: 8,
    replies: [
      { by: 'kiran', after: 1, trackId: 'sidhu-295', body: '295. no debate. then we can argue about second place for a week.' },
      { by: 'jamal', after: 7, body: 'i don’t speak a word of punjabi and i’ve had 295 on repeat since a cookout in 2021. brampton did that to me. thank you.' },
      { by: 'priya', after: 8, body: 'jamal, you’re one of us now. there’s paperwork.' },
      { by: 'tobi', after: 70, body: 'visiting from mississauga. started with 295 like you said. it’s been three days. send help, or send more.' },
    ],
  },
  {
    artistOf: 'burna-last-last',
    by: 'tobi',
    title: 'last last at the gym: yes or no',
    body: 'i say it’s a warm-up song. my spotter says it’s a cooldown. settle it.',
    daysAgo: 4,
    replies: [
      { by: 'kwame', after: 2, body: 'it’s a driving song. you’re both wrong. respectfully.' },
      { by: 'andre', after: 5, body: 'it’s a first-hour-of-the-party song. i’ve tested this at eleven family functions.' },
      { by: 'jamal', after: 19, body: 'it’s an apology song. i use it to get the aux back.' },
      { by: 'kiran', after: 44, body: 'it’s a delayed-train song. i have data.' },
      { by: 'tobi', inMinutes: 30, body: 'none of you have settled anything. it’s a warm-up song.' },
    ],
  },
  {
    artistOf: 'steely-dan-peg',
    by: 'jonah',
    title: 'favourite live recording (i have a list, but go ahead)',
    body: 'i’ll go last.',
    daysAgo: 20,
    replies: [
      { by: 'dez', after: 6, body: 'the one where the solo goes on too long and the drummer is visibly judging. i learned everything i know from that drummer’s face.' },
      { by: 'sol', after: 30, body: 'i’m 26 and i only know peg from a sample. am i allowed in here' },
      { by: 'jonah', after: 31, body: 'sol, yes. everyone gets in through a sample. welcome. there’s reading.' },
      { by: 'malik', after: 150, body: 'my dad owns three copies of aja “in case.” in case of what, he won’t say.' },
    ],
  },
  {
    artistOf: 'slowdive-when-the-sun-hits',
    by: 'hana',
    title: 'pedal thread (sorry)',
    body: 'what are they using on when the sun hits? i’ve been at it for nine years and my landlord has started leaving notes.',
    daysAgo: 11,
    replies: [
      { by: 'arjun', after: 3, body: 'it isn’t one pedal, it’s two reverbs arguing. also a lot of volume. sorry about your landlord.' },
      { by: 'ingrid', after: 10, body: 'i don’t play anything. i just want to say this thread is very soothing to read.' },
      { by: 'dev', after: 28, body: 'engineer here. half of it is the room. you can’t buy the room. i’ve tried.' },
      { by: 'hana', after: 29, body: '“you can’t buy the room” is going on my amp in tape.' },
    ],
  },
  {
    artistOf: 'bss-anthems',
    by: 'owen',
    title: 'where were you the first time you heard anthems',
    body: 'i’ll start: a friend’s basement in 2003, and i pretended i already knew it.',
    daysAgo: 18,
    replies: [
      { by: 'maren', after: 2, body: 'back of my cousin’s corolla on the 401. it’s pinned in my room. i will not shut up about it.' },
      { by: 'bea', after: 9, body: 'arranging tulips. cried on the tulips. sold them anyway.' },
      { by: 'clemence', after: 45, body: 'a kitchen in montréal. someone told me it was a toronto band and i refused to believe it.' },
      { by: 'eli', after: 130, body: 'behind the counter. a customer asked “what is this” and i got to say “local.” best day at work.' },
    ],
  },
  {
    artistOf: 'hip-bobcaygeon',
    by: 'owen',
    title: 'tribute night: anyone want to stand together?',
    body: 'it’s a covers night, the band’s decent, i’ll be the teacher in the fleece. looking for people who won’t talk through bobcaygeon.',
    daysAgo: 2,
    replies: [
      { by: 'grace', after: 4, body: 'i’ve never been to anything like this. is it weird to come alone? i know all the piano parts.' },
      { by: 'owen', after: 5, body: 'grace, that’s the least weird thing anyone’s said in here. come. bring the piano parts.' },
      { by: 'lucia', after: 22, body: 'driving in from maple if parking’s under twenty dollars. it won’t be. i’ll come anyway.' },
    ],
  },
  {
    artistOf: 'charli-von-dutch',
    by: 'sofia',
    title: 'salon playlist: which one gets the whole room?',
    body: 'i need one song that makes four strangers under dryers look at each other.',
    daysAgo: 5,
    replies: [
      { by: 'yuki', after: 2, trackId: 'charli-von-dutch', body: 'von dutch. two seconds in and people sit up straight.' },
      { by: 'sol', after: 8, body: 'i’ve seen a whole brunch stop for it. the eggs went cold. nobody minded.' },
      { by: 'marisol', after: 50, body: 'it can’t be done at karaoke. i tried. it’s my only failure and i think about it often.' },
    ],
  },
  {
    artistOf: 'mitski-my-love-mine',
    by: 'farah',
    title: 'songs under three minutes that ruin your day (compliment)',
    body: 'i have a tight schedule and a need to feel things. recommendations.',
    daysAgo: 7,
    replies: [
      { by: 'amara', after: 6, trackId: 'mitski-my-love-mine', body: 'my love mine all mine. two eighteen. i checked it against the clock in the break room.' },
      { by: 'tessa', after: 15, body: 'she writes like she’s billing by the second. farah, you’d respect it.' },
      { by: 'rohan', after: 60, body: 'put one on in the food court once. had to leave. the food court.' },
    ],
  },
  {
    artistOf: 'fontaines-starburster',
    by: 'niamh',
    title: 'finding people for the next show (the pub beforehand matters more)',
    body: 'i’m not standing in a queue with nobody to complain to.',
    daysAgo: 1,
    replies: [
      { by: 'rohan', after: 2, body: 'in. i’ll take the train in from mississauga. which pub?' },
      { by: 'clemence', after: 6, body: 'i’ll come for the pub and stay for two songs, like a european.' },
      { by: 'niamh', after: 7, body: 'pub to be decided by whoever sends me the best song. that’s how this app works, right?' },
      { by: 'rohan', inMinutes: 15, body: 'still waiting on the pub, niamh.' },
    ],
  },
  {
    artistOf: 'feist-mushaboom',
    by: 'bea',
    title: 'mushaboom sightings (no notes, just sightings)',
    body: 'post when you hear it out in the wild.',
    daysAgo: 10,
    replies: [
      { by: 'owen', after: 20, body: 'hardware store on the danforth, thursday. a man hummed it at the paint counter.' },
      { by: 'maren', after: 70, body: 'the shop, tuesday. i put it on myself. it counts.' },
      { by: 'hyejin', after: 160, body: 'a wedding in north york. the couple walked in to it. half the room knew it, the other half learned.' },
    ],
  },
  {
    artistOf: 'caribou-cant-do-without-you',
    by: 'sol',
    title: 'can’t do without you: when do you play it?',
    body: 'i have a theory that it only works at the end of something.',
    daysAgo: 13,
    replies: [
      { by: 'ingrid', after: 8, body: 'on the boardwalk, at the very end of a walk. never at the start. you have to earn it.' },
      { by: 'clemence', after: 30, body: 'he’s from a small town an hour from here and makes music for the whole world. as a translator i find this very moving.' },
      { by: 'dmitri', after: 90, body: 'loud. the answer is loud.' },
    ],
  },
  {
    artistOf: 'deftones-be-quiet',
    by: 'arjun',
    title: 'did everyone’s old band cover be quiet and drive?',
    body: 'asking for closure.',
    daysAgo: 16,
    replies: [
      { by: 'callum', after: 5, body: 'every band has. it’s a rite. ours was in a garage in scarborough and the garage won.' },
      { by: 'hana', after: 12, body: 'we slowed it down by half and called it shoegaze. nobody stopped us.' },
      { by: 'dmitri', after: 100, body: 'i play the original at the volume it deserves. ask my building.' },
    ],
  },
  {
    artistOf: 'death-grips-get-got',
    by: 'dmitri',
    title: 'is there anyone else in richmond hill. hello',
    body: 'i assume i’m alone up here. prove me wrong.',
    daysAgo: 6,
    replies: [
      { by: 'jamal', after: 10, body: 'brampton here. not richmond hill, but i got banned from a barbecue for this band, so i feel like family.' },
      { by: 'arjun', after: 40, body: 'markham. close enough. we could hear you from here anyway.' },
      { by: 'dmitri', inMinutes: 50, body: 'two people. it’s a scene.' },
    ],
  },
  {
    artistOf: 'sade-no-ordinary-love',
    by: 'andre',
    title: 'the “works at a wedding and a wake” test',
    body: 'name another artist who passes. i’ll wait.',
    daysAgo: 14,
    replies: [
      { by: 'amara', after: 1, body: 'nobody. thread closed. (don’t close it.)' },
      { by: 'dez', after: 20, body: 'bill withers passes. i’ve played both rooms.' },
      { by: 'kwame', after: 75, body: 'fela passes, if the wake is long enough.' },
    ],
  },
  {
    artistOf: 'kaytranada-10-percent',
    by: 'mateo',
    title: 'barbershop consensus: best one to cut to',
    body: 'the chair needs a tempo.',
    daysAgo: 9,
    replies: [
      { by: 'andre', after: 3, trackId: 'kaytranada-10-percent', body: '10%. keeps the hand steady.' },
      { by: 'sol', after: 25, body: 'anything of his at brunch volume. i’ve done the research.' },
      { by: 'malik', after: 110, body: 'my dad asked “who’s this?” in the good way. so, that one.' },
    ],
  },
];
