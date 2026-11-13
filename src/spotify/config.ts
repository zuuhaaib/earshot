/**
 * Spotify settings. The Client ID comes from the .env file (see .env.example):
 * copy it from your app's page at developer.spotify.com/dashboard.
 *
 * A Client ID is public (it ships inside every app that uses it). The Client
 * SECRET is not: never put it in .env or anywhere in the app. earshot uses the
 * PKCE sign-in flow, which doesn't need one.
 */
export const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';

/** Read what's playing, and nothing else. No playlists, no library, no playback control. */
export const SPOTIFY_SCOPES = ['user-read-currently-playing'];

export const spotifyConfigured = () => SPOTIFY_CLIENT_ID.trim().length > 0;

export const SPOTIFY = {
  authorize: 'https://accounts.spotify.com/authorize',
  token: 'https://accounts.spotify.com/api/token',
  nowPlaying: 'https://api.spotify.com/v1/me/player/currently-playing',
  me: 'https://api.spotify.com/v1/me',
};
