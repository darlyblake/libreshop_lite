import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, RADIUS } from '../config/theme';
import { authService } from '../services/authService';
import { useAuthStore, useCartStore } from '../store';
import { productLikesService } from '../services/productLikesService';
import { storeService } from '../services/storeService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ClientAuthModal: React.FC = () => {
  const navigation = useNavigation<any>();
  const { isAuthModalVisible, pendingAction, hideAuthModal, setUser, setSession, user } = useAuthStore();
  const { addItem } = useCartStore();
  const [loading, setLoading] = useState(false);

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

      // Redirected to browser
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
    if (!isAuthModalVisible) return;

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
            await AsyncStorage.removeItem('@libreshop_pending_action');
            await AsyncStorage.removeItem('@libreshop_auth_intent');
            
            if (savedActionStr) {
              const action = JSON.parse(savedActionStr);
              
              // Exécuter l'action en attente
              if (action.type === 'ADD_TO_CART') {
                addItem(action.payload.product, action.payload.quantity);
                Alert.alert('Succès', 'Produit ajouté au panier !');
              } else if (action.type === 'BUY_NOW') {
                addItem(action.payload.product, action.payload.quantity);
                navigation.navigate('Checkout', { 
                  items: [{ product: action.payload.product, quantity: action.payload.quantity }], 
                  storeId: action.payload.product.store_id 
                });
              } else if (action.type === 'CHECKOUT') {
                navigation.navigate('Checkout');
              } else if (action.type === 'LIKE_PRODUCT') {
                await productLikesService.toggleLike(currentUser.id, action.payload.productId);
              } else if (action.type === 'FOLLOW_STORE') {
                await storeService.toggleFollow(currentUser.id, action.payload.storeId);
              }
            }
            
            // Fermer le modal
            hideAuthModal();
          }
        } catch (error) {
          Alert.alert('Erreur', 'Erreur lors de la récupération de votre profil.');
        } finally {
          setLoading(false);
        }
      }
    });

    return () => subscription.remove();
  }, [isAuthModalVisible]);

  // Check for pending action on startup when user becomes authenticated (especially on Web reload)
  useEffect(() => {
    const checkPendingActionOnStartup = async () => {
      if (!user) return;
      try {
        const savedActionStr = await AsyncStorage.getItem('@libreshop_pending_action');
        if (savedActionStr) {
          // Clear immediately to prevent double processing
          await AsyncStorage.removeItem('@libreshop_pending_action');
          await AsyncStorage.removeItem('@libreshop_auth_intent');
          
          const action = JSON.parse(savedActionStr);
          
          // Execute the pending action
          if (action.type === 'ADD_TO_CART') {
            addItem(action.payload.product, action.payload.quantity);
            Alert.alert('Succès', 'Produit ajouté au panier !');
          } else if (action.type === 'BUY_NOW') {
            addItem(action.payload.product, action.payload.quantity);
            // Navigate to checkout with a short delay to let navigation tree mount
            setTimeout(() => {
              navigation.navigate('Checkout', { 
                items: [{ product: action.payload.product, quantity: action.payload.quantity }], 
                storeId: action.payload.product.store_id 
              });
            }, 500);
          } else if (action.type === 'CHECKOUT') {
            setTimeout(() => {
              navigation.navigate('Checkout');
            }, 500);
          } else if (action.type === 'LIKE_PRODUCT') {
            await productLikesService.toggleLike(user.id, action.payload.productId);
            Alert.alert('Succès', 'Produit ajouté à vos favoris !');
          } else if (action.type === 'FOLLOW_STORE') {
            await storeService.toggleFollow(user.id, action.payload.storeId);
            Alert.alert('Succès', 'Vous suivez maintenant cette boutique !');
          }
        }
      } catch (error) {
        console.error('Error resuming pending action on startup:', error);
      }
    };

    checkPendingActionOnStartup();
  }, [user]);

  return (
    <Modal
      visible={isAuthModalVisible}
      transparent
      animationType="fade"
      onRequestClose={hideAuthModal}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeBtn} onPress={hideAuthModal}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.logoBadge}>
                <Ionicons name="sparkles" size={28} color="#fff" />
              </View>
              <Text style={styles.title}>Connexion requise</Text>
              <Text style={styles.subtitle}>
                Veuillez vous connecter avec Google pour continuer votre action de manière sécurisée.
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
                  <Ionicons name="logo-google" size={20} color={COLORS.text} />
                  <Text style={styles.googleText}>Continuer avec Google</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.footerText}>
              En vous connectant, vous acceptez nos conditions d'utilisation.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContainer: {
    backgroundColor: COLORS.bg,
    width: Platform.OS === 'web' ? 420 : SCREEN_WIDTH - 40,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: SPACING.xs,
  },
  content: {
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    marginTop: SPACING.md,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.sm,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 14,
    width: '100%',
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  googleText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  footerText: {
    marginTop: SPACING.xl,
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 11,
  },
});
