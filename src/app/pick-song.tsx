/** A song picker other screens can open and wait on (see `chooseSong` in ui/roomDraft). */
import React, { useEffect, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useLive } from '@/data';
import { seedTrack, stopPreview } from '@/music';
import { BackLink, goBack } from '@/ui/Field';
import { Heading, Txt } from '@/ui/print';
import { answerSong } from '@/ui/roomDraft';
import { COUNTER, SongPicker, useSongSearch } from '@/ui/SongPicker';

export default function PickSong() {
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const { data: crate } = useLive((a) => a.getCrate(), ['crate']);
  const picker = useSongSearch();
  const answered = useRef(false);

  // Closing the screen any other way counts as "never mind".
  useEffect(
    () => () => {
      stopPreview();
      if (!answered.current) answerSong(null);
    },
    [],
  );

  return (
    <SongPicker
      picker={picker}
      idleTracks={crate?.length ? crate.slice(0, 12) : COUNTER.map(seedTrack)}
      idleLabel={crate?.length ? 'From your crate' : 'Or grab one off the counter'}
      onPick={(track) => {
        answered.current = true;
        answerSong(track);
        goBack();
      }}
      header={
        <>
          <BackLink label="never mind" />
          <Heading style={{ marginTop: 18 }}>{(prompt || 'pick a song').toLowerCase()}</Heading>
          <Txt variant="body" tone="soft" style={{ marginBottom: 14 }}>
            Tap a cover to hear a preview; tap the title to choose it.
          </Txt>
        </>
      }
    />
  );
}
