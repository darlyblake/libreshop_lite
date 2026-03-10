import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { BackToDashboard } from '../components/BackToDashboard';
import { Ionicons } from '@expo/vector-icons';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const AdminSendNotificationScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sendToClients, setSendToClients] = useState(true);
  const [sendToSellers, setSendToSellers] = useState(true);
  const [sendToAdmins, setSendToAdmins] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendNotification = () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le titre et le message');
      return;
    }

    if (!sendToClients && !sendToSellers && !sendToAdmins) {
      Alert.alert('Erreur', 'Veuillez sélectionner au moins un groupe de destinataires');
      return;
    }

    setLoading(true);
    const recipients = [];
    if (sendToClients) recipients.push('Clients');
    if (sendToSellers) recipients.push('Vendeurs');
    if (sendToAdmins) recipients.push('Admins');

    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Succès',
        `Notification envoyée à: ${recipients.join(', ')}\n\nTitre: ${title}\nMessage: ${message}`
      );
      setTitle('');
      setMessage('');
    }, 1500);
  };

  return (
    <ScrollView style={styles.container}>
      <BackToDashboard navigation={navigation} />
      <Text style={styles.title}>Envoyer une notification</Text>

      {/* Destinataires */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Destinataires</Text>
        
        <View style={styles.recipientContainer}>
          <View style={styles.switchContainer}>
            <View style={styles.recipientInfo}>
              <Ionicons name="person" size={20} color={COLORS.accent} />
              <Text style={styles.label}>Clients</Text>
            </View>
            <Switch
              value={sendToClients}
              onValueChange={setSendToClients}
              trackColor={{ false: COLORS.border, true: COLORS.accent + '50' }}
              thumbColor={sendToClients ? COLORS.accent : COLORS.textMuted}
            />
          </View>

          <View style={styles.switchContainer}>
            <View style={styles.recipientInfo}>
              <Ionicons name="storefront" size={20} color={COLORS.accent2} />
              <Text style={styles.label}>Vendeurs</Text>
            </View>
            <Switch
              value={sendToSellers}
              onValueChange={setSendToSellers}
              trackColor={{ false: COLORS.border, true: COLORS.accent2 + '50' }}
              thumbColor={sendToSellers ? COLORS.accent2 : COLORS.textMuted}
            />
          </View>

          <View style={styles.switchContainer}>
            <View style={styles.recipientInfo}>
              <Ionicons name="shield" size={20} color={COLORS.danger} />
              <Text style={styles.label}>Administrateurs</Text>
            </View>
            <Switch
              value={sendToAdmins}
              onValueChange={setSendToAdmins}
              trackColor={{ false: COLORS.border, true: COLORS.danger + '50' }}
              thumbColor={sendToAdmins ? COLORS.danger : COLORS.textMuted}
            />
          </View>
        </View>
      </View>

      {/* Contenu de la notification */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contenu</Text>

        <Text style={styles.label}>Titre</Text>
        <TextInput
          style={styles.input}
          placeholder="Entrez le titre de la notification"
          placeholderTextColor={COLORS.textMuted}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Message</Text>
        <TextInput
          style={[styles.input, styles.messageInput]}
          placeholder="Entrez le message de la notification"
          placeholderTextColor={COLORS.textMuted}
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
      </View>

      {/* Boutons d'action */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.sendButton]}
          onPress={handleSendNotification}
          disabled={loading}
        >
          <Ionicons name="send" size={20} color={COLORS.white} />
          <Text style={styles.buttonText}>
            {loading ? 'Envoi en cours...' : 'Envoyer'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    marginVertical: SPACING.lg,
    color: COLORS.text,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    marginBottom: SPACING.md,
    color: COLORS.text,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  recipientContainer: {
    gap: SPACING.sm,
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    color: '#000000',
    fontSize: FONT_SIZE.md,
  },
  messageInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  actions: {
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  sendButton: {
    backgroundColor: COLORS.accent,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  cancelButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
});
