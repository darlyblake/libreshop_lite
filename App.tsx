
import React, { useEffect } from 'react';
import 'react-native-url-polyfill/auto';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation';
import { Dimensions, View } from 'react-native';
import { ErrorBoundary } from './src/components/ErrorBoundary';

const { width, height } = Dimensions.get('window');

export default function App() {
  useEffect(() => {
    // Handle Supabase OAuth callback
    const handleDeepLink = async ({ url }: { url: string }) => {
      try {
        const parsed = Linking.parse(url);
        console.log('Deep link parsed:', parsed);
        
        if (parsed.path && parsed.path.includes('auth/callback')) {
          // Let the auth screens handle the callback
          console.log('OAuth callback detected:', url);
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

  return (
    <ErrorBoundary>
      <View style={{ flex: 1, width, height }}>
        <AppNavigator />
      </View>
    </ErrorBoundary>
  );
}



