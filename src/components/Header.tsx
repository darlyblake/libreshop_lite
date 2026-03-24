import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  transparent?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBack,
  rightAction,
  transparent = false,
}) => {
  const themeContext = useTheme();
  const theme = themeContext.theme;
  const COLORS = themeContext.getColor;
  const SPACING = themeContext.spacing;
  const RADIUS = themeContext.radius;
  const FONT_SIZE = themeContext.fontSize;
  const styles = React.useMemo(() => typeof getStyles === 'function' ? getStyles(themeContext) : {}, [themeContext]);

  return (
    <View style={[styles.container, transparent && styles.transparent]}>
      <StatusBar 
        barStyle={theme.name === 'light' ? 'dark-content' : 'light-content'} 
        backgroundColor={transparent ? 'transparent' : COLORS.bg} 
      />
      <View style={styles.content}>
        {showBack ? (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>LibreShop</Text>
          </View>
        )}
        
        {title && <Text style={styles.title}>{title}</Text>}
        
        {rightAction ? (
          <View style={styles.rightAction}>{rightAction}</View>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    </View>
  );
};

// Custom Header for Landing Page
export const LandingHeader: React.FC = () => {
  const themeContext = useTheme();
  const theme = themeContext.theme;
  const COLORS = themeContext.getColor;
  const SPACING = themeContext.spacing;
  const RADIUS = themeContext.radius;
  const FONT_SIZE = themeContext.fontSize;
  const styles = React.useMemo(() => getStyles(themeContext), [themeContext]);

  return (
    <View style={styles.landingContainer}>
      <StatusBar 
        barStyle={theme.name === 'light' ? 'dark-content' : 'light-content'} 
        backgroundColor="transparent" 
        translucent 
      />
      <View style={styles.landingContent}>
        <Text style={styles.logo}>LibreShop</Text>
        <View style={styles.landingNav}>
          <TouchableOpacity style={styles.navLink}>
            <Text style={styles.navLinkText}>Fonctionnement</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navLink}>
            <Text style={styles.navLinkText}>Tarifs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navLink}>
            <Text style={styles.navLinkText}>Explorer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const getStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  const FONT_SIZE = theme.fontSize;
  return StyleSheet.create({
  container: {
    backgroundColor: COLORS.bg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  transparent: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {},
  logo: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    textAlign: 'center',
  },
  rightAction: {
    minWidth: 40,
  },
  placeholder: {
    minWidth: 40,
  },
  // Landing Header Styles
  landingContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
  },
  landingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  landingNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xl,
  },
  navLink: {},
  navLinkText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.textSoft,
  },
});
};

