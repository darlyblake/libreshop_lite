import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

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
  const { getColor } = useTheme();
  const progressColor = color || getColor.primary;

  return (
    <View style={[styles.container, { height, backgroundColor: getColor.border }, style]}>
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
    // transition: 'width 0.3s ease', // Removed invalid RN style property
  },
});
