/**
 * City: the notice board for a home area. Songs people who live there have
 * posted, with why, and who the place is paying attention to. Browsable from
 * anywhere; it has nothing to do with where your phone is.
 */
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pushProfile } from '@/backend/sync';
import { useApi, useLive, usePulse, useSession, type ArtistHeat, type CityPost } from '@/data';
import { cities, REGION } from '@/data/areas';
import { colors, tilt } from '@/theme';
import { Card, Heading, InkLink, Paper, PinBadge, PosterButton, Stamp, Tape, Txt } from '@/ui/print';
import { Sleeve } from '@/ui/Sleeve';
import { useSlip } from '@/ui/Slip';
import { DashedRule, SEND_LABEL } from '@/ui/SongCard';
import { ago } from '@/ui/SongPicker';

/** The chart: who this place can't stop posting and playing. */
function Chart({ scope, trending, onOpen }: { scope: string; trending: ArtistHeat[]; onOpen: (artist: string) => void }) {
  if (!trending.length) return null;
  const top = Math.max(...trending.map((t) => t.posts * 3 + t.plays));
  return (
    <View style={{ marginTop: 26 }}>
      <Heading>{scope === REGION ? 'what the gta won’t shut up about' : `what ${scope.toLowerCase()} won’t shut up about`}</Heading>
      <Card rotate={-0.6} innerStyle={{ paddingHorizontal: 14, paddingVertical: 6 }}>
        {trending.map((t, i) => {
          const share = (t.posts * 3 + t.plays) / top;
          const counts = [t.posts ? `${t.posts} ${t.posts === 1 ? 'post' : 'posts'}` : '', t.plays ? `${t.plays} ${t.plays === 1 ? 'play' : 'plays'}` : '']
            .filter(Boolean)
            .join(' · ');
          return (
            <View key={t.artist}>
              {i > 0 ? <DashedRule /> : null}
              <Pressable
                onPress={() => onOpen(t.artist)}
                accessibilityRole="button"
                accessibilityLabel={`${t.artist}, number ${i + 1}. ${counts} this week.`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}
              >
                <Txt variant="poster" tone="accent" style={{ width: 30, fontSize: 26, lineHeight: 30 }}>
                  {String(i + 1)}
                </Txt>
                <View style={{ flex: 1 }}>
                  <Txt variant="titleSm" numberOfLines={1}>
                    {t.artist}
                  </Txt>
                  {/* a highlighter swipe as long as the attention they're getting */}
                  <View style={{ height: 8, width: `${Math.max(12, share * 100)}%`, backgroundColor: colors.highlighter, borderWidth: 1.5, borderColor: colors.ink, marginTop: 4 }} />
                  <Txt variant="meta" tone="soft" style={{ marginTop: 4 }}>
                    {counts} this week
                  </Txt>
                </View>
                <Txt variant="meta" style={{ fontSize: 16 }}>
                  →
                </Txt>
              </Pressable>
            </View>
          );
        })}
      </Card>
      <Tape rotate={3} width={66} style={{ top: 34, right: 26 }} />
    </View>
  );
}

const PostCard = React.memo(function PostCard({
  post,
  showCity,
  onOpenArtist,
}: {
  post: CityPost;
  showCity: boolean;
  onOpenArtist: (artist: string) => void;
}) {
  const api = useApi();
  const slip = useSlip();
  const [sure, setSure] = useState(false);
  const first = post.person.name.split(' ')[0];
  const { link } = post;

  return (
    <View style={{ marginBottom: 24 }}>
      <Card rotate={tilt(post.id + 'post', 1.2)} innerStyle={{ padding: 14 }}>
        <Pressable
          onPress={() => router.push({ pathname: '/room/[id]', params: { id: post.person.id } })}
          accessibilityRole="button"
          accessibilityLabel={`Open ${post.person.name}'s room`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <PinBadge label={post.person.badge} color={post.person.badgeColor} size={38} rotate={tilt(post.person.id, 9)} />
          <View style={{ flex: 1 }}>
            <Txt variant="titleSm" numberOfLines={1}>
              {post.mine ? 'You' : post.person.name}
            </Txt>
            <Txt variant="meta" tone="soft" numberOfLines={1}>
              {showCity ? `posted to ${post.city}` : 'posted'} · {ago(post.postedAt)}
            </Txt>
          </View>
        </Pressable>

        {/* the reason comes first: that's the post */}
        <View style={{ marginTop: 16, marginHorizontal: 2 }}>
          <View style={{ backgroundColor: colors.highlighter, paddingHorizontal: 12, paddingTop: 13, paddingBottom: 9, transform: [{ rotate: `${tilt(post.id + 'n', 0.9)}deg` }] }}>
            <Txt variant="hand">{post.note}</Txt>
          </View>
          <Tape rotate={-5} width={56} style={{ top: -9, left: '12%' }} />
        </View>

        <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>
          <Sleeve track={post.track} size={84} />
          <View style={{ flex: 1, justifyContent: 'center', paddingLeft: 2 }}>
            <Txt variant="title" numberOfLines={2} style={{ fontSize: 19, lineHeight: 23 }}>
              {post.track.title}
            </Txt>
            <Txt variant="bodyItalic" numberOfLines={1}>
              {post.track.artist}
            </Txt>
            <Txt variant="meta" tone="soft" numberOfLines={1} style={{ marginTop: 2 }}>
              {post.track.album}
            </Txt>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          {post.mine ? (
            <PosterButton
              label={sure ? 'tap again to take it down' : 'take it down'}
              kind="plain"
              small
              style={{ flex: 1 }}
              onPress={() => {
                if (!sure) {
                  setSure(true);
                  setTimeout(() => setSure(false), 4000);
                  return;
                }
                api.removePost(post.id).then(
                  () => slip('Taken down. The city will cope.'),
                  () => slip('Couldn’t take that down. Try again.'),
                );
              }}
            />
          ) : (
            <PosterButton
              label={link.kind === 'none' ? `send ${first.toLowerCase()} a song` : SEND_LABEL[link.kind]}
              kind={link.kind === 'sent' ? 'plain' : 'primary'}
              small
              style={{ flex: 1 }}
              onPress={() => {
                if (link.kind === 'chat') router.push({ pathname: '/chat/[id]', params: { id: link.id } });
                else if (link.kind === 'none') router.push({ pathname: '/send/[id]', params: { id: post.person.id, artist: post.track.artist } });
                else router.navigate('/inbox');
              }}
            />
          )}
          <PosterButton
            label={post.saved ? 'saved' : 'save'}
            kind="plain"
            small
            accessibilityState={{ selected: post.saved }}
            style={{ minWidth: 84 }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              api.toggleSave(post.track).then(
                (saved) => slip(saved ? 'In your crate.' : 'Back on the shelf.'),
                () => slip('Couldn’t save that. Try again.'),
              );
            }}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
          <InkLink label={`${post.track.artist} · ${post.city}`} onPress={() => onOpenArtist(post.track.artist)} style={{ flexShrink: 1 }} />
          {post.mine ? null : (
            <Pressable
              onPress={() => router.push({ pathname: '/safety/[id]', params: { id: post.person.id, kind: 'post', cid: post.id } })}
              accessibilityRole="link"
              accessibilityLabel="Report this post"
              hitSlop={12}
            >
              <Txt variant="meta" tone="faint" style={{ textDecorationLine: 'underline' }}>
                report
              </Txt>
            </Pressable>
          )}
        </View>
      </Card>
    </View>
  );
});

export default function CityScreen() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const slip = useSlip();
  const { data: session } = useSession();
  const home = session?.me?.homeCity ?? cities[0];

  // Which notice board you're reading. Starts at home; null means "home, wherever that is now".
  const [picked, setPicked] = useState<string | null>(null);
  const scope = picked ?? home;
  const [moving, setMoving] = useState(false);
  const [pulling, setPulling] = useState(false);

  const feed = useLive((a) => a.getCityFeed(scope), ['city', 'inbox', 'nearby'], [scope]);
  usePulse(30_000); // posts that were due while you were reading get picked up

  const openArtist = useCallback(
    (artist: string) => router.push({ pathname: '/artist/[name]', params: { name: artist, scope } }),
    [scope],
  );

  const renderItem = useCallback(
    ({ item }: { item: CityPost }) => <PostCard post={item} showCity={scope === REGION} onOpenArtist={openArtist} />,
    [openArtist, scope],
  );

  if (!session?.me) return <Paper />;

  const scopes = [home, REGION, ...cities.filter((c) => c !== home)];
  const posts = feed.data?.scope === scope ? feed.data.posts : [];
  const trending = feed.data?.scope === scope ? feed.data.trending : [];
  const loading = feed.data?.scope !== scope;

  return (
    <Paper>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        initialNumToRender={4}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            tintColor={colors.ink}
            colors={[colors.ink]}
            onRefresh={() => {
              setPulling(true);
              feed.reload();
              setTimeout(() => setPulling(false), 500);
            }}
          />
        }
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: 28,
          paddingHorizontal: 16,
          width: '100%',
          maxWidth: 560,
          alignSelf: 'center',
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: 22 }}>
            <Txt variant="label" tone="soft">
              The notice board for
            </Txt>
            <View>
              <Txt variant="wordmark" color={colors.tomato} style={{ position: 'absolute', left: 3, top: 3 }} accessible={false} numberOfLines={1} adjustsFontSizeToFit>
                {scope === REGION ? 'the gta' : scope.toLowerCase()}
              </Txt>
              <Txt variant="wordmark" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
                {scope === REGION ? 'the gta' : scope.toLowerCase()}
              </Txt>
            </View>

            {/* which board to read */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginTop: 12 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {scopes.map((s) => {
                const on = s === scope;
                return (
                  <Pressable
                    key={s}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setPicked(s === home ? null : s);
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={s === home ? `${s}, your home` : s === REGION ? 'The whole GTA' : s}
                    style={{
                      borderWidth: 2,
                      borderColor: colors.ink,
                      backgroundColor: on ? colors.highlighter : colors.card,
                      borderRadius: 3,
                      paddingHorizontal: 12,
                      minHeight: 40,
                      justifyContent: 'center',
                    }}
                  >
                    <Txt variant="titleSm">
                      {s === REGION ? 'All of the GTA' : s}
                      {s === home ? ' (home)' : ''}
                    </Txt>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Txt variant="small" tone="soft" style={{ marginTop: 12 }}>
              {scope === REGION
                ? 'Every city in the region on one board, so the smaller ones are never talking to themselves.'
                : scope === home
                  ? 'Your home board. It stays yours wherever you go; Nearby is the one that travels.'
                  : `You’re reading ${scope}’s board as a visitor. Anything you post still goes to ${home}.`}
            </Txt>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
              <PosterButton label={`post a song to ${home.toLowerCase()}`} onPress={() => router.push('/post')} style={{ flexGrow: 1 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <Stamp rotate={-2}>{`Home: ${home}`}</Stamp>
              <InkLink label={moving ? 'never mind' : 'move home'} onPress={() => setMoving((m) => !m)} />
            </View>
            {moving ? (
              <Card rotate={0.5} style={{ marginTop: 14 }} innerStyle={{ padding: 12 }}>
                <Txt variant="small" tone="soft" style={{ marginBottom: 10 }}>
                  Home is a choice, not a location check. Moving changes where your posts go from now on; old posts stay where
                  you left them.
                </Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {cities.map((c) => (
                    <PosterButton
                      key={c}
                      small
                      kind={c === home ? 'primary' : 'plain'}
                      label={c}
                      onPress={() => {
                        if (c === home) return setMoving(false);
                        api.setHomeCity(c).then(
                          () => {
                            pushProfile(api);
                            setPicked(null);
                            setMoving(false);
                            slip(`Home is ${c} now. Welcome to the neighbourhood.`);
                          },
                          () => slip('Couldn’t move you. Try again.'),
                        );
                      }}
                    />
                  ))}
                </View>
              </Card>
            ) : null}

            <Chart scope={scope} trending={trending} onOpen={openArtist} />

            {posts.length ? <Heading style={{ marginTop: 30, marginBottom: 0 }}>pinned up lately</Heading> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Txt variant="hand" tone="soft" center style={{ marginTop: 10, fontSize: 26, lineHeight: 28 }}>
              reading the notice board…
            </Txt>
          ) : (
            <Card rotate={-0.8} innerStyle={{ padding: 18 }}>
              <Txt variant="title">{scope}’s board is bare.</Txt>
              <Txt variant="body" tone="soft" style={{ marginTop: 6 }}>
                {scope === home
                  ? 'Nobody here has posted yet. Somebody has to go first, and you’re the one holding a phone.'
                  : `Nobody in ${scope} has posted yet. If you know someone there, tell them the board’s empty and they could own it.`}
              </Txt>
            </Card>
          )
        }
        ListFooterComponent={
          posts.length ? (
            <Txt variant="hand" tone="soft" center style={{ fontSize: 24, lineHeight: 26, paddingHorizontal: 20 }}>
              that’s the bottom of the board. the rest got covered by gig posters.
            </Txt>
          ) : undefined
        }
      />
    </Paper>
  );
}
