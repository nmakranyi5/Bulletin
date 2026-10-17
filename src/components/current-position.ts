import * as Location from 'expo-location';
import { Coords } from '../../lib/geo';

// Where the phone is right now; throws if permission is refused or it can't tell.
export async function currentPosition(): Promise<Coords> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('denied');
  const here = await Location.getCurrentPositionAsync({});
  return { latitude: here.coords.latitude, longitude: here.coords.longitude };
}
