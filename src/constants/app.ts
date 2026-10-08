import { Dimensions } from 'react-native';

export const { width } = Dimensions.get('window');

export const CARD_WIDTH = width - 36;
export const SWIPE_THRESHOLD = width * 0.28;
export const SWIPE_DISTANCE = width * 1.4;
export const SWIPE_VELOCITY = 400;
export const MAX_INTERESTS = 10;
