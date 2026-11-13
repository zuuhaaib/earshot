import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi, useLive, useSession } from '@/data';
import { cloudConfigured } from '@/backend/config';
import { AuthError } from '@/data/api';
import { cities } from '@/data/areas';
import { colors, tilt } from '@/theme';
import { BackLink, Field } from '@/ui/Field';
import { CloudLogin, CloudSignUp, GoogleButton } from '@/ui/CloudAuth';
import { AUTH_WORDS, authWords, LoginForm } from '@/ui/LoginForm';
import { Card, Heading, InkLink, Paper, PinBadge, PosterButton, Stamp, Tape, Txt } from '@/ui/print';

const BADGE_COLORS = ['#F7A6BF', '#FFD23F', '#7FCFA9', '#F6B26B', '#F0502F', '#B9A7E8', '#8FD3E8', '#C6E377', '#FFF6EC'];

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();

const toHandle = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');

const PITCH = [
  'Open it anywhere and see what people within earshot are playing. No maps, no distances, no pins in anything.',
  'Say hello by sending a song. There is no “hey” button. We looked.',
  'Find the people in your city who also think that album is underrated.',
];

type Step = 'poster' | 'badge' | 'home' | 'password' | 'login' | 'borrow';

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const { data: session } = useSession();
  const { data: accounts } = useLive((a) => a.listAccounts(), ['session']);

  const [step, setStep] = useState<Step>('poster');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState<string | null>(null); // null = follow the name
  const [letters, setLetters] = useState<string | null>(null);
  const [color, setColor] = useState(BADGE_COLORS[0]);
  const [city, setCity] = useState<string>(cities[0]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const cloud = cloudConfigured();
  const shownHandle = handle ?? toHandle(name);
  const shownLetters = letters ?? initials(name);
  const padBottom = useMemo(() => insets.bottom + 28, [insets.bottom]);

  if (session?.me && !busy) return <Redirect href="/" />;

  const create = async () => {
    if (password.length < 8) return setFailed(AUTH_WORDS['weak-password']);
    if (password !== again) return setFailed('Those two don’t match. Type it again, slower.');
    setBusy(true);
    setFailed(null);
    try {
      await api.createAccount({ name, handle: shownHandle, badge: shownLetters || '?', badgeColor: color, homeCity: city, password });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/');
    } catch (e) {
      setBusy(false);
      if (e instanceof AuthError && (e.code === 'handle-taken' || e.code === 'bad-handle')) {
        // the handle is the problem, so go back to where it's chosen
        setHandleError(AUTH_WORDS[e.code]);
        setStep('badge');
        return;
      }
      setFailed(authWords(e, 'That didn’t save. Nothing’s lost; press it again.'));
    }
  };

  const borrow = async (id: string) => {
    setBusy(true);
    await api.signIn(id).catch(() => {});
    router.replace('/');
  };

  return (
    <Paper>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + 16,
            paddingBottom: padBottom,
            paddingHorizontal: 20,
            width: '100%',
            maxWidth: 560,
            alignSelf: 'center',
          }}
        >
          {step === 'poster' && (
            <View style={{ flex: 1 }}>
              <View style={{ marginTop: 12 }}>
                <Txt variant="wordmark" color={colors.tomato} style={{ position: 'absolute', left: 4, top: 4, fontSize: 64, lineHeight: 70 }}>
                  earshot
                </Txt>
                <Txt variant="wordmark" accessibilityRole="header" style={{ fontSize: 64, lineHeight: 70 }}>
                  earshot
                </Txt>
              </View>
              <Txt variant="title" style={{ marginTop: 10, fontSize: 24, lineHeight: 30 }}>
                Find out what everyone around you has on.
              </Txt>

              <View style={{ marginTop: 30, gap: 18 }}>
                {PITCH.map((line, i) => (
                  <View key={i} style={{ marginLeft: i === 1 ? 20 : 0, marginRight: i === 1 ? 0 : 20 }}>
                    <Card rotate={tilt(line, 1.6)} innerStyle={{ padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                      <Txt variant="poster" tone="accent" style={{ fontSize: 34, lineHeight: 40 }}>
                        {String(i + 1)}
                      </Txt>
                      <Txt variant="body" style={{ flex: 1 }}>
                        {line}
                      </Txt>
                    </Card>
                    <Tape rotate={i % 2 ? 6 : -5} width={54} style={{ top: -9, left: i % 2 ? '60%' : '18%' }} />
                  </View>
                ))}
              </View>

              <View style={{ flex: 1, minHeight: 28 }} />
              <PosterButton label="make an account" onPress={() => setStep('badge')} />
              <PosterButton label="I’ve got one: log in" kind="plain" onPress={() => setStep('login')} style={{ marginTop: 12 }} />
              {cloud ? (
                <View style={{ marginTop: 12 }}>
                  <GoogleButton
                    onDone={() => {
                      setBusy(true);
                      router.replace('/');
                    }}
                  />
                </View>
              ) : null}
              {api.kind === 'phone' ? (
                <InkLink
                  label="testing? borrow a resident"
                  onPress={() => setStep('borrow')}
                  style={{ alignSelf: 'center', marginTop: 18 }}
                />
              ) : null}
            </View>
          )}

          {step === 'badge' && (
            <View style={{ flex: 1 }}>
              <BackLink onPress={() => setStep('poster')} />
              <Heading style={{ marginTop: 18 }}>who are you, then?</Heading>
              <Txt variant="body" tone="soft">
                Your name and badge go on your song cards. No photo. Nobody looks like their photo anyway.
              </Txt>

              <View style={{ alignItems: 'center', marginVertical: 22 }}>
                <PinBadge label={shownLetters || '?'} color={color} size={96} rotate={-6} />
              </View>

              <Field
                label="Name"
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setNameError(null);
                }}
                placeholder="What your friends call you"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                maxLength={40}
                error={nameError}
              />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                <Field
                  label="Handle"
                  value={shownHandle}
                  onChangeText={(v) => {
                    setHandle(v.toLowerCase().replace(/[^a-z0-9._]/g, ''));
                    setHandleError(null);
                  }}
                  error={handleError}
                  hint="You’ll log in with this."
                  placeholder="yourname"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={28}
                  containerStyle={{ flex: 1 }}
                />
                <Field
                  label="Badge"
                  value={shownLetters}
                  onChangeText={(v) => setLetters(v.toUpperCase().slice(0, 2))}
                  placeholder="AB"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={2}
                  containerStyle={{ width: 84 }}
                  style={{ textAlign: 'center' }}
                />
              </View>

              <Txt variant="label" tone="soft" style={{ marginTop: 18, marginBottom: 8 }}>
                Badge colour
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {BADGE_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setColor(c);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: c === color }}
                    accessibilityLabel={`Badge colour ${c}`}
                    hitSlop={4}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: c,
                      borderWidth: c === color ? 4 : 2,
                      borderColor: colors.ink,
                    }}
                  />
                ))}
              </View>

              <View style={{ flex: 1, minHeight: 28 }} />
              <PosterButton
                label="next: where’s home"
                onPress={() => {
                  if (!name.trim()) {
                    setNameError('We need something to call you. A name, a nickname, a warning.');
                    return;
                  }
                  if (shownHandle.replace(/[^a-z0-9]/g, '').length < 2) {
                    setHandleError(AUTH_WORDS['bad-handle']);
                    return;
                  }
                  setStep('home');
                }}
              />
            </View>
          )}

          {step === 'home' && (
            <View style={{ flex: 1 }}>
              <BackLink onPress={() => setStep('badge')} />
              <Heading style={{ marginTop: 18 }}>where’s home?</Heading>
              <Txt variant="body" tone="soft">
                This decides which city feed is yours, and it stays put when you travel. It’s a choice you make here, not a
                location check: your phone isn’t asked where you are.
              </Txt>

              <View style={{ marginTop: 20, gap: 10 }}>
                {cities.map((c) => {
                  const on = c === city;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setCity(c);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderWidth: 2,
                        borderColor: colors.ink,
                        backgroundColor: on ? colors.highlighter : colors.card,
                        borderRadius: 3,
                        paddingHorizontal: 14,
                        minHeight: 48,
                      }}
                    >
                      <Txt variant="titleSm">{c}</Txt>
                      {on ? <Stamp rotate={-3}>Home</Stamp> : null}
                    </Pressable>
                  );
                })}
              </View>
              <Txt variant="small" tone="soft" style={{ marginTop: 12 }}>
                All of these are part of the GTA, which gets its own combined feed.
              </Txt>

              <View style={{ flex: 1, minHeight: 28 }} />
              <PosterButton label={cloud ? 'next: email and password' : 'next: pick a password'} onPress={() => setStep('password')} />
            </View>
          )}

          {step === 'password' && cloud && (
            <View style={{ flex: 1 }}>
              <BackLink onPress={() => setStep('home')} />
              <View style={{ height: 18 }} />
              <CloudSignUp
                profile={{ name, handle: shownHandle, badge: shownLetters || '?', badgeColor: color, homeCity: city }}
                onDone={() => {
                  setBusy(true);
                  router.replace('/');
                }}
              />
            </View>
          )}

          {step === 'password' && !cloud && (
            <View style={{ flex: 1 }}>
              <BackLink onPress={() => setStep('home')} />
              <Heading style={{ marginTop: 18 }}>one last thing</Heading>
              <Txt variant="body" tone="soft">
                A password, so your room stays yours. You’ll log in as @{shownHandle}.
              </Txt>

              <Field
                label="Password"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setFailed(null);
                }}
                placeholder="At least 8 characters"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                containerStyle={{ marginTop: 22 }}
              />
              <Field
                label="Once more"
                value={again}
                onChangeText={(v) => {
                  setAgain(v);
                  setFailed(null);
                }}
                placeholder="Same again"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                error={failed}
                containerStyle={{ marginTop: 16 }}
              />
              <InkLink
                label={showPassword ? 'hide password' : 'show password'}
                onPress={() => setShowPassword((v) => !v)}
                style={{ alignSelf: 'flex-start', marginTop: 12 }}
              />

              <Card rotate={-0.5} style={{ marginTop: 22 }} innerStyle={{ padding: 14, gap: 8 }}>
                <Txt variant="titleSm">What happens to it</Txt>
                <Txt variant="small">
                  Your password is never saved. What’s kept on this phone is a scrambled fingerprint of it, which can check a
                  password but can’t be turned back into one.
                </Txt>
                <Txt variant="small">
                  There’s no server yet, so there’s no “forgot password” and no way for us to reset it. If you forget it, that
                  account is locked for good. Pick one you’ll remember.
                </Txt>
              </Card>

              <View style={{ flex: 1, minHeight: 28 }} />
              <PosterButton label={busy ? 'pressing your badge…' : 'that’s me. let’s go'} disabled={busy} onPress={create} />
            </View>
          )}

          {step === 'login' && (
            <View style={{ flex: 1 }}>
              <BackLink onPress={() => setStep('poster')} />
              <Heading style={{ marginTop: 18 }}>welcome back</Heading>
              <Txt variant="body" tone="soft" style={{ marginBottom: 20 }}>
                {cloud ? 'Same email, same password, same questionable taste.' : 'Same handle, same password, same questionable taste.'}
              </Txt>
              {cloud ? (
                <CloudLogin
                  onDone={() => {
                    setBusy(true);
                    router.replace('/');
                  }}
                />
              ) : (
                <LoginForm
                  onDone={() => {
                    setBusy(true);
                    router.replace('/');
                  }}
                />
              )}
            </View>
          )}

          {step === 'borrow' && (
            <View style={{ flex: 1 }}>
              <BackLink onPress={() => setStep('poster')} />
              <Heading style={{ marginTop: 18 }}>borrow some headphones</Heading>
              <Txt variant="body" tone="soft">
                These are test accounts that come with the app, with no password, for trying both sides of a conversation on one
                phone. You’ll be signed in as them, with their name on everything you do.
              </Txt>
              <View style={{ marginTop: 18, gap: 12 }}>
                {(accounts ?? []).filter((p) => p.seeded).map((p) => (
                  <Pressable key={p.id} onPress={() => borrow(p.id)} disabled={busy} accessibilityRole="button">
                    <Card rotate={tilt(p.id, 1)} shadow={4} innerStyle={{ padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                      <PinBadge label={p.badge} color={p.badgeColor} size={42} />
                      <View style={{ flex: 1 }}>
                        <Txt variant="titleSm">{p.name}</Txt>
                        <Txt variant="meta" tone="soft">
                          @{p.handle}
                        </Txt>
                      </View>
                    </Card>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Paper>
  );
}
