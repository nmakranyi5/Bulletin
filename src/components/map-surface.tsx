import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { MapCommand, MapMessage, parseMapMessage } from '../../lib/map-html';

export type MapSurfaceHandle = { send: (command: MapCommand) => void };

// The Leaflet map (see lib/map-html.ts) shown in a WebView, for Android.
export const MapSurface = forwardRef<
  MapSurfaceHandle,
  { html: string; onMessage: (message: MapMessage) => void }
>(function MapSurface({ html, onMessage }, ref) {
  const web = useRef<WebView>(null);

  useImperativeHandle(ref, () => ({
    send: (command) =>
      web.current?.injectJavaScript(`window.__cmd(${JSON.stringify(command)}); true;`),
  }));

  return (
    <WebView
      ref={web}
      style={StyleSheet.absoluteFill}
      originWhitelist={['*']}
      // OpenStreetMap's tile servers expect a Referer, which the base URL provides.
      source={{ html, baseUrl: 'https://bulletin.app' }}
      javaScriptEnabled
      onMessage={(e) => {
        const message = parseMapMessage(e.nativeEvent.data);
        if (message) onMessage(message);
      }}
    />
  );
});
