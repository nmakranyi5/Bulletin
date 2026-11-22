import { Session } from '@supabase/supabase-js';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { FileCheck, FileUp, UserRound } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { DEFAULT_REPLY_DAYS, REPLY_DAY_OPTIONS, isReplyDays } from '../../../lib/reply-window';
import { supabase } from '../../../lib/supabase';
import { ChipSelect } from '../../components/chip-select';
import { StepForm } from '../../components/step-form';
import { uploadFileToBucket } from './upload';
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
import { useT } from '../../../lib/i18n';

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
  const t = useT();
  const local = useLocalStyles();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [isRecruiter, setIsRecruiter] = useState(false);
  const [seeker, setSeeker] = useState<SeekerValues>(emptySeeker);
  const [recruiter, setRecruiter] = useState<RecruiterValues>(emptyRecruiter);
  const [description, setDescription] = useState('');
  // How many days you usually take to reply; it feeds the reply time agreed with each match.
  const [replyDays, setReplyDays] = useState<number>(DEFAULT_REPLY_DAYS);
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
      // (Editing an existing profile isn't "getting set up".)
      title: wizard
        ? isRecruiter
          ? t('onb.setupCompany')
          : t('onb.setupYou')
        : t('onb.basics'),
      subtitle: wizard ? t('onb.startBasics') : t('onb.basicsSub'),
    },
    // New job seekers add their resume right after the basics; shops look at it first.
    ...(wizard && !isRecruiter
      ? [
          {
            key: 'resume',
            title: t('onb.resumeTitle'),
            subtitle: t('onb.resumeSub'),
          },
        ]
      : []),
    ...(isRecruiter ? RECRUITER_STEPS : SEEKER_STEPS),
    {
      key: 'replies',
      title: t('onb.repliesTitle'),
      subtitle: t('onb.repliesSub'),
    },
    {
      key: 'about',
      title: isRecruiter ? t('onb.aboutCompany') : t('onb.aboutYou'),
      subtitle: isRecruiter ? t('onb.aboutCompanySub') : t('onb.aboutYouSub'),
    },
  ];

  // What stops you moving on from a step, or null when it is fine to continue.
  const stepProblem = (key: string): { title: string; message: string } | null => {
    if (key === 'basics' && (!name.trim() || !username.trim())) {
      return { title: t('common.missingInfo'), message: t('onb.nameUsernameRequired') };
    }
    if (key === 'resume' && !resumeFile) {
      return { title: t('onb.resumeNeeded'), message: t('onb.resumeContinue') };
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
        if (isReplyDays(data.reply_days)) setReplyDays(data.reply_days);
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
      Alert.alert(t('onb.permissionTitle'), t('onb.permissionBody'));
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
    const path = `${session.user.id}/${fileName}`;
    await uploadFileToBucket(bucket, path, uri, contentType, { upsert: true });

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);

    return `${data.publicUrl}?t=${Date.now()}`;
  };

  const handleSubmit = async () => {
    if (!name.trim() || !username.trim()) {
      Alert.alert(t('common.missingInfo'), t('onb.nameUsernameRequired'));
      return;
    }

    if (wizard && !isRecruiter && !resumeFile) {
      Alert.alert(t('onb.resumeNeeded'), t('onb.resumeFinish'));
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

      const fields = {
        name: name.trim(),
        username: username.trim(),
        ...built.payload,
        description: description.trim(),
        ...(avatarUrl && { avatar_url: avatarUrl }),
        ...(resumeUrl && { resume_url: resumeUrl }),
        onboarded: true,
      };
      let { error } = await supabase
        .from('profiles')
        .update({ ...fields, reply_days: replyDays })
        .eq('id', session.user.id);

      // Until the reply-time migration has been run there is no reply_days column; save the rest.
      if (error && /reply_days/.test(error.message)) {
        ({ error } = await supabase.from('profiles').update(fields).eq('id', session.user.id));
      }

      if (error) throw error;

      onComplete();
    } catch (err: any) {
      const message =
        err?.code === '23505'
          ? t('onb.usernameTaken')
          : (err?.message ?? t('onb.wentWrong'));
      Alert.alert(t('common.error'), message);
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
              {avatarUri
                ? t('onb.changePhoto')
                : isRecruiter
                  ? t('onb.addLogo')
                  : t('onb.addPhoto')}
            </Text>
          </Pressable>

          <TextInput
            style={shared.authInput}
            placeholder={isRecruiter ? t('onb.yourName') : t('onb.name')}
            placeholderTextColor={c.muted}
            value={name}
            onChangeText={setName}
          />

          <TextInput
            style={shared.authInput}
            placeholder={t('onb.username')}
            placeholderTextColor={c.muted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        </>
      );
    }

    if (key === 'resume') {
      return (
        <>
          <Pressable
            style={[local.resumeDrop, resumeFile && local.resumeDropDone]}
            onPress={pickResume}
            accessibilityRole="button"
            accessibilityLabel={resumeFile ? t('onb.replaceResume') : t('onb.uploadResumeLabel')}
          >
            {resumeFile ? (
              <FileCheck size={34} color={c.green} strokeWidth={1.8} />
            ) : (
              <FileUp size={34} color={c.muted} strokeWidth={1.8} />
            )}
            <Text style={local.resumeDropTitle} numberOfLines={2}>
              {resumeFile ? resumeFile.name : t('onb.uploadYourResume')}
            </Text>
            <Text style={local.resumeDropHint}>
              {resumeFile ? t('onb.chooseDifferent') : t('onb.pdfFromFiles')}
            </Text>
          </Pressable>
        </>
      );
    }

    if (key === 'replies') {
      return (
        <>
          <ChipSelect
            label={t('onb.replyWithin')}
            options={REPLY_DAY_OPTIONS.map((d) => `${d} day${d === 1 ? '' : 's'}`)}
            selected={[`${replyDays} day${replyDays === 1 ? '' : 's'}`]}
            onToggle={(o) => setReplyDays(parseInt(o, 10))}
          />
          <Text style={shared.chipHint}>
            {t('onb.replyHint')}
          </Text>
        </>
      );
    }

    if (key === 'about') {
      return (
        <>
          <TextInput
            style={[shared.authInput, shared.authTextArea]}
            placeholder={isRecruiter ? t('onb.aboutCompanyPlaceholder') : t('onb.aboutYouPlaceholder')}
            placeholderTextColor={c.muted}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {!isRecruiter && !wizard && (
            <Pressable style={local.resumePicker} onPress={pickResume}>
              <Text style={local.resumePickerText}>
                {resumeFile ? resumeFile.name : t('onb.uploadResumePdf')}
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
      submitLabel={t('onb.finish')}
      saveLabel={t('onb.saveChanges')}
      editingSubtitle={t('onb.editSubtitle')}
      exit={
        onCancel
          ? { kind: 'back', label: t('onb.goBack'), onPress: onCancel }
          : onBackToLogin
            ? { kind: 'close', label: t('onb.cancelLogin'), onPress: onBackToLogin }
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

        resumeDrop: {
          alignItems: 'center',
          gap: 8,
          paddingVertical: 36,
          paddingHorizontal: 20,
          borderRadius: 18,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: c.borderStrong,
          backgroundColor: c.surface,
        },

        resumeDropDone: {
          borderStyle: 'solid',
          borderColor: c.green,
        },

        resumeDropTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: c.text,
          textAlign: 'center',
        },

        resumeDropHint: {
          fontSize: 13,
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
