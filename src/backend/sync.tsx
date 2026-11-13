/**
 * Keeps the phone and the backend agreeing about who is logged in, and sends
 * profile edits up to the backend.
 */
import { useEffect } from 'react';
import type { EarshotApi } from '@/data';
import { currentAccount, onLoggedOut, saveProfile } from './accounts';
import { cloudConfigured, isCloudId } from './config';

/**
 * Mount once inside the data provider.
 * - Logged in to the backend but nobody's signed in on the phone (a reinstall,
 *   say): sign the phone in as that account.
 * - The backend session has ended but the phone still thinks it's that
 *   account: sign the phone out too.
 */
export function useCloudSessionSync(api: EarshotApi) {
  useEffect(() => {
    if (!cloudConfigured()) return;
    let alive = true;

    (async () => {
      const [account, session] = await Promise.all([currentAccount().catch(() => undefined), api.getSession()]);
      if (!alive || account === undefined) return; // couldn't reach the backend: leave things as they are
      if (account && !session.me) await api.adoptAccount(account);
      else if (!account && session.me && isCloudId(session.me.id)) await api.signOut();
    })().catch(() => {});

    const stop = onLoggedOut(() => {
      api
        .getSession()
        .then((s) => (s.me && isCloudId(s.me.id) ? api.signOut() : undefined))
        .catch(() => {});
    });
    return () => {
      alive = false;
      stop();
    };
  }, [api]);
}

/** After a profile edit on the phone, send it to the backend too. Best effort: the phone's copy is already saved. */
export async function pushProfile(api: EarshotApi): Promise<void> {
  if (!cloudConfigured()) return;
  const { me } = await api.getSession();
  if (!me || !isCloudId(me.id)) return;
  await saveProfile({
    id: me.id,
    name: me.name,
    badge: me.badge,
    badgeColor: me.badgeColor,
    tagline: me.tagline,
    bio: me.bio,
    homeCity: me.homeCity,
  }).catch(() => {});
}
