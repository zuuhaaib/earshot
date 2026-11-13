/**
 * The only door the screens use to reach data: `useApi()` for doing things,
 * `useLive()` for showing things that stay current.
 *
 * To move earshot onto a real backend, build something else that implements
 * `EarshotApi` and hand it to the provider here. Nothing in src/app changes.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors } from '@/theme';
import { Card, Paper, PosterButton, Txt } from '@/ui/print';
import type { EarshotApi, Topic } from './api';
import { callServer, isLoggedIn, logOut as logOutOfBackend, serverIsSetUp } from '@/backend/accounts';
import { cloudConfigured } from '@/backend/config';
import { listenToServer } from '@/backend/live';
import { CloudApi } from './cloud/CloudApi';
import { openExpoDriver } from './local/expoDriver';
import { expoSecurity } from './local/expoSecurity';
import { LocalApi } from './local/LocalApi';

export type { EarshotApi, Topic } from './api';
export * from './types';

// One connection for the life of the app. Kept on globalThis so a hot reload
// during development reuses it instead of opening the database a second time.
const shared = globalThis as { __earshotApi?: Promise<EarshotApi> };

const sharedPhone = globalThis as { __earshotPhone?: Promise<LocalApi> };

/** The database on this phone. Used for everything when there's no backend, and to import an old account when there is. */
export function openPhone(): Promise<LocalApi> {
  sharedPhone.__earshotPhone ??= (async () => {
    const api = new LocalApi(await openExpoDriver(), Date.now, Math.random, expoSecurity);
    await api.init();
    return api;
  })().catch((e) => {
    sharedPhone.__earshotPhone = undefined;
    throw e;
  });
  return sharedPhone.__earshotPhone;
}

function openLocal(): Promise<EarshotApi> {
  shared.__earshotApi ??= (async () => {
    // With the backend configured and its database set up, everything lives there.
    // If only the first accounts script has been run, data stays on the phone as before.
    if (cloudConfigured() && (await serverIsSetUp())) return new CloudApi(callServer, logOutOfBackend, isLoggedIn, listenToServer);
    return openPhone();
  })().catch((e) => {
    shared.__earshotApi = undefined; // let "try again" really try again
    throw e;
  });
  return shared.__earshotApi;
}

const ApiContext = createContext<EarshotApi | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [api, setApi] = useState<EarshotApi | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    openLocal().then(
      (a) => alive && setApi(a),
      (e) => alive && setError(e instanceof Error ? e : new Error(String(e))),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (api) return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;

  return (
    <Paper>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        {error ? (
          <Card rotate={-1} innerStyle={{ padding: 20 }}>
            <Txt variant="title">The record skipped.</Txt>
            <Txt variant="body" tone="soft" style={{ marginTop: 8 }}>
              earshot couldn’t open its storage on this phone, so there’s nothing to show yet. Trying again usually does it.
            </Txt>
            <Txt variant="meta" tone="soft" style={{ marginTop: 10 }}>
              {error.message}
            </Txt>
            <PosterButton label="try again" onPress={() => {
                setError(null);
                setAttempt((n) => n + 1);
              }} style={{ marginTop: 16, alignSelf: 'flex-start' }} />
          </Card>
        ) : (
          <>
            <Txt variant="wordmark">earshot</Txt>
            <Txt variant="hand" color={colors.inkSoft} style={{ marginTop: 6 }}>
              dropping the needle…
            </Txt>
          </>
        )}
      </View>
    </Paper>
  );
}

export function useApi(): EarshotApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside <DataProvider>');
  return api;
}

type Live<T> = { data: T | undefined; error: Error | null; loading: boolean; reload: () => void };

/**
 * Load something and keep it current: reloads whenever one of `topics`
 * changes, or when `deps` do.
 */
export function useLive<T>(load: (api: EarshotApi) => Promise<T>, topics: Topic[], deps: unknown[] = []): Live<T> {
  const api = useApi();
  const [state, setState] = useState<Omit<Live<T>, 'reload'>>({ data: undefined, error: null, loading: true });
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });
  const seq = useRef(0);
  const alive = useRef(true);

  const run = useCallback(() => {
    const n = ++seq.current;
    loader.current(api).then(
      (data) => {
        if (alive.current && n === seq.current) setState({ data, error: null, loading: false });
      },
      (e) => {
        if (alive.current && n === seq.current)
          setState((s) => ({ ...s, error: e instanceof Error ? e : new Error(String(e)), loading: false }));
      },
    );
  }, [api]);

  const topicKey = topics.join(',');
  useEffect(() => {
    alive.current = true;
    run();
    const stops = topicKey ? topicKey.split(',').map((t) => api.subscribe(t as Topic, run)) : [];
    return () => {
      alive.current = false;
      stops.forEach((stop) => stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, run, topicKey, ...deps]);

  return { ...state, reload: run };
}

/** Who's signed in, whether they're on air, and roughly where the phone is. */
export const useSession = () => useLive((api) => api.getSession(), ['session']);

/**
 * While the screen using this is in front, ask for anything new every `ms`.
 * (Locally this is what lets residents' songs and replies arrive.)
 */
export function usePulse(ms: number) {
  const api = useApi();
  useFocusEffect(
    useCallback(() => {
      const beat = () => {
        api.refreshNearby().catch(() => {});
      };
      beat();
      const timer = setInterval(beat, ms);
      return () => clearInterval(timer);
    }, [api, ms]),
  );
}
