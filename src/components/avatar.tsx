import { UserRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { useTheme } from '../../lib/app-theme';

// A person's profile photo, falling back to the default silhouette when they haven't
// set one or the image can't be loaded.
export function Avatar({
  uri,
  size = 40,
  // Draw the silhouette inside a circle (used in headers) instead of bare.
  framed = false,
}: {
  uri?: string | null;
  size?: number;
  framed?: boolean;
}) {
  const c = useTheme().colors;
  const [failed, setFailed] = useState(false);

  // A new photo gets a fresh chance to load.
  useEffect(() => setFailed(false), [uri]);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceAlt }}
      />
    );
  }

  if (framed) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <UserRound size={Math.round(size * 0.58)} color={c.textSecondary} strokeWidth={1.8} />
      </View>
    );
  }

  return <UserRound size={size} color={c.muted} strokeWidth={1.5} />;
}
