// Each area keeps its English and Spanish text side by side. The Spanish object is typed to
// have exactly the same keys, so a missing translation is a compile error.
export function defineMessages<const E extends Record<string, string>>(
  en: E,
  es: Record<keyof E, string>
) {
  return { en, es };
}
