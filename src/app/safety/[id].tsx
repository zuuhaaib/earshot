/** Block or report someone. Reached from their room or from a chat with them. */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi, useLive, type ReportContext, type ReportReason } from '@/data';
import { colors } from '@/theme';
import { BackLink, Field, goBack } from '@/ui/Field';
import { Card, Heading, Paper, PosterButton, Txt } from '@/ui/print';
import { useSlip } from '@/ui/Slip';

const REASONS: { id: ReportReason; label: string }[] = [
  { id: 'harassment', label: 'Harassing or threatening me or someone else' },
  { id: 'hate', label: 'Hateful about who people are' },
  { id: 'sexual', label: 'Sexual content or advances nobody asked for' },
  { id: 'spam', label: 'Spam, scams or selling something' },
  { id: 'impersonation', label: 'Pretending to be someone they’re not' },
  { id: 'underage', label: 'Seems to be a child' },
  { id: 'other', label: 'Something else' },
];
const NOTE_MAX = 500;
const KINDS = ['chat', 'message', 'post', 'thread', 'reply', 'room'] as const;
/** What gets copied into the report for whoever reads it, by where the report was started. */
const COPIED: Record<(typeof KINDS)[number], string> = {
  chat: 'your recent chat with them and their profile',
  message: 'that message, the recent chat around it and their profile',
  post: 'that post and their profile',
  thread: 'what they wrote in that thread and their profile',
  reply: 'that reply and their profile',
  room: 'their room and profile',
};
const ABOUT: Record<(typeof KINDS)[number], string> = {
  chat: 'your chat with them',
  message: 'a message they sent you',
  post: 'one of their city posts',
  thread: 'a thread they started',
  reply: 'a reply they wrote',
  room: 'their room',
};

/** Leave every screen that was showing this person; they no longer exist as far as you can see. */
function backToStart() {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
}

export default function Safety() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const slip = useSlip();
  const params = useLocalSearchParams<{ id: string; kind?: string; cid?: string }>();
  const id = params.id;
  const kind = KINDS.find((k) => k === params.kind);
  const context: ReportContext = kind ? { kind, id: params.cid ?? id } : null;
  const { data: who } = useLive((a) => a.getPerson(id), [], [id]);

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const first = who?.name.split(' ')[0] ?? 'them';
  const onServer = api.kind === 'server';

  const block = async () => {
    setBusy(true);
    try {
      await api.blockPerson(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      slip(`Blocked. You and ${first} won’t see each other from here on.`);
      backToStart();
    } catch {
      slip('That didn’t go through. Try again.');
      setBusy(false);
    }
  };

  const report = async () => {
    if (!reason) {
      setError('Pick the closest reason first.');
      return;
    }
    setBusy(true);
    try {
      await api.reportPerson(id, reason, note, context);
      if (alsoBlock) await api.blockPerson(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      slip(alsoBlock ? `Reported and blocked. ${first} isn’t told about either.` : `Reported. ${first} isn’t told.`);
      if (alsoBlock) backToStart();
      else goBack();
    } catch (e) {
      const tooMany = e instanceof Error && e.message === 'too-many-reports';
      slip(tooMany ? 'You’ve sent a lot of reports today. Try again tomorrow; blocking still works.' : 'The report didn’t send. Try again.');
      setBusy(false);
    }
  };

  return (
    <Paper>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            width: '100%',
            maxWidth: 560,
            alignSelf: 'center',
            paddingTop: insets.top + 14,
            paddingBottom: insets.bottom + 36,
          }}
        >
          <BackLink label="close" />

          <Heading style={{ marginTop: 18 }}>{`block ${first.toLowerCase()}`}</Heading>
          <Card rotate={-0.6} innerStyle={{ padding: 16 }}>
            <Txt variant="body">
              Blocking {first} means neither of you sees the other anywhere in earshot: not nearby, not in the city feed, not in
              threads, not in each other’s rooms.
            </Txt>
            <Txt variant="body" style={{ marginTop: 10 }}>
              Any song they sent you and any chat between you leaves your inbox, and they can’t send you another. Their signature
              comes out of your guestbook, and yours out of theirs.
            </Txt>
            <Txt variant="body" style={{ marginTop: 10 }}>
              {first} is not told, and nothing on their side says it happened. You can undo it from the You tab, under “blocked
              people”.
            </Txt>
            <PosterButton label={busy ? 'one moment…' : `block ${first.toLowerCase()}`} disabled={busy} onPress={block} style={{ marginTop: 16 }} />
          </Card>

          <Heading style={{ marginTop: 34 }}>{`report ${first.toLowerCase()}`}</Heading>
          <Txt variant="body" tone="soft" style={{ marginBottom: 12 }}>
            {onServer
              ? `A report goes to the people who run earshot, with a copy of ${kind ? COPIED[kind] : 'their profile'} so it can be checked. ${first} is not told who reported them, or that anyone did.`
              : 'This version of earshot has no server, so there is nobody to send a report to. It is saved on this phone and goes nowhere. Blocking works as described above.'}
          </Txt>

          {kind ? (
            <Txt variant="label" tone="accent" style={{ marginBottom: 12 }}>
              This report is about {ABOUT[kind]}
            </Txt>
          ) : null}

          {REASONS.map((r) => {
            const on = reason === r.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => {
                  setReason(r.id);
                  setError(null);
                  Haptics.selectionAsync().catch(() => {});
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 11,
                  paddingHorizontal: 12,
                  marginBottom: 8,
                  borderWidth: 2,
                  borderColor: colors.ink,
                  backgroundColor: on ? colors.highlighter : colors.card,
                }}
              >
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: colors.ink,
                    backgroundColor: on ? colors.ink : 'transparent',
                  }}
                />
                <Txt variant="body" style={{ flex: 1 }}>
                  {r.label}
                </Txt>
              </Pressable>
            );
          })}
          {error ? (
            <Txt variant="small" color={colors.tomato} style={{ marginTop: 2 }}>
              {error}
            </Txt>
          ) : null}

          <Field
            label={`Anything that would help (optional, ${NOTE_MAX - note.length} left)`}
            value={note}
            onChangeText={setNote}
            placeholder="What happened, in your own words."
            multiline
            maxLength={NOTE_MAX}
            containerStyle={{ marginTop: 14 }}
          />

          <Pressable
            onPress={() => setAlsoBlock((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: alsoBlock }}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderWidth: 2,
                borderColor: colors.ink,
                backgroundColor: alsoBlock ? colors.ink : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {alsoBlock ? (
                <Txt variant="small" color={colors.paper}>
                  ✓
                </Txt>
              ) : null}
            </View>
            <Txt variant="body" style={{ flex: 1 }}>
              Block {first} as well
            </Txt>
          </Pressable>

          <PosterButton label={busy ? 'sending…' : 'send report'} kind="plain" disabled={busy} onPress={report} style={{ marginTop: 18 }} />
          <Txt variant="small" tone="soft" style={{ marginTop: 12 }}>
            If someone is in danger right now, call your local emergency number.
            {onServer ? ' A report here is read by a person, not instantly.' : ''}
          </Txt>
        </ScrollView>
      </KeyboardAvoidingView>
    </Paper>
  );
}
