# earshot

Find out what everyone around you has on.

earshot is a social music app for iPhone and Android. Open it anywhere and see what the people nearby are playing. If you like someone's taste, you say hello by sending them a song. There is no "hey" button. We looked.

It is one codebase, built with Expo (React Native) and TypeScript, with a Supabase backend.

## What it does

- **Nearby.** A feed of song cards from people in the same rough area as you, live while you have sharing on.
- **Songs as hellos.** Send someone a song. If they accept, a chat opens. If they decline, nothing happens and nobody is told. Rejection, but make it painless.
- **Rooms.** Everyone gets a profile they can decorate like a bedroom wall: three songs that explain them, a pinned record, a guestbook, stickers, and eighteen looks ranging from tasteful to regrettable.
- **City.** A notice board for your home city, with what people are posting and which artists the place won't shut up about.
- **Artist rooms.** Local discussion threads per artist, for finding the other four people in town who think that album is underrated.
- **Your song sets itself.** Link Spotify, or Last.fm for everyone Spotify won't let in, and earshot keeps up with what you're playing.

## The privacy part, with no jokes in it

- earshot shows that someone is nearby. It never shows where they are. There are no maps, no distances and no pins.
- Location is only requested when you first turn sharing on, after a plain explanation.
- Your phone turns its location into a neighbourhood name, and only that name is sent to the server. Exact coordinates are never sent, stored or shown.
- If you decline location, you can pick a spot from a list instead.
- Turning sharing off removes you from other people's screens immediately.
- You can block or report anyone, report a single message, post or reply, delete a chat from your side, and delete your account and everything attached to it from inside the app.
- There are no ads, trackers or analytics.

The full version lives in the app under You, then "privacy", and in [src/legal/privacy.json](src/legal/privacy.json).

## Running it

You need Node and the Expo Go app on your phone.

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npx expo start --go
```

Scan the QR code with your phone and you're in.

With an empty `.env`, earshot runs entirely on the phone, with a cast of fictional Toronto residents to keep you company. They have strong opinions and no passwords. Fill in the Supabase values and it becomes a real app with real people, who are less predictable.

### Settings

Everything goes in `.env`. All of these are public values that ship inside the app, so nothing secret belongs in this file.

| Setting                                | What it is                                      | If you leave it empty           |
| -------------------------------------- | ----------------------------------------------- | ------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`             | Your Supabase project address                   | Everything stays on the phone   |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key                   | Everything stays on the phone   |
| `EXPO_PUBLIC_SPOTIFY_CLIENT_ID`        | Client ID from the Spotify developer dashboard  | Spotify linking is off          |
| `EXPO_PUBLIC_LASTFM_API_KEY`           | Last.fm key, only for running without a backend | Last.fm goes through the server |
| `EXPO_PUBLIC_SUPPORT_EMAIL`            | The address shown on the help and privacy pages | The pages say it isn't set      |

Never put a Supabase secret key, the database password, the Spotify client secret or the Last.fm shared secret in `.env`, the code or anywhere near this repository.

## Setting up the backend

1. Create a Supabase project and copy its URL and publishable key into `.env`.
2. In the SQL editor, run [supabase/schema.sql](supabase/schema.sql). It builds the database and is safe to run again.
3. While you are building, you can also run [supabase/seed.sql](supabase/seed.sql), which moves the fictional residents in so the app isn't empty. Don't run it on a project real people use. If you already have, [supabase/remove-residents.sql](supabase/remove-residents.sql) moves them out again, for good.
4. Under Authentication, turn on the sign-in methods you want: email, Google, Apple.
5. Add `earshot://**` to the allowed redirect URLs.
6. For Last.fm, save your key as an Edge Function secret called `LASTFM_API_KEY` and deploy [supabase/functions/lastfm](supabase/functions/lastfm/index.ts). The key stays on the server and never reaches a phone.

Whenever `schema.sql` changes, run it again. It upgrades in place.

### How the backend is put together

All data lives in a private database schema that the outside world cannot reach. The app talks to it only through a set of functions, and each function works out who is calling and what they are allowed to do. Live updates arrive as tiny notices that say only what kind of thing changed, never the content.

## Where things live

| Folder                      | What's in it                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `src/app`                   | Every screen. One file per screen.                                                           |
| `src/ui`                    | The printed-matter kit: cards, tape, stamps, sleeves, poster buttons.                        |
| `src/theme`                 | One ink, one paper, a tomato red and a highlighter. Four fonts.                              |
| `src/data`                  | The one door screens use to reach data, with a phone version and a server version behind it. |
| `src/backend`               | Sign-in and the connection to Supabase.                                                      |
| `src/spotify`, `src/lastfm` | The two ways your song sets itself.                                                          |
| `src/music`                 | Song search and 30-second previews, by way of iTunes.                                        |
| `src/seed`, `src/sim`       | The residents, and the simulation that makes them wander about.                              |
| `src/legal`                 | The privacy and help pages, as plain text.                                                   |
| `supabase`                  | The database, the Last.fm go-between, and the server tests.                                  |
| `scripts`                   | Odd jobs: seed data, icons, the web versions of the legal pages.                             |

## Checking your work

```bash
npm test
```

That runs the app tests and the server tests. The server tests spin up a real Postgres in memory and run the same SQL that goes into Supabase, so they take a minute. Make tea.

```bash
npm run typecheck
```

```bash
npm run lint
```

## Building it for other people

Builds are made with EAS. The `preview` profile produces an Android file you can send to friends, and `production` is for the stores.

```bash
npx eas-cli@latest env:push --environment preview --environment production --path .env
```

```bash
npx eas-cli@latest build --platform android --profile preview
```

iPhone builds need an Apple Developer membership. The stores also want public links to a privacy page and a support page:

```bash
npm run legal
```

This writes both into `site/`, ready to host anywhere.

## The look

earshot is meant to feel like a zine, a gig poster and the staff-picks shelf of a record shop. Everything is printed in one blue ink on warm paper, slightly crooked, held up with tape. It is deliberately not a dark-mode streaming app. If a screen starts looking glossy, something has gone wrong.

## What's still rough

- Reports land in a database table. Reading them means opening Supabase.
- There are no push notifications, so you only find out about a new song when the app is open.
- With the residents moved out, a new city is empty until real people turn up. That part is on you.
- Spotify only works for accounts added by hand in its developer dashboard, which is why Last.fm exists.
- Sign in with Apple is iPhone and iPad only.
