
import React from 'react';
import { Dimensions, View } from 'react-native';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ThemeProvider } from './src/components/ThemeProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import { GlobalAlertManager } from './src/components/GlobalAlertManager';

export default function AppContent() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <GlobalAlertManager />
            <View style={{ flex: 1 }}>
              <AppNavigator />
            </View>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
