import { Session } from '@supabase/supabase-js';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../lib/app-theme';
import { tourSteps } from '../../lib/tutorial';
import { MAX_INTERESTS } from '../constants/app';
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
import { InterestRow } from '../types';
import { InterestsScreen } from '../features/interests/interests-screen';
import { useClosedPositionNotices } from '../features/interests/use-closed-position-notices';
import { useDeclineNotices } from '../features/interests/use-decline-notices';
import { useInterests } from '../features/interests/use-interests';
import { ChatScreen } from '../features/messages/chat-screen';
import { CloseChatModal } from '../features/messages/close-chat-modal';
import { MessagesScreen } from '../features/messages/messages-screen';
import { useMatches } from '../features/messages/use-matches';
import { useReplyWindowNotices } from '../features/messages/use-reply-window-notices';
import { ProfileDetailModal } from '../features/profile/profile-detail-modal';
import { OnboardingScreen } from '../features/profile/onboarding-screen';
import { PositionsScreen } from '../features/profile/positions-screen';
import { ReviewVerificationsScreen } from '../features/profile/review-verifications-screen';
import { VerificationScreen } from '../features/profile/verification-screen';
import { ProfileScreen } from '../features/profile/profile-screen';
import { usePositionReminders } from '../features/profile/use-position-reminders';
import { useMyProfile } from '../features/profile/use-my-profile';
import { TutorialOverlay } from '../features/tutorial/tutorial-overlay';
import { markTutorialOffer, useTutorial } from '../features/tutorial/use-tutorial';
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
        onComplete={async () => {
          // New accounts get offered the tour once, when they land in the app.
          await markTutorialOffer(session.user.id);
          setOnboarded(true);
        }}
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
  const [verifying, setVerifying] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  // Which sub-tab each screen is on. They live here (not in the screens) so switching to
  // another tab and back puts you where you were.
  const [interestsSub, setInterestsSub] = useState<'sent' | 'received'>('received');
  const [messagesView, setMessagesView] = useState<'active' | 'archived'>('active');

  // The first-run tour: offered once to new accounts, replayable from Profile > Settings.
  const tutorial = useTutorial(session.user.id);

  // Whose full card is open (from Interests or Messages). A received interest also
  // carries Accept / Decline.
  const [profileView, setProfileView] = useState<{
    userId: string;
    positionId?: string | null;
    received?: InterestRow;
  } | null>(null);

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
  const matches = useMatches(
    session,
    true,
    () => interests.fetchInterests(),
    !!myProfile?.is_recruiter
  );
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
      setInterestsSub('sent');
      setActiveTab('interests');
    },
  });

  // Tells you (once) when a position you were waiting on closes and your interest is returned.
  useClosedPositionNotices({
    sentInterests: interests.sentInterests,
    loaded: interests.interestsLoaded,
    userId: session.user.id,
  });

  // Tells you when someone asks to change a chat's reply time, and how your own requests turned out.
  useReplyWindowNotices({
    requests: matches.replyRequests,
    matches: matches.matches,
    loaded: matches.matchesLoaded,
    userId: session.user.id,
    onOpenChat: (matchId) => {
      const match = matches.matches.find((m) => m.id === matchId);
      if (!match) return;
      setActiveTab('messages');
      matches.setSelectedMatch(match);
    },
  });

  // Reminds recruiters to extend or confirm a position as its close date approaches.
  usePositionReminders({
    session,
    enabled: !!myProfile?.is_recruiter,
    onOpenPositions: () => setManagingPositions(true),
  });

  // Reply timers: tracks everything waiting on your answer and alerts when a limit
  // is reached. Never closes or blocks anything.
  useResponseTimers({
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
      setInterestsSub('received');
      setActiveTab('interests');
    },
    onOpenChat: (matchId) => {
      const match = matches.matches.find((m) => m.id === matchId);
      if (!match) return;
      setActiveTab('messages');
      matches.setSelectedMatch(match);
    },
  });

  const tutorSteps = tourSteps(!!myProfile?.is_recruiter, MAX_INTERESTS);

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

  if (verifying) {
    return (
      <View style={local.root}>
        <VerificationScreen
          session={session}
          isRecruiter={!!myProfile?.is_recruiter}
          onBack={() => setVerifying(false)}
        />
      </View>
    );
  }

  if (reviewing) {
    return (
      <View style={local.root}>
        <ReviewVerificationsScreen onBack={() => setReviewing(false)} />
      </View>
    );
  }

  if (managingPositions) {
    return (
      <View style={local.root}>
        <PositionsScreen session={session} onBack={() => setManagingPositions(false)} />
      </View>
    );
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
            subTab={interestsSub}
            onSubTabChange={setInterestsSub}
            sentInterests={interests.visibleSentInterests}
            receivedInterests={interests.receivedInterests}
            onViewProfile={(interest, direction) =>
              direction === 'received'
                ? setProfileView({
                    userId: interest.from_user,
                    positionId: interest.position?.id ?? interest.position_id,
                    received: interest,
                  })
                : setProfileView({
                    userId: interest.to_user,
                    positionId: interest.position?.id ?? interest.position_id,
                  })
            }
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
              onDelete={() => matches.deleteArchived(matches.selectedMatch!)}
              onViewProfile={() =>
                setProfileView({
                  userId: matches.selectedMatch!.otherUserId,
                  positionId: matches.selectedMatch!.positionId,
                })
              }
              replyRequest={matches.replyRequests.find(
                (r) => r.interestId === matches.selectedMatch!.id && r.status === 'pending'
              )}
              onRequestWindow={(hours) =>
                matches.requestReplyWindow(matches.selectedMatch!, hours)
              }
              onRespondWindow={(accept) => {
                const req = matches.replyRequests.find(
                  (r) => r.interestId === matches.selectedMatch!.id && r.status === 'pending'
                );
                if (req) matches.respondReplyWindow(req, accept);
              }}
              onBack={() => {
                matches.setSelectedMatch(null);
                matches.fetchMatches();
              }}
            />
          ) : (
            <MessagesScreen
              view={messagesView}
              onViewChange={setMessagesView}
              active={matches.activeMatches}
              archived={matches.archivedMatches}
              meta={matches.convoMeta}
              onMatchPress={matches.setSelectedMatch}
              onViewProfile={(m) =>
                setProfileView({ userId: m.otherUserId, positionId: m.positionId })
              }
              onRefresh={matches.fetchMatches}
            />
          )
        )}
        {activeTab === 'profile' && (
          <ProfileScreen
            session={session}
            onEditProfile={() => setEditingProfile(true)}
            onManagePositions={() => setManagingPositions(true)}
            onVerification={() => setVerifying(true)}
            onReviewVerifications={() => setReviewing(true)}
            onReplayTutorial={() => {
              matches.setSelectedMatch(null);
              setActiveTab('discover');
              tutorial.start();
            }}
          />
        )}
      </SafeAreaView>
      {!matches.selectedMatch && (
        <TabBar
          activeTab={activeTab}
          onTabPress={setActiveTab}
          unseenReceivedCount={interests.unseenReceivedCount}
          unreadMessagesCount={matches.unreadTotal}
        />
      )}

      <TutorialOverlay
        stage={tutorial.stage}
        steps={tutorSteps}
        step={tutorial.step}
        onStart={tutorial.start}
        onStep={(i) => {
          tutorial.setStep(i);
          const tab = tutorSteps[i]?.tab;
          if (tab) {
            matches.setSelectedMatch(null);
            setActiveTab(tab);
          }
        }}
        onClose={() => {
          tutorial.close();
          setActiveTab('discover');
        }}
      />

      <ProfileDetailModal
        userId={profileView?.userId ?? null}
        positionId={profileView?.positionId}
        me={myProfile}
        onClose={() => setProfileView(null)}
        footer={
          profileView?.received ? (
            <>
              <Pressable
                style={[local.footerButton, local.declineButton]}
                onPress={() => {
                  const interest = profileView.received!;
                  setProfileView(null);
                  interests.requestDecline(interest);
                }}
              >
                <Text style={local.declineText}>Decline</Text>
              </Pressable>
              <Pressable
                style={[local.footerButton, local.acceptButton]}
                onPress={() => {
                  const interest = profileView.received!;
                  setProfileView(null);
                  interests.acceptInterest(interest.id);
                }}
              >
                <Text style={local.acceptText}>Accept</Text>
              </Pressable>
            </>
          ) : null
        }
      />

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

        footerButton: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 14,
          alignItems: 'center',
        },

        declineButton: {
          borderWidth: 1,
          borderColor: c.danger,
        },

        declineText: {
          fontSize: 15,
          fontWeight: '700',
          color: c.danger,
        },

        acceptButton: {
          backgroundColor: c.accent,
        },

        acceptText: {
          fontSize: 15,
          fontWeight: '700',
          color: c.onAccent,
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
