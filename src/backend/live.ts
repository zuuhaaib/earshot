/**
 * Being told the moment something changes, over Supabase Realtime.
 *
 * The server sends a notice that says only what kind of thing changed (see
 * "change notices" in supabase/schema.sql). No song, message, name or place
 * travels this way: on hearing one, the app asks for the new data the normal
 * way. If the connection drops, the app's slow polling still catches up.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Listen } from '@/data/cloud/CloudApi';
import { backendClient } from './accounts';

export const listenToServer: Listen = (topics, onNotice, onState) => {
  const sb = backendClient();
  const channels: RealtimeChannel[] = [];
  const joined = new Set<string>();
  const joinedBefore = new Set<string>();
  let stopped = false;

  (async () => {
    // Private channels are checked against who's logged in, so hand Realtime the login first.
    await sb.realtime.setAuth().catch(() => {});
    if (stopped) return;
    for (const topic of topics) {
      channels.push(
        sb
          .channel(topic, { config: { private: true } })
          .on('broadcast', { event: 'changed' }, (message) => {
            const what = (message.payload as { what?: unknown } | undefined)?.what;
            onNotice(typeof what === 'string' ? what : 'all');
          })
          .subscribe((status) => {
            if (stopped) return;
            if (status === 'SUBSCRIBED') {
              joined.add(topic);
              if (joinedBefore.has(topic)) onNotice('all'); // back after a gap
              joinedBefore.add(topic);
            } else {
              joined.delete(topic);
            }
            onState(joined.size === topics.length);
          }),
      );
    }
  })();

  return () => {
    stopped = true;
    onState(false);
    for (const channel of channels) sb.removeChannel(channel).catch(() => {});
  };
};
