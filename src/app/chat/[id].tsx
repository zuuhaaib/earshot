/**
 * A chat. It exists because someone accepted a song, and that song is taped to
 * the top of the conversation for as long as the conversation exists.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi, useLive, usePulse, useSession, type Chat, type ChatMessage } from '@/data';
import { stopPreview } from '@/music';
import { colors, fonts, tilt } from '@/theme';
import { BackLink } from '@/ui/Field';
import { Card, Paper, PinBadge, PosterButton, Tape, Txt } from '@/ui/print';
import { Sleeve } from '@/ui/Sleeve';
import { useSlip } from '@/ui/Slip';

const clock = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();

/** The song that started it. Never scrolls away. */
function Pinned({ chat, meId }: { chat: Chat; meId: string }) {
  const { opener } = chat;
  const mine = opener.from.id === meId;
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 }}>
      <Card rotate={-0.7} shadow={4} fill={colors.card} innerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}>
        <Txt variant="label" tone="accent" style={{ marginBottom: 8 }}>
          The song that started this
        </Txt>
        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <Sleeve track={opener.track} size={60} />
          <View style={{ flex: 1 }}>
            <Txt variant="titleSm" numberOfLines={2}>
              {opener.track.title}
            </Txt>
            <Txt variant="meta" tone="soft" numberOfLines={1}>
              {opener.track.artist}
            </Txt>
            <Txt variant="meta" tone="soft" numberOfLines={1}>
              {mine ? 'you sent it' : `${opener.from.name.split(' ')[0]} sent it`}
            </Txt>
          </View>
        </View>
        {opener.note ? (
          <Txt variant="hand" numberOfLines={3} style={{ marginTop: 8, fontSize: 20, lineHeight: 21 }}>
            “{opener.note}”
          </Txt>
        ) : null}
      </Card>
      <Tape rotate={-4} width={62} style={{ top: 3, left: '42%' }} />
    </View>
  );
}

const Bubble = React.memo(function Bubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
      <View
        style={{
          maxWidth: '84%',
          backgroundColor: mine ? colors.highlighter : colors.card,
          borderWidth: 2,
          borderColor: colors.ink,
          borderRadius: 3,
          paddingHorizontal: 12,
          paddingVertical: 9,
          transform: [{ rotate: `${tilt(message.id + 'm', 0.9)}deg` }],
        }}
      >
        {message.track ? (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingLeft: 6, paddingBottom: message.body ? 8 : 4, paddingTop: 2 }}>
            <Sleeve track={message.track} size={52} record={false} />
            <View style={{ flexShrink: 1 }}>
              <Txt variant="titleSm" numberOfLines={2}>
                {message.track.title}
              </Txt>
              <Txt variant="meta" tone="soft" numberOfLines={1}>
                {message.track.artist}
              </Txt>
            </View>
          </View>
        ) : null}
        {message.body ? <Txt variant="body">{message.body}</Txt> : null}
      </View>
      <Txt variant="meta" tone="faint" style={{ marginTop: 3, fontSize: 10, lineHeight: 13 }}>
        {clock(message.sentAt)}
      </Txt>
    </View>
  );
});

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const api = useApi();
  const slip = useSlip();
  const { data: session } = useSession();
  const { data: chat, loading } = useLive((a) => a.getChat(id), ['inbox', 'session'], [id]);
  usePulse(5_000);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // Seeing it counts as reading it.
  const count = chat?.messages.length ?? -1;
  useEffect(() => {
    if (count >= 0) api.markChatRead(id).catch(() => {});
  }, [api, id, count]);
  useEffect(() => () => stopPreview(), []);

  // The list is drawn bottom-up, so newest first.
  const newestFirst = useMemo(() => (chat ? [...chat.messages].reverse() : []), [chat]);
  const meId = session?.me?.id;

  if (loading || !meId) return <Paper />;

  if (!chat) {
    return (
      <Paper>
        <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 20 }}>
          <BackLink />
          <Card rotate={-1} style={{ marginTop: 24 }} innerStyle={{ padding: 18 }}>
            <Txt variant="title">This isn’t your conversation.</Txt>
            <Txt variant="body" tone="soft" style={{ marginTop: 6 }}>
              Either it doesn’t exist or it belongs to two other people. If you just switched accounts, that’ll be why.
            </Txt>
          </Card>
        </View>
      </Paper>
    );
  }

  const first = chat.other.name.split(' ')[0];

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    try {
      await api.sendMessage(chat.id, text);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      setDraft(text); // give it back so nothing typed is lost
      slip('That didn’t send. Your message is still in the box.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Paper>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={{ flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          {/* who you're talking to */}
          <View
            style={{
              paddingTop: insets.top + 8,
              paddingHorizontal: 16,
              paddingBottom: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              borderBottomWidth: 2,
              borderBottomColor: colors.ink,
              backgroundColor: colors.card,
            }}
          >
            <BackLink label="inbox" onPress={() => (router.canGoBack() ? router.back() : router.replace('/inbox'))} />
            <Pressable
              onPress={() => router.push({ pathname: '/room/[id]', params: { id: chat.other.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Open ${chat.other.name}'s room`}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}
            >
              <Txt variant="titleSm" numberOfLines={1} style={{ flexShrink: 1 }}>
                {chat.other.name}
              </Txt>
              <PinBadge label={chat.other.badge} color={chat.other.badgeColor} size={34} rotate={tilt(chat.other.id, 9)} />
            </Pressable>
          </View>

          <Pinned chat={chat} meId={meId} />

          <FlatList
            data={newestFirst}
            inverted
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <Bubble message={item} mine={item.fromId === meId} />}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, flexGrow: 1 }}
            ListEmptyComponent={
              // inverted lists draw this upside down unless it's flipped back
              <View style={{ transform: [{ scaleY: -1 }], paddingVertical: 24, paddingHorizontal: 12 }}>
                <Txt variant="hand" tone="soft" center style={{ fontSize: 24, lineHeight: 26 }}>
                  you both said yes to a song. that’s further than most conversations get. say something to {first.toLowerCase()}.
                </Txt>
              </View>
            }
          />

          {/* composer */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 8,
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: Math.max(insets.bottom, 10),
              borderTopWidth: 2,
              borderTopColor: colors.ink,
              backgroundColor: colors.card,
            }}
          >
            <PosterButton
              label="+ song"
              kind="plain"
              small
              accessibilityLabel={`Send ${first} another song`}
              onPress={() => router.push({ pathname: '/send/[id]', params: { id: chat.other.id } })}
            />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={`Say something to ${first}`}
              placeholderTextColor={colors.inkFaint}
              selectionColor={colors.tomato}
              multiline
              maxLength={1000}
              accessibilityLabel="Message"
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
            <PosterButton label="send" small disabled={!draft.trim() || sending} onPress={send} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Paper>
  );
}
