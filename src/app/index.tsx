import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../lib/app-theme';
import { TabBar, TabKey } from '../components/tab-bar';
import { AuthScreen } from '../features/auth/auth-screen';
import { ResetPasswordScreen } from '../features/auth/reset-password-screen';
import { useAuthSession } from '../features/auth/use-auth-session';
import { DiscoverScreen } from '../features/discover/discover-screen';
import { PositionPickerModal } from '../features/discover/position-picker-modal';
import { useDiscover } from '../features/discover/use-discover';
import { useSwipeDeck } from '../features/discover/use-swipe-deck';
import { InterestsScreen } from '../features/interests/interests-screen';
import { useInterests } from '../features/interests/use-interests';
import { ChatScreen } from '../features/messages/chat-screen';
import { MessagesScreen } from '../features/messages/messages-screen';
import { useMatches } from '../features/messages/use-matches';
import { OnboardingScreen } from '../features/profile/onboarding-screen';
import { PositionsScreen } from '../features/profile/positions-screen';
import { ProfileScreen } from '../features/profile/profile-screen';
import { useMyProfile } from '../features/profile/use-my-profile';
import { useSharedStyles } from '../styles/shared';

// App shell: wires auth + feature state together and picks what to show.
// Each feature owns its data in a use-*.ts hook; this file only connects them.
export default function Index() {
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [activeTab, setActiveTab] = useState<TabKey>('discover');
  const [editingProfile, setEditingProfile] = useState(false);
  const [managingPositions, setManagingPositions] = useState(false);

  const { session, authLoading, recovering, setRecovering, onboarded, setOnboarded } =
    useAuthSession();
  const ready = !!session && !!onboarded;

  const { myProfile, fetchMyProfile } = useMyProfile(session, onboarded);

  // The hooks below depend on each other's refetchers; the callbacks are only
  // invoked later (never during render), so referencing later consts is safe.
  const interests = useInterests(session, ready, {
    onAccepted: () => matches.fetchMatches(),
    onWithdrawn: () => discover.fetchDiscoverCards(),
  });
  const matches = useMatches(session, ready, () => interests.fetchInterests());
  const discover = useDiscover(
    session,
    myProfile,
    interests.interestsRemaining,
    interests.sendInterest
  );
  const swipe = useSwipeDeck(
    discover.topCard?.id,
    interests.interestsRemaining,
    discover.removeTopCard,
    discover.expandTopCard
  );

  if (authLoading || (session && onboarded === null)) {
    return (
      <View style={local.authLoadingContainer}>
        <Text style={shared.subtitle}>Loading...</Text>
      </View>
    );
  }

  if (!session) {
    return <AuthScreen setRecovering={setRecovering} />;
  }

  if (recovering) {
    return <ResetPasswordScreen onDone={() => setRecovering(false)} />;
  }

  if (!onboarded) {
    return <OnboardingScreen session={session} onComplete={() => setOnboarded(true)} />;
  }

  if (editingProfile) {
    return (
      <OnboardingScreen
        session={session}
        onComplete={() => {
          setEditingProfile(false);
          fetchMyProfile();
        }}
        onCancel={() => setEditingProfile(false)}
      />
    );
  }

  if (managingPositions) {
    return <PositionsScreen session={session} onBack={() => setManagingPositions(false)} />;
  }

  if (onboarded && myProfile === null) {
    return (
      <View style={local.authLoadingContainer}>
        <Text style={shared.subtitle}>Loading...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={local.root}>
      {/* The tab bar handles the bottom inset; chat hides it, so then we do. */}
      <SafeAreaView
        style={local.container}
        edges={matches.selectedMatch ? ['top', 'bottom'] : ['top']}
      >
        {activeTab === 'discover' && (
          <DiscoverScreen
            cards={discover.discoverCards}
            topCard={discover.topCard}
            cardStyle={swipe.cardStyle}
            passStyle={swipe.passStyle}
            interestedStyle={swipe.interestedStyle}
            gesture={swipe.gesture}
            buttonSwipe={swipe.buttonSwipe}
            expandedCardId={discover.expandedCardId}
            onCollapse={discover.collapseCard}
            onRefresh={discover.fetchDiscoverCards}
            interestsRemaining={interests.interestsRemaining}
            isRecruiter={!!myProfile?.is_recruiter}
            me={myProfile}
            loading={discover.discoverLoading}
          />
        )}

        {activeTab === 'interests' && (
          <InterestsScreen
            sentInterests={interests.visibleSentInterests}
            receivedInterests={interests.receivedInterests}
            onReceivedPress={interests.handleReceivedPress}
            onWithdraw={interests.withdrawInterest}
            interestsRemaining={interests.interestsRemaining}
          />
        )}
        {activeTab === 'messages' && (
          matches.selectedMatch ? (
            <ChatScreen
              match={matches.selectedMatch}
              userId={session.user.id}
              onClose={() => matches.closeMatch(matches.selectedMatch!)}
              onBack={() => {
                matches.setSelectedMatch(null);
                matches.fetchMatches();
              }}
            />
          ) : (
            <MessagesScreen
              matches={matches.matches}
              meta={matches.convoMeta}
              onMatchPress={matches.setSelectedMatch}
              onRefresh={matches.fetchMatches}
            />
          )
        )}
        {activeTab === 'profile' && (
          <ProfileScreen
            session={session}
            onEditProfile={() => setEditingProfile(true)}
            onManagePositions={() => setManagingPositions(true)}
          />
        )}
      </SafeAreaView>
      {!matches.selectedMatch && (
        <TabBar
          activeTab={activeTab}
          onTabPress={setActiveTab}
          unseenReceivedCount={interests.unseenReceivedCount}
        />
      )}

      <PositionPickerModal
        visible={!!discover.pendingInterestTarget}
        positions={discover.pendingInterestTarget?.positions ?? []}
        onSubmit={discover.handlePositionSubmit}
        onCancel={discover.clearPendingInterestTarget}
      />
    </GestureHandlerRootView>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: c.bg,
        },

        container: {
          flex: 1,
        },

        authLoadingContainer: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.bg,
        },
      }),
    [c]
  );
}
