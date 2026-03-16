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
import { supabase } from '../lib/supabase';

export const SellerEmailConfirmScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [message, setMessage] = useState('Vérification de votre email...');
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        // Extract token and type from URL parameters
        const token = route.params?.token || '';
        const type = route.params?.type || 'signup';
        const email = route.params?.email || '';

        if (!token) {
          setMessage('❌ Jeton invalide. Veuillez utiliser le lien envoyé par email.');
          setLoading(false);
          return;
        }

        console.log('Confirming email with token:', type, token);

        // Verify the token with Supabase
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type as 'signup' | 'recovery',
        });

        if (error) {
          console.error('Email confirmation error:', error);
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
        console.error('Unexpected error during email confirmation:', err);
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