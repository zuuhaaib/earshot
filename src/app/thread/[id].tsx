/** One thread in an artist's local room. It stays open; reply whenever. */
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi, useLive, usePulse, useSession, type Person, type ThreadReply } from '@/data';
import { hitLimit } from '@/data/api';
import { stopPreview, type Track } from '@/music';
import { colors, fonts, tilt } from '@/theme';
import { BackLink } from '@/ui/Field';
import { Card, InkLink, Paper, PinBadge, PosterButton, Stamp, Txt } from '@/ui/print';
import { chooseSong } from '@/ui/roomDraft';
import { Sleeve } from '@/ui/Sleeve';
import { useSlip } from '@/ui/Slip';
import { DashedRule } from '@/ui/SongCard';
import { ago } from '@/ui/SongPicker';

const openRoom = (id: string) => router.push({ pathname: '/room/[id]', params: { id } });

/** A quiet "report" link under something someone else wrote. */
function ReportLink({ personId, kind, id }: { personId: string; kind: 'thread' | 'reply'; id: string }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/safety/[id]', params: { id: personId, kind, cid: id } })}
      accessibilityRole="link"
      accessibilityLabel={kind === 'reply' ? 'Report this reply' : 'Report this thread'}
      hitSlop={12}
      style={{ alignSelf: 'flex-start', marginTop: 10 }}
    >
      <Txt variant="meta" tone="faint" style={{ textDecorationLine: 'underline' }}>
        report
      </Txt>
    </Pressable>
  );
}

function Byline({ person, when, city, threadCity }: { person: Person; when: number; city?: boolean; threadCity: string }) {
  return (
    <Pressable
      onPress={() => openRoom(person.id)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${person.name}'s room`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
    >
      <PinBadge label={person.badge} color={person.badgeColor} size={32} rotate={tilt(person.id, 9)} />
      <View style={{ flex: 1 }}>
        <Txt variant="titleSm" numberOfLines={1}>
          {person.name}
        </Txt>
        <Txt variant="meta" tone="soft" numberOfLines={1}>
          {ago(when)}
          {/* say so when someone's dropped in from another city */}
          {city && person.homeCity !== threadCity ? ` · visiting from ${person.homeCity}` : ''}
        </Txt>
      </View>
    </Pressable>
  );
}

const Reply = React.memo(function Reply({ reply, threadCity, meId }: { reply: ThreadReply; threadCity: string; meId: string }) {
  return (
    <View style={{ paddingVertical: 14 }}>
      <Byline person={reply.person} when={reply.at} city threadCity={threadCity} />
      {reply.body ? (
        <Txt variant="body" style={{ marginTop: 8 }}>
          {reply.body}
        </Txt>
      ) : null}
      {reply.track ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12, paddingLeft: 8 }}>
          <Sleeve track={reply.track} size={54} record={false} />
          <View style={{ flex: 1 }}>
            <Txt variant="titleSm" numberOfLines={2}>
              {reply.track.title}
            </Txt>
            <Txt variant="meta" tone="soft" numberOfLines={1}>
              {reply.track.artist}
            </Txt>
          </View>
        </View>
      ) : null}
      {reply.person.id === meId ? null : <ReportLink personId={reply.person.id} kind="reply" id={reply.id} />}
    </View>
  );
});

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const api = useApi();
  const slip = useSlip();
  const { data: session } = useSession();
  const { data: thread, loading } = useLive((a) => a.getThread(id), ['artist', 'session'], [id]);
  usePulse(20_000);

  const [draft, setDraft] = useState('');
  const [attached, setAttached] = useState<Track | null>(null);
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList<ThreadReply>>(null);

  useEffect(() => () => stopPreview(), []);

  if (loading || !session?.me) return <Paper />;
  const meId = session.me.id;

  if (!thread) {
    return (
      <Paper>
        <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 20 }}>
          <BackLink />
          <Card rotate={-1} style={{ marginTop: 24 }} innerStyle={{ padding: 18 }}>
            <Txt variant="title">That thread’s gone.</Txt>
            <Txt variant="body" tone="soft" style={{ marginTop: 6 }}>
              It may have been taken down, or the link was wrong. The room it was in is still there.
            </Txt>
          </Card>
        </View>
      </Paper>
    );
  }

  const send = async () => {
    const text = draft.trim();
    if ((!text && !attached) || sending) return;
    setSending(true);
    try {
      await api.replyToThread(thread.id, text, attached);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setDraft('');
      setAttached(null);
      setTimeout(() => list.current?.scrollToEnd({ animated: true }), 250);
    } catch (e) {
      slip(hitLimit(e) ? 'You’ve replied a lot today, and that’s the most for one day. Your reply is still in the box for tomorrow.' : 'That didn’t post. Your reply is still in the box.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Paper>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={{ flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          <FlatList
            ref={list}
            data={thread.replies}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => <Reply reply={item} threadCity={thread.city} meId={meId} />}
            ItemSeparatorComponent={DashedRule}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 20 }}
            ListHeaderComponent={
              <View style={{ marginBottom: 6 }}>
                <BackLink />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
                  <InkLink
                    label={`${thread.artist} · ${thread.city}`}
                    onPress={() => router.push({ pathname: '/artist/[name]', params: { name: thread.artist, scope: thread.city } })}
                  />
                </View>
                <Card rotate={-0.6} style={{ marginTop: 16 }} innerStyle={{ padding: 16 }}>
                  <Txt variant="title" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 27 }}>
                    {thread.title}
                  </Txt>
                  {thread.body ? (
                    <Txt variant="body" style={{ marginTop: 8 }}>
                      {thread.body}
                    </Txt>
                  ) : null}
                  <View style={{ marginTop: 14 }}>
                    <Byline person={thread.starter} when={thread.startedAt} threadCity={thread.city} />
                  </View>
                  {thread.starter.id === meId ? null : <ReportLink personId={thread.starter.id} kind="thread" id={thread.id} />}
                </Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 }}>
                  <Stamp rotate={-2}>{thread.replies.length === 1 ? '1 reply' : `${thread.replies.length} replies`}</Stamp>
                  <Txt variant="meta" tone="soft">
                    still open
                  </Txt>
                </View>
              </View>
            }
            ListEmptyComponent={
              <Txt variant="hand" tone="soft" style={{ marginTop: 18, fontSize: 24, lineHeight: 26 }}>
                nobody’s answered yet. you could be the reason this thread exists.
              </Txt>
            }
          />

          {/* composer */}
          <View style={{ borderTopWidth: 2, borderTopColor: colors.ink, backgroundColor: colors.card, paddingHorizontal: 12, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 10) }}>
            {attached ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Sleeve track={attached} size={36} record={false} playable={false} />
                <Txt variant="small" numberOfLines={1} style={{ flex: 1 }}>
                  {attached.title} · {attached.artist}
                </Txt>
                <InkLink label="remove" onPress={() => setAttached(null)} />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <PosterButton
                label="+ song"
                kind="plain"
                small
                accessibilityLabel="Attach a song to your reply"
                onPress={async () => {
                  const t = await chooseSong('Which song?');
                  if (t) setAttached(t);
                }}
              />
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Add to the thread"
                placeholderTextColor={colors.inkFaint}
                selectionColor={colors.tomato}
                multiline
                maxLength={1000}
                accessibilityLabel="Your reply"
                style={{
                  flex: 1,
                  minHeight: 42,
                  maxHeight: 110,
                  borderWidth: 2,
                  borderColor: colors.ink,
                  borderRadius: 3,
                  backgroundColor: colors.paper,
                  paddingHorizontal: 10,
                  paddingTop: 9,
                  paddingBottom: 9,
                  fontFamily: fonts.serif,
                  fontSize: 16,
                  color: colors.ink,
                }}
              />
              <PosterButton label="reply" small disabled={(!draft.trim() && !attached) || sending} onPress={send} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Paper>
  );
}
