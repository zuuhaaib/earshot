/**
 * Turn an account that only exists on this phone into a real one: add an
 * email and password, verify the email, and everything the old account had
 * (room, crate, chats, posts) moves across.
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi, useSession } from '@/data';
import { BackLink, goBack } from '@/ui/Field';
import { CloudSignUp } from '@/ui/CloudAuth';
import { Paper, Txt } from '@/ui/print';
import { useSlip } from '@/ui/Slip';

export default function Upgrade() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const slip = useSlip();
  const { data: session } = useSession();
  const me = session?.me;
  // Who we were when this screen opened. Verifying the email signs the phone in as the new account,
  // so this is kept from the first look rather than read again later.
  const [original, setOriginal] = useState<{ id: string; name: string; handle: string; badge: string; badgeColor: string; homeCity: string } | null>(null);
  if (me && !original) setOriginal({ id: me.id, name: me.name, handle: me.handle, badge: me.badge, badgeColor: me.badgeColor, homeCity: me.homeCity });

  if (!original) return <Paper />;

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
            paddingTop: insets.top + 14,
            paddingBottom: insets.bottom + 28,
          }}
        >
          <BackLink label="close" />
          <Txt variant="body" tone="soft" style={{ marginTop: 16, marginBottom: 18 }}>
            Right now @{original.handle} exists only on this phone. Add an email and it becomes a real account: your room, crate, chats
            and posts come with you.
          </Txt>
          <CloudSignUp
            profile={{ name: original.name, handle: original.handle, badge: original.badge, badgeColor: original.badgeColor, homeCity: original.homeCity }}
            onDone={async (account) => {
              await api.moveAccountData(original.id, account.id);
              slip('Done. Same you, now with an email.');
              goBack();
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Paper>
  );
}
