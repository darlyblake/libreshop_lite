import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing, Text } from 'react-native';

const { width, height } = Dimensions.get('window');

interface ParticleProps {
  symbol: string;
  delay: number;
  duration: number;
  startX: number;
  size: number;
}

const Particle = ({ symbol, delay, duration, startX, size }: ParticleProps) => {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Drop animation
    const dropAnim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: height + 50,
            duration: duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: Math.random() * 100 - 50,
            duration: duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(rotate, {
            toValue: 1,
            duration: duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        })
      ])
    );

    dropAnim.start();

    return () => dropAnim.stop();
  }, [delay, duration, opacity, translateY, translateX, rotate]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: startX,
        opacity,
        transform: [
          { translateY },
          { translateX },
          { rotate: spin }
        ]
      }}
    >
      <Text style={{ fontSize: size }}>{symbol}</Text>
    </Animated.View>
  );
};

export const AnimatedBackground = ({ theme }: { theme: string }) => {
  const [particles, setParticles] = useState<ParticleProps[]>([]);

  useEffect(() => {
    let symbols: string[] = [];
    let count = 0;

    switch (theme) {
      case 'christmas':
        symbols = ['❄️', '⛄', '🎁', '🦌'];
        count = 30;
        break;
      case 'halloween':
        symbols = ['👻', '🎃', '🦇', '💀'];
        count = 25;
        break;
      case 'valentine':
        symbols = ['❤️', '💖', '💘', '🌹'];
        count = 30;
        break;
      case 'newyear':
        symbols = ['✨', '🥂', '🎉', '🎆'];
        count = 30;
        break;
      default:
        setParticles([]);
        return;
    }

    const newParticles = Array.from({ length: count }).map(() => ({
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      delay: Math.random() * 5000,
      duration: 5000 + Math.random() * 10000,
      startX: Math.random() * width,
      size: 20 + Math.random() * 30,
    }));

    setParticles(newParticles);
  }, [theme]);

  if (theme === 'default' || theme === 'custom' || !theme) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Particle key={`${theme}-${i}`} {...p} />
      ))}
    </View>
  );
};
