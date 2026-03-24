import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { BackToDashboard } from '../components/BackToDashboard';
import { useAuthStore } from '../store';
import { authService } from '../lib/supabase';
import { userService } from '../lib/userService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const AdminProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user, setUser, setSession } = useAuthStore();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');

  // load current user from store (or re‑fetch if needed)
  React.useEffect(() => {
    const load = async () => {
      if (!user) return;

      // Basic prefill from store (may be auth user)
      setName((user as any).full_name || '');
      setEmail((user as any).email || '');
      setWhatsappNumber((user as any).whatsapp_number || '');

      // Source of truth for settings: public.users profile row
      try {
        const profile = await userService.getOrCreateProfile((user as any).id);
        setName(profile.full_name || '');
        setEmail(profile.email);
        setWhatsappNumber(profile.whatsapp_number || '');
        setUser(profile as any);
      } catch (e: any) {
        errorHandler.handle(e, 'failed to load admin profile row', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
        // If RLS policy blocks access, the profile might not be accessible
        // but we can work with the auth user info for now
        if (e.code === '42501') {
          errorHandler.handle('RLS policy blocked access - ensure admin role is set in user_metadata', 'UnknownContext', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
        }
      }
    };

    void load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    try {
      // Upsert on backend (works even if the row doesn't exist yet)
      const updated = await userService.upsertProfile((user as any).id, {
        full_name: name,
        whatsapp_number: whatsappNumber,
      } as any);
      setUser(updated as any);
      Alert.alert('Profil mis à jour', 'Vos informations ont été enregistrées.');
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de sauvegarder.');
    }
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
    } catch {}
    setUser(null);
    setSession(null);
    navigation.replace('Landing');
  };

  return (
    <View style={styles.container}>
      <BackToDashboard navigation={navigation} />
      <Text style={styles.title}>Profil administrateur</Text>
      
      <Text style={styles.label}>Email</Text>
      <TextInput
        style={[styles.input, { backgroundColor: COLORS.border }]}
        value={email}
        editable={false}
      />

      <Text style={styles.label}>Nom complet</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Numéro WhatsApp</Text>
      <TextInput
        style={styles.input}
        value={whatsappNumber}
        onChangeText={setWhatsappNumber}
        placeholder="Ex: +2250700000000"
        placeholderTextColor={COLORS.textMuted}
        keyboardType="phone-pad"
      />
      
      {/* password change not yet implemented */}
      <Text style={styles.label}>Mot de passe (non modifiable ici)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: COLORS.border }]}
        value="••••••••"
        editable={false}
        secureTextEntry
      />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveText}>Enregistrer</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: SPACING.lg,
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    marginBottom: SPACING.xl,
    color: COLORS.text,
    textAlign: 'center',
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: '#FFFFFF',
    color: 'COLORS.bg',
    fontSize: FONT_SIZE.md,
  },
  saveButton: {
    backgroundColor: COLORS.accent,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  saveText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  logoutButton: {
    borderColor: COLORS.danger,
    borderWidth: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  logoutText: {
    color: COLORS.danger,
    fontWeight: '600',
  },
});