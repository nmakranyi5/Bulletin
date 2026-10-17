import { LocateFixed, Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../../lib/app-theme';
import {
  Coords,
  coordLabel,
  isValidCoords,
  reversePlace,
  roundedCoords,
  searchPlace,
} from '../../lib/geo';
import { mapHtml } from '../../lib/map-html';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useSharedStyles } from '../styles/shared';
import { currentPosition } from './current-position';
import { MapSurface, MapSurfaceHandle } from './map-surface';

type Place = { text: string; lat: number | null; lng: number | null };

// The location picker for Android and the web (iOS uses Apple Maps, see
// map-picker-modal.ios.tsx): a Leaflet map on OpenStreetMap, so no Google Maps key is
// needed. Search and place names come from OpenStreetMap's Nominatim.
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
  const { colors: c, mode } = useTheme();
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const map = useRef<MapSurfaceHandle>(null);
  const [pin, setPin] = useState<Coords | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  // Ignores a slow lookup that finishes after the pin has moved again.
  const lookupId = useRef(0);

  const startPin = isValidCoords(initial.lat, initial.lng)
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
      text = await reversePlace(coords);
    } catch {
      // Offline or rate limited: fall back to the coordinates below.
    }
    if (id !== lookupId.current) return;
    setLabel(text ?? coordLabel(coords));
    setLooking(false);
  };

  const drop = (coords: Coords, moveMap = false) => {
    setPin(coords);
    lookUp(coords);
    // Searches and "my location" move the map's pin; taps and drags already did.
    if (moveMap)
      map.current?.send({ type: 'pin', lat: coords.latitude, lng: coords.longitude, zoom: 12 });
  };

  const search = async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    try {
      const hit = await searchPlace(q);
      if (!hit)
        Alert.alert(
          'Not found',
          "We couldn't find that place. Try a city and state, or an address."
        );
      else drop(hit, true);
    } catch {
      Alert.alert('Search failed', 'Check your connection and try again, or tap the map instead.');
    }
    setSearching(false);
  };

  const useMyLocation = async () => {
    try {
      drop(await currentPosition(), true);
    } catch {
      Alert.alert("Couldn't find you", 'Allow location access, or tap the map to drop a pin.');
    }
  };

  const confirm = () => {
    if (!pin || !label || looking) return;
    const { lat, lng } = roundedCoords(pin.latitude, pin.longitude);
    onPick({ text: label, lat, lng });
  };

  // Built once per opening; later changes go into the page as commands.
  const html = useMemo(
    () => mapHtml({ pin: startPin, dark: mode === 'dark', background: c.surfaceAlt }),
    [visible, mode]
  );

  const content = (
    <>
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
        {visible && (
          <MapSurface
            ref={map}
            html={html}
            onMessage={(m) => drop({ latitude: m.lat, longitude: m.lng })}
          />
        )}
        <Pressable
          style={local.locateButton}
          onPress={useMyLocation}
          accessibilityLabel="Use my location"
        >
          <LocateFixed size={20} color={c.text} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={local.footer}>
        <Text style={[local.picked, !pin && { color: c.muted }]} numberOfLines={2}>
          {!pin ? 'Tap the map to drop a pin' : looking ? 'Finding the place name...' : label}
        </Text>
        <Pressable
          style={[shared.authButton, (!pin || looking) && shared.authButtonDisabled]}
          onPress={confirm}
          disabled={!pin || looking}
        >
          <Text style={shared.authButtonText}>Use this location</Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent={Platform.OS === 'web'}
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={onCancel}
    >
      {Platform.OS === 'web' ? (
        <View style={local.overlay}>
          <View style={local.card}>{content}</View>
        </View>
      ) : (
        // A Modal is a separate native window, so it needs its own insets provider.
        <SafeAreaProvider>
          <SafeAreaView style={local.screen}>{content}</SafeAreaView>
        </SafeAreaProvider>
      )}
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

        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        },

        card: {
          width: '100%',
          maxWidth: 560,
          height: '100%',
          maxHeight: 720,
          backgroundColor: c.bg,
          borderRadius: 24,
          overflow: 'hidden',
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
