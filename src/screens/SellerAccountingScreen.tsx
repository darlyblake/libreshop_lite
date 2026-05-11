import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useAuthStore } from '../store';
import { storeService } from '../services/storeService';
import { accountingService } from '../services/accountingService';
import { errorHandler } from '../utils/errorHandler';

export const SellerAccountingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(new Date());

  const handleExportSales = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const csv = await accountingService.exportSalesToCSV(storeId, startDate, endDate);
      accountingService.downloadCSV(csv, `ventes_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`);
      Alert.alert('Succès', 'Export des ventes réussi');
    } catch (e) {
      errorHandler.handleDatabaseError(e as Error, 'Error exporting sales');
      Alert.alert('Erreur', 'Impossible d\'exporter les ventes');
    } finally {
      setLoading(false);
    }
  };

  const handleExportInventory = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const csv = await accountingService.exportInventoryToCSV(storeId);
      accountingService.downloadCSV(csv, `inventaire_${new Date().toISOString().split('T')[0]}.csv`);
      Alert.alert('Succès', 'Export de l\'inventaire réussi');
    } catch (e) {
      errorHandler.handleDatabaseError(e as Error, 'Error exporting inventory');
      Alert.alert('Erreur', 'Impossible d\'exporter l\'inventaire');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExpenses = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const csv = await accountingService.exportExpensesToCSV(storeId, startDate, endDate);
      accountingService.downloadCSV(csv, `depenses_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`);
      Alert.alert('Succès', 'Export des dépenses réussi');
    } catch (e) {
      errorHandler.handleDatabaseError(e as Error, 'Error exporting expenses');
      Alert.alert('Erreur', 'Impossible d\'exporter les dépenses');
    } finally {
      setLoading(false);
    }
  };

  const handleExportTax = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const csv = await accountingService.exportTaxReport(storeId, startDate, endDate);
      accountingService.downloadCSV(csv, `tva_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`);
      Alert.alert('Succès', 'Export de la TVA réussi');
    } catch (e) {
      errorHandler.handleDatabaseError(e as Error, 'Error exporting tax report');
      Alert.alert('Erreur', 'Impossible d\'exporter la TVA');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneralLedger = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const ledger = await accountingService.generateGeneralLedger(storeId, startDate, endDate);
      const csv = accountingService.convertToCSV(ledger);
      accountingService.downloadCSV(csv, `grand_livre_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`);
      Alert.alert('Succès', 'Export du grand livre réussi');
    } catch (e) {
      errorHandler.handleDatabaseError(e as Error, 'Error generating general ledger');
      Alert.alert('Erreur', 'Impossible de générer le grand livre');
    } finally {
      setLoading(false);
    }
  };

  const handleBalanceSheet = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const balanceSheet = await accountingService.generateBalanceSheet(storeId, endDate);
      const csv = accountingService.convertToCSV(balanceSheet);
      accountingService.downloadCSV(csv, `bilan_${endDate.toISOString().split('T')[0]}.csv`);
      Alert.alert('Succès', 'Export du bilan réussi');
    } catch (e) {
      errorHandler.handleDatabaseError(e as Error, 'Error generating balance sheet');
      Alert.alert('Erreur', 'Impossible de générer le bilan');
    } finally {
      setLoading(false);
    }
  };

  const handleIncomeStatement = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const incomeStatement = await accountingService.generateIncomeStatement(storeId, startDate, endDate);
      const csv = accountingService.convertToCSV(incomeStatement);
      accountingService.downloadCSV(csv, `compte_resultat_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`);
      Alert.alert('Succès', 'Export du compte de résultat réussi');
    } catch (e) {
      errorHandler.handleDatabaseError(e as Error, 'Error generating income statement');
      Alert.alert('Erreur', 'Impossible de générer le compte de résultat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadStore = async () => {
      if (!user?.id) return;
      try {
        const store = await storeService.getByUser(user.id);
        if (store?.id) setStoreId(store.id);
      } catch (e) {
        errorHandler.handleDatabaseError(e as Error, 'Error loading store');
      }
    };
    loadStore();
  }, [user?.id]);

  const formatAmount = (a: number) => a.toLocaleString('fr-FR') + ' FCFA';

  const ExportCard = ({ title, description, icon, onPress }: { title: string; description: string; icon: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon as any} size={32} color={COLORS.primary} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.cardDescription}>{description}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardAction}>Exporter</Text>
        <Ionicons name="download-outline" size={20} color={COLORS.primary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Intégration Comptable</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.dateSection}>
          <Text style={styles.sectionTitle}>Période</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateInput}>
              <Text style={styles.dateLabel}>Du:</Text>
              <TextInput
                style={styles.dateValue}
                value={startDate.toLocaleDateString('fr-FR')}
                editable={false}
              />
            </View>
            <View style={styles.dateInput}>
              <Text style={styles.dateLabel}>Au:</Text>
              <TextInput
                style={styles.dateValue}
                value={endDate.toLocaleDateString('fr-FR')}
                editable={false}
              />
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Exports Comptables</Text>

        <ExportCard
          title="Ventes"
          description="Export des ventes avec détails clients et TVA"
          icon="receipt-outline"
          onPress={handleExportSales}
        />

        <ExportCard
          title="Inventaire"
          description="Export de l'inventaire avec valorisation"
          icon="cube-outline"
          onPress={handleExportInventory}
        />

        <ExportCard
          title="Dépenses"
          description="Export des dépenses et remboursements"
          icon="cash-outline"
          onPress={handleExportExpenses}
        />

        <ExportCard
          title="Rapport TVA"
          description="Rapport de taxe sur la valeur ajoutée"
          icon="document-text-outline"
          onPress={handleExportTax}
        />

        <Text style={styles.sectionTitle}>Rapports Financiers</Text>

        <ExportCard
          title="Grand Livre"
          description="General Ledger avec toutes les transactions"
          icon="book-outline"
          onPress={handleGeneralLedger}
        />

        <ExportCard
          title="Bilan"
          description="Balance Sheet (Actifs, Passifs, Capitaux)"
          icon="balance-outline"
          onPress={handleBalanceSheet}
        />

        <ExportCard
          title="Compte de Résultat"
          description="Income Statement (Revenus, Dépenses, Bénéfice)"
          icon="trending-up-outline"
          onPress={handleIncomeStatement}
        />
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Génération en cours...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, backgroundColor: COLORS.card },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text },
  content: { flex: 1, padding: SPACING.md },
  dateSection: { backgroundColor: COLORS.card, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.md },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm, marginTop: SPACING.md },
  dateRow: { flexDirection: 'row', gap: SPACING.md },
  dateInput: { flex: 1 },
  dateLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.xs },
  dateValue: { fontSize: FONT_SIZE.md, color: COLORS.text, backgroundColor: COLORS.background, padding: SPACING.sm, borderRadius: RADIUS.sm },
  card: { backgroundColor: COLORS.card, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm },
  cardTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  cardDescription: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.sm },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardAction: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.primary },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.white, marginTop: SPACING.md, fontSize: FONT_SIZE.md },
});
