import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../utils/useResponsive';
import { useTheme } from '../hooks/useTheme';
import { storeService } from '../services/storeService';
import { qrCodeService } from '../services/qrCodeService';

export const SellerBarSettings = ({ storeData, onRefresh }) => {
  const { getColor, spacing, radius, fontSize } = useTheme();
  const { isDesktop } = useResponsive();
  const [activeTab, setActiveTab] = useState('tv');
  const [tableCount, setTableCount] = useState('10');

  const tabs = [
    { id: 'tv', label: 'Écran TV & Live' },
    { id: 'tables', label: 'Tables & QR Codes' },
    { id: 'delivery', label: 'Livraison' },
  ];

  const handleGenerateTVCode = async () => {
    // Generate a 4-digit code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    try {
      await storeService.update(storeData.id, { tv_code: code });
      Alert.alert('Succès', `Nouveau code TV généré : ${code}`);
      onRefresh();
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de générer le code.');
    }
  };

  const tvUrl = `${process.env.EXPO_PUBLIC_WEB_BASE_URL || 'https://libreshop.shop'}/boutique/tv/${storeData.slug}`;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: getColor.border, marginBottom: spacing.md }}>
        {tabs.map(t => (
          <TouchableOpacity 
            key={t.id} 
            style={{ padding: spacing.md, borderBottomWidth: 2, borderBottomColor: activeTab === t.id ? getColor.primary : 'transparent' }}
            onPress={() => setActiveTab(t.id)}
          >
            <Text style={{ color: activeTab === t.id ? getColor.primary : getColor.textSoft, fontWeight: '600' }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {activeTab === 'tv' && (
          <View style={{ gap: spacing.md }}>
            <View style={[styles.card, { backgroundColor: getColor.card }]}>
              <Text style={[styles.cardTitle, { color: getColor.text }]}>Code de connexion TV</Text>
              <Text style={{ color: getColor.textSoft, marginBottom: spacing.md }}>
                Ce code permet de connecter un écran (Smart TV, ordinateur) à l'affichage en direct du bar.
              </Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
                <View style={[styles.codeBox, { backgroundColor: getColor.background, borderColor: getColor.border }]}>
                  <Text style={[styles.codeText, { color: getColor.text }]}>{storeData.tv_code || '----'}</Text>
                </View>
                <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: getColor.primary }]} onPress={handleGenerateTVCode}>
                  <Text style={styles.btnPrimaryText}>Générer un code</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: getColor.card }]}>
              <Text style={[styles.cardTitle, { color: getColor.text }]}>Lien de l'écran TV</Text>
              <Text style={{ color: getColor.textSoft, marginBottom: spacing.md }}>
                Ouvrez ce lien sur la TV du bar et entrez le code ci-dessus pour lancer l'affichage.
              </Text>
              <View style={[styles.linkBox, { backgroundColor: getColor.background, borderColor: getColor.border }]}>
                <Text style={{ color: getColor.text }} selectable>{tvUrl}</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'tables' && (
          <View style={[styles.card, { backgroundColor: getColor.card }]}>
            <Text style={[styles.cardTitle, { color: getColor.text }]}>Générateur de QR Codes pour Tables</Text>
            <Text style={{ color: getColor.textSoft, marginBottom: spacing.md }}>
              Les clients pourront scanner ces codes pour commander directement depuis leur table sans se connecter.
            </Text>

            <Text style={{ color: getColor.text, marginBottom: 8, fontWeight: '600' }}>Nombre de tables :</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: getColor.background, color: getColor.text, borderColor: getColor.border }]} 
              value={tableCount}
              onChangeText={setTableCount}
              keyboardType="number-pad"
            />
            
            <TouchableOpacity 
              style={[styles.btnPrimary, { backgroundColor: getColor.primary, marginTop: spacing.md }]} 
              onPress={() => {
                Alert.alert('Info', 'Cette fonctionnalité générera un PDF contenant tous les QR codes de vos tables prêts à être imprimés.');
              }}
            >
              <Text style={styles.btnPrimaryText}>Générer le PDF à imprimer</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'delivery' && (
          <View style={[styles.card, { backgroundColor: getColor.card }]}>
            <Text style={[styles.cardTitle, { color: getColor.text }]}>Livraison à domicile</Text>
            <Text style={{ color: getColor.textSoft, marginBottom: spacing.md }}>
              Ici vous pourrez configurer les paramètres de livraison si votre restaurant propose la livraison à domicile.
            </Text>
            <TouchableOpacity style={[styles.btnOutline, { borderColor: getColor.border }]}>
              <Text style={{ color: getColor.text }}>Configurer les frais de livraison</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  codeBox: { padding: 16, borderRadius: 8, borderWidth: 1, minWidth: 120, alignItems: 'center' },
  codeText: { fontSize: 24, fontWeight: 'bold', letterSpacing: 4 },
  btnPrimary: { padding: 12, borderRadius: 8, alignItems: 'center' },
  btnPrimaryText: { color: '#FFF', fontWeight: 'bold' },
  btnOutline: { padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  linkBox: { padding: 12, borderRadius: 8, borderWidth: 1 },
  input: { padding: 12, borderRadius: 8, borderWidth: 1 },
});
