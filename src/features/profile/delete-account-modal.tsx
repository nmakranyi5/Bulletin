import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { supabase } from '../../../lib/supabase';
import { useSharedStyles } from '../../styles/shared';

const CONFIRM_WORD = 'DELETE';

// Permanently deletes the signed-in user's account and data. The user must type
// DELETE to confirm; on success they're signed out (the app returns to log-in).
export function DeleteAccountModal({
  visible,
  userId,
  isRecruiter,
  onCancel,
}: {
  visible: boolean;
  userId: string;
  isRecruiter: boolean;
  onCancel: () => void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);

  const canDelete = typed.trim().toUpperCase() === CONFIRM_WORD && !deleting;

  const close = () => {
    if (deleting) return;
    setTyped('');
    onCancel();
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);

    // Uploaded files live in storage, which SQL can't clean up. Best effort:
    // a missing file is not a reason to block deletion.
    await Promise.allSettled([
      supabase.storage.from('avatars').remove([`${userId}/avatar.jpg`]),
      supabase.storage.from('resumes').remove([`${userId}/resume.pdf`]),
    ]);

    const { error } = await supabase.rpc('delete_my_account');

    if (error) {
      setDeleting(false);
      Alert.alert('Could not delete account', error.message);
      return;
    }

    // The auth user is gone, so the server-side session is already invalid.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    setDeleting(false);
    setTyped('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={local.overlay}>
        <View style={local.card}>
          <Text style={local.title}>Delete your account?</Text>
          <Text style={local.body}>
            This permanently deletes your profile
            {isRecruiter ? ', your job postings' : ' and resume'}, your interests, and all of
            your conversations. People you matched with will lose those chats too. This can't
            be undone.
          </Text>

          <Text style={[shared.sectionLabel, { marginTop: 16 }]}>
            TYPE {CONFIRM_WORD} TO CONFIRM
          </Text>
          <TextInput
            style={[shared.authInput, local.input]}
            value={typed}
            onChangeText={setTyped}
            placeholder={CONFIRM_WORD}
            placeholderTextColor={c.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!deleting}
          />

          <Pressable
            style={[local.deleteButton, !canDelete && local.deleteButtonDisabled]}
            onPress={handleDelete}
            disabled={!canDelete}
          >
            <Text style={local.deleteButtonText}>
              {deleting ? 'Deleting...' : 'Delete my account'}
            </Text>
          </Pressable>

          <Pressable style={local.cancelButton} onPress={close} disabled={deleting}>
            <Text style={local.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          paddingHorizontal: 24,
        },

        card: {
          backgroundColor: c.surface,
          borderRadius: 20,
          padding: 22,
        },

        title: {
          fontSize: 20,
          fontWeight: '800',
          color: c.text,
        },

        body: {
          marginTop: 10,
          fontSize: 14,
          lineHeight: 20,
          color: c.textSecondary,
        },

        input: {
          marginTop: 8,
          letterSpacing: 1,
        },

        deleteButton: {
          marginTop: 16,
          paddingVertical: 14,
          borderRadius: 14,
          alignItems: 'center',
          backgroundColor: c.danger,
        },

        deleteButtonDisabled: {
          opacity: 0.4,
        },

        deleteButtonText: {
          fontSize: 15,
          fontWeight: '700',
          color: c.white,
        },

        cancelButton: {
          marginTop: 6,
          paddingVertical: 12,
          alignItems: 'center',
        },

        cancelText: {
          fontSize: 15,
          fontWeight: '600',
          color: c.textSecondary,
        },
      }),
    [c]
  );
}
