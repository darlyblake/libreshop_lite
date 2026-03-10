import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { RootStackParamList } from '../navigation/types';
import { Card } from '../components/Card';
import { BackToDashboard } from '../components/BackToDashboard';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SettingItem {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  type: 'toggle' | 'navigation' | 'action';
  value?: boolean;
  onPress?: () => void;
}

export const AdminSettingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    emailNotifications: true,
    pushNotifications: true,
    autoApproveStores: false,
    requireVerification: true,
  });
  const [whatsappNumber, setWhatsappNumber] = useState('');

  const updateSetting = (key: keyof typeof settings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const generalSettings: SettingItem[] = [
    {
      title: 'Mode maintenance',
      subtitle: 'Mettre le site en maintenance',
      icon: 'construct-outline',
      type: 'toggle',
      value: settings.maintenanceMode,
      onPress: () => updateSetting('maintenanceMode', !settings.maintenanceMode),
    },
    {
      title: 'Approbation automatique',
      subtitle: 'Approuver les boutiques automatiquement',
      icon: 'checkmark-circle-outline',
      type: 'toggle',
      value: settings.autoApproveStores,
      onPress: () => updateSetting('autoApproveStores', !settings.autoApproveStores),
    },
    {
      title: 'Vérification obligatoire',
      subtitle: 'Exiger la vérification des vendeurs',
      icon: 'shield-checkmark-outline',
      type: 'toggle',
      value: settings.requireVerification,
      onPress: () => updateSetting('requireVerification', !settings.requireVerification),
    },
  ];

  const notificationSettings: SettingItem[] = [
    {
      title: 'Notifications email',
      subtitle: 'Recevoir les notifications par email',
      icon: 'mail-outline',
      type: 'toggle',
      value: settings.emailNotifications,
      onPress: () => updateSetting('emailNotifications', !settings.emailNotifications),
    },
    {
      title: 'Notifications push',
      subtitle: 'Recevoir les notifications push',
      icon: 'notifications-outline',
      type: 'toggle',
      value: settings.pushNotifications,
      onPress: () => updateSetting('pushNotifications', !settings.pushNotifications),
    },
  ];

  const otherSettings: SettingItem[] = [
    {
      title: 'Gestion des catégories',
      subtitle: 'Ajouter, modifier ou supprimer des catégories',
      icon: 'grid-outline',
      type: 'navigation',
      onPress: () => {},
    },
    {
      title: 'Politiques et conditions',
      subtitle: 'Modifier les politiques du site',
      icon: 'document-text-outline',
      type: 'navigation',
      onPress: () => {},
    },
    {
      title: 'Support technique',
      subtitle: 'Contacter le support',
      icon: 'help-circle-outline',
      type: 'navigation',
      onPress: () => {},
    },
    {
      title: 'À propos',
      subtitle: 'Version 1.0.0',
      icon: 'information-circle-outline',
      type: 'navigation',
      onPress: () => {},
    },
  ];

  const saveWhatsappNumber = () => {
    const num = whatsappNumber.trim();
    if (!num) {
      Alert.alert('Erreur', "Le numéro WhatsApp ne peut pas être vide.");
      return;
    }
    // Basic validation: allow digits, spaces, + and -
    if (!/^\+?[0-9 \-]+$/.test(num)) {
      Alert.alert('Erreur', 'Format de numéro invalide. Utilisez seulement chiffres et +.');
      return;
    }

    // Ici on sauvegarde localement — remplacer par persistance backend si nécessaire
    Alert.alert('Succès', `Numéro WhatsApp mis à jour: ${num}`);
  };

  const handleDangerAction = (title: string) => {
    Alert.alert(
      'Action irréversible',
      `Êtes-vous sûr de vouloir ${title.toLowerCase()} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', style: 'destructive' },
      ]
    );
  };

  const renderSettingItem = (item: SettingItem, index: number) => (
    <TouchableOpacity
      key={index}
      style={styles.settingItem}
      onPress={item.type !== 'toggle' ? item.onPress : undefined}
      disabled={item.type === 'toggle'}
    >
      <View style={styles.settingIcon}>
        <Ionicons name={item.icon} size={22} color={COLORS.accent} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{item.title}</Text>
        {item.subtitle && (
          <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
        )}
      </View>
      {item.type === 'toggle' ? (
        <Switch
          value={item.value}
          onValueChange={item.onPress}
          trackColor={{ false: COLORS.border, true: COLORS.accent + '60' }}
          thumbColor={item.value ? COLORS.accent : COLORS.textMuted}
        />
      ) : (
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <BackToDashboard navigation={navigation} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* General Settings */}
        <Text style={styles.sectionTitle}>Général</Text>
        <Card style={styles.section}>
          {generalSettings.map((item, index) => renderSettingItem(item, index))}
        </Card>

        {/* Notifications */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        <Card style={styles.section}>
          {notificationSettings.map((item, index) => renderSettingItem(item, index))}
        </Card>

        {/* Other Settings */}
        <Text style={styles.sectionTitle}>Autres</Text>
        <Card style={styles.section}>
          {otherSettings.map((item, index) => renderSettingItem(item, index))}
        </Card>

        {/* WhatsApp contact for admins */}
        <Text style={styles.sectionTitle}>Contact WhatsApp</Text>
        <Card style={styles.section}>
          <View style={styles.whatsappRow}>
            <TextInput
              style={styles.whatsappInput}
              placeholder="Numéro WhatsApp"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
              value={whatsappNumber}
              onChangeText={setWhatsappNumber}
            />
            <TouchableOpacity style={styles.whatsappButton} onPress={saveWhatsappNumber}>
              <Text style={styles.whatsappButtonText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Danger Zone */}
        <Text style={styles.sectionTitle}>Zone dangereuse</Text>
        <Card style={[styles.section, { borderColor: COLORS.danger + '40' }]}>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => handleDangerAction('réinitialiser toutes les données')}
          >
            <View style={[styles.settingIcon, { backgroundColor: COLORS.danger + '20' }]}>
              <Ionicons name="refresh-outline" size={22} color={COLORS.danger} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingTitle, { color: COLORS.danger }]}>
                Réinitialiser les données
              </Text>
              <Text style={styles.settingSubtitle}>
                Effacer toutes les données du site
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.danger} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => handleDangerAction('supprimer le compte admin')}
          >
            <View style={[styles.settingIcon, { backgroundColor: COLORS.danger + '20' }]}>
              <Ionicons name="trash-outline" size={22} color={COLORS.danger} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingTitle, { color: COLORS.danger }]}>
                Supprimer le compte
              </Text>
              <Text style={styles.settingSubtitle}>
                Supprimer définitivement le compte admin
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        </Card>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  section: {
    padding: 0,
    overflow: 'hidden',
  },
  dangerSection: {
    borderColor: COLORS.danger + '40',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  settingSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  whatsappRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  whatsappInput: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    color: COLORS.text,
    marginRight: SPACING.sm,
  },
  whatsappButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  whatsappButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
});

