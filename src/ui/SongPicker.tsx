/**
 * Finding a song: a search box over the music source, with a short list to
 * fall back on when you can't think of anything. Used for "what have you got
 * on?" and for choosing a song to send someone.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { music, stopPreview, type Track } from '@/music';
import { Field, TrackRow } from './Field';
import { Paper, Txt } from './print';
import { DashedRule } from './SongCard';

/** A few seeded tracks to grab when you can't think of anything. */
export const COUNTER = ['alvvays-archie', 'bbng-time-moves-slow', 'talking-heads-this-must-be', 'sade-no-ordinary-love', 'pup-kids', 'crj-run-away-with-me'];

type Search ={ state: 'idle' } | { state: 'searching' } | { state: 'done'; results: Track[] } | { state: 'failed' };

/** Search-as-you-type against the music source, a beat after you stop, dropping stale answers. */
export function useSongSearch() {
  const [query, setText] = useState('');
  const [search, setSearch] = useState<Search>({ state: 'idle' });
  const attempt = useRef(0);

  const setQuery = useCallback((text: string) => {
    setText(text);
    setSearch(text.trim().length < 2 ? { state: 'idle' } : { state: 'searching' });
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const mine = ++attempt.current;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      music.search(q, { limit: 25, signal: abort.signal }).then(
        (results) => mine === attempt.current && setSearch({ state: 'done', results }),
        () => mine === attempt.current && !abort.signal.aborted && setSearch({ state: 'failed' }),
      );
    }, 350);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query]);

  return { query, setQuery, search };
}

export function SongPicker({
  picker,
  header,
  idleTracks,
  idleLabel,
  onPick,
}: {
  picker: ReturnType<typeof useSongSearch>;
  /** Everything above the search box. */
  header: React.ReactNode;
  /** What to list before anything's been typed. */
  idleTracks: Track[];
  idleLabel: string;
  onPick: (track: Track) => void;
}) {
  const insets = useSafeAreaInsets();
  const { query, setQuery, search } = picker;
  const rows = search.state === 'done' ? search.results : search.state === 'idle' ? idleTracks : [];

  return (
    <Paper>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlatList
          data={rows}
          keyExtractor={(t) => t.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            width: '100%',
            maxWidth: 560,
            alignSelf: 'center',
            paddingTop: insets.top + 14,
            paddingBottom: insets.bottom + 28,
          }}
          ItemSeparatorComponent={DashedRule}
          renderItem={({ item }) => (
            <TrackRow
              track={item}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                stopPreview();
                onPick(item);
              }}
            />
          )}
          ListHeaderComponent={
            <View style={{ marginBottom: 10 }}>
              {header}
              <Field
                value={query}
                onChangeText={setQuery}
                placeholder="Song, artist, or both"
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
                accessibilityLabel="Search for a song"
              />
              <Txt variant="label" tone="soft" style={{ marginTop: 18 }}>
                {search.state === 'idle' ? idleLabel : search.state === 'done' && search.results.length ? 'Tap a title to choose' : ''}
              </Txt>
            </View>
          }
          ListEmptyComponent={
            <View style={{ paddingVertical: 20 }}>
              {search.state === 'searching' ? (
                <Txt variant="hand" tone="soft" center>
                  flipping through the racks…
                </Txt>
              ) : search.state === 'failed' ? (
                <>
                  <Txt variant="titleSm">The record shop isn’t picking up.</Txt>
                  <Txt variant="body" tone="soft" style={{ marginTop: 4 }}>
                    Search needs the internet and couldn’t reach it. Check your connection, then type again.
                  </Txt>
                </>
              ) : search.state === 'done' ? (
                <>
                  <Txt variant="titleSm">Nothing by that name.</Txt>
                  <Txt variant="body" tone="soft" style={{ marginTop: 4 }}>
                    Either it doesn’t exist or it’s spelled the way a drummer would spell it. Try fewer words.
                  </Txt>
                </>
              ) : null}
            </View>
          }
        />
      </KeyboardAvoidingView>
    </Paper>
  );
}

/** A relative time, the way you'd say it out loud. */
export function ago(at: number, now = Date.now()) {
  const m = Math.max(0, Math.round((now - at) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
