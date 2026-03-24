/**
 * Bouton de basculement du thème avec animation fluide
 * S'adapte automatiquement au thème actuel
 */

import React, { useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  Animated,
  StyleSheet,
  ViewStyle,
  Platform,
  View,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../context/ThemeContext';

interface ThemeToggleProps {
  size?: number;
  style?: ViewStyle;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  size = 24, 
  style, 
  showLabel = false 
}) => {
  const themeContext = useThemeContext();
  const { toggleTheme, getColor, themeName, isDark, setThemeMode, mode } = themeContext;
  
  // Animation pour la rotation du soleil/lune
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  // Animation au changement de thème
  useEffect(() => {
    // Animation de rotation (180°)
    Animated.timing(rotationAnim, {
      toValue: isDark ? 1 : 0,
      duration: 300,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    
    // Animation de scale pour l'effet de pression
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isDark]);

  // Rotation interpolée
  const rotateValue = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // Opacité des icônes
  const sunOpacity = rotationAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  });

  const moonOpacity = rotationAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const handlePress = () => {
    // Animation de pression
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    toggleTheme();
  };

  const handleSetMode = (m: 'light' | 'dark' | 'system') => {
    setThemeMode?.(m);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={[
        styles.container,
        {
          backgroundColor: getColor.card,
          borderColor: getColor.border,
          width: Math.max(size * 3.5, 120),
          height: size * 1.5,
          borderRadius: size * 0.75,
        },
        style,
      ]}
    >
      <View style={styles.leftArea}>
        <Animated.View
          style={[
            styles.iconContainer,
            {
              opacity: sunOpacity,
              transform: [{ rotate: rotateValue }],
            },
          ]}
        >
          <Ionicons name="sunny" size={size} color={getColor.textSecondary} />
        </Animated.View>

        <Animated.View
          style={[
            styles.iconContainer,
            {
              opacity: moonOpacity,
              transform: [{ rotate: rotateValue }],
            },
          ]}
        >
          <Ionicons name="moon" size={size} color={getColor.textSecondary} />
        </Animated.View>
      </View>

      <View style={styles.segmentContainer}>
        <TouchableOpacity
          onPress={() => handleSetMode('light')}
          style={[
            styles.segmentButton,
            mode === 'light' && { backgroundColor: getColor.primary },
          ]}
        >
          <Text style={[styles.segmentText, mode === 'light' && { color: '#fff' }]}>Clair</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleSetMode('system')}
          style={[
            styles.segmentButton,
            mode === 'system' && { backgroundColor: getColor.primary },
          ]}
        >
          <Text style={[styles.segmentText, mode === 'system' && { color: '#fff' }]}>Système</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleSetMode('dark')}
          style={[
            styles.segmentButton,
            mode === 'dark' && { backgroundColor: getColor.primary },
          ]}
        >
          <Text style={[styles.segmentText, mode === 'dark' && { color: '#fff' }]}>Sombre</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
    elevation: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      }
    }),
  },
  iconContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginLeft: 4,
    fontWeight: '500',
  },
  leftArea: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  segmentButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0,
    marginLeft: 6,
  },
  segmentText: {
    fontSize: 12,
    color: '#222',
  },
});
