// Turning a map pin into the short place name shown on profiles and postings
// ("Austin, TX"), plus the small amount of coordinate handling the map picker needs.

const US_STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
  illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};

export type Address = {
  city?: string | null;
  subregion?: string | null;
  region?: string | null;
  name?: string | null;
  country?: string | null;
  isoCountryCode?: string | null;
};

export type Coords = { latitude: number; longitude: number };

// "Austin, TX" for US addresses (full state names become abbreviations), "City, Region"
// elsewhere, or null when the geocoder knows nothing useful about the spot.
export function placeLabel(address: Address | null | undefined): string | null {
  if (!address) return null;
  const clean = (s?: string | null) => (s && s.trim() ? s.trim() : null);
  const place = clean(address.city) ?? clean(address.subregion);
  let region = clean(address.region);
  if (region) region = US_STATES[region.toLowerCase()] ?? region;

  if (place && region) return `${place}, ${region}`;
  if (place) return clean(address.country) ? `${place}, ${clean(address.country)}` : place;
  if (region) return clean(address.country) && region.length > 2 ? `${region}, ${address.country}` : region;
  return null;
}

// "30.267, -97.743": what to show when a pin lands somewhere with no place name.
export function coordLabel({ latitude, longitude }: Coords): string {
  return `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
}

export function isValidCoords(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// Where the map opens when nothing has been picked: the continental US.
export const DEFAULT_REGION = {
  latitude: 39.5,
  longitude: -98.35,
  latitudeDelta: 40,
  longitudeDelta: 40,
};

// Zoomed to a metro area, for a spot that was just found or already saved.
export function regionAround({ latitude, longitude }: Coords) {
  return { latitude, longitude, latitudeDelta: 0.25, longitudeDelta: 0.25 };
}

// The coordinates stored alongside a place name: both or neither, rounded to ~100 m
// (we only need the area, and it keeps exact positions private).
export function roundedCoords(lat: number | null, lng: number | null) {
  if (lat === null || lng === null || !isValidCoords(lat, lng)) {
    return { lat: null, lng: null };
  }
  return { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000 };
}
