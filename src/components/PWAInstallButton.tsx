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
  
  const styles = React.useMemo(() => typeof getStyles === 'function' ? getStyles(themeContext) : ({} as any), [themeContext]);

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    // Vérifier si l'app est déjà installée
    const checkIfInstalled = () => {
      // Pour iOS Safari
      if ('standalone' in window.navigator && (window.navigator as any).standalone) {
        setIsInstalled(true);
        return;
      }
      
      // Pour Chrome/Android
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return;
      }
      
      // Vérifier si l'app est lancée depuis PWA
      if (window.location.search.includes('utm_source=pwa')) {
        setIsInstalled(true);
        return;
      }
    };

    // Écouter l'événement beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    // Écouter l'événement appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      
      // Montrer une confirmation
      if (Platform.OS === 'web') {
        Alert.alert(
          'Installation réussie !',
          'LibreShop est maintenant installée sur votre appareil.',
          [{ text: 'OK' }]
        );
      }
    };

    // Initialiser les écouteurs d'événements
    if (Platform.OS === 'web') {
      checkIfInstalled();
      
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);
      
      // Vérifier si on doit montrer le prompt après un certain temps
      const timer = setTimeout(() => {
        if (!isInstalled && !deferredPrompt) {
          // Pour iOS, on montre toujours le guide d'installation
          if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
            setShowInstallPrompt(true);
          }
        }
      }, 5000); // 5 secondes après le chargement

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
        clearTimeout(timer);
      };
    }
  }, [isInstalled, deferredPrompt]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Pour iOS Safari, montrer les instructions
      showIOSInstallInstructions();
      return;
    }

    try {
      // Montrer le prompt d'installation natif
      await deferredPrompt.prompt();
      
      // Attendre la réponse de l'utilisateur
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        // Log: 'L\'utilisateur a accepté l\'installation';
      } else {
        // Log: 'L\'utilisateur a refusé l\'installation';
        setShowInstallPrompt(false);
      }
      
      setDeferredPrompt(null);
    } catch (error) {
      errorHandler.handle('Erreur lors de l\'installation:', error, 'UnknownContext');
      showIOSInstallInstructions();
    }
  };

  const showIOSInstallInstructions = () => {
    Alert.alert(
      'Installer LibreShop',
      'Pour installer LibreShop sur votre appareil :\n\n' +
      '1. Appuyez sur l\'icône "Partager" en bas de l\'écran\n' +
      '2. Faites défiler vers le bas et appuyez sur "Sur l\'écran d\'accueil"\n' +
      '3. Appuyez sur "Ajouter" pour installer l\'application',
      [
        { text: 'Compris', style: 'default' },
        { text: 'Ne plus afficher', onPress: () => setShowInstallPrompt(false) }
      ]
    );
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Sauvegarder la préférence de l'utilisateur
    if (Platform.OS === 'web') {
      localStorage.setItem('pwa-install-dismissed', 'true');
    }
  };

  // Ne pas afficher le bouton si l'app est déjà installée ou si le prompt est masqué
  if (isInstalled || !showInstallPrompt) {
    return null;
  }

  // Vérifier si l'utilisateur a déjà masqué le prompt
  if (Platform.OS === 'web' && localStorage.getItem('pwa-install-dismissed') === 'true') {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="download-outline" size={24} color={COLORS.accent} />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>Installer LibreShop</Text>
          <Text style={styles.subtitle}>
            Installez l\'application pour un accès rapide et une expérience optimale
          </Text>
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
      left: SPACING.lg,
      right: SPACING.lg,
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      ...Platform.select({
        web: {
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
        },
        default: {
          boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
          elevation: 8,
        },
      }),
      zIndex: 1000,
    },
    content: {
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
      gap: SPACING.sm,
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
