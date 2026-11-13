/**
 * One piece of furniture: rename it, fill it, cover it in stickers, or throw it
 * out. Works on the shared draft, so nothing is saved until the decorate
 * screen's save button is pressed.
 */
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RoomSection, Sticker, StickerKind } from '@/data';
import type { Track } from '@/music';
import { BackLink, Field, goBack, TrackRow } from '@/ui/Field';
import { Card, Heading, InkLink, InkProvider, Paper, PosterButton, Txt, useInks } from '@/ui/print';
import { chooseSong, roomDraft, useRoomDraft, type Draft } from '@/ui/roomDraft';
import { inksFor, isDark } from '@/ui/roomInks';
import { RoomLookupProvider, SECTION_NAMES, SectionBody } from '@/ui/RoomSections';
import { DashedRule } from '@/ui/SongCard';
import { moved, Sortable } from '@/ui/Sortable';
import { STICKER_KINDS, StickerArt } from '@/ui/Sticker';

const MAX = { wall: 12, shelf: 10, liner: 8, stickers: 5 };

/** Ask for a song and remember it in the draft. */
async function pick(prompt: string): Promise<Track | null> {
  const track = await chooseSong(prompt);
  if (track) roomDraft.addTrack(track);
  return track;
}

// ---- stickers ---------------------------------------------------------------

function DraggableSticker({
  sticker,
  box,
  selected,
  onSelect,
  onMove,
  onDragging,
}: {
  sticker: Sticker;
  box: { w: number; h: number };
  selected: boolean;
  onSelect: () => void;
  onMove: (dx: number, dy: number) => void;
  onDragging: (dragging: boolean) => void;
}) {
  const inks = useInks();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const last = useRef({ x: 0, y: 0, active: false });

  // Once the new position has landed in the draft, let go of the drag offset.
  useEffect(() => {
    tx.set(0);
    ty.set(0);
  }, [sticker.x, sticker.y, tx, ty]);

  const pan = usePanGesture({
    runOnJS: true,
    activateAfterLongPress: 90,
    onActivate: () => {
      last.current = { x: 0, y: 0, active: true };
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onSelect();
      onDragging(true);
    },
    onUpdate: (e) => {
      tx.set(e.translationX);
      ty.set(e.translationY);
      last.current.x = e.translationX;
      last.current.y = e.translationY;
    },
    onFinalize: () => {
      if (!last.current.active) return;
      last.current.active = false;
      onDragging(false);
      if (box.w && box.h && (last.current.x || last.current.y)) onMove(last.current.x / box.w, last.current.y / box.h);
    },
  });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotate: `${sticker.rotate}deg` }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          { position: 'absolute', left: `${sticker.x * 100}%`, top: `${sticker.y * 100}%`, width: sticker.size, height: sticker.size, zIndex: 5 },
          style,
        ]}
      >
        <Pressable onPress={onSelect} accessibilityRole="button" accessibilityLabel={`${sticker.kind} sticker. Hold and drag to move.`} style={{ flex: 1 }}>
          <StickerArt sticker={sticker} />
        </Pressable>
        {selected ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: -5, top: -5, right: -5, bottom: -5, borderWidth: 2, borderColor: inks.accent, borderStyle: 'dashed', borderRadius: 4 }}
          />
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

function Stickers({
  section,
  index,
  draft,
  width,
  onDragging,
}: {
  section: RoomSection;
  index: number;
  draft: Draft;
  width: number;
  onDragging: (dragging: boolean) => void;
}) {
  const inks = useInks();
  const theme = draft.room.theme;
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [chosen, setChosen] = useState<number | null>(null);
  const stickers = section.stickers ?? [];
  const current = chosen !== null ? stickers[chosen] : undefined;

  const setStickers = (next: Sticker[]) => roomDraft.updateSection(index, (s) => ({ ...s, stickers: next }));
  const change = (i: number, patch: Partial<Sticker>) => setStickers(stickers.map((s, n) => (n === i ? { ...s, ...patch } : s)));
  const palette = [...new Set([theme.highlight, theme.accent, theme.card, '#FFD23F', '#F7A6BF', '#7FCFA9', '#8FD3E8', '#FFFFFF'])];

  const add = (kind: StickerKind) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const n = stickers.length;
    setStickers([
      ...stickers,
      { kind, color: palette[n % palette.length], x: 0.62 - n * 0.1, y: 0.06 + n * 0.08, size: 56, rotate: n % 2 ? 10 : -10, ...(kind === 'burst' ? { label: 'no\nskips' } : {}) },
    ]);
    setChosen(n);
  };

  return (
    <View>
      <Heading style={{ marginTop: 34 }}>stickers</Heading>
      <Txt variant="small" tone="soft" style={{ marginBottom: 10 }}>
        Tap one to stick it on. Then hold it and drag it where you want it. Up to {MAX.stickers} per section.
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {STICKER_KINDS.map((kind, i) => (
          <Pressable
            key={kind}
            disabled={stickers.length >= MAX.stickers}
            onPress={() => add(kind)}
            accessibilityRole="button"
            accessibilityLabel={`Add a ${kind} sticker`}
            style={{ width: 44, height: 44, opacity: stickers.length >= MAX.stickers ? 0.35 : 1 }}
          >
            <StickerArt sticker={{ kind, color: palette[i % palette.length], size: 44 }} />
          </Pressable>
        ))}
      </View>

      {/* the section as it'll look, with its stickers loose on top */}
      <View
        onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={{ minHeight: 110, paddingVertical: 6 }}
      >
        <View pointerEvents="none">
          <SectionBody section={section} theme={theme} width={width} />
        </View>
        {stickers.map((s, i) => (
          <DraggableSticker
            key={i}
            sticker={s}
            box={box}
            selected={chosen === i}
            onSelect={() => setChosen(i)}
            onDragging={onDragging}
            onMove={(dx, dy) =>
              change(i, { x: Math.max(-0.12, Math.min(0.92, s.x + dx)), y: Math.max(-0.2, Math.min(0.95, s.y + dy)) })
            }
          />
        ))}
      </View>

      {current && chosen !== null ? (
        <Card rotate={0.5} style={{ marginTop: 18 }} innerStyle={{ padding: 12 }}>
          <Txt variant="label" tone="soft" style={{ marginBottom: 8 }}>
            The {current.kind} you tapped
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {palette.map((c) => (
              <Pressable
                key={c}
                onPress={() => change(chosen, { color: c })}
                accessibilityRole="radio"
                accessibilityState={{ selected: current.color === c }}
                accessibilityLabel={`Sticker colour ${c}`}
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: current.color === c ? 4 : 2, borderColor: inks.ink }}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <PosterButton small kind="plain" label="smaller" disabled={current.size <= 32} onPress={() => change(chosen, { size: current.size - 8 })} />
            <PosterButton small kind="plain" label="bigger" disabled={current.size >= 104} onPress={() => change(chosen, { size: current.size + 8 })} />
            <PosterButton small kind="plain" label="tilt left" onPress={() => change(chosen, { rotate: current.rotate - 8 })} />
            <PosterButton small kind="plain" label="tilt right" onPress={() => change(chosen, { rotate: current.rotate + 8 })} />
          </View>
          {current.kind === 'burst' ? (
            <Field
              label="What it says (keep it short)"
              value={(current.label ?? '').replace('\n', ' ')}
              onChangeText={(v) => change(chosen, { label: v.slice(0, 14).replace(' ', '\n') })}
              maxLength={14}
              autoCorrect={false}
              containerStyle={{ marginTop: 12 }}
            />
          ) : null}
          <InkLink
            label="peel it off"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setStickers(stickers.filter((_, n) => n !== chosen));
              setChosen(null);
            }}
            style={{ alignSelf: 'flex-start', marginTop: 14 }}
          />
        </Card>
      ) : null}
    </View>
  );
}

// ---- lists of records (wall and shelf) --------------------------------------

function Records({
  ids,
  draft,
  max,
  onChange,
  onDragging,
}: {
  ids: string[];
  draft: Draft;
  max: number;
  onChange: (ids: string[]) => void;
  onDragging: (dragging: boolean) => void;
}) {
  return (
    <View>
      {ids.length ? (
        <Card innerStyle={{ paddingVertical: 2, paddingRight: 4 }}>
          <Sortable
            items={ids}
            keyOf={(id, i) => `${id}:${i}`}
            labelOf={(id) => draft.tracks[id]?.title ?? 'record'}
            rowHeight={62}
            onDragging={onDragging}
            onReorder={(from, to) => onChange(moved(ids, from, to))}
            renderRow={(id, i) => {
              const t = draft.tracks[id];
              return t ? (
                <TrackRow track={t} size={40} right={<InkLink label="off" onPress={() => onChange(ids.filter((_, n) => n !== i))} />} />
              ) : null;
            }}
          />
        </Card>
      ) : null}
      <PosterButton
        label={ids.length >= max ? `full (${max} is plenty)` : 'add a record'}
        kind="plain"
        disabled={ids.length >= max}
        onPress={async () => {
          const t = await pick('Which record?');
          if (t && !ids.includes(t.id)) onChange([...ids, t.id]);
        }}
        style={{ alignSelf: 'flex-start', marginTop: 14 }}
      />
    </View>
  );
}

/** A chosen song, or a button to choose one. */
function SongSlot({ track, prompt, onPick, onClear }: { track: Track | null | undefined; prompt: string; onPick: (t: Track) => void; onClear?: () => void }) {
  const choose = async () => {
    const t = await pick(prompt);
    if (t) onPick(t);
  };
  if (!track) return <PosterButton label="choose a song" kind="plain" small onPress={choose} style={{ alignSelf: 'flex-start' }} />;
  return (
    <TrackRow
      track={track}
      size={46}
      right={
        <View style={{ gap: 6, alignItems: 'flex-end' }}>
          <InkLink label="change" onPress={choose} />
          {onClear ? <InkLink label="remove" onPress={onClear} /> : null}
        </View>
      }
    />
  );
}

// ---- the screen -------------------------------------------------------------

export default function EditSection() {
  const insets = useSafeAreaInsets();
  const { width: screen } = useWindowDimensions();
  const { index: raw } = useLocalSearchParams<{ index: string }>();
  const index = Number(raw);
  const draft = useRoomDraft();
  const [dragging, setDragging] = useState(false);
  const [binning, setBinning] = useState(false);

  const section = draft?.room.sections[index];
  if (!draft || !section) {
    return (
      <Paper>
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
          <BackLink />
        </View>
      </Paper>
    );
  }

  const inks = inksFor(draft.room.theme);
  const width = Math.min(screen, 560) - 32;
  const set = (change: (s: RoomSection) => RoomSection) => roomDraft.updateSection(index, change);

  const bin = () => {
    if (!binning) {
      setBinning(true);
      setTimeout(() => setBinning(false), 4000);
      return;
    }
    roomDraft.update((r) => ({ ...r, sections: r.sections.filter((_, i) => i !== index) }));
    goBack();
  };

  return (
    <InkProvider value={inks}>
      <StatusBar style={isDark(inks.paper) ? 'light' : 'dark'} />
      <RoomLookupProvider value={{ tracks: draft.tracks, people: draft.people, mine: true }}>
        <Paper texture={draft.room.theme.texture}>
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
              <BackLink label="done" />
              <Txt variant="label" tone="soft" style={{ marginTop: 16 }}>
                {SECTION_NAMES[section.kind]}
              </Txt>
              <Field
                value={section.title}
                onChangeText={(title) => set((s) => ({ ...s, title }))}
                placeholder="Give it a name"
                maxLength={60}
                accessibilityLabel="Section name"
                hint={section.kind === 'shelf' ? 'Shelf names are half the fun. “albums for the walk home”. “songs i can only hear after midnight”.' : undefined}
                containerStyle={{ marginTop: 6, marginBottom: 22 }}
              />

              {section.kind === 'intro' && (
                <View style={{ gap: 18 }}>
                  <Txt variant="body" tone="soft">
                    Three songs for someone who’s never met you, and a line about each.
                  </Txt>
                  {[0, 1, 2].map((n) => {
                    const song = section.songs[n];
                    if (!song && n > section.songs.length) return null;
                    return (
                      <Card key={n} rotate={n % 2 ? 0.5 : -0.5} shadow={4} innerStyle={{ padding: 12 }}>
                        <Txt variant="label" tone="accent" style={{ marginBottom: 4 }}>
                          Song {n + 1}
                        </Txt>
                        <SongSlot
                          track={song ? draft.tracks[song.trackId] : null}
                          prompt={`Song ${n + 1} of three`}
                          onPick={(t) =>
                            set((s) =>
                              s.kind === 'intro'
                                ? { ...s, songs: song ? s.songs.map((x, i) => (i === n ? { ...x, trackId: t.id } : x)) : [...s.songs, { trackId: t.id, why: '' }] }
                                : s,
                            )
                          }
                          onClear={song ? () => set((s) => (s.kind === 'intro' ? { ...s, songs: s.songs.filter((_, i) => i !== n) } : s)) : undefined}
                        />
                        {song ? (
                          <Field
                            value={song.why}
                            onChangeText={(why) => set((s) => (s.kind === 'intro' ? { ...s, songs: s.songs.map((x, i) => (i === n ? { ...x, why } : x)) } : s))}
                            placeholder="Why this one?"
                            maxLength={90}
                            accessibilityLabel={`Why song ${n + 1}`}
                            containerStyle={{ marginTop: 8 }}
                          />
                        ) : null}
                      </Card>
                    );
                  })}
                </View>
              )}

              {section.kind === 'pinned' && (
                <View>
                  <SongSlot
                    track={section.trackId ? draft.tracks[section.trackId] : null}
                    prompt="The record you’d pin to the wall"
                    onPick={(t) => set((s) => (s.kind === 'pinned' ? { ...s, trackId: t.id } : s))}
                    onClear={() => set((s) => (s.kind === 'pinned' ? { ...s, trackId: null } : s))}
                  />
                  <Field
                    label="Where were you when you first heard it?"
                    value={section.note}
                    onChangeText={(note) => set((s) => (s.kind === 'pinned' ? { ...s, note } : s))}
                    placeholder="A place, a year, who was there. The more specific, the better."
                    multiline
                    maxLength={260}
                    containerStyle={{ marginTop: 16 }}
                  />
                </View>
              )}

              {(section.kind === 'wall' || section.kind === 'shelf') && (
                <Records
                  ids={section.trackIds}
                  draft={draft}
                  max={section.kind === 'wall' ? MAX.wall : MAX.shelf}
                  onDragging={setDragging}
                  onChange={(trackIds) => set((s) => (s.kind === 'wall' || s.kind === 'shelf' ? { ...s, trackIds } : s))}
                />
              )}

              {section.kind === 'liner' && (
                <View style={{ gap: 16 }}>
                  {section.notes.map((n, i) => (
                    <Card key={i} rotate={i % 2 ? 0.4 : -0.4} shadow={4} innerStyle={{ padding: 12 }}>
                      <Field
                        value={n.text}
                        onChangeText={(text) => set((s) => (s.kind === 'liner' ? { ...s, notes: s.notes.map((x, k) => (k === i ? { ...x, text } : x)) } : s))}
                        placeholder="A short review, a stray thought, a story."
                        multiline
                        maxLength={280}
                        accessibilityLabel={`Note ${i + 1}`}
                      />
                      <View style={{ marginTop: 8 }}>
                        {n.trackId && draft.tracks[n.trackId] ? (
                          <SongSlot
                            track={draft.tracks[n.trackId]}
                            prompt="Which song is this about?"
                            onPick={(t) => set((s) => (s.kind === 'liner' ? { ...s, notes: s.notes.map((x, k) => (k === i ? { ...x, trackId: t.id } : x)) } : s))}
                            onClear={() => set((s) => (s.kind === 'liner' ? { ...s, notes: s.notes.map((x, k) => (k === i ? { text: x.text } : x)) } : s))}
                          />
                        ) : (
                          <InkLink
                            label="attach it to a song"
                            onPress={async () => {
                              const t = await pick('Which song is this about?');
                              if (t) set((s) => (s.kind === 'liner' ? { ...s, notes: s.notes.map((x, k) => (k === i ? { ...x, trackId: t.id } : x)) } : s));
                            }}
                            style={{ alignSelf: 'flex-start' }}
                          />
                        )}
                      </View>
                      <InkLink
                        label="tear this note out"
                        onPress={() => set((s) => (s.kind === 'liner' ? { ...s, notes: s.notes.filter((_, k) => k !== i) } : s))}
                        style={{ alignSelf: 'flex-start', marginTop: 12 }}
                      />
                    </Card>
                  ))}
                  <PosterButton
                    label="add a note"
                    kind="plain"
                    disabled={section.notes.length >= MAX.liner}
                    onPress={() => set((s) => (s.kind === 'liner' ? { ...s, notes: [...s.notes, { text: '' }] } : s))}
                    style={{ alignSelf: 'flex-start' }}
                  />
                </View>
              )}

              {section.kind === 'guestbook' && (
                <View>
                  <Txt variant="body" tone="soft">
                    Visitors leave a track here and say why they picked it. You can’t write in it or edit what people said, but
                    you can tear a page out.
                  </Txt>
                  {section.entries.map((e, i) => {
                    const t = draft.tracks[e.trackId];
                    const from = draft.people[e.fromId];
                    if (!t || !from) return null;
                    return (
                      <View key={e.fromId + e.trackId}>
                        {i > 0 ? <DashedRule /> : <View style={{ height: 10 }} />}
                        <TrackRow
                          track={t}
                          size={40}
                          right={
                            <InkLink
                              label="tear out"
                              onPress={() => set((s) => (s.kind === 'guestbook' ? { ...s, entries: s.entries.filter((x) => x.fromId !== e.fromId) } : s))}
                            />
                          }
                        />
                        <Txt variant="meta" tone="soft" style={{ marginBottom: 8 }}>
                          from {from.name}: “{e.why}”
                        </Txt>
                      </View>
                    );
                  })}
                </View>
              )}

              {section.kind === 'recent' && (
                <View style={{ gap: 10 }}>
                  <Txt variant="body" tone="soft">
                    This fills itself in from what you actually put on. You decide whether anyone gets to see it.
                  </Txt>
                  {(['shown', 'hidden'] as const).map((v) => {
                    const on = section.visibility === v;
                    return (
                      <Pressable
                        key={v}
                        onPress={() => set((s) => (s.kind === 'recent' ? { ...s, visibility: v } : s))}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        style={{ borderWidth: on ? 3 : 2, borderColor: inks.ink, backgroundColor: on ? inks.highlight : inks.card, borderRadius: 3, padding: 12 }}
                      >
                        <Txt variant="titleSm">{v === 'shown' ? 'Show it' : 'Keep it hidden'}</Txt>
                        <Txt variant="small" tone="soft">
                          {v === 'shown'
                            ? 'Visitors see the last few things you played.'
                            : 'Visitors see a “Private” stamp and nothing else. The songs aren’t sent to them at all.'}
                        </Txt>
                      </Pressable>
                    );
                  })}
                  <Txt variant="small" tone="soft">
                    To leave it off your room entirely, remove this section below.
                  </Txt>
                </View>
              )}

              <Stickers section={section} index={index} draft={draft} width={width} onDragging={setDragging} />

              <View style={{ marginTop: 40 }}>
                <DashedRule />
              </View>
              <InkLink label={binning ? 'tap again to remove it' : 'remove this section'} onPress={bin} style={{ alignSelf: 'flex-start', marginTop: 16 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </Paper>
      </RoomLookupProvider>
    </InkProvider>
  );
}
