/**
 * PWAUpdateBanner.tsx
 *
 * Bannière de mise à jour PWA premium et non-intrusive.
 * S'affiche automatiquement quand une nouvelle version de LibreShop est disponible.
 *
 * Flux :
 * 1. Le service worker détecte sa propre mise à jour (nouveau fichier service-worker.js déployé)
 * 2. Il s'active immédiatement (skipWaiting) et envoie un message "SW_UPDATED" à l'app
 * 3. Ce composant reçoit le message et affiche une belle bannière en bas de l'écran
 * 4. L'utilisateur clique "Mettre à jour" → window.location.reload() → nouvelle version chargée
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

export const PWAUpdateBanner: React.FC = () => {
  const theme = useTheme();
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  const FONT_SIZE = theme.fontSize;

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const slideAnim = useRef(new Animated.Value(120)).current; // start off-screen bottom
  const swRegistration = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !('serviceWorker' in navigator)) return;

    // ── 1. Listen for SW_UPDATED messages from the service worker ──────────
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('[PWAUpdateBanner] New SW version detected:', event.data.version);
        setNewVersion(event.data.version || null);
        showBanner();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSWMessage);

    // ── 2. Also detect updates via registration.onupdatefound ──────────────
    navigator.serviceWorker.ready.then(registration => {
      swRegistration.current = registration;

      // Poll for updates every 60 seconds
      const pollInterval = setInterval(() => {
        registration.update().catch(() => {});
      }, 60_000);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // New SW installed and ready to take over
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWAUpdateBanner] New SW installed, showing update banner');
            // Tell the new SW to skip waiting immediately
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      return () => clearInterval(pollInterval);
    }).catch(() => {});

    // ── 3. When SW controller changes (new SW took over), reload ───────────
    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      // SW changed — show banner if not already shown
      showBanner();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const showBanner = () => {
    setUpdateAvailable(true);
    setDismissed(false);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  };

  const hideBanner = () => {
    Animated.timing(slideAnim, {
      toValue: 120,
      duration: 280,
      useNativeDriver: true,
    }).start(() => {
      setDismissed(true);
    });
  };

  const handleUpdate = () => {
    // Reload the page — the new service worker is already active
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    hideBanner();
  };

  if (!updateAvailable || dismissed) return null;
  if (Platform.OS !== 'web') return null;

  const styles = StyleSheet.create({
    wrapper: {
      position: 'absolute' as any,
      bottom: 80, // above bottom nav if any
      left: SPACING.md,
      right: SPACING.md,
      zIndex: 99999,
    },
    card: {
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1.5,
      borderColor: COLORS.accent + '50',
      padding: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      // Glassmorphism shadow
      ...(Platform.OS === 'web' && {
        boxShadow: '0 8px 32px rgba(139, 92, 246, 0.25)',
      } as any),
    },
    iconBadge: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: COLORS.accent + '20',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    textContainer: {
      flex: 1,
    },
    title: {
      fontSize: FONT_SIZE.sm,
      fontWeight: '700' as any,
      color: COLORS.text,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: FONT_SIZE.xs,
      color: COLORS.textMuted,
      lineHeight: 16,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      flexShrink: 0,
    },
    updateBtn: {
      backgroundColor: COLORS.accent,
      paddingVertical: 8,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    updateBtnText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: '700' as any,
      color: '#ffffff',
    },
    dismissBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: COLORS.border + '30',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <Animated.View
      style={[styles.wrapper, { transform: [{ translateY: slideAnim }] }]}
    >
      <View style={styles.card}>
        <View style={styles.iconBadge}>
          <Ionicons name="sparkles" size={20} color={COLORS.accent} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>Mise à jour disponible !</Text>
          <Text style={styles.subtitle}>
            Une nouvelle version de LibreShop est prête.
            {newVersion ? ` (v${newVersion})` : ''}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.updateBtn} onPress={handleUpdate} activeOpacity={0.8}>
            <Ionicons name="refresh" size={13} color="#ffffff" />
            <Text style={styles.updateBtnText}>Mettre à jour</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss} activeOpacity={0.7}>
            <Ionicons name="close" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

export default PWAUpdateBanner;
