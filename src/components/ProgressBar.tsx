import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useThemeContext } from '../context/ThemeContext';

interface ProgressBarProps {
  progress: number;
  color?: string;
  height?: number;
  style?: ViewStyle;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color,
  height = 8,
  style,
}) => {
  const { theme } = useThemeContext();
  const progressColor = color || theme.getColor.primary;

  return (
    <View style={[styles.container, { height, backgroundColor: theme.getColor.border }, style]}>
      <View 
        style={[
          styles.progress, 
          { 
            width: `${Math.min(Math.max(progress, 0), 1) * 100}%`,
            backgroundColor: progressColor,
          }
        ]} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 9999, // full radius
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    borderRadius: 9999, // full radius
    transition: 'width 0.3s ease',
  },
});
