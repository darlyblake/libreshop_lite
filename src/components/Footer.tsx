import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE } from '../config/theme';

interface FooterLink {
  label: string;
  href?: string;
  onPress?: () => void;
}

interface FooterProps {
  links?: FooterLink[];
  companyName?: string;
  style?: ViewStyle;
}

export const Footer: React.FC<FooterProps> = ({
  links = [],
  companyName = 'LibreShop',
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.links}>
        {links.map((link, index) => (
          <TouchableOpacity
            key={index}
            onPress={link.onPress}
            style={styles.link}
          >
            <Text style={styles.linkText}>{link.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.brand}>
        <Ionicons name="storefront-outline" size={20} color={COLORS.textMuted} />
        <Text style={styles.brandText}>© {new Date().getFullYear()} {companyName}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  link: {
    padding: SPACING.xs,
  },
  linkText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  brandText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
});

