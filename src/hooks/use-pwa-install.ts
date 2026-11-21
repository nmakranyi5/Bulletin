import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import {
  canPromptInstall,
  isInstalledApp,
  isIosBrowser,
  onInstallChange,
  promptInstall,
} from '../../lib/pwa';

// What the "Install app" row in Settings should do on the web.
//  - 'prompt': the browser can show its install dialog (Chrome, Edge, Android)
//  - 'ios':    show the Share > Add to Home Screen steps
//  - null:     nothing to offer (native app, already installed, or an unsupported browser)
export function usePwaInstall() {
  const [, bump] = useState(0);
  // Browser-only facts are read after mount, so the pre-rendered page matches.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return onInstallChange(() => bump((n) => n + 1));
  }, []);

  const mode: 'prompt' | 'ios' | null =
    Platform.OS !== 'web' || !mounted || isInstalledApp()
      ? null
      : canPromptInstall()
        ? 'prompt'
        : isIosBrowser()
          ? 'ios'
          : null;

  return { mode, install: promptInstall };
}
