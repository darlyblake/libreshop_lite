import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useAuthStore } from '../store';
import { orderService } from '../lib/supabase';
import { wishlistService } from '../lib/wishlistService';

const MENU_ITEMS = [
  { icon: 'person-outline', label: 'Informations personnelles', screen: '' },
  { icon: 'location-outline', label: 'Adresses enregistrées', screen: '' },
  { icon: 'heart-outline', label: 'Mes favoris', screen: 'Wishlist' },
  { icon: 'receipt-outline', label: 'Mes Commandes', screen: 'ClientOrders' },
  { icon: 'notifications-outline', label: 'Notifications', screen: '' },
  { icon: 'shield-checkmark-outline', label: 'Sécurité', screen: '' },
  { icon: 'help-circle-outline', label: 'Aide et support', screen: '' },
];

export const ClientProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const [ordersCount, setOrdersCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [addressesCount, setAddressesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Charger les vraies données de l'utilisateur
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        // Charger le nombre de commandes
        const orders = await orderService.getByUser(String(user.id));
        setOrdersCount(Array.isArray(orders) ? orders.length : 0);

        // Charger le nombre de favoris depuis le service wishlist avec gestion d'erreur
        try {
          const favorites = await wishlistService.getByUser(String(user.id));
          setFavoritesCount(favorites.length);
        } catch (wishlistError: any) {
          console.warn('Wishlist table not found:', wishlistError);
          // Si la table n'existe pas, afficher 0 favoris
          setFavoritesCount(0);
        }

        // TODO: Charger le nombre d'adresses depuis un service addresses
        // const addresses = await addressService.getByUser(String(user.id));
        setAddressesCount(2); // Temporaire
      } catch (error) {
        console.warn('Error loading user data:', error);
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
    if (user?.user_metadata?.name) {
      return user.user_metadata.name
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

  const renderMenuItem = (item: any, index: number) => (
    <TouchableOpacity 
      key={index} 
      style={styles.menuItem}
      onPress={() => item.screen && navigation.navigate(item.screen)}
    >
      <View style={styles.menuIcon}>
        <Ionicons name={item.icon as any} size={22} color={COLORS.accent} />
      </View>
      <Text style={styles.menuLabel}>{item.label}</Text>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mon profil</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          {user?.user_metadata?.avatar_url ? (
            <Image source={{ uri: user.user_metadata.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitials}>{getUserInitials()}</Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>
              {user?.user_metadata?.name || 'Utilisateur'}
            </Text>
            <Text style={styles.userEmail}>{user?.email || 'Email non disponible'}</Text>
            <Text style={styles.userPhone}>
              {user?.user_metadata?.phone || user?.phone || 'Téléphone non renseigné'}
            </Text>
            <Text style={styles.joinDate}>
              Membre depuis {user?.created_at ? formatDate(user.created_at) : 'Date inconnue'}
            </Text>
          </View>
          <TouchableOpacity style={styles.editButton}>
            <Ionicons name="pencil" size={18} color={COLORS.accent} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={COLORS.accent} size="small" />
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

        {/* Menu */}
        <View style={styles.menuContainer}>
          {MENU_ITEMS.map(renderMenuItem)}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={[styles.logoText, { alignSelf: 'center' }]}>libreshop</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.appDate}>© 2026 LibreShop</Text>
        </View>
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
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: COLORS.accent,
  },
  profileInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  userName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  userEmail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSoft,
  },
  userPhone: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  joinDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.accent,
    fontStyle: 'italic',
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.accent,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  menuContainer: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.xl,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.xl,
    backgroundColor: COLORS.danger + '15',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.danger + '30',
  },
  logoutText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.danger,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  logoText: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  appName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.textSoft,
  },
  appVersion: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  appDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 8,
  },
});

