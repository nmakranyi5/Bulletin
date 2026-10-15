import { Check, Handshake, X } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useTheme } from '../../../lib/app-theme';
import { CARD_WIDTH, width } from '../../constants/app';
import { useSharedStyles } from '../../styles/shared';
import { RecruiterCardContent } from './recruiter-card';
import { WorkerCardContent } from './worker-card';

export function DiscoverScreen({
  cards,
  topCard,
  cardStyle,
  passStyle,
  interestedStyle,
  gesture,
  buttonSwipe,
  expandedCardId,
  onCollapse,
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
  expandedCardId: string | null;
  onCollapse: () => void;
  onRefresh: () => void;
  interestsRemaining: number;
  isRecruiter: boolean;
  me: any;
  loading: boolean;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  return (
    <>
      {/* Header */}
      <View style={local.header}>
        <View style={local.headerTop}>
          <View>
            <Text style={shared.logo}>bulletin.</Text>
            <Text style={shared.subtitle}>
              {isRecruiter ? 'Find your next hire.' : 'Find your next opportunity.'}
            </Text>
          </View>

          <View style={local.interestCounter}>
            <Handshake size={14} color={c.text} strokeWidth={2.4} />
            <Text style={local.interestCounterText}>{interestsRemaining}</Text>
          </View>
        </View>
      </View>

      {/* Deck */}
      <View style={local.deck}>
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
                      style={local.card}
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
                    <Animated.View style={[local.card, cardStyle]}>
                      {/* Pass badge */}
                      <Animated.View
                        style={[
                          local.swipeBadge,
                          local.passBadge,
                          passStyle,
                        ]}
                      >
                        <Text style={local.passText}>PASS</Text>
                      </Animated.View>

                      {/* Interested badge */}
                      <Animated.View
                        style={[
                          local.swipeBadge,
                          local.interestedBadge,
                          interestedStyle,
                        ]}
                      >
                        <Text style={local.interestedText}>
                          INTERESTED
                        </Text>
                      </Animated.View>

                      {isRecruiter ? (
                        <WorkerCardContent
                          candidate={card}
                          expanded={expandedCardId === card.id}
                          onCollapse={onCollapse}
                        />
                      ) : (
                        <RecruiterCardContent
                          recruiter={card}
                          me={me}
                          expanded={expandedCardId === card.id}
                          onCollapse={onCollapse}
                        />
                      )}
                    </Animated.View>
                  </GestureDetector>
                );
              })}
          </>
        ) : (
          <View style={shared.emptyState}>
            <Text style={shared.emptyTitle}>
              {loading ? 'Loading...' : "You're all caught up."}
            </Text>

            {!loading && (
              <Text style={shared.emptySubtitle}>
                {isRecruiter
                  ? 'No more candidates right now.'
                  : 'No more open positions right now.'}
              </Text>
            )}

            <Pressable
              style={shared.refreshButton}
              onPress={onRefresh}
            >
              <Text style={shared.refreshText}>
                Refresh
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Actions */}
      {topCard && (
        <View style={local.actions}>
          <Pressable
            style={[local.actionButton, local.passButton]}
            onPress={() => buttonSwipe(-1)}
          >
            <X
              size={28}
              color={c.danger}
              strokeWidth={2.6}
            />
          </Pressable>

          <Pressable
            style={[local.actionButton, local.interestedButton]}
            onPress={() => buttonSwipe(1)}
          >
            <Check
              size={30}
              color={c.onAccent}
              strokeWidth={2.7}
            />
          </Pressable>
        </View>
      )}
    </>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        header: {
          paddingHorizontal: 22,
          paddingTop: 8,
          paddingBottom: 14,
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
      }),
    [c]
  );
}
