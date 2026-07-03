import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useTheme } from '../hooks/useTheme';

interface StoreHeaderProps {
  store: {
    id: string;
    name: string;
    category: string;
    logo_url?: string;
    banner_url?: string;
    description?: string;
    verified?: boolean;
    rating?: number;
    rating_count?: number;
    phone?: string;
    address?: string;
  };
  isFollowing?: boolean;
  onShare?: () => void;
  onContact?: () => void;
  onFollow?: () => void;
  onReport?: () => void;
  onDirections?: () => void;
}

export const StoreHeader: React.FC<StoreHeaderProps> = ({
  store,
  isFollowing,
  onShare,
  onContact,
  onFollow,
  onReport,
  onDirections,
}) => {
  const { getColor: COLORS, isDark } = useTheme();
  const windowWidth = Dimensions.get('window').width;
  const isCompact = windowWidth < 600;
  const styles = React.useMemo(
    () => getStyles(COLORS, isDark, isCompact),
    [COLORS, isDark, isCompact]
  );
  const rating = store.rating || 0;
  const ratingCount = store.rating_count || 0;

  return (
    <View style={styles.container}>
      {/* Info Row: logo + store details */}
      <View style={styles.headerTopRow}>
        {!!store.logo_url && (
          <Image
            source={{ uri: store.logo_url }}
            style={styles.logo}
            resizeMode="cover"
          />
        )}
        <View style={styles.storeInfo}>
          <Text style={styles.storeName} numberOfLines={2}>{store.name}</Text>

          {/* Rating */}
          {rating > 0 && (
            <View style={styles.metaItem}>
              <Ionicons name="star" size={14} color="#f59e0b" style={{ marginRight: 4 }} />
              <Text style={styles.metaText}>{rating.toFixed(1)} · {ratingCount} avis</Text>
            </View>
          )}

          {/* Open badge */}
          <View style={[styles.metaItem, { marginTop: 4 }]}>
            <View style={styles.badgeOpen}>
              <Text style={styles.badgeOpenText}>🟢 Ouvert maintenant</Text>
            </View>
          </View>

          {/* Address */}
          {!!store.address && (
            <View style={[styles.metaItem, { marginTop: 4 }]}>
              <Ionicons name="location-outline" size={14} color={COLORS.textSoft} style={{ marginRight: 4 }} />
              <Text style={styles.metaText} numberOfLines={2}>{store.address}</Text>
            </View>
          )}

          {/* Phone */}
          {!!store.phone && (
            <View style={[styles.metaItem, { marginTop: 4 }]}>
              <Ionicons name="call-outline" size={14} color={COLORS.textSoft} style={{ marginRight: 4 }} />
              <Text style={styles.metaText}>{store.phone}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Action buttons — horizontal scroll on mobile so they never clip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actions}
        style={styles.actionsScroll}
      >
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onContact}>
          <Ionicons name="chatbubble-ellipses-outline" size={15} color="#fff" style={{ marginRight: 5 }} />
          <Text style={styles.btnPrimaryText}>Contacter</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={onFollow}>
          <Ionicons
            name={isFollowing ? 'checkmark-circle-outline' : 'add-circle-outline'}
            size={15}
            color={COLORS.text}
            style={{ marginRight: 5 }}
          />
          <Text style={styles.btnText}>{isFollowing ? 'Suivi' : 'Suivre'}</Text>
        </TouchableOpacity>

        {onShare && (
          <TouchableOpacity style={styles.btn} onPress={onShare}>
            <Ionicons name="share-social-outline" size={15} color={COLORS.text} style={{ marginRight: 5 }} />
            <Text style={styles.btnText}>Partager</Text>
          </TouchableOpacity>
        )}

        {onDirections && store.address && (
          <TouchableOpacity style={styles.btn} onPress={onDirections}>
            <Ionicons name="navigate-outline" size={15} color={COLORS.text} style={{ marginRight: 5 }} />
            <Text style={styles.btnText}>Itinéraire</Text>
          </TouchableOpacity>
        )}

        {onReport && (
          <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={onReport}>
            <Ionicons name="flag-outline" size={15} color="#ef4444" style={{ marginRight: 5 }} />
            <Text style={[styles.btnText, { color: '#ef4444' }]}>Signaler</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const getStyles = (COLORS: any, isDark: boolean, isCompact: boolean) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.lg,
      backgroundColor: COLORS.card,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      gap: SPACING.md,
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? '0 4px 20px rgba(0,0,0,0.2)'
            : '0 4px 20px rgba(0,0,0,0.04)',
        },
        default: {
          elevation: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 10,
        },
      }),
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
    },
    logo: {
      width: isCompact ? 60 : 80,
      height: isCompact ? 60 : 80,
      borderRadius: isCompact ? 30 : 40,
      borderWidth: 2,
      borderColor: COLORS.border,
      flexShrink: 0,
    },
    storeInfo: {
      flex: 1,
    },
    storeName: {
      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
      fontSize: isCompact ? 20 : 28,
      fontWeight: 'bold',
      color: COLORS.text,
      marginBottom: SPACING.xs,
      lineHeight: isCompact ? 26 : 34,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    metaText: {
      color: COLORS.textSoft,
      fontSize: isCompact ? 12 : 14,
      flex: 1,
      flexShrink: 1,
    },
    badgeOpen: {
      backgroundColor: isDark ? 'rgba(21, 128, 61, 0.2)' : '#dcfce7',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 20,
    },
    badgeOpenText: {
      color: isDark ? '#4ade80' : '#15803d',
      fontWeight: '600',
      fontSize: isCompact ? 11 : 13,
    },
    actionsScroll: {
      flexGrow: 0,
    },
    actions: {
      flexDirection: 'row',
      gap: SPACING.sm,
      paddingRight: SPACING.sm,
    },
    btn: {
      paddingVertical: isCompact ? 7 : 10,
      paddingHorizontal: isCompact ? 14 : 18,
      borderRadius: 30,
      borderWidth: 1.5,
      borderColor: COLORS.border,
      backgroundColor: isDark ? COLORS.bg : COLORS.card,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: {
      color: COLORS.text,
      fontWeight: '500',
      fontSize: isCompact ? 12 : 14,
    },
    btnPrimary: {
      backgroundColor: COLORS.accent,
      borderColor: COLORS.accent,
      borderWidth: 0,
      ...Platform.select({
        web: {
          boxShadow: `0 4px 12px ${COLORS.accent}40`,
        },
      }),
    },
    btnPrimaryText: {
      color: '#ffffff',
      fontWeight: '600',
      fontSize: isCompact ? 12 : 14,
    },
    btnDanger: {
      borderColor: '#fca5a5',
      backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fff1f2',
    },
  });
