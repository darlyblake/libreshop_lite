import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store';
import { authService } from '../services/authService';
import { useTheme } from '../hooks/useTheme';
import { errorHandler } from '../utils/errorHandler';

export const SecurityScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { getColor, spacing, radius, fontSize } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const securityFeatures = [
    {
      icon: 'shield-checkmark-outline',
      title: 'Authentification à deux facteurs',
      description: 'Ajoutez une couche de sécurité supplémentaire',
      enabled: false,
      soon: true,
    },
    {
      icon: 'finger-print-outline',
      title: 'Authentification biométrique',
      description: 'Utilisez votre empreinte digitale ou Face ID',
      enabled: false,
      soon: true,
    },
    {
      icon: 'lock-closed-outline',
      title: 'Code PIN',
      description: 'Accédez rapidement à votre compte avec un code PIN',
      enabled: false,
      soon: true,
    },
  ];

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      await authService.updatePassword(currentPassword, newPassword);
      Alert.alert('Succès', 'Votre mot de passe a été mis à jour');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      errorHandler.handle(error instanceof Error ? error : new Error(String(error)), 'Error updating password:');
      Alert.alert('Erreur', 'Impossible de mettre à jour votre mot de passe. Vérifiez votre mot de passe actuel.');
    } finally {
      setLoading(false);
    }
  };

  const handleFeatureToggle = (feature: typeof securityFeatures[0]) => {
    if (feature.soon) {
      Alert.alert('Bientôt disponible', 'Cette fonctionnalité sera disponible prochainement.');
      return;
    }
    Alert.alert('Info', `${feature.title} sera bientôt disponible.`);
  };

  const renderSecurityFeature = (feature: typeof securityFeatures[0], index: number) => (
    <View key={index} style={styles.featureCard}>
      <View style={styles.featureHeader}>
        <View style={styles.featureIcon}>
          <Ionicons name={feature.icon as any} size={24} color={getColor.accent} />
        </View>
        <View style={styles.featureInfo}>
          <Text style={styles.featureTitle}>{feature.title}</Text>
          <Text style={styles.featureDescription}>{feature.description}</Text>
        </View>
        <TouchableOpacity
          style={[styles.toggleButton, feature.enabled && styles.toggleButtonEnabled]}
          onPress={() => handleFeatureToggle(feature)}
        >
          <View style={[styles.toggleDot, feature.enabled && styles.toggleDotEnabled]} />
        </TouchableOpacity>
      </View>
      {feature.soon && (
        <View style={styles.soonBadge}>
          <Text style={styles.soonBadgeText}>Bientôt disponible</Text>
        </View>
      )}
    </View>
  );

  const renderPasswordField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    showPassword: boolean,
    toggleShow: () => void,
    placeholder: string
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={getColor.textMuted}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.eyeButton} onPress={toggleShow}>
          <Ionicons
            name={showPassword ? 'eye-outline' : 'eye-off-outline'}
            size={20}
            color={getColor.textMuted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: getColor.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.lg,
      backgroundColor: getColor.card,
      borderBottomWidth: 1,
      borderBottomColor: getColor.border,
    },
    headerTitle: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: getColor.text,
      marginLeft: spacing.md,
    },
    content: {
      flex: 1,
      padding: spacing.xl,
    },
    section: {
      backgroundColor: getColor.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: getColor.border,
    },
    sectionTitle: {
      fontSize: fontSize.lg,
      fontWeight: '600',
      color: getColor.text,
      marginBottom: spacing.md,
    },
    sectionDescription: {
      fontSize: fontSize.sm,
      color: getColor.textSoft,
      marginBottom: spacing.lg,
      lineHeight: 20,
    },
    inputGroup: {
      marginBottom: spacing.lg,
    },
    label: {
      fontSize: fontSize.sm,
      fontWeight: '500',
      color: getColor.text,
      marginBottom: spacing.sm,
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: getColor.border,
      borderRadius: radius.md,
      backgroundColor: getColor.bg,
    },
    passwordInput: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: getColor.text,
    },
    eyeButton: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    changeButton: {
      backgroundColor: getColor.accent,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    changeButtonText: {
      color: getColor.text,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    changeButtonDisabled: {
      backgroundColor: getColor.border,
    },
    featureCard: {
      backgroundColor: getColor.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: getColor.border,
    },
    featureHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    featureIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: getColor.accent + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    featureInfo: {
      flex: 1,
    },
    featureTitle: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: getColor.text,
      marginBottom: spacing.xs,
    },
    featureDescription: {
      fontSize: fontSize.sm,
      color: getColor.textSoft,
      lineHeight: 18,
    },
    toggleButton: {
      width: 48,
      height: 28,
      borderRadius: 14,
      backgroundColor: getColor.border,
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    toggleButtonEnabled: {
      backgroundColor: getColor.accent,
    },
    toggleDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: getColor.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    toggleDotEnabled: {
      alignSelf: 'flex-end',
      backgroundColor: getColor.card,
    },
    soonBadge: {
      alignSelf: 'flex-start',
      marginTop: spacing.sm,
      backgroundColor: getColor.warning + '20',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    soonBadgeText: {
      fontSize: fontSize.xs,
      fontWeight: '600',
      color: getColor.warning,
    },
    deviceInfo: {
      backgroundColor: getColor.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: getColor.border,
    },
    deviceItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: getColor.border,
    },
    deviceItemLast: {
      borderBottomWidth: 0,
    },
    deviceIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: getColor.accent + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    deviceInfoText: {
      flex: 1,
    },
    deviceName: {
      fontSize: fontSize.md,
      fontWeight: '500',
      color: getColor.text,
      marginBottom: spacing.xs,
    },
    deviceDetails: {
      fontSize: fontSize.sm,
      color: getColor.textSoft,
    },
    removeButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={getColor.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sécurité</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Changer le mot de passe</Text>
          <Text style={styles.sectionDescription}>
            Assurez la sécurité de votre compte en utilisant un mot de passe fort et unique.
          </Text>
          
          {renderPasswordField(
            'Mot de passe actuel',
            currentPassword,
            setCurrentPassword,
            showPasswords.current,
            () => setShowPasswords(prev => ({ ...prev, current: !prev.current })),
            'Entrez votre mot de passe actuel'
          )}

          {renderPasswordField(
            'Nouveau mot de passe',
            newPassword,
            setNewPassword,
            showPasswords.new,
            () => setShowPasswords(prev => ({ ...prev, new: !prev.new })),
            'Entrez le nouveau mot de passe'
          )}

          {renderPasswordField(
            'Confirmer le mot de passe',
            confirmPassword,
            setConfirmPassword,
            showPasswords.confirm,
            () => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm })),
            'Confirmez le nouveau mot de passe'
          )}

          <TouchableOpacity
            style={[styles.changeButton, loading && styles.changeButtonDisabled]}
            onPress={handlePasswordChange}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={getColor.text} size="small" />
            ) : (
              <Text style={styles.changeButtonText}>Mettre à jour le mot de passe</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Méthodes d'authentification</Text>
          <Text style={styles.sectionDescription}>
            Configurez des méthodes d'authentification supplémentaires pour sécuriser votre compte.
          </Text>
          
          {securityFeatures.map(renderSecurityFeature)}
        </View>

        <View style={styles.deviceInfo}>
          <Text style={styles.sectionTitle}>Appareils connectés</Text>
          
          <View style={styles.deviceItem}>
            <View style={styles.deviceIcon}>
              <Ionicons name="phone-portrait-outline" size={20} color={getColor.accent} />
            </View>
            <View style={styles.deviceInfoText}>
              <Text style={styles.deviceName}>Appareil actuel</Text>
              <Text style={styles.deviceDetails}>
                {user?.email} • Maintenant
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
