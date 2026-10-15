import { ChevronDown, ChevronUp, UserRound } from 'lucide-react-native';
import { ReactNode, useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { useSharedStyles } from '../../styles/shared';

// Discover card frame. Collapsed: hero + a brief rundown + a "tap for details" hint.
// Expanded: compact header + the full profile in a scrollable area.
// Expanding is triggered by a tap gesture on the card (see use-swipe-deck);
// collapsing is explicit (header or the "Show less" button).
export function ExpandableCard({
  avatarUrl,
  info,
  expanded,
  onCollapse,
  brief,
  details,
}: {
  avatarUrl?: string | null;
  info: ReactNode;
  expanded: boolean;
  onCollapse?: () => void;
  brief: ReactNode;
  details: ReactNode;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();

  if (!expanded) {
    return (
      <>
        <View style={shared.profileSection}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={shared.cardAvatarPreview} />
          ) : (
            <UserRound size={92} color={c.muted} strokeWidth={1.5} />
          )}
          <View style={shared.profileInfo}>{info}</View>
        </View>

        <View style={shared.content}>
          {brief}

          <View style={local.hintRow}>
            <Text style={local.hintText}>Tap for details</Text>
            <ChevronDown size={16} color={c.muted} strokeWidth={2.4} />
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Pressable style={local.compactHero} onPress={onCollapse}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={local.compactAvatar} />
        ) : (
          <UserRound size={48} color={c.muted} strokeWidth={1.5} />
        )}
        <View style={local.compactInfo}>{info}</View>
        <ChevronUp size={20} color={c.textSecondary} strokeWidth={2.4} />
      </Pressable>

      <ScrollView
        style={local.scroll}
        contentContainerStyle={local.detailsContent}
        showsVerticalScrollIndicator={false}
      >
        {details}

        <Pressable style={local.showLess} onPress={onCollapse}>
          <Text style={local.showLessText}>Show less</Text>
          <ChevronUp size={16} color={c.textSecondary} strokeWidth={2.4} />
        </Pressable>
      </ScrollView>
    </>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        hintRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          marginTop: 'auto',
          paddingTop: 12,
        },

        hintText: {
          fontSize: 13,
          fontWeight: '600',
          color: c.muted,
        },

        compactHero: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 18,
          paddingVertical: 14,
          backgroundColor: c.border,
        },

        compactAvatar: {
          width: 48,
          height: 48,
          borderRadius: 24,
        },

        compactInfo: {
          flex: 1,
        },

        scroll: {
          flex: 1,
        },

        detailsContent: {
          padding: 22,
          paddingBottom: 28,
        },

        showLess: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          marginTop: 24,
          paddingVertical: 10,
        },

        showLessText: {
          fontSize: 13,
          fontWeight: '600',
          color: c.textSecondary,
        },
      }),
    [c]
  );
}
