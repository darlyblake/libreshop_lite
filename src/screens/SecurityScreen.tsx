import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store';
import { authService } from '../services/authService';
import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';
import { errorHandler } from '../utils/errorHandler';
import { deviceSessionService, DeviceSession } from '../services/deviceSessionService';

export const SecurityScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, signOut } = useAuthStore();
  const { getColor, spacing, radius, fontSize } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [currentDeviceKey, setCurrentDeviceKey] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Fetch real session data from Supabase Auth
  useEffect(() => {
    const loadSession = async () => {
      if (!user) return;
      setSessionsLoading(true);
      try {
        const [loadedSessions, key] = await Promise.all([
          deviceSessionService.getSessions(user.id),
          deviceSessionService.getCurrentDeviceKey()
        ]);
        setSessions(loadedSessions);
        setCurrentDeviceKey(key);
      } catch (e) {
        console.warn('[SecurityScreen] loadSession error:', e);
      } finally {
        setSessionsLoading(false);
      }
    };
    loadSession();
  }, [user]);

  const handleRevokeSession = async (sessionId: string) => {
    Alert.alert(
      'Déconnecter cet appareil',
      'Voulez-vous vraiment déconnecter cet appareil ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deviceSessionService.revokeSession(sessionId);
              setSessions(prev => prev.filter(s => s.id !== sessionId));
            } catch (e) {
              errorHandler.handle(e, 'Revoke session error');
              Alert.alert('Erreur', 'Impossible de déconnecter cet appareil.');
            }
          },
        },
      ]
    );
  };

  const handleSignOutAll = async () => {
    Alert.alert(
      'Se déconnecter de tous les appareils',
      'Cela invalidera toutes les sessions actives, y compris celle-ci. Vous serez redirigé vers la page de connexion.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            setSigningOutAll(true);
            try {
              if (user) await deviceSessionService.revokeAllSessions(user.id);
              await supabase!.auth.signOut({ scope: 'global' });
              signOut();
              navigation.navigate('Home' as never);
            } catch (e) {
              errorHandler.handle(e, 'Sign out all error');
              Alert.alert('Erreur', 'Impossible de se déconnecter de tous les appareils.');
            } finally {
              setSigningOutAll(false);
            }
          },
        },
      ]
    );
  };

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
    signOutAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: '#ef4444',
      backgroundColor: '#ef444410',
    },
    signOutAllText: {
      color: '#ef4444',
      fontSize: fontSize.sm,
      fontWeight: '600',
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

          {sessionsLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
              <ActivityIndicator size="small" color={getColor.accent} />
              <Text style={{ color: getColor.textMuted, marginTop: spacing.sm, fontSize: fontSize.sm }}>Chargement des sessions…</Text>
            </View>
          ) : sessions.length > 0 ? (
            <>
              {sessions.map((session, index) => {
                const isCurrent = session.device_key === currentDeviceKey;
                return (
                  <View key={session.id} style={[styles.deviceItem, index === sessions.length - 1 && styles.deviceItemLast]}>
                    <View style={styles.deviceIcon}>
                      <Ionicons name={session.device_icon as any} size={20} color={getColor.accent} />
                    </View>
                    <View style={styles.deviceInfoText}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.deviceName}>{session.device_name}</Text>
                        {isCurrent && (
                          <View style={{ backgroundColor: getColor.accent + '25', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ fontSize: fontSize.xs, color: getColor.accent, fontWeight: '600' }}>Actuel</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.deviceDetails}>
                        Dernière activité : {new Date(session.last_seen).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    {!isCurrent && (
                      <TouchableOpacity 
                        style={styles.removeButton}
                        onPress={() => handleRevokeSession(session.id)}
                      >
                        <Ionicons name="close-circle-outline" size={24} color={getColor.textSoft} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              <TouchableOpacity
                style={[styles.signOutAllButton, signingOutAll && { opacity: 0.6 }]}
                onPress={handleSignOutAll}
                disabled={signingOutAll}
              >
                {signingOutAll ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <>
                    <Ionicons name="log-out-outline" size={16} color="#ef4444" />
                    <Text style={styles.signOutAllText}>Se déconnecter de tous les appareils</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
              <Ionicons name="shield-outline" size={32} color={getColor.textMuted} />
              <Text style={{ color: getColor.textMuted, marginTop: spacing.sm, fontSize: fontSize.sm, textAlign: 'center' }}>
                Aucune session active détectée.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
