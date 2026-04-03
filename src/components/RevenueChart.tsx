// src/components/RevenueChart.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import { CartesianChart, Line, Area, useChartPressState } from 'victory-native';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { useFont, DashPathEffect } from '@shopify/react-native-skia';
import { Ionicons } from '@expo/vector-icons';


const ROBOTO_FONT_URL = require('../../assets/fonts/Roboto-Regular.ttf');


interface RevenueChartProps {
  data: { date: number; revenue: number }[];
  loading?: boolean;
  timeRange?: string;
  title?: string;
  height?: number;
  primaryColor?: string;
}

const formatYLabel = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 100_000) return `${Math.round(value / 1000)}k`;
  return value.toLocaleString('fr-FR');
};

export const RevenueChart: React.FC<RevenueChartProps> = ({
  data = [],
  loading = false,
  timeRange = '7d',
  title = "Évolution des revenus",
  height = 280,
  primaryColor = '#6366f1',
}) => {
  const font = useFont(ROBOTO_FONT_URL, 11);
  const [tooltipData, setTooltipData] = useState<{ date: number; revenue: number } | null>(null);
  const { state, isActive } = useChartPressState({ x: 0, y: { revenue: 0 } });

  const [showMA, setShowMA] = useState(true);

  // Calcul de la tendance (moyenne mobile sur 7 jours maximum par défaut)
  const chartDataWithMA = useMemo(() => {
    if (data.length === 0) return [];

    return data
      .sort((a, b) => a.date - b.date)
      .map((point, index, arr) => {
        // Tendance sur les 7 derniers points (jours)
        const window = arr.slice(Math.max(0, index - 6), index + 1);
        const ma = window.reduce((sum, p) => sum + p.revenue, 0) / window.length;

        return {
          ...point,
          revenue: point.revenue,
          movingAverage: Math.round(ma),
        };
      });
  }, [data]);

  useDerivedValue(() => {
    if (isActive) {
      runOnJS(setTooltipData)({
        date: state.x.value.value,
        revenue: state.y.revenue.value.value,
      });
    } else {
      runOnJS(setTooltipData)(null);
    }
  }, [isActive]);

  const tooltipStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: state.x.position.value - 78 }],
    opacity: isActive ? withTiming(1) : withTiming(0),
  }));

  if (!font) {
    return (
      <View style={{ minHeight: height, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="small" color={primaryColor} />
      </View>
    );
  }

  return (
    <View style={{ minHeight: height }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937' }}>{title}</Text>
        <TouchableOpacity 
          onPress={() => setShowMA(!showMA)}
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: showMA ? primaryColor + '15' : '#f3f4f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
        >
          <Ionicons name={showMA ? "trending-up" : "trending-up-outline"} size={16} color={showMA ? primaryColor : '#9ca3af'} style={{ marginRight: 6 }} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: showMA ? primaryColor : '#9ca3af' }}>Tendance</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ height: 240, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : chartDataWithMA.length === 0 ? (
        <View style={{ height: 240, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <Ionicons name="bar-chart-outline" size={56} color="#d1d5db" />
          <Text style={{ color: '#6b7280', fontSize: 15 }}>Aucune donnée disponible</Text>
        </View>
      ) : (
        <View style={{ height: 240 }}>
          <CartesianChart
            data={chartDataWithMA}
            xKey="date"
            yKeys={showMA ? ["revenue", "movingAverage"] : ["revenue"]}
            padding={{ left: 45, right: 25, top: 20, bottom: 45 }}
            axisOptions={{
              font,
              formatXLabel: (v) => {
                const d = new Date(v);
                if (timeRange === 'thisYear' || timeRange === 'all') return d.toLocaleDateString('fr-FR', { month: 'short' });
                return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
              },
              formatYLabel: formatYLabel,
              tickCount: 5,
              labelColor: '#64748b',
              lineColor: '#e2e8f0',
            }}
          >
            {({ points }) => (
              <>
                {/* Zone de revenus */}
                <Area
                  points={points.revenue}
                  y0={0}
                  color={primaryColor + '12'}
                />
                {/* Ligne principale des revenus */}
                <Line
                  points={points.revenue}
                  color={primaryColor}
                  strokeWidth={3.8}
                  animate={{ type: 'timing', duration: 300 }}
                />
                {showMA && points.movingAverage && (
                  <Line
                    points={points.movingAverage}
                    color="#f59e0b"
                    strokeWidth={2.2}
                    animate={{ type: 'timing', duration: 300 }}
                  >
                    <DashPathEffect intervals={[4, 3]} />
                  </Line>
                )}
              </>
            )}
          </CartesianChart>

          {/* Tooltip amélioré */}
          <Animated.View style={[{
            position: 'absolute',
            top: 25,
            backgroundColor: '#fff',
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 10,
            elevation: 6,
            zIndex: 100,
            pointerEvents: 'none',
            minWidth: 165,
          }, tooltipStyle]}>
            {tooltipData && (
              <>
                <Text style={{ fontSize: 13, color: '#64748b' }}>
                  {new Date(tooltipData.date).toLocaleDateString('fr-FR', { 
                    weekday: 'short', 
                    day: 'numeric', 
                    month: 'short' 
                  })}
                </Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: primaryColor, marginTop: 4 }}>
                  {tooltipData.revenue.toLocaleString('fr-FR')} FCFA
                </Text>
              </>
            )}
          </Animated.View>
        </View>
      )}

      {/* Légende expliquée pour le vendeur */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 20, marginTop: 12, paddingHorizontal: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 14, height: 14, backgroundColor: primaryColor + '20', borderRadius: 4, borderWidth: 2, borderColor: primaryColor }} />
          <Text style={{ fontSize: 13, color: '#475569' }}>Revenus réels par jour</Text>
        </View>
        {showMA && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 18, height: 2, backgroundColor: '#f59e0b', borderStyle: 'dashed' }} />
            <Text style={{ fontSize: 13, color: '#475569' }}>Tendance (Moy. 7 jours)</Text>
          </View>
        )}
      </View>
    </View>
  );
};