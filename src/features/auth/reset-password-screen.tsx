import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
} from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { supabase } from '../../../lib/supabase';
import { useSharedStyles } from '../../styles/shared';

export function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (password.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match', 'Please re-enter them.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert('Password updated', 'You are all set.');
    onDone();
  };

  return (
    <SafeAreaView style={shared.authContainer}>
      <KeyboardAvoidingView
        style={shared.authInner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Text style={shared.logo}>bulletin.</Text>
        <Text style={shared.subtitle}>Choose a new password.</Text>

        <TextInput
          style={shared.authInput}
          placeholder="New password"
          placeholderTextColor={c.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={shared.authInput}
          placeholder="Confirm password"
          placeholderTextColor={c.muted}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />

        <Pressable
          style={[shared.authButton, loading && shared.authButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={shared.authButtonText}>{loading ? 'Please wait...' : 'Save password'}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
