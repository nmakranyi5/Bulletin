import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../lib/app-theme';
import { authRedirectUrl } from '../../../lib/auth-links';
import { supabase } from '../../../lib/supabase';
import { useSharedStyles } from '../../styles/shared';

// Password reset by emailed one-time code, so it works without deep links.
export function ForgotPasswordScreen({
  initialEmail,
  setRecovering,
  onBack,
}: {
  initialEmail: string;
  setRecovering: (value: boolean) => void;
  onBack: () => void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'We need it to send you a code.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectUrl(),
    });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setStep('verify');
  };

  const verifyCode = async () => {
    if (!code.trim()) {
      Alert.alert('Enter the code', 'Type the code from the email.');
      return;
    }

    setLoading(true);
    // Set before verifying so the app shows the new-password screen, not the home screen.
    setRecovering(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'recovery',
    });
    setLoading(false);

    if (error) {
      setRecovering(false);
      Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView style={shared.authContainer}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={shared.authScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <Text style={shared.logo}>bulletin.</Text>
        <Text style={shared.subtitle}>
          {step === 'request'
            ? 'Reset your password.'
            : `Enter the code we sent to ${email.trim()}.`}
        </Text>

        {step === 'request' ? (
          <TextInput
            style={shared.authInput}
            placeholder="Email"
            placeholderTextColor={c.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        ) : (
          <TextInput
            style={shared.authInput}
            placeholder="Code"
            placeholderTextColor={c.muted}
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            keyboardType="number-pad"
            maxLength={10}
          />
        )}

        <Pressable
          style={[shared.authButton, loading && shared.authButtonDisabled]}
          onPress={step === 'request' ? sendCode : verifyCode}
          disabled={loading}
        >
          <Text style={shared.authButtonText}>
            {loading ? 'Please wait...' : step === 'request' ? 'Send code' : 'Verify code'}
          </Text>
        </Pressable>

        {step === 'verify' && (
          <Pressable
            style={{ marginTop: 14, alignItems: 'center' }}
            onPress={sendCode}
            disabled={loading}
          >
            <Text style={shared.subtitle}>Resend code</Text>
          </Pressable>
        )}

        <Pressable style={{ marginTop: 14, alignItems: 'center' }} onPress={onBack}>
          <Text style={shared.subtitle}>Back to log in</Text>
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
