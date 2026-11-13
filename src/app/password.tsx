/** Change your password, or set one on an account that never had one. */
import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { changePassword as changeCloudPassword, cloudWords } from '@/backend/accounts';
import { isCloudId } from '@/backend/config';
import { useApi, useSession } from '@/data';
import { BackLink, Field, goBack } from '@/ui/Field';
import { AUTH_WORDS, authWords } from '@/ui/LoginForm';
import { Heading, InkLink, Paper, PosterButton, Txt } from '@/ui/print';
import { useSlip } from '@/ui/Slip';

export default function Password() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const slip = useSlip();
  const { data: session } = useSession();
  const onBackend = !!session?.me && isCloudId(session.me.id);
  // No "current password" box for an account that never had one, or for backend accounts
  // (being logged in is the proof; the server checks the session).
  const first = onBackend || (session?.needsPassword ?? false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (next.length < 8) return setError(AUTH_WORDS['weak-password']);
    if (next !== again) return setError('Those two don’t match. Type it again, slower.');
    setBusy(true);
    setError(null);
    try {
      if (onBackend) await changeCloudPassword(next);
      else await api.changePassword(first ? null : current, next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      slip(first && !onBackend ? 'Password set. The room’s locked.' : 'Password changed.');
      goBack();
    } catch (e) {
      setError(onBackend ? cloudWords(e) : authWords(e, 'That didn’t save. Try again.'));
      setBusy(false);
    }
  };

  const common = { secureTextEntry: !show, autoCapitalize: 'none' as const, autoCorrect: false };

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
            paddingBottom: insets.bottom + 28,
          }}
        >
          <BackLink label="close" />
          <Heading style={{ marginTop: 18 }}>{first && !onBackend ? 'set a password' : 'change your password'}</Heading>
          <Txt variant="body" tone="soft">
            {onBackend
              ? 'Pick a new one. It changes everywhere you’re logged in.'
              : first
                ? 'This account was made before earshot had passwords, so anyone holding the phone can use it. Fix that.'
                : 'Your old one first, so we know it’s you.'}
          </Txt>

          {first ? null : (
            <Field
              label="Current password"
              value={current}
              onChangeText={(v) => {
                setCurrent(v);
                setError(null);
              }}
              autoComplete="current-password"
              textContentType="password"
              containerStyle={{ marginTop: 22 }}
              {...common}
            />
          )}
          <Field
            label="New password"
            value={next}
            onChangeText={(v) => {
              setNext(v);
              setError(null);
            }}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            textContentType="newPassword"
            containerStyle={{ marginTop: first ? 22 : 16 }}
            {...common}
          />
          <Field
            label="Once more"
            value={again}
            onChangeText={(v) => {
              setAgain(v);
              setError(null);
            }}
            placeholder="Same again"
            autoComplete="new-password"
            textContentType="newPassword"
            error={error}
            containerStyle={{ marginTop: 16 }}
            {...common}
          />
          <InkLink label={show ? 'hide passwords' : 'show passwords'} onPress={() => setShow((s) => !s)} style={{ alignSelf: 'flex-start', marginTop: 12 }} />

          <Txt variant="small" tone="soft" style={{ marginTop: 16 }}>
            {onBackend
              ? 'Only the server keeps a scrambled fingerprint of your password. If you forget it, “forgot password” on the log-in screen emails you a code.'
              : 'Only a scrambled fingerprint of your password is kept, on this phone. There’s no reset for phone-only accounts, so if you forget it the account is locked for good.'}
          </Txt>
          <PosterButton label={busy ? 'saving…' : first && !onBackend ? 'set password' : 'change password'} disabled={busy} onPress={save} style={{ marginTop: 18 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Paper>
  );
}
