import { Handshake, MessageCircle, Search, UserRound } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/app-theme';
import { MessageKey, useT } from '../../lib/i18n';

export type TabKey = 'discover' | 'interests' | 'messages' | 'profile';

export const TABS: { key: TabKey; label: MessageKey; Icon: typeof Search }[] = [
  { key: 'discover', label: 'tabs.discover', Icon: Search },
  { key: 'interests', label: 'tabs.interests', Icon: Handshake },
  { key: 'messages', label: 'tabs.messages', Icon: MessageCircle },
  { key: 'profile', label: 'tabs.profile', Icon: UserRound },
];

export function TabBar({
  activeTab,
  onTabPress,
  unseenReceivedCount,
  unreadMessagesCount = 0,
  variant = 'bottom',
}: {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
  unseenReceivedCount: number;
  // Unread messages across your active chats.
  unreadMessagesCount?: number;
  // 'side' is a vertical sidebar for wide web windows.
  variant?: 'bottom' | 'side';
}) {
  const t = useT();
  const c = useTheme().colors;
  const local = useLocalStyles();
  const insets = useSafeAreaInsets();
  const side = variant === 'side';

  if (side) {
    return (
      <View style={local.sidebar}>
        {TABS.map(({ key, label, Icon }) => {
          const isActive = key === activeTab;
          const count =
            key === 'messages'
              ? unreadMessagesCount
              : key === 'interests'
                ? unseenReceivedCount
                : 0;

          return (
            <Pressable
              key={key}
              onPress={() => onTabPress(key)}
              style={(state) => [
                local.sideItem,
                (isActive || (state as { hovered?: boolean }).hovered) && local.sideItemActive,
              ]}
            >
              <Icon
                size={20}
                color={isActive ? c.text : c.textSecondary}
                strokeWidth={isActive ? 2.4 : 2}
              />
              <Text style={[local.sideLabel, isActive && local.sideLabelActive]}>{t(label)}</Text>
              {count > 0 && (
                <View style={local.sideBadge}>
                  <Text style={local.badgeText}>{count > 9 ? '9+' : count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={[local.tabBar, { paddingBottom: insets.bottom || 12 }]}>
      {TABS.map(({ key, label, Icon }) => {
        const isActive = key === activeTab;

        return (
          <Pressable key={key} style={local.tabItem} onPress={() => onTabPress(key)}>
            <View>
              <Icon
                size={24}
                color={isActive ? c.text : c.muted}
                strokeWidth={isActive ? 2.4 : 2}
              />
              {key === 'messages' && unreadMessagesCount > 0 && (
                <View style={local.badge}>
                  <Text style={local.badgeText}>
                    {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                  </Text>
                </View>
              )}
              {key === 'interests' && unseenReceivedCount > 0 && (
                <View style={local.badge}>
                  <Text style={local.badgeText}>
                    {unseenReceivedCount > 9 ? '9+' : unseenReceivedCount}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[local.tabLabel, isActive && local.tabLabelActive]}>{t(label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        tabBar: {
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: c.border,
          backgroundColor: c.surface,
          paddingTop: 10,
        },

        sidebar: {
          width: 232,
          paddingHorizontal: 12,
          paddingTop: 22,
          gap: 4,
          backgroundColor: c.surface,
          borderRightWidth: 1,
          borderRightColor: c.border,
        },

        sideItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 12,
          paddingVertical: 11,
          borderRadius: 10,
        },

        sideItemActive: {
          backgroundColor: c.surfaceAlt,
        },

        sideLabel: {
          flex: 1,
          fontSize: 15,
          fontWeight: '600',
          color: c.textSecondary,
        },

        sideLabelActive: {
          color: c.text,
          fontWeight: '700',
        },

        sideBadge: {
          minWidth: 20,
          height: 20,
          paddingHorizontal: 5,
          borderRadius: 10,
          backgroundColor: c.danger,
          alignItems: 'center',
          justifyContent: 'center',
        },

        tabItem: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
        },

        tabLabel: {
          fontSize: 11,
          fontWeight: '600',
          color: c.muted,
        },

        tabLabelActive: {
          color: c.text,
        },

        badge: {
          position: 'absolute',
          top: -4,
          right: -8,
          minWidth: 16,
          height: 16,
          paddingHorizontal: 3,
          borderRadius: 8,
          backgroundColor: c.danger,
          alignItems: 'center',
          justifyContent: 'center',
        },

        badgeText: {
          color: c.white,
          fontSize: 10,
          fontWeight: '800',
        },
      }),
    [c]
  );
}
