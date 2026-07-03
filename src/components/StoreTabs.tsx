import React from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SPACING, FONT_SIZE } from '../config/theme';
import { useTheme } from '../hooks/useTheme';

const { width } = Dimensions.get('window');

interface Tab {
  id: string;
  label: string;
  icon?: string;
}

interface StoreTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const StoreTabs: React.FC<StoreTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
}) => {
  const { getColor: COLORS } = useTheme();
  const styles = React.useMemo(() => getStyles(COLORS), [COLORS]);
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={{ minWidth: '100%' }}
      >
        <View style={styles.tabsWrapper}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                activeTab === tab.id && styles.activeTab,
              ]}
              onPress={() => onTabChange(tab.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === tab.id && styles.activeTabLabel,
                ]}
              >
                {tab.label}
              </Text>
              {activeTab === tab.id && (
                <View style={styles.activeIndicator} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: {
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabsWrapper: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-between',
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  activeTab: {
    borderBottomColor: COLORS.primary || '#7C3AED',
  },
  tabLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  activeTabLabel: {
    color: COLORS.text,
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.primary || '#7C3AED',
  },
});
