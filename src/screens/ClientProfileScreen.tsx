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
import { RequireAuthPlaceholder } from '../components';
import { sessionStorage } from '../lib/storage';
import { orderService } from '../services/orderService';
import { wishlistService } from '../services/wishlistService';
import { useTheme } from '../hooks/useTheme';
import { useThemeRefresh } from '../hooks/useThemeRefresh';
import { ThemeToggle } from '../components/ThemeToggle';
import { cloudinaryService } from '../services/cloudinaryService';
import { authService } from '../services/authService';
import { navigateToClientTab } from '../navigation/clientNavigation';
import type { ClientTabParamList } from '../navigation/types';
import * as ImagePicker from 'expo-image-picker';

const CLIENT_TAB_NAMES: (keyof ClientTabParamList)[] = [
  'ClientHome',
  'ClientOrders',
  'ClientSearch',
  'Wishlist',
  'ClientProfile',
];

const MENU_ITEMS: Array<{
  icon: string;
  label: string;
  screen?: keyof ClientTabParamList | 'Notifications';
  soon?: boolean;
  action?: string;
}> = [
  { icon: 'storefront-outline', label: 'Ouvrir ma boutique', screen: 'SellerAuth' as any },
  { icon: 'person-outline', label: 'Informations personnelles' },
  { icon: 'location-outline', label: 'Adresses enregistrées' },
  { icon: 'heart-outline', label: 'Mes favoris', screen: 'Wishlist' },
  { icon: 'receipt-outline', label: 'Mes Commandes', screen: 'ClientOrders' },
  { icon: 'sync-outline', label: 'Restaurer mon historique', action: 'restore' },
  { icon: 'notifications-outline', label: 'Notifications', screen: 'Notifications' },
  { icon: 'shield-checkmark-outline', label: 'Sécurité', screen: 'Security' },
  { icon: 'help-circle-outline', label: 'Aide et support', screen: 'Help' },
];

export const ClientProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();

  if (!user) {
    return (
      <RequireAuthPlaceholder
        title="Mon profil"
        description="Connectez-vous avec Google pour gérer vos informations personnelles, consulter votre historique et configurer vos adresses de livraison."
        icon="person-circle-outline"
      />
    );
  }

  const { getColor, spacing, radius, fontSize, isDark } = useTheme();
  useThemeRefresh(); // Force le re-rendu au changement de thème
  
  const [ordersCount, setOrdersCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [addressesCount, setAddressesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Nous avons besoin d’accès à vos photos pour changer votre photo de profil.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setUploadingAvatar(true);
        const uploadedUrl = await cloudinaryService.uploadImage(result.assets[0].uri);
        
        if (uploadedUrl && user?.id) {
          await authService.updateProfile(user.id, {
            avatar_url: uploadedUrl,
          });
          
          const { setUser } = useAuthStore.getState();
          setUser({
            ...user,
            avatar_url: uploadedUrl,
          });
          Alert.alert('Succès ✓', 'Votre photo de profil a été mise à jour !');
        }
      }
    } catch (e: any) {
      errorHandler.handle(e, 'Avatar Upload error', ErrorCategory.USER_INPUT, ErrorSeverity.MEDIUM);
      Alert.alert('Erreur', 'Impossible de mettre à jour la photo de profil.');
    } finally {
      setUploadingAvatar(false);
    }
  };

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
          errorHandler.handle(wishlistError, 'Wishlist table not found');
          setFavoritesCount(0);
        }

        setAddressesCount(user.address ? 1 : 0);
      } catch (error) {
        errorHandler.handle(error, 'Error loading user data');
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
      await authService.signInWithOtp({
        phone: phoneNumber,
      });
      setRestoreStep(2);
    } catch (error: any) {
      errorHandler.handle(error instanceof Error ? error : new Error(String(error)), 'Send OTP Error', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
      Alert.alert('Erreur', 'Impossible d\'envoyer le code. Vérifiez le format (ex: +241XXXXXXXX).');
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) return;
    setVerifying(true);
    try {
      await authService.verifyOtp({
        phone: phoneNumber,
        token: otpCode,
        type: 'sms',
      });

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

  const handleMenuPress = (item: (typeof MENU_ITEMS)[number]) => {
    if (item.label === 'Ouvrir ma boutique') {
      if (user) {
        // Switch to seller role in sessionStorage and navigate
        sessionStorage.saveUserRole('seller').then(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'SellerTabs' }],
          });
        });
      } else {
        navigation.navigate('SellerAuth');
      }
      return;
    }
    if (item.action === 'restore') {
      setShowRestoreModal(true);
      return;
    }
    if (item.label === 'Informations personnelles') {
      navigation.navigate('PersonalInfo');
      return;
    }
    if (item.label === 'Adresses enregistrées') {
      navigation.navigate('Address');
      return;
    }
    if (item.soon) {
      Alert.alert('Bientôt disponible', 'Cette fonctionnalité arrive prochainement.');
      return;
    }
    if (item.screen === 'Notifications') {
      navigation.navigate('Notifications');
      return;
    }
    if (item.screen && CLIENT_TAB_NAMES.includes(item.screen as keyof ClientTabParamList)) {
      navigateToClientTab(navigation, item.screen as keyof ClientTabParamList);
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
    avatarWrapper: {
      position: 'relative',
    },
    cameraBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: getColor.accent,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: getColor.card,
    },
    avatarLoadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      justifyContent: 'center',
      alignItems: 'center',
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
          <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8} style={styles.avatarWrapper}>
            {user?.avatar_url ? (
              <Image source={{ uri: cloudinaryService.getOptimizedUrl(user.avatar_url, 150) }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitials}>{getUserInitials()}</Text>
              </View>
            )}
            {uploadingAvatar ? (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            ) : (
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>
              {user?.full_name || 'Utilisateur'}
            </Text>
            <Text style={styles.userEmail}>{user?.email || 'Email non disponible'}</Text>
            <Text style={styles.userPhone}>
              {user?.whatsapp_number || user?.phone || 'Téléphone non renseigné'}
            </Text>
            {user?.address && (
              <Text style={[styles.userPhone, { marginTop: 2 }]} numberOfLines={1}>
                <Ionicons name="location-outline" size={12} color={getColor.textMuted} /> {user.address}
              </Text>
            )}
            <Text style={styles.joinDate}>
              Membre depuis {user?.created_at ? formatDate(user.created_at) : 'Date inconnue'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('PersonalInfo')}
          >
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
                onPress={() => navigateToClientTab(navigation, 'ClientOrders')}
              >
                <Text style={styles.statValue}>{ordersCount}</Text>
                <Text style={styles.statLabel}>Commandes</Text>
              </TouchableOpacity>
              <View style={styles.statDivider} />
              <TouchableOpacity
                style={styles.statItem}
                onPress={() => navigateToClientTab(navigation, 'Wishlist')}
              >
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

        <View style={styles.appInfo}>
          <Text style={styles.logoText}>libreshop</Text>
          <Text style={styles.appVersion}>Version 2.4.0 — Premium</Text>
          <Text style={styles.appDate}>Fait avec ❤️ pour l’Afrique Centrale</Text>
        </View>
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
                  placeholder="+241 XX XX XX XX"
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
