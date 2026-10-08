import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { Colors, useTheme } from '../../lib/app-theme';

export function makeSharedStyles(c: Colors) {
  return StyleSheet.create({
    logo: {
      fontSize: 29,
      fontWeight: '900',
      letterSpacing: -1.3,
      color: c.text,
    },

    subtitle: {
      marginTop: 2,
      fontSize: 13,
      color: c.textSecondary,
    },

    profileSection: {
      height: '45%',
      backgroundColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    profileInfo: {
      position: 'absolute',
      left: 22,
      right: 22,
      bottom: 18,
    },

    cardAvatarPreview: {
      width: 92,
      height: 92,
      borderRadius: 46,
    },

    name: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800',
      letterSpacing: -0.8,
      color: c.text,
      marginBottom: 6,
    },

    recruiterMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },

    recruiterTitle: {
      flexShrink: 1,
      fontSize: 14,
      color: c.textStrong,
    },

    companyChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor: c.surface,
    },

    companyText: {
      fontSize: 12,
      fontWeight: '700',
      color: c.text,
    },

    content: {
      flex: 1,
      padding: 22,
    },

    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: c.muted,
    },

    position: {
      flex: 1,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: c.text,
    },

    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 18,
    },

    note: {
      marginTop: 20,
      fontSize: 15,
      lineHeight: 22,
      color: c.textStrong,
    },

    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      gap: 4,
    },

    emptyTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: c.text,
    },

    emptySubtitle: {
      marginTop: 8,
      fontSize: 15,
      color: c.textSecondary,
      textAlign: 'center',
    },

    refreshButton: {
      marginTop: 24,
      paddingHorizontal: 20,
      paddingVertical: 12,

      borderRadius: 14,
      backgroundColor: c.accent,
    },

    refreshText: {
      color: c.onAccent,
      fontWeight: '700',
    },

    simpleScreen: {
      flex: 1,
    },

    screenHeader: {
      paddingHorizontal: 22,
      paddingTop: 8,
      paddingBottom: 14,
    },

    screenTitle: {
      fontSize: 29,
      fontWeight: '900',
      letterSpacing: -1.3,
      color: c.text,
    },

    interestsList: {
      paddingHorizontal: 22,
      paddingTop: 8,
      gap: 12,
    },

    interestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 18,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },

    interestRowInfo: {
      flex: 1,
    },

    interestRowName: {
      fontSize: 16,
      fontWeight: '700',
      color: c.text,
    },

    interestRowMeta: {
      marginTop: 2,
      fontSize: 13,
      color: c.textSecondary,
    },

    subTabBar: {
      flexDirection: 'row',
      marginHorizontal: 22,
      marginBottom: 12,
      padding: 4,
      borderRadius: 14,
      backgroundColor: c.surfaceAlt,
    },

    subTabItem: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      alignItems: 'center',
    },

    subTabItemActive: {
      backgroundColor: c.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },

    subTabText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textSecondary,
    },

    subTabTextActive: {
      color: c.text,
    },

    chatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },

    chatBackButton: {
      padding: 4,
    },

    chatHeaderInfo: {
      flex: 1,
    },

    chatHeaderName: {
      fontSize: 17,
      fontWeight: '700',
      color: c.text,
    },

    authContainer: {
      flex: 1,
      backgroundColor: c.bg,
    },

    authInner: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 28,
      gap: 12,
    },

    authInput: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      fontSize: 15,
      color: c.text,
      marginTop: 8,
    },

    authButton: {
      marginTop: 12,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.accent,
      alignItems: 'center',
    },

    authButtonDisabled: {
      backgroundColor: c.muted,
    },

    authButtonText: {
      color: c.onAccent,
      fontWeight: '700',
      fontSize: 15,
    },

    avatarPreview: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },

    authTextArea: {
      minHeight: 90,
      textAlignVertical: 'top',
    },

    chipHint: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: -4,
    },

    mismatchText: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '600',
      color: c.amber,
    },
  });
}

export function useSharedStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeSharedStyles(colors), [colors]);
}
