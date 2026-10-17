import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

// 'offer'  = new account, hasn't answered "take the tour?" yet
// 'done'   = took it or skipped it
// (no value = existing account: never offered, but can replay from Settings)
const key = (userId: string) => `bulletin.tutorial.${userId}`;

// Called when someone finishes first-time setup, so the app offers the tour once.
export async function markTutorialOffer(userId: string) {
  try {
    await AsyncStorage.setItem(key(userId), 'offer');
  } catch {
    // Storage unavailable: they just won't be offered the tour.
  }
}

export type TutorialStage = 'idle' | 'offer' | 'tour';

export function useTutorial(userId: string) {
  const [stage, setStage] = useState<TutorialStage>('idle');
  const [step, setStep] = useState(0);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key(userId))
      .then((value) => {
        if (alive && value === 'offer') setStage('offer');
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

  const remember = () => AsyncStorage.setItem(key(userId), 'done').catch(() => {});

  const start = useCallback(() => {
    setStep(0);
    setStage('tour');
  }, []);

  // Skipping or finishing: either way, don't offer it again.
  const close = useCallback(() => {
    remember();
    setStage('idle');
  }, [userId]);

  return { stage, step, setStep, start, close };
}
