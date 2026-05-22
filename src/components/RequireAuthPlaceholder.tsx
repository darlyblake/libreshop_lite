import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store';
import { useTheme } from '../hooks/useTheme';

interface RequireAuthPlaceholderProps {
  title: string;
  description: string;
  icon?: string;
}

export const RequireAuthPlaceholder: React.FC<RequireAuthPlaceholderProps> = ({
  title,
  description,
  icon = 'lock-closed-outline',
}) => {
  const { showAuthModal } = useAuthStore();
  const { getColor, spacing, radius, fontSize } = useTheme();

  const handleSignInPress = async () => {
    try {
      // Force Client Auth Intent so redirect knows user is a client
      await AsyncStorage.setItem('@libreshop_auth_intent', 'client');
      showAuthModal();
    } catch (e) {
      console.error('Error setting auth intent:', e);
      showAuthModal();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: getColor.bg }]}>
      <View style={[styles.card, { backgroundColor: getColor.card, borderRadius: radius.xl }]}>
        <View style={[styles.iconWrapper, { backgroundColor: `${getColor.primary}15` }]}>
          <Ionicons name={icon as any} size={48} color={getColor.primary} />
        </View>

        <Text style={[styles.title, { color: getColor.text, fontSize: fontSize.xl }]}>
          {title}
        </Text>

        <Text style={[styles.description, { color: getColor.textMuted, fontSize: fontSize.md }]}>
          {description}
        </Text>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: getColor.primary, borderRadius: radius.lg }]}
          onPress={handleSignInPress}
          activeOpacity={0.8}
        >
          <Ionicons name="logo-google" size={20} color="#fff" />
          <Text style={styles.buttonText}>Se connecter avec Google</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 32,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 15 },
      android: { elevation: 4 },
      web: { boxShadow: '0px 10px 15px rgba(0,0,0,0.05)' }
    }),
  },
  iconWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    paddingVertical: 15,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6 },
      android: { elevation: 2 },
      web: { boxShadow: '0px 4px 6px rgba(0,0,0,0.1)' }
    }),
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
