import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi, useLive, usePulse, useSession, type ChatSummary, type SongRequest } from '@/data';
import { colors, tilt } from '@/theme';
import { Card, Heading, Paper, PinBadge, PosterButton, Stamp, Tape, Txt } from '@/ui/print';
import { PushCard } from '@/ui/PushCard';
import { Sleeve } from '@/ui/Sleeve';
import { useSlip } from '@/ui/Slip';
import { ago } from '@/ui/SongPicker';

const openRoom = (id: string) => router.push({ pathname: '/room/[id]', params: { id } });
const openChat = (id: string) => router.push({ pathname: '/chat/[id]', params: { id } });

/** A song someone sent you, waiting for a yes or a quiet no. */
function Waiting({ request }: { request: SongRequest }) {
  const api = useApi();
  const slip = useSlip();
  const [busy, setBusy] = useState(false);
  const first = request.from.name.split(' ')[0];

  const answer = async (accept: boolean) => {
    setBusy(true);
    try {
      await api.answerSong(request.id, accept);
      Haptics.notificationAsync(
        accept ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
      if (accept) {
        slip('Chat’s open. The song stays on top.');
        openChat(request.id);
      } else {
        slip(`Gone. ${first} won’t be told.`);
      }
    } catch {
      slip('That didn’t go through. Try again.');
      setBusy(false);
    }
  };

  return (
    <Card rotate={tilt(request.id + 'w', 1.2)} innerStyle={{ padding: 14 }}>
      <Pressable
        onPress={() => openRoom(request.from.id)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${request.from.name}'s room`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}
      >
        <PinBadge label={request.from.badge} color={request.from.badgeColor} size={38} rotate={tilt(request.from.id, 9)} />
        <View style={{ flex: 1 }}>
          <Txt variant="titleSm" numberOfLines={1}>
            {request.from.name}
          </Txt>
          <Txt variant="meta" tone="soft">
            sent you a song · {ago(request.sentAt)}
          </Txt>
        </View>
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Sleeve track={request.track} size={96} />
        <View style={{ flex: 1, justifyContent: 'center', paddingLeft: 4 }}>
          <Txt variant="title" numberOfLines={3}>
            {request.track.title}
          </Txt>
          <Txt variant="bodyItalic" numberOfLines={1}>
            {request.track.artist}
          </Txt>
        </View>
      </View>

      {request.note ? (
        <View style={{ marginTop: 16, marginHorizontal: 4 }}>
          <View style={{ backgroundColor: colors.highlighter, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, transform: [{ rotate: '-0.8deg' }] }}>
            <Txt variant="hand">{request.note}</Txt>
          </View>
          <Tape rotate={4} width={58} style={{ top: -9, left: '36%' }} />
        </View>
      ) : null}

      {request.about ? (
        <Txt variant="meta" tone="soft" style={{ marginTop: 12 }} numberOfLines={2}>
          You had on: {request.about.title} · {request.about.artist}
        </Txt>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <PosterButton label="accept" small disabled={busy} onPress={() => answer(true)} style={{ flex: 1 }} />
        <PosterButton label="not for me" kind="plain" small disabled={busy} onPress={() => answer(false)} style={{ flex: 1 }} />
      </View>
      <Txt variant="small" tone="soft" style={{ marginTop: 10 }}>
        Accept and a chat opens with this song pinned on top. Say no and it simply goes away; {first} is never told.
      </Txt>
    </Card>
  );
}

function ChatRow({ chat }: { chat: ChatSummary }) {
  const fresh = chat.unread > 0;
  return (
    <Pressable onPress={() => openChat(chat.id)} accessibilityRole="button" accessibilityLabel={`Chat with ${chat.other.name}`}>
      <Card
        rotate={tilt(chat.id + 'c', 0.8)}
        shadow={4}
        fill={fresh ? colors.highlighter : undefined}
        innerStyle={{ padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}
      >
        <PinBadge label={chat.other.badge} color={chat.other.badgeColor} size={42} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Txt variant="titleSm" numberOfLines={1} style={{ flexShrink: 1 }}>
              {chat.other.name}
            </Txt>
            {fresh ? <Stamp rotate={-3}>New</Stamp> : null}
          </View>
          <Txt variant="small" tone="soft" numberOfLines={1}>
            {chat.last ? `${chat.last.mine ? 'You: ' : ''}${chat.last.text}` : 'You both said yes. Somebody say something.'}
          </Txt>
          <Txt variant="meta" tone="soft" numberOfLines={1} style={{ marginTop: 2 }}>
            started with {chat.opener.title}
          </Txt>
        </View>
        <Sleeve track={chat.opener} size={44} record={false} playable={false} />
      </Card>
    </Pressable>
  );
}

function SentRow({ request }: { request: SongRequest }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <Sleeve track={request.track} size={44} record={false} playable={false} />
      <View style={{ flex: 1 }}>
        <Txt variant="titleSm" numberOfLines={1}>
          {request.track.title}
        </Txt>
        <Txt variant="meta" tone="soft" numberOfLines={1}>
          to {request.to.name} · {ago(request.sentAt)}
        </Txt>
      </View>
      <Pressable onPress={() => openRoom(request.to.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Open ${request.to.name}'s room`}>
        <PinBadge label={request.to.badge} color={request.to.badgeColor} size={32} />
      </Pressable>
    </View>
  );
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const { data: session } = useSession();
  const { data: inbox } = useLive((a) => a.getInbox(), ['inbox', 'session']);
  usePulse(15_000);

  if (!session?.me || !inbox) return <Paper />;
  const empty = !inbox.waiting.length && !inbox.chats.length && !inbox.sent.length;

  return (
    <Paper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: 36,
          paddingHorizontal: 16,
          width: '100%',
          maxWidth: 560,
          alignSelf: 'center',
        }}
      >
        <Txt variant="poster" accessibilityRole="header">
          inbox
        </Txt>

        <PushCard />

        {empty ? (
          <Card rotate={-1.2} style={{ marginTop: 28 }} innerStyle={{ padding: 20 }}>
            <Txt variant="title">Nothing yet, and not because nobody likes you.</Txt>
            <Txt variant="body" tone="soft" style={{ marginTop: 8 }}>
              Songs people send you land here. So do the chats that open when one of you says yes. To get things moving, send
              someone a song from Nearby, or go on air with something playing and see who bites.
            </Txt>
            <PosterButton label="see who’s nearby" onPress={() => router.navigate('/')} style={{ marginTop: 16, alignSelf: 'flex-start' }} />
          </Card>
        ) : null}

        {inbox.waiting.length ? (
          <View style={{ marginTop: 24 }}>
            <Heading>{inbox.waiting.length === 1 ? 'a song for you' : 'songs for you'}</Heading>
            <View style={{ gap: 20 }}>
              {inbox.waiting.map((r) => (
                <Waiting key={r.id} request={r} />
              ))}
            </View>
          </View>
        ) : null}

        {inbox.chats.length ? (
          <View style={{ marginTop: 30 }}>
            <Heading>chats</Heading>
            <View style={{ gap: 12 }}>
              {inbox.chats.map((c) => (
                <ChatRow key={c.id} chat={c} />
              ))}
            </View>
          </View>
        ) : null}

        {inbox.sent.length ? (
          <View style={{ marginTop: 30 }}>
            <Heading>sent, no answer yet</Heading>
            <Txt variant="small" tone="soft" style={{ marginBottom: 6 }}>
              If someone accepts, it moves up to chats. If they don’t, it just stays here. Nobody gets a rejection, including
              you.
            </Txt>
            {inbox.sent.map((r) => (
              <SentRow key={r.id} request={r} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Paper>
  );
}
