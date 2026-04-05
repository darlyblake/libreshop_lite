
import React, { useEffect } from 'react';
import 'react-native-url-polyfill/auto';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { Dimensions, View, LogBox, Platform } from 'react-native';

// Configuration des notifications (uniquement sur mobile)
if (Platform.OS !== 'web') {
  try {
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (e) {
    console.warn('Notifications not available:', e);
  }
}

LogBox.ignoreLogs([
  '"shadow*" style props are deprecated',
  'props.pointerEvents is deprecated',
]);

if (Platform.OS === 'web') {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const msg = String(args[0]);
    if (
      msg.includes('pointerEvents is deprecated') || 
      msg.includes('PushTokenManager') ||
      msg.includes('onStartShouldSetResponder') ||
      msg.includes('onResponder') ||
      msg.includes('transform-origin') ||
      msg.includes('TouchableMixin') ||
      msg.includes('None of the callbacks in the gesture are worklets') ||
      msg.includes('SkPath.addRect() is deprecated') ||
      msg.includes('SkPath.addPath() is deprecated')
    ) {
      return;
    }
    originalWarn(...args);
  };

  const originalError = console.error;
  console.error = (...args) => {
    const msg = String(args[0]);
    if (
      msg.includes('transform-origin') ||
      msg.includes('transformOrigin') ||
      msg.includes('onResponder') ||
      msg.includes('onStartShouldSetResponder') ||
      msg.includes('aria-hidden') ||
      msg.includes('react-devtools') ||
      msg.includes('Failed to fetch') ||
      msg.includes('ERR_NAME_NOT_RESOLVED') ||
      msg.includes('WebSocket connection')
    ) {
      return;
    }
    originalError(...args);
  };
}

const { width, height } = Dimensions.get('window');

export default function App() {
  const [skiaReady, setSkiaReady] = React.useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS === 'web') {
      try {
        const { LoadSkiaWeb } = require("@shopify/react-native-skia/lib/module/web");
        // Using a reliable CDN as primary/fallback to ensure it works on the web
        LoadSkiaWeb({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full/${file}`
        })
          .then(() => {
            console.log("Skia Web initialized successfully via CDN");
            setSkiaReady(true);
          })
          .catch((err: any) => {
            console.warn("Failed to load Skia Web from CDN, trying local root...", err);
            LoadSkiaWeb({
              locateFile: (file: string) => `/${file}`
            })
              .then(() => {
                console.log("Skia Web initialized successfully via local root");
                setSkiaReady(true);
              })
              .catch((err2: any) => {
                console.error("Failed to load Skia Web completely:", err2);
                setSkiaReady(true);
              });
          });
      } catch (e) {
        setSkiaReady(true);
      }
    }
  }, []);

  useEffect(() => {
    // Handle Supabase OAuth callback
    const handleDeepLink = async ({ url }: { url: string }) => {
      try {
        const parsed = Linking.parse(url);
        if (parsed.path && parsed.path.includes('auth/callback')) {
          // Let the auth screens handle the callback
        }
      } catch (error) {
        console.error('Error handling deep link:', error);
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Handle initial URL if app was opened with a deep link
    const getInitialURL = async () => {
      const url = await Linking.getInitialURL();
      if (url != null) {
        handleDeepLink({ url });
      }
    };

    getInitialURL();

    return () => {
      subscription?.remove();
    };
  }, []);

  if (!skiaReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0c12', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ 
          width: 40, 
          height: 40, 
          borderRadius: 20, 
          borderWidth: 3, 
          borderColor: '#8b5cf6', 
          borderTopColor: 'transparent',
          transform: [{ rotate: '45deg' }]
        }} />
      </View>
    );
  }

  // Requiring AppContent only AFTER Skia is ready ensures that all 
  // Skia-dependent modules are evaluated with CanvasKit already on global scope.
  const AppContent = require("./AppContent").default;

  return (
    <AppContent />
  );
}



