import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { supabase } from '../lib/supabase';

export const SellerEmailConfirmScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [message, setMessage] = useState('Vérification de votre email...');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    // Log for debugging
    // Log: 'SellerEmailConfirmScreen mounted';
    // Route params:: route.params;
    
    // Extract from URL query params as fallback for web
    const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const tokenFromUrl = urlParams.get('token_hash') || urlParams.get('token');
    const typeFromUrl = urlParams.get('type');
    
    setDebugInfo(`Token: ${tokenFromUrl}, Type: ${typeFromUrl}`);
    
    const confirmEmail = async () => {
      try {
        // Extract token and type from URL parameters - check both route params and URL params
        const token = route.params?.token || route.params?.token_hash || tokenFromUrl || '';
        const type = (route.params?.type || typeFromUrl || 'signup') as 'signup' | 'recovery';
        const email = route.params?.email || '';

        if (!token) {
          setMessage('❌ Jeton invalide. Veuillez utiliser le lien envoyé par email.\n\n' + debugInfo);
          setLoading(false);
          return;
        }

        // Confirming email with token:: type, token;

        // Verify the token with Supabase
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type as 'signup' | 'recovery',
        });

        if (error) {
          errorHandler.handleDatabaseError(error, 'Email confirmation error:');
          setMessage(`❌ Erreur: ${error.message}`);
          setSuccess(false);
          setLoading(false);
          return;
        }

        if (data?.user) {
          setMessage('✅ Email confirmé avec succès!');
          setSuccess(true);
          setLoading(false);

          // Wait 2 seconds then redirect to seller auth
          setTimeout(() => {
            Alert.alert(
              'Succès',
              'Votre email a été confirmé. Vous pouvez maintenant créer votre boutique!',
              [
                {
                  text: 'Continuer',
                  onPress: () => navigation.reset({
                    index: 0,
                    routes: [{ name: 'SellerAuth' }],
                  }),
                },
              ]
            );
          }, 1000);
        }
      } catch (err: any) {
        errorHandler.handleDatabaseError(err, 'Unexpected error during email confirmation:');
        setMessage(`❌ Erreur inattendue: ${err.message}`);
        setSuccess(false);
        setLoading(false);
      }
    };

    void confirmEmail();
  }, [route.params, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {loading ? (
          <>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.message}>{message}</Text>
            {debugInfo && <Text style={[styles.message, {fontSize: FONT_SIZE.sm, color: COLORS.textMuted}]}>{debugInfo}</Text>}
          </>
        ) : success ? (
          <>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.message}>{message}</Text>
          </>
        ) : (
          <>
            <Text style={styles.errorIcon}>!</Text>
            <Text style={styles.message}>{message}</Text>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  content: {
    alignItems: 'center',
    gap: SPACING.xl,
  },
  successIcon: {
    fontSize: 80,
    fontWeight: '800',
    color: COLORS.success,
  },
  errorIcon: {
    fontSize: 80,
    fontWeight: '800',
    color: COLORS.danger,
  },
  message: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 26,
  },
});