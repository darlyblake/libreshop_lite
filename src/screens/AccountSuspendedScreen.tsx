import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { supabase } from '../lib/supabase';

export const AccountSuspendedScreen: React.FC = () => {
  const [suspensionReason, setSuspensionReason] = useState('');
  const [appealText, setAppealText] = useState('');
  const [loading, setLoading] = useState(false);
  const [appealSubmitted, setAppealSubmitted] = useState(false);

  useEffect(() => {
    loadSuspensionInfo();
  }, []);

  const loadSuspensionInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: userData } = await supabase
        .from('users')
        .select('suspension_reason')
        .eq('id', user.id)
        .single();
      if (userData) setSuspensionReason(userData.suspension_reason || 'Non spécifiée');
    } catch (e) {}
  };

  const handleSubmitAppeal = async () => {
    if (!appealText.trim()) {
      Alert.alert('Erreur', 'Veuillez écrire votre recours');
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error();
      await supabase.from('user_appeals').insert({
        user_id: user.id,
        appeal_text: appealText,
        status: 'pending',
      });
      setAppealSubmitted(true);
      Alert.alert('Succès', 'Recours envoyé');
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'envoyer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Ionicons name="warning-outline" size={80} color={COLORS.danger} style={styles.icon} />
        <Text style={styles.title}>Compte suspendu</Text>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Raison</Text>
          <Text style={styles.cardText}>{suspensionReason}</Text>
        </Card>
        {!appealSubmitted ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Faire un recours</Text>
            <TextInput
              style={styles.input}
              placeholder="Expliquez votre situation..."
              value={appealText}
              onChangeText={setAppealText}
              multiline
            />
            <Button title="Envoyer" onPress={handleSubmitAppeal} loading={loading} />
          </Card>
        ) : (
          <Card style={styles.card}>
            <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
            <Text style={styles.cardTitle}>Recours envoyé</Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { padding: SPACING.lg, alignItems: 'center' },
  icon: { marginBottom: SPACING.lg },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.lg },
  card: { width: '100%', padding: SPACING.md, marginBottom: SPACING.md },
  cardTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm },
  cardText: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  input: { backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: SPACING.md, minHeight: 120, marginBottom: SPACING.md },
});
