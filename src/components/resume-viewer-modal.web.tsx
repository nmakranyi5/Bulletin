import { ExternalLink, X } from 'lucide-react-native';
import { useMemo } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/app-theme';
import { useResumeUrl } from './use-resume-url';

// Shows someone's PDF resume on the web, using the browser's own PDF viewer.
export function ResumeViewerModal({
  visible,
  url,
  name,
  onClose,
}: {
  visible: boolean;
  url: string;
  name?: string | null;
  onClose: () => void;
}) {
  const c = useTheme().colors;
  const local = useLocalStyles();
  const link = useResumeUrl(url, visible);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={local.overlay}>
        <View style={local.card}>
          <View style={local.header}>
            <Text style={local.title} numberOfLines={1}>
              {name ? `${name}'s resume` : 'Resume'}
            </Text>
            <Pressable
              onPress={() => Linking.openURL(link.url ?? url)}
              hitSlop={10}
              accessibilityLabel="Open in a new tab"
            >
              <ExternalLink size={20} color={c.textSecondary} strokeWidth={2.2} />
            </Pressable>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={22} color={c.text} strokeWidth={2.2} />
            </Pressable>
          </View>
          {visible && link.url && (
            <iframe
              src={link.url}
              title="Resume"
              style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }}
            />
          )}
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
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        },

        card: {
          width: '100%',
          maxWidth: 720,
          height: '100%',
          maxHeight: 900,
          backgroundColor: c.bg,
          borderRadius: 24,
          overflow: 'hidden',
        },

        header: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          paddingHorizontal: 20,
          paddingVertical: 14,
        },

        title: {
          flex: 1,
          fontSize: 18,
          fontWeight: '800',
          color: c.text,
        },
      }),
    [c]
  );
}
