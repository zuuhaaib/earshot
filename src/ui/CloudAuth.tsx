/**
 * Sign-up and log-in against the backend: email and password, a six-digit
 * code to prove the email is yours, password reset by code, and a growing
 * pause between failed log-ins so nobody (including a stuck thumb) hammers
 * the server.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { useApi } from '@/data';
import {
  appleAvailable,
  CloudError,
  cloudWords,
  confirmEmail,
  finishReset,
  googleRedirect,
  googleRedirectIsNumeric,
  logIn,
  looksLikeEmail,
  resendCode,
  sendReset,
  signInWithApple,
  signInWithGoogle,
  signUp,
  type CloudProfile,
  type NewCloudAccount,
} from '@/backend/accounts';
import { Field } from './Field';
import { Card, Heading, InkLink, PosterButton, Txt } from './print';

/** Seconds left until `until`, ticking while it's in the future. */
function useCountdown(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
const failure = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});

const passwordProps = (show: boolean) => ({ secureTextEntry: !show, autoCapitalize: 'none' as const, autoCorrect: false });
const emailProps = {
  autoCapitalize: 'none' as const,
  autoCorrect: false,
  keyboardType: 'email-address' as const,
  autoComplete: 'email' as const,
  textContentType: 'emailAddress' as const,
};

/** The emailed six-digit code: type it in, or ask for another (once a minute). */
function CodeStep({
  email,
  purpose,
  onVerified,
  onBack,
  extra,
  verify,
  resend,
}: {
  email: string;
  purpose: string;
  onVerified: (profile: CloudProfile) => void;
  onBack: () => void;
  /** Extra fields shown above the button (the new password, when resetting). */
  extra?: React.ReactNode;
  verify: (code: string) => Promise<CloudProfile>;
  resend: () => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(() => Date.now() + 60_000);
  const wait = useCountdown(resendAt);

  const submit = async () => {
    if (code.replace(/\D/g, '').length < 6) return setError('The code is six digits.');
    setBusy(true);
    setError(null);
    try {
      const profile = await verify(code);
      success();
      onVerified(profile);
    } catch (e) {
      failure();
      setError(cloudWords(e));
      setBusy(false);
    }
  };

  const again = async () => {
    setError(null);
    setNote(null);
    try {
      await resend();
      setResendAt(Date.now() + 60_000);
      setNote('Sent again. Use the newest email; older codes stop working.');
    } catch (e) {
      setError(cloudWords(e));
    }
  };

  return (
    <View>
      <Txt variant="body">
        We’ve emailed a six-digit code to <Txt variant="titleSm">{email}</Txt>. Type it here {purpose}.
      </Txt>
      <Field
        label="Code from the email"
        value={code}
        onChangeText={(v) => {
          setCode(v.replace(/\D/g, '').slice(0, 6));
          setError(null);
        }}
        placeholder="123456"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        error={extra ? null : error}
        hint={note ?? undefined}
        containerStyle={{ marginTop: 18 }}
        style={{ letterSpacing: 6, fontSize: 22, textAlign: 'center' }}
      />
      {extra}
      {extra && error ? (
        <Txt variant="small" tone="accent" style={{ marginTop: 8 }}>
          {error}
        </Txt>
      ) : null}
      <PosterButton label={busy ? 'checking…' : 'confirm'} disabled={busy} onPress={submit} style={{ marginTop: 18 }} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 18 }}>
        {wait > 0 ? (
          <Txt variant="meta" tone="soft">
            send another in {wait}s
          </Txt>
        ) : (
          <InkLink label="send another code" onPress={again} />
        )}
        <InkLink label="use a different email" onPress={onBack} />
      </View>
      <Txt variant="small" tone="soft" style={{ marginTop: 16 }}>
        Nothing there? Check spam. Codes last an hour, and the server only sends one a minute. If the email has a link but no
        code, the “Confirm signup” email template in Supabase needs the code added to it.
      </Txt>
    </View>
  );
}

/**
 * "Continue with Google": signs in if the Google account already has an
 * earshot account, makes one if it doesn't. Google has already proved the
 * email, so there's no code step.
 */
export function GoogleButton({ onDone }: { onDone: (account: CloudProfile) => void | Promise<void> }) {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const account = await signInWithGoogle();
      success();
      await api.adoptAccount(account);
      await onDone(account);
    } catch (e) {
      // closing the window isn't an error worth shouting about
      if (!(e instanceof CloudError && e.code === 'cancelled')) setError(cloudWords(e));
      // ...but it's also what happens when Google can't find its way back to the app, so offer the fix
      setStuck(true);
      setBusy(false);
    }
  };

  return (
    <View>
      <PosterButton label={busy ? 'waiting for Google…' : 'continue with Google'} kind="plain" disabled={busy} onPress={go} />
      {error ? (
        <Txt variant="small" tone="accent" style={{ marginTop: 8 }}>
          {error}
        </Txt>
      ) : null}
      {stuck ? (
        <View style={{ marginTop: 10 }}>
          {googleRedirectIsNumeric() ? (
            <Txt variant="small" tone="soft">
              If the browser couldn’t connect after you picked your Google account: on Android in Expo Go, the backend refuses
              this app’s return address because it’s a numeric network address. Stop Expo and start it with “npx expo start
              --tunnel”, then try again.
            </Txt>
          ) : (
            <>
              <Txt variant="small" tone="soft">
                If the browser couldn’t connect after you picked your Google account, the backend doesn’t know this app’s
                return address yet. In Supabase, under Authentication → URL Configuration → Redirect URLs, add:
              </Txt>
              <Txt selectable variant="meta" style={{ marginTop: 4 }}>
                {googleRedirect()}
              </Txt>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

/**
 * "Continue with Apple", on iPhones and iPads. It uses Apple's own button, as
 * Apple requires, and sits above Google so neither is favoured.
 */
export function AppleButton({ onDone }: { onDone: (account: CloudProfile) => void | Promise<void> }) {
  const api = useApi();
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    appleAvailable().then((yes) => alive && setAvailable(yes));
    return () => {
      alive = false;
    };
  }, []);

  if (!available) return null;

  const go = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const account = await signInWithApple();
      success();
      await api.adoptAccount(account);
      await onDone(account);
    } catch (e) {
      if (!(e instanceof CloudError && e.code === 'cancelled')) setError(cloudWords(e));
      setBusy(false);
    }
  };

  return (
    <View style={{ marginBottom: 12, opacity: busy ? 0.5 : 1 }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={3}
        style={{ width: '100%', height: 50 }}
        onPress={go}
      />
      {error ? (
        <Txt variant="small" tone="accent" style={{ marginTop: 8 }}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

/** A ruled line with "or" in the middle, between Google and the email form. */
function Or() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 }}>
      <View style={{ flex: 1, height: 2, backgroundColor: 'rgba(31,42,107,0.25)' }} />
      <Txt variant="label" tone="soft">
        or with email
      </Txt>
      <View style={{ flex: 1, height: 2, backgroundColor: 'rgba(31,42,107,0.25)' }} />
    </View>
  );
}

// ---- sign-up ------------------------------------------------------------------

export function CloudSignUp({
  profile,
  onDone,
}: {
  profile: Omit<NewCloudAccount, 'email' | 'password'>;
  /** Called once the email is verified and the phone is signed in as the new account. */
  onDone: (account: CloudProfile) => void | Promise<void>;
}) {
  const api = useApi();
  const [stage, setStage] = useState<'details' | 'code'>('details');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (!looksLikeEmail(email)) return setError(cloudWords(new CloudError('bad-email')));
    if (password.length < 8) return setError(cloudWords(new CloudError('weak-password')));
    if (password !== again) return setError('Those two passwords don’t match. Type it again, slower.');
    setBusy(true);
    setError(null);
    try {
      await signUp({ ...profile, email, password });
      setStage('code');
    } catch (e) {
      failure();
      setError(cloudWords(e));
    } finally {
      setBusy(false);
    }
  };

  const adopt = async (account: CloudProfile) => {
    await api.adoptAccount(account);
    await onDone(account);
  };

  if (stage === 'code') {
    return (
      <View>
        <Heading>check your email</Heading>
        <CodeStep
          email={email.trim().toLowerCase()}
          purpose="to finish making your account"
          verify={(code) => confirmEmail(email, code)}
          resend={() => resendCode(email)}
          onVerified={adopt}
          onBack={() => setStage('details')}
        />
      </View>
    );
  }

  return (
    <View>
      <Heading>one last thing</Heading>
      <Txt variant="body" tone="soft">
        An email and a password, so your room stays yours and you can get back in from any phone. You’ll be @{profile.handle}.
      </Txt>
      <Field
        label="Email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setError(null);
        }}
        placeholder="you@example.com"
        containerStyle={{ marginTop: 22 }}
        {...emailProps}
      />
      <Field
        label="Password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError(null);
        }}
        placeholder="At least 8 characters"
        autoComplete="new-password"
        textContentType="newPassword"
        containerStyle={{ marginTop: 16 }}
        {...passwordProps(show)}
      />
      <Field
        label="Password, once more"
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
        {...passwordProps(show)}
      />
      <InkLink label={show ? 'hide passwords' : 'show passwords'} onPress={() => setShow((s) => !s)} style={{ alignSelf: 'flex-start', marginTop: 12 }} />

      <Card rotate={-0.5} style={{ marginTop: 20 }} innerStyle={{ padding: 14, gap: 8 }}>
        <Txt variant="titleSm">What happens to these</Txt>
        <Txt variant="small">
          Your email is used to prove the account is yours and to let you reset your password. It isn’t shown to anyone and we
          won’t send you anything else.
        </Txt>
        <Txt variant="small">
          Your password goes straight to the server, which keeps only a scrambled fingerprint of it. earshot never stores it
          on your phone.
        </Txt>
      </Card>

      <PosterButton label={busy ? 'sending your code…' : 'email me a code'} disabled={busy} onPress={start} style={{ marginTop: 20 }} />
    </View>
  );
}

// ---- log-in and password reset --------------------------------------------------

export function CloudLogin({ onDone }: { onDone: (account: CloudProfile) => void | Promise<void> }) {
  const api = useApi();
  const [stage, setStage] = useState<'login' | 'verify' | 'reset' | 'reset-code'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fresh, setFresh] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Each wrong guess makes you wait longer before the next: 2s, 4s, 8s… up to 30s.
  const [fails, setFails] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const wait = useCountdown(blockedUntil);

  const adopt = async (account: CloudProfile) => {
    await api.adoptAccount(account);
    await onDone(account);
  };

  const submit = async () => {
    if (wait > 0 || busy) return;
    if (!looksLikeEmail(email) || !password) return setError('An email and a password, please.');
    setBusy(true);
    setError(null);
    try {
      const account = await logIn(email, password);
      success();
      await adopt(account);
    } catch (e) {
      failure();
      setBusy(false);
      if (e instanceof CloudError && e.code === 'unconfirmed') {
        // right password, unverified email: send a fresh code and ask for it
        resendCode(email).catch(() => {});
        setStage('verify');
        return;
      }
      const n = fails + 1;
      setFails(n);
      const serverSaysSlowDown = e instanceof CloudError && e.code === 'too-many';
      const pause = serverSaysSlowDown ? 60 : n >= 2 ? Math.min(30, 2 ** (n - 1)) : 0;
      if (pause) setBlockedUntil(Date.now() + pause * 1000);
      setError(cloudWords(e));
    }
  };

  const askReset = async () => {
    if (!looksLikeEmail(email)) return setError(cloudWords(new CloudError('bad-email')));
    setBusy(true);
    setError(null);
    try {
      await sendReset(email);
      setStage('reset-code');
    } catch (e) {
      setError(cloudWords(e));
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'verify') {
    return (
      <View>
        <Heading>one step left</Heading>
        <CodeStep
          email={email.trim().toLowerCase()}
          purpose="to verify your email and finish logging in"
          verify={(code) => confirmEmail(email, code)}
          resend={() => resendCode(email)}
          onVerified={adopt}
          onBack={() => setStage('login')}
        />
      </View>
    );
  }

  if (stage === 'reset') {
    return (
      <View>
        <Heading>forgot it. happens.</Heading>
        <Txt variant="body" tone="soft">
          Tell us the email on the account and we’ll send a code for choosing a new password.
        </Txt>
        <Field
          label="Email"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          placeholder="you@example.com"
          error={error}
          containerStyle={{ marginTop: 20 }}
          {...emailProps}
        />
        <PosterButton label={busy ? 'sending…' : 'email me a code'} disabled={busy} onPress={askReset} style={{ marginTop: 18 }} />
        <InkLink label="back to log in" onPress={() => setStage('login')} style={{ alignSelf: 'flex-start', marginTop: 16 }} />
        <Txt variant="small" tone="soft" style={{ marginTop: 14 }}>
          If there’s no account with that email, nothing is sent, and we won’t say which it was.
        </Txt>
      </View>
    );
  }

  if (stage === 'reset-code') {
    return (
      <View>
        <Heading>pick a new password</Heading>
        <CodeStep
          email={email.trim().toLowerCase()}
          purpose="along with a new password"
          verify={(code) => finishReset(email, code, fresh)}
          resend={() => sendReset(email)}
          onVerified={adopt}
          onBack={() => setStage('reset')}
          extra={
            <Field
              label="New password"
              value={fresh}
              onChangeText={setFresh}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              textContentType="newPassword"
              containerStyle={{ marginTop: 16 }}
              {...passwordProps(show)}
            />
          }
        />
      </View>
    );
  }

  return (
    <View>
      <AppleButton onDone={onDone} />
      <GoogleButton onDone={onDone} />
      <Or />
      <Field
        label="Email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setError(null);
        }}
        placeholder="you@example.com"
        returnKeyType="next"
        {...emailProps}
      />
      <Field
        label="Password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError(null);
        }}
        placeholder="Your password"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={error}
        containerStyle={{ marginTop: 16 }}
        {...passwordProps(show)}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 12 }}>
        <InkLink label={show ? 'hide password' : 'show password'} onPress={() => setShow((s) => !s)} />
        <InkLink
          label="forgot password"
          onPress={() => {
            setError(null);
            setStage('reset');
          }}
        />
      </View>
      <PosterButton
        label={busy ? 'checking…' : wait > 0 ? `try again in ${wait}s` : 'log in'}
        disabled={busy || wait > 0}
        onPress={submit}
        style={{ marginTop: 20 }}
      />
      {fails >= 2 ? (
        <Txt variant="small" tone="soft" style={{ marginTop: 12 }}>
          Each wrong guess makes the wait a little longer. If you’ve forgotten it, resetting is quicker than guessing.
        </Txt>
      ) : null}
    </View>
  );
}
