import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (number: string, capacity: number) => void;
  title?: string;
  accentColor?: string;
};

export const PosAddTableModal: React.FC<Props> = ({
  visible,
  onClose,
  onAdd,
  title = 'Ajouter une table',
  accentColor,
}) => {
  const { getColor: COLORS, spacing: SPACING, radius: RADIUS } = useTheme();
  
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('2');

  const color = accentColor || COLORS.primary;

  const handleAdd = () => {
    if (!tableNumber.trim()) return;
    const cap = parseInt(capacity, 10);
    onAdd(tableNumber.trim(), isNaN(cap) || cap < 1 ? 2 : cap);
    setTableNumber('');
    setCapacity('2');
    onClose();
  };

  const handleCancel = () => {
    setTableNumber('');
    setCapacity('2');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: COLORS.card, borderRadius: RADIUS.lg }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: COLORS.text }]}>{title}</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: COLORS.textMuted }]}>Numéro ou Nom de la table</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: COLORS.bg, color: COLORS.text, borderColor: COLORS.border }
                ]}
                value={tableNumber}
                onChangeText={setTableNumber}
                placeholder="Ex: 12, Terrasse A"
                placeholderTextColor={COLORS.textMuted}
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: COLORS.textMuted }]}>Capacité (personnes)</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: COLORS.bg, color: COLORS.text, borderColor: COLORS.border }
                ]}
                value={capacity}
                onChangeText={setCapacity}
                placeholder="Ex: 4"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={[styles.footer, { borderTopColor: COLORS.border }]}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton, { borderColor: COLORS.border }]} 
              onPress={handleCancel}
            >
              <Text style={[styles.buttonText, { color: COLORS.text }]}>Annuler</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.button, 
                styles.addButton, 
                { backgroundColor: color },
                !tableNumber.trim() && { opacity: 0.5 }
              ]} 
              onPress={handleAdd}
              disabled={!tableNumber.trim()}
            >
              <Text style={[styles.buttonText, { color: '#fff' }]}>Ajouter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
    paddingTop: 0,
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
    justifyContent: 'flex-end',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  addButton: {
  },
  buttonText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
});
