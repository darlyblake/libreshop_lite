import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { Button, Input } from '../components';
import { authService, storeService, supabase } from '../lib/supabase';
import { userService } from '../lib/userService';
import { sessionStorage } from '../lib/storage';
import { useAuthStore } from '../store';

export const SellerAuthScreen: React.FC = () => {
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
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
      }
      if (!formData.fullName) {
        newErrors.fullName = 'Nom complet requis';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const authHook = useAuthStore ? useAuthStore() : { setUser: () => {}, setSession: () => {} };
  const { setUser, setSession } = authHook;

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
          } else {
            await AsyncStorage.removeItem('@libreshop_auth_rate_limit');
          }
        }
      } catch (e) {
        console.warn('Error checking rate limit countdown:', e);
      }
    };
    checkStoredCountdown();
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Countdown effect
  useEffect(() => {
    if (countdown > 0) {
      countdownIntervalRef.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      // Store countdown timestamp for persistence
      const timestamp = Date.now() + (countdown - 1) * 1000;
      AsyncStorage.setItem('@libreshop_auth_rate_limit', timestamp.toString()).catch(e =>
        console.warn('Error storing rate limit countdown:', e)
      );
    } else if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
      AsyncStorage.removeItem('@libreshop_auth_rate_limit').catch(e =>
        console.warn('Error removing rate limit countdown:', e)
      );
    }
  }, [countdown]);

  const isRateLimited = countdown > 0;

  const handleSubmit = async () => {
    // Prevent double submission
    if (loading || isSubmittingRef.current) {
      console.warn('handleSubmit called while already loading/submitting');
      return;
    }

    // Rate limiting check
    if (isRateLimited) {
      Alert.alert(
        'Patientez',
        `Veuillez patienter ${countdown} seconde${countdown > 1 ? 's' : ''} avant de réessayer.`
      );
      return;
    }

    // Validate form before submitting
    if (!validateForm()) {
      return;
    }

    if (!normalizedEmail || !formData.password) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    // Mark as submitting immediately to prevent race conditions
    // IMPORTANT: Set ref BEFORE state update to block subsequent clicks immediately
    isSubmittingRef.current = true;
    setLoading(true);
    setError('');
    console.log('handleSubmit: marking as submitting, loading=', loading, 'ref=', isSubmittingRef.current);

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
                // Subscription expired or not visible → redirect to pricing
                console.warn('Seller subscription expired or not active', { 
                  storeId: store.id, 
                  subscriptionStatus: store.subscription_status,
                  visible: store.visible 
                });
                // Pass store info to PricingScreen so it shows renewal message
                navigation.replace('Pricing', { fromExpiredStore: true, storeName: store.name });
              } else {
                navigation.replace('SellerTabs');
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
          setEmailSentTo(normalizedEmail);
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
          } catch (e) {
            console.warn('could not create seller profile row', e);
          }
          navigation.replace('SellerAddStore');
        }
      }
    } catch (err: any) {
      console.error('auth error', err);
      
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
        setCountdown(countdownSeconds);
        
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
      // Get the redirect URL for deep linking
      const redirectUrl = Linking.createURL('auth/callback');
      
      // Initiate Google OAuth in Supabase
      const { data, error } = await supabase!.auth.signInWithOAuth({
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
      console.error('Google auth error:', err);
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
          // The session should be automatically set by Supabase
          const { data: { user }, error } = await supabase!.auth.getUser();
          
          if (error) {
            console.warn('Error getting user after OAuth:', error);
            return;
          }

          if (user) {
            const role = (user.user_metadata as any)?.role || 'client';
            await sessionStorage.saveUserRole(role);
            await sessionStorage.saveSession(user.id, user.email!);
            setUser(user as any);
            
            // Get the session
            const { data: { session } } = await supabase!.auth.getSession();
            setSession(session);

            // Try to create/get profile for sellers
            if (role === 'seller') {
              try {
                await userService.getOrCreateProfile(user.id);
                const store = await storeService.getByUser(user.id);
                if (!store) {
                  throw new Error('STORE_NOT_FOUND');
                }
                navigation.replace('SellerTabs');
              } catch {
                navigation.replace('SellerAddStore');
              }
            } else if (role === 'admin') {
              navigation.replace('AdminDashboard');
            } else {
              navigation.replace('ClientTabs');
            }
          }
        } catch (err) {
          console.error('Error handling OAuth redirect:', err);
          setError('❌ Erreur lors du traitement de la connexion Google');
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

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
                <Text style={styles.warningText}>Si vous ne recevez pas l'email, vérifiez votre dossier <Text style={{fontWeight: '700'}}>Spams</Text>.</Text>
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
                onPress={async () => {
                  if (!normalizedEmail) {
                    Alert.alert('Email requis', 'Entre ton email pour recevoir le lien de réinitialisation.');
                    return;
                  }
                  try {
                    setLoading(true);
                    await authService.resetPassword(normalizedEmail);
                    Alert.alert(
                      'Email envoyé',
                      "Si cet email existe, tu vas recevoir un lien pour réinitialiser ton mot de passe. Vérifie aussi les spams."
                    );
                  } catch (e: any) {
                    Alert.alert('Erreur', e?.message || 'Impossible de réinitialiser le mot de passe');
                  } finally {
                    setLoading(false);
                  }
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

const styles = StyleSheet.create({
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
});


