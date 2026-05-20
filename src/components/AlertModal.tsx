import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

export type AlertModalType = 'error' | 'warning' | 'info' | 'success';

export interface AlertModalButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertModalProps {
  visible: boolean;
  type?: AlertModalType;
  title: string;
  message: string;
  buttons?: AlertModalButton[];
  onClose: () => void;
}

const TYPE_CONFIG: Record<AlertModalType, { icon: string; color: string; bg: string; border: string }> = {
  error:   { icon: 'close-circle',      color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  warning: { icon: 'warning',           color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  info:    { icon: 'information-circle', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  success: { icon: 'checkmark-circle',  color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
};

export const AlertModal: React.FC<AlertModalProps> = ({
  visible,
  type = 'info',
  title,
  message,
  buttons = [{ text: 'OK', style: 'default' }],
  onClose,
}) => {
  const { getColor: COLORS, spacing: SPACING, radius: RADIUS, fontSize: FONT_SIZE, isDark } = useTheme();
  const cfg = TYPE_CONFIG[type];

  const scaleAnim = React.useRef(new Animated.Value(0.85)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handleButton = (btn: AlertModalButton) => {
    onClose();
    btn.onPress?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? '#1e1e2e' : '#ffffff',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
                  transform: [{ scale: scaleAnim }],
                  opacity: opacityAnim,
                },
              ]}
            >
              {/* Icon badge */}
              <View style={[styles.iconBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                <Ionicons name={cfg.icon as any} size={32} color={cfg.color} />
              </View>

              {/* Title */}
              <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {title}
              </Text>

              {/* Message */}
              <Text style={[styles.message, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                {message}
              </Text>

              {/* Divider */}
              <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }]} />

              {/* Buttons */}
              <View style={[styles.buttonsRow, buttons.length > 1 && styles.buttonsRowMulti]}>
                {buttons.map((btn, i) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.button,
                        buttons.length > 1 && styles.buttonFlex,
                        isCancel && [styles.buttonCancel, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }],
                        !isCancel && [styles.buttonPrimary, { backgroundColor: isDestructive ? '#ef4444' : cfg.color }],
                      ]}
                      onPress={() => handleButton(btn)}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.buttonText,
                        isCancel && { color: isDark ? '#9ca3af' : '#6b7280' },
                        !isCancel && { color: '#ffffff' },
                      ]}>
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 20,
  },
  divider: {
    width: '100%',
    height: 1,
    marginBottom: 16,
  },
  buttonsRow: {
    width: '100%',
    gap: 10,
  },
  buttonsRowMulti: {
    flexDirection: 'row-reverse',
  },
  button: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFlex: {
    flex: 1,
  },
  buttonPrimary: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonCancel: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

// ─── Hook utilitaire ─────────────────────────────────────────────────────────
interface AlertConfig {
  type?: AlertModalType;
  title: string;
  message: string;
  buttons?: AlertModalButton[];
}

export const useAlertModal = () => {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const show = useCallback((cfg: AlertConfig) => {
    setConfig(cfg);
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
  }, []);

  const AlertModalComponent = config ? (
    <AlertModal
      visible={visible}
      type={config.type}
      title={config.title}
      message={config.message}
      buttons={config.buttons}
      onClose={hide}
    />
  ) : null;

  return { show, hide, AlertModalComponent };
};
