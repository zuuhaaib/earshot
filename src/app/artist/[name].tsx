/**
 * An artist's local room: "Big Thief · Toronto". Threads that stay open for
 * days or weeks, the people around here who play them, and their records.
 * The GTA view rolls every city's threads up so small artists still have company.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLive, usePulse, useSession, type ThreadSummary } from '@/data';
import { cities, REGION } from '@/data/areas';
import { colors, tilt } from '@/theme';
import { BackLink } from '@/ui/Field';
import { Card, Heading, InkLink, Paper, PinBadge, PosterButton, Stamp, Tape, Txt } from '@/ui/print';
import { Sleeve } from '@/ui/Sleeve';
import { ago } from '@/ui/SongPicker';

/** Three ways to break the silence. Tapping one starts a thread with that title. */
const STARTERS = [
  'Best live recording?',
  'What song would you play for someone who’s never heard them?',
  'Anyone going to a show?',
];

function ThreadCard({ thread, showCity }: { thread: ThreadSummary; showCity: boolean }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/thread/[id]', params: { id: thread.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${thread.title}. ${thread.replies} replies.`}
    >
      <Card rotate={tilt(thread.id + 'th', 0.9)} shadow={4} innerStyle={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Txt variant="title" style={{ flex: 1, fontSize: 18, lineHeight: 23 }}>
            {thread.title}
          </Txt>
          <Stamp rotate={3}>{thread.replies === 1 ? '1 reply' : `${thread.replies} replies`}</Stamp>
        </View>
        <Txt variant="meta" tone="soft" style={{ marginTop: 6 }}>
          {thread.starter.name.split(' ')[0]} started it {ago(thread.startedAt)}
          {showCity ? ` · ${thread.city}` : ''}
        </Txt>
        {thread.last ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 }}>
            <PinBadge label={thread.last.person.badge} color={thread.last.person.badgeColor} size={26} />
            <Txt variant="small" tone="soft" numberOfLines={2} style={{ flex: 1 }}>
              {thread.last.text}
            </Txt>
          </View>
        ) : (
          <Txt variant="bodyItalic" tone="soft" style={{ marginTop: 8 }}>
            No replies yet. It’s been {ago(thread.startedAt).replace(' ago', '')}. Somebody be kind.
          </Txt>
        )}
        <Txt variant="meta" tone="soft" style={{ marginTop: 8 }}>
          last word {ago(thread.lastAt)}
        </Txt>
      </Card>
    </Pressable>
  );
}

export default function ArtistRoom() {
  const insets = useSafeAreaInsets();
  const { name, scope: asked } = useLocalSearchParams<{ name: string; scope?: string }>();
  const { data: session } = useSession();
  const home = session?.me?.homeCity ?? cities[0];
  const [picked, setPicked] = useState<string | null>(null);
  const scope = picked ?? asked ?? home;

  const { data } = useLive((a) => a.getArtistSpace(name, scope), ['artist', 'city', 'nearby'], [name, scope]);
  usePulse(30_000);

  const space = data?.scope === scope ? data : null;
  const artist = space?.artist ?? name;
  // Home first, then the whole region, then wherever you came from if that's somewhere else.
  const scopes = [...new Set([home, REGION, ...(asked && asked !== home && asked !== REGION ? [asked] : [])])];
  const place = scope === REGION ? 'the GTA' : scope;

  const start = (title?: string) => router.push({ pathname: '/new-thread', params: { artist, ...(title ? { title } : {}) } });

  return (
    <Paper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
          width: '100%',
          maxWidth: 560,
          alignSelf: 'center',
        }}
      >
        <BackLink />

        <Txt variant="label" tone="soft" style={{ marginTop: 16 }}>
          The back room for
        </Txt>
        <Txt variant="poster" accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit style={{ fontSize: 34, lineHeight: 38 }}>
          {artist}
        </Txt>
        <View style={{ alignSelf: 'flex-start', marginTop: 6 }}>
          <View style={{ position: 'absolute', left: -4, right: -6, bottom: 1, height: 12, backgroundColor: colors.highlighter }} />
          <Txt variant="titleSm">in {place}</Txt>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {scopes.map((s) => {
            const on = s === scope;
            return (
              <Pressable
                key={s}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setPicked(s);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{
                  borderWidth: 2,
                  borderColor: colors.ink,
                  backgroundColor: on ? colors.highlighter : colors.card,
                  borderRadius: 3,
                  paddingHorizontal: 12,
                  minHeight: 40,
                  justifyContent: 'center',
                }}
              >
                <Txt variant="titleSm">{s === REGION ? 'All of the GTA' : s === home ? `${s} (home)` : s}</Txt>
              </Pressable>
            );
          })}
        </View>
        <Txt variant="small" tone="soft" style={{ marginTop: 10 }}>
          {scope === REGION
            ? 'Every city’s threads in one room. Handy when your city only has three fans and one of them is you.'
            : `Threads started by people who call ${scope} home. Anyone can read and reply.`}
        </Txt>

        {/* their records, for a quick listen */}
        {space?.tracks.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginTop: 20 }} contentContainerStyle={{ paddingHorizontal: 22, gap: 16, paddingBottom: 8 }}>
            {space.tracks.map((t) => (
              <View key={t.id} style={{ width: 92 }}>
                <Sleeve track={t} size={92} record={false} />
                <Txt variant="meta" numberOfLines={2} style={{ marginTop: 8, fontSize: 11, lineHeight: 14 }}>
                  {t.title}
                </Txt>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {/* who else is here */}
        {space ? (
          <View style={{ marginTop: 22 }}>
            <Heading>{space.listeners.length ? `who’s got them on in ${place}` : `nobody in ${place}, yet`}</Heading>
            {space.listeners.length ? (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {space.listeners.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => router.push({ pathname: '/room/[id]', params: { id: p.id } })}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${p.name}'s room`}
                      hitSlop={4}
                    >
                      <PinBadge label={p.badge} color={p.badgeColor} size={42} rotate={tilt(p.id, 9)} />
                    </Pressable>
                  ))}
                </View>
                <Txt variant="small" tone="soft" style={{ marginTop: 10 }}>
                  {space.listeners.length === 1 ? 'One person' : `${space.listeners.length} people`} here played or posted them in the
                  last month. Tap a badge to see their room. It shows who, never where.
                </Txt>
              </>
            ) : (
              <Txt variant="body" tone="soft">
                Nobody here has shared a play or posted them in the last month. You could be the first, which is either lonely or
                visionary.
              </Txt>
            )}
          </View>
        ) : null}

        {/* the threads */}
        <View style={{ marginTop: 30 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
            <Heading style={{ marginBottom: 0 }}>threads</Heading>
            <PosterButton label="start one" small onPress={() => start()} />
          </View>
          <Txt variant="small" tone="soft" style={{ marginTop: 10, marginBottom: 14 }}>
            Threads don’t close. Reply to one from last month if you’ve got something; nobody minds.
          </Txt>

          {!space ? (
            <Txt variant="hand" tone="soft" center style={{ marginTop: 10, fontSize: 24, lineHeight: 26 }}>
              finding the back room…
            </Txt>
          ) : space.threads.length ? (
            <View style={{ gap: 16 }}>
              {space.threads.map((t) => (
                <ThreadCard key={t.id} thread={t} showCity={scope === REGION} />
              ))}
            </View>
          ) : (
            <View>
              <Card rotate={-0.8} innerStyle={{ padding: 16 }}>
                <Txt variant="title">Quiet in here.</Txt>
                <Txt variant="body" tone="soft" style={{ marginTop: 6 }}>
                  {space.elsewhere
                    ? `Nobody in ${scope} has started a thread about ${artist}, but the rest of the GTA has ${space.elsewhere === 1 ? 'one' : space.elsewhere} going.`
                    : `Nobody around here has started a thread about ${artist} yet. Every room starts with one person talking to themselves.`}
                </Txt>
                {space.elsewhere ? (
                  <PosterButton label="see the GTA room" kind="plain" small onPress={() => setPicked(REGION)} style={{ alignSelf: 'flex-start', marginTop: 12 }} />
                ) : null}
              </Card>
              <Tape rotate={-4} width={60} style={{ top: -9, left: '40%' }} />
              <Txt variant="label" tone="soft" style={{ marginTop: 20, marginBottom: 8 }}>
                Or break the silence with one of these
              </Txt>
              <View style={{ gap: 10, alignItems: 'flex-start' }}>
                {STARTERS.map((s) => (
                  <InkLink key={s} label={s} onPress={() => start(s)} />
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </Paper>
  );
}
