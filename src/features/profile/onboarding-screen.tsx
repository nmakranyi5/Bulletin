import { Session } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { UserRound } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { supabase } from '../../../lib/supabase';
import { StepForm } from '../../components/step-form';
import { useSharedStyles } from '../../styles/shared';
import {
  buildRecruiterPayload,
  emptyRecruiter,
  RECRUITER_STEPS,
  RecruiterFields,
  recruiterFromRow,
  recruiterStepError,
  RecruiterValues,
} from './recruiter-fields';
import {
  buildSeekerPayload,
  emptySeeker,
  SEEKER_STEPS,
  SeekerFields,
  seekerFromRow,
  seekerStepError,
  SeekerValues,
} from './seeker-fields';

export function OnboardingScreen({
  session,
  onComplete,
  onCancel,
  onBackToLogin,
}: {
  session: Session;
  onComplete: () => void;
  // Editing an existing profile: go back.
  onCancel?: () => void;
  // First-time setup: leave (sign out) and return to the login screen.
  onBackToLogin?: () => void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [isRecruiter, setIsRecruiter] = useState(false);
  const [seeker, setSeeker] = useState<SeekerValues>(emptySeeker);
  const [recruiter, setRecruiter] = useState<RecruiterValues>(emptyRecruiter);
  const [description, setDescription] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<{ uri: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);

  // First-time setup shows one step at a time; editing shows every step together.
  const wizard = !onCancel;
  const steps: { key: string; title: string; subtitle: string }[] = [
    {
      key: 'basics',
      title: isRecruiter ? "Let's set up your company" : "Let's get you set up",
      subtitle: 'Start with the basics.',
    },
    ...(isRecruiter ? RECRUITER_STEPS : SEEKER_STEPS),
    {
      key: 'about',
      title: isRecruiter ? 'About your company' : 'About you',
      subtitle: isRecruiter
        ? 'A short description candidates will see.'
        : 'Tell shops who you are. A resume helps too.',
    },
  ];

  // What stops you moving on from a step, or null when it is fine to continue.
  const stepProblem = (key: string): { title: string; message: string } | null => {
    if (key === 'basics' && (!name.trim() || !username.trim())) {
      return { title: 'Missing info', message: 'Name and username are required.' };
    }
    if (isRecruiter) return recruiterStepError(key as any, recruiter);
    return seekerStepError(key as any, seeker);
  };

  useEffect(() => {
    const loadExisting = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (data) {
        setName(data.name ?? '');
        setUsername(data.username ?? '');
        setIsRecruiter(!!data.is_recruiter);
        setSeeker(seekerFromRow(data));
        setRecruiter(recruiterFromRow(data));
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

  const uploadFile = async (bucket: string, uri: string, fileName: string, contentType: string) => {
    // On the web the picked file is a blob URL / data URI the browser can fetch; on phones
    // it is a file on disk that has to be read as base64 first.
    const body =
      Platform.OS === 'web'
        ? await (await fetch(uri)).blob()
        : decode(
            await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            })
          );

    const path = `${session.user.id}/${fileName}`;

    const { error } = await supabase.storage.from(bucket).upload(path, body, {
      contentType,
      upsert: true,
      cacheControl: '3600',
    });

    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);

    return `${data.publicUrl}?t=${Date.now()}`;
  };

  const handleSubmit = async () => {
    if (!name.trim() || !username.trim()) {
      Alert.alert('Missing info', 'Name and username are required.');
      return;
    }

    const built = isRecruiter ? buildRecruiterPayload(recruiter) : buildSeekerPayload(seeker);
    if ('error' in built) {
      Alert.alert(built.error.title, built.error.message);
      return;
    }

    setSubmitting(true);

    try {
      let avatarUrl: string | undefined;
      let resumeUrl: string | undefined;

      if (avatarUri && !avatarUri.startsWith('http')) {
        avatarUrl = await uploadFile('avatars', avatarUri, 'avatar.jpg', 'image/jpeg');
      }

      if (!isRecruiter && resumeFile && !resumeFile.uri.startsWith('http')) {
        resumeUrl = await uploadFile('resumes', resumeFile.uri, 'resume.pdf', 'application/pdf');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          username: username.trim(),
          ...built.payload,
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
          : (err?.message ?? 'Something went wrong.');
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = (key: string) => {
    if (key === 'basics') {
      return (
        <>
          <Pressable style={local.avatarPicker} onPress={pickAvatar}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={shared.avatarPreview} />
            ) : (
              <UserRound size={40} color={c.muted} strokeWidth={1.5} />
            )}
            <Text style={local.avatarPickerText}>
              {avatarUri ? 'Change photo' : isRecruiter ? 'Add company logo' : 'Add profile photo'}
            </Text>
          </Pressable>

          <TextInput
            style={shared.authInput}
            placeholder={isRecruiter ? 'Your name' : 'Name'}
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
        </>
      );
    }

    if (key === 'about') {
      return (
        <>
          <TextInput
            style={[shared.authInput, shared.authTextArea]}
            placeholder={isRecruiter ? 'About your company' : 'A bit about yourself'}
            placeholderTextColor={c.muted}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {!isRecruiter && (
            <Pressable style={local.resumePicker} onPress={pickResume}>
              <Text style={local.resumePickerText}>
                {resumeFile ? resumeFile.name : 'Upload resume (PDF)'}
              </Text>
            </Pressable>
          )}
        </>
      );
    }

    return isRecruiter ? (
      <RecruiterFields
        step={key as (typeof RECRUITER_STEPS)[number]['key']}
        value={recruiter}
        onChange={(patch) => setRecruiter((prev) => ({ ...prev, ...patch }))}
      />
    ) : (
      <SeekerFields
        step={key as (typeof SEEKER_STEPS)[number]['key']}
        value={seeker}
        onChange={(patch) => setSeeker((prev) => ({ ...prev, ...patch }))}
      />
    );
  };

  return (
    <StepForm
      steps={steps}
      stepIndex={stepIndex}
      onStepChange={setStepIndex}
      wizard={wizard}
      loading={loading}
      renderStep={renderStep}
      stepProblem={stepProblem}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel="Finish setup"
      saveLabel="Save changes"
      editingSubtitle="Edit your profile."
      exit={
        onCancel
          ? { kind: 'back', label: 'Go back', onPress: onCancel }
          : onBackToLogin
            ? { kind: 'close', label: 'Cancel and return to login', onPress: onBackToLogin }
            : undefined
      }
    />
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
