/** A plain page of headed points: the privacy page and the help page share it. */
import React from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SUPPORT_EMAIL, withEmail, type LegalPage } from '@/legal/config';
import { BackLink } from './Field';
import { Heading, InkLink, Paper, PosterButton, Txt } from './print';
import { useSlip } from './Slip';

export function LegalPageView({ page, other }: { page: LegalPage; other: { label: string; href: '/privacy' | '/support' | '/terms' } }) {
  const insets = useSafeAreaInsets();
  const slip = useSlip();

  const write = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=earshot`).catch(() => slip(`Couldn’t open your mail app. The address is ${SUPPORT_EMAIL}.`));
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
          paddingBottom: insets.bottom + 40,
        }}
      >
        <BackLink label="back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Txt variant="wordmark" accessibilityRole="header" style={{ marginTop: 18, fontSize: 40, lineHeight: 44 }}>
          {page.title.toLowerCase()}
        </Txt>
        {page.updated ? (
          <Txt variant="meta" tone="soft" style={{ marginTop: 4 }}>
            Last updated {page.updated}
          </Txt>
        ) : null}
        <Txt variant="body" style={{ marginTop: 12 }}>
          {withEmail(page.intro)}
        </Txt>

        {page.sections.map((section) => (
          <View key={section.heading}>
            <Heading style={{ marginTop: 30 }}>{section.heading.toLowerCase()}</Heading>
            {section.points.map((point, i) => (
              <Txt key={i} variant="body" selectable style={{ marginTop: i === 0 ? 0 : 10 }}>
                {withEmail(point)}
              </Txt>
            ))}
          </View>
        ))}

        <View style={{ marginTop: 34, gap: 16, alignItems: 'flex-start' }}>
          {SUPPORT_EMAIL ? <PosterButton label="write to us" onPress={write} /> : null}
          <InkLink label={other.label} onPress={() => router.push(other.href)} />
        </View>
      </ScrollView>
    </Paper>
  );
}
