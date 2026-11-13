/**
 * The furniture in someone's room. Each section draws itself from the room's
 * own inks and fonts (via InkProvider), so the same record collection looks
 * completely different from one person to the next.
 */
import React, { createContext, useContext } from 'react';
import { ScrollView, View } from 'react-native';
import type { Person, Room, RoomSection, RoomTheme, SectionKind } from '@/data/types';
import type { Track } from '@/music';
import { fonts, tilt } from '@/theme';
import { Card, Heading, PinBadge, PosterButton, Stamp, Tape, Txt, useInks, wash } from './print';
import { Sleeve } from './Sleeve';
import { DashedRule } from './SongCard';
import { ago } from './SongPicker';
import { Sticker } from './Sticker';

/** The tracks and people a room mentions, looked up once and shared by its sections. */
export type RoomLookup = { tracks: Record<string, Track>; people: Record<string, Person>; mine: boolean };
const LookupContext = createContext<RoomLookup>({ tracks: {}, people: {}, mine: false });
export const RoomLookupProvider = LookupContext.Provider;
const useLookup = () => useContext(LookupContext);

/** What each kind of section is called in menus. */
export const SECTION_NAMES: Record<SectionKind, string> = {
  intro: 'Three-song introduction',
  pinned: 'Pinned record',
  wall: 'Album wall',
  shelf: 'Shelf',
  liner: 'Liner notes',
  guestbook: 'Guestbook',
  recent: 'Recently played',
};

/** Whether a section has anything in it worth showing a visitor. */
export function isEmpty(s: RoomSection): boolean {
  switch (s.kind) {
    case 'intro':
      return s.songs.length === 0;
    case 'pinned':
      return !s.trackId;
    case 'wall':
    case 'shelf':
      return s.trackIds.length === 0;
    case 'liner':
      return s.notes.length === 0;
    case 'guestbook':
      return false; // an empty guestbook is an invitation
    case 'recent':
      return s.visibility === 'shown' && s.trackIds.length === 0;
  }
}

const EMPTY_HINT: Record<SectionKind, string> = {
  intro: 'Three songs for someone who’s never met you. Pick them carefully. Or don’t; that says something too.',
  pinned: 'One record, and where you were the first time you heard it.',
  wall: 'Bare wall. Hang some albums on it.',
  shelf: 'An empty shelf with a name. Put some records on it.',
  liner: 'Nothing written yet. Short reviews, stray thoughts, a story about a song.',
  guestbook: '',
  recent: 'Nothing played yet. Put a song on from Nearby and it shows up here.',
};

type SectionProps<K extends SectionKind> = {
  section: Extract<RoomSection, { kind: K }>;
  theme: RoomTheme;
  width: number;
  onSign?: () => void;
};

function Intro({ section }: SectionProps<'intro'>) {
  const inks = useInks();
  const { tracks } = useLookup();
  return (
    <View style={{ gap: 14 }}>
      {section.songs.map((s, i) => {
        const t = tracks[s.trackId];
        if (!t) return null;
        return (
          <View key={s.trackId + i} style={{ marginLeft: i === 1 ? 18 : 0, marginRight: i === 1 ? 0 : 18 }}>
            <Card rotate={tilt(s.trackId, 1.8)} innerStyle={{ padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Txt style={{ fontFamily: inks.display, fontSize: 40, lineHeight: 46 }} color={inks.accent}>
                {String(i + 1)}
              </Txt>
              <Sleeve track={t} size={66} record={false} />
              <View style={{ flex: 1 }}>
                <Txt variant="titleSm" numberOfLines={2}>
                  {t.title}
                </Txt>
                <Txt variant="meta" tone="soft" numberOfLines={1}>
                  {t.artist}
                </Txt>
                {s.why ? (
                  <Txt variant="hand" style={{ marginTop: 4, fontSize: 20, lineHeight: 21 }}>
                    {s.why}
                  </Txt>
                ) : null}
              </View>
            </Card>
            <Tape rotate={i % 2 ? 5 : -6} width={52} style={{ top: -8, left: i % 2 ? '62%' : '14%' }} />
          </View>
        );
      })}
    </View>
  );
}

function Pinned({ section, width }: SectionProps<'pinned'>) {
  const inks = useInks();
  const { tracks } = useLookup();
  const t = section.trackId ? tracks[section.trackId] : null;
  if (!t) return null;
  const size = Math.min(150, Math.round(width * 0.4));
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
        <View style={{ transform: [{ rotate: '-3deg' }] }}>
          <Sleeve track={t} size={size} />
          <Tape rotate={-8} width={60} style={{ top: -10, left: size * 0.3 }} />
        </View>
        <View style={{ flex: 1, paddingTop: 10 }}>
          <Txt variant="title" numberOfLines={4}>
            {t.title}
          </Txt>
          <Txt variant="bodyItalic" numberOfLines={2}>
            {t.artist}
          </Txt>
          <Txt variant="meta" tone="soft" numberOfLines={2} style={{ marginTop: 4 }}>
            {t.album}
            {t.year ? ` · ${t.year}` : ''}
          </Txt>
        </View>
      </View>
      {section.note ? (
        <View style={{ marginTop: -14, marginLeft: 26, transform: [{ rotate: '1.4deg' }] }}>
          <Card shadow={4} innerStyle={{ padding: 14 }}>
            <Txt variant="label" tone="soft" style={{ marginBottom: 4 }}>
              Where I was when I first heard it
            </Txt>
            <Txt variant="handLg" color={inks.ink}>
              {section.note}
            </Txt>
          </Card>
        </View>
      ) : null}
    </View>
  );
}

function Wall({ section, theme, width }: SectionProps<'wall'>) {
  const { tracks } = useLookup();
  const cols = 3;
  const scatter = theme.wall === 'scatter';
  const gap = scatter ? 12 : 4;
  const size = Math.floor((width - gap * (cols - 1) - (scatter ? 8 : 0)) / cols);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, paddingHorizontal: scatter ? 4 : 0 }}>
      {section.trackIds.map((id, i) => {
        const t = tracks[id];
        if (!t) return null;
        const rot = scatter ? tilt(id + i, 5) : 0;
        const nudge = scatter ? tilt(id + 'y', 7) : 0;
        return (
          <View key={id + i} style={{ transform: [{ rotate: `${rot}deg` }, { translateY: nudge }] }}>
            <Sleeve track={t} size={size} record={false} badge="playing" />
            {scatter && i % 2 === 0 ? <Tape rotate={rot * 3} width={34} style={{ top: -8, left: size / 2 - 17, height: 16 }} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function Shelf({ section }: SectionProps<'shelf'>) {
  const inks = useInks();
  const { tracks } = useLookup();
  const list = section.trackIds.map((id) => tracks[id]).filter(Boolean);
  const last = list.length - 1;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 8, paddingTop: 8 }}>
          {list.map((t, i) => {
            // the last record on a shelf always leans
            const lean = i === last ? -7 : tilt(t.id + 'shelf', 1.5);
            return (
              <View key={t.id + i} style={{ width: 96, transform: [{ rotate: `${lean}deg` }], marginBottom: i === last ? 2 : 0 }}>
                <Sleeve track={t} size={96} record={false} badge="playing" />
              </View>
            );
          })}
        </View>
        {/* the plank */}
        <View style={{ height: 10, backgroundColor: inks.ink, borderRadius: 1, marginRight: -6 }} />
        <View style={{ height: 5, backgroundColor: wash(inks.ink, 0.35), marginLeft: 6, marginRight: -6 }} />
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 8, paddingTop: 6 }}>
          {list.map((t, i) => (
            <View key={t.id + i} style={{ width: 96 }}>
              <Txt variant="meta" numberOfLines={2} style={{ fontFamily: fonts.typeBold, fontSize: 11, lineHeight: 14 }}>
                {t.album || t.title}
              </Txt>
              <Txt variant="meta" tone="soft" numberOfLines={1} style={{ fontSize: 11, lineHeight: 14 }}>
                {t.artist}
              </Txt>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function Liner({ section }: SectionProps<'liner'>) {
  const { tracks } = useLookup();
  return (
    <Card rotate={0.6} innerStyle={{ paddingHorizontal: 16, paddingVertical: 6 }}>
      {section.notes.map((n, i) => {
        const t = n.trackId ? tracks[n.trackId] : null;
        return (
          <View key={i}>
            {i > 0 ? <DashedRule /> : null}
            <View style={{ paddingVertical: 12 }}>
              <Txt variant="label" tone="accent" style={{ marginBottom: 4 }}>
                {t ? `Re: ${t.title} · ${t.artist}` : 'Stray thought'}
              </Txt>
              <Txt style={{ fontFamily: fonts.type, fontSize: 15, lineHeight: 22 }}>{n.text}</Txt>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

function Guestbook({ section, onSign }: SectionProps<'guestbook'>) {
  const { tracks, people, mine } = useLookup();
  const entries = section.entries.filter((e) => tracks[e.trackId] && people[e.fromId]);
  return (
    <View style={{ gap: 14 }}>
      {entries.length === 0 ? (
        <Txt variant="bodyItalic" tone="soft">
          {mine
            ? 'Nobody’s signed yet. When someone visits your room they can leave a track here and say why they picked it.'
            : 'No entries yet. Be the first: leave a track and say why you picked it.'}
        </Txt>
      ) : null}
      {entries.map((e, i) => {
        const from = people[e.fromId];
        const t = tracks[e.trackId];
        return (
          <View key={e.fromId + e.trackId} style={{ marginLeft: i % 2 ? 22 : 0, marginRight: i % 2 ? 0 : 22 }}>
            <Card rotate={tilt(e.fromId + 'gb', 2)} shadow={4} innerStyle={{ padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <PinBadge label={from.badge} color={from.badgeColor} size={30} />
                <Txt variant="meta" style={{ flex: 1 }} numberOfLines={1}>
                  <Txt variant="meta" style={{ fontFamily: fonts.typeBold }}>
                    {from.name.split(' ')[0]}
                  </Txt>{' '}
                  left a track{e.at ? ` · ${ago(e.at)}` : ''}
                </Txt>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingLeft: 6 }}>
                <Sleeve track={t} size={58} record={false} />
                <View style={{ flex: 1 }}>
                  <Txt variant="titleSm" numberOfLines={2}>
                    {t.title}
                  </Txt>
                  <Txt variant="meta" tone="soft" numberOfLines={1}>
                    {t.artist}
                  </Txt>
                </View>
              </View>
              <Txt variant="hand" style={{ marginTop: 10 }}>
                {e.why}
              </Txt>
            </Card>
          </View>
        );
      })}
      {onSign ? <PosterButton label="leave a track" kind="plain" onPress={onSign} style={{ alignSelf: 'flex-start', marginTop: 4 }} /> : null}
    </View>
  );
}

function Recent({ section }: SectionProps<'recent'>) {
  const { tracks, mine } = useLookup();
  if (section.visibility === 'hidden') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Stamp rotate={-4}>Private</Stamp>
        <Txt variant="bodyItalic" tone="soft" style={{ flex: 1 }}>
          {mine ? 'Hidden. Visitors see this stamp and nothing else.' : 'None of your business, and they’d like you to know that.'}
        </Txt>
      </View>
    );
  }
  const list = section.trackIds.map((id) => tracks[id]).filter(Boolean);
  return (
    <View>
      {list.map((t, i) => (
        <View key={t.id}>
          {i > 0 ? <DashedRule /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
            <Sleeve track={t} size={42} record={false} badge="playing" />
            <View style={{ flex: 1 }}>
              <Txt variant="titleSm" numberOfLines={1}>
                {t.title}
              </Txt>
              <Txt variant="meta" tone="soft" numberOfLines={1}>
                {t.artist}
              </Txt>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/** The body of one section, without its heading. Also used as the preview in the editor. */
export function SectionBody({
  section,
  theme,
  width,
  onSign,
}: {
  section: RoomSection;
  theme: RoomTheme;
  width: number;
  onSign?: () => void;
}) {
  const { mine } = useLookup();
  if (isEmpty(section)) {
    return (
      <Txt variant="bodyItalic" tone="soft">
        {mine ? EMPTY_HINT[section.kind] : ''}
      </Txt>
    );
  }
  const common = { theme, width, onSign };
  return (
    <>
      {section.kind === 'intro' && <Intro section={section} {...common} />}
      {section.kind === 'pinned' && <Pinned section={section} {...common} />}
      {section.kind === 'wall' && <Wall section={section} {...common} />}
      {section.kind === 'shelf' && <Shelf section={section} {...common} />}
      {section.kind === 'liner' && <Liner section={section} {...common} />}
      {section.kind === 'guestbook' && <Guestbook section={section} {...common} />}
      {section.kind === 'recent' && <Recent section={section} {...common} />}
    </>
  );
}

export function RoomSectionView({
  section,
  room,
  width,
  onSign,
}: {
  section: RoomSection;
  room: Room;
  width: number;
  onSign?: () => void;
}) {
  const { mine } = useLookup();
  const { layout } = room.theme;
  // Visitors don't see furniture that's still in its box.
  if (isEmpty(section) && !mine) return null;

  const body = (
    <View>
      <SectionBody section={section} theme={room.theme} width={layout === 'pages' ? width - 32 : width} onSign={onSign} />
      {section.stickers?.map((s, i) => <Sticker key={i} sticker={s} />)}
    </View>
  );
  const heading = <Heading style={layout === 'poster' ? { alignSelf: 'center' } : undefined}>{section.title}</Heading>;

  if (layout === 'pages') {
    // every section is its own page, taped down a little crooked
    return (
      <View style={{ marginBottom: 34 }}>
        <Card rotate={tilt(section.title + section.kind, 0.9)} fill={room.theme.paper} innerStyle={{ padding: 14, paddingTop: 18 }}>
          {heading}
          {body}
        </Card>
        <Tape rotate={tilt(section.title, 6)} width={70} style={{ top: -9, left: '38%' }} />
      </View>
    );
  }
  return (
    <View style={{ marginBottom: 40 }}>
      {heading}
      {body}
    </View>
  );
}
