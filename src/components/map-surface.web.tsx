import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { MapCommand, MapMessage, parseMapMessage } from '../../lib/map-html';
import type { MapSurfaceHandle } from './map-surface';

export type { MapSurfaceHandle };

// The Leaflet map (see lib/map-html.ts) shown in an iframe, for the web.
export const MapSurface = forwardRef<
  MapSurfaceHandle,
  { html: string; onMessage: (message: MapMessage) => void }
>(function MapSurface({ html, onMessage }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useImperativeHandle(ref, () => ({
    send: (command: MapCommand) => (frame.current?.contentWindow as any)?.__cmd?.(command),
  }));

  useEffect(() => {
    const listen = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const message = parseMapMessage(e.data);
      if (message) handler.current(message);
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, []);

  return (
    <iframe
      ref={frame}
      srcDoc={html}
      title="Map"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
    />
  );
});
