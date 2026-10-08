import { Session } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  ChevronRight,
  Handshake,
  MapPin,
  MessageCircle,
  Pencil,
  Search,
  Send,
  Settings,
  UserRound,
  X
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authRedirectUrl, handleAuthUrl } from '../../lib/auth-links';
import {
  EPA_TYPES,
  SCHEDULE_TYPES,
  TRADE_ROLES,
  epaMismatchNote,
  experienceMismatchNote,
  formatTradeStart,
  formatWorkerEpa,
  isUniversal,
  parseMinYears,
  parseYear,
} from '../../lib/hvac';
import {
  ConversationMeta,
  MessageStatus,
  formatDayLabel,
  formatListTime,
  formatTime,
  isSameDay,
  summarizeConversations,
} from '../../lib/chat';
import { Colors, useTheme } from '../../lib/app-theme';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

const CARD_WIDTH = width - 36;
const SWIPE_THRESHOLD = width * 0.28;
const SWIPE_DISTANCE = width * 1.4;
const SWIPE_VELOCITY = 400;
const MAX_INTERESTS = 10;

type InterestRow = {
  id: string;
  from_user: string;
  to_user: string;
  status: string;
  position_id: string | null;
  from_profile?: {
    id: string;
    name: string;
    username: string;
    epa_608_types?: string[] | null;
    trade_start_year?: number | null;
  };
  to_profile?: { id: string; name: string; username: string };
  position?: {
    id: string;
    title: string;
    company: string;
    epa_608_required?: string | null;
    min_experience_years?: number | null;
  } | null;
};

type TabKey = 'discover' | 'interests' | 'messages' | 'profile';

type ChatMessage = {
  id: string;
  text: string;
  fromMe: boolean;
  createdAt: string;
  readAt: string | null;
  status: MessageStatus;
};

type ChatItem =
  | { type: 'day'; key: string; label: string }
  | { type: 'msg'; key: string; msg: ChatMessage; groupStart: boolean; showStatus: boolean };

// A match is an accepted interest; `id` is the interest id.
type Match = {
  id: string;
  otherUserId: string;
  name: string;
  position: string;
  company: string;
};

const TABS: { key: TabKey; label: string; Icon: typeof Search }[] = [
  { key: 'discover', label: 'Discover', Icon: Search },
  { key: 'interests', label: 'Interests', Icon: Handshake },
  { key: 'messages', label: 'Messages', Icon: MessageCircle },
  { key: 'profile', label: 'Profile', Icon: UserRound },
];

export default function Index() {
  const styles = useStyles();
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
      <View style={styles.authLoadingContainer}>
        <Text style={styles.subtitle}>Loading...</Text>
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
      <View style={styles.authLoadingContainer}>
        <Text style={styles.subtitle}>Loading...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.container}>
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

function PositionPickerModal({
  visible,
  positions,
  onSubmit,
  onCancel,
}: {
  visible: boolean;
  positions: { id: string; title: string }[];
  onSubmit: (selectedIds: string[]) => void;
  onCancel: () => void;
}) {
  const styles = useStyles();
  const c = useTheme().colors;
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (visible) setSelected([]);
  }, [visible]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.subtitle}>Which position(s)?</Text>

          <ScrollView style={{ maxHeight: 260, marginTop: 12 }}>
            {positions.map((p) => {
              const isChecked = selected.includes(p.id);
              return (
                <Pressable
                  key={p.id}
                  style={styles.checklistRow}
                  onPress={() => toggle(p.id)}
                >
                  <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                    {isChecked && <Check size={14} color={c.onAccent} strokeWidth={3} />}
                  </View>
                  <Text style={styles.checklistText}>{p.title}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable style={styles.authButton} onPress={() => onSubmit(selected)}>
            <Text style={styles.authButtonText}>
              {selected.length === 0 ? 'Send general interest' : 'Send interest'}
            </Text>
          </Pressable>

          <Pressable style={{ marginTop: 10, alignItems: 'center' }} onPress={onCancel}>
            <Text style={styles.subtitle}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function DiscoverScreen({
  cards,
  topCard,
  cardStyle,
  passStyle,
  interestedStyle,
  gesture,
  buttonSwipe,
  onRefresh,
  interestsRemaining,
  isRecruiter,
  me,
  loading,
}: {
  cards: any[];
  topCard: any | undefined;
  cardStyle: any;
  passStyle: any;
  interestedStyle: any;
  gesture: any;
  buttonSwipe: (direction: number) => void;
  onRefresh: () => void;
  interestsRemaining: number;
  isRecruiter: boolean;
  me: any;
  loading: boolean;
}) {
  const styles = useStyles();
  const c = useTheme().colors;
  return (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.logo}>bulletin.</Text>
            <Text style={styles.subtitle}>
              {isRecruiter ? 'Find your next hire.' : 'Find your next opportunity.'}
            </Text>
          </View>

          <View style={styles.interestCounter}>
            <Handshake size={14} color={c.text} strokeWidth={2.4} />
            <Text style={styles.interestCounterText}>{interestsRemaining}</Text>
          </View>
        </View>
      </View>

      {/* Deck */}
      <View style={styles.deck}>
        {topCard ? (
          <>
            {cards
              .slice(0, 3)
              .reverse()
              .map((card, index, visibleCards) => {
                const isTop = index === visibleCards.length - 1;

                /*
                 * Background cards are real cards, but completely static.
                 */
                if (!isTop) {
                  return (
                    <View
                      key={card.id}
                      pointerEvents="none"
                      style={styles.card}
                    >
                      {isRecruiter ? (
                        <WorkerCardContent candidate={card} />
                      ) : (
                        <RecruiterCardContent recruiter={card} me={me} />
                      )}
                    </View>
                  );
                }

                /*
                 * Only the top card participates in gestures/animation.
                 */
                return (
                  <GestureDetector key={card.id} gesture={gesture}>
                    <Animated.View style={[styles.card, cardStyle]}>
                      {/* Pass badge */}
                      <Animated.View
                        style={[
                          styles.swipeBadge,
                          styles.passBadge,
                          passStyle,
                        ]}
                      >
                        <Text style={styles.passText}>PASS</Text>
                      </Animated.View>

                      {/* Interested badge */}
                      <Animated.View
                        style={[
                          styles.swipeBadge,
                          styles.interestedBadge,
                          interestedStyle,
                        ]}
                      >
                        <Text style={styles.interestedText}>
                          INTERESTED
                        </Text>
                      </Animated.View>

                      {isRecruiter ? (
                        <WorkerCardContent candidate={card} />
                      ) : (
                        <RecruiterCardContent recruiter={card} me={me} />
                      )}
                    </Animated.View>
                  </GestureDetector>
                );
              })}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {loading ? 'Loading...' : "You're all caught up."}
            </Text>

            {!loading && (
              <Text style={styles.emptySubtitle}>
                {isRecruiter
                  ? 'No more candidates right now.'
                  : 'No more open positions right now.'}
              </Text>
            )}

            <Pressable
              style={styles.refreshButton}
              onPress={onRefresh}
            >
              <Text style={styles.refreshText}>
                Refresh
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Actions */}
      {topCard && (
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionButton, styles.passButton]}
            onPress={() => buttonSwipe(-1)}
          >
            <X
              size={28}
              color={c.danger}
              strokeWidth={2.6}
            />
          </Pressable>

          <Pressable
            style={[styles.actionButton, styles.interestedButton]}
            onPress={() => buttonSwipe(1)}
          >
            <Check
              size={30}
              color={c.white}
              strokeWidth={2.7}
            />
          </Pressable>
        </View>
      )}
    </>
  );
}

function InterestsScreen({
  sentInterests,
  receivedInterests,
  onReceivedPress,
  onWithdraw,
  interestsRemaining,
}: {
  sentInterests: InterestRow[];
  receivedInterests: InterestRow[];
  onReceivedPress: (interest: InterestRow) => void;
  onWithdraw: (interest: InterestRow) => void;
  interestsRemaining: number;
}) {
  const styles = useStyles();
  const c = useTheme().colors;
  const [subTab, setSubTab] = useState<'sent' | 'received'>('received');

  return (
    <View style={styles.simpleScreen}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>bulletin.</Text>
        <Text style={styles.subtitle}>
          Explore your interests. {interestsRemaining} of {MAX_INTERESTS} left.
        </Text>
      </View>

      <View style={styles.subTabBar}>
        <Pressable
          style={[styles.subTabItem, subTab === 'received' && styles.subTabItemActive]}
          onPress={() => setSubTab('received')}
        >
          <Text
            style={[styles.subTabText, subTab === 'received' && styles.subTabTextActive]}
          >
            Received ({receivedInterests.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.subTabItem, subTab === 'sent' && styles.subTabItemActive]}
          onPress={() => setSubTab('sent')}
        >
          <Text
            style={[styles.subTabText, subTab === 'sent' && styles.subTabTextActive]}
          >
            Sent ({sentInterests.length})
          </Text>
        </Pressable>
      </View>

      {subTab === 'received' ? (
        receivedInterests.length === 0 ? (
          <View style={styles.emptyState}>
            <Handshake size={48} color={c.muted} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No interests yet</Text>
            <Text style={styles.emptySubtitle}>
              People who show interest in you will show up here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={receivedInterests}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.interestsList}
            renderItem={({ item }) => (
              <Pressable style={styles.interestRow} onPress={() => onReceivedPress(item)}>
                <UserRound size={40} color={c.muted} strokeWidth={1.5} />
                <View style={styles.interestRowInfo}>
                  <Text numberOfLines={1} style={styles.interestRowName}>
                    {item.from_profile?.name ?? 'Unknown'}
                  </Text>
                  <Text numberOfLines={1} style={styles.interestRowMeta}>
                    @{item.from_profile?.username ?? 'unknown'}
                    {item.position?.title ? ` · ${item.position.title}` : ' · General'}
                  </Text>
                  {(() => {
                    const notes = [
                      epaMismatchNote(
                        item.position?.epa_608_required,
                        item.from_profile?.epa_608_types
                      ),
                      experienceMismatchNote(
                        item.position?.min_experience_years,
                        item.from_profile?.trade_start_year
                      ),
                    ].filter(Boolean);
                    return notes.length > 0 ? (
                      <Text numberOfLines={1} style={styles.mismatchText}>
                        Heads up: {notes.join(' · ')}
                      </Text>
                    ) : null;
                  })()}
                </View>
              </Pressable>
            )}
          />
        )
      ) : sentInterests.length === 0 ? (
        <View style={styles.emptyState}>
          <Handshake size={48} color={c.muted} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No interests yet</Text>
          <Text style={styles.emptySubtitle}>
            Swipe right on Discover to start expressing interest.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sentInterests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.interestsList}
          renderItem={({ item }) => (
            <View style={styles.interestRow}>
              <UserRound size={40} color={c.muted} strokeWidth={1.5} />
              <View style={styles.interestRowInfo}>
                <Text numberOfLines={1} style={styles.interestRowName}>
                  {item.to_profile?.name ?? 'Unknown'}
                </Text>
                <Text numberOfLines={1} style={styles.interestRowMeta}>
                  {item.status === 'pending'
                    ? 'Pending'
                    : item.status === 'accepted'
                    ? 'Matched'
                    : item.status === 'closed'
                    ? 'Chat closed'
                    : 'Not interested'}
                  {item.position?.title ? ` · ${item.position.title}` : ' · General'}
                </Text>
              </View>
              {item.status === 'pending' && (
                <Pressable
                  hitSlop={10}
                  style={styles.interestRowAction}
                  onPress={() => onWithdraw(item)}
                >
                  <X size={18} color={c.textSecondary} strokeWidth={2.2} />
                </Pressable>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

function MessagesScreen({
  matches,
  meta,
  onMatchPress,
  onRefresh,
}: {
  matches: Match[];
  meta: Record<string, ConversationMeta>;
  onMatchPress: (match: Match) => void;
  onRefresh: () => void;
}) {
  const styles = useStyles();
  const c = useTheme().colors;
  useEffect(() => {
    onRefresh();

    // Keep previews and unread counts live while the list is open.
    const channel = supabase
      .channel('messages-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () =>
        onRefresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Conversations with messages first (newest on top), then new matches.
  const sorted = [...matches].sort((a, b) => {
    const at = meta[a.id]?.lastAt ?? '';
    const bt = meta[b.id]?.lastAt ?? '';
    return at < bt ? 1 : at > bt ? -1 : 0;
  });

  return (
    <View style={styles.simpleScreen}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>bulletin.</Text>
        <Text style={styles.subtitle}>Real conversations. No BS.</Text>
      </View>

      {matches.length === 0 ? (
        <View style={styles.emptyState}>
          <MessageCircle size={48} color={c.muted} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No messages yet.</Text>
          <Text style={styles.emptySubtitle}>
            Once you match with someone, your conversation shows up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.interestsList}
          renderItem={({ item }) => {
            const m = meta[item.id];
            const unread = m?.unread ?? 0;
            return (
              <Pressable style={styles.interestRow} onPress={() => onMatchPress(item)}>
                <UserRound size={40} color={c.muted} strokeWidth={1.5} />

                <View style={styles.interestRowInfo}>
                  <View style={styles.convoTopRow}>
                    <Text
                      numberOfLines={1}
                      style={[styles.interestRowName, styles.convoName]}
                    >
                      {item.name}
                    </Text>
                    {m && (
                      <Text style={[styles.convoTime, unread > 0 && styles.convoTimeUnread]}>
                        {formatListTime(m.lastAt)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.convoBottomRow}>
                    {m?.lastFromMe &&
                      (m.lastRead ? (
                        <CheckCheck size={14} color={c.blue} strokeWidth={2.4} />
                      ) : (
                        <Check size={14} color={c.muted} strokeWidth={2.4} />
                      ))}
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.interestRowMeta,
                        styles.convoPreview,
                        unread > 0 && styles.convoPreviewUnread,
                      ]}
                    >
                      {m
                        ? `${m.lastFromMe ? 'You: ' : ''}${m.lastText}`
                        : item.company
                        ? `${item.position} · ${item.company}`
                        : item.position}
                    </Text>
                    {unread > 0 && (
                      <View style={styles.unreadPill}>
                        <Text style={styles.unreadPillText}>{unread > 99 ? '99+' : unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function ChatScreen({
  match,
  userId,
  onClose,
  onBack,
}: {
  match: Match;
  userId: string;
  onClose: () => void;
  onBack: () => void;
}) {
  const styles = useStyles();
  const c = useTheme().colors;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<ChatItem>>(null);

  const markRead = () => {
    supabase.rpc('mark_messages_read', { p_interest_id: match.id }).then(() => {});
  };

  useEffect(() => {
    let active = true;
    const toChat = (row: any): ChatMessage => ({
      id: row.id,
      text: row.body,
      fromMe: row.sender_id === userId,
      createdAt: row.created_at,
      readAt: row.read_at ?? null,
      status: row.read_at ? 'read' : 'sent',
    });
    const upsert = (msg: ChatMessage) =>
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id)
          ? prev.map((m) => (m.id === msg.id ? msg : m))
          : [...prev, msg]
      );

    supabase
      .from('messages')
      .select('id, sender_id, body, created_at, read_at')
      .eq('interest_id', match.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          Alert.alert('Error', error.message);
          return;
        }
        setMessages((prev) => [
          ...(data ?? []).map(toChat),
          ...prev.filter((m) => m.status === 'sending' || m.status === 'failed'),
        ]);
        markRead();
      });

    const channel = supabase
      .channel(`messages:${match.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `interest_id=eq.${match.id}`,
        },
        (payload) => {
          const msg = toChat(payload.new);
          upsert(msg);
          // The chat is open, so anything from them is read immediately.
          if (!msg.fromMe) markRead();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `interest_id=eq.${match.id}`,
        },
        (payload) => upsert(toChat(payload.new))
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [match.id, userId]);

  const sendBody = async (body: string, tempId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .insert({ interest_id: match.id, sender_id: userId, body })
      .select('id, sender_id, body, created_at, read_at')
      .single();

    if (error) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' as const } : m))
      );
      return;
    }

    setMessages((prev) => {
      const real: ChatMessage = {
        id: data.id,
        text: data.body,
        fromMe: true,
        createdAt: data.created_at,
        readAt: data.read_at ?? null,
        status: data.read_at ? 'read' : 'sent',
      };
      // Realtime may have already delivered the real row.
      return prev.some((m) => m.id === data.id)
        ? prev.filter((m) => m.id !== tempId)
        : prev.map((m) => (m.id === tempId ? real : m));
    });
  };

  const handleSend = () => {
    const body = draft.trim();
    if (!body) return;

    const tempId = `tmp-${Date.now()}`;
    setDraft('');
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        text: body,
        fromMe: true,
        createdAt: new Date().toISOString(),
        readAt: null,
        status: 'sending',
      },
    ]);
    sendBody(body, tempId);
  };

  const retry = (msg: ChatMessage) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, status: 'sending' as const } : m))
    );
    sendBody(msg.text, msg.id);
  };

  // Flatten into day separators + grouped bubbles; the status line sits under my latest message.
  const lastMineId = [...messages].reverse().find((m) => m.fromMe)?.id;
  const items: ChatItem[] = [];
  messages.forEach((msg, idx) => {
    const prev = messages[idx - 1];
    if (!prev || !isSameDay(prev.createdAt, msg.createdAt)) {
      items.push({ type: 'day', key: `day-${msg.id}`, label: formatDayLabel(msg.createdAt) });
    }
    const groupStart =
      !prev ||
      prev.fromMe !== msg.fromMe ||
      !isSameDay(prev.createdAt, msg.createdAt) ||
      new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;
    items.push({
      type: 'msg',
      key: msg.id,
      msg,
      groupStart,
      showStatus: msg.id === lastMineId,
    });
  });

  const statusLabel = (m: ChatMessage) =>
    m.status === 'sending'
      ? 'Sending...'
      : m.status === 'failed'
      ? 'Not sent. Tap to retry'
      : m.status === 'read' && m.readAt
      ? `Read ${formatTime(m.readAt)}`
      : 'Sent';

  return (
    <KeyboardAvoidingView
      style={styles.chatContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.chatHeader}>
        <Pressable onPress={onBack} style={styles.chatBackButton}>
          <ArrowLeft size={22} color={c.text} strokeWidth={2.2} />
        </Pressable>

        <View style={styles.chatHeaderAvatar}>
          <UserRound size={22} color={c.textSecondary} strokeWidth={1.8} />
        </View>

        <View style={styles.chatHeaderInfo}>
          <Text numberOfLines={1} style={styles.chatHeaderName}>
            {match.name}
          </Text>
          <Text numberOfLines={1} style={styles.chatHeaderMeta}>
            {match.company ? `${match.position} · ${match.company}` : match.position}
          </Text>
        </View>

        <Pressable onPress={onClose} hitSlop={10} style={styles.chatBackButton}>
          <X size={22} color={c.textSecondary} strokeWidth={2.2} />
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        data={items}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.chatMessages}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          if (item.type === 'day') {
            return (
              <View style={styles.chatDayWrap}>
                <Text style={styles.chatDayText}>{item.label}</Text>
              </View>
            );
          }

          const { msg, groupStart, showStatus } = item;
          return (
            <View style={[styles.chatRow, groupStart && styles.chatRowGroupStart]}>
              <Pressable
                disabled={msg.status !== 'failed'}
                onPress={() => retry(msg)}
                style={[
                  styles.chatBubble,
                  msg.fromMe ? styles.chatBubbleMine : styles.chatBubbleTheirs,
                  msg.status === 'sending' && { opacity: 0.6 },
                  msg.status === 'failed' && styles.chatBubbleFailed,
                ]}
              >
                <Text style={[styles.chatBubbleText, msg.fromMe && styles.chatBubbleTextMine]}>
                  {msg.text}
                </Text>
                <View style={styles.chatMetaRow}>
                  <Text style={[styles.chatTime, msg.fromMe && styles.chatTimeMine]}>
                    {formatTime(msg.createdAt)}
                  </Text>
                  {msg.fromMe &&
                    (msg.status === 'read' ? (
                      <CheckCheck size={14} color={c.blueLight} strokeWidth={2.4} />
                    ) : msg.status === 'sent' ? (
                      <Check size={14} color={c.muted} strokeWidth={2.4} />
                    ) : null)}
                </View>
              </Pressable>

              {msg.fromMe && (showStatus || msg.status === 'failed') && (
                <Text
                  style={[styles.chatStatus, msg.status === 'failed' && styles.chatStatusFailed]}
                >
                  {statusLabel(msg)}
                </Text>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.chatEmptyText}>
            Say hello to {match.name.split(' ')[0]}.
          </Text>
        }
      />

      <View style={styles.chatInputRow}>
        <TextInput
          style={styles.chatInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message..."
          placeholderTextColor={c.muted}
          multiline
        />

        <Pressable
          style={[styles.chatSendButton, !draft.trim() && styles.chatSendButtonDisabled]}
          onPress={handleSend}
          disabled={!draft.trim()}
        >
          <Send size={18} color={c.onAccent} strokeWidth={2.4} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function ProfileScreen({
  session,
  onEditProfile,
  onManagePositions,
}: {
  session: Session;
  onEditProfile: () => void;
  onManagePositions: () => void;
}) {
  const styles = useStyles();
  const c = useTheme().colors;
  const [profile, setProfile] = useState<{
    name: string | null;
    username: string | null;
    avatar_url: string | null;
    is_recruiter: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const { mode, setMode } = useTheme();

  useEffect(() => {
    const loadProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, username, avatar_url, is_recruiter')
        .eq('id', session.user.id)
        .single();

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setProfile(data);
      }

      setLoading(false);
    };

    loadProfile();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View style={styles.simpleScreen}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>bulletin.</Text>
        <Text style={styles.subtitle}>Manage your account.</Text>
      </View>

      <View style={styles.profileCard}>
        <Pressable style={styles.profileEditButton} onPress={onEditProfile}>
          <Pencil size={16} color={c.onAccent} strokeWidth={2.4} />
        </Pressable>

        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatarPreview} />
        ) : (
          <UserRound size={72} color={c.muted} strokeWidth={1.5} />
        )}

        {loading ? (
          <Text style={styles.profileSubtext}>Loading...</Text>
        ) : (
          <>
            <Text style={styles.profileName}>{profile?.name || 'Your Name'}</Text>
            <Text style={styles.profileSubtext}>
              {profile?.username ? `@${profile.username}` : 'Complete your profile'}
            </Text>
          </>
        )}
      </View>

      <View style={styles.accountActions}>
        {profile?.is_recruiter && (
          <Pressable style={styles.accountActionRow} onPress={onManagePositions}>
            <BriefcaseBusiness size={20} color={c.textSecondary} strokeWidth={2} />
            <Text style={styles.accountActionText}>Manage Positions</Text>
            <ChevronRight size={18} color={c.muted} strokeWidth={2} />
          </Pressable>
        )}

        <Pressable
          style={[styles.accountActionRow, !showSettings && { borderBottomWidth: 0 }]}
          onPress={() => setShowSettings((v) => !v)}
        >
          <Settings size={20} color={c.textSecondary} strokeWidth={2} />
          <Text style={styles.accountActionText}>Settings</Text>
          <ChevronRight
            size={18}
            color={c.muted}
            strokeWidth={2}
            style={showSettings ? { transform: [{ rotate: '90deg' }] } : undefined}
          />
        </Pressable>

        {showSettings && (
          <View style={styles.settingsPanel}>
            <Text style={styles.sectionLabel}>APPEARANCE</Text>
            <View style={[styles.subTabBar, styles.settingsToggle]}>
              {(['light', 'dark'] as const).map((m) => (
                <Pressable
                  key={m}
                  style={[styles.subTabItem, mode === m && styles.subTabItemActive]}
                  onPress={() => setMode(m)}
                >
                  <Text style={[styles.subTabText, mode === m && styles.subTabTextActive]}>
                    {m === 'light' ? 'Light' : 'Dark'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

function PositionsScreen({
  session,
  onBack,
}: {
  session: Session;
  onBack: () => void;
}) {
  const styles = useStyles();
  const c = useTheme().colors;
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [payRange, setPayRange] = useState('');
  const [location, setLocation] = useState('');
  const [scheduleType, setScheduleType] = useState('');
  const [epaRequired, setEpaRequired] = useState('');
  const [minYears, setMinYears] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPositions = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .eq('recruiter_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) Alert.alert('Error', error.message);
    else setPositions(data ?? []);

    setLoading(false);
  };

  useEffect(() => {
    fetchPositions();
  }, []);

  const resetForm = () => {
    setTitle('');
    setCompany('');
    setPayRange('');
    setLocation('');
    setScheduleType('');
    setEpaRequired('');
    setMinYears('');
    setDescription('');
    setSkills([]);
    setSkillInput('');
    setEditingId(null);
  };

  const openAddForm = () => {
    resetForm();
    setView('form');
  };

  const openEditForm = (position: any) => {
    setTitle(position.title ?? '');
    setCompany(position.company ?? '');
    setPayRange(position.pay_range ?? '');
    setLocation(position.location ?? '');
    setScheduleType(position.schedule_type ?? '');
    setEpaRequired(position.epa_608_required ?? '');
    setMinYears(position.min_experience_years != null ? String(position.min_experience_years) : '');
    setDescription(position.description ?? '');
    setSkills(position.skills ?? []);
    setEditingId(position.id);
    setView('form');
  };

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed || skills.includes(trimmed)) {
      setSkillInput('');
      return;
    }
    setSkills((prev) => [...prev, trimmed]);
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    setSkills((prev) => prev.filter((s) => s !== skill));
  };

  const handleSave = async () => {
    if (!title.trim() || !company.trim()) {
      Alert.alert('Missing info', 'Title and company are required.');
      return;
    }

    const parsedMinYears = parseMinYears(minYears);
    if (parsedMinYears === 'invalid') {
      Alert.alert('Invalid experience', 'Minimum experience must be a whole number of years.');
      return;
    }

    setSaving(true);

    const payload = {
      recruiter_id: session.user.id,
      title: title.trim(),
      company: company.trim(),
      pay_range: payRange.trim() || null,
      location: location.trim() || null,
      schedule_type: scheduleType || null,
      epa_608_required: epaRequired || null,
      min_experience_years: parsedMinYears,
      description: description.trim() || null,
      skills,
      ...(editingId ? {} : { active: true }),
    };

    const { error } = editingId
      ? await supabase.from('positions').update(payload).eq('id', editingId)
      : await supabase.from('positions').insert(payload);

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setView('list');
    fetchPositions();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete position', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('positions').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else fetchPositions();
        },
      },
    ]);
  };

  if (view === 'form') {
    return (
      <SafeAreaView style={styles.authContainer}>
        <KeyboardAvoidingView
          style={styles.authInner}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => setView('list')} style={styles.chatBackButton}>
              <ArrowLeft size={22} color={c.text} strokeWidth={2.2} />
            </Pressable>

            <Text style={styles.logo}>bulletin.</Text>
            <Text style={styles.subtitle}>
              {editingId ? 'Edit position.' : 'Add a position.'}
            </Text>

            <TextInput
              style={styles.authInput}
              placeholder="Job title"
              placeholderTextColor={c.muted}
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={styles.authInput}
              placeholder="Company"
              placeholderTextColor={c.muted}
              value={company}
              onChangeText={setCompany}
            />

            <TextInput
              style={styles.authInput}
              placeholder="Pay range (e.g. $50k–$65k)"
              placeholderTextColor={c.muted}
              value={payRange}
              onChangeText={setPayRange}
            />

            <TextInput
              style={styles.authInput}
              placeholder="Location"
              placeholderTextColor={c.muted}
              value={location}
              onChangeText={setLocation}
            />

            <ChipSelect
              label="SCHEDULE TYPE"
              options={SCHEDULE_TYPES}
              selected={scheduleType ? [scheduleType] : []}
              onToggle={(o) => setScheduleType((prev) => (prev === o ? '' : o))}
            />

            <ChipSelect
              label="EPA 608 REQUIRED (MINIMUM TYPE)"
              options={EPA_TYPES.map((t) => `Type ${t}`)}
              selected={epaRequired ? [`Type ${epaRequired}`] : []}
              onToggle={(o) => {
                const t = o.replace('Type ', '');
                setEpaRequired((prev) => (prev === t ? '' : t));
              }}
            />
            <Text style={styles.chipHint}>
              Universal-certified techs also qualify. Leave unselected if not required.
            </Text>

            <TextInput
              style={styles.authInput}
              placeholder="Minimum years of experience (e.g. 2)"
              placeholderTextColor={c.muted}
              value={minYears}
              onChangeText={setMinYears}
              keyboardType="number-pad"
              maxLength={2}
            />

            <View style={styles.skillInputRow}>
              <TextInput
                style={[styles.authInput, styles.skillInput]}
                placeholder="Add a skill or requirement"
                placeholderTextColor={c.muted}
                value={skillInput}
                onChangeText={setSkillInput}
                onSubmitEditing={addSkill}
                returnKeyType="done"
              />
              <Pressable style={styles.skillAddButton} onPress={addSkill}>
                <Text style={styles.skillAddButtonText}>Add</Text>
              </Pressable>
            </View>

            {skills.length > 0 && (
              <View style={styles.tags}>
                {skills.map((skill) => (
                  <Pressable
                    key={skill}
                    style={styles.skillTag}
                    onPress={() => removeSkill(skill)}
                  >
                    <Text style={styles.skillTagText}>{skill}</Text>
                    <X size={12} color={c.textStrong} strokeWidth={2.4} />
                  </Pressable>
                ))}
              </View>
            )}

            <TextInput
              style={[styles.authInput, styles.authTextArea]}
              placeholder="Description"
              placeholderTextColor={c.muted}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Pressable
              style={[styles.authButton, saving && styles.authButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.authButtonText}>
                {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add position'}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.simpleScreen}>
      <View style={styles.chatHeader}>
        <Pressable onPress={onBack} style={styles.chatBackButton}>
          <ArrowLeft size={22} color={c.text} strokeWidth={2.2} />
        </Pressable>
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderName}>Your Positions</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptySubtitle}>Loading...</Text>
        </View>
      ) : positions.length === 0 ? (
        <View style={styles.emptyState}>
          <BriefcaseBusiness size={48} color={c.muted} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No positions yet</Text>
          <Text style={styles.emptySubtitle}>
            Add an open position for candidates to discover.
          </Text>
          <Pressable style={styles.refreshButton} onPress={openAddForm}>
            <Text style={styles.refreshText}>Add Position</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={positions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.interestsList}
          ListHeaderComponent={
            <Pressable
              style={[styles.refreshButton, { marginTop: 16, marginBottom: 12 }]}
              onPress={openAddForm}
            >
              <Text style={styles.refreshText}>Add Position</Text>
            </Pressable>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.interestRow} onPress={() => openEditForm(item)}>
              <BriefcaseBusiness size={32} color={c.muted} strokeWidth={1.5} />
              <View style={styles.interestRowInfo}>
                <Text numberOfLines={1} style={styles.interestRowName}>
                  {item.title}
                </Text>
                <Text numberOfLines={1} style={styles.interestRowMeta}>
                  {item.company}
                </Text>
              </View>
              <Pressable onPress={() => handleDelete(item.id)} style={{ padding: 6 }}>
                <X size={18} color={c.danger} strokeWidth={2.2} />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function OnboardingScreen({
  session,
  onComplete,
  onCancel,
}: {
  session: Session;
  onComplete: () => void;
  onCancel?: () => void;
}) {
  const styles = useStyles();
  const c = useTheme().colors;
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [epaCertified, setEpaCertified] = useState(false);
  const [epaTypes, setEpaTypes] = useState<string[]>([]);
  const [startYear, setStartYear] = useState('');
  const [tradeRole, setTradeRole] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<{ uri: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExisting = async () => {
      const { data } = await supabase
        .from('profiles')
        .select(
          'name, username, epa_608_types, trade_start_year, trade_role, description, avatar_url, resume_url'
        )
        .eq('id', session.user.id)
        .single();

      if (data) {
        setName(data.name ?? '');
        setUsername(data.username ?? '');
        setEpaTypes(data.epa_608_types ?? []);
        setEpaCertified((data.epa_608_types ?? []).length > 0);
        setStartYear(data.trade_start_year ? String(data.trade_start_year) : '');
        setTradeRole(data.trade_role ?? '');
        setDescription(data.description ?? '');
        if (data.avatar_url) setAvatarUri(data.avatar_url);
        if (data.resume_url) {
          setResumeFile({ uri: data.resume_url, name: 'resume.pdf' });
        }
      }

      setLoading(false);
    };

    loadExisting();
  }, []);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const pickResume = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });

    if (!result.canceled) {
      setResumeFile({
        uri: result.assets[0].uri,
        name: result.assets[0].name,
      });
    }
  };

  const uploadFile = async (
    bucket: string,
    uri: string,
    fileName: string,
    contentType: string
  ) => {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const path = `${session.user.id}/${fileName}`;

    const { error } = await supabase.storage.from(bucket).upload(
      path,
      decode(base64),
      {
        contentType,
        upsert: true,
        cacheControl: '3600',
      }
    );

    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);

    return `${data.publicUrl}?t=${Date.now()}`;
  };

  const handleSubmit = async () => {
    if (!name.trim() || !username.trim()) {
      Alert.alert('Missing info', 'Name and username are required.');
      return;
    }

    const parsedYear = parseYear(startYear);
    if (parsedYear === 'invalid') {
      Alert.alert('Invalid year', 'Enter the four-digit year you started in the trade, e.g. 2020.');
      return;
    }
    if (epaCertified && epaTypes.length === 0) {
      Alert.alert('EPA 608', 'Select at least one certification type, or choose No.');
      return;
    }

    setSubmitting(true);

    try {
      let avatarUrl: string | undefined;
      let resumeUrl: string | undefined;

      if (avatarUri && !avatarUri.startsWith('http')) {
        avatarUrl = await uploadFile('avatars', avatarUri, 'avatar.jpg', 'image/jpeg');
      }

      if (resumeFile && !resumeFile.uri.startsWith('http')) {
        resumeUrl = await uploadFile(
          'resumes',
          resumeFile.uri,
          'resume.pdf',
          'application/pdf'
        );
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          username: username.trim(),
          epa_608_types: epaCertified ? epaTypes : [],
          trade_start_year: parsedYear,
          trade_role: tradeRole || null,
          description: description.trim(),
          ...(avatarUrl && { avatar_url: avatarUrl }),
          ...(resumeUrl && { resume_url: resumeUrl }),
          onboarded: true,
        })
        .eq('id', session.user.id);

      if (error) throw error;

      onComplete();
    } catch (err: any) {
      const message =
        err?.code === '23505'
          ? 'That username is already taken.'
          : err?.message ?? 'Something went wrong.';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.authContainer}>
      <KeyboardAvoidingView
        style={styles.authInner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ gap: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          {onCancel && (
            <Pressable onPress={onCancel} style={styles.chatBackButton}>
              <ArrowLeft size={22} color={c.text} strokeWidth={2.2} />
            </Pressable>
          )}

          <Text style={styles.logo}>bulletin.</Text>
          <Text style={styles.subtitle}>
            {onCancel ? 'Edit your profile.' : 'Set up your profile.'}
          </Text>

          {loading ? (
            <Text style={styles.subtitle}>Loading...</Text>
          ) : (
            <>
              <Pressable style={styles.avatarPicker} onPress={pickAvatar}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
                ) : (
                  <UserRound size={40} color={c.muted} strokeWidth={1.5} />
                )}
                <Text style={styles.avatarPickerText}>
                  {avatarUri ? 'Change photo' : 'Add profile photo'}
                </Text>
              </Pressable>

              <TextInput
                style={styles.authInput}
                placeholder="Name"
                placeholderTextColor={c.muted}
                value={name}
                onChangeText={setName}
              />

              <TextInput
                style={styles.authInput}
                placeholder="Username"
                placeholderTextColor={c.muted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />

              <ChipSelect
                label="EPA 608 CERTIFIED?"
                options={['Yes', 'No']}
                selected={[epaCertified ? 'Yes' : 'No']}
                onToggle={(o) => {
                  setEpaCertified(o === 'Yes');
                  if (o === 'No') setEpaTypes([]);
                }}
              />

              {epaCertified && (
                <>
                  <ChipSelect
                    label="CERTIFICATION TYPES"
                    options={EPA_TYPES.map((t) => `Type ${t}`)}
                    selected={epaTypes.map((t) => `Type ${t}`)}
                    onToggle={(o) => {
                      const t = o.replace('Type ', '');
                      setEpaTypes((prev) =>
                        prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                      );
                    }}
                  />
                  {isUniversal(epaTypes) && (
                    <Text style={styles.chipHint}>Shown on your profile as Universal.</Text>
                  )}
                </>
              )}

              <TextInput
                style={styles.authInput}
                placeholder="Year started in the trade (e.g. 2020)"
                placeholderTextColor={c.muted}
                value={startYear}
                onChangeText={setStartYear}
                keyboardType="number-pad"
                maxLength={4}
              />

              <ChipSelect
                label="CURRENT / MOST RECENT ROLE"
                options={TRADE_ROLES}
                selected={tradeRole ? [tradeRole] : []}
                onToggle={(o) => setTradeRole((prev) => (prev === o ? '' : o))}
              />

              <TextInput
                style={[styles.authInput, styles.authTextArea]}
                placeholder="A bit about yourself"
                placeholderTextColor={c.muted}
                value={description}
                onChangeText={setDescription}
                multiline
              />

              <Pressable style={styles.resumePicker} onPress={pickResume}>
                <Text style={styles.resumePickerText}>
                  {resumeFile ? resumeFile.name : 'Upload resume (PDF)'}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.authButton, submitting && styles.authButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Text style={styles.authButtonText}>
                  {submitting ? 'Saving...' : 'Finish setup'}
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AuthScreen({ setRecovering }: { setRecovering: (value: boolean) => void }) {
  const styles = useStyles();
  const c = useTheme().colors;
  const [showForgot, setShowForgot] = useState(false);
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [role, setRole] = useState<'seeker' | 'recruiter'>('seeker');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Please enter both email and password.');
      return;
    }

    setLoading(true);

    const { error } =
      mode === 'signUp'
        ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { role } },
          })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    if (mode === 'signUp') {
      Alert.alert('Check your email', 'Confirm your email to finish signing up.');
    }
  };

  if (showForgot) {
    return (
      <ForgotPasswordScreen
        initialEmail={email}
        setRecovering={setRecovering}
        onBack={() => setShowForgot(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.authContainer}>
      <KeyboardAvoidingView
        style={styles.authInner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Text style={styles.logo}>bulletin.</Text>
        <Text style={styles.subtitle}>
          {mode === 'signIn' ? 'Welcome back.' : 'Create your account.'}
        </Text>

        <View style={[styles.subTabBar, styles.authModeToggle]}>
          <Pressable
            style={[styles.subTabItem, mode === 'signIn' && styles.subTabItemActive]}
            onPress={() => setMode('signIn')}
          >
            <Text
              style={[styles.subTabText, mode === 'signIn' && styles.subTabTextActive]}
            >
              Log In
            </Text>
          </Pressable>

          <Pressable
            style={[styles.subTabItem, mode === 'signUp' && styles.subTabItemActive]}
            onPress={() => setMode('signUp')}
          >
            <Text
              style={[styles.subTabText, mode === 'signUp' && styles.subTabTextActive]}
            >
              Sign Up
            </Text>
          </Pressable>
        </View>

        {mode === 'signUp' && (
          <View style={[styles.subTabBar, styles.authModeToggle]}>
            {(['seeker', 'recruiter'] as const).map((r) => (
              <Pressable
                key={r}
                style={[styles.subTabItem, role === r && styles.subTabItemActive]}
                onPress={() => setRole(r)}
              >
                <Text style={[styles.subTabText, role === r && styles.subTabTextActive]}>
                  {r === 'seeker' ? "I'm a Seeker" : "I'm a Recruiter"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <TextInput
          style={styles.authInput}
          placeholder="Email"
          placeholderTextColor={c.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.authInput}
          placeholder="Password"
          placeholderTextColor={c.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          style={[styles.authButton, loading && styles.authButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.authButtonText}>
            {loading ? 'Please wait...' : mode === 'signIn' ? 'Log In' : 'Sign Up'}
          </Text>
        </Pressable>

        {mode === 'signIn' && (
          <Pressable
            style={{ marginTop: 14, alignItems: 'center' }}
            onPress={() => setShowForgot(true)}
            disabled={loading}
          >
            <Text style={styles.subtitle}>Forgot password?</Text>
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Password reset by emailed one-time code, so it works without deep links.
function ForgotPasswordScreen({
  initialEmail,
  setRecovering,
  onBack,
}: {
  initialEmail: string;
  setRecovering: (value: boolean) => void;
  onBack: () => void;
}) {
  const styles = useStyles();
  const c = useTheme().colors;
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'We need it to send you a code.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectUrl(),
    });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setStep('verify');
  };

  const verifyCode = async () => {
    if (!code.trim()) {
      Alert.alert('Enter the code', 'Type the code from the email.');
      return;
    }

    setLoading(true);
    // Set before verifying so the app shows the new-password screen, not the home screen.
    setRecovering(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'recovery',
    });
    setLoading(false);

    if (error) {
      setRecovering(false);
      Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.authContainer}>
      <KeyboardAvoidingView
        style={styles.authInner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Text style={styles.logo}>bulletin.</Text>
        <Text style={styles.subtitle}>
          {step === 'request'
            ? 'Reset your password.'
            : `Enter the code we sent to ${email.trim()}.`}
        </Text>

        {step === 'request' ? (
          <TextInput
            style={styles.authInput}
            placeholder="Email"
            placeholderTextColor={c.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        ) : (
          <TextInput
            style={styles.authInput}
            placeholder="Code"
            placeholderTextColor={c.muted}
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            keyboardType="number-pad"
            maxLength={10}
          />
        )}

        <Pressable
          style={[styles.authButton, loading && styles.authButtonDisabled]}
          onPress={step === 'request' ? sendCode : verifyCode}
          disabled={loading}
        >
          <Text style={styles.authButtonText}>
            {loading ? 'Please wait...' : step === 'request' ? 'Send code' : 'Verify code'}
          </Text>
        </Pressable>

        {step === 'verify' && (
          <Pressable
            style={{ marginTop: 14, alignItems: 'center' }}
            onPress={sendCode}
            disabled={loading}
          >
            <Text style={styles.subtitle}>Resend code</Text>
          </Pressable>
        )}

        <Pressable style={{ marginTop: 14, alignItems: 'center' }} onPress={onBack}>
          <Text style={styles.subtitle}>Back to log in</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const styles = useStyles();
  const c = useTheme().colors;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (password.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match', 'Please re-enter them.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert('Password updated', 'You are all set.');
    onDone();
  };

  return (
    <SafeAreaView style={styles.authContainer}>
      <KeyboardAvoidingView
        style={styles.authInner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Text style={styles.logo}>bulletin.</Text>
        <Text style={styles.subtitle}>Choose a new password.</Text>

        <TextInput
          style={styles.authInput}
          placeholder="New password"
          placeholderTextColor={c.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.authInput}
          placeholder="Confirm password"
          placeholderTextColor={c.muted}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />

        <Pressable
          style={[styles.authButton, loading && styles.authButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.authButtonText}>{loading ? 'Please wait...' : 'Save password'}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function WorkerCardContent({ candidate }: { candidate: any }) {
  const styles = useStyles();
  const c = useTheme().colors;
  return (
    <>
      <View style={styles.profileSection}>
        {candidate.avatar_url ? (
          <Image source={{ uri: candidate.avatar_url }} style={styles.cardAvatarPreview} />
        ) : (
          <UserRound size={92} color={c.muted} strokeWidth={1.5} />
        )}

        <View style={styles.profileInfo}>
          <Text numberOfLines={1} style={styles.name}>
            {candidate.name}
          </Text>

          <View style={styles.recruiterMeta}>
            <Text numberOfLines={1} style={styles.recruiterTitle}>
              @{candidate.username}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>EPA 608</Text>
        <Text style={styles.position}>{formatWorkerEpa(candidate.epa_608_types)}</Text>

        {(candidate.trade_role || candidate.trade_start_year) && (
          <View style={styles.tags}>
            {candidate.trade_role ? <Tag text={candidate.trade_role} /> : null}
            {candidate.trade_start_year ? (
              <Tag text={formatTradeStart(candidate.trade_start_year)!} />
            ) : null}
          </View>
        )}

        <Text style={[styles.sectionLabel, { marginTop: 18 }]}>ABOUT</Text>
        <Text style={styles.note}>{candidate.description || 'No description provided.'}</Text>
      </View>
    </>
  );
}

function RecruiterCardContent({ recruiter, me }: { recruiter: any; me?: any }) {
  const styles = useStyles();
  const c = useTheme().colors;
  const positions = recruiter.positions ?? [];
  const primary = positions[0];
  const mismatches = [
    epaMismatchNote(primary?.epa_608_required, me?.epa_608_types),
    experienceMismatchNote(primary?.min_experience_years, me?.trade_start_year),
  ].filter(Boolean) as string[];

  return (
    <>
      <View style={styles.profileSection}>
        {recruiter.avatar_url ? (
          <Image source={{ uri: recruiter.avatar_url }} style={styles.cardAvatarPreview} />
        ) : (
          <UserRound size={92} color={c.muted} strokeWidth={1.5} />
        )}

        <View style={styles.profileInfo}>
          <Text numberOfLines={1} style={styles.name}>
            {recruiter.name}
          </Text>

          <View style={styles.recruiterMeta}>
            <Text numberOfLines={1} style={styles.recruiterTitle}>
              {positions.length} open position{positions.length === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>LOOKING FOR</Text>

        <View style={styles.positionRow}>
          <BriefcaseBusiness size={20} color={c.text} strokeWidth={2.2} />
          <Text numberOfLines={1} style={styles.position}>
            {primary?.title ?? 'Position'}
          </Text>
        </View>

        {primary?.pay_range ? <Text style={styles.pay}>{primary.pay_range}</Text> : null}

        {primary?.location ? (
          <View style={styles.locationRow}>
            <MapPin size={15} color={c.textSecondary} strokeWidth={2} />
            <Text numberOfLines={1} style={styles.location}>
              {primary.location}
              {primary.schedule_type ? ` · ${primary.schedule_type}` : ''}
            </Text>
          </View>
        ) : null}

        {(primary?.epa_608_required || primary?.min_experience_years) && (
          <View style={styles.tags}>
            {primary.epa_608_required ? (
              <Tag text={`EPA 608 Type ${primary.epa_608_required}+`} />
            ) : null}
            {primary.min_experience_years ? (
              <Tag text={`${primary.min_experience_years}+ yrs`} />
            ) : null}
          </View>
        )}

        {mismatches.length > 0 && (
          <Text style={styles.mismatchText}>Heads up: {mismatches.join(' · ')}</Text>
        )}

        <View style={styles.tags}>
          {positions.slice(0, 4).map((p: any) => (
            <Tag key={p.id} text={p.title} />
          ))}
        </View>

        {primary?.description ? (
          <Text style={styles.note}>"{primary.description}"</Text>
        ) : null}
      </View>
    </>
  );
}

function Tag({ text }: { text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>
        {text}
      </Text>
    </View>
  );
}

function ChipSelect({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: readonly string[];
  onToggle: (option: string) => void;
}) {
  const styles = useStyles();
  return (
    <View>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={[styles.tags, { marginTop: 8 }]}>
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <Pressable
              key={option}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onToggle(option)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TabBar({
  activeTab,
  onTabPress,
  unseenReceivedCount,
}: {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
  unseenReceivedCount: number;
}) {
  const styles = useStyles();
  const c = useTheme().colors;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom || 12 }]}>
      {TABS.map(({ key, label, Icon }) => {
        const isActive = key === activeTab;

        return (
          <Pressable
            key={key}
            style={styles.tabItem}
            onPress={() => onTabPress(key)}
          >
          <View>
            <Icon
              size={24}
              color={isActive ? c.text : c.muted}
              strokeWidth={isActive ? 2.4 : 2}
            />
            {key === 'interests' && unseenReceivedCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unseenReceivedCount > 9 ? '9+' : unseenReceivedCount}
                </Text>
              </View>
            )}
          </View>
            <Text
              style={[
                styles.tabLabel,
                isActive && styles.tabLabelActive,
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

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.bg,
    },

    container: {
      flex: 1,
    },

    header: {
      paddingHorizontal: 22,
      paddingTop: 8,
      paddingBottom: 14,
    },

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

    deck: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    card: {
      position: 'absolute',
      width: CARD_WIDTH,
      height: '96%',
      backgroundColor: c.surface,
      borderRadius: 28,
      overflow: 'hidden',

      borderWidth: 1,
      borderColor: c.border,

      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 10,
      },
      shadowOpacity: 0.08,
      shadowRadius: 20,

      elevation: 5,
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

    positionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 9,
    },

    position: {
      flex: 1,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: c.text,
    },

    pay: {
      marginTop: 9,
      fontSize: 19,
      fontWeight: '700',
      color: c.text,
    },

    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 8,
    },

    location: {
      flex: 1,
      fontSize: 14,
      color: c.textSecondary,
    },

    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 18,
    },

    tag: {
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: c.surfaceAlt,
    },

    tagText: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textStrong,
    },

    note: {
      marginTop: 20,
      fontSize: 15,
      lineHeight: 22,
      color: c.textStrong,
    },

    swipeBadge: {
      position: 'absolute',
      top: 28,
      zIndex: 20,

      paddingHorizontal: 14,
      paddingVertical: 7,

      borderRadius: 10,
      borderWidth: 2,
    },

    passBadge: {
      right: 22,
      borderColor: c.danger,
      transform: [{ rotate: '8deg' }],
    },

    interestedBadge: {
      left: 22,
      borderColor: c.green,
      transform: [{ rotate: '-8deg' }],
    },

    passText: {
      color: c.danger,
      fontWeight: '900',
      fontSize: 15,
    },

    interestedText: {
      color: c.green,
      fontWeight: '900',
      fontSize: 15,
    },

    actions: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',

      gap: 24,
      paddingTop: 12,
      paddingBottom: 18,
    },

    actionButton: {
      alignItems: 'center',
      justifyContent: 'center',

      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 5,
      },
      shadowOpacity: 0.08,
      shadowRadius: 10,

      elevation: 3,
    },

    passButton: {
      width: 60,
      height: 60,
      borderRadius: 30,

      backgroundColor: c.surface,

      borderWidth: 1,
      borderColor: c.border,
    },

    interestedButton: {
      width: 70,
      height: 70,
      borderRadius: 35,

      backgroundColor: c.accent,
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

    profileName: {
      fontSize: 20,
      fontWeight: '800',
      color: c.text,
      marginTop: 8,
    },

    profileSubtext: {
      fontSize: 14,
      color: c.textSecondary,
    },

    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },

    interestCounter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: c.surfaceAlt,
      marginTop: 2,
    },

    interestCounterText: {
      fontSize: 20,
      fontWeight: '700',
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

    chatContainer: {
      flex: 1,
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

    interestRowAction: {
      padding: 6,
    },

    chatHeaderInfo: {
      flex: 1,
    },

    chatHeaderName: {
      fontSize: 17,
      fontWeight: '700',
      color: c.text,
    },

    chatHeaderMeta: {
      marginTop: 1,
      fontSize: 12,
      color: c.textSecondary,
    },

    chatMessages: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 2,
      flexGrow: 1,
    },

    chatBubble: {
      maxWidth: '78%',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 18,
    },

    chatBubbleMine: {
      alignSelf: 'flex-end',
      backgroundColor: c.accent,
      borderBottomRightRadius: 4,
    },

    chatBubbleTheirs: {
      alignSelf: 'flex-start',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderBottomLeftRadius: 4,
    },

    chatRow: {
      gap: 3,
    },

    chatRowGroupStart: {
      marginTop: 8,
    },

    chatHeaderAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },

    chatDayWrap: {
      alignSelf: 'center',
      marginVertical: 10,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: c.surfaceAlt,
    },

    chatDayText: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textSecondary,
    },

    chatMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-end',
      gap: 4,
      marginTop: 3,
    },

    chatTime: {
      fontSize: 10,
      color: c.muted,
    },

    chatTimeMine: {
      color: c.muted,
    },

    chatBubbleFailed: {
      borderWidth: 1,
      borderColor: c.danger,
    },

    chatStatus: {
      alignSelf: 'flex-end',
      fontSize: 11,
      color: c.textSecondary,
    },

    chatStatusFailed: {
      color: c.danger,
      fontWeight: '600',
    },

    convoTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    convoName: {
      flex: 1,
    },

    convoTime: {
      fontSize: 12,
      color: c.muted,
    },

    convoTimeUnread: {
      color: c.blue,
      fontWeight: '700',
    },

    convoBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },

    convoPreview: {
      flex: 1,
      marginTop: 0,
    },

    convoPreviewUnread: {
      color: c.text,
      fontWeight: '700',
    },

    unreadPill: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: 6,
      borderRadius: 10,
      backgroundColor: c.blue,
      alignItems: 'center',
      justifyContent: 'center',
    },

    unreadPillText: {
      fontSize: 11,
      fontWeight: '800',
      color: c.white,
    },

    settingsPanel: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },

    settingsToggle: {
      marginHorizontal: 0,
      marginTop: 8,
    },

    chatBubbleText: {
      fontSize: 15,
      lineHeight: 20,
      color: c.text,
    },

    chatBubbleTextMine: {
      color: c.onAccent,
    },

    chatEmptyText: {
      textAlign: 'center',
      marginTop: 40,
      fontSize: 14,
      color: c.muted,
    },

    chatInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.surface,
    },

    chatInput: {
      flex: 1,
      maxHeight: 100,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: c.surfaceAlt,
      fontSize: 15,
      color: c.text,
    },

    chatSendButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },

    chatSendButtonDisabled: {
      backgroundColor: c.disabled,
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

    authLoadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bg,
    },

    authModeToggle: {
      marginHorizontal: 0,
      marginTop: 20,
      marginBottom: 4,
    },

    signOutButton: {
      marginTop: 20,
      marginHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.danger,
      alignItems: 'center',
    },

    signOutText: {
      color: c.danger,
      fontWeight: '700',
      fontSize: 15,
    },

    avatarPicker: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
    },

    avatarPreview: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },

    avatarPickerText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textSecondary,
    },

    authTextArea: {
      minHeight: 90,
      textAlignVertical: 'top',
    },

    resumePicker: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },

    resumePickerText: {
      fontSize: 15,
      color: c.textSecondary,
    },

    profileCard: {
      marginTop: 24,
      marginHorizontal: 22,
      padding: 28,
      borderRadius: 24,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      gap: 6,
      position: 'relative',
    },

    profileEditButton: {
      position: 'absolute',
      top: 14,
      right: 14,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },

    accountActions: {
      marginTop: 16,
      marginHorizontal: 22,
      borderRadius: 18,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },

    accountActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },

    accountActionText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
    },

    skillInputRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },

    skillInput: {
      flex: 1,
      marginTop: 0,
    },

    skillAddButton: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.accent,
    },

    skillAddButtonText: {
      color: c.onAccent,
      fontWeight: '700',
      fontSize: 14,
    },

    skillTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: c.surfaceAlt,
    },

    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
    },

    chipActive: {
      backgroundColor: c.accent,
      borderColor: c.accent,
    },

    chipHint: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: -4,
    },

    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textStrong,
    },

    chipTextActive: {
      color: c.onAccent,
    },

    mismatchText: {
      marginTop: 8,
      fontSize: 12,
      fontWeight: '600',
      color: c.amber,
    },

    skillTagText: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textStrong,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },

    modalCard: {
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 22,
    },

    checklistRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
    },

    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: c.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },

    checkboxChecked: {
      backgroundColor: c.accent,
      borderColor: c.accent,
    },

    checklistText: {
      fontSize: 15,
      color: c.text,
      flex: 1,
    },
  });
}

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}
