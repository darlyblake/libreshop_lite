// DatePickerInput.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../hooks/useTheme';

interface DatePickerInputProps {
  label?: string;
  value: string; // YYYY-MM-DD format
  onChange: (date: string) => void;
  placeholder?: string;
  error?: string;
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Sélectionner une date',
  error,
}) => {
  const themeContext = useTheme();
  const theme = themeContext.theme;
  const COLORS = themeContext.getColor;
  const SPACING = themeContext.spacing;
  const RADIUS = themeContext.radius;
  const FONT_SIZE = themeContext.fontSize;
  const styles = React.useMemo(() => getStyles(themeContext), [themeContext]);

  const [showPicker, setShowPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    value ? new Date(value + 'T00:00:00') : null
  );

  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    const formatted = formatDateForInput(date);
    onChange(formatted);
    setShowDatePicker(false);
    setShowPicker(false);
  };

  const handleManualInput = (text: string) => {
    // Validate YYYY-MM-DD format
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (regex.test(text) || text === '') {
      onChange(text);
      if (text) {
        setSelectedDate(new Date(text + 'T00:00:00'));
      } else {
        setSelectedDate(null);
      }
    }
  };

  // For web, show styled text input
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View style={[styles.inputContainer, error ? styles.inputError : undefined]}>
          <Ionicons name="calendar-outline" size={20} color={COLORS.accent} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={COLORS.textMuted}
            value={value}
            onChangeText={handleManualInput}
          />
          {value ? (
            <TouchableOpacity onPress={() => onChange('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  // Mobile version
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      
      <TouchableOpacity
        style={[styles.inputContainer, error ? styles.inputError : undefined]}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={20} color={COLORS.accent} style={styles.inputIcon} />
        <Text style={[styles.inputText, !value ? styles.placeholderText : undefined]}>
          {value ? formatDateForDisplay(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Custom Modal Picker */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner une date</Text>
              <TouchableOpacity 
                onPress={() => setShowPicker(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Manual input option */}
              <View style={styles.modalInputContainer}>
                <Text style={styles.modalInputLabel}>Format YYYY-MM-DD</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ex: 2024-12-31"
                  placeholderTextColor={COLORS.textMuted}
                  value={value}
                  onChangeText={handleManualInput}
                />
              </View>

              <View style={styles.modalDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OU</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Native date picker button */}
              <TouchableOpacity
                style={styles.nativePickerButton}
                onPress={() => {
                  setShowDatePicker(true);
                  setShowPicker(false);
                }}
              >
                <Ionicons name="calendar" size={20} color={COLORS.accent} />
                <Text style={styles.nativePickerText}>Ouvrir le calendrier</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowPicker(false)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => {
                  if (selectedDate) {
                    handleDateSelect(selectedDate);
                  } else {
                    setShowPicker(false);
                  }
                }}
              >
                <Text style={styles.modalConfirmText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Native DateTimePicker for iOS/Android */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) {
              handleDateSelect(date);
            }
          }}
        />
      )}
    </View>
  );
};

const getStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  const FONT_SIZE = theme.fontSize;
  return StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    minHeight: 50,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    paddingVertical: SPACING.sm,
  },
  inputText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  placeholderText: {
    color: COLORS.textMuted,
  },
  errorText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.danger,
    marginTop: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...Platform.select({
      ios: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalBody: {
    marginBottom: SPACING.lg,
  },
  modalInputContainer: {
    marginBottom: SPACING.lg,
  },
  modalInputLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  modalInput: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  nativePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent + '10',
    borderWidth: 1,
    borderColor: COLORS.accent + '30',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  nativePickerText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.accent,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  modalCancelText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    backgroundColor: COLORS.accent,
  },
  modalConfirmText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
});
};