import { Check, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  Dimensions,
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
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.3;
const CARDS = [1, 2, 3, 4, 5];

export default function Index() {
  const [cards, setCards] = useState(CARDS);
  const translateX = useSharedValue(0);

  const removeCard = () => {
    setCards((prev) => prev.slice(1));
    translateX.value = 0;
  };

  const swipe = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        translateX.value = withSpring(
          Math.sign(e.translationX) * width * 1.5,
          {},
          () => runOnJS(removeCard)()
        );
      } else {
        translateX.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      {
        rotate: `${interpolate(
          translateX.value,
          [-width / 2, 0, width / 2],
          [-8, 0, 8]
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

  const applyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      'clamp'
    ),
  }));

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <Text style={styles.logo}>bulletin</Text>

        <View style={styles.deck}>
          {cards.length ? (
            <GestureDetector gesture={swipe}>
              <Animated.View style={[styles.card, cardStyle]}>
                <Animated.Text
                  style={[styles.badge, styles.pass, passStyle]}
                >
                  PASS
                </Animated.Text>

                <Animated.Text
                  style={[styles.badge, styles.apply, applyStyle]}
                >
                  APPLY
                </Animated.Text>

                <Text style={styles.placeholder}>Card #{cards[0]}</Text>
              </Animated.View>
            </GestureDetector>
          ) : (
            <Text style={styles.empty}>Deck Empty</Text>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.button}>
            <X size={26} color="#FF3B30" />
          </Pressable>

          <Pressable style={styles.button}>
            <Check size={26} color="#34C759" />
          </Pressable>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F8',
  },

  logo: {
    fontSize: 26,
    fontWeight: '900',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },

  deck: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  card: {
    width: width - 32,
    height: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },

  placeholder: {
    fontSize: 18,
    fontWeight: '600',
    color: '#A0A0A0',
  },

  badge: {
    position: 'absolute',
    top: 24,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    fontWeight: '800',
  },

  pass: {
    right: 24,
    color: '#FF3B30',
    borderColor: '#FF3B30',
  },

  apply: {
    left: 24,
    color: '#34C759',
    borderColor: '#34C759',
  },

  empty: {
    color: '#8E8E93',
    fontWeight: '500',
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingBottom: 20,
  },

  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
});