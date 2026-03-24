import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface Props {
  navigation: any;
}

export const BackToDashboard: React.FC<Props> = ({ navigation }) => {
  const themeContext = useTheme();
  const theme = themeContext.theme;
  const COLORS = themeContext.getColor;
  const SPACING = themeContext.spacing;
  const RADIUS = themeContext.radius;
  const FONT_SIZE = themeContext.fontSize;
  const styles = React.useMemo(() => typeof getStyles === 'function' ? getStyles(themeContext) : {}, [themeContext]);

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => navigation.navigate('AdminDashboard')}
    >
      <Ionicons name="home-outline" size={24} color={COLORS.accent} />
    </TouchableOpacity>
  );
};

const getStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  const FONT_SIZE = theme.fontSize;
  return StyleSheet.create({
  button: {
    position: 'absolute',
    top: SPACING.xl,
    left: SPACING.lg,
    zIndex: 10,
  },
});
};
