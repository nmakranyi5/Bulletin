// The first-run tour: what each step says. Kept free of React so the copy and its
// structure can be tested on its own (see src/features/tutorial for the screens).

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
  const welcome: TourStep = {
    key: 'welcome',
    tab: 'discover',
    title: 'Welcome to bulletin.',
    body: isRecruiter
      ? 'Find HVAC techs who fit your open jobs, and actually hear back. Here is how it works.'
      : 'Find HVAC shops that fit you, and actually hear back. Here is how it works.',
    points: ['It takes about a minute.', 'You can replay it any time from Profile > Settings.'],
  };

  const discover: TourStep = isRecruiter
    ? {
        key: 'discover',
        tab: 'discover',
        title: 'Discover: find techs',
        body: 'Each card is a tech. Tap it to see their certifications, experience, schedule and resume.',
        points: [
          'Swipe right, or tap the check, to show interest. Pick which of your positions it is for.',
          'Swipe left, or tap the X, to pass.',
          `You can have ${interestSlots} interests out at once. A slot comes back when they answer.`,
        ],
      }
    : {
        key: 'discover',
        tab: 'discover',
        title: 'Discover: find shops',
        body: 'Each card is a company with an open job. Tap it to see pay, schedule and what they need.',
        points: [
          'Swipe right, or tap the check, to show interest in a job.',
          'Swipe left, or tap the X, to pass.',
          `You can have ${interestSlots} interests out at once. A slot comes back when they answer.`,
        ],
      };

  const interests: TourStep = {
    key: 'interests',
    tab: 'interests',
    title: 'Interests: who is waiting',
    body: 'Received is people who want to talk to you. Sent is the interests you have sent.',
    points: [
      'Tap anyone to see their full card, then Accept or Decline.',
      'Declining asks for a reason, so nobody is left guessing.',
      'Accept, and it becomes a chat.',
    ],
  };

  const messages: TourStep = {
    key: 'messages',
    tab: 'messages',
    title: 'Messages: your chats',
    body: 'Accepted interests land here. The red number on the tab is your unread messages.',
    points: [
      'You and your match agree on a reply time, from your profile settings (1 to 5 days). Urgent jobs start faster, and either of you can ask to change it in the chat.',
      'Tap the X in a chat to close it. Say why: a deal, or not moving forward.',
      'Closed chats move to Archived, and you can still read them.',
    ],
  };

  const profile: TourStep = isRecruiter
    ? {
        key: 'profile',
        tab: 'profile',
        title: 'Profile: you and your jobs',
        body: 'Your company details, and the home of your job postings.',
        points: [
          'Manage Positions is where you post jobs: pay, schedule, urgency and a hire-by date.',
          'When a hire-by date passes, the position closes on its own and people waiting get their interest back.',
          'Your rating starts at 5.0 and reflects how quickly you reply.',
        ],
      }
    : {
        key: 'profile',
        tab: 'profile',
        title: 'Profile: you',
        body: 'What shops see when they open your card.',
        points: [
          'Edit your certifications, experience, location and resume any time.',
          'Your rating starts at 5.0 and reflects how quickly you reply.',
          'Settings has dark mode, and lets you replay this tour.',
        ],
      };

  const loop: TourStep = {
    key: 'loop',
    tab: 'discover',
    title: 'The whole loop',
    body: isRecruiter
      ? 'Discover a tech, send interest, they accept, you chat, and you close it with a deal or a reason.'
      : 'Discover a job, send interest, they accept, you chat, and you close it with a deal or a reason.',
    points: [
      'Reply on time and your rating stays high. Miss deadlines and it drops.',
      'Nothing is closed on you for being slow. The timers just keep everyone honest.',
    ],
  };

  return [welcome, discover, interests, messages, profile, loop];
}
