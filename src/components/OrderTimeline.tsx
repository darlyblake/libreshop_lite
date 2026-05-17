import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface OrderTimelineProps {
  status: string;
}

export const OrderTimeline: React.FC<OrderTimelineProps> = ({ status }) => {
  const { getColor: COLORS, spacing: SPACING, radius: RADIUS } = useTheme();

  if (status === 'cancelled') {
    return (
      <View style={{ alignItems: 'center', paddingVertical: SPACING.md, marginBottom: SPACING.lg }}>
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: (COLORS as any).danger + '20', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm }}>
          <Ionicons name="close" size={32} color={(COLORS as any).danger} />
        </View>
        <Text style={{ fontSize: 16, fontWeight: '700', color: (COLORS as any).danger }}>Commande annulée</Text>
      </View>
    );
  }

  const steps = [
    { id: 'pending', label: 'Validé', icon: 'document-text-outline' },
    { id: 'paid', label: 'Préparé', icon: 'cube-outline' },
    { id: 'shipped', label: 'En route', icon: 'airplane-outline' },
    { id: 'delivered', label: 'Livré', icon: 'checkmark-done-outline' },
  ];

  const getStepIndex = () => {
    switch (status) {
      case 'pending': return 0;
      case 'paid': return 1;
      case 'shipped': return 2;
      case 'delivered': return 3;
      default: return 0;
    }
  };

  const currentIndex = getStepIndex();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: SPACING.md, marginBottom: SPACING.xl, marginTop: SPACING.md }}>
      {steps.map((step, index) => {
        const isCompleted = index <= currentIndex;
        const isActive = index === currentIndex;
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={step.id}>
            {/* Step */}
            <View style={{ alignItems: 'center', width: 70, zIndex: 2 }}>
              <View style={[
                { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
                isCompleted ? { backgroundColor: (COLORS as any).accent } : { backgroundColor: (COLORS as any).card, borderWidth: 2, borderColor: (COLORS as any).border },
                isActive && { transform: [{ scale: 1.15 }], shadowColor: (COLORS as any).accent, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }
              ]}>
                <Ionicons name={step.icon as any} size={20} color={isCompleted ? "white" : (COLORS as any).textMuted} />
              </View>
              <Text style={[
                { marginTop: 10, fontSize: 11, textAlign: 'center' },
                isCompleted ? { color: (COLORS as any).text, fontWeight: '700' } : { color: (COLORS as any).textMuted }
              ]} numberOfLines={1}>
                {step.label}
              </Text>
            </View>

            {/* Line */}
            {!isLast && (
              <View style={{ 
                flex: 1, 
                height: 4, 
                backgroundColor: isCompleted && index < currentIndex ? (COLORS as any).accent : (COLORS as any).border,
                marginTop: 20,
                marginHorizontal: -15,
                zIndex: 1 
              }} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};
