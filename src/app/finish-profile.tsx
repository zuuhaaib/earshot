/**
 * For someone who has just signed in with Google for the first time: Google
 * told us their email and name, but earshot still needs a handle, a badge and
 * a home city before they go on anyone's song cards.
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logOut } from '@/backend/accounts';
import { useApi, useSession } from '@/data';
import { cities } from '@/data/areas';
import type { CloudApi } from '@/data/cloud/CloudApi';
import { colors } from '@/theme';
import { Field } from '@/ui/Field';
import { authWords } from '@/ui/LoginForm';
import { Agree } from '@/ui/Agree';
import { Heading, InkLink, Paper, PinBadge, PosterButton, Stamp, Txt } from '@/ui/print';

const BADGE_COLORS = ['#F7A6BF', '#FFD23F', '#7FCFA9', '#F6B26B', '#F0502F', '#B9A7E8', '#8FD3E8', '#C6E377', '#FFF6EC'];

export default function FinishProfile() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const { data: session } = useSession();
  const me = session?.me;

  const [name, setName] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [badge, setBadge] = useState<string | null>(null);
  const [color, setColor] = useState(BADGE_COLORS[0]);
  const [city, setCity] = useState<string>(cities[0]);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return <Paper />;
  if (!me) return <Redirect href="/welcome" />;
  if (!session.needsProfile && !busy) return <Redirect href="/" />;

  // Start from what Google gave us; everything can be changed.
  const shownName = name ?? me.name;
  const shownHandle = handle ?? me.handle;
  const shownBadge = badge ?? me.badge;

  const save = async () => {
    if (!shownName.trim()) return setError('We need something to call you.');
    setBusy(true);
    setError(null);
    try {
      await (api as CloudApi).completeProfile({ name: shownName, handle: shownHandle, badge: shownBadge || '?', badgeColor: color, homeCity: city });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/');
    } catch (e) {
      setError(authWords(e, 'That didn’t save. Nothing’s lost; try again.'));
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
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 28,
          }}
        >
          <Heading>nearly in</Heading>
          <Txt variant="body" tone="soft">
            Google’s vouched for your email, so there’s no code to type. earshot just needs a badge for your song cards and to
            know which city’s board is yours.
          </Txt>

          <View style={{ alignItems: 'center', marginVertical: 20 }}>
            <PinBadge label={shownBadge || '?'} color={color} size={92} rotate={-6} />
          </View>

          <Field label="Name" value={shownName} onChangeText={setName} maxLength={40} autoCorrect={false} />
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <Field
              label="Handle"
              value={shownHandle}
              onChangeText={(v) => {
                setHandle(v.toLowerCase().replace(/[^a-z0-9._]/g, ''));
                setError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={28}
              containerStyle={{ flex: 1 }}
            />
            <Field
              label="Badge"
              value={shownBadge}
              onChangeText={(v) => setBadge(v.toUpperCase().slice(0, 2))}
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
                onPress={() => setColor(c)}
                accessibilityRole="radio"
                accessibilityState={{ selected: c === color }}
                accessibilityLabel={`Badge colour ${c}`}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, borderWidth: c === color ? 4 : 2, borderColor: colors.ink }}
              />
            ))}
          </View>

          <Txt variant="label" tone="soft" style={{ marginTop: 22, marginBottom: 8 }}>
            Where’s home? (a choice, not a location check)
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {cities.map((c) => {
              const on = c === city;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCity(c)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    borderWidth: 2,
                    borderColor: colors.ink,
                    backgroundColor: on ? colors.highlighter : colors.card,
                    borderRadius: 3,
                    paddingHorizontal: 12,
                    minHeight: 44,
                  }}
                >
                  <Txt variant="titleSm">{c}</Txt>
                  {on ? <Stamp rotate={-3}>Home</Stamp> : null}
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <Txt variant="small" tone="accent" style={{ marginTop: 16 }}>
              {error}
            </Txt>
          ) : null}
          <Agree value={agreed} onChange={setAgreed} />
          <PosterButton label={busy ? 'pressing your badge…' : 'that’s me. let’s go'} disabled={busy || !agreed} onPress={save} style={{ marginTop: 22 }} />
          <InkLink
            label="not you? log out"
            onPress={() =>
              logOut()
                .then(() => api.signOut())
                .then(() => router.replace('/welcome'))
            }
            style={{ alignSelf: 'center', marginTop: 18 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Paper>
  );
}
