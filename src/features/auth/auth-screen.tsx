import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../lib/app-theme';
import { supabase } from '../../../lib/supabase';
import { useSharedStyles } from '../../styles/shared';
import { useT } from '../../../lib/i18n';
import { ForgotPasswordScreen } from './forgot-password-screen';

export function AuthScreen({ setRecovering }: { setRecovering: (value: boolean) => void }) {
  const t = useT();
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [showForgot, setShowForgot] = useState(false);
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [role, setRole] = useState<'seeker' | 'recruiter'>('seeker');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.missingInfo'), t('auth.enterBoth'));
      return;
    }

    setLoading(true);

    const { error } =
      mode === 'signUp'
        ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { role } },
          })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });

    setLoading(false);

    if (error) {
      Alert.alert(t('common.error'), error.message);
      return;
    }

    if (mode === 'signUp') {
      Alert.alert(t('auth.checkEmailTitle'), t('auth.checkEmailBody'));
    }
  };

  if (showForgot) {
    return (
      <ForgotPasswordScreen
        initialEmail={email}
        setRecovering={setRecovering}
        onBack={() => setShowForgot(false)}
      />
    );
  }

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
          {mode === 'signIn' ? t('auth.welcomeBack') : t('auth.createAccount')}
        </Text>

        <View style={[shared.subTabBar, local.authModeToggle]}>
          <Pressable
            style={[shared.subTabItem, mode === 'signIn' && shared.subTabItemActive]}
            onPress={() => setMode('signIn')}
          >
            <Text
              style={[shared.subTabText, mode === 'signIn' && shared.subTabTextActive]}
            >
              {t('auth.logIn')}
            </Text>
          </Pressable>

          <Pressable
            style={[shared.subTabItem, mode === 'signUp' && shared.subTabItemActive]}
            onPress={() => setMode('signUp')}
          >
            <Text
              style={[shared.subTabText, mode === 'signUp' && shared.subTabTextActive]}
            >
              {t('auth.signUp')}
            </Text>
          </Pressable>
        </View>

        {mode === 'signUp' && (
          <View style={[shared.subTabBar, local.authModeToggle]}>
            {(['seeker', 'recruiter'] as const).map((r) => (
              <Pressable
                key={r}
                style={[shared.subTabItem, role === r && shared.subTabItemActive]}
                onPress={() => setRole(r)}
              >
                <Text style={[shared.subTabText, role === r && shared.subTabTextActive]}>
                  {r === 'seeker' ? t('auth.imSeeker') : t('auth.imRecruiter')}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <TextInput
          style={shared.authInput}
          placeholder={t('auth.email')}
          placeholderTextColor={c.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={shared.authInput}
          placeholder={t('auth.password')}
          placeholderTextColor={c.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          style={[shared.authButton, loading && shared.authButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={shared.authButtonText}>
            {loading ? t('common.pleaseWait') : mode === 'signIn' ? t('auth.logIn') : t('auth.signUp')}
          </Text>
        </Pressable>

        {mode === 'signIn' && (
          <Pressable
            style={{ marginTop: 14, alignItems: 'center' }}
            onPress={() => setShowForgot(true)}
            disabled={loading}
          >
            <Text style={shared.subtitle}>{t('auth.forgot')}</Text>
          </Pressable>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        authModeToggle: {
          marginHorizontal: 0,
          marginTop: 20,
          marginBottom: 4,
        },
      }),
    [c]
  );
}
