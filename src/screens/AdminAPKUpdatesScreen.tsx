import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  FlatList,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../config/theme';
import { BackToDashboard } from '../components/BackToDashboard';
import { Ionicons } from '@expo/vector-icons';

interface APKVersion {
  id: string;
  version: string;
  releaseDate: string;
  description: string;
  isRequired: boolean;
  isActive: boolean;
  downloadUrl: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const mockVersions: APKVersion[] = [
  {
    id: '1',
    version: '1.2.0',
    releaseDate: '2026-02-27',
    description: 'Correction de bugs et amélioration de performance',
    isRequired: false,
    isActive: true,
    downloadUrl: 'https://example.com/apk/v1.2.0',
  },
  {
    id: '2',
    version: '1.1.5',
    releaseDate: '2026-02-20',
    description: 'Ajout de nouvelles fonctionnalités',
    isRequired: true,
    isActive: true,
    downloadUrl: 'https://example.com/apk/v1.1.5',
  },
];

export const AdminAPKUpdatesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [versions, setVersions] = useState<APKVersion[]>(mockVersions);
  const [showForm, setShowForm] = useState(false);
  const [version, setVersion] = useState('');
  const [description, setDescription] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddVersion = () => {
    if (!version.trim() || !description.trim() || !downloadUrl.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const newVersion: APKVersion = {
        id: (versions.length + 1).toString(),
        version,
        releaseDate: new Date().toISOString().split('T')[0],
        description,
        isRequired,
        isActive: true,
        downloadUrl,
      };

      setVersions([newVersion, ...versions]);
      setLoading(false);
      setShowForm(false);
      setVersion('');
      setDescription('');
      setIsRequired(false);
      setDownloadUrl('');

      Alert.alert('Succès', `Version ${version} ajoutée avec succès`);
    }, 1000);
  };

  const handleDeleteVersion = (id: string) => {
    Alert.alert(
      'Confirmer',
      'Êtes-vous sûr de vouloir supprimer cette version?',
      [
        { text: 'Annuler', onPress: () => {} },
        {
          text: 'Supprimer',
          onPress: () => {
            setVersions(versions.filter((v) => v.id !== id));
            Alert.alert('Succès', 'Version supprimée');
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleToggleRequired = (id: string) => {
    setVersions(
      versions.map((v) =>
        v.id === id ? { ...v, isRequired: !v.isRequired } : v
      )
    );
  };

  const handleToggleActive = (id: string) => {
    setVersions(
      versions.map((v) =>
        v.id === id ? { ...v, isActive: !v.isActive } : v
      )
    );
  };

  return (
    <ScrollView style={styles.container}>
      <BackToDashboard navigation={navigation} />
      <Text style={styles.title}>Gestion des mises à jour APK</Text>

      {/* Bouton Ajouter */}
      {!showForm && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="add-circle" size={20} color={COLORS.text} />
          <Text style={styles.addButtonText}>Ajouter une nouvelle version</Text>
        </TouchableOpacity>
      )}

      {/* Formulaire d'ajout */}
      {showForm && (
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Ajouter une nouvelle version</Text>

          <Text style={styles.label}>Numéro de version (ex: 1.2.0)</Text>
          <TextInput
            style={styles.input}
            placeholder="1.2.0"
            placeholderTextColor={COLORS.textMuted}
            value={version}
            onChangeText={setVersion}
          />

          <Text style={styles.label}>Description des changements</Text>
          <TextInput
            style={[styles.input, styles.messageInput]}
            placeholder="Décrivez les modifications et améliorations..."
            placeholderTextColor={COLORS.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={styles.label}>URL de téléchargement</Text>
          <TextInput
            style={styles.input}
            placeholder="https://exemple.com/apk/v1.2.0"
            placeholderTextColor={COLORS.textMuted}
            value={downloadUrl}
            onChangeText={setDownloadUrl}
          />

          <View style={styles.switchContainer}>
            <Text style={styles.label}>Mise à jour obligatoire</Text>
            <Switch
              value={isRequired}
              onValueChange={setIsRequired}
              trackColor={{ false: COLORS.border, true: COLORS.accent + '50' }}
              thumbColor={isRequired ? COLORS.accent : COLORS.textMuted}
            />
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleAddVersion}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Ajout en cours...' : 'Ajouter version'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => setShowForm(false)}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Liste des versions */}
      <Text style={styles.sectionTitle}>Versions disponibles</Text>
      <FlatList
        data={versions}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={[styles.versionCard, !item.isActive && styles.versionCardInactive]}>
            <View style={styles.versionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.versionNumber}>v{item.version}</Text>
                <Text style={styles.versionDate}>{item.releaseDate}</Text>
              </View>
              <View style={styles.badgesContainer}>
                {item.isRequired && (
                  <View style={styles.requiredBadge}>
                    <Ionicons name="alert-circle" size={14} color={COLORS.text} />
                    <Text style={styles.requiredText}>Obligatoire</Text>
                  </View>
                )}
                <View style={[styles.activeBadge, !item.isActive && styles.inactiveBadge]}>
                  <Ionicons
                    name={item.isActive ? 'checkmark-circle' : 'close-circle'}
                    size={14}
                    color={COLORS.text}
                  />
                  <Text style={styles.activeBadgeText}>{item.isActive ? 'Activée' : 'Désactivée'}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.versionDescription}>{item.description}</Text>

            <View style={styles.versionUrl}>
              <Ionicons name="link" size={14} color={COLORS.textMuted} />
              <Text style={styles.urlText} numberOfLines={1}>
                {item.downloadUrl}
              </Text>
            </View>

            <View style={styles.versionControls}>
              <View style={styles.switchControl}>
                <View style={styles.controlLabel}>
                  <Ionicons
                    name={item.isActive ? 'power' : 'power-off'}
                    size={16}
                    color={item.isActive ? COLORS.success : COLORS.textMuted}
                  />
                  <Text style={styles.controlText}>{item.isActive ? 'Activée' : 'Désactivée'}</Text>
                </View>
                <Switch
                  value={item.isActive}
                  onValueChange={() => handleToggleActive(item.id)}
                  trackColor={{ false: COLORS.border, true: COLORS.success + '50' }}
                  thumbColor={item.isActive ? COLORS.success : COLORS.textMuted}
                />
              </View>

              <View style={styles.switchControl}>
                <View style={styles.controlLabel}>
                  <Ionicons
                    name={item.isRequired ? 'lock' : 'lock-open'}
                    size={16}
                    color={item.isRequired ? COLORS.danger : COLORS.accent2}
                  />
                  <Text style={styles.controlText}>{item.isRequired ? 'Obligatoire' : 'Optionnelle'}</Text>
                </View>
                <Switch
                  value={item.isRequired}
                  onValueChange={() => handleToggleRequired(item.id)}
                  trackColor={{ false: COLORS.border, true: COLORS.danger + '50' }}
                  thumbColor={item.isRequired ? COLORS.danger : COLORS.textMuted}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteVersion(item.id)}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
              <Text style={[styles.actionText, { color: COLORS.danger }]}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Aucune version</Text>
          </View>
        }
      />
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  addButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  formSection: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
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
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    color: 'COLORS.bg',
    fontSize: FONT_SIZE.md,
  },
  messageInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  formActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  button: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: COLORS.accent,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttonText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  versionCard: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    opacity: 1,
  },
  versionCardInactive: {
    opacity: 0.65,
    backgroundColor: COLORS.card + 'CC',
  },
  versionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  versionNumber: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.accent,
  },
  versionDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  requiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.danger,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    gap: SPACING.xs,
  },
  requiredText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    gap: SPACING.xs,
  },
  inactiveBadge: {
    backgroundColor: COLORS.textMuted,
  },
  activeBadgeText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  versionDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  versionUrl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
  },
  urlText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.accent,
  },
  versionControls: {
    gap: SPACING.md,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  switchControl: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  controlLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  controlText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.danger + '30',
    backgroundColor: COLORS.danger + '05',
    gap: SPACING.xs,
  },
  actionText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
});
