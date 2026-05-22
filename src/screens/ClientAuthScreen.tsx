import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Image,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { authService } from '../services/authService';
import { useAuthStore } from '../store';
import { useCartStore } from '../store';
import { productLikesService } from '../services/productLikesService';
import { storeService } from '../services/storeService';

export const ClientAuthScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { pendingAction } = route.params || {};

  const [loading, setLoading] = useState(false);
  const { setUser, setSession, user } = useAuthStore();
  const { addItem } = useCartStore();

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);

    try {
      // Save intent and pending action securely before browser redirection to avoid race conditions
      await AsyncStorage.setItem('@libreshop_auth_intent', 'client');
      if (pendingAction) {
        await AsyncStorage.setItem('@libreshop_pending_action', JSON.stringify(pendingAction));
      }

      const redirectUrl = Linking.createURL('auth/callback');
      
      await authService.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
        },
      });

      // L'utilisateur est redirigé vers le navigateur
    } catch (err: any) {
      Alert.alert(
        'Erreur',
        'Impossible de se connecter avec Google. Veuillez réessayer.'
      );
      setLoading(false);
    }
  };

  // Traitement du retour après la connexion OAuth
  useEffect(() => {
    const subscription = Linking.addEventListener('url', async ({ url }) => {
      if (url.includes('auth/callback')) {
        setLoading(true);
        try {
          const currentUser = await authService.getCurrentUser();
          
          if (currentUser) {
            // Mettre à jour le store
            setUser(currentUser as any);
            const sessionData = await authService.getSession();
            setSession(sessionData.session);

            // Tenter de récupérer l'action en attente
            const savedActionStr = await AsyncStorage.getItem('@libreshop_pending_action');
            if (savedActionStr) {
              const action = JSON.parse(savedActionStr);
              await AsyncStorage.removeItem('@libreshop_pending_action');
              
              // Exécuter l'action en attente
              if (action.type === 'ADD_TO_CART') {
                addItem(action.payload.product, action.payload.quantity);
                navigation.replace('Cart');
              } else if (action.type === 'BUY_NOW') {
                navigation.replace('Checkout', { items: [{ product: action.payload.product, quantity: action.payload.quantity }], storeId: action.payload.product.store_id });
              } else if (action.type === 'CHECKOUT') {
                // Return to checkout or navigate forward
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.replace('Checkout', action.payload?.params);
                }
              } else if (action.type === 'LIKE_PRODUCT') {
                await productLikesService.toggleLike(currentUser.id, action.payload.productId);
                if (navigation.canGoBack()) navigation.goBack();
                else navigation.replace('ClientTabs');
              } else if (action.type === 'FOLLOW_STORE') {
                await storeService.toggleFollow(currentUser.id, action.payload.storeId);
                if (navigation.canGoBack()) navigation.goBack();
                else navigation.replace('ClientTabs');
              } else {
                navigation.replace('ClientTabs');
              }
            } else {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.replace('ClientTabs');
            }
          }
        } catch (error) {
          Alert.alert('Erreur', 'Erreur lors de la récupération du profil.');
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.replace('ClientTabs');
        } finally {
          setLoading(false);
        }
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={28} color={COLORS.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Connectez-vous pour continuer</Text>
          <Text style={styles.subtitle}>
            Un compte est nécessaire pour ajouter au panier, aimer, ou finaliser votre commande.
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.googleBtn, loading && styles.disabledBtn]} 
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <>
              <Ionicons name="logo-google" size={24} color={COLORS.text} />
              <Text style={styles.googleText}>Continuer avec Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.footerText}>
          En vous connectant, vous acceptez nos conditions d'utilisation.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 10,
    padding: SPACING.sm,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxxl,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }
    }),
  },
  disabledBtn: {
    opacity: 0.7,
  },
  googleText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  footerText: {
    marginTop: SPACING.xxl,
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 12,
  },
});

export default ClientAuthScreen;
