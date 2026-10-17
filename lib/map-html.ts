// The map shown in the location picker: a Leaflet map on OpenStreetMap tiles, as a small
// self-contained page. Phones show it in a WebView and the web in an iframe, so there is
// one map for every platform and no API key.
//
// It talks to the app with JSON messages:
//   page -> app: { type: 'tap' | 'drag', lat, lng }   (the pin was placed / moved)
//   app -> page: window.__cmd({ type: 'pin', lat, lng, zoom? })

import { Coords, DEFAULT_REGION } from './geo';

export type MapMessage = { type: 'tap' | 'drag'; lat: number; lng: number };
export type MapCommand = { type: 'pin'; lat: number; lng: number; zoom?: number };

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';

export function mapHtml({
  pin,
  dark,
  background,
}: {
  pin: Coords | null;
  dark: boolean;
  background: string;
}): string {
  const center = pin ?? { latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude };
  const zoom = pin ? 11 : 4;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="${LEAFLET}/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; background: ${background}; }
  .leaflet-container { font-family: -apple-system, system-ui, sans-serif; }
  ${dark ? '.leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9); }' : ''}
</style>
</head>
<body>
<div id="map"></div>
<script src="${LEAFLET}/leaflet.js"></script>
<script>
  var send = function (message) {
    var text = JSON.stringify(message);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else parent.postMessage(text, '*');
  };
  var map = L.map('map', { zoomControl: false }).setView([${center.latitude}, ${center.longitude}], ${zoom});
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  var marker = null;
  function place(lat, lng) {
    if (!marker) {
      marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.on('dragend', function () {
        var p = marker.getLatLng();
        send({ type: 'drag', lat: p.lat, lng: p.lng });
      });
    } else {
      marker.setLatLng([lat, lng]);
    }
  }
  ${pin ? `place(${pin.latitude}, ${pin.longitude});` : ''}

  map.on('click', function (e) {
    place(e.latlng.lat, e.latlng.lng);
    send({ type: 'tap', lat: e.latlng.lat, lng: e.latlng.lng });
  });

  window.__cmd = function (cmd) {
    if (cmd.type === 'pin') {
      place(cmd.lat, cmd.lng);
      map.setView([cmd.lat, cmd.lng], cmd.zoom || map.getZoom());
    }
  };
</script>
</body>
</html>`;
}

export function parseMapMessage(raw: unknown): MapMessage | null {
  try {
    const m = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if ((m?.type === 'tap' || m?.type === 'drag') && Number.isFinite(m.lat) && Number.isFinite(m.lng)) {
      return { type: m.type, lat: m.lat, lng: m.lng };
    }
  } catch {
    // Not one of ours.
  }
  return null;
}
