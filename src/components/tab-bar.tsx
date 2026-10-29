import { Handshake, MessageCircle, Search, UserRound } from 'lucide-react-native';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/app-theme';
import { APP_MAX_WIDTH } from '../constants/app';

export type TabKey = 'discover' | 'interests' | 'messages' | 'profile';

export const TABS: { key: TabKey; label: string; Icon: typeof Search }[] = [
  { key: 'discover', label: 'Discover', Icon: Search },
  { key: 'interests', label: 'Interests', Icon: Handshake },
  { key: 'messages', label: 'Messages', Icon: MessageCircle },
  { key: 'profile', label: 'Profile', Icon: UserRound },
];

export function TabBar({
  activeTab,
  onTabPress,
  unseenReceivedCount,
  unreadMessagesCount = 0,
}: {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
  unseenReceivedCount: number;
  // Unread messages across your active chats.
  unreadMessagesCount?: number;
}) {
  const c = useTheme().colors;
  const local = useLocalStyles();
  const insets = useSafeAreaInsets();

  return (
    <View style={[local.bar, Platform.OS === 'web' && local.barWebFullWidth]}>
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
              <Text style={[local.tabLabel, isActive && local.tabLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        // The bar's background and top line; on the web it runs edge to edge while the tabs
        // themselves stay in the app's column.
        bar: {
          borderTopWidth: 1,
          borderTopColor: c.border,
          backgroundColor: c.surface,
        },

        // Breaks out of the centred app column to the full window width (a standard CSS
        // full-bleed trick; web only).
        barWebFullWidth: {
          width: '100vw',
          marginLeft: 'calc(50% - 50vw)',
        } as any,

        tabBar: {
          flexDirection: 'row',
          width: '100%',
          maxWidth: APP_MAX_WIDTH,
          alignSelf: 'center',
          paddingTop: 10,
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

// The navigation on wide web windows: a sidebar down the left instead of the bottom bar.
export function SideNav({
  activeTab,
  onTabPress,
  unseenReceivedCount,
  unreadMessagesCount = 0,
}: {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
  unseenReceivedCount: number;
  unreadMessagesCount?: number;
}) {
  const c = useTheme().colors;
  const local = useSideStyles();

  const countFor = (key: TabKey) =>
    key === 'messages' ? unreadMessagesCount : key === 'interests' ? unseenReceivedCount : 0;

  return (
    <View style={local.nav}>
      <Text style={local.logo}>bulletin.</Text>
      <View style={local.items}>
        {TABS.map(({ key, label, Icon }) => {
          const isActive = key === activeTab;
          const count = countFor(key);
          return (
            <Pressable
              key={key}
              onPress={() => onTabPress(key)}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={({ hovered }: any) => [
                local.item,
                (isActive || hovered) && local.itemHighlight,
              ]}
            >
              <Icon
                size={22}
                color={isActive ? c.text : c.textSecondary}
                strokeWidth={isActive ? 2.4 : 2}
              />
              <Text style={[local.label, isActive && local.labelActive]}>{label}</Text>
              {count > 0 && (
                <View style={local.count}>
                  <Text style={local.countText}>{count > 9 ? '9+' : count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function useSideStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        nav: {
          width: 248,
          paddingHorizontal: 16,
          paddingTop: 28,
          borderRightWidth: 1,
          borderRightColor: c.border,
          backgroundColor: c.bg,
        },

        logo: {
          paddingHorizontal: 12,
          marginBottom: 26,
          fontSize: 29,
          fontWeight: '900',
          letterSpacing: -1.3,
          color: c.text,
        },

        items: {
          gap: 4,
        },

        item: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingHorizontal: 12,
          paddingVertical: 12,
          borderRadius: 14,
        },

        itemHighlight: {
          backgroundColor: c.surfaceAlt,
        },

        label: {
          flex: 1,
          fontSize: 16,
          fontWeight: '600',
          color: c.textSecondary,
        },

        labelActive: {
          fontWeight: '800',
          color: c.text,
        },

        count: {
          minWidth: 22,
          height: 22,
          paddingHorizontal: 6,
          borderRadius: 11,
          backgroundColor: c.danger,
          alignItems: 'center',
          justifyContent: 'center',
        },

        countText: {
          fontSize: 12,
          fontWeight: '800',
          color: c.white,
        },
      }),
    [c]
  );
}
