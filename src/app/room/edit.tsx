/**
 * Decorate your room. The whole screen is printed in the look you're building,
 * so every change shows up the moment you make it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pushProfile } from '@/backend/sync';
import { useApi, useSession, type DisplayFont, type RoomSection, type RoomTheme, type SectionKind } from '@/data';
import { fonts } from '@/theme';
import { lookNames, looks, swatches } from '@/theme/looks';
import { BackLink, Field, goBack } from '@/ui/Field';
import { Card, Heading, InkLink, InkProvider, Paper, PinBadge, PosterButton, Txt, useInks, wash, type TextureName } from '@/ui/print';
import { roomDraft, useRoomDraft } from '@/ui/roomDraft';
import { inksFor, isDark } from '@/ui/roomInks';
import { SECTION_NAMES } from '@/ui/RoomSections';
import { useSlip } from '@/ui/Slip';
import { moved, Sortable } from '@/ui/Sortable';

const BADGE_COLORS = ['#F7A6BF', '#FFD23F', '#7FCFA9', '#F6B26B', '#F0502F', '#B9A7E8', '#8FD3E8', '#C6E377', '#FFF6EC'];

const SLOTS: { key: 'paper' | 'card' | 'ink' | 'accent' | 'highlight'; label: string }[] = [
  { key: 'paper', label: 'paper' },
  { key: 'card', label: 'cards' },
  { key: 'ink', label: 'ink' },
  { key: 'accent', label: 'buttons' },
  { key: 'highlight', label: 'highlighter' },
];

const FONTS: { key: DisplayFont; label: string }[] = [
  { key: 'poster', label: 'Gig poster' },
  { key: 'serifBlack', label: 'Record sleeve' },
  { key: 'typeBold', label: 'Typewriter' },
  { key: 'hand', label: 'Biro' },
];

const TEXTURES: { key: TextureName; label: string }[] = [
  { key: 'grain', label: 'plain' },
  { key: 'grid', label: 'graph paper' },
  { key: 'ruled', label: 'ruled' },
  { key: 'dots', label: 'dotted' },
];

const LAYOUTS: { key: RoomTheme['layout']; label: string; what: string }[] = [
  { key: 'loose', label: 'Loose', what: 'Everything sits straight on the paper.' },
  { key: 'pages', label: 'Pages', what: 'Each section is its own taped-down page.' },
  { key: 'poster', label: 'Poster', what: 'Big centred name, centred headings.' },
];

/** New furniture, as it arrives from the shop. */
const NEW_SECTION: Record<SectionKind, () => RoomSection> = {
  intro: () => ({ kind: 'intro', title: 'three songs, if we’ve never met', songs: [] }),
  pinned: () => ({ kind: 'pinned', title: 'the pinned record', trackId: null, note: '' }),
  wall: () => ({ kind: 'wall', title: 'the wall', trackIds: [] }),
  shelf: () => ({ kind: 'shelf', title: 'name this shelf', trackIds: [] }),
  liner: () => ({ kind: 'liner', title: 'liner notes', notes: [] }),
  guestbook: () => ({ kind: 'guestbook', title: 'guestbook', entries: [] }),
  recent: () => ({ kind: 'recent', title: 'recently played', visibility: 'shown', trackIds: [] }),
};
const ALL_KINDS = Object.keys(NEW_SECTION) as SectionKind[];
/** You can have as many of these as you like; the rest are one each. */
const REPEATABLE: SectionKind[] = ['shelf', 'liner'];

/** How different two colours are in brightness, 0 to 255. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1, 7), 16);
    return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  };
  return Math.abs(lum(a) - lum(b));
}

function Choice({ on, onPress, children, label }: { on: boolean; onPress: () => void; children: React.ReactNode; label: string }) {
  const inks = useInks();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={{
        borderWidth: on ? 3 : 2,
        borderColor: inks.ink,
        backgroundColor: on ? inks.highlight : inks.card,
        borderRadius: 3,
        paddingHorizontal: 12,
        minHeight: 44,
        justifyContent: 'center',
      }}
    >
      {children}
    </Pressable>
  );
}

export default function EditRoom() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const slip = useSlip();
  const { data: session } = useSession();
  const draft = useRoomDraft();
  const me = session?.me ?? null;

  // Load the room into the draft once, when the screen opens.
  const began = useRef(false);
  useEffect(() => {
    if (began.current || !me) return;
    began.current = true;
    api.getRoom(me.id).then((view) => view && roomDraft.begin(view));
  }, [api, me]);

  const [about, setAbout] = useState<{ name: string; tagline: string; bio: string; badge: string; badgeColor: string } | null>(null);
  const [aboutDirty, setAboutDirty] = useState(false);
  const [slot, setSlot] = useState<(typeof SLOTS)[number]['key']>('paper');
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const profile = about ?? (me ? { name: me.name, tagline: me.tagline, bio: me.bio, badge: me.badge, badgeColor: me.badgeColor } : null);
  const setProfile = (patch: Partial<NonNullable<typeof profile>>) => {
    if (!profile) return;
    setAbout({ ...profile, ...patch });
    setAboutDirty(true);
  };

  if (!me || !profile || !draft || draft.room.personId !== me.id) return <Paper />;

  const { room } = draft;
  const theme = room.theme;
  const inks = inksFor(theme);
  const setTheme = (patch: Partial<RoomTheme>) => roomDraft.update((r) => ({ ...r, theme: { ...r.theme, ...patch } }));
  const dirty = draft.dirty || aboutDirty;
  const hardToRead = contrast(theme.ink, theme.paper) < 90 || contrast(theme.ink, theme.card) < 90;
  const missing = ALL_KINDS.filter((k) => REPEATABLE.includes(k) || !room.sections.some((s) => s.kind === k));

  const save = async () => {
    if (!profile.name.trim()) {
      slip('You need a name. Any name.');
      return;
    }
    setSaving(true);
    try {
      if (aboutDirty) {
        await api.updateProfile(profile);
        pushProfile(api); // and to the backend, if this account lives there
      }
      await api.saveRoom(room, draft.added);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      slip('Saved. It looks like you live here now.');
      roomDraft.clear();
      goBack();
    } catch {
      slip('That didn’t save. Nothing’s lost; try again.');
      setSaving(false);
    }
  };

  const close = () => {
    if (dirty && !leaving) {
      setLeaving(true);
      setTimeout(() => setLeaving(false), 4000);
      return;
    }
    roomDraft.clear();
    goBack();
  };

  return (
    <InkProvider value={inks}>
      <StatusBar style={isDark(inks.paper) ? 'light' : 'dark'} />
      <Paper texture={theme.texture}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            scrollEnabled={!dragging}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: insets.top + 10,
              paddingBottom: insets.bottom + 40,
              paddingHorizontal: 16,
              width: '100%',
              maxWidth: 560,
              alignSelf: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <BackLink label={leaving ? 'tap again to throw changes away' : dirty ? 'close without saving' : 'close'} onPress={close} />
              <PosterButton label={saving ? 'saving…' : 'save'} small disabled={saving || !dirty} onPress={save} />
            </View>

            <Txt variant="poster" accessibilityRole="header" style={{ marginTop: 14 }}>
              decorate
            </Txt>
            <Txt variant="body" tone="soft" style={{ marginTop: 4 }}>
              This page is printed in your colours as you pick them. Nothing’s public until you save.
            </Txt>

            {/* ---- who you are ---- */}
            <Heading style={{ marginTop: 28 }}>about you</Heading>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 14 }}>
              <PinBadge label={profile.badge || '?'} color={profile.badgeColor} size={64} rotate={-6} />
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {BADGE_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setProfile({ badgeColor: c })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: c === profile.badgeColor }}
                    accessibilityLabel={`Badge colour ${c}`}
                    style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: c === profile.badgeColor ? 4 : 2, borderColor: inks.ink }}
                  />
                ))}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Field label="Name" value={profile.name} onChangeText={(name) => setProfile({ name })} maxLength={40} autoCorrect={false} containerStyle={{ flex: 1 }} />
              <Field
                label="Badge"
                value={profile.badge}
                onChangeText={(v) => setProfile({ badge: v.toUpperCase().slice(0, 2) })}
                maxLength={2}
                autoCapitalize="characters"
                autoCorrect={false}
                containerStyle={{ width: 78 }}
                style={{ textAlign: 'center' }}
              />
            </View>
            <Field
              label="One line for your song cards"
              value={profile.tagline}
              onChangeText={(tagline) => setProfile({ tagline })}
              placeholder="e.g. will defend the second album"
              maxLength={70}
              containerStyle={{ marginTop: 14 }}
            />
            <Field
              label="Bio"
              value={profile.bio}
              onChangeText={(bio) => setProfile({ bio })}
              placeholder="Who you are, in the time it takes to flip a record."
              multiline
              maxLength={200}
              containerStyle={{ marginTop: 14 }}
            />

            {/* ---- look ---- */}
            <Heading style={{ marginTop: 34 }}>start from a look</Heading>
            <Txt variant="small" tone="soft" style={{ marginBottom: 10 }}>
              Picking one replaces your colours, paper and lettering. Your sections stay as they are.
            </Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {lookNames.map((name) => {
                const l = looks[name];
                return (
                  <Pressable
                    key={name}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      roomDraft.update((r) => ({ ...r, theme: { ...l } }));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Use the ${name} look`}
                    style={{ width: 84, borderWidth: 2, borderColor: inks.ink, backgroundColor: l.paper, borderRadius: 3, padding: 8, alignItems: 'center' }}
                  >
                    <Txt style={{ fontFamily: fonts[l.displayFont], fontSize: 24, lineHeight: 30 }} color={l.ink}>
                      Aa
                    </Txt>
                    <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: l.accent, borderWidth: 1.5, borderColor: l.ink }} />
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: l.highlight, borderWidth: 1.5, borderColor: l.ink }} />
                    </View>
                    <Txt variant="meta" color={l.ink} style={{ marginTop: 4, fontSize: 10 }} numberOfLines={1}>
                      {name}
                    </Txt>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Heading style={{ marginTop: 34 }}>colours</Heading>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {SLOTS.map((s) => (
                <Choice key={s.key} on={slot === s.key} onPress={() => setSlot(s.key)} label={`Change the ${s.label} colour`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: theme[s.key], borderWidth: 2, borderColor: inks.ink }} />
                    <Txt variant="titleSm">{s.label}</Txt>
                  </View>
                </Choice>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {swatches.map((c) => {
                const on = theme[slot].toLowerCase() === c.toLowerCase();
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setTheme({ [slot]: c });
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Colour ${c}`}
                    style={{ width: 34, height: 34, borderRadius: 3, backgroundColor: c, borderWidth: on ? 4 : 2, borderColor: on ? inks.accent : wash(inks.ink, 0.7) }}
                  />
                );
              })}
            </View>
            {hardToRead ? (
              <Card rotate={-0.6} style={{ marginTop: 14 }} fill="#FFFDF7" innerStyle={{ padding: 12, borderColor: '#1F2A6B' }}>
                <Txt variant="titleSm" color="#1F2A6B">
                  Nobody will be able to read that.
                </Txt>
                <Txt variant="small" color="#1F2A6B">
                  Your ink is too close to your paper or cards. Bold choice, though. Change one of them before you save.
                </Txt>
              </Card>
            ) : null}

            <Heading style={{ marginTop: 34 }}>lettering</Heading>
            <View style={{ gap: 8 }}>
              {FONTS.map((f) => (
                <Choice key={f.key} on={theme.displayFont === f.key} onPress={() => setTheme({ displayFont: f.key })} label={`${f.label} lettering`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 6 }}>
                    <Txt style={{ fontFamily: fonts[f.key], fontSize: 22, lineHeight: 28, flexShrink: 1 }} numberOfLines={1}>
                      {profile.name || 'Your name here'}
                    </Txt>
                    <Txt variant="meta" tone="soft">
                      {f.label}
                    </Txt>
                  </View>
                </Choice>
              ))}
            </View>

            <Heading style={{ marginTop: 34 }}>paper</Heading>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {TEXTURES.map((t) => (
                <Choice key={t.key} on={theme.texture === t.key || (t.key === 'grain' && theme.texture === 'none')} onPress={() => setTheme({ texture: t.key })} label={`${t.label} paper`}>
                  <Txt variant="titleSm">{t.label}</Txt>
                </Choice>
              ))}
            </View>

            <Heading style={{ marginTop: 34 }}>layout</Heading>
            <View style={{ gap: 8 }}>
              {LAYOUTS.map((l) => (
                <Choice key={l.key} on={theme.layout === l.key} onPress={() => setTheme({ layout: l.key })} label={`${l.label} layout`}>
                  <View style={{ paddingVertical: 6 }}>
                    <Txt variant="titleSm">{l.label}</Txt>
                    <Txt variant="small" tone="soft">
                      {l.what}
                    </Txt>
                  </View>
                </Choice>
              ))}
            </View>
            <Txt variant="label" tone="soft" style={{ marginTop: 16, marginBottom: 8 }}>
              How the album wall hangs
            </Txt>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Choice on={theme.wall === 'grid'} onPress={() => setTheme({ wall: 'grid' })} label="Tidy grid">
                <Txt variant="titleSm">tidy grid</Txt>
              </Choice>
              <Choice on={theme.wall === 'scatter'} onPress={() => setTheme({ wall: 'scatter' })} label="Taped up any old way">
                <Txt variant="titleSm">taped up any old way</Txt>
              </Choice>
            </View>

            {/* ---- sections ---- */}
            <Heading style={{ marginTop: 34 }}>what’s in the room</Heading>
            <Txt variant="small" tone="soft" style={{ marginBottom: 8 }}>
              Hold the dots and drag to reorder, or use the arrows. Tap a section to fill it, rename it or put stickers on it.
            </Txt>
            <Card innerStyle={{ paddingVertical: 4, paddingRight: 4 }}>
              <Sortable
                items={room.sections}
                keyOf={(s, i) => `${s.kind}:${s.title}:${i}`}
                labelOf={(s) => s.title || SECTION_NAMES[s.kind]}
                rowHeight={60}
                onDragging={setDragging}
                onReorder={(from, to) => roomDraft.update((r) => ({ ...r, sections: moved(r.sections, from, to) }))}
                renderRow={(s, i) => (
                  <Pressable
                    onPress={() => router.push({ pathname: '/room/section/[index]', params: { index: String(i) } })}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${s.title || SECTION_NAMES[s.kind]}`}
                    style={{ height: 56, justifyContent: 'center' }}
                  >
                    <Txt variant="titleSm" numberOfLines={1}>
                      {s.title || SECTION_NAMES[s.kind]}
                    </Txt>
                    <Txt variant="meta" tone="soft" numberOfLines={1}>
                      {SECTION_NAMES[s.kind]}
                      {s.kind === 'recent' && s.visibility === 'hidden' ? ' · hidden' : ''}
                    </Txt>
                  </Pressable>
                )}
              />
            </Card>
            {room.sections.length === 0 ? (
              <Txt variant="bodyItalic" tone="soft" style={{ marginTop: 10 }}>
                An empty room. Minimalist. Add something below before people start to worry.
              </Txt>
            ) : null}

            <Txt variant="label" tone="soft" style={{ marginTop: 18, marginBottom: 8 }}>
              Add a section
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {missing.map((k) => (
                <PosterButton
                  key={k}
                  small
                  kind="plain"
                  label={`+ ${SECTION_NAMES[k].toLowerCase()}`}
                  onPress={() => {
                    const at = room.sections.length;
                    roomDraft.update((r) => ({ ...r, sections: [...r.sections, NEW_SECTION[k]()] }));
                    router.push({ pathname: '/room/section/[index]', params: { index: String(at) } });
                  }}
                />
              ))}
            </View>

            <PosterButton label={saving ? 'saving…' : 'save my room'} disabled={saving || !dirty} onPress={save} style={{ marginTop: 34 }} />
            <InkLink label="back to the plain look" onPress={() => roomDraft.update((r) => ({ ...r, theme: { ...looks.house } }))} style={{ alignSelf: 'center', marginTop: 18 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Paper>
    </InkProvider>
  );
}
