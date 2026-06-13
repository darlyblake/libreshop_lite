import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { pointsService } from '../services/pointsService';
import { LinearGradient } from 'expo-linear-gradient';

export const AdminPointsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { getColor: COLORS, spacing: SPACING, radius: RADIUS } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState({
    CREATE_STORE: '50',
    SALE: '10',
    REFERRAL_INVITER: '100',
    REFERRAL_INVITEE: '50',
    SUBSCRIPTION_COST: '500' // on stockera en positif mais on déduira
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await pointsService.getPointSettings();
      if (Object.keys(data).length > 0) {
        setSettings({
          CREATE_STORE: (data['CREATE_STORE'] || 50).toString(),
          SALE: (data['SALE'] || 10).toString(),
          REFERRAL_INVITER: (data['REFERRAL_INVITER'] || 100).toString(),
          REFERRAL_INVITEE: (data['REFERRAL_INVITEE'] || 50).toString(),
          SUBSCRIPTION_COST: Math.abs(data['SUBSCRIPTION_COST'] || 500).toString(),
        });
      }
    } catch (err) {
      console.warn('Failed to load points settings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await pointsService.updatePointSettings({
        CREATE_STORE: parseInt(settings.CREATE_STORE) || 0,
        SALE: parseInt(settings.SALE) || 0,
        REFERRAL_INVITER: parseInt(settings.REFERRAL_INVITER) || 0,
        REFERRAL_INVITEE: parseInt(settings.REFERRAL_INVITEE) || 0,
        SUBSCRIPTION_COST: -(parseInt(settings.SUBSCRIPTION_COST) || 0), // Negative cost
      });
      Alert.alert('Succès', 'Les quotas de points ont été mis à jour.');
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de sauvegarder les modifications.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={[styles.header, { borderBottomColor: COLORS.border, backgroundColor: COLORS.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>Gestion des Points</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
        
        <LinearGradient colors={[COLORS.primary + '20', COLORS.bg]} style={styles.infoBanner}>
          <Ionicons name="star" size={24} color={COLORS.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.infoTitle, { color: COLORS.text }]}>Quotas de Récompense</Text>
            <Text style={[styles.infoDesc, { color: COLORS.textSoft }]}>
              Définissez combien de points gagnent les vendeurs pour chaque action.
            </Text>
          </View>
        </LinearGradient>

        <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>🏆 Actions Récompensées</Text>
          
          <View style={styles.inputGroup}>
            <View style={styles.labelContainer}>
              <Text style={[styles.label, { color: COLORS.text }]}>Création d'une Boutique</Text>
              <Text style={[styles.subLabel, { color: COLORS.textMuted }]}>Gains à l'ouverture</Text>
            </View>
            <TextInput
              style={[styles.input, { borderColor: COLORS.border, color: COLORS.text }]}
              value={settings.CREATE_STORE}
              onChangeText={(v) => setSettings({...settings, CREATE_STORE: v})}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelContainer}>
              <Text style={[styles.label, { color: COLORS.text }]}>Vente d'un Produit</Text>
              <Text style={[styles.subLabel, { color: COLORS.textMuted }]}>Par commande livrée</Text>
            </View>
            <TextInput
              style={[styles.input, { borderColor: COLORS.border, color: COLORS.text }]}
              value={settings.SALE}
              onChangeText={(v) => setSettings({...settings, SALE: v})}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>🤝 Programme Parrainage</Text>
          
          <View style={styles.inputGroup}>
            <View style={styles.labelContainer}>
              <Text style={[styles.label, { color: COLORS.text }]}>Gain du Parrain</Text>
              <Text style={[styles.subLabel, { color: COLORS.textMuted }]}>Quand il invite quelqu'un</Text>
            </View>
            <TextInput
              style={[styles.input, { borderColor: COLORS.border, color: COLORS.text }]}
              value={settings.REFERRAL_INVITER}
              onChangeText={(v) => setSettings({...settings, REFERRAL_INVITER: v})}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelContainer}>
              <Text style={[styles.label, { color: COLORS.text }]}>Gain du Filleul</Text>
              <Text style={[styles.subLabel, { color: COLORS.textMuted }]}>En s'inscrivant avec le code</Text>
            </View>
            <TextInput
              style={[styles.input, { borderColor: COLORS.border, color: COLORS.text }]}
              value={settings.REFERRAL_INVITEE}
              onChangeText={(v) => setSettings({...settings, REFERRAL_INVITEE: v})}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>💳 Dépense des points</Text>
          
          <View style={styles.inputGroup}>
            <View style={styles.labelContainer}>
              <Text style={[styles.label, { color: COLORS.text }]}>Coût d'un Abonnement Mensuel</Text>
              <Text style={[styles.subLabel, { color: COLORS.textMuted }]}>Montant à déduire pour 1 mois</Text>
            </View>
            <TextInput
              style={[styles.input, { borderColor: COLORS.border, color: COLORS.text }]}
              value={settings.SUBSCRIPTION_COST}
              onChangeText={(v) => setSettings({...settings, SUBSCRIPTION_COST: v})}
              keyboardType="numeric"
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.saveBtn, { backgroundColor: COLORS.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Enregistrer les quotas</Text>
          )}
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  backBtn: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  infoDesc: {
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 16,
  },
  inputGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  labelContainer: {
    flex: 1,
    paddingRight: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  subLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  input: {
    width: 100,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  saveBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  }
});
