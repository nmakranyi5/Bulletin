import { Check } from 'lucide-react-native';
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
import { ForgotPasswordScreen } from './forgot-password-screen';

export function AuthScreen({ setRecovering }: { setRecovering: (value: boolean) => void }) {
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
      Alert.alert('Missing info', 'Please enter both email and password.');
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
      Alert.alert('Error', error.message);
      return;
    }

    if (mode === 'signUp') {
      Alert.alert('Check your email', 'Confirm your email to finish signing up.');
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
          {mode === 'signIn' ? 'Welcome back.' : 'Create your account.'}
        </Text>

        <View style={[shared.subTabBar, local.authModeToggle]}>
          <Pressable
            style={[shared.subTabItem, mode === 'signIn' && shared.subTabItemActive]}
            onPress={() => setMode('signIn')}
          >
            <Text
              style={[shared.subTabText, mode === 'signIn' && shared.subTabTextActive]}
            >
              Log In
            </Text>
          </Pressable>

          <Pressable
            style={[shared.subTabItem, mode === 'signUp' && shared.subTabItemActive]}
            onPress={() => setMode('signUp')}
          >
            <Text
              style={[shared.subTabText, mode === 'signUp' && shared.subTabTextActive]}
            >
              Sign Up
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
                  {r === 'seeker' ? "I'm a Seeker" : "I'm a Recruiter"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <TextInput
          style={shared.authInput}
          placeholder="Email"
          placeholderTextColor={c.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={shared.authInput}
          placeholder="Password"
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
            {loading ? 'Please wait...' : mode === 'signIn' ? 'Log In' : 'Sign Up'}
          </Text>
        </Pressable>

        {mode === 'signIn' && (
          <Pressable
            style={{ marginTop: 14, alignItems: 'center' }}
            onPress={() => setShowForgot(true)}
            disabled={loading}
          >
            <Text style={shared.subtitle}>Forgot password?</Text>
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
