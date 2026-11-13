/**
 * Last.fm settings.
 *
 * With the backend in use, the app never holds a Last.fm key: it asks earshot's
 * own server function (supabase/functions/lastfm), which keeps the key as a
 * server secret and asks Last.fm on the app's behalf.
 *
 * EXPO_PUBLIC_LASTFM_API_KEY is only for running with no backend at all, or
 * until that function has been deployed. Anything named EXPO_PUBLIC_ ships
 * inside the app, so leave it empty once the function is live. Last.fm's
 * "shared secret" is never needed anywhere.
 */
import { cloudConfigured } from '@/backend/config';

export const LASTFM_API_KEY = process.env.EXPO_PUBLIC_LASTFM_API_KEY ?? '';

/** Whether there is any way to reach Last.fm: through the server, or with a key in the app. */
export const lastfmConfigured = () => cloudConfigured() || LASTFM_API_KEY.trim().length > 0;

export const LASTFM_API = 'https://ws.audioscrobbler.com/2.0/';
/** The name of the server function that does the asking. */
export const LASTFM_FUNCTION = 'lastfm';
