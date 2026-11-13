/** Handle and password, and plain words for what went wrong. Used when signed out and when switching accounts. */
import React, { useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useApi } from '@/data';
import { AuthError } from '@/data/api';
import { Field } from './Field';
import { InkLink, PosterButton, Txt } from './print';

/** What each sign-in problem means, in words a person would use. */
export const AUTH_WORDS: Record<AuthError['code'], string> = {
  'no-such-account': 'There’s no account with that handle on this phone. Check the spelling, or make one.',
  'wrong-password': 'That’s not the password for this account.',
  locked: 'Too many wrong guesses. Give it half a minute, then try again.',
  'handle-taken': 'Someone on this phone already has that handle. Pick another.',
  'bad-handle': 'A handle needs at least two letters or numbers.',
  'weak-password': 'Passwords need at least 8 characters.',
  resident: 'That’s one of the test residents. They don’t have passwords; borrow them from the account list instead.',
  'password-needed': 'That account has a password. Log in with it.',
};

export const authWords = (e: unknown, fallback: string) => (e instanceof AuthError ? AUTH_WORDS[e.code] : fallback);

export function LoginForm({ initialHandle = '', onDone }: { initialHandle?: string; onDone: (firstName: string) => void }) {
  const api = useApi();
  const [handle, setHandle] = useState(initialHandle);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!handle.trim() || !password) {
      setError('Both boxes, please.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const person = await api.logIn(handle, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onDone(person.name.split(' ')[0]);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(authWords(e, 'That didn’t work, and it wasn’t your password’s fault. Try again.'));
      setBusy(false);
    }
  };

  return (
    <View>
      <Field
        label="Handle"
        value={handle}
        onChangeText={(v) => {
          setHandle(v);
          setError(null);
        }}
        placeholder="yourname"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError(null);
        }}
        placeholder="At least 8 characters"
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={error}
        containerStyle={{ marginTop: 16 }}
      />
      <InkLink label={show ? 'hide password' : 'show password'} onPress={() => setShow((s) => !s)} style={{ alignSelf: 'flex-start', marginTop: 12 }} />
      <PosterButton label={busy ? 'checking…' : 'log in'} disabled={busy} onPress={submit} style={{ marginTop: 20 }} />
      <Txt variant="small" tone="soft" style={{ marginTop: 14 }}>
        Accounts live on this phone for now, so there’s no “forgot password” yet. If an account was made before passwords
        existed, the first password you type here becomes its password.
      </Txt>
    </View>
  );
}
