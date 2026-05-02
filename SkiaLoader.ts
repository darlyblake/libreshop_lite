import { Platform } from 'react-native';

// Provide a simple cross-platform entry so imports like './SkiaLoader' resolve
// For web we delegate to the web implementation; on native we provide a noop.
export function initSkiaWeb(): Promise<void> {
  if (Platform.OS === 'web') {
    // dynamic import so bundlers can tree-shake native code
    return import('./SkiaLoader.web').then((m) => m.initSkiaWeb());
  }
  // On native, nothing to initialize at runtime here.
  return Promise.resolve();
}
