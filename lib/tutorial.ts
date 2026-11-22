// The first-run tour: what each step says. Kept free of React so the copy and its
// structure can be tested on its own (see src/features/tutorial for the screens).

import { t } from './i18n/core';

export type TourTab = 'discover' | 'interests' | 'messages' | 'profile';

export type TourStep = {
  key: string;
  // The tab shown behind the card for this step; null leaves whatever is open.
  tab: TourTab | null;
  title: string;
  body: string;
  points: string[];
};

export function tourSteps(isRecruiter: boolean, interestSlots: number): TourStep[] {
  const slots = t('tour.discover.slots', { slots: interestSlots });

  const welcome: TourStep = {
    key: 'welcome',
    tab: 'discover',
    title: t('tour.welcome.title'),
    body: isRecruiter ? t('tour.welcome.bodyRecruiter') : t('tour.welcome.bodySeeker'),
    points: [t('tour.welcome.p1'), t('tour.welcome.p2')],
  };

  const discover: TourStep = isRecruiter
    ? {
        key: 'discover',
        tab: 'discover',
        title: t('tour.discoverR.title'),
        body: t('tour.discoverR.body'),
        points: [t('tour.discoverR.p1'), t('tour.discover.pass'), slots],
      }
    : {
        key: 'discover',
        tab: 'discover',
        title: t('tour.discoverS.title'),
        body: t('tour.discoverS.body'),
        points: [t('tour.discoverS.p1'), t('tour.discover.pass'), slots],
      };

  const interests: TourStep = {
    key: 'interests',
    tab: 'interests',
    title: t('tour.interests.title'),
    body: t('tour.interests.body'),
    points: [t('tour.interests.p1'), t('tour.interests.p2'), t('tour.interests.p3')],
  };

  const messages: TourStep = {
    key: 'messages',
    tab: 'messages',
    title: t('tour.messages.title'),
    body: t('tour.messages.body'),
    points: [t('tour.messages.p1'), t('tour.messages.p2'), t('tour.messages.p3')],
  };

  const profile: TourStep = isRecruiter
    ? {
        key: 'profile',
        tab: 'profile',
        title: t('tour.profileR.title'),
        body: t('tour.profileR.body'),
        points: [t('tour.profileR.p1'), t('tour.profileR.p2'), t('tour.profile.rating')],
      }
    : {
        key: 'profile',
        tab: 'profile',
        title: t('tour.profileS.title'),
        body: t('tour.profileS.body'),
        points: [t('tour.profileS.p1'), t('tour.profile.rating'), t('tour.profileS.p3')],
      };

  const loop: TourStep = {
    key: 'loop',
    tab: 'discover',
    title: t('tour.loop.title'),
    body: isRecruiter ? t('tour.loop.bodyRecruiter') : t('tour.loop.bodySeeker'),
    points: [t('tour.loop.p1'), t('tour.loop.p2')],
  };

  return [welcome, discover, interests, messages, profile, loop];
}
