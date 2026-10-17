import * as Location from 'expo-location';
import { LocateFixed, Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/app-theme';
import {
  Coords,
  DEFAULT_REGION,
  coordLabel,
  isValidCoords,
  placeLabel,
  regionAround,
  roundedCoords,
} from '../../lib/geo';
import { useSharedStyles } from '../styles/shared';

type Place = { text: string; lat: number | null; lng: number | null };

// Full-screen map for choosing a location: tap (or drag the pin) to drop it, search for a
// town or address, or jump to where you are. The pin's place name is looked up for you.
export function MapPickerModal({
  visible,
  initial,
  onCancel,
  onPick,
}: {
  visible: boolean;
  initial: Place;
  onCancel: () => void;
  onPick: (place: Place) => void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const map = useRef<MapView>(null);
  const [pin, setPin] = useState<Coords | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  // Ignores a slow lookup that finishes after the pin has moved again.
  const lookupId = useRef(0);

  const startPin =
    isValidCoords(initial.lat, initial.lng)
      ? { latitude: initial.lat as number, longitude: initial.lng as number }
      : null;

  useEffect(() => {
    if (!visible) return;
    setPin(startPin);
    setLabel(startPin ? initial.text || null : null);
    setQuery('');
    setSearching(false);
  }, [visible]);

  const lookUp = async (coords: Coords) => {
    const id = ++lookupId.current;
    setLooking(true);
    setLabel(null);
    let text: string | null = null;
    try {
      const [address] = await Location.reverseGeocodeAsync(coords);
      text = placeLabel(address);
    } catch {
      // Offline or no geocoder: fall back to the coordinates below.
    }
    if (id !== lookupId.current) return;
    setLabel(text ?? coordLabel(coords));
    setLooking(false);
  };

  const drop = (coords: Coords, zoom = false) => {
    setPin(coords);
    lookUp(coords);
    if (zoom) map.current?.animateToRegion(regionAround(coords), 400);
  };

  const search = async () => {
    const q = query.trim();
    if (!q || searching) return;
    Keyboard.dismiss();
    setSearching(true);
    try {
      const [hit] = await Location.geocodeAsync(q);
      if (!hit) {
        Alert.alert('Not found', 'We couldn\'t find that place. Try a city and state, or an address.');
      } else {
        drop({ latitude: hit.latitude, longitude: hit.longitude }, true);
      }
    } catch {
      Alert.alert('Search failed', 'Check your connection and try again, or tap the map instead.');
    }
    setSearching(false);
  };

  const useMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location off', 'Allow location access in Settings, or tap the map instead.');
        return;
      }
      const here = await Location.getCurrentPositionAsync({});
      drop({ latitude: here.coords.latitude, longitude: here.coords.longitude }, true);
    } catch {
      Alert.alert('Couldn\'t find you', 'Try again, or tap the map to drop a pin.');
    }
  };

  const confirm = () => {
    if (!pin || !label || looking) return;
    const { lat, lng } = roundedCoords(pin.latitude, pin.longitude);
    onPick({ text: label, lat, lng });
  };

  const initialRegion: Region = startPin ? regionAround(startPin) : DEFAULT_REGION;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={local.screen}>
        <View style={local.header}>
          <Text style={local.title}>Pick a location</Text>
          <Pressable onPress={onCancel} hitSlop={10} accessibilityLabel="Close">
            <X size={22} color={c.text} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={local.searchRow}>
          <Search size={18} color={c.textSecondary} strokeWidth={2.2} />
          <TextInput
            style={local.searchInput}
            placeholder="Search a city or address"
            placeholderTextColor={c.muted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            returnKeyType="search"
          />
          {searching && <ActivityIndicator color={c.muted} />}
        </View>

        <View style={local.mapWrap}>
          <MapView
            ref={map}
            style={StyleSheet.absoluteFill}
            initialRegion={initialRegion}
            onPress={(e) => drop(e.nativeEvent.coordinate)}
          >
            {pin && (
              <Marker
                coordinate={pin}
                draggable
                onDragEnd={(e) => drop(e.nativeEvent.coordinate)}
              />
            )}
          </MapView>

          <Pressable style={local.locateButton} onPress={useMyLocation} accessibilityLabel="Use my location">
            <LocateFixed size={20} color={c.text} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={local.footer}>
          <Text style={[local.picked, !pin && { color: c.muted }]} numberOfLines={2}>
            {!pin
              ? 'Tap the map to drop a pin'
              : looking
              ? 'Finding the place name...'
              : label}
          </Text>
          <Pressable
            style={[shared.authButton, (!pin || looking) && shared.authButtonDisabled]}
            onPress={confirm}
            disabled={!pin || looking}
          >
            <Text style={shared.authButtonText}>Use this location</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          backgroundColor: c.bg,
        },

        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
        },

        title: {
          fontSize: 18,
          fontWeight: '800',
          color: c.text,
        },

        searchRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginHorizontal: 16,
          marginBottom: 12,
          paddingHorizontal: 14,
          borderRadius: 14,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
        },

        searchInput: {
          flex: 1,
          paddingVertical: 13,
          fontSize: 15,
          color: c.text,
        },

        mapWrap: {
          flex: 1,
          overflow: 'hidden',
        },

        locateButton: {
          position: 'absolute',
          right: 14,
          bottom: 14,
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
        },

        footer: {
          gap: 12,
          padding: 16,
          backgroundColor: c.surface,
          borderTopWidth: 1,
          borderTopColor: c.border,
        },

        picked: {
          fontSize: 16,
          fontWeight: '700',
          color: c.text,
        },
      }),
    [c]
  );
}
