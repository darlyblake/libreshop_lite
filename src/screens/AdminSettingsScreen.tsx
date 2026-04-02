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
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { RootStackParamList } from '../navigation/types';
import { Card } from '../components/Card';
import { BackToDashboard } from '../components/BackToDashboard';
import { settingsService } from '../services/settingsService';
import { useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';

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
    requireEmailConfirmation: true, // Nouveau réglage
  });
  const [adminValues, setAdminValues] = useState({
    whatsappNumber: '',
    whatsappDisplay: '',
    email: '',
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const updateAdminConfig = useSettingsStore(state => state.updateAdminConfig);
  const adminConfig = useSettingsStore(state => state.adminConfig);

  // Charger les paramètres au montage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await settingsService.getSettings();
        setSettings(prev => ({
          ...prev,
          ...storedSettings,
        }));
        
        // Charger les valeurs admin
        setAdminValues({
          whatsappNumber: storedSettings.whatsappNumber || adminConfig.whatsappNumber,
          whatsappDisplay: storedSettings.whatsappDisplay || adminConfig.whatsappDisplay,
          email: storedSettings.adminEmail || adminConfig.email,
        });
      } catch (e) {
        console.error('Error loading settings:', e);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const updateSetting = async (key: string, value: any) => {
    // Mise à jour optimiste de l'état local
    setSettings(prev => ({ ...prev, [key]: value }));
    
    try {
      await settingsService.updateSetting(key, value);
    } catch (e) {
      console.error(`Error updating setting ${key}:`, e);
      Alert.alert('Erreur', 'Impossible de sauvegarder le paramètre sur le serveur.');
      // Revenir à l'ancien état en cas d'erreur
      const storedSettings = await settingsService.getSettings();
      setSettings(prev => ({ ...prev, ...storedSettings }));
    }
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
    {
      title: "Confirmation d'email",
      subtitle: "Exiger la confirmation d'email à l'inscription",
      icon: 'mail-unread-outline',
      type: 'toggle',
      value: settings.requireEmailConfirmation,
      onPress: () => updateSetting('requireEmailConfirmation', !settings.requireEmailConfirmation),
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

  const saveAdminContact = async () => {
    setIsSaving(true);
    try {
      await updateAdminConfig({
        whatsappNumber: adminValues.whatsappNumber,
        whatsappDisplay: adminValues.whatsappDisplay,
        email: adminValues.email,
      });
      Alert.alert('Succès', 'Les informations de contact ont été mises à jour.');
    } catch (e) {
      console.error('Error saving admin contact:', e);
      Alert.alert('Erreur', 'Impossible de sauvegarder les contacts.');
    } finally {
      setIsSaving(false);
    }
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
          {loading ? (
            <View style={{ padding: SPACING.lg, alignItems: 'center' }}>
              <ActivityIndicator color={COLORS.accent} />
            </View>
          ) : (
            generalSettings.map((item, index) => renderSettingItem(item, index))
          )}
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

        {/* Admin Contact Information */}
        <Text style={styles.sectionTitle}>Contact Administrateur (WhatsApp & Support)</Text>
        <Card style={styles.section}>
          <View style={styles.contactForm}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Numéro WhatsApp (Format: 241...)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 24177619251"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
                value={adminValues.whatsappNumber}
                onChangeText={(val) => setAdminValues(prev => ({ ...prev, whatsappNumber: val }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Numéro Affiché (Ex: +241 77...)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: +241 77 61-92-51"
                placeholderTextColor={COLORS.textMuted}
                value={adminValues.whatsappDisplay}
                onChangeText={(val) => setAdminValues(prev => ({ ...prev, whatsappDisplay: val }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email de Support</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: support@libreshop.com"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                value={adminValues.email}
                onChangeText={(val) => setAdminValues(prev => ({ ...prev, email: val }))}
              />
            </View>

            <TouchableOpacity 
              style={[styles.saveButton, isSaving && { opacity: 0.7 }]} 
              onPress={saveAdminContact}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color={COLORS.text} />
                  <Text style={styles.saveButtonText}>Enregistrer les contacts</Text>
                </>
              )}
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
  contactForm: {
    padding: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
  },
  saveButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  saveButtonText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: FONT_SIZE.md,
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
    color: COLORS.text,
    fontWeight: '600',
  },
});

