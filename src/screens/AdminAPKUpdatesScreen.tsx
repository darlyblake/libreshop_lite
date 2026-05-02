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
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface APKVersion {
  id: string;
  version: string;
  releaseDate: string;
  description: string;
  isRequired: boolean;
  isActive: boolean;
  downloadUrl: string;
}

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
];

export const AdminAPKUpdatesScreen: React.FC = () => {
  const { getColor, spacing } = useTheme();
  const COLORS = getColor;
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
      Alert.alert('Succès', `Version ${version} ajoutée`);
    }, 700);
  };

  const toggleActive = (id: string) => {
    setVersions(v => v.map(item => item.id === id ? { ...item, isActive: !item.isActive } : item));
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: COLORS.background }]}>
      <Text style={[styles.title, { color: COLORS.text }]}>Gestion des mises à jour APK</Text>

      {!showForm && (
        <TouchableOpacity style={[styles.addButton, { borderColor: COLORS.border }]} onPress={() => setShowForm(true)}>
          <Ionicons name={'add-circle' as any} size={18} color={COLORS.accent} />
          <Text style={[styles.addButtonText, { color: COLORS.text }]}>Ajouter une nouvelle version</Text>
        </TouchableOpacity>
      )}

      {showForm && (
        <View style={[styles.form, { borderColor: COLORS.border }]}>
          <Text style={[styles.label, { color: COLORS.text }]}>Numéro de version</Text>
          <TextInput style={[styles.input, { borderColor: COLORS.border }]} value={version} onChangeText={setVersion} placeholder="1.2.0" placeholderTextColor={COLORS.textMuted} />
          <Text style={[styles.label, { color: COLORS.text }]}>Description</Text>
          <TextInput style={[styles.input, styles.messageInput, { borderColor: COLORS.border }]} value={description} onChangeText={setDescription} placeholder="Notes" placeholderTextColor={COLORS.textMuted} multiline />
          <Text style={[styles.label, { color: COLORS.text }]}>URL de téléchargement</Text>
          <TextInput style={[styles.input, { borderColor: COLORS.border }]} value={downloadUrl} onChangeText={setDownloadUrl} placeholder="https://..." placeholderTextColor={COLORS.textMuted} />

          <View style={styles.switchRow}>
            <Text style={{ color: COLORS.text }}>Mise à jour obligatoire</Text>
            <Switch value={isRequired} onValueChange={setIsRequired} thumbColor={isRequired ? COLORS.danger : COLORS.textMuted} />
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity style={[styles.button, { backgroundColor: COLORS.accent }]} onPress={handleAddVersion}>
              <Text style={[styles.buttonText]}>{loading ? 'Ajout...' : 'Ajouter version'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { borderColor: COLORS.border }]} onPress={() => setShowForm(false)}>
              <Text style={[styles.buttonText, { color: COLORS.textMuted }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Versions disponibles</Text>
      <FlatList
        data={versions}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={[styles.versionCard, { borderColor: COLORS.border, backgroundColor: COLORS.card }]}> 
            <View style={styles.versionRow}>
              <View>
                <Text style={{ color: COLORS.text, fontWeight: '700' }}>v{item.version}</Text>
                <Text style={{ color: COLORS.textMuted }}>{item.releaseDate}</Text>
              </View>
              <View style={styles.versionControls}>
                <Text style={{ color: COLORS.textMuted }}>{item.isRequired ? 'Obligatoire' : 'Optionnelle'}</Text>
                <Switch value={item.isActive} onValueChange={() => toggleActive(item.id)} thumbColor={item.isActive ? COLORS.success : COLORS.textMuted} />
              </View>
            </View>
            <Text style={{ color: COLORS.text }}>{item.description}</Text>
            <Text style={{ color: COLORS.textMuted }}>{item.downloadUrl}</Text>
          </View>
        )}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  addButton: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1, borderRadius: 8, marginBottom: 12 },
  addButtonText: { marginLeft: 8, fontWeight: '600' },
  form: { padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 12 },
  label: { marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, padding: 8, borderRadius: 6, marginBottom: 8 },
  messageInput: { height: 80 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  formActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  button: { padding: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginRight: 8 },
  buttonText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { marginTop: 8, marginBottom: 8, fontWeight: '700' },
  versionCard: { padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 8 },
  versionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  versionControls: { alignItems: 'flex-end' },
});

export default AdminAPKUpdatesScreen;
