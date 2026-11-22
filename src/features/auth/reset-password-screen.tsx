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
import { supabase } from '../../../lib/supabase';
import { useSharedStyles } from '../../styles/shared';
import { useT } from '../../../lib/i18n';

export function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const t = useT();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (password.length < 6) {
      Alert.alert(t('auth.passwordShortTitle'), t('auth.passwordShortBody'));
      return;
    }
    if (password !== confirm) {
      Alert.alert(t('auth.mismatchTitle'), t('auth.mismatchBody'));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      Alert.alert(t('common.error'), error.message);
      return;
    }

    Alert.alert(t('auth.updatedTitle'), t('auth.updatedBody'));
    onDone();
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
        <Text style={shared.subtitle}>{t('auth.chooseNew')}</Text>

        <TextInput
          style={shared.authInput}
          placeholder={t('auth.newPassword')}
          placeholderTextColor={c.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={shared.authInput}
          placeholder={t('auth.confirmPassword')}
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
          <Text style={shared.authButtonText}>{loading ? t('common.pleaseWait') : t('auth.savePassword')}</Text>
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
