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
  const [currentStep, setCurrentStep] = useState(1);

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
      setCurrentStep(1);
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

  const handleTabChange = (tab: 'android' | 'ios' | 'desktop') => {
    setActiveTab(tab);
    setCurrentStep(1);
  };

  const getStepInfo = () => {
    if (activeTab === 'android') {
      switch (currentStep) {
        case 1:
          return {
            icon: 'ellipsis-vertical-outline',
            iconColor: '#3b82f6',
            title: 'Ouvrez le menu Chrome',
            desc: 'Appuyez sur les trois points verticaux (⋮) situés dans le coin supérieur droit de votre navigateur Chrome.',
          };
        case 2:
          return {
            icon: 'add-circle-outline',
            iconColor: '#10b981',
            title: 'Sélectionnez l\'installation',
            desc: 'Faites défiler le menu vers le bas et appuyez sur "Installer l\'application" ou "Ajouter à l\'écran d\'accueil".',
          };
        default:
          return {
            icon: 'checkmark-circle-outline',
            iconColor: '#8b5cf6',
            title: 'Validez l\'installation',
            desc: 'Appuyez sur "Installer". LibreShop apparaîtra instantanément sur votre écran d\'accueil !',
          };
      }
    } else if (activeTab === 'ios') {
      switch (currentStep) {
        case 1:
          return {
            icon: 'share-outline',
            iconColor: '#3b82f6',
            title: 'Appuyez sur Partager',
            desc: 'Depuis le navigateur Safari, appuyez sur le bouton Partager (le carré avec une flèche pointant vers le haut 📤) en bas de l\'écran.',
          };
        case 2:
          return {
            icon: 'add-outline',
            iconColor: '#10b981',
            title: 'Ajoutez à l\'écran d\'accueil',
            desc: 'Faites défiler les options vers le bas et sélectionnez "Sur l\'écran d\'accueil" (accompagné d\'une icône ➕).',
          };
        default:
          return {
            icon: 'checkmark-circle-outline',
            iconColor: '#8b5cf6',
            title: 'Validez et profitez',
            desc: 'Appuyez enfin sur "Ajouter" dans le coin supérieur droit pour installer l\'icône de LibreShop !',
          };
      }
    } else {
      switch (currentStep) {
        case 1:
          return {
            icon: 'desktop-outline',
            iconColor: '#3b82f6',
            title: 'Trouvez l\'icône d\'installation',
            desc: 'Dans la barre d\'adresse de votre navigateur en haut à droite, repérez l\'icône d\'ordinateur avec une flèche ou le symbole ⊕.',
          };
        case 2:
          return {
            icon: 'download-outline',
            iconColor: '#10b981',
            title: 'Lancez l\'installation',
            desc: 'Cliquez sur cette icône pour ouvrir la boîte de dialogue d\'installation de LibreShop.',
          };
        default:
          return {
            icon: 'checkmark-circle-outline',
            iconColor: '#8b5cf6',
            title: 'Confirmez l\'installation',
            desc: 'Cliquez sur le bouton "Installer". L\'application s\'ouvrira immédiatement dans sa propre fenêtre autonome !',
          };
      }
    }
  };

  if (isInstalled || !showInstallPrompt) return null;

  const stepInfo = getStepInfo();

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
            {/* Header with Close */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowInstructionModal(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={18} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Title & Description */}
            <Text style={styles.modalTitle}>Installer LibreShop !</Text>
            <Text style={styles.modalSubtitle}>
              Ajoutez l'application sur votre écran d'accueil pour y accéder en un clic.
            </Text>

            {/* Platforms Selector Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'android' && styles.activeTabButton]}
                onPress={() => handleTabChange('android')}
              >
                <Ionicons name="logo-android" size={15} color={activeTab === 'android' ? COLORS.accent : COLORS.textMuted} />
                <Text style={[styles.tabText, activeTab === 'android' && styles.activeTabText]}>Android</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'ios' && styles.activeTabButton]}
                onPress={() => handleTabChange('ios')}
              >
                <Ionicons name="logo-apple" size={15} color={activeTab === 'ios' ? COLORS.accent : COLORS.textMuted} />
                <Text style={[styles.tabText, activeTab === 'ios' && styles.activeTabText]}>iPhone</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.tabButton, activeTab === 'desktop' && styles.activeTabButton]}
                onPress={() => handleTabChange('desktop')}
              >
                <Ionicons name="desktop-outline" size={15} color={activeTab === 'desktop' ? COLORS.accent : COLORS.textMuted} />
                <Text style={[styles.tabText, activeTab === 'desktop' && styles.activeTabText]}>PC / Mac</Text>
              </TouchableOpacity>
            </View>

            {/* Step progress bar visualizer */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBarRow}>
                <View style={[styles.progressPill, currentStep >= 1 ? styles.activeProgressPill : styles.inactiveProgressPill]} />
                <View style={[styles.progressPill, currentStep >= 2 ? styles.activeProgressPill : styles.inactiveProgressPill]} />
                <View style={[styles.progressPill, currentStep >= 3 ? styles.activeProgressPill : styles.inactiveProgressPill]} />
              </View>
              <Text style={styles.progressText}>Étape {currentStep} sur 3</Text>
            </View>

            {/* Giant Circular Icon Step */}
            <View style={styles.iconCircleContainer}>
              <View style={[styles.iconCircle, { backgroundColor: stepInfo.iconColor + '15' }]}>
                <Ionicons name={stepInfo.icon as any} size={36} color={stepInfo.iconColor} />
              </View>
            </View>

            {/* Step Title & Details */}
            <Text style={styles.stepTitle}>{stepInfo.title}</Text>
            <Text style={styles.stepDesc}>{stepInfo.desc}</Text>

            {/* Next / Action Button */}
            <TouchableOpacity 
              style={styles.modalActionButton}
              onPress={() => {
                if (currentStep < 3) {
                  setCurrentStep(currentStep + 1);
                } else {
                  setShowInstructionModal(false);
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalActionButtonText}>
                {currentStep < 3 ? 'Suivant ➔' : 'J\'ai compris ! ➔'}
              </Text>
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
      ...(Platform.OS === 'web' && {
        position: 'fixed',
        backdropFilter: 'blur(10px)',
      } as any),
    },
    modalCard: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: COLORS.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.xl,
      alignItems: 'center',
      elevation: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
    },
    modalHeader: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 10,
    },
    modalCloseButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: COLORS.border + '25',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTitle: {
      fontSize: FONT_SIZE.lg + 2,
      fontWeight: '700',
      color: COLORS.text,
      textAlign: 'center',
      marginBottom: 6,
    },
    modalSubtitle: {
      fontSize: FONT_SIZE.sm,
      color: COLORS.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: SPACING.md,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: COLORS.border + '12',
      borderRadius: 20,
      padding: 3,
      width: '100%',
      marginBottom: SPACING.lg,
      gap: 2,
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 18,
      gap: 4,
    },
    activeTabButton: {
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
    },
    tabText: {
      fontSize: FONT_SIZE.xs - 1,
      fontWeight: '600',
      color: COLORS.textMuted,
    },
    activeTabText: {
      color: COLORS.text,
    },
    progressContainer: {
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    progressBarRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 6,
    },
    progressPill: {
      width: 32,
      height: 6,
      borderRadius: 3,
    },
    activeProgressPill: {
      backgroundColor: COLORS.accent,
    },
    inactiveProgressPill: {
      backgroundColor: COLORS.border + '40',
    },
    progressText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: '600',
      color: COLORS.textMuted,
    },
    iconCircleContainer: {
      marginBottom: SPACING.md,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepTitle: {
      fontSize: FONT_SIZE.md + 2,
      fontWeight: '700',
      color: COLORS.text,
      textAlign: 'center',
      marginBottom: SPACING.xs,
    },
    stepDesc: {
      fontSize: FONT_SIZE.sm,
      color: COLORS.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: SPACING.sm,
      marginBottom: SPACING.xl,
    },
    modalActionButton: {
      backgroundColor: COLORS.accent,
      paddingVertical: 14,
      borderRadius: 30, // heavy pill rounding as in screenshot
      width: '100%',
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
