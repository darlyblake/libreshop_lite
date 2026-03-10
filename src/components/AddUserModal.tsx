import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../config/theme';
import { useResponsive } from '../utils/useResponsive';

export interface UserData {
  name: string;
  phone: string;
  email?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: UserData) => void;
  initialData?: UserData;
}

const AddUserModal: React.FC<Props> = ({
  visible,
  onClose,
  onSubmit,
  initialData,
}) => {
  const { isDesktop } = useResponsive();
  const [form, setForm] = useState<UserData>(
    initialData || { name: '', phone: '', email: '' }
  );

  // animations for entrance
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible]);

  const handleSubmit = () => {
    if (!form.name.trim() || !form.phone.trim()) {
      Alert.alert('Erreur', "Le nom et le téléphone sont requis");
      return;
    }
    onSubmit(form);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 100}
        tint="dark"
        style={styles.overlay}
      >
        <Animated.View
          style={[
            styles.container,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <LinearGradient
            colors={[COLORS.card, COLORS.bg]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.content, { maxWidth: isDesktop ? 500 : 360 }]}
          >
            <Text style={styles.title}>Nouvel utilisateur</Text>

            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Nom <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Prénom Nom"
                placeholderTextColor={COLORS.textMuted}
                value={form.name}
                onChangeText={(t) => setForm({ ...form, name: t })}
              />
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Téléphone <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="+221 77 123 45 67"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(t) => setForm({ ...form, phone: t })}
              />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="adresse@exemple.com"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                value={form.email}
                onChangeText={(t) => setForm({ ...form, email: t })}
              />
            </View>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
              >
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.submitButton]}
                onPress={handleSubmit}
              >
                <Text style={styles.submitText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxHeight: '90%',
  },
  content: {
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    elevation: 10, // Android
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    // removed deprecated shadow* props; boxShadow handles web
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  required: {
    color: COLORS.danger,
  },
  input: {
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  button: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    color: COLORS.text,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: COLORS.accent,
  },
  submitText: {
    color: COLORS.white,
    fontWeight: '600',
  },
});

export default AddUserModal;
