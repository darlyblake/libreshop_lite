import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, SPACING } from '../config/theme';

export function ResetPasswordScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const initialEmail = route.params?.email || '';

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If app opened via deep link, Supabase may include token in URL; handle externally if needed
  }, []);

  const resetPassword = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      // Verify OTP (recovery)
      if (!supabase) { Alert.alert('Erreur', 'Service non disponible'); setLoading(false); return; }
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' } as any);
      if (verifyError) {
        Alert.alert('Erreur', verifyError.message || 'Code invalide');
        setLoading(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase!.auth.updateUser({ password: newPassword } as any);
      if (updateError) {
        Alert.alert('Erreur', updateError.message || 'Impossible de mettre à jour le mot de passe');
        setLoading(false);
        return;
      }

      Alert.alert('Succès', 'Votre mot de passe a été mis à jour.');
      navigation.navigate('Login' as never);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Entrer le code</Text>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Code à 6 chiffres" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
      <TextInput style={styles.input} placeholder="Nouveau mot de passe" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
      <TextInput style={styles.input} placeholder="Confirmer mot de passe" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
      <TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={resetPassword} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'En cours...' : 'Changer le mot de passe'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.lg, backgroundColor: '#fff', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 12 },
  button: { backgroundColor: COLORS.primary || '#0b69ff', padding: 12, borderRadius: 8, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
