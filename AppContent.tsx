
import React from 'react';
import { Dimensions, View } from 'react-native';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ThemeProvider } from './src/components/ThemeProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation';

const { width, height } = Dimensions.get('window');

export default function AppContent() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <View style={{ flex: 1, width, height }}>
              <AppNavigator />
            </View>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
