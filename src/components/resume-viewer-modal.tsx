import { X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../lib/app-theme';
import { resumeViewerUrl } from '../../lib/resume';
import { useResumeUrl } from './use-resume-url';

// Shows a PDF or image document (a resume by default) inside the app. (The web version is resume-viewer-modal.web.tsx.)
export function ResumeViewerModal({
  visible,
  url,
  name,
  title,
  onClose,
}: {
  visible: boolean;
  url: string;
  name?: string | null;
  // Overrides the heading, for documents that aren't a resume.
  title?: string;
  onClose: () => void;
}) {
  const c = useTheme().colors;
  const local = useLocalStyles();
  const [loading, setLoading] = useState(true);
  const link = useResumeUrl(url, visible);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* A Modal is a separate native window, so it needs its own insets provider. */}
      <SafeAreaProvider>
        <SafeAreaView style={local.screen}>
          <View style={local.header}>
            <Text style={local.title} numberOfLines={1}>
              {title ?? (name ? `${name}'s resume` : 'Resume')}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={22} color={c.text} strokeWidth={2.2} />
            </Pressable>
          </View>

          <View style={local.body}>
            {visible && link.url && (
              <WebView
                source={{ uri: resumeViewerUrl(link.url, Platform.OS) }}
                style={local.web}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                startInLoadingState={false}
              />
            )}
            {(loading || !link.url) && visible && (
              <View style={local.loading} pointerEvents="none">
                <ActivityIndicator color={c.muted} />
              </View>
            )}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          backgroundColor: c.bg,
        },

        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingHorizontal: 20,
          paddingVertical: 14,
        },

        title: {
          flex: 1,
          fontSize: 18,
          fontWeight: '800',
          color: c.text,
        },

        body: {
          flex: 1,
          backgroundColor: c.surfaceAlt,
        },

        web: {
          flex: 1,
          backgroundColor: c.surfaceAlt,
        },

        loading: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
    [c]
  );
}
