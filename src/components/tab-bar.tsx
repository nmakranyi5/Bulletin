import { Handshake, MessageCircle, Search, UserRound } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/app-theme';

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
  overdueMessagesCount = 0,
}: {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
  unseenReceivedCount: number;
  // Chats where you owe an overdue reply.
  overdueMessagesCount?: number;
}) {
  const c = useTheme().colors;
  const local = useLocalStyles();
  const insets = useSafeAreaInsets();

  return (
    <View style={[local.tabBar, { paddingBottom: insets.bottom || 12 }]}>
      {TABS.map(({ key, label, Icon }) => {
        const isActive = key === activeTab;

        return (
          <Pressable
            key={key}
            style={local.tabItem}
            onPress={() => onTabPress(key)}
          >
          <View>
            <Icon
              size={24}
              color={isActive ? c.text : c.muted}
              strokeWidth={isActive ? 2.4 : 2}
            />
            {key === 'messages' && overdueMessagesCount > 0 && (
              <View style={local.badge}>
                <Text style={local.badgeText}>
                  {overdueMessagesCount > 9 ? '9+' : overdueMessagesCount}
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
            <Text
              style={[
                local.tabLabel,
                isActive && local.tabLabelActive,
              ]}
            >
              {label}
            </Text>
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
