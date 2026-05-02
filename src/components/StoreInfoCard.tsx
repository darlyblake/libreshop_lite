import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { contactStore } from '../services/contactService';
import { openURL } from '../utils/platformUtils';

interface InfoItem {
  label: string;
  value: string;
  icon: string;
  onPress?: () => void;
}

interface StoreInfoCardProps {
  store: {
    phone?: string;
    address?: string;
    opening_hours?: string;
    delivery_time?: string;
    email?: string;
  };
  onAddressPress?: () => void;
  onCallPress?: () => void;
}

export const StoreInfoCard: React.FC<StoreInfoCardProps> = ({
  store,
  onAddressPress,
  onCallPress,
}) => {
  const handleCall = () => {
    if (!store.phone) return;
    contactStore({ rawPhone: store.phone, fallback: 'tel' });
    onCallPress?.();
  };

  const handleEmail = () => {
    if (!store.email) return;
    try {
      openURL(`mailto:${store.email}`);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'envoyer un email');
    }
  };

  const infoItems: InfoItem[] = [
    store.opening_hours ? { label: 'Horaires', value: store.opening_hours, icon: 'time', onPress: () => {} } : null,
    store.address ? { label: 'Adresse', value: store.address, icon: 'location', onPress: onAddressPress } : null,
    store.delivery_time ? { label: 'Livraison', value: store.delivery_time, icon: 'cube', onPress: () => {} } : null,
    store.phone ? { label: 'Adal Memittes', value: store.phone, icon: 'call', onPress: handleCall } : null,
    store.email ? { label: 'Devios euppinelerts', value: store.email, icon: 'mail', onPress: handleEmail } : null,
    { label: 'Suibale', value: 'Service disponible', icon: 'checkmark-circle', onPress: () => {} },
  ].filter(Boolean) as InfoItem[];

  if (infoItems.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {infoItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.infoItem}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name={item.icon as any}
                size={24}
                color={COLORS.primary || '#7C3AED'}
              />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {item.value}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    justifyContent: 'space-between',
  },
  infoItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: `${COLORS.primary || '#7C3AED'}15`,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
});
