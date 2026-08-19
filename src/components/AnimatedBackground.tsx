import React, { useEffect, useRef, memo } from 'react';
import { View, Text, Animated, Easing, Dimensions, StyleSheet } from 'react-native';

const { width, height } = Dimensions.get('window');

const THEME_SYMBOLS: Record<string, string[]> = {
  christmas: ['❄️', '⛄', '🎁', '🦌', '❄️', '❄️'],
  halloween: ['👻', '🎃', '🦇', '💀', '👻', '👻'],
  valentine: ['❤️', '💖', '💘', '🌹', '❤️', '💕'],
  newyear: ['✨', '🥂', '🎉', '🎆', '✨', '🌟'],
};

interface ParticleConfig {
  symbol: string;
  startX: number;
  startDelay: number;
  duration: number;
  size: number;
  drift: number; // horizontal drift amount
}

const Particle = memo(({ symbol, startX, startDelay, duration, size, drift }: ParticleConfig) => {
  const translateY = useRef(new Animated.Value(-80)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(startDelay),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: height + 80,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: drift,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(rotate, {
            toValue: 1,
            duration: duration * 0.7,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
        // Reset instantly (no visible jump since particle is off-screen)
        Animated.parallel([
          Animated.timing(translateY, { toValue: -80, duration: 0, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={[
        styles.particle,
        { left: startX, transform: [{ translateY }, { translateX }, { rotate: spin }] }
      ]}
    >
      <Text style={{ fontSize: size }}>{symbol}</Text>
    </Animated.View>
  );
});

interface Props {
  theme: string;
}

export const AnimatedBackground = ({ theme }: Props) => {
  const symbols = THEME_SYMBOLS[theme];
  if (!symbols) return null;

  const COUNT = 25;
  const particles: ParticleConfig[] = Array.from({ length: COUNT }).map((_, i) => ({
    symbol: symbols[i % symbols.length],
    startX: (width / COUNT) * i + Math.random() * (width / COUNT),
    startDelay: (i / COUNT) * 8000,
    duration: 7000 + Math.random() * 6000,
    size: 22 + Math.random() * 22,
    drift: Math.random() * 60 - 30,
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p, i) => (
        <Particle key={i} {...p} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    top: 0,
  },
});
