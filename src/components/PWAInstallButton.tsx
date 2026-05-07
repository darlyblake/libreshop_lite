import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstallButton: React.FC = () => {
  const themeContext = useTheme();
  const theme = themeContext.theme;
  const COLORS = themeContext.getColor;
  const SPACING = themeContext.spacing;
  const RADIUS = themeContext.radius;
  const FONT_SIZE = themeContext.fontSize;
  
  const styles = React.useMemo(() => getStyles(themeContext), [themeContext]);

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Reset dismissed state after 3 days
    const dismissedAt = localStorage.getItem('pwa-install-dismissed-at');
    if (dismissedAt) {
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      if (Date.now() - parseInt(dismissedAt, 10) > threeDays) {
        localStorage.removeItem('pwa-install-dismissed');
        localStorage.removeItem('pwa-install-dismissed-at');
      }
    }

    // Don't show if user dismissed recently
    if (localStorage.getItem('pwa-install-dismissed') === 'true') return;

    // Check if already installed as standalone PWA
    const isStandalone =
      ('standalone' in window.navigator && (window.navigator as any).standalone) ||
      window.matchMedia('(display-mode: standalone)').matches ||
      window.location.search.includes('utm_source=pwa');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Listen for Chrome/Android native install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // For iOS Safari: show manual instructions after 3 seconds
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const iOSTimer = setTimeout(() => {
      if (isIOS) setShowInstallPrompt(true);
    }, 3000);

    // For desktop/Android Chrome: show fallback banner after 5s
    // if beforeinstallprompt hasn't fired yet (e.g. already visited)
    const fallbackTimer = setTimeout(() => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isHTTPS = location.protocol === 'https:' || location.hostname === 'localhost';
      if (isHTTPS && !isIOS) {
        setShowInstallPrompt(prev => prev ? prev : isMobile ? true : true);
      }
    }, 5000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(iOSTimer);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstallClick = async () => {
    // prefer the component-captured prompt, otherwise try a global fallback
    const promptEvent = deferredPrompt || (window as any).deferredPrompt || null;
    console.log('PWA install click, deferredPrompt (component):', deferredPrompt, 'global:', (window as any).deferredPrompt);

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome !== 'accepted') setShowInstallPrompt(false);
        // clear both component state and global fallback
        setDeferredPrompt(null);
        try { delete (window as any).deferredPrompt; } catch (e) { (window as any).deferredPrompt = null; }
      } catch (error: any) {
        errorHandler.handle(error, 'PWA installation error', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      }
    } else {
      // iOS or browsers without native prompt — show manual instructions
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      Alert.alert(
        'Installer LibreShop',
        isIOS
          ? 'Sur Safari :\n\n1. Appuyez sur l\'icône "Partager" (⬆) en bas\n2. Sélectionnez "Sur l\'écran d\'accueil"\n3. Appuyez sur "Ajouter"'
          : 'Sur Chrome :\n\n1. Appuyez sur le menu ⋮ en haut à droite\n2. Sélectionnez "Ajouter à l\'écran d\'accueil"\n3. Confirmez l\'installation',
        [{ text: 'Compris', style: 'default' }]
      );
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    if (Platform.OS === 'web') {
      localStorage.setItem('pwa-install-dismissed', 'true');
      localStorage.setItem('pwa-install-dismissed-at', Date.now().toString());
    }
  };

  if (isInstalled || !showInstallPrompt) return null;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="download-outline" size={24} color={COLORS.accent} />
          </View>
          
          <View style={styles.textContainer}>
            <Text style={styles.title}>Installer LibreShop</Text>
            <Text style={styles.subtitle}>
              Installez l'application pour un accès rapide et une expérience optimale
            </Text>
          </View>
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.installButton]}
            onPress={handleInstallClick}
            activeOpacity={0.8}
          >
            <Ionicons name="add-outline" size={18} color={COLORS.text} />
            <Text style={styles.installButtonText}>Installer</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.dismissButton]}
            onPress={handleDismiss}
            activeOpacity={0.8}
          >
            <Ionicons name="close-outline" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const getStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  const FONT_SIZE = theme.fontSize;

  return StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: SPACING.lg,
      ...Platform.select({
        web: {
          right: SPACING.lg,
          width: 350,
          backgroundColor: COLORS.card,
          borderRadius: RADIUS.lg,
          borderWidth: 1,
          borderColor: COLORS.border,
        },
        default: {
          left: SPACING.lg,
          right: SPACING.lg,
          backgroundColor: COLORS.card,
          borderRadius: RADIUS.lg,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
        },
      }),
      padding: SPACING.md,
      zIndex: 1000,
      // Fallback for web boxShadow if needed
      ...(Platform.OS === 'web' && {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      } as any),
    },
    content: {
      ...Platform.select({
        web: {
          flexDirection: 'column',
          alignItems: 'stretch',
        },
        default: {
          flexDirection: 'row',
          alignItems: 'center',
        }
      }),
      gap: SPACING.md,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: RADIUS.md,
      backgroundColor: COLORS.accent + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    textContainer: {
      flex: 1,
    },
    title: {
      fontSize: FONT_SIZE.md,
      fontWeight: '600',
      color: COLORS.text,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: FONT_SIZE.sm,
      color: COLORS.textMuted,
      lineHeight: 18,
    },
    buttonContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: Platform.OS === 'web' ? 'flex-end' : 'flex-start',
      gap: SPACING.sm,
      marginTop: Platform.OS === 'web' ? SPACING.sm : 0,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      gap: SPACING.xs,
      minWidth: 80,
    },
    installButton: {
      backgroundColor: COLORS.accent,
    },
    installButtonText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: '600',
      color: COLORS.text,
    },
    dismissButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
  });
};

export default PWAInstallButton;
