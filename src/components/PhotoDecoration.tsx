import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PhotoDecorationProps {
  type: string;
}

export const PhotoDecoration = ({ type }: PhotoDecorationProps) => {
  if (!type || type === 'none') return null;

  let icon = '';
  switch (type) {
    case 'birthday':
      icon = '🎂';
      break;
    case 'wedding':
      icon = '💍';
      break;
    case 'graduation':
      icon = '🎓';
      break;
    case 'party':
      icon = '🎉';
      break;
    default:
      return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 25,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  icon: {
    fontSize: 24,
  }
});
