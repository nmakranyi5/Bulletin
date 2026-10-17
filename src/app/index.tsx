import { Session } from '@supabase/supabase-js';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../lib/app-theme';
import { closeReasonsFor } from '../../lib/close-reasons';
import { reasonsFor } from '../../lib/decline-reasons';
import { supabase } from '../../lib/supabase';
import { TabBar, TabKey } from '../components/tab-bar';
import { AuthScreen } from '../features/auth/auth-screen';
import { ResetPasswordScreen } from '../features/auth/reset-password-screen';
import { useAuthSession } from '../features/auth/use-auth-session';
import { DiscoverScreen } from '../features/discover/discover-screen';
import { PositionPickerModal } from '../features/discover/position-picker-modal';
import { useDiscover } from '../features/discover/use-discover';
import { useSwipeDeck } from '../features/discover/use-swipe-deck';
import { DeclineModal } from '../features/interests/decline-modal';
import { InterestsScreen } from '../features/interests/interests-screen';
import { useDeclineNotices } from '../features/interests/use-decline-notices';
import { useInterests } from '../features/interests/use-interests';
import { ChatScreen } from '../features/messages/chat-screen';
import { CloseChatModal } from '../features/messages/close-chat-modal';
import { MessagesScreen } from '../features/messages/messages-screen';
import { useMatches } from '../features/messages/use-matches';
import { OnboardingScreen } from '../features/profile/onboarding-screen';
import { PositionsScreen } from '../features/profile/positions-screen';
import { ProfileScreen } from '../features/profile/profile-screen';
import { useMyProfile } from '../features/profile/use-my-profile';
import { useResponseTimers } from '../features/timers/use-response-timers';
import { useSharedStyles } from '../styles/shared';

// App shell. `Index` decides which auth state we're in; once someone is signed in and
// onboarded, `MainApp` takes over. MainApp is keyed by user id, so signing out and
// signing in as someone else (or creating a new account) always starts from clean state
// instead of inheriting the previous account's profile, interests and matches.
export default function Index() {
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const { session, authLoading, recovering, setRecovering, onboarded, setOnboarded } =
    useAuthSession();

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
    return (
      <OnboardingScreen
        session={session}
        onComplete={() => setOnboarded(true)}
        // Leaving setup signs out, which returns to the login screen. The account and
        // its (unfinished) profile are kept, so signing back in resumes setup.
        onBackToLogin={() => supabase.auth.signOut()}
      />
    );
  }

  return <MainApp key={session.user.id} session={session} />;
}

// Wires the feature hooks together. Each feature owns its data in a use-*.ts hook;
// this only connects them.
function MainApp({ session }: { session: Session }) {
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [activeTab, setActiveTab] = useState<TabKey>('discover');
  const [editingProfile, setEditingProfile] = useState(false);
  const [managingPositions, setManagingPositions] = useState(false);
  // Which Interests sub-tab to open on; the nonce remounts the screen to apply it.
  const [interestsView, setInterestsView] = useState<{ sub: 'sent' | 'received'; nonce: number }>({
    sub: 'received',
    nonce: 0,
  });

  const { myProfile, fetchMyProfile } = useMyProfile(session, true);

  // The hooks below depend on each other's refetchers; the callbacks are only
  // invoked later (never during render), so referencing later consts is safe.
  const interests = useInterests(
    session,
    true,
    {
      onAccepted: () => matches.fetchMatches(),
      onWithdrawn: () => discover.fetchDiscoverCards(),
    },
    !!myProfile?.is_recruiter
  );
  const matches = useMatches(session, true, () => interests.fetchInterests());
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

  // Tells you (once) when someone declines an interest you sent, and why.
  useDeclineNotices({
    sentInterests: interests.sentInterests,
    loaded: interests.interestsLoaded,
    userId: session.user.id,
    onView: () => {
      matches.setSelectedMatch(null);
      setInterestsView((v) => ({ sub: 'sent', nonce: v.nonce + 1 }));
      setActiveTab('interests');
    },
  });

  // Reply timers: tracks everything waiting on your answer and alerts when a limit
  // is reached. Never closes or blocks anything.
  const timers = useResponseTimers({
    receivedInterests: interests.receivedInterests,
    matches: matches.activeMatches,
    convoMeta: matches.convoMeta,
    openChatId: activeTab === 'messages' ? matches.selectedMatch?.id ?? null : null,
    refresh: () => {
      interests.fetchInterests({ silent: true });
      matches.fetchMatches({ silent: true });
    },
    onOpenInterests: () => {
      matches.setSelectedMatch(null);
      setInterestsView((v) => ({ sub: 'received', nonce: v.nonce + 1 }));
      setActiveTab('interests');
    },
    onOpenChat: (matchId) => {
      const match = matches.matches.find((m) => m.id === matchId);
      if (!match) return;
      setActiveTab('messages');
      matches.setSelectedMatch(match);
    },
  });

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

  if (myProfile === null) {
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
            key={interestsView.nonce}
            initialSubTab={interestsView.sub}
            sentInterests={interests.visibleSentInterests}
            receivedInterests={interests.receivedInterests}
            onReceivedPress={interests.handleReceivedPress}
            onWithdraw={interests.withdrawInterest}
            onRemoveDeclined={interests.removeDeclinedInterest}
            onRefresh={() => Promise.all([interests.fetchInterests(), matches.fetchMatches()])}
            interestsRemaining={interests.interestsRemaining}
          />
        )}
        {activeTab === 'messages' && (
          matches.selectedMatch ? (
            <ChatScreen
              match={matches.selectedMatch}
              userId={session.user.id}
              onClose={() => matches.requestClose(matches.selectedMatch)}
              onBack={() => {
                matches.setSelectedMatch(null);
                matches.fetchMatches();
              }}
            />
          ) : (
            <MessagesScreen
              active={matches.activeMatches}
              archived={matches.archivedMatches}
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
          overdueMessagesCount={timers.overdueChatCount}
        />
      )}

      <DeclineModal
        visible={!!interests.decliningInterest}
        name={interests.decliningInterest?.from_profile?.name ?? 'This person'}
        reasons={reasonsFor(interests.declineAsRecruiter)}
        onCancel={interests.cancelDecline}
        onSubmit={interests.declineInterest}
      />

      <CloseChatModal
        visible={!!matches.closingMatch}
        name={matches.closingMatch?.name ?? 'This person'}
        reasons={closeReasonsFor(!!myProfile?.is_recruiter)}
        onCancel={matches.cancelClose}
        onSubmit={matches.closeChat}
      />

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
