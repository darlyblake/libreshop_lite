import { registerRootComponent } from 'expo';

// Initialize DOM protection only in web environment
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  try {
    require('./src/config/domProtection');
  } catch (e) {
    // Silently fail if DOM protection can't be loaded
  }
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
