import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../config/theme';

interface ProgressBarProps {
  progress: number;
  color?: string;
  height?: number;
  style?: ViewStyle;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color = COLORS.accent,
  height = 8,
  style,
}) => {
  return (
    <View style={[styles.container, { height }, style]}>
      <View 
        style={[
          styles.progress, 
          { 
            width: `${Math.min(Math.max(progress, 0), 1) * 100}%`,
            backgroundColor: color,
          }
        ]} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    borderRadius: RADIUS.full,
    transition: 'width 0.3s ease',
  },
});
