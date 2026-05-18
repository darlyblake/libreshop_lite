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
  const COLORS = themeContext.getColor;
  const SPACING = themeContext.spacing;
  const RADIUS = themeContext.radius;
  const FONT_SIZE = themeContext.fontSize;
  
  const styles = React.useMemo(() => getStyles(themeContext), [themeContext]);

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showInstructionModal, setShowInstructionModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'desktop'>('android');

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

    // Auto-detect browser platform for instruction tabs
    const userAgent = navigator.userAgent || '';
    const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isAndroidDevice = /Android/i.test(userAgent);
    if (isIOSDevice) {
      setActiveTab('ios');
    } else if (isAndroidDevice) {
      setActiveTab('android');
    } else {
      setActiveTab('desktop');
    }

    // Check if the global deferred prompt is already set (by the index.html listener)
    const checkGlobalPrompt = () => {
      const globalPrompt = (window as any).deferredPrompt;
      if (globalPrompt) {
        setDeferredPrompt(globalPrompt);
        setShowInstallPrompt(true);
        return true;
      }
      return false;
    };

    // Check immediately on mount
    checkGlobalPrompt();

    // Set up a quick interval to check for it as the page completes loading
    const checkInterval = setInterval(() => {
      if (checkGlobalPrompt()) {
        clearInterval(checkInterval);
      }
    }, 500);

    // Listen for Chrome/Android native install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      (window as any).deferredPrompt = e; // Sync globally
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      try { delete (window as any).deferredPrompt; } catch (err) { (window as any).deferredPrompt = null; }
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
      clearInterval(checkInterval);
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
      // Show modern instruction modal
      setShowInstructionModal(true);
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
    <>
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

      {showInstructionModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Ionicons name="download-outline" size={24} color={COLORS.accent} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Installer LibreShop</Text>
              </View>
              <TouchableOpacity onPress={() => setShowInstructionModal(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Installez LibreShop sur votre appareil pour naviguer plus rapidement, économiser vos données et y accéder en un clic comme une application native.
            </Text>

            {/* Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'android' && styles.activeTabButton]}
                onPress={() => setActiveTab('android')}
              >
                <Ionicons name="logo-android" size={18} color={activeTab === 'android' ? COLORS.text : COLORS.textMuted} />
                <Text style={[styles.tabText, activeTab === 'android' && styles.activeTabText]}>Android</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'ios' && styles.activeTabButton]}
                onPress={() => setActiveTab('ios')}
              >
                <Ionicons name="logo-apple" size={18} color={activeTab === 'ios' ? COLORS.text : COLORS.textMuted} />
                <Text style={[styles.tabText, activeTab === 'ios' && styles.activeTabText]}>iPhone / iPad</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'desktop' && styles.activeTabButton]}
                onPress={() => setActiveTab('desktop')}
              >
                <Ionicons name="desktop-outline" size={18} color={activeTab === 'desktop' ? COLORS.text : COLORS.textMuted} />
                <Text style={[styles.tabText, activeTab === 'desktop' && styles.activeTabText]}>PC / Mac</Text>
              </TouchableOpacity>
            </View>

            {/* Steps Content */}
            <View style={styles.stepsContainer}>
              {activeTab === 'android' && (
                <>
                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>1</Text>
                    </View>
                    <View style={styles.stepTextContainer}>
                      <Text style={styles.stepTitle}>Ouvrez le menu</Text>
                      <Text style={styles.stepDesc}>
                        Appuyez sur les <Text style={{fontWeight: '700', color: COLORS.accent}}>trois points verticaux (⋮)</Text> dans le coin supérieur droit de votre navigateur Chrome.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>2</Text>
                    </View>
                    <View style={styles.stepTextContainer}>
                      <Text style={styles.stepTitle}>Sélectionnez l'installation</Text>
                      <Text style={styles.stepDesc}>
                        Faites défiler le menu vers le bas et appuyez sur <Text style={{fontWeight: '700', color: COLORS.accent}}>"Installer l'application"</Text> ou <Text style={{fontWeight: '700', color: COLORS.accent}}>"Ajouter à l'écran d'accueil"</Text>.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>3</Text>
                    </View>
                    <View style={styles.stepTextContainer}>
                      <Text style={styles.stepTitle}>Validez et profitez !</Text>
                      <Text style={styles.stepDesc}>
                        Appuyez sur <Text style={{fontWeight: '700', color: COLORS.accent}}>"Installer"</Text>. LibreShop apparaîtra instantanément aux côtés de vos applications habituelles !
                      </Text>
                    </View>
                  </View>
                </>
              )}

              {activeTab === 'ios' && (
                <>
                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>1</Text>
                    </View>
                    <View style={styles.stepTextContainer}>
                      <Text style={styles.stepTitle}>Appuyez sur Partager</Text>
                      <Text style={styles.stepDesc}>
                        Depuis le navigateur Safari, appuyez sur le bouton de <Text style={{fontWeight: '700', color: COLORS.accent}}>partage (le carré avec une flèche pointant vers le haut 📤)</Text> situé dans la barre de navigation.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>2</Text>
                    </View>
                    <View style={styles.stepTextContainer}>
                      <Text style={styles.stepTitle}>Ajoutez à l'écran d'accueil</Text>
                      <Text style={styles.stepDesc}>
                        Faites défiler les options vers le bas et appuyez sur <Text style={{fontWeight: '700', color: COLORS.accent}}>"Sur l'écran d'accueil"</Text> (accompagné d'une icône ➕).
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>3</Text>
                    </View>
                    <View style={styles.stepTextContainer}>
                      <Text style={styles.stepTitle}>Ajoutez l'application</Text>
                      <Text style={styles.stepDesc}>
                        Appuyez enfin sur <Text style={{fontWeight: '700', color: COLORS.accent}}>"Ajouter"</Text> dans le coin supérieur droit. L'icône de LibreShop s'ajoutera sur votre écran d'accueil iPhone !
                      </Text>
                    </View>
                  </View>
                </>
              )}

              {activeTab === 'desktop' && (
                <>
                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>1</Text>
                    </View>
                    <View style={styles.stepTextContainer}>
                      <Text style={styles.stepTitle}>Trouvez l'icône d'installation</Text>
                      <Text style={styles.stepDesc}>
                        Dans la barre d'adresse de Chrome/Edge en haut à droite, repérez l'icône <Text style={{fontWeight: '700', color: COLORS.accent}}>d'ordinateur avec une flèche de téléchargement 🖥️</Text> (ou l'icône ⊕).
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>2</Text>
                    </View>
                    <View style={styles.stepTextContainer}>
                      <Text style={styles.stepTitle}>Lancez l'installation</Text>
                      <Text style={styles.stepDesc}>
                        Cliquez sur cette icône pour ouvrir la boîte de dialogue système d'installation de LibreShop.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stepItem}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>3</Text>
                    </View>
                    <View style={styles.stepTextContainer}>
                      <Text style={styles.stepTitle}>Confirmez et lancez !</Text>
                      <Text style={styles.stepDesc}>
                        Cliquez sur le bouton <Text style={{fontWeight: '700', color: COLORS.accent}}>"Installer"</Text>. LibreShop s'ouvrira immédiatement dans une fenêtre propre, fluide, sans barre de navigation Web.
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Action button */}
            <TouchableOpacity 
              style={styles.modalActionButton}
              onPress={() => setShowInstructionModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalActionButtonText}>J'ai compris, merci !</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
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
    // Modern Instruction Modal Styles
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 6, 10, 0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 99999,
      padding: SPACING.md,
      // For web fixed viewport modal overlay
      ...(Platform.OS === 'web' && {
        position: 'fixed',
        backdropFilter: 'blur(10px)',
      } as any),
    },
    modalCard: {
      width: '100%',
      maxWidth: 460,
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.lg,
      elevation: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },
    modalTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    modalTitle: {
      fontSize: FONT_SIZE.lg,
      fontWeight: '700',
      color: COLORS.text,
    },
    modalCloseButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: COLORS.border + '30',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalSubtitle: {
      fontSize: FONT_SIZE.sm,
      color: COLORS.textMuted,
      lineHeight: 20,
      marginBottom: SPACING.lg,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: COLORS.border + '15',
      borderRadius: RADIUS.md,
      padding: 4,
      marginBottom: SPACING.lg,
      gap: 4,
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: RADIUS.sm,
      gap: 6,
    },
    activeTabButton: {
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    tabText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: '600',
      color: COLORS.textMuted,
    },
    activeTabText: {
      color: COLORS.text,
    },
    stepsContainer: {
      gap: SPACING.md,
      marginBottom: SPACING.xl,
    },
    stepItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
    },
    stepBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: COLORS.accent + '20',
      borderWidth: 1,
      borderColor: COLORS.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    stepBadgeText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: '700',
      color: COLORS.accent,
    },
    stepTextContainer: {
      flex: 1,
    },
    stepTitle: {
      fontSize: FONT_SIZE.md,
      fontWeight: '600',
      color: COLORS.text,
      marginBottom: 4,
    },
    stepDesc: {
      fontSize: FONT_SIZE.sm,
      color: COLORS.textMuted,
      lineHeight: 18,
    },
    modalActionButton: {
      backgroundColor: COLORS.accent,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalActionButtonText: {
      fontSize: FONT_SIZE.md,
      fontWeight: '700',
      color: COLORS.text,
    },
  });
};

export default PWAInstallButton;
