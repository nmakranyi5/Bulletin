import { Session } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Check,
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
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
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
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

const CARD_WIDTH = width - 36;
const SWIPE_THRESHOLD = width * 0.28;
const SWIPE_DISTANCE = width * 1.4;
const SWIPE_VELOCITY = 400;
const MAX_INTERESTS = 10;

const DUMMY_CARDS = [
  {
    id: 1,
    name: 'Maya Chen',
    title: 'Technical Recruiter',
    company: 'Linear',
    position: 'Frontend Engineer',
    pay: '$135k–$175k',
    location: 'San Francisco, CA',
    workStyle: 'Hybrid',
    experience: '0–3 years',
    skills: ['React', 'TypeScript', 'Frontend'],
    note: 'Looking for early-career engineers who love building polished products.',
  },
  {
    id: 2,
    name: 'Daniel Kim',
    title: 'University Recruiter',
    company: 'Ramp',
    position: 'Software Engineer',
    pay: '$140k–$185k',
    location: 'New York, NY',
    workStyle: 'On-site',
    experience: 'New Grad',
    skills: ['Python', 'React', 'Systems'],
    note: 'Hiring new grads who are curious, fast learners, and strong builders.',
  },
  {
    id: 3,
    name: 'Sofia Martinez',
    title: 'Talent Partner',
    company: 'Figma',
    position: 'Product Engineer',
    pay: '$150k–$195k',
    location: 'San Francisco, CA',
    workStyle: 'Hybrid',
    experience: '1–3 years',
    skills: ['TypeScript', 'React', 'Product'],
    note: 'Looking for engineers who care about design as much as code.',
  },
  {
    id: 4,
    name: 'Jordan Lee',
    title: 'Technical Recruiter',
    company: 'Vercel',
    position: 'Frontend Engineer',
    pay: '$130k–$170k',
    location: 'Remote',
    workStyle: 'Remote',
    experience: '0–2 years',
    skills: ['Next.js', 'React', 'JavaScript'],
    note: 'Great fit for someone who enjoys shipping fast and owning features.',
  },
  {
    id: 5,
    name: 'Avery Patel',
    title: 'Engineering Recruiter',
    company: 'Notion',
    position: 'Software Engineer',
    pay: '$145k–$190k',
    location: 'San Francisco, CA',
    workStyle: 'Hybrid',
    experience: '1–4 years',
    skills: ['Full Stack', 'React', 'Node'],
    note: 'Building out our team with strong product-minded developers.',
  },
  {
    id: 6,
    name: 'Reuben Philip',
    title: 'Gamer',
    company: 'N/A',
    position: 'N/A',
    pay: '$0',
    location: 'Mountain House, CA',
    workStyle: 'Hybrid',
    experience: '1–4 years',
    skills: ['Full Stack', 'React', 'Node'],
    note: 'You can call me ghost because you dont know who I am or where I am.',
  },
  {
    id: 7,
    name: 'Connor Dam',
    title: 'Haram Man',
    company: 'N/A',
    position: 'N/A',
    pay: '$0',
    location: 'Foster City, CA',
    workStyle: 'Hybrid',
    experience: '1–4 years',
    skills: ['Full Stack', 'React', 'Node'],
    note: 'AHHHHHHHH.',
  },
  {
    id: 8,
    name: 'Aritro Datta',
    title: 'Data Scientist',
    company: 'N/A',
    position: 'N/A',
    pay: '$0',
    location: 'Foster City, CA',
    workStyle: 'Hybrid',
    experience: '1–4 years',
    skills: ['Full Stack', 'React', 'Node'],
    note: 'AHHHHHHHH.',
  },
  {
    id: 9,
    name: 'Galen Guo',
    title: 'Haram',
    company: 'N/A',
    position: 'N/A',
    pay: '$0',
    location: 'Foster City, CA',
    workStyle: 'Hybrid',
    experience: '1–4 years',
    skills: ['Full Stack', 'React', 'Node'],
    note: 'AHHHHHHHH.',
  },
  {
    id: 10,
    name: 'Victoria Grammit',
    title: 'Model',
    company: 'N/A',
    position: 'N/A',
    pay: '$0',
    location: 'Foster City, CA',
    workStyle: 'Hybrid',
    experience: '1–4 years',
    skills: ['Full Stack', 'React', 'Node'],
    note: 'AHHHHHHHH.',
  },
];

type InterestRow = {
  id: string;
  from_user: string;
  to_user: string;
  status: string;
  from_profile?: { id: string; name: string; username: string };
  to_profile?: { id: string; name: string; username: string };
};

type Card = (typeof DUMMY_CARDS)[number];

type TabKey = 'discover' | 'interests' | 'messages' | 'profile';

type ChatMessage = {
  id: string;
  text: string;
  fromMe: boolean;
};

// Placeholder shape for Messages/Chat until that screen is wired to real `matches`/`messages` tables.
type MatchStub = {
  id: number;
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
  const [cards, setCards] = useState(DUMMY_CARDS);
  const [activeTab, setActiveTab] = useState<TabKey>('discover');
  const [interestsRemaining, setInterestsRemaining] = useState(MAX_INTERESTS);
  const [sentInterests, setSentInterests] = useState<InterestRow[]>([]);
  const [receivedInterests, setReceivedInterests] = useState<InterestRow[]>([]);
  const [matches, setMatches] = useState<MatchStub[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchStub | null>(null);
  const [messagesByMatch, setMessagesByMatch] = useState<Record<number, ChatMessage[]>>({});

  const translateX = useSharedValue(0);
  const cardOpacity = useSharedValue(1);

  const topCard = cards[0];
  const interestsRemainingSV = useSharedValue(interestsRemaining);
  const unseenReceivedCount = receivedInterests.length;

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [managingPositions, setManagingPositions] = useState(false);

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

  useEffect(() => {
    if (!session) return;

    const ensureProfile = async () => {
      const { data: existing } = await supabase
        .from('profiles')
        .select('onboarded')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('profiles').insert({ id: session.user.id });
        setOnboarded(false);
      } else {
        setOnboarded(existing.onboarded ?? false);
      }
    };

    ensureProfile();
  }, [session]);

  const fetchInterests = async () => {
    if (!session) return;

    const { data: sent, error: sentError } = await supabase
      .from('interests')
      .select('*, to_profile:profiles!to_user(id, name, username)')
      .eq('from_user', session.user.id);

    if (sentError) Alert.alert('Error', sentError.message);
    else setSentInterests(sent ?? []);

    const { data: received, error: receivedError } = await supabase
      .from('interests')
      .select('*, from_profile:profiles!from_user(id, name, username)')
      .eq('to_user', session.user.id)
      .eq('status', 'pending');

    if (receivedError) Alert.alert('Error', receivedError.message);
    else setReceivedInterests(received ?? []);
  };

  useEffect(() => {
    if (session && onboarded) fetchInterests();
  }, [session, onboarded]);

  const sendInterest = async (toUserId: string) => {
    if (!session) return;

    const { error } = await supabase.from('interests').insert({
      from_user: session.user.id,
      to_user: toUserId,
    });

    if (error && error.code !== '23505') {
      // 23505 = unique violation (already sent) — safe to ignore silently
      Alert.alert('Error', error.message);
    } else {
      fetchInterests();
    }
  };

  /*
   * JS-side state update.
   * This is only called through runOnJS from gesture animations.
   */
  const removeTopCard = (interested: number) => {
    if (interested > 0 && topCard) {
      sendInterest(String(topCard.id));
    }

    setCards((prev) => prev.slice(1));

    if (interested > 0) {
      setInterestsRemaining((prev) => (prev > 0 ? prev - 1 : prev));
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

  const resetDeck = () => {
    cardOpacity.value = 0;
    translateX.value = 0;

    setCards(DUMMY_CARDS);
  };

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
      // Match creation will be wired up when we build Messages.
    }
  };

  const handleReceivedPress = (interest: InterestRow) => {
    const name = interest.from_profile?.name ?? 'Someone';

    Alert.alert(
      name,
      `${name} is interested in connecting.`,
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

  const sendMessage = (matchId: number, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const newMessage: ChatMessage = {
      id: `${Date.now()}`,
      text: trimmed,
      fromMe: true,
    };

    setMessagesByMatch((prev) => ({
      ...prev,
      [matchId]: [...(prev[matchId] ?? []), newMessage],
    }));
  };

  if (authLoading || (session && onboarded === null)) {
    return (
      <View style={styles.authLoadingContainer}>
        <Text style={styles.subtitle}>Loading...</Text>
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (!onboarded) {
    return <OnboardingScreen session={session} onComplete={() => setOnboarded(true)} />;
  }

  if (editingProfile) {
    return (
      <OnboardingScreen
        session={session}
        onComplete={() => setEditingProfile(false)}
        onCancel={() => setEditingProfile(false)}
      />
    );
  }

  if (managingPositions) {
    return (
      <PositionsScreen
        session={session}
        onBack={() => setManagingPositions(false)}
      />
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.container}>
        {activeTab === 'discover' && (
          <DiscoverScreen
            cards={cards}
            topCard={topCard}
            cardStyle={cardStyle}
            passStyle={passStyle}
            interestedStyle={interestedStyle}
            gesture={gesture}
            buttonSwipe={buttonSwipe}
            resetDeck={resetDeck}
            interestsRemaining={interestsRemaining}
          />
        )}

        {activeTab === 'interests' && (
          <InterestsScreen
            sentInterests={sentInterests}
            receivedInterests={receivedInterests}
            onReceivedPress={handleReceivedPress}
          />
        )}
        {activeTab === 'messages' && (
          selectedMatch ? (
            <ChatScreen
              match={selectedMatch}
              messages={messagesByMatch[selectedMatch.id] ?? []}
              onSend={(text) => sendMessage(selectedMatch.id, text)}
              onBack={() => setSelectedMatch(null)}
            />
          ) : (
            <MessagesScreen matches={matches} onMatchPress={setSelectedMatch} />
          )
        )}
        {activeTab === 'profile' && (
          <ProfileScreen session={session} onEditProfile={() => setEditingProfile(true)} onManagePositions={() => setManagingPositions(true)} />
        )}
      </SafeAreaView>
      {!selectedMatch && (
        <TabBar activeTab={activeTab} onTabPress={setActiveTab} unseenReceivedCount={unseenReceivedCount} />
      )}
    </GestureHandlerRootView>
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
  resetDeck,
  interestsRemaining,
}: {
  cards: Card[];
  topCard: Card | undefined;
  cardStyle: any;
  passStyle: any;
  interestedStyle: any;
  gesture: any;
  buttonSwipe: (direction: number) => void;
  resetDeck: () => void;
  interestsRemaining: number;
}) {
  return (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.logo}>bulletin.</Text>
            <Text style={styles.subtitle}>Find your next opportunity.</Text>
          </View>

          <View style={styles.interestCounter}>
            <Handshake size={14} color="#18181B" strokeWidth={2.4} />
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
                      <CardContent card={card} />
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

                      <CardContent card={card} />
                    </Animated.View>
                  </GestureDetector>
                );
              })}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>You’re all caught up.</Text>

            <Text style={styles.emptySubtitle}>
              No more recruiter profiles right now.
            </Text>

            <Pressable
              style={styles.refreshButton}
              onPress={resetDeck}
            >
              <Text style={styles.refreshText}>
                Refresh profiles
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
              color="#EF4444"
              strokeWidth={2.6}
            />
          </Pressable>

          <Pressable
            style={[styles.actionButton, styles.interestedButton]}
            onPress={() => buttonSwipe(1)}
          >
            <Check
              size={30}
              color="#FFFFFF"
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
}: {
  sentInterests: InterestRow[];
  receivedInterests: InterestRow[];
  onReceivedPress: (interest: InterestRow) => void;
}) {
  const [subTab, setSubTab] = useState<'sent' | 'received'>('received');

  return (
    <View style={styles.simpleScreen}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>bulletin.</Text>
        <Text style={styles.subtitle}>Explore your interests.</Text>
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
            <Handshake size={48} color="#A1A1AA" strokeWidth={1.5} />
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
                <UserRound size={40} color="#A1A1AA" strokeWidth={1.5} />
                <View style={styles.interestRowInfo}>
                  <Text numberOfLines={1} style={styles.interestRowName}>
                    {item.from_profile?.name ?? 'Unknown'}
                  </Text>
                  <Text numberOfLines={1} style={styles.interestRowMeta}>
                    @{item.from_profile?.username ?? 'unknown'}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )
      ) : sentInterests.length === 0 ? (
        <View style={styles.emptyState}>
          <Handshake size={48} color="#A1A1AA" strokeWidth={1.5} />
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
              <UserRound size={40} color="#A1A1AA" strokeWidth={1.5} />
              <View style={styles.interestRowInfo}>
                <Text numberOfLines={1} style={styles.interestRowName}>
                  {item.to_profile?.name ?? 'Unknown'}
                </Text>
                <Text numberOfLines={1} style={styles.interestRowMeta}>
                  {item.status === 'pending'
                    ? 'Pending'
                    : item.status === 'accepted'
                    ? 'Matched'
                    : 'Not interested'}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function MessagesScreen({
  matches,
  onMatchPress,
}: {
  matches: MatchStub[];
  onMatchPress: (match: MatchStub) => void;
}) {
  return (
    <View style={styles.simpleScreen}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>bulletin.</Text>
        <Text style={styles.subtitle}>Real conversations. No BS.</Text>
      </View>

      {matches.length === 0 ? (
        <View style={styles.emptyState}>
          <MessageCircle size={48} color="#A1A1AA" strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No messages yet.</Text>
          <Text style={styles.emptySubtitle}>
            Once you match with someone, your conversation shows up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.interestsList}
          renderItem={({ item }) => (
            <Pressable style={styles.interestRow} onPress={() => onMatchPress(item)}>
              <UserRound size={40} color="#A1A1AA" strokeWidth={1.5} />

              <View style={styles.interestRowInfo}>
                <Text numberOfLines={1} style={styles.interestRowName}>
                  {item.name}
                </Text>
                <Text numberOfLines={1} style={styles.interestRowMeta}>
                  {item.position} · {item.company}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function ChatScreen({
  match,
  messages,
  onSend,
  onBack,
}: {
  match: MatchStub;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState('');

  const handleSend = () => {
    if (!draft.trim()) return;
    onSend(draft);
    setDraft('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.chatContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.chatHeader}>
        <Pressable onPress={onBack} style={styles.chatBackButton}>
          <ArrowLeft size={22} color="#18181B" strokeWidth={2.2} />
        </Pressable>

        <View style={styles.chatHeaderInfo}>
          <Text numberOfLines={1} style={styles.chatHeaderName}>
            {match.name}
          </Text>
          <Text numberOfLines={1} style={styles.chatHeaderMeta}>
            {match.position} · {match.company}
          </Text>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatMessages}
        renderItem={({ item }) => (
          <View
            style={[
              styles.chatBubble,
              item.fromMe ? styles.chatBubbleMine : styles.chatBubbleTheirs,
            ]}
          >
            <Text
              style={[
                styles.chatBubbleText,
                item.fromMe && styles.chatBubbleTextMine,
              ]}
            >
              {item.text}
            </Text>
          </View>
        )}
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
          placeholderTextColor="#A1A1AA"
          multiline
        />

        <Pressable
          style={[styles.chatSendButton, !draft.trim() && styles.chatSendButtonDisabled]}
          onPress={handleSend}
          disabled={!draft.trim()}
        >
          <Send size={18} color="#FFFFFF" strokeWidth={2.4} />
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
  const [profile, setProfile] = useState<{
    name: string | null;
    username: string | null;
    avatar_url: string | null;
    is_recruiter: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

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

  const toggleRecruiterMode = async (value: boolean) => {
    setProfile((prev) => (prev ? { ...prev, is_recruiter: value } : prev));

    const { error } = await supabase
      .from('profiles')
      .update({ is_recruiter: value })
      .eq('id', session.user.id);

    if (error) {
      Alert.alert('Error', error.message);
      setProfile((prev) => (prev ? { ...prev, is_recruiter: !value } : prev));
    }
  };

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
          <Pencil size={16} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>

        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatarPreview} />
        ) : (
          <UserRound size={72} color="#A1A1AA" strokeWidth={1.5} />
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
        <View style={styles.accountActionRow}>
          <Handshake size={20} color="#71717A" strokeWidth={2} />
          <Text style={styles.accountActionText}>Recruiter Mode</Text>
          <Switch
            value={profile?.is_recruiter ?? false}
            onValueChange={toggleRecruiterMode}
          />
        </View>

        {profile?.is_recruiter && (
          <Pressable style={styles.accountActionRow} onPress={onManagePositions}>
            <BriefcaseBusiness size={20} color="#71717A" strokeWidth={2} />
            <Text style={styles.accountActionText}>Manage Positions</Text>
            <ChevronRight size={18} color="#A1A1AA" strokeWidth={2} />
          </Pressable>
        )}

        <Pressable style={styles.accountActionRow}>
          <Settings size={20} color="#71717A" strokeWidth={2} />
          <Text style={styles.accountActionText}>Settings</Text>
          <ChevronRight size={18} color="#A1A1AA" strokeWidth={2} />
        </Pressable>
      </View>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
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
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [certifications, setCertifications] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<{ uri: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExisting = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name, username, certifications, description, avatar_url, resume_url')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setName(data.name ?? '');
        setUsername(data.username ?? '');
        setCertifications(data.certifications ?? '');
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
          certifications: certifications.trim(),
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
              <ArrowLeft size={22} color="#18181B" strokeWidth={2.2} />
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
                  <UserRound size={40} color="#A1A1AA" strokeWidth={1.5} />
                )}
                <Text style={styles.avatarPickerText}>
                  {avatarUri ? 'Change photo' : 'Add profile photo'}
                </Text>
              </Pressable>

              <TextInput
                style={styles.authInput}
                placeholder="Name"
                placeholderTextColor="#A1A1AA"
                value={name}
                onChangeText={setName}
              />

              <TextInput
                style={styles.authInput}
                placeholder="Username"
                placeholderTextColor="#A1A1AA"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />

              <TextInput
                style={styles.authInput}
                placeholder="Certifications (e.g. EPA 608 Universal)"
                placeholderTextColor="#A1A1AA"
                value={certifications}
                onChangeText={setCertifications}
              />

              <TextInput
                style={[styles.authInput, styles.authTextArea]}
                placeholder="A bit about yourself"
                placeholderTextColor="#A1A1AA"
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

function AuthScreen() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
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
        ? await supabase.auth.signUp({ email: email.trim(), password })
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

        <TextInput
          style={styles.authInput}
          placeholder="Email"
          placeholderTextColor="#A1A1AA"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.authInput}
          placeholder="Password"
          placeholderTextColor="#A1A1AA"
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PositionsScreen({
  session,
  onBack,
}: {
  session: Session;
  onBack: () => void;
}) {
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [payRange, setPayRange] = useState('');
  const [location, setLocation] = useState('');
  const [workStyle, setWorkStyle] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
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
    setWorkStyle('');
    setExperienceLevel('');
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
    setWorkStyle(position.work_style ?? '');
    setExperienceLevel(position.experience_level ?? '');
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

    setSaving(true);

    const payload = {
      recruiter_id: session.user.id,
      title: title.trim(),
      company: company.trim(),
      pay_range: payRange.trim() || null,
      location: location.trim() || null,
      work_style: workStyle.trim() || null,
      experience_level: experienceLevel.trim() || null,
      description: description.trim() || null,
      skills,
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
              <ArrowLeft size={22} color="#18181B" strokeWidth={2.2} />
            </Pressable>

            <Text style={styles.logo}>bulletin.</Text>
            <Text style={styles.subtitle}>
              {editingId ? 'Edit position.' : 'Add a position.'}
            </Text>

            <TextInput
              style={styles.authInput}
              placeholder="Job title"
              placeholderTextColor="#A1A1AA"
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={styles.authInput}
              placeholder="Company"
              placeholderTextColor="#A1A1AA"
              value={company}
              onChangeText={setCompany}
            />

            <TextInput
              style={styles.authInput}
              placeholder="Pay range (e.g. $50k–$65k)"
              placeholderTextColor="#A1A1AA"
              value={payRange}
              onChangeText={setPayRange}
            />

            <TextInput
              style={styles.authInput}
              placeholder="Location"
              placeholderTextColor="#A1A1AA"
              value={location}
              onChangeText={setLocation}
            />

            <TextInput
              style={styles.authInput}
              placeholder="Work style (e.g. On-site, Hybrid)"
              placeholderTextColor="#A1A1AA"
              value={workStyle}
              onChangeText={setWorkStyle}
            />

            <TextInput
              style={styles.authInput}
              placeholder="Experience level (e.g. 2+ years)"
              placeholderTextColor="#A1A1AA"
              value={experienceLevel}
              onChangeText={setExperienceLevel}
            />

            <View style={styles.skillInputRow}>
              <TextInput
                style={[styles.authInput, styles.skillInput]}
                placeholder="Add a skill or requirement"
                placeholderTextColor="#A1A1AA"
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
                    <X size={12} color="#52525B" strokeWidth={2.4} />
                  </Pressable>
                ))}
              </View>
            )}

            <TextInput
              style={[styles.authInput, styles.authTextArea]}
              placeholder="Description"
              placeholderTextColor="#A1A1AA"
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
          <ArrowLeft size={22} color="#18181B" strokeWidth={2.2} />
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
          <BriefcaseBusiness size={48} color="#A1A1AA" strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No positions yet</Text>
          <Text style={styles.emptySubtitle}>
            Add an open position for candidates to discover.
          </Text>
          <Pressable
            style={[styles.refreshButton, { marginTop: 16, marginBottom: 12 }]}
            onPress={openAddForm}
          >
            <Text style={styles.refreshText}>Add Position</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={positions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.interestsList}
          ListHeaderComponent={
            <Pressable style={[styles.refreshButton, { marginTop: 0, marginBottom: 12 }]} onPress={openAddForm}>
              <Text style={styles.refreshText}>Add Position</Text>
            </Pressable>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.interestRow} onPress={() => openEditForm(item)}>
              <BriefcaseBusiness size={32} color="#A1A1AA" strokeWidth={1.5} />
              <View style={styles.interestRowInfo}>
                <Text numberOfLines={1} style={styles.interestRowName}>
                  {item.title}
                </Text>
                <Text numberOfLines={1} style={styles.interestRowMeta}>
                  {item.company}
                </Text>
              </View>
              <Pressable onPress={() => handleDelete(item.id)} style={{ padding: 6 }}>
                <X size={18} color="#EF4444" strokeWidth={2.2} />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function CardContent({ card }: { card: Card }) {
  return (
    <>
      {/* Recruiter profile */}
      <View style={styles.profileSection}>
        <UserRound
          size={92}
          color="#A1A1AA"
          strokeWidth={1.5}
        />

        <View style={styles.profileInfo}>
          <Text
            numberOfLines={1}
            style={styles.name}
          >
            {card.name}
          </Text>

          <View style={styles.recruiterMeta}>
            <Text
              numberOfLines={1}
              style={styles.recruiterTitle}
            >
              {card.title}
            </Text>

            <View style={styles.companyChip}>
              <Text style={styles.companyText}>
                {card.company}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Opportunity */}
      <View style={styles.content}>
        <Text style={styles.sectionLabel}>
          LOOKING FOR
        </Text>

        <View style={styles.positionRow}>
          <BriefcaseBusiness
            size={20}
            color="#18181B"
            strokeWidth={2.2}
          />

          <Text
            numberOfLines={1}
            style={styles.position}
          >
            {card.position}
          </Text>
        </View>

        <Text style={styles.pay}>
          {card.pay}
        </Text>

        <View style={styles.locationRow}>
          <MapPin
            size={15}
            color="#71717A"
            strokeWidth={2}
          />

          <Text
            numberOfLines={1}
            style={styles.location}
          >
            {card.location} · {card.workStyle}
          </Text>
        </View>

        <View style={styles.tags}>
          <Tag text={card.experience} />

          {card.skills.map((skill) => (
            <Tag
              key={skill}
              text={skill}
            />
          ))}
        </View>

        <Text style={styles.note}>
          “{card.note}”
        </Text>
      </View>
    </>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>
        {text}
      </Text>
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
              color={isActive ? '#18181B' : '#A1A1AA'}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F5F7',
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
    color: '#18181B',
  },

  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#71717A',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',

    borderWidth: 1,
    borderColor: '#E7E7EA',

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
    backgroundColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileInfo: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 18,
  },

  name: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: '#18181B',
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
    color: '#52525B',
  },

  companyChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  companyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#18181B',
  },

  content: {
    flex: 1,
    padding: 22,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#A1A1AA',
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
    color: '#18181B',
  },

  pay: {
    marginTop: 9,
    fontSize: 19,
    fontWeight: '700',
    color: '#27272A',
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
    color: '#71717A',
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
    backgroundColor: '#F4F4F5',
  },

  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#52525B',
  },

  note: {
    marginTop: 20,
    fontSize: 15,
    lineHeight: 22,
    color: '#52525B',
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
    borderColor: '#EF4444',
    transform: [{ rotate: '8deg' }],
  },

  interestedBadge: {
    left: 22,
    borderColor: '#22C55E',
    transform: [{ rotate: '-8deg' }],
  },

  passText: {
    color: '#EF4444',
    fontWeight: '900',
    fontSize: 15,
  },

  interestedText: {
    color: '#22C55E',
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

    backgroundColor: '#FFFFFF',

    borderWidth: 1,
    borderColor: '#E4E4E7',
  },

  interestedButton: {
    width: 70,
    height: 70,
    borderRadius: 35,

    backgroundColor: '#18181B',
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
    color: '#18181B',
  },

  emptySubtitle: {
    marginTop: 8,
    fontSize: 15,
    color: '#71717A',
    textAlign: 'center',
  },

  refreshButton: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,

    borderRadius: 14,
    backgroundColor: '#18181B',
  },

  refreshText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E7E7EA',
    backgroundColor: '#FFFFFF',
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
    color: '#A1A1AA',
  },

  tabLabelActive: {
    color: '#18181B',
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
    color: '#18181B',
  },

  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#18181B',
    marginTop: 8,
  },

  profileSubtext: {
    fontSize: 14,
    color: '#71717A',
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
    backgroundColor: '#F4F4F5',
    marginTop: 2,
  },

  interestCounterText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#18181B',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E7EA',
  },

  interestRowInfo: {
    flex: 1,
  },

  interestRowName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#18181B',
  },

  interestRowMeta: {
    marginTop: 2,
    fontSize: 13,
    color: '#71717A',
  },

  subTabBar: {
    flexDirection: 'row',
    marginHorizontal: 22,
    marginBottom: 12,
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#F4F4F5',
  },

  subTabItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },

  subTabItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },

  subTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#71717A',
  },

  subTabTextActive: {
    color: '#18181B',
  },

  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },

  badgeText: {
    color: '#FFFFFF',
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
    borderBottomColor: '#E7E7EA',
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
    color: '#18181B',
  },

  chatHeaderMeta: {
    marginTop: 1,
    fontSize: 12,
    color: '#71717A',
  },

  chatMessages: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
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
    backgroundColor: '#18181B',
    borderBottomRightRadius: 4,
  },

  chatBubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#F4F4F5',
    borderBottomLeftRadius: 4,
  },

  chatBubbleText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#18181B',
  },

  chatBubbleTextMine: {
    color: '#FFFFFF',
  },

  chatEmptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
    color: '#A1A1AA',
  },

  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E7E7EA',
    backgroundColor: '#FFFFFF',
  },

  chatInput: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F4F4F5',
    fontSize: 15,
    color: '#18181B',
  },

  chatSendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  chatSendButtonDisabled: {
    backgroundColor: '#D4D4D8',
  },

  authContainer: {
    flex: 1,
    backgroundColor: '#F5F5F7',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E7EA',
    fontSize: 15,
    color: '#18181B',
    marginTop: 8,
  },

  authButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#18181B',
    alignItems: 'center',
  },

  authButtonDisabled: {
    backgroundColor: '#A1A1AA',
  },

  authButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },

  authLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F7',
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
    borderColor: '#EF4444',
    alignItems: 'center',
  },

  signOutText: {
    color: '#EF4444',
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
    color: '#71717A',
  },

  authTextArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },

  resumePicker: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E7EA',
  },

  resumePickerText: {
    fontSize: 15,
    color: '#71717A',
  },

  profileCard: {
    marginTop: 24,
    marginHorizontal: 22,
    padding: 28,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E7EA',
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
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  accountActions: {
    marginTop: 16,
    marginHorizontal: 22,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E7EA',
    overflow: 'hidden',
  },

  accountActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F1',
  },

  accountActionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#18181B',
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
    backgroundColor: '#18181B',
  },

  skillAddButtonText: {
    color: '#FFFFFF',
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
    backgroundColor: '#F4F4F5',
  },

  skillTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#52525B',
  },
});