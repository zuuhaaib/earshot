/** Log in to another of your accounts while already signed in (from the account list). */
import React from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cloudConfigured } from '@/backend/config';
import { CloudLogin } from '@/ui/CloudAuth';
import { BackLink, goBack } from '@/ui/Field';
import { LoginForm } from '@/ui/LoginForm';
import { Heading, Paper, Txt } from '@/ui/print';
import { useSlip } from '@/ui/Slip';

export default function Login() {
  const insets = useSafeAreaInsets();
  const slip = useSlip();
  const { handle } = useLocalSearchParams<{ handle?: string }>();

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
          <Heading style={{ marginTop: 18 }}>switch account</Heading>
          <Txt variant="body" tone="soft" style={{ marginBottom: 20 }}>
            Log in and this phone becomes theirs until you switch back.
          </Txt>
          {cloudConfigured() ? (
            <CloudLogin
              onDone={(account) => {
                slip(`Welcome back, ${account.name.split(' ')[0]}.`);
                goBack();
              }}
            />
          ) : (
            <LoginForm
              initialHandle={handle ?? ''}
              onDone={(first) => {
                slip(`Welcome back, ${first}.`);
                goBack();
              }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Paper>
  );
}
