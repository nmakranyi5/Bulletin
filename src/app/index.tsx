import {
  BriefcaseBusiness,
  Check,
  Handshake,
  MapPin,
  MessageCircle,
  Search,
  Settings,
  UserRound,
  X
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
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
];

type Card = (typeof DUMMY_CARDS)[number];

type TabKey = 'discover' | 'interests' | 'messages' | 'profile';

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
  const [interestedCards, setInterestedCards] = useState<Card[]>([]);

  const translateX = useSharedValue(0);
  const cardOpacity = useSharedValue(1);

  const topCard = cards[0];
  const interestsRemainingSV = useSharedValue(interestsRemaining);

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

  /*
   * JS-side state update.
   * This is only called through runOnJS from gesture animations.
   */
  const removeTopCard = (interested: number) => {
    if (interested > 0 && topCard) {
      setInterestedCards((prev) => [...prev, topCard]);
    }

    setCards((prev) => prev.slice(1));

    if (interested > 0) {
      setInterestsRemaining((prev) => (prev > 0 ? prev - 1 : prev));
    }
  };

  const removeInterest = (card: Card) => {
    setInterestedCards((prev) => prev.filter((c) => c.id !== card.id));
    setInterestsRemaining((prev) => Math.min(prev + 1, MAX_INTERESTS));
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

  const handleInterestPress = (card: Card) => {
    Alert.alert(
      card.name,
      'Keep this interest, or remove it and get your point back?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeInterest(card),
        },
        { text: 'Keep', style: 'default' },
      ]
    );
  };

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
            interestedCards={interestedCards}
            onInterestPress={handleInterestPress}
          />
        )}
        {activeTab === 'messages' && <MessagesScreen />}
        {activeTab === 'profile' && <ProfileScreen />}
      </SafeAreaView>

      {/* Tab bar — outside SafeAreaView so it sits flush at the true bottom edge */}
      <TabBar activeTab={activeTab} onTabPress={setActiveTab} />
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
    interestedCards,
    onInterestPress,
  }: {
    interestedCards: Card[];
    onInterestPress: (card: Card) => void;
  }) {
  return (
    <View style={styles.simpleScreen}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>bulletin.</Text>
        <Text style={styles.subtitle}>Explore your interests.</Text>
      </View>

      {interestedCards.length === 0 ? (
        <View style={styles.emptyState}>
          <Handshake size={48} color="#A1A1AA" strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No interests yet</Text>
          <Text style={styles.emptySubtitle}>
            Swipe right on Discover to start expressing interest.
          </Text>
        </View>
      ) : (
        <FlatList
          data={interestedCards}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.interestsList}
          renderItem={({ item }) => (
            <Pressable
              style={styles.interestRow}
              onPress={() => onInterestPress(item)}
            >
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

function MessagesScreen() {
  return (
    <View style={styles.simpleScreen}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>bulletin.</Text>
        <Text style={styles.subtitle}>Real conversations. No BS.</Text>
      </View>

      <View style={styles.emptyState}>
        <MessageCircle size={48} color="#A1A1AA" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>No messages yet</Text>
        <Text style={styles.emptySubtitle}>
          Once you match with someone, your conversation shows up here.
        </Text>
      </View>
    </View>
  );
}

function ProfileScreen() {
  return (
    <View style={styles.simpleScreen}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>bulletin.</Text>
        <Text style={styles.subtitle}>Manage your account.</Text>
      </View>

      <View style={styles.profileCard}>
        <UserRound size={72} color="#A1A1AA" strokeWidth={1.5} />
        <Text style={styles.profileName}>Your Name</Text>
        <Text style={styles.profileSubtext}>Complete your profile</Text>
      </View>

      <View style={styles.profileCard}>
        <Settings size={72} color="#A1A1AA" strokeWidth={1.5} />
        <Text style={styles.profileName}>Settings</Text>
        <Text style={styles.profileSubtext}>Manage your account settings</Text>
      </View>
    </View>
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
}: {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
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
          <Icon
            size={24}
            color={isActive ? '#18181B' : '#A1A1AA'}
            strokeWidth={isActive ? 2.4 : 2}
          />
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

  profileCard: {
    marginTop: 40,
    marginHorizontal: 22,
    padding: 28,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E7EA',
    alignItems: 'center',
    gap: 6,
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
});