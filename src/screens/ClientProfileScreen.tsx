import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { useAuthStore } from '../store';
import { orderService } from '../lib/supabase';
import { wishlistService } from '../lib/wishlistService';
import { useTheme } from '../hooks/useTheme';
import { ThemeToggle } from '../components/ThemeToggle';

const MENU_ITEMS = [
  { icon: 'person-outline', label: 'Informations personnelles', screen: '' },
  { icon: 'location-outline', label: 'Adresses enregistrées', screen: '' },
  { icon: 'heart-outline', label: 'Mes favoris', screen: 'Wishlist' },
  { icon: 'receipt-outline', label: 'Mes Commandes', screen: 'ClientOrders' },
  { icon: 'sync-outline', label: 'Restaurer mon historique', action: 'restore' },
  { icon: 'notifications-outline', label: 'Notifications', screen: '' },
  { icon: 'shield-checkmark-outline', label: 'Sécurité', screen: '' },
  { icon: 'help-circle-outline', label: 'Aide et support', screen: '' },
];

export const ClientProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { getColor, spacing, radius, fontSize, isDark } = useTheme();
  
  const [ordersCount, setOrdersCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [addressesCount, setAddressesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // States for Restore History
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreStep, setRestoreStep] = useState(1); // 1: phone, 2: otp
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Charger les vraies données de l'utilisateur
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const orders = await orderService.getByUser(String(user.id));
        setOrdersCount(Array.isArray(orders) ? orders.length : 0);

        try {
          const favorites = await wishlistService.getByUser(String(user.id));
          setFavoritesCount(favorites.length);
        } catch (wishlistError: any) {
          errorHandler.handle(wishlistError instanceof Error ? wishlistError : new Error(String(wishlistError)), 'Wishlist table not found:', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
          setFavoritesCount(0);
        }

        setAddressesCount(2); // Temporaire
      } catch (error) {
        errorHandler.handle(error instanceof Error ? error : new Error(String(error)), 'Error loading user data:', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [user?.id]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return 'Date inconnue';
    }
  };

  const getUserInitials = () => {
    if (user?.full_name) {
      return user.full_name
        .split(' ')
        .map((word: string) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.slice(0, 2).toUpperCase() || 'U';
  };

  const handleLogout = () => {
    const { signOut } = useAuthStore.getState();
    signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Landing' }],
    });
  };

  const handleSendOtp = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre numéro de téléphone.');
      return;
    }
    setVerifying(true);
    try {
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase!.auth.signInWithOtp({
        phone: phoneNumber,
      });
      
      if (error) throw error;
      setRestoreStep(2);
    } catch (error: any) {
      errorHandler.handle(error instanceof Error ? error : new Error(String(error)), 'Send OTP Error', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      Alert.alert('Erreur', 'Impossible d\'envoyer le code. Vérifiez le format (ex: +229XXXXXXXX).');
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) return;
    setVerifying(true);
    try {
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase!.auth.verifyOtp({
        phone: phoneNumber,
        token: otpCode,
        type: 'sms',
      });

      if (error) throw error;

      Alert.alert('Succès', 'Votre historique a été restauré avec succès !');
      setShowRestoreModal(false);
      setRestoreStep(1);
      setOtpCode('');
      // User will be auto-logged in by Supabase Auth listener in AppNavigator
    } catch (error: any) {
      errorHandler.handle(error, 'Verify OTP Error', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      Alert.alert('Erreur', 'Code invalide ou expiré.');
    } finally {
      setVerifying(false);
    }
  };

  const handleMenuPress = (item: any) => {
    if (item.action === 'restore') {
      setShowRestoreModal(true);
    } else if (item.screen) {
      navigation.navigate(item.screen);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: getColor.bg,
    },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.lg,
    },
    headerTitle: {
      fontSize: fontSize.xxl,
      fontWeight: '700',
      color: getColor.text,
    },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.xl,
      backgroundColor: getColor.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: getColor.border,
    },
    avatar: {
      width: 70,
      height: 70,
      borderRadius: 35,
      borderWidth: 3,
      borderColor: getColor.accent,
    },
    profileInfo: {
      flex: 1,
      marginLeft: spacing.md,
    },
    userName: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: getColor.text,
    },
    userEmail: {
      fontSize: fontSize.sm,
      color: getColor.textSoft,
    },
    userPhone: {
      fontSize: fontSize.sm,
      color: getColor.textMuted,
      marginBottom: spacing.xs,
    },
    joinDate: {
      fontSize: fontSize.xs,
      color: getColor.accent,
      fontStyle: 'italic',
    },
    avatarPlaceholder: {
      backgroundColor: getColor.accent + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: getColor.accent,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
    },
    editButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: getColor.accent + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    statsContainer: {
      flexDirection: 'row',
      marginHorizontal: spacing.xl,
      marginTop: spacing.lg,
      backgroundColor: getColor.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: getColor.border,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontSize: fontSize.xxl,
      fontWeight: '700',
      color: getColor.text,
    },
    statLabel: {
      fontSize: fontSize.xs,
      color: getColor.textMuted,
      marginTop: 4,
    },
    statDivider: {
      width: 1,
      backgroundColor: getColor.border,
    },
    menuContainer: {
      marginHorizontal: spacing.xl,
      marginTop: spacing.xl,
      backgroundColor: getColor.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: getColor.border,
      overflow: 'hidden',
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: getColor.border,
    },
    menuIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: getColor.accent + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    menuLabel: {
      flex: 1,
      fontSize: fontSize.md,
      color: getColor.text,
    },
    themeToggleItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: getColor.border,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginHorizontal: spacing.xl,
      marginTop: spacing.xl,
      backgroundColor: getColor.error + '15',
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: getColor.error + '30',
    },
    logoutText: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: getColor.error,
    },
    appInfo: {
      alignItems: 'center',
      paddingVertical: spacing.xxxl,
    },
    logoText: {
      fontSize: fontSize.xxl,
      fontWeight: '800',
      color: getColor.accent,
      letterSpacing: 0.5,
      marginBottom: spacing.md,
    },
    appVersion: {
      fontSize: fontSize.sm,
      color: getColor.textMuted,
      marginTop: 4,
    },
    appDate: {
      fontSize: fontSize.xs,
      color: getColor.textMuted,
      marginTop: 8,
    },
  }), [getColor, spacing, radius, fontSize, isDark]);

  const renderMenuItem = (item: any, index: number) => (
    <TouchableOpacity 
      key={index} 
      style={styles.menuItem}
      onPress={() => handleMenuPress(item)}
    >
      <View style={styles.menuIcon}>
        <Ionicons name={item.icon as any} size={22} color={getColor.accent} />
      </View>
      <Text style={styles.menuLabel}>{item.label}</Text>
      <Ionicons name="chevron-forward" size={20} color={getColor.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={getColor.bg} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mon profil</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitials}>{getUserInitials()}</Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>
              {user?.full_name || 'Utilisateur'}
            </Text>
            <Text style={styles.userEmail}>{user?.email || 'Email non disponible'}</Text>
            <Text style={styles.userPhone}>
              {user?.whatsapp_number || user?.phone || 'Téléphone non renseigné'}
            </Text>
            <Text style={styles.joinDate}>
              Membre depuis {user?.created_at ? formatDate(user.created_at) : 'Date inconnue'}
            </Text>
          </View>
          <TouchableOpacity style={styles.editButton}>
            <Ionicons name="pencil" size={18} color={getColor.accent} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={getColor.accent} size="small" />
            </View>
          ) : (
            <>
              <TouchableOpacity 
                style={styles.statItem}
                onPress={() => navigation.navigate('ClientOrders')}
              >
                <Text style={styles.statValue}>{ordersCount}</Text>
                <Text style={styles.statLabel}>Commandes</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <TouchableOpacity style={styles.statItem}>
                <Text style={styles.statValue}>{favoritesCount}</Text>
                <Text style={styles.statLabel}>Favoris</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <TouchableOpacity style={styles.statItem}>
                <Text style={styles.statValue}>{addressesCount}</Text>
                <Text style={styles.statLabel}>Adresses</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.menuContainer}>
          {MENU_ITEMS.map(renderMenuItem)}
          
          <View style={styles.themeToggleItem}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.menuIcon}>
                <Ionicons name="color-palette-outline" size={22} color={getColor.accent} />
              </View>
              <Text style={styles.menuLabel}>Thème de l'application</Text>
            </View>
            <ThemeToggle />
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={getColor.error} />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Restore History Modal */}
      <Modal
        visible={showRestoreModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRestoreModal(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.content, { backgroundColor: getColor.card }]}>
            <View style={modalStyles.header}>
              <Text style={[modalStyles.title, { color: getColor.text }]}>
                {restoreStep === 1 ? 'Restaurer mon historique' : 'Vérification'}
              </Text>
              <TouchableOpacity onPress={() => setShowRestoreModal(false)}>
                <Ionicons name="close" size={24} color={getColor.text} />
              </TouchableOpacity>
            </View>

            {restoreStep === 1 ? (
              <View>
                <Text style={[modalStyles.description, { color: getColor.textSoft }]}>
                  Entrez votre numéro de téléphone pour récupérer vos favoris et vos commandes passées.
                </Text>
                <TextInput
                  style={[modalStyles.input, { borderColor: getColor.border, color: getColor.text }]}
                  placeholder="+229 XX XX XX XX"
                  placeholderTextColor={getColor.textMuted}
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  autoFocus
                />
                <TouchableOpacity
                  style={[modalStyles.button, { backgroundColor: getColor.accent }]}
                  onPress={handleSendOtp}
                  disabled={verifying}
                >
                  {verifying ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={modalStyles.buttonText}>Recevoir le code</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={[modalStyles.description, { color: getColor.textSoft }]}>
                  Entrez le code envoyé au {phoneNumber}
                </Text>
                <TextInput
                  style={[modalStyles.input, { borderColor: getColor.border, color: getColor.text, textAlign: 'center', letterSpacing: 5 }]}
                  placeholder="000000"
                  placeholderTextColor={getColor.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  autoFocus
                />
                <TouchableOpacity
                  style={[modalStyles.button, { backgroundColor: getColor.accent }]}
                  onPress={handleVerifyOtp}
                  disabled={verifying || otpCode.length < 6}
                >
                  {verifying ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={modalStyles.buttonText}>Vérifier le code</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setRestoreStep(1)} style={{ marginTop: spacing.md }}>
                  <Text style={{ color: getColor.accent, textAlign: 'center' }}>Changer de numéro</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
