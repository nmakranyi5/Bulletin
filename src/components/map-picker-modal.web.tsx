import { LocateFixed, Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../../lib/app-theme';
import { Coords, coordLabel, isValidCoords, reversePlace, roundedCoords, searchPlace } from '../../lib/geo';
import { MapCommand, mapHtml, parseMapMessage } from '../../lib/map-html';
import { useSharedStyles } from '../styles/shared';

type Place = { text: string; lat: number | null; lng: number | null };

// The web's version of the location picker (phones use native maps, see
// map-picker-modal.tsx): a Leaflet map on OpenStreetMap in an iframe, with the same
// search, "my location" and place-name lookup.
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
  const frame = useRef<HTMLIFrameElement>(null);
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
    if (moveMap) {
      const command: MapCommand = { type: 'pin', lat: coords.latitude, lng: coords.longitude, zoom: 12 };
      (frame.current?.contentWindow as any)?.__cmd?.(command);
    }
  };
  const dropRef = useRef(drop);
  dropRef.current = drop;

  // Taps and drags inside the map arrive as messages from the iframe.
  useEffect(() => {
    if (!visible) return;
    const listen = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const m = parseMapMessage(e.data);
      if (m) dropRef.current({ latitude: m.lat, longitude: m.lng });
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, [visible]);

  const search = async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    try {
      const hit = await searchPlace(q);
      if (!hit) Alert.alert('Not found', "We couldn't find that place. Try a city and state, or an address.");
      else drop(hit, true);
    } catch {
      Alert.alert('Search failed', 'Check your connection and try again, or click the map instead.');
    }
    setSearching(false);
  };

  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      Alert.alert('Not available', 'This browser can\'t share your location. Click the map instead.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => drop({ latitude: p.coords.latitude, longitude: p.coords.longitude }, true),
      () =>
        Alert.alert(
          "Couldn't find you",
          'Allow location access for this site, or click the map to drop a pin.'
        ),
      { timeout: 10_000 }
    );
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={local.overlay}>
        <View style={local.card}>
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
            <iframe
              ref={frame}
              srcDoc={html}
              title="Map"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            />
            <Pressable style={local.locateButton} onPress={useMyLocation} accessibilityLabel="Use my location">
              <LocateFixed size={20} color={c.text} strokeWidth={2.2} />
            </Pressable>
          </View>

          <View style={local.footer}>
            <Text style={[local.picked, !pin && { color: c.muted }]} numberOfLines={2}>
              {!pin ? 'Click the map to drop a pin' : looking ? 'Finding the place name...' : label}
            </Text>
            <Pressable
              style={[shared.authButton, (!pin || looking) && shared.authButtonDisabled]}
              onPress={confirm}
              disabled={!pin || looking}
            >
              <Text style={shared.authButtonText}>Use this location</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
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
