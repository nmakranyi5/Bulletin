export const SWIPE_VELOCITY = 400;
export const MAX_INTERESTS = 10;

// On wide screens (the web) the app is shown as a phone-sized column in the middle, so
// nothing stretches. Everything that sizes itself from the screen width uses this cap.
export const APP_MAX_WIDTH = 520;

// Cards never get wider than this (tablets, landscape, split view).
export const CARD_MAX_WIDTH = 460;
// Windows shorter than this (iPhone SE class) get the compact card layout.
export const COMPACT_HEIGHT = 740;

// Swipe distances scale with the window, so compute them from the live width.
export function swipeMetrics(width: number) {
  return { threshold: width * 0.28, distance: width * 1.4 };
}
