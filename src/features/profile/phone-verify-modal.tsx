import { ShieldCheck, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { OTP_LENGTH, cleanCode, formatPhone, phoneErrorMessage, toE164 } from '../../../lib/phone';
import { supabase } from '../../../lib/supabase';
import { useSharedStyles } from '../../styles/shared';

const RESEND_SECONDS = 30;

// Verifies a phone number: type it, get a text, enter the code. On success the account gets
// a "Phone verified" badge. (Others see the badge only, never the number.)
export function PhoneVerifyModal({
  visible,
  onClose,
  onVerified,
}: {
  visible: boolean;
  onClose: () => void;
  onVerified: () => void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setPhone('');
      setSentTo(null);
      setCode('');
      setBusy(false);
      setCooldown(0);
      setError(null);
    }
  }, [visible]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    const e164 = toE164(phone);
    if (!e164) {
      setError('Enter a valid phone number, e.g. (512) 555-0123.');
      return;
    }
    setBusy(true);
    setError(null);
    // Attaching a number to the account sends it a code (type "phone_change").
    const { error: err } = await supabase.auth.updateUser({ phone: e164 });
    setBusy(false);
    if (err) {
      setError(phoneErrorMessage(err.message));
      return;
    }
    setSentTo(e164);
    setCode('');
    setCooldown(RESEND_SECONDS);
  };

  const resend = async () => {
    if (!sentTo || cooldown > 0) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resend({ type: 'phone_change', phone: sentTo });
    setBusy(false);
    if (err) setError(phoneErrorMessage(err.message));
    else setCooldown(RESEND_SECONDS);
  };

  const verify = async () => {
    if (!sentTo || code.length !== OTP_LENGTH) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({
      phone: sentTo,
      token: code,
      type: 'phone_change',
    });
    setBusy(false);
    if (err) {
      setError(phoneErrorMessage(err.message));
      return;
    }
    onVerified();
    Alert.alert('Phone verified', 'Your profile now shows a "Phone verified" badge.');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={local.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={local.card}>
          <View style={local.header}>
            <View style={local.iconCircle}>
              <ShieldCheck size={22} color={c.onAccent} strokeWidth={2.2} />
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={22} color={c.textSecondary} strokeWidth={2.2} />
            </Pressable>
          </View>

          <Text style={local.title}>Verify your phone</Text>

          {!sentTo ? (
            <>
              <Text style={local.body}>
                We'll text you a code. Your profile gets a "Phone verified" badge, so people know
                you're real. Your number is never shown to anyone.
              </Text>
              <TextInput
                style={[shared.authInput, local.input]}
                placeholder="Phone number"
                placeholderTextColor={c.muted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                editable={!busy}
                onSubmitEditing={sendCode}
              />
              <Pressable
                style={[shared.authButton, busy && shared.authButtonDisabled]}
                onPress={sendCode}
                disabled={busy}
              >
                <Text style={shared.authButtonText}>{busy ? 'Sending...' : 'Send code'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={local.body}>
                Enter the {OTP_LENGTH}-digit code we texted to {formatPhone(sentTo)}.
              </Text>
              <TextInput
                style={[shared.authInput, local.input, local.codeInput]}
                placeholder="123456"
                placeholderTextColor={c.muted}
                value={code}
                onChangeText={(t) => setCode(cleanCode(t))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                editable={!busy}
                onSubmitEditing={verify}
                autoFocus
              />
              <Pressable
                style={[
                  shared.authButton,
                  (busy || code.length !== OTP_LENGTH) && shared.authButtonDisabled,
                ]}
                onPress={verify}
                disabled={busy || code.length !== OTP_LENGTH}
              >
                <Text style={shared.authButtonText}>{busy ? 'Checking...' : 'Verify'}</Text>
              </Pressable>

              <View style={local.linkRow}>
                <Pressable onPress={resend} disabled={busy || cooldown > 0}>
                  <Text style={[local.link, cooldown > 0 && local.linkDisabled]}>
                    {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setSentTo(null);
                    setError(null);
                  }}
                  disabled={busy}
                >
                  <Text style={local.link}>Change number</Text>
                </Pressable>
              </View>
            </>
          )}

          {error ? <Text style={local.error}>{error}</Text> : null}
        </View>
      </KeyboardAvoidingView>
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
          alignItems: 'center',
          padding: 20,
        },

        card: {
          width: '100%',
          maxWidth: 420,
          padding: 22,
          borderRadius: 24,
          backgroundColor: c.surface,
        },

        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },

        iconCircle: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.accent,
        },

        title: {
          marginTop: 14,
          fontSize: 22,
          fontWeight: '800',
          letterSpacing: -0.4,
          color: c.text,
        },

        body: {
          marginTop: 6,
          marginBottom: 14,
          fontSize: 15,
          lineHeight: 21,
          color: c.textSecondary,
        },

        input: {
          marginBottom: 2,
        },

        codeInput: {
          fontSize: 22,
          fontWeight: '700',
          letterSpacing: 6,
          textAlign: 'center',
        },

        linkRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 14,
        },

        link: {
          fontSize: 14,
          fontWeight: '600',
          color: c.blue,
        },

        linkDisabled: {
          color: c.muted,
        },

        error: {
          marginTop: 14,
          fontSize: 14,
          lineHeight: 20,
          color: c.danger,
        },
      }),
    [c]
  );
}
