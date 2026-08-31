import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, SPACING } from '../config/theme';
import { authService } from '../services/authService';

export function ResetPasswordScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const initialEmail = route.params?.email || '';

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'request' | 'verify' | 'set'>('request');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const requestCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
      setError('Veuillez saisir une adresse e-mail valide.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await authService.resetPassword(normalizedEmail);
      setEmail(normalizedEmail);
      setStep('verify');
    } catch (e: any) {
      setError(e?.message || "Impossible d'envoyer le code.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('Le code doit contenir exactement 6 chiffres.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await authService.verifyPasswordResetOtp(email, code);
      setStep('set');
    } catch (e: any) {
      setError(e?.message || 'Code invalide ou expiré.');
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async () => {
    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await authService.updatePasswordAfterRecovery(newPassword);
      Alert.alert(
        'Mot de passe modifié',
        'Votre mot de passe a été réinitialisé avec succès.',
        [{ text: 'Se connecter', onPress: () => navigation.replace('SellerAuth') }]
      );
    } catch (e: any) {
      setError(e?.message || 'Impossible de mettre à jour le mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setResending(true);
    setError('');
    try {
      await authService.resendPasswordReset(normalizedEmail);
      setCode('');
      Alert.alert('Code envoyé', 'Un nouveau code de réinitialisation a été envoyé à votre adresse e-mail.');
    } catch (e: any) {
      setError(e?.message || "Impossible de renvoyer le code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Réinitialiser le mot de passe</Text>

      {step === 'request' && (
        <>
          <Text style={styles.description}>Saisissez votre adresse e-mail. Nous vous enverrons un code de validation à 6 chiffres.</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TouchableOpacity style={styles.button} onPress={requestCode} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Envoyer le code</Text>}
          </TouchableOpacity>
        </>
      )}

      {step === 'verify' && (
        <>
          <Text style={styles.description}>Entrez le code à 6 chiffres reçu par e-mail pour vérifier votre identité.</Text>
          <Text style={styles.email}>{email}</Text>
          <TextInput
            style={styles.input}
            placeholder="123456"
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
          />
          <TouchableOpacity style={styles.button} onPress={verifyCode} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Vérifier le code</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} onPress={resendCode} disabled={resending || loading}>
            <Text style={styles.linkText}>{resending ? 'Envoi...' : 'Renvoyer le code'}</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'set' && (
        <>
          <Text style={styles.description}>Choisissez maintenant votre nouveau mot de passe.</Text>
          <TextInput
            style={styles.input}
            placeholder="Nouveau mot de passe"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoComplete="new-password"
          />
          <TextInput
            style={styles.input}
            placeholder="Confirmer le mot de passe"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
          />
          <TouchableOpacity style={styles.button} onPress={updatePassword} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Réinitialiser le mot de passe</Text>}
          </TouchableOpacity>
        </>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.lg, backgroundColor: '#fff', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, color: COLORS.text },
  description: { fontSize: 15, lineHeight: 22, marginBottom: 14, color: COLORS.textMuted },
  email: { fontSize: 14, fontWeight: '600', marginBottom: 12, color: COLORS.text },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 13, borderRadius: 8, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: COLORS.primary || '#0b69ff', padding: 13, borderRadius: 8, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  linkButton: { alignItems: 'center', padding: 14 },
  linkText: { color: '#0b69ff', fontWeight: '600' },
  error: { color: '#c62828', marginTop: 14, textAlign: 'center' },
});
