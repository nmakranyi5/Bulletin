import { Session } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, UserRound, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../lib/app-theme';
import { supabase } from '../../../lib/supabase';
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
  const current = steps[Math.min(stepIndex, steps.length - 1)];
  const isLastStep = stepIndex >= steps.length - 1;

  // What stops you moving on from a step, or null when it is fine to continue.
  const stepProblem = (key: string): { title: string; message: string } | null => {
    if (key === 'basics' && (!name.trim() || !username.trim())) {
      return { title: 'Missing info', message: 'Name and username are required.' };
    }
    if (isRecruiter) return recruiterStepError(key as any, recruiter);
    return seekerStepError(key as any, seeker);
  };

  const goNext = () => {
    const problem = stepProblem(current.key);
    if (problem) {
      Alert.alert(problem.title, problem.message);
      return;
    }
    if (isLastStep) handleSubmit();
    else setStepIndex((i) => i + 1);
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
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const path = `${session.user.id}/${fileName}`;

    const { error } = await supabase.storage.from(bucket).upload(path, decode(base64), {
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
    <SafeAreaView style={shared.authContainer}>
      <KeyboardAvoidingView
        style={local.page}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={local.topRow}>
          <Text style={shared.logo}>bulletin.</Text>
          {(onCancel || onBackToLogin) && (
            <Pressable
              onPress={onCancel ?? onBackToLogin}
              disabled={submitting}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={onCancel ? 'Go back' : 'Cancel and return to login'}
              style={shared.chatBackButton}
            >
              {onCancel ? (
                <ArrowLeft size={22} color={c.text} strokeWidth={2.2} />
              ) : (
                <X size={22} color={c.text} strokeWidth={2.2} />
              )}
            </Pressable>
          )}
        </View>

        {loading ? (
          <Text style={shared.subtitle}>Loading...</Text>
        ) : (
          <>
            {wizard ? (
              <View
                style={local.progress}
                accessibilityLabel={`Step ${stepIndex + 1} of ${steps.length}`}
              >
                {steps.map((step, i) => (
                  <View
                    key={step.key}
                    style={[local.progressBar, i <= stepIndex && local.progressDone]}
                  />
                ))}
              </View>
            ) : (
              <Text style={shared.subtitle}>Edit your profile.</Text>
            )}

            <ScrollView
              style={local.scroll}
              contentContainerStyle={local.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {(wizard ? [current] : steps).map((step) => (
                <View key={step.key} style={local.section}>
                  <Text style={local.stepTitle}>{step.title}</Text>
                  <Text style={local.stepSubtitle}>{step.subtitle}</Text>
                  <View style={local.stepBody}>{renderStep(step.key)}</View>
                </View>
              ))}
            </ScrollView>

            <View style={local.footer}>
              {wizard && stepIndex > 0 && (
                <Pressable
                  style={local.backButton}
                  onPress={() => setStepIndex((i) => Math.max(0, i - 1))}
                  disabled={submitting}
                >
                  <Text style={local.backButtonText}>Back</Text>
                </Pressable>
              )}
              <Pressable
                style={[local.nextButton, submitting && shared.authButtonDisabled]}
                onPress={wizard ? goNext : handleSubmit}
                disabled={submitting}
              >
                <Text style={shared.authButtonText}>
                  {submitting
                    ? 'Saving...'
                    : !wizard
                      ? 'Save changes'
                      : isLastStep
                        ? 'Finish setup'
                        : 'Next'}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        page: {
          flex: 1,
          paddingHorizontal: 28,
          paddingTop: 8,
        },

        topRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        },

        progress: {
          flexDirection: 'row',
          gap: 6,
        },

        progressBar: {
          flex: 1,
          height: 4,
          borderRadius: 2,
          backgroundColor: c.border,
        },

        progressDone: {
          backgroundColor: c.accent,
        },

        scroll: {
          flex: 1,
        },

        scrollContent: {
          paddingTop: 22,
          paddingBottom: 16,
          gap: 28,
        },

        section: {
          gap: 4,
        },

        stepTitle: {
          fontSize: 26,
          fontWeight: '800',
          letterSpacing: -0.6,
          color: c.text,
        },

        stepSubtitle: {
          fontSize: 15,
          lineHeight: 21,
          color: c.textSecondary,
        },

        stepBody: {
          marginTop: 14,
          gap: 12,
        },

        footer: {
          flexDirection: 'row',
          gap: 10,
          paddingTop: 10,
          paddingBottom: 12,
        },

        backButton: {
          paddingHorizontal: 22,
          paddingVertical: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: c.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
        },

        backButtonText: {
          fontSize: 15,
          fontWeight: '700',
          color: c.text,
        },

        nextButton: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 14,
          backgroundColor: c.accent,
          alignItems: 'center',
        },

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
