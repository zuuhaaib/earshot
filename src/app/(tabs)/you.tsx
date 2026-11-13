import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { currentAccount, logOut as logOutOfBackend, type CloudProfile } from '@/backend/accounts';
import { cloudConfigured, isCloudId } from '@/backend/config';
import { useApi, useLive, useSession } from '@/data';
import { colors, tilt } from '@/theme';
import { TrackRow } from '@/ui/Field';
import { Card, Heading, InkLink, Paper, PinBadge, PosterButton, Stamp, Txt } from '@/ui/print';
import { useSlip } from '@/ui/Slip';
import { PhoneImportCard } from '@/ui/PhoneImportCard';
import { LastfmCard } from '@/ui/LastfmCard';
import { SpotifyCard } from '@/ui/SpotifyCard';
import { DashedRule } from '@/ui/SongCard';

/** You: your room, your crate, and who's holding the phone. */
export default function YouScreen() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const slip = useSlip();
  const { data: session } = useSession();
  const { data: crate } = useLive((a) => a.getCrate(), ['crate', 'session']);
  const { data: accounts } = useLive((a) => a.listAccounts(), ['session']);
  // Whoever is logged in to the backend on this phone (which can differ from `me` while you've borrowed a resident).
  const { data: cloudAccount } = useLive<CloudProfile | null>(() => currentAccount().catch(() => null), ['session']);

  // Wiping takes two presses, a few seconds apart at most.
  const [armed, setArmed] = useState(false);
  const disarm = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (disarm.current && clearTimeout(disarm.current)), []);

  const me = session?.me;
  if (!me) return <Paper />;
  // Accounts made on this phone need their password; the seeded residents can just be borrowed.
  const cloud = cloudConfigured();
  const onBackend = isCloudId(me.id);
  // With a backend, other accounts are reached by logging in with their email, not from a list on the phone.
  const others = cloud ? [] : (accounts ?? []).filter((p) => !p.seeded && p.id !== me.id);
  const onServer = api.kind === 'server'; // all data on the backend, not just the account
  const phoneOnly = cloud && !onServer && !me.seeded && !onBackend;
  const residentsToBorrow = (accounts ?? []).filter((p) => p.seeded);

  const wipe = async () => {
    if (!armed) {
      setArmed(true);
      disarm.current = setTimeout(() => setArmed(false), 5000);
      return;
    }
    if (disarm.current) clearTimeout(disarm.current);
    setArmed(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    await api.resetEverything().catch(() => slip('The wipe didn’t finish. Try again.'));
  };

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
          you
        </Txt>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 }}>
          <PinBadge label={me.badge} color={me.badgeColor} size={70} rotate={tilt(me.id, 8)} />
          <View style={{ flex: 1 }}>
            <Txt variant="title">{me.name}</Txt>
            <Txt variant="meta" tone="soft">
              @{me.handle}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <Stamp rotate={-2}>{`Home: ${me.homeCity}`}</Stamp>
              {me.seeded ? (
                <Stamp rotate={2} color={colors.tomato}>
                  Borrowed
                </Stamp>
              ) : null}
            </View>
          </View>
        </View>

        {me.tagline ? (
          <Txt variant="hand" tone="soft" style={{ marginTop: 12 }}>
            {me.tagline}
          </Txt>
        ) : null}

        <Card rotate={0.7} style={{ marginTop: 20 }} innerStyle={{ padding: 16 }}>
          <Txt variant="titleSm">Your room</Txt>
          <Txt variant="body" tone="soft" style={{ marginTop: 4 }}>
            {me.seeded
              ? `You’re in ${me.name.split(' ')[0]}’s room. Move the furniture if you like; they’ll never know it was you.`
              : 'The page people land on when they tap your name. Paint it, fill the shelves, cover it in stickers.'}
          </Txt>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <PosterButton label="decorate" small onPress={() => router.push('/room/edit')} style={{ flex: 1 }} />
            <PosterButton
              label="see it"
              kind="plain"
              small
              onPress={() => router.push({ pathname: '/room/[id]', params: { id: me.id } })}
              style={{ flex: 1 }}
            />
          </View>
        </Card>

        <Heading style={{ marginTop: 34 }}>what you’re playing</Heading>
        <SpotifyCard userId={me.id} />
        <LastfmCard userId={me.id} />

        <Heading style={{ marginTop: 34 }}>your crate</Heading>
        {crate?.length ? (
          <Card innerStyle={{ paddingHorizontal: 12, paddingVertical: 4 }}>
            {crate.map((t, i) => (
              <View key={t.id}>
                {i > 0 ? <DashedRule /> : null}
                <TrackRow
                  track={t}
                  size={46}
                  right={<InkLink label="drop" onPress={() => api.toggleSave(t).catch(() => slip('Couldn’t drop that. Try again.'))} />}
                />
              </View>
            ))}
          </Card>
        ) : (
          <Txt variant="body" tone="soft">
            Empty. Save a song from Nearby and it lands here, ready for when you need something to send.
          </Txt>
        )}

        {phoneOnly ? (
          <Card rotate={-0.6} style={{ marginTop: 26 }} fill={colors.highlighter} innerStyle={{ padding: 14 }}>
            <Txt variant="titleSm">This account only exists on this phone.</Txt>
            <Txt variant="small" style={{ marginTop: 4 }}>
              It was made before earshot had real accounts. Add an email and verify it, and your room, crate, chats and posts
              move to an account you can log in to from anywhere and reset the password of.
            </Txt>
            <PosterButton label="make it a real account" small onPress={() => router.push('/upgrade')} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
          </Card>
        ) : null}

        {!cloud && session.needsPassword ? (
          <Card rotate={-0.6} style={{ marginTop: 26 }} fill={colors.highlighter} innerStyle={{ padding: 14 }}>
            <Txt variant="titleSm">This account has no password.</Txt>
            <Txt variant="small" style={{ marginTop: 4 }}>
              It was made before earshot had them, so anyone holding this phone can be you. Takes ten seconds to fix.
            </Txt>
            <PosterButton label="set a password" small onPress={() => router.push('/password')} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
          </Card>
        ) : null}

        <Heading style={{ marginTop: 34 }}>your account</Heading>
        <Txt variant="body" tone="soft">
          {me.seeded
            ? `You’ve borrowed ${me.name.split(' ')[0]}, one of the test residents. Log out or switch to get back to yourself.`
            : onBackend
              ? `Logged in as @${me.handle}${cloudAccount?.email ? ` (${cloudAccount.email}, verified)` : ''}. You stay logged in on this phone until you log out.`
              : `Logged in as @${me.handle}. You stay logged in on this phone until you log out.`}
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
          <PosterButton
            label="log out"
            kind="plain"
            small
            onPress={() =>
              // log out of the backend first, then forget who's signed in on the phone
              logOutOfBackend()
                .then(() => api.signOut())
                .then(() => router.replace('/welcome'), () => slip('Couldn’t log out. Try again.'))
            }
          />
          {me.seeded && cloudAccount ? (
            <PosterButton
              label={`back to @${cloudAccount.handle}`}
              small
              onPress={() => api.adoptAccount(cloudAccount).then(() => slip('You’re you again.'), () => slip('Couldn’t switch back. Try again.'))}
            />
          ) : null}
          {me.seeded || phoneOnly || (!cloud && session.needsPassword) ? null : (
            <PosterButton label="change password" kind="plain" small onPress={() => router.push('/password')} />
          )}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 22, marginTop: 18 }}>
          <InkLink label="blocked people" onPress={() => router.push('/blocked')} />
          {me.seeded || (cloud && !onServer) ? null : <InkLink label="delete account" onPress={() => router.push('/delete-account')} />}
        </View>

        {others.length ? (
          <>
            <Txt variant="label" tone="soft" style={{ marginTop: 22, marginBottom: 10 }}>
              Other accounts on this phone
            </Txt>
            <View style={{ gap: 12 }}>
              {others.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Log in as ${p.name}`}
                  onPress={() => router.push({ pathname: '/login', params: { handle: p.handle } })}
                >
                  <Card rotate={tilt(p.id + 'acct', 0.9)} shadow={4} innerStyle={{ padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <PinBadge label={p.badge} color={p.badgeColor} size={40} />
                    <View style={{ flex: 1 }}>
                      <Txt variant="titleSm" numberOfLines={1}>
                        {p.name}
                      </Txt>
                      <Txt variant="meta" tone="soft" numberOfLines={1}>
                        @{p.handle} · needs its password
                      </Txt>
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {onServer ? <PhoneImportCard /> : null}

        {residentsToBorrow.length ? (
          <>
        <Heading style={{ marginTop: 34 }}>test residents</Heading>
        <Txt variant="body" tone="soft" style={{ marginBottom: 14 }}>
          These come with the app and have no password, so you can try both sides of a conversation on one phone. Anyone
          you’ve swapped a song with joins the list. They go away when earshot has real people in it.
        </Txt>
        <View style={{ gap: 12 }}>
          {residentsToBorrow.map((p) => {
            const current = p.id === me.id;
            return (
              <Pressable
                key={p.id}
                disabled={current}
                accessibilityRole="button"
                accessibilityLabel={current ? `${p.name}, borrowed now` : `Borrow ${p.name}`}
                onPress={async () => {
                  Haptics.selectionAsync().catch(() => {});
                  await api.signIn(p.id).then(
                    () => slip(`You’re ${p.name.split(' ')[0]} now. Be nice with their account.`),
                    () => slip('Couldn’t switch. Try again.'),
                  );
                }}
              >
                <Card
                  rotate={tilt(p.id + 'acct', 0.9)}
                  shadow={current ? 2 : 4}
                  fill={current ? colors.highlighter : undefined}
                  innerStyle={{ padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}
                >
                  <PinBadge label={p.badge} color={p.badgeColor} size={40} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="titleSm" numberOfLines={1}>
                      {p.name}
                    </Txt>
                    <Txt variant="meta" tone="soft" numberOfLines={1}>
                      resident · @{p.handle}
                    </Txt>
                  </View>
                  {current ? <Stamp rotate={-3}>You</Stamp> : null}
                </Card>
              </Pressable>
            );
          })}
        </View>
          </>
        ) : null}
        <PosterButton
          label="make another account"
          kind="plain"
          onPress={() =>
            logOutOfBackend()
              .then(() => api.signOut())
              .then(() => router.replace('/welcome'))
          }
          style={{ alignSelf: 'flex-start', marginTop: 16 }}
        />

        <Heading style={{ marginTop: 34 }}>the small print</Heading>
        <Txt variant="body" tone="soft">
          {onServer
            ? 'Everything you do in earshot now lives on its server: your account, room, saved songs, chats, posts, threads and what you’ve shared. The server keeps only a scrambled fingerprint of your password, and nobody can read your chats or see your area but you (and the person you’re chatting with).'
            : cloud
            ? 'Your account (email, password, name, handle, badge, bio, home city) lives on earshot’s server. The server keeps only a scrambled fingerprint of your password and handles email verification, resets and login limits. Everything else, for now, still lives on this phone: your room, saved songs, chats, posts and what you’ve played.'
            : 'Everything in this version lives on this phone: accounts, saved songs, what you’ve played. Nothing is sent to a server, because there isn’t one yet. Passwords are kept only as a scrambled fingerprint, and can’t be reset.'} The only location kept is a neighbourhood name
          {session.area ? ` (right now: ${session.area.name})` : ' (none so far)'}.
        </Txt>
        {onServer ? null : (
          <>
        <PosterButton
          label={armed ? 'press again to wipe everything' : 'wipe this phone and start over'}
          kind={armed ? 'primary' : 'plain'}
          onPress={wipe}
          style={{ alignSelf: 'flex-start', marginTop: 16 }}
        />
        <Txt variant="small" tone="soft" style={{ marginTop: 8 }}>
          Deletes every account, song and setting on this device and puts the residents back as they were. It can’t be
          undone.
        </Txt>
          </>
        )}
      </ScrollView>
    </Paper>
  );
}
