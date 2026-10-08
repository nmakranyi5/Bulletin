import { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Check, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../lib/app-theme';
import { handleAuthUrl } from '../../lib/auth-links';
import { ConversationMeta, summarizeConversations } from '../../lib/chat';
import { supabase } from '../../lib/supabase';
import { TabBar, TabKey } from '../components/tab-bar';
import {
  MAX_INTERESTS,
  SWIPE_DISTANCE,
  SWIPE_THRESHOLD,
  SWIPE_VELOCITY,
  width,
} from '../constants/app';
import { AuthScreen } from '../features/auth/auth-screen';
import { ResetPasswordScreen } from '../features/auth/reset-password-screen';
import { DiscoverScreen } from '../features/discover/discover-screen';
import { PositionPickerModal } from '../features/discover/position-picker-modal';
import { InterestsScreen } from '../features/interests/interests-screen';
import { ChatScreen } from '../features/messages/chat-screen';
import { MessagesScreen } from '../features/messages/messages-screen';
import { OnboardingScreen } from '../features/profile/onboarding-screen';
import { PositionsScreen } from '../features/profile/positions-screen';
import { ProfileScreen } from '../features/profile/profile-screen';
import { useSharedStyles } from '../styles/shared';
import { InterestRow, Match } from '../types';

export default function Index() {
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [activeTab, setActiveTab] = useState<TabKey>('discover');
  const [sentInterests, setSentInterests] = useState<InterestRow[]>([]);
  const [receivedInterests, setReceivedInterests] = useState<InterestRow[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [convoMeta, setConvoMeta] = useState<Record<string, ConversationMeta>>({});
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const [discoverCards, setDiscoverCards] = useState<any[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [myPositions, setMyPositions] = useState<any[]>([]);
  const [pendingInterestTarget, setPendingInterestTarget] = useState<{
    card: any;
    positions: any[];
  } | null>(null);

  const translateX = useSharedValue(0);
  const cardOpacity = useSharedValue(1);

  const topCard = discoverCards[0];
  const unseenReceivedCount = receivedInterests.length;
  // Only pending sent interests hold a slot. Once one becomes a match it moves to
  // Messages and the slot is returned.
  const visibleSentInterests = sentInterests.filter((i) => i.status !== 'accepted');
  const activeSentCount = sentInterests.filter((i) => i.status === 'pending').length;
  const interestsRemaining = Math.max(0, MAX_INTERESTS - activeSentCount);
  const interestsRemainingSV = useSharedValue(interestsRemaining);

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [managingPositions, setManagingPositions] = useState(false);

  const [myProfile, setMyProfile] = useState<{
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
    is_recruiter: boolean;
    epa_608_types: string[] | null;
    trade_start_year: number | null;
  } | null>(null);

  /*
   * Whenever React switches to a new top card,
   * reset its animation state.
   */
  useEffect(() => {
    if (!topCard) return;

    translateX.value = 0;
    cardOpacity.value = 1;
  }, [topCard?.id]);

  useEffect(() => {
    interestsRemainingSV.value = interestsRemaining;
  }, [interestsRemaining]);

  const showOutOfInterests = () => {
    Alert.alert('Out of interests', 'You are out of interests.');
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Email links (confirm signup / reset password) open the app with tokens in the URL.
  useEffect(() => {
    const onUrl = async (url: string | null) => {
      const result = await handleAuthUrl(url, (type) => {
        if (type === 'recovery') setRecovering(true);
      });
      if (result.error) {
        setRecovering(false);
        Alert.alert('Link problem', result.error);
      }
    };

    Linking.getInitialURL().then(onUrl);
    const sub = Linking.addEventListener('url', ({ url }) => onUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!session) return;

    const ensureProfile = async () => {
      const { data: existing } = await supabase
        .from('profiles')
        .select('onboarded')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('profiles').insert({
          id: session.user.id,
          is_recruiter: session.user.user_metadata?.role === 'recruiter',
        });
        setOnboarded(false);
      } else {
        setOnboarded(existing.onboarded ?? false);
      }
    };

    ensureProfile();
  }, [session]);

  const fetchMyProfile = async () => {
    if (!session) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, username, avatar_url, is_recruiter, epa_608_types, trade_start_year')
      .eq('id', session.user.id)
      .single();

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setMyProfile(data);
  };

  useEffect(() => {
    if (session && onboarded) fetchMyProfile();
  }, [session, onboarded]);

  const fetchMyPositions = async () => {
    if (!session) return;

    const { data, error } = await supabase
      .from('positions')
      .select('id, title')
      .eq('recruiter_id', session.user.id)
      .eq('active', true);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setMyPositions(data ?? []);
  };

  const fetchDiscoverCards = async () => {
    if (!session || !myProfile) return;

    setDiscoverLoading(true);

    const { data: alreadyContacted } = await supabase
      .from('interests')
      .select('to_user')
      .eq('from_user', session.user.id);

    const excludeIds = (alreadyContacted ?? []).map((r) => r.to_user);
    excludeIds.push(session.user.id);

    if (myProfile.is_recruiter) {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, name, username, avatar_url, description, certifications, epa_608_types, trade_start_year, trade_role'
        )
        .eq('is_recruiter', false)
        .not('id', 'in', `(${excludeIds.join(',')})`);

      if (error) Alert.alert('Error', error.message);
      else setDiscoverCards(data ?? []);
    } else {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, name, username, avatar_url, positions:positions!recruiter_id(id, title, company, pay_range, location, work_style, experience_level, skills, description, active, epa_608_required, schedule_type, min_experience_years)'
        )
        .eq('is_recruiter', true)
        .not('id', 'in', `(${excludeIds.join(',')})`);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        const withOpenPositions = (data ?? [])
          .map((r: any) => ({
            ...r,
            positions: (r.positions ?? []).filter((p: any) => p.active),
          }))
          .filter((r: any) => r.positions.length > 0);
        setDiscoverCards(withOpenPositions);
      }
    }

    setDiscoverLoading(false);
  };

  useEffect(() => {
    if (myProfile) {
      fetchDiscoverCards();
      if (myProfile.is_recruiter) fetchMyPositions();
    }
  }, [myProfile?.is_recruiter]);

  const fetchInterests = async () => {
    if (!session) return;

    const { data: sent, error: sentError } = await supabase
      .from('interests')
      .select(
        '*, to_profile:profiles!to_user(id, name, username), position:positions(id, title, company)'
      )
      .eq('from_user', session.user.id);

    if (sentError) Alert.alert('Error', sentError.message);
    else setSentInterests(sent ?? []);

    const { data: received, error: receivedError } = await supabase
      .from('interests')
      .select(
        '*, from_profile:profiles!from_user(id, name, username, epa_608_types, trade_start_year), position:positions(id, title, company, epa_608_required, min_experience_years)'
      )
      .eq('to_user', session.user.id)
      .eq('status', 'pending');

    if (receivedError) Alert.alert('Error', receivedError.message);
    else setReceivedInterests(received ?? []);
  };

  const fetchConversationMeta = async (matchIds: string[]) => {
    if (!session || matchIds.length === 0) {
      setConvoMeta({});
      return;
    }

    const { data, error } = await supabase
      .from('messages')
      .select('interest_id, sender_id, body, created_at, read_at')
      .in('interest_id', matchIds)
      .order('created_at', { ascending: false })
      .limit(500);

    if (!error) setConvoMeta(summarizeConversations(data ?? [], session.user.id));
  };

  const fetchMatches = async () => {
    if (!session) return;

    const me = session.user.id;
    const { data, error } = await supabase
      .from('interests')
      .select(
        'id, from_user, to_user, from_profile:profiles!from_user(id, name, username), to_profile:profiles!to_user(id, name, username), position:positions(id, title, company)'
      )
      .eq('status', 'accepted')
      .or(`from_user.eq.${me},to_user.eq.${me}`);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    fetchConversationMeta((data ?? []).map((row: any) => row.id));

    setMatches(
      (data ?? []).map((row: any) => {
        const other = row.from_user === me ? row.to_profile : row.from_profile;
        return {
          id: row.id,
          otherUserId: other?.id ?? '',
          name: other?.name ?? other?.username ?? 'Unknown',
          position: row.position?.title ?? 'General',
          company: row.position?.company ?? '',
        };
      })
    );
  };

  useEffect(() => {
    if (session && onboarded) {
      fetchInterests();
      fetchMatches();
    }
  }, [session, onboarded]);

  const sendInterest = async (toUserId: string, positionId: string | null) => {
    if (!session) return;

    const { error } = await supabase.from('interests').insert({
      from_user: session.user.id,
      to_user: toUserId,
      position_id: positionId,
    });

    if (error && error.code !== '23505') {
      // 23505 = unique violation (already sent) — safe to ignore silently
      Alert.alert('Error', error.message);
    } else {
      fetchInterests();
    }
  };

  const handlePositionSubmit = (selectedIds: string[]) => {
    if (!pendingInterestTarget) return;

    const ids = selectedIds.slice(0, interestsRemaining);
    if (ids.length < selectedIds.length) {
      Alert.alert(
        'Interest limit',
        `You only had room for ${ids.length} more, so the rest weren't sent.`
      );
    }

    if (selectedIds.length === 0) {
      sendInterest(pendingInterestTarget.card.id, null);
    } else {
      ids.forEach((id) => sendInterest(pendingInterestTarget.card.id, id));
    }

    setPendingInterestTarget(null);
  };

  /*
   * JS-side state update.
   * This is only called through runOnJS from gesture animations.
   */
  const removeTopCard = (interested: number) => {
    const swipedCard = discoverCards[0];

    setDiscoverCards((prev) => prev.slice(1));

    if (interested > 0 && swipedCard) {
      const relevantPositions = myProfile?.is_recruiter
        ? myPositions
        : swipedCard.positions ?? [];

      if (relevantPositions.length === 0) {
        sendInterest(swipedCard.id, null);
      } else {
        setPendingInterestTarget({ card: swipedCard, positions: relevantPositions });
      }
    }
  };

  /*
   * Used by the physical X / Check buttons.
   * This starts from JS, so calling this function directly is safe.
   */
  const buttonSwipe = (direction: number) => {
    if (direction > 0 && interestsRemaining <= 0) {
      translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
      showOutOfInterests();
      return;
    }

    translateX.value = withTiming(
      direction * SWIPE_DISTANCE,
      { duration: 150 },
      (finished) => {
        if (!finished) return;

        cardOpacity.value = 0;
        runOnJS(removeTopCard)(direction);
      }
    );
  };

  /*
   * Gesture callbacks run as Reanimated worklets on native.
   * Keep all animation logic directly inside them.
   */
  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      const shouldSwipe =
        Math.abs(event.translationX) > SWIPE_THRESHOLD ||
        Math.abs(event.velocityX) > SWIPE_VELOCITY;

      if (shouldSwipe) {
        const direction =
          Math.abs(event.velocityX) > SWIPE_VELOCITY
            ? Math.sign(event.velocityX)
            : Math.sign(event.translationX);

        const resolvedDirection = direction || 1;

        if (resolvedDirection > 0 && interestsRemainingSV.value <= 0) {
          translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
          runOnJS(showOutOfInterests)();
          return;
        }

        translateX.value = withTiming(
          resolvedDirection * SWIPE_DISTANCE,
          { duration: 150 },
          (finished) => {
            if (!finished) return;

            cardOpacity.value = 0;
            runOnJS(removeTopCard)(resolvedDirection);
          }
        );

        return;
      }

      translateX.value = withSpring(0, {
        damping: 18,
        stiffness: 180,
      });
  });

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      {
        translateX: translateX.value,
      },
      {
        rotate: `${interpolate(
          translateX.value,
          [-width / 2, 0, width / 2],
          [-7, 0, 7]
        )}deg`,
      },
    ],
  }));

  const passStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      'clamp'
    ),
  }));

  const interestedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      'clamp'
    ),
  }));

  const respondToInterest = async (interestId: string, status: 'accepted' | 'rejected') => {
    const { error } = await supabase
      .from('interests')
      .update({ status })
      .eq('id', interestId);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setReceivedInterests((prev) => prev.filter((r) => r.id !== interestId));

    if (status === 'accepted') {
      fetchMatches();
      fetchInterests();
    }
  };

  const withdrawInterest = (interest: InterestRow) => {
    Alert.alert(
      'Remove interest?',
      `This takes back your interest in ${interest.to_profile?.name ?? 'this person'} and gives you the slot back.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { data, error } = await supabase
              .from('interests')
              .delete()
              .eq('id', interest.id)
              .eq('status', 'pending')
              .select('id');

            if (error) {
              Alert.alert('Error', error.message);
              return;
            }
            if (!data || data.length === 0) {
              Alert.alert('Could not remove', 'This interest was already answered.');
            }

            fetchInterests();
            fetchDiscoverCards();
          },
        },
      ]
    );
  };

  const closeMatch = (match: Match) => {
    Alert.alert(
      'Close chat?',
      `This ends your conversation with ${match.name} for both of you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close chat',
          style: 'destructive',
          onPress: async () => {
            const { data, error } = await supabase
              .from('interests')
              .update({ status: 'closed' })
              .eq('id', match.id)
              .eq('status', 'accepted')
              .select('id');

            if (error) {
              Alert.alert('Error', error.message);
              return;
            }
            if (!data || data.length === 0) {
              Alert.alert('Could not close', 'Something went wrong closing this chat.');
              return;
            }

            setSelectedMatch(null);
            fetchMatches();
            fetchInterests();
          },
        },
      ]
    );
  };

  const handleReceivedPress = (interest: InterestRow) => {
    const name = interest.from_profile?.name ?? 'Someone';
    const positionText = interest.position?.title
      ? ` about ${interest.position.title}`
      : '';

    Alert.alert(
      name,
      `${name} is interested in connecting${positionText}.`,
      [
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => respondToInterest(interest.id, 'rejected'),
        },
        {
          text: 'Accept',
          style: 'default',
          onPress: () => respondToInterest(interest.id, 'accepted'),
        },
      ]
    );
  };

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
      <SafeAreaView style={local.container}>
        {activeTab === 'discover' && (
          <DiscoverScreen
            cards={discoverCards}
            topCard={topCard}
            cardStyle={cardStyle}
            passStyle={passStyle}
            interestedStyle={interestedStyle}
            gesture={gesture}
            buttonSwipe={buttonSwipe}
            onRefresh={fetchDiscoverCards}
            interestsRemaining={interestsRemaining}
            isRecruiter={!!myProfile?.is_recruiter}
            me={myProfile}
            loading={discoverLoading}
          />
        )}

        {activeTab === 'interests' && (
          <InterestsScreen
            sentInterests={visibleSentInterests}
            receivedInterests={receivedInterests}
            onReceivedPress={handleReceivedPress}
            onWithdraw={withdrawInterest}
            interestsRemaining={interestsRemaining}
          />
        )}
        {activeTab === 'messages' && (
          selectedMatch ? (
            <ChatScreen
              match={selectedMatch}
              userId={session.user.id}
              onClose={() => closeMatch(selectedMatch)}
              onBack={() => {
                setSelectedMatch(null);
                fetchMatches();
              }}
            />
          ) : (
            <MessagesScreen
              matches={matches}
              meta={convoMeta}
              onMatchPress={setSelectedMatch}
              onRefresh={fetchMatches}
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
      {!selectedMatch && (
        <TabBar activeTab={activeTab} onTabPress={setActiveTab} unseenReceivedCount={unseenReceivedCount} />
      )}

      <PositionPickerModal
        visible={!!pendingInterestTarget}
        positions={pendingInterestTarget?.positions ?? []}
        onSubmit={handlePositionSubmit}
        onCancel={() => setPendingInterestTarget(null)}
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
