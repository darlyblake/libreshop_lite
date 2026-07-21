import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { Button, Input } from '../components';
// import { supabase } from '../lib/supabase'; // Removed unused import
import { authService } from '../services/authService';
import { supabase } from '../lib/supabase';
import { storeService } from '../services/storeService';
import { userService } from '../services/userService';
import { sessionStorage } from '../lib/storage';
import { useAuthStore } from '../store';
import { settingsService } from '../services/settingsService';
import { useLegacyPalette } from '../hooks/useLegacyPalette';
import { useTheme } from '../hooks/useTheme';

export const SellerAuthScreen: React.FC = () => {
  const COLORS = useLegacyPalette();
  const { spacing: SPACING, radius: RADIUS, fontSize: FONT_SIZE } = useTheme();
  const styles = React.useMemo(() => createSellerAuthStyles(COLORS, SPACING, RADIUS, FONT_SIZE), [COLORS, SPACING, RADIUS, FONT_SIZE]);

  const navigation = useNavigation<any>();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState(''); // État pour afficher l'écran de confirmation
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [requireEmailConfirmation, setRequireEmailConfirmation] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'verify' | 'set'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSentViaLink, setResetSentViaLink] = useState(false);
  

  // Charger les paramètres au montage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const val = await settingsService.getSetting('requireEmailConfirmation', true);
        setRequireEmailConfirmation(val);
      } catch (e: any) {
        console.error('Error loading requireEmailConfirmation setting:', e);
      }
    };
    loadSettings();
  }, []);

  const RESET_COOLDOWN = 600; // 10 minutes default between reset requests

  const setRateLimit = async (seconds: number) => {
    try {
      setCountdown(seconds);
      const timestamp = Date.now() + seconds * 1000;
      await AsyncStorage.setItem('@libreshop_auth_rate_limit', timestamp.toString());
      if (!countdownIntervalRef.current) {
        countdownIntervalRef.current = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current as NodeJS.Timeout);
                countdownIntervalRef.current = null;
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (e) {
      // ignore storage errors
    }
  };

  const closeResetModal = () => {
    try {
      if (typeof document !== 'undefined' && document.activeElement) {
        try { (document.activeElement as HTMLElement).blur(); } catch (err) {}
      }
    } catch (e) {
      // ignore in native
    }
    setShowResetModal(false);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email) {
      newErrors.email = 'Email requis';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }
    
    if (!formData.password) {
      newErrors.password = 'Mot de passe requis';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Le mot de passe doit contenir au moins 6 caractères';
    }
    
    if (!isLogin) {
      // Comparer les mots de passe avec trim() pour éviter les erreurs d'espaces invisibles
      if (formData.password.trim() !== formData.confirmPassword.trim()) {
        newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
      }
      if (!formData.fullName.trim()) {
        newErrors.fullName = 'Nom complet requis';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const authHook = useAuthStore ? useAuthStore() : { setUser: () => {}, setSession: () => {}, user: null };
  const { setUser, setSession, user } = authHook as any;

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Redirection automatique si l'utilisateur est déjà connecté
  useEffect(() => {
    const checkExistingUser = async () => {
      try {
        // Toujours vérifier la session la plus fraîche côté DB plutôt que le store seul
        if (!supabase) return;
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser?.id) {
          // Vérifier si l'utilisateur a déjà une boutique
          const stores = await storeService.getStoresByUser(currentUser.id);
          if (stores && stores.length > 0) {
             await sessionStorage.saveUserRole('seller');
             if (!storeService.isSubscriptionActive(stores[0])) {
               navigation.replace('SubscriptionExpired');
             } else {
               navigation.replace('SellerHub');
             }
          } else {
             // Connecté mais pas de boutique
             await sessionStorage.saveUserRole('seller');
             navigation.replace('SellerAddStore');
          }
        } else {
          setIsCheckingAuth(false);
        }
      } catch (e) {
        setIsCheckingAuth(false);
      }
    };
    checkExistingUser();
  }, [navigation]);

  const normalizedEmail = (formData.email || '').trim().toLowerCase();

  // Rate limiting: countdown timer when rate limited
  const [countdown, setCountdown] = useState<number>(0);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSubmittingRef = useRef(false); // Prevent double submission

  // Initialize countdown from storage on mount
  useEffect(() => {
    const checkStoredCountdown = async () => {
      try {
        const stored = await AsyncStorage.getItem('@libreshop_auth_rate_limit');
        if (stored) {
          const timestamp = parseInt(stored, 10);
          const remaining = Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
          if (remaining > 0) {
            setCountdown(remaining);
            // start a ticking interval to update the countdown
            if (!countdownIntervalRef.current) {
              countdownIntervalRef.current = setInterval(() => {
                setCountdown((prev) => {
                  if (prev <= 1) {
                    if (countdownIntervalRef.current) {
                      clearInterval(countdownIntervalRef.current as NodeJS.Timeout);
                      countdownIntervalRef.current = null;
                    }
                    return 0;
                  }
                  return prev - 1;
                });
              }, 1000);
            }
          }
        }
      } catch (e) {
        console.error('Error reading rate limit from storage', e);
      }
    };

    checkStoredCountdown();

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current as NodeJS.Timeout);
        countdownIntervalRef.current = null;
      }
    };
  }, []);

  // Submit handler
  const handleSubmit = async () => {
    // Mark as submitting immediately to prevent race conditions
    // IMPORTANT: Set ref BEFORE state update to block subsequent clicks immediately
    isSubmittingRef.current = true;
    setLoading(true);
    setError('');
    // handleSubmit: marking as submitting, loading=: loading, 'ref=', isSubmittingRef.current;

    try {
      if (isLogin) {
        // connexion
        const res = await authService.signIn(normalizedEmail, formData.password);
        const user = res.user;
        if (user) {
          // user_metadata contient le rôle
          const role = (user.user_metadata as any)?.role || 'client';
          await sessionStorage.saveUserRole(role);
          await sessionStorage.saveSession(user.id, user.email!);
          setUser(user as any);
          setSession(res.session);
          // rediriger selon rôle
          if (role === 'seller') {
            try {
              await userService.getOrCreateProfile(user.id);
              const store = await storeService.getByUser(user.id);
              if (!store) {
                throw new Error('STORE_NOT_FOUND');
              }
              // Check if subscription is active (not expired and visible)
              if (!storeService.isSubscriptionActive(store)) {
                // Subscription expired or not visible → redirect to Pricing directly
                navigation.replace('SubscriptionExpired');
              } else {
                navigation.replace('SellerHub');
              }
            } catch {
              navigation.replace('SellerAddStore');
            }
          } else if (role === 'admin') {
            navigation.replace('AdminDashboard');
          } else {
            navigation.replace('ClientTabs');
          }
        }
      } else {
        // inscription - par défaut un vendeur sur cet écran
        const res = await authService.signUp(
          normalizedEmail,
          formData.password,
          formData.fullName,
          'seller'
        );
        const user = res.user;

        // If email confirmation is enabled in Supabase, signUp returns no session
        // until the user clicks the confirmation link.
        if (!res.session) {
          if (requireEmailConfirmation) {
            setEmailSentTo(normalizedEmail);
          } else {
            // Si la confirmation n'est pas "exigée" dans l'UI (même si Supabase l'attend)
            // On demande à l'utilisateur de se connecter directement
            Alert.alert(
              'Compte créé',
              'Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter.',
              [
                {
                  text: 'Se connecter',
                  onPress: () => {
                    setIsLogin(true);
                    setFormData({ ...formData, password: '', confirmPassword: '', fullName: '' });
                  }
                }
              ]
            );
          }
          setLoading(false);
          isSubmittingRef.current = false;
          return;
        }

        if (user) {
          await sessionStorage.saveUserRole('seller');
          await sessionStorage.saveSession(user.id, user.email!);
          setUser(user as any);
          setSession(res.session);
          try {
            await userService.getOrCreateProfile(user.id);
          } catch (e: any) {
            errorHandler.handle(e, 'could not create seller profile row', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
          }
          navigation.replace('SellerHub');
        }
      }
    } catch (err: any) {
      errorHandler.handleDatabaseError(err, 'auth error');
      
      // Messages d'erreur plus clairs selon le type d'erreur
      if (err.message?.includes('Failed to fetch') || err.message?.includes('ERR_NAME_NOT_RESOLVED')) {
        setError('❌ Erreur de connexion à Supabase. Veuillez vérifier votre configuration du projet Supabase dans le fichier .env');
      } else if (String(err?.message || '').toLowerCase().includes('email not confirmed')) {
        Alert.alert(
          'Email non confirmé',
          "Vous devez confirmer votre email avant de vous connecter. Vérifiez votre boîte mail (et les spams).\n\nSouhaitez-vous renvoyer l'email de confirmation ?",
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Renvoyer',
              onPress: async () => {
                try {
                  setLoading(true);
                  await authService.resendSignupConfirmation(formData.email);
                  Alert.alert(
                    'Email envoyé',
                    "Un nouvel email de confirmation vient d'être envoyé."
                  );
                } catch (e: any) {
                  Alert.alert(
                    'Erreur',
                    `Impossible de renvoyer l'email: ${e?.message || 'Erreur inconnue'}`
                  );
                } finally {
                  setLoading(false);
                }
              },
            },
          ]
        );
        setError('❌ Email non confirmé. Confirmez votre email puis réessayez.');
      } else if (err.message?.includes('Invalid login credentials')) {
        setError('❌ Email ou mot de passe incorrect');
      } else if (
        err.message?.includes('rate limit') || 
        String(err?.message || '').toLowerCase().includes('email rate limit') ||
        String(err?.message || '').toLowerCase().includes('too many requests') ||
        String(err?.message || '').toLowerCase().includes('over_request_rate_limit')
      ) {
        // Determine wait time from error message or use default longer periods
        let waitTime = 'quelques minutes';
        let countdownSeconds = 600; // 10 minutes default for email rate limits
        
        if (err.message?.includes('1 hour') || err.message?.includes('3600')) {
          waitTime = '1 heure';
          countdownSeconds = 3600;
        } else if (err.message?.includes('15 minutes') || err.message?.includes('900')) {
          waitTime = '15 minutes';
          countdownSeconds = 900;
        } else if (err.message?.includes('30 minutes') || err.message?.includes('1800')) {
          waitTime = '30 minutes';
          countdownSeconds = 1800;
        } else if (err.message?.includes('5 minutes') || err.message?.includes('300')) {
          waitTime = '5 minutes';
          countdownSeconds = 300;
        }
        
        setError(`⏳ Trop de tentatives. Veuillez patienter ${waitTime} avant de réessayer.`);
        setRateLimit(countdownSeconds);
        
        Alert.alert(
          'Trop de tentatives',
          `Vous avez envoyé trop de demandes. Veuillez attendre au moins ${waitTime} avant de réessayer.\n\nCela inclut les tentatives de connexion ET d'inscription. Si vous aviez un compte, essayez simplement de vous connecter.`
        );
      } else if (err.message?.includes('User already registered')) {
        setError('❌ Cet email est déjà utilisé. Essayez de vous connecter');
      } else {
        setError(`❌ Erreur: ${err.message || 'Une erreur est survenue'}`);
      }
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Handle Google OAuth
  const handleGoogleSignIn = async () => {
    // Prevent double submission
    if (loading || isSubmittingRef.current) return;

    // Mark as submitting immediately
    isSubmittingRef.current = true;
    setLoading(true);
    setError('');

    try {
      await AsyncStorage.setItem('@libreshop_auth_intent', 'seller');
      // Get the redirect URL for deep linking
      const redirectUrl = Linking.createURL('auth/callback');
      
      // Initiate Google OAuth in authService
      await authService.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
        },
      });

      if (error) {
        throw error;
      }

      // The OAuth flow will redirect through the browser
      Alert.alert('Redirection', 'Vous allez être redirigé vers Google pour vous connecter.');
    } catch (err: any) {
      errorHandler.handleDatabaseError(err, 'Google auth error:');
      Alert.alert(
        'Erreur Google',
        err?.message || 'Impossible de se connecter avec Google. Essayer avec email/mot de passe.'
      );
      setError('❌ Erreur lors de la connexion Google');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Listen for OAuth redirect
  useEffect(() => {
    const subscription = Linking.addEventListener('url', async ({ url }) => {
      if (url.includes('auth/callback')) {
        // OAuth redirect detected
        try {
          // The user should be automatically set by Supabase
          const user = await authService.getCurrentUser();
          
          if (user) {
            const role = (user.user_metadata as any)?.role || 'client';
            await sessionStorage.saveUserRole(role);
            await sessionStorage.saveSession(user.id, user.email!);
            setUser(user as any);
            
            // Get the session
            const sessionData = await authService.getSession();
            const session = sessionData.session;
            setSession(session);

            // Try to create/get profile for sellers
            if (role === 'seller') {
              try {
                await userService.getOrCreateProfile(user.id);
                const store = await storeService.getByUser(user.id);
                if (!store) {
                  throw new Error('STORE_NOT_FOUND');
                }
                
                // Check if subscription is active
                if (!storeService.isSubscriptionActive(store)) {
                  navigation.replace('SubscriptionExpired');
                } else {
                  navigation.replace('SellerHub');
                }
              } catch {
                navigation.replace('SellerAddStore');
              }
            } else if (role === 'admin') {
              navigation.replace('AdminDashboard');
            } else {
              navigation.replace('ClientTabs');
            }
          }
        } catch (err: any) {
          errorHandler.handleDatabaseError(err, 'Error handling OAuth redirect:');
          setError('❌ Erreur lors du traitement de la connexion Google');
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Afficher un loader pendant la vérification d'authentification
  if (isCheckingAuth) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ color: COLORS.textMuted, marginTop: 16, fontSize: 14 }}>
          Vérification de votre session...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Écran de confirmation d'email après inscription */}
      {emailSentTo ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setEmailSentTo('');
                setFormData({ email: '', password: '', confirmPassword: '', fullName: '' });
              }}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.emailConfirmContainer}>
            {/* Checkmark icon */}
            <View style={styles.checkmarkCircle}>
              <Text style={styles.checkmark}>✓</Text>
            </View>

            {/* Title */}
            <Text style={styles.emailConfirmTitle}>Email envoyé avec succès!</Text>

            {/* Email display */}
            <View style={styles.emailBox}>
              <Text style={styles.emailLabel}>Email de confirmation envoyé à:</Text>
              <Text style={styles.emailAddress}>{emailSentTo}</Text>
            </View>

            {/* Steps */}
            <View style={styles.stepsContainer}>
              <Text style={styles.stepsTitle}>📋 Étapes à suivre:</Text>
              
              <View style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Ouvrez votre email</Text>
                  <Text style={styles.stepDescription}>Consultez votre boîte mail pour le message de confirmation</Text>
                </View>
              </View>

              <View style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Cliquez sur le lien</Text>
                  <Text style={styles.stepDescription}>Appuyez sur "Confirmer mon adresse email" dans le message</Text>
                </View>
              </View>

              <View style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Revenez ici</Text>
                  <Text style={styles.stepDescription}>Après la confirmation, vous serez redirigé automatiquement</Text>
                </View>
              </View>

              <View style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>4</Text></View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Connectez-vous</Text>
                  <Text style={styles.stepDescription}>Entrez vos identifiants pour accéder à votre compte</Text>
                </View>
              </View>

              <View style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>5</Text></View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Créez votre boutique</Text>
                  <Text style={styles.stepDescription}>Complétez les infos de votre boutique et lancez-vous!</Text>
                </View>
              </View>
            </View>

            {/* Warning */}
            <View style={styles.warningBox}>
              <Ionicons name="alert-circle" size={20} color={COLORS.warning} />
              <View style={{ flex: 1, marginLeft: SPACING.md }}>
                <Text style={styles.warningText}>Si vous ne recevez pas l'email, vérifiez votre dossier <Text style={{fontWeight: '700'}}>Spams.</Text></Text>
              </View>
            </View>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <Button
                title="J'ai confirmé mon email"
                onPress={() => {
                  setEmailSentTo('');
                  setIsLogin(true);
                  setFormData({ ...formData, password: '', confirmPassword: '', fullName: '' });
                }}
                loading={false}
              />
              
              <TouchableOpacity
                style={styles.resendButton}
                onPress={async () => {
                  try {
                    setLoading(true);
                    await authService.resendSignupConfirmation(emailSentTo);
                    Alert.alert(
                      '✅ Email renvoyé',
                      'Un nouvel email de confirmation vient d\'être envoyé. Vérifiez votre boîte mail.'
                    );
                  } catch (e: any) {
                    Alert.alert(
                      '❌ Erreur',
                      `Impossible de renvoyer l'email: ${e?.message || 'Erreur inconnue'}`
                    );
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
              >
                <Text style={styles.resendButtonText}>
                  {loading ? 'Envoi en cours...' : 'Renvoyer l\'email'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : (
        /* Écran normal d'authentification */
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.navigate('Landing')}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>
              {isLogin ? 'Bienvenue vendeur' : 'Créer un compte'}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin
                ? 'Connectez-vous pour gérer votre boutique'
                : 'Rejoignez LibreShop pour créer votre boutique'}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {!isLogin && (
              <Input
                label="Nom complet"
                placeholder="Votre nom complet"
                value={formData.fullName}
                onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                icon="person-outline"
                error={errors.fullName}
              />
            )}
            
            <Input
              label="Email"
              placeholder="votre@email.com"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              icon="mail-outline"
              error={errors.email}
            />
            
            <Input
              label="Mot de passe"
              placeholder="••••••••"
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              secureTextEntry
              icon="lock-closed-outline"
              error={errors.password}
            />
            
            {!isLogin && (
              <Input
                label="Confirmer le mot de passe"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                secureTextEntry
                icon="lock-closed-outline"
                error={errors.confirmPassword}
              />
            )}

            {isLogin && (
              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={() => {
                  setResetEmail(normalizedEmail);
                  setResetStep('request');
                  setResetError('');
                  setShowResetModal(true);
                }}
              >
                <Text style={styles.forgotPasswordText}>
                  Mot de passe oublié ?
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Message d'erreur général */}
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            {/* Reset password modal (request -> verify -> set new password) */}
            <Modal visible={showResetModal} transparent animationType="slide">
              <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { width: '92%', maxWidth: 520 }]}>
                  <Text style={[styles.modalTitle, { marginBottom: 8 }]}>Réinitialiser le mot de passe</Text>
                  {resetStep === 'request' && (
                    <>
                      <Text style={{ marginBottom: 8 }}>Entrez votre email pour recevoir un code de réinitialisation.</Text>
                      <Input
                        label="Email"
                        placeholder="votre@email.com"
                        value={resetEmail}
                        onChangeText={setResetEmail}
                        keyboardType="email-address"
                      />
                      {resetError ? <Text style={styles.errorText}>{resetError}</Text> : null}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={closeResetModal}>
                          <Text style={styles.cancelText}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.button, styles.submitButton]}
                          onPress={async () => {
                            if (!resetEmail || !/\S+@\S+\.\S+/.test(resetEmail)) { setResetError('Email invalide'); return; }
                            setResetLoading(true); setResetError('');
                            try {
                              const webBaseUrl = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || '').replace(/\/+$/, '');
                              const redirectTo = webBaseUrl ? `${webBaseUrl}/auth/reset` : Linking.createURL('auth/reset');
                              // Use Supabase server to generate & send OTP (server-side)
                              if (!supabase) { setResetError('Service non disponible'); return; }
                              const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo } as any);
                              if (error) throw error;
                              // Server sent the email (may be OTP or link depending on template)
                              setResetSentViaLink(true);
                              setResetStep('verify');
                              setRateLimit(RESET_COOLDOWN);
                            } catch (e: any) {
                              setResetError(e?.message || 'Impossible d\'envoyer le code');
                            } finally { setResetLoading(false); }
                          }}
                        >
                          <Text style={styles.submitText}>{resetLoading ? 'Envoi...' : 'Envoyer le code'}</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {resetStep === 'verify' && (
                    <>
                      <Text style={{ marginBottom: 8 }}>Saisissez le code reçu par email (si présent), ou cliquez sur le lien dans l'email envoyé.</Text>
                      <Input label="Code" placeholder="123456" value={resetCode} onChangeText={setResetCode} />
                      {resetError ? <Text style={styles.errorText}>{resetError}</Text> : null}
                      {resetSentViaLink && (
                        <Text style={{ marginTop: 8, color: '#444' }}>
                          Astuce: si l'email ne contient pas de code mais un lien, cliquez dessus pour revenir à l'application.
                        </Text>
                      )}
                        <TouchableOpacity style={{ marginTop: 8 }} onPress={() => {
                        // User reports they clicked the link — close modal and prompt to re-open login
                        closeResetModal();
                        Alert.alert('Ok', 'Si vous avez cliqué sur le lien, essayez de vous reconnecter maintenant.');
                      }}>
                        <Text style={{ color: '#0b69ff' }}>J'ai cliqué sur le lien dans l'email</Text>
                      </TouchableOpacity>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={closeResetModal}>
                          <Text style={styles.cancelText}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.button, styles.submitButton]}
                          onPress={async () => {
                            if (!resetCode) { setResetError('Entrez le code'); return; }
                            setResetLoading(true); setResetError('');
                            try {
                              if (!supabase) { setResetError('Service non disponible'); return; }
                              const { error } = await supabase.auth.verifyOtp({ email: resetEmail, token: resetCode, type: 'recovery' } as any);
                              if (error) throw error;
                              setResetStep('set');
                            } catch (e: any) {
                              setResetError(e?.message || 'Code invalide');
                            } finally { setResetLoading(false); }
                          }}
                        >
                          <Text style={styles.submitText}>{resetLoading ? 'Vérification...' : 'Vérifier le code'}</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {resetStep === 'set' && (
                    <>
                      <Text style={{ marginBottom: 8 }}>Entrez votre nouveau mot de passe.</Text>
                      <Input label="Nouveau mot de passe" placeholder="••••••••" value={resetNewPassword} onChangeText={setResetNewPassword} secureTextEntry />
                      <Input label="Confirmer" placeholder="••••••••" value={resetConfirmPassword} onChangeText={setResetConfirmPassword} secureTextEntry />
                      {resetError ? <Text style={styles.errorText}>{resetError}</Text> : null}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={closeResetModal}>
                          <Text style={styles.cancelText}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.button, styles.submitButton]}
                          onPress={async () => {
                            if (!resetNewPassword || resetNewPassword.length < 6) { setResetError('Mot de passe trop court'); return; }
                            if (resetNewPassword !== resetConfirmPassword) { setResetError('Les mots de passe ne correspondent pas'); return; }
                            setResetLoading(true); setResetError('');
                            try {
                              if (!supabase) { setResetError('Service non disponible'); return; }
                              const { error } = await supabase.auth.updateUser({ password: resetNewPassword } as any);
                              if (error) throw error;
                              Alert.alert('Mot de passe modifié', 'Votre mot de passe a été mis à jour. Vous pouvez maintenant vous connecter.');
                              closeResetModal();
                            } catch (e: any) {
                              setResetError(e?.message || 'Impossible de mettre à jour le mot de passe');
                            } finally { setResetLoading(false); }
                          }}
                        >
                          <Text style={styles.submitText}>{resetLoading ? 'En cours...' : 'Mettre à jour'}</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              </View>
            </Modal>

            <Button
              title={isLogin ? 'Se connecter' : 'Créer un compte'}
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              variant="primary"
              size="large"
              style={styles.submitButton}
            />
          </View>

          {/* Toggle */}
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleText}>
              {isLogin ? "Pas encore de compte ?" : 'Déjà un compte ?'}
            </Text>
            <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
              <Text style={styles.toggleLink}>
                {isLogin ? ' S\'inscrire' : ' Se connecter'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Login */}
          <View style={styles.socialContainer}>
            <Button
              title="Continuer avec Google"
              onPress={handleGoogleSignIn}
              loading={loading}
              disabled={loading}
              variant="outline"
              size="large"
              icon={<Ionicons name="logo-google" size={20} color={COLORS.text} />}
              style={styles.socialButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      )}
    </View>
  );
};

const createSellerAuthStyles = (COLORS: any, SPACING: any, RADIUS: any, FONT_SIZE: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  header: {
    paddingTop: SPACING.xxl,
    marginBottom: SPACING.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    marginBottom: SPACING.xxxl,
  },
  title: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSoft,
    lineHeight: 24,
  },
  form: {
    marginBottom: SPACING.xl,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.xl,
  },
  forgotPasswordText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: '500',
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.danger,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: SPACING.md,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
  },
  toggleLink: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.xxxl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginHorizontal: SPACING.lg,
  },
  socialContainer: {},
  socialButton: {
    flexDirection: 'row-reverse',
  },
  // Email confirmation screen styles
  emailConfirmContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  checkmarkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.success + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xxxl,
  },
  checkmark: {
    fontSize: 60,
    fontWeight: '800',
    color: COLORS.success,
  },
  emailConfirmTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  emailBox: {
    backgroundColor: COLORS.accent + '15',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xxxl,
    width: '100%',
    alignItems: 'center',
  },
  emailLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  emailAddress: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.accent,
  },
  stepsContainer: {
    width: '100%',
    marginBottom: SPACING.xxxl,
  },
  stepsTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  step: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    marginTop: 2,
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT_SIZE.md,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  stepDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.warning + '20',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xxxl,
    alignItems: 'flex-start',
  },
  warningText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.warning,
    lineHeight: 18,
  },
  buttonContainer: {
    gap: SPACING.md,
  },
  resendButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    opacity: 0.7,
  },
  resendButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.accent,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.bgElevated || COLORS.bg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  button: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resetSubmitButton: {
    backgroundColor: COLORS.accent,
  },
  cancelText: {
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
  },
});


