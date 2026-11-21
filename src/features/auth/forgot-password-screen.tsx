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
import { useT } from '../../../lib/i18n';

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
  const t = useT();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    if (!email.trim()) {
      Alert.alert(t('auth.enterEmailTitle'), t('auth.enterEmailBody'));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectUrl(),
    });
    setLoading(false);

    if (error) {
      Alert.alert(t('common.error'), error.message);
      return;
    }

    setStep('verify');
  };

  const verifyCode = async () => {
    if (!code.trim()) {
      Alert.alert(t('auth.enterCodeTitle'), t('auth.enterCodeBody'));
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
      Alert.alert(t('common.error'), error.message);
    }
  };

  return (
    <SafeAreaView style={shared.authContainer}>
      <KeyboardAvoidingView
        style={shared.authColumn}
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
            ? t('auth.resetPassword')
            : t('auth.codeSentTo', { email: email.trim() })}
        </Text>

        {step === 'request' ? (
          <TextInput
            style={shared.authInput}
            placeholder={t('auth.email')}
            placeholderTextColor={c.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        ) : (
          <TextInput
            style={shared.authInput}
            placeholder={t('auth.code')}
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
            {loading ? t('common.pleaseWait') : step === 'request' ? t('auth.sendCode') : t('auth.verifyCode')}
          </Text>
        </Pressable>

        {step === 'verify' && (
          <Pressable
            style={{ marginTop: 14, alignItems: 'center' }}
            onPress={sendCode}
            disabled={loading}
          >
            <Text style={shared.subtitle}>{t('auth.resendCode')}</Text>
          </Pressable>
        )}

        <Pressable style={{ marginTop: 14, alignItems: 'center' }} onPress={onBack}>
          <Text style={shared.subtitle}>{t('auth.backToLogin')}</Text>
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
