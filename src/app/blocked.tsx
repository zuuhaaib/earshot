/** The people you've blocked, and the way back. */
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi, useLive, type Person } from '@/data';
import { tilt } from '@/theme';
import { BackLink } from '@/ui/Field';
import { Card, Heading, Paper, PinBadge, PosterButton, Txt } from '@/ui/print';
import { useSlip } from '@/ui/Slip';

export default function Blocked() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const slip = useSlip();
  const { data: people, loading } = useLive((a) => a.getBlocked(), ['session']);
  const [busy, setBusy] = useState<string | null>(null);

  const unblock = async (p: Person) => {
    setBusy(p.id);
    try {
      await api.unblockPerson(p.id);
      slip(`Unblocked. You and ${p.name.split(' ')[0]} can see each other again.`);
    } catch {
      slip('That didn’t go through. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Paper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          width: '100%',
          maxWidth: 560,
          alignSelf: 'center',
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + 36,
        }}
      >
        <BackLink label="close" />
        <Heading style={{ marginTop: 18 }}>blocked people</Heading>
        <Txt variant="body" tone="soft" style={{ marginBottom: 16 }}>
          You and the people here can’t see each other anywhere in earshot. Unblocking puts things back as they were, including
          any chat you had. They aren’t told either way.
        </Txt>

        {people?.length ? (
          people.map((p) => (
            <Card key={p.id} rotate={tilt(p.id, 0.8)} style={{ marginBottom: 14 }} innerStyle={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <PinBadge label={p.badge} color={p.badgeColor} size={40} rotate={tilt(p.id, 9)} />
              <View style={{ flex: 1 }}>
                <Txt variant="titleSm" numberOfLines={1}>
                  {p.name}
                </Txt>
                <Txt variant="meta" tone="soft" numberOfLines={1}>
                  @{p.handle}
                </Txt>
              </View>
              <PosterButton label={busy === p.id ? '…' : 'unblock'} kind="plain" small disabled={busy !== null} onPress={() => unblock(p)} />
            </Card>
          ))
        ) : loading ? null : (
          <Txt variant="hand" tone="soft">
            nobody. long may it last.
          </Txt>
        )}
      </ScrollView>
    </Paper>
  );
}
