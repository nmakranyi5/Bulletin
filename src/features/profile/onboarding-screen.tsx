import { Session } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, UserRound } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { EPA_TYPES, isUniversal, parseYear, TRADE_ROLES } from '../../../lib/hvac';
import { supabase } from '../../../lib/supabase';
import { ChipSelect } from '../../components/chip-select';
import { useSharedStyles } from '../../styles/shared';

export function OnboardingScreen({
  session,
  onComplete,
  onCancel,
}: {
  session: Session;
  onComplete: () => void;
  onCancel?: () => void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [epaCertified, setEpaCertified] = useState(false);
  const [epaTypes, setEpaTypes] = useState<string[]>([]);
  const [startYear, setStartYear] = useState('');
  const [tradeRole, setTradeRole] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<{ uri: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExisting = async () => {
      const { data } = await supabase
        .from('profiles')
        .select(
          'name, username, epa_608_types, trade_start_year, trade_role, description, avatar_url, resume_url'
        )
        .eq('id', session.user.id)
        .single();

      if (data) {
        setName(data.name ?? '');
        setUsername(data.username ?? '');
        setEpaTypes(data.epa_608_types ?? []);
        setEpaCertified((data.epa_608_types ?? []).length > 0);
        setStartYear(data.trade_start_year ? String(data.trade_start_year) : '');
        setTradeRole(data.trade_role ?? '');
        setDescription(data.description ?? '');
        if (data.avatar_url) setAvatarUri(data.avatar_url);
        if (data.resume_url) {
          setResumeFile({ uri: data.resume_url, name: 'resume.pdf' });
        }
      }

      setLoading(false);
    };

    loadExisting();
  }, []);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const pickResume = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });

    if (!result.canceled) {
      setResumeFile({
        uri: result.assets[0].uri,
        name: result.assets[0].name,
      });
    }
  };

  const uploadFile = async (
    bucket: string,
    uri: string,
    fileName: string,
    contentType: string
  ) => {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const path = `${session.user.id}/${fileName}`;

    const { error } = await supabase.storage.from(bucket).upload(
      path,
      decode(base64),
      {
        contentType,
        upsert: true,
        cacheControl: '3600',
      }
    );

    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);

    return `${data.publicUrl}?t=${Date.now()}`;
  };

  const handleSubmit = async () => {
    if (!name.trim() || !username.trim()) {
      Alert.alert('Missing info', 'Name and username are required.');
      return;
    }

    const parsedYear = parseYear(startYear);
    if (parsedYear === 'invalid') {
      Alert.alert('Invalid year', 'Enter the four-digit year you started in the trade, e.g. 2020.');
      return;
    }
    if (epaCertified && epaTypes.length === 0) {
      Alert.alert('EPA 608', 'Select at least one certification type, or choose No.');
      return;
    }

    setSubmitting(true);

    try {
      let avatarUrl: string | undefined;
      let resumeUrl: string | undefined;

      if (avatarUri && !avatarUri.startsWith('http')) {
        avatarUrl = await uploadFile('avatars', avatarUri, 'avatar.jpg', 'image/jpeg');
      }

      if (resumeFile && !resumeFile.uri.startsWith('http')) {
        resumeUrl = await uploadFile(
          'resumes',
          resumeFile.uri,
          'resume.pdf',
          'application/pdf'
        );
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          username: username.trim(),
          epa_608_types: epaCertified ? epaTypes : [],
          trade_start_year: parsedYear,
          trade_role: tradeRole || null,
          description: description.trim(),
          ...(avatarUrl && { avatar_url: avatarUrl }),
          ...(resumeUrl && { resume_url: resumeUrl }),
          onboarded: true,
        })
        .eq('id', session.user.id);

      if (error) throw error;

      onComplete();
    } catch (err: any) {
      const message =
        err?.code === '23505'
          ? 'That username is already taken.'
          : err?.message ?? 'Something went wrong.';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={shared.authContainer}>
      <KeyboardAvoidingView
        style={shared.authInner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ gap: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          {onCancel && (
            <Pressable onPress={onCancel} style={shared.chatBackButton}>
              <ArrowLeft size={22} color={c.text} strokeWidth={2.2} />
            </Pressable>
          )}

          <Text style={shared.logo}>bulletin.</Text>
          <Text style={shared.subtitle}>
            {onCancel ? 'Edit your profile.' : 'Set up your profile.'}
          </Text>

          {loading ? (
            <Text style={shared.subtitle}>Loading...</Text>
          ) : (
            <>
              <Pressable style={local.avatarPicker} onPress={pickAvatar}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={shared.avatarPreview} />
                ) : (
                  <UserRound size={40} color={c.muted} strokeWidth={1.5} />
                )}
                <Text style={local.avatarPickerText}>
                  {avatarUri ? 'Change photo' : 'Add profile photo'}
                </Text>
              </Pressable>

              <TextInput
                style={shared.authInput}
                placeholder="Name"
                placeholderTextColor={c.muted}
                value={name}
                onChangeText={setName}
              />

              <TextInput
                style={shared.authInput}
                placeholder="Username"
                placeholderTextColor={c.muted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />

              <ChipSelect
                label="EPA 608 CERTIFIED?"
                options={['Yes', 'No']}
                selected={[epaCertified ? 'Yes' : 'No']}
                onToggle={(o) => {
                  setEpaCertified(o === 'Yes');
                  if (o === 'No') setEpaTypes([]);
                }}
              />

              {epaCertified && (
                <>
                  <ChipSelect
                    label="CERTIFICATION TYPES"
                    options={EPA_TYPES.map((t) => `Type ${t}`)}
                    selected={epaTypes.map((t) => `Type ${t}`)}
                    onToggle={(o) => {
                      const t = o.replace('Type ', '');
                      setEpaTypes((prev) =>
                        prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                      );
                    }}
                  />
                  {isUniversal(epaTypes) && (
                    <Text style={shared.chipHint}>Shown on your profile as Universal.</Text>
                  )}
                </>
              )}

              <TextInput
                style={shared.authInput}
                placeholder="Year started in the trade (e.g. 2020)"
                placeholderTextColor={c.muted}
                value={startYear}
                onChangeText={setStartYear}
                keyboardType="number-pad"
                maxLength={4}
              />

              <ChipSelect
                label="CURRENT / MOST RECENT ROLE"
                options={TRADE_ROLES}
                selected={tradeRole ? [tradeRole] : []}
                onToggle={(o) => setTradeRole((prev) => (prev === o ? '' : o))}
              />

              <TextInput
                style={[shared.authInput, shared.authTextArea]}
                placeholder="A bit about yourself"
                placeholderTextColor={c.muted}
                value={description}
                onChangeText={setDescription}
                multiline
              />

              <Pressable style={local.resumePicker} onPress={pickResume}>
                <Text style={local.resumePickerText}>
                  {resumeFile ? resumeFile.name : 'Upload resume (PDF)'}
                </Text>
              </Pressable>

              <Pressable
                style={[shared.authButton, submitting && shared.authButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Text style={shared.authButtonText}>
                  {submitting ? 'Saving...' : 'Finish setup'}
                </Text>
              </Pressable>
            </>
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
        avatarPicker: {
          alignItems: 'center',
          gap: 8,
          paddingVertical: 12,
        },

        avatarPickerText: {
          fontSize: 13,
          fontWeight: '600',
          color: c.textSecondary,
        },

        resumePicker: {
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderRadius: 14,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
        },

        resumePickerText: {
          fontSize: 15,
          color: c.textSecondary,
        },
      }),
    [c]
  );
}
