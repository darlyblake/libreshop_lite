
import React from 'react';
import { Dimensions, View } from 'react-native';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ThemeProvider } from './src/components/ThemeProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import { GlobalAlertManager } from './src/components/GlobalAlertManager';

import { notificationService } from './src/services/notificationService';

export default function AppContent() {
  React.useEffect(() => {
    // Demander les permissions et enregistrer le token au démarrage
    notificationService.registerForPushNotificationsAsync();
    
    // Planifier la notification d'engagement (pour faire revenir le client)
    notificationService.scheduleEngagementNotification();
  }, []);

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
