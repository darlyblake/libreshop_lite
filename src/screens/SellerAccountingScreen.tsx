import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useAuthStore } from '../store';
import { storeService } from '../services/storeService';
import { accountingService } from '../services/accountingService';
import { accountingExportService } from '../services/accountingExportService';
import { errorHandler } from '../utils/errorHandler';

export const SellerAccountingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeData, setStoreData] = useState<any>(null);
  
  // États pour les dépenses
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Divers');

  const expenseCategories = ['Loyer', 'Électricité', 'Salaires', 'Marketing', 'Logistique', 'Stock', 'Impôts', 'Divers'];

  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [financialData, setFinancialData] = useState<{
    revenue: number;
    cogs: number;
    profit: number;
    inventoryValue: number;
    revenueData: any[];
  } | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const loadFinancialData = async () => {
    if (!storeId) return;
    try {
      setDataLoading(true);
      const [incomeStatement, balanceSheet] = await Promise.all([
        accountingService.generateIncomeStatement(storeId, startDate, endDate),
        accountingService.generateBalanceSheet(storeId, endDate)
      ]);

      const revenue = incomeStatement.revenue.find(r => r.name.includes('Ventes'))?.amount || 0;
      const cogs = incomeStatement.expenses.find(e => e.name.includes('Coût'))?.amount || 0;
      const profit = incomeStatement.netProfit;
      const inventoryValue = balanceSheet.assets.find(a => a.name.includes('Stock'))?.amount || 0;
      const revenueData = incomeStatement.revenue;

      setFinancialData({ revenue, cogs, profit, inventoryValue, revenueData });
      
      // On récupère les infos complètes de la boutique pour l'export
      const store = await storeService.getById(storeId);
      if (store) setStoreData(store);
    } catch (e) {
      console.error('Error loading financial data:', e);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, [storeId, startDate, endDate]);

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
      const csv = accountingService.convertToCSV([
        ...balanceSheet.assets.map(a => ({ ...a, category: 'Actifs' })),
        ...balanceSheet.liabilities.map(l => ({ ...l, category: 'Passifs' })),
        ...balanceSheet.equity.map(e => ({ ...e, category: 'Capitaux' })),
      ]);
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
      const csv = accountingService.convertToCSV([
        ...incomeStatement.revenue.map(r => ({ ...r, category: 'Revenus' })),
        ...incomeStatement.expenses.map(e => ({ ...e, category: 'Dépenses' })),
        { name: 'Bénéfice net', amount: incomeStatement.netProfit, category: 'Résultat' },
      ]);
      accountingService.downloadCSV(csv, `compte_resultat_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`);
      Alert.alert('Succès', 'Export du compte de résultat réussi');
    } catch (e) {
      errorHandler.handleDatabaseError(e as Error, 'Error generating income statement');
      Alert.alert('Erreur', 'Impossible de générer le compte de résultat');
    } finally {
      setLoading(false);
    }
  };

  const handleExportGrandLivrePDF = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      // Re-vérification du nom de la boutique juste avant l'export
      let currentStoreName = storeData?.name;
      if (!currentStoreName) {
        const store = await storeService.getById(storeId);
        currentStoreName = store?.name;
      }
      
      const ledger = await accountingService.generateGeneralLedger(storeId, startDate, endDate);
      const period = `Du ${startDate.toLocaleDateString('fr-FR')} au ${endDate.toLocaleDateString('fr-FR')}`;
      await accountingExportService.exportGrandLivre(currentStoreName || 'Ma Boutique', ledger, period);
      setLoading(false); // On débloque ici car l'onglet s'est ouvert
    } catch (e) {
      setLoading(false);
      errorHandler.handleDatabaseError(e as Error, 'Error exporting Ledger');
      Alert.alert('Erreur', 'Impossible de générer le rapport');
    }
  };

  const handleExportIncomeStatementPDF = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      // Re-vérification du nom de la boutique juste avant l'export
      let currentStoreName = storeData?.name;
      if (!currentStoreName) {
        const store = await storeService.getById(storeId);
        currentStoreName = store?.name;
      }

      const statement = await accountingService.generateIncomeStatement(storeId, startDate, endDate);
      const period = `Du ${startDate.toLocaleDateString('fr-FR')} au ${endDate.toLocaleDateString('fr-FR')}`;
      await accountingExportService.exportIncomeStatement(currentStoreName || 'Ma Boutique', statement, period);
      setLoading(false); // On débloque ici car l'onglet s'est ouvert
    } catch (e) {
      setLoading(false);
      errorHandler.handleDatabaseError(e as Error, 'Error exporting Income Statement');
      Alert.alert('Erreur', 'Impossible de générer le rapport');
    }
  };

  const handleSaveExpense = async () => {
    if (!storeId || !expenseDesc || !expenseAmount) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    try {
      setLoading(true);
      await accountingService.recordExpense({
        store_id: storeId,
        description: expenseDesc,
        amount: Number(expenseAmount),
        category: expenseCategory,
      });
      setExpenseModalVisible(false);
      setExpenseDesc('');
      setExpenseAmount('');
      Alert.alert('Succès', 'Dépense enregistrée');
      loadFinancialData(); // Rafraîchir les calculs
    } catch (e) {
      errorHandler.handleDatabaseError(e as Error, 'Error recording expense');
      Alert.alert('Erreur', 'Impossible d\'enregistrer la dépense');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadStore = async () => {
      if (!user?.id) return;
      try {
        const store = await storeService.getByUser(user.id);
        if (store?.id) {
          setStoreId(store.id);
          setStoreData(store);
        }
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

  const StatCard = ({ title, value, icon, color }: { title: string; value: number | string; icon: string; color: string }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statIconContainer}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={[styles.statValue, { color }]}>{typeof value === 'number' ? formatAmount(value) : value}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Intégration Comptable</Text>
        <TouchableOpacity 
          style={{ backgroundColor: COLORS.danger, padding: 8, borderRadius: 8 }}
          onPress={() => setExpenseModalVisible(true)}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Saisir Dépense</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Alerte de Santé Financière */}
        {financialData && financialData.profit < 0 && (
          <View style={styles.deficitAlert}>
            <Ionicons name="warning" size={24} color="white" />
            <View style={{ flex: 1 }}>
              <Text style={styles.deficitTitle}>Alerte de Santé Financière</Text>
              <Text style={styles.deficitMessage}>
                Attention : Vos dépenses dépassent vos revenus sur cette période. Vous perdez de l'argent.
              </Text>
            </View>
          </View>
        )}
        <View style={styles.dateSection}>
          <Text style={styles.sectionTitle}>Période</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => {
                if (Platform.OS === 'web') {
                  (document.getElementById('start-date-picker') as any)?.showPicker();
                } else {
                  setShowStartPicker(true);
                }
              }}
            >
              <Text style={styles.dateLabel}>Du:</Text>
              <Text style={styles.dateValue}>{startDate.toLocaleDateString('fr-FR')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => {
                if (Platform.OS === 'web') {
                  (document.getElementById('end-date-picker') as any)?.showPicker();
                } else {
                  setShowEndPicker(true);
                }
              }}
            >
              <Text style={styles.dateLabel}>Au:</Text>
              <Text style={styles.dateValue}>{endDate.toLocaleDateString('fr-FR')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {Platform.OS === 'web' ? (
          <>
            {/* Hidden native inputs for web */}
            <input
              type="date"
              id="start-date-picker"
              style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }}
              value={startDate.toISOString().split('T')[0]}
              onChange={(e) => {
                const date = new Date(e.target.value);
                if (!isNaN(date.getTime())) setStartDate(date);
              }}
            />
            <input
              type="date"
              id="end-date-picker"
              style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }}
              value={endDate.toISOString().split('T')[0]}
              onChange={(e) => {
                const date = new Date(e.target.value);
                if (!isNaN(date.getTime())) setEndDate(date);
              }}
            />
          </>
        ) : (
          <>
            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                onChange={(event, date) => {
                  setShowStartPicker(false);
                  if (date) setStartDate(date);
                }}
              />
            )}

            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                onChange={(event, date) => {
                  setShowEndPicker(false);
                  if (date) setEndDate(date);
                }}
              />
            )}
          </>
        )}

        <Text style={styles.sectionTitle}>Aperçu Financier</Text>
        {dataLoading ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : financialData ? (
          <View style={styles.statsContainer}>
            <StatCard title="Ventes Produits" value={financialData.revenue} icon="cash" color={COLORS.success} />
            <StatCard title="TVA Collectée" value={financialData.revenueData.find(r => r.name.includes('TVA'))?.amount || 0} icon="receipt" color={COLORS.accent} />
            <StatCard title="Frais de Livraison" value={financialData.revenueData.find(r => r.name.includes('Livraison'))?.amount || 0} icon="car" color={COLORS.accent2} />
            <StatCard title="Coût des Ventes" value={financialData.cogs} icon="pricetag" color={COLORS.warning} />
            <StatCard title="Bénéfice Net" value={financialData.profit} icon="trending-up" color={financialData.profit >= 0 ? COLORS.success : COLORS.danger} />
            <StatCard title="Valeur du Stock" value={financialData.inventoryValue} icon="cube" color={COLORS.info || '#007bff'} />
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Exports Comptables</Text>

        <ExportCard
          title="Grand Livre (Pro)"
          description="Document professionnel avec solde cumulé et chronologie"
          icon="book-outline"
          onPress={handleExportGrandLivrePDF}
        />

        <ExportCard
          title="Compte de Résultat (Pro)"
          description="Bénéfice net, revenus et charges détaillés par catégorie"
          icon="cash-outline"
          onPress={handleExportIncomeStatementPDF}
        />

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
          icon="scale-outline"
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

      <Modal
        visible={expenseModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setExpenseModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.expenseModal}>
            <Text style={styles.modalTitle}>Nouvelle Dépense</Text>
            
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={expenseDesc}
              onChangeText={setExpenseDesc}
              placeholder="Libellé"
            />

            <Text style={styles.label}>Montant (FCFA)</Text>
            <TextInput
              style={styles.input}
              value={expenseAmount}
              onChangeText={setExpenseAmount}
              keyboardType="numeric"
              placeholder="0"
            />

            <Text style={styles.label}>Catégorie</Text>
            <View style={styles.categoryContainer}>
              {expenseCategories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryBadge, expenseCategory === cat && styles.categoryBadgeActive]}
                  onPress={() => setExpenseCategory(cat)}
                >
                  <Text style={[styles.categoryText, expenseCategory === cat && styles.categoryTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setExpenseModalVisible(false)}
              >
                <Text>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={handleSaveExpense}
              >
                <Text style={{ color: 'white' }}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, backgroundColor: COLORS.card },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.text },
  content: { flex: 1, padding: SPACING.md },
  dateSection: { backgroundColor: COLORS.card, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.md },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm, marginTop: SPACING.md },
  dateRow: { flexDirection: 'row', gap: SPACING.md },
  dateInput: { flex: 1, backgroundColor: COLORS.bg, padding: SPACING.sm, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border },
  dateLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.xs },
  dateValue: { fontSize: FONT_SIZE.md, color: COLORS.text },
  card: { backgroundColor: COLORS.card, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm },
  cardTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  cardDescription: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.sm },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardAction: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.primary },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.white, marginTop: SPACING.md, fontSize: FONT_SIZE.md },
  deficitAlert: {
    backgroundColor: '#ef4444',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 4,
  },
  deficitTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deficitMessage: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    marginTop: 2,
  },
  statsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.md },
  statCard: { 
    flex: 1, 
    minWidth: '45%', 
    backgroundColor: COLORS.card, 
    padding: SPACING.md, 
    borderRadius: RADIUS.md, 
    borderLeftWidth: 4, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: SPACING.md,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 3px rgba(0,0,0,0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
      }
    })
  },
  statIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  statContent: { flex: 1 },
  statTitle: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 4 },
  statValue: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  expenseModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: COLORS.text,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8fafc',
    color: COLORS.text,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryBadgeActive: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b',
  },
  categoryText: {
    fontSize: 12,
    color: '#64748b',
  },
  categoryTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 30,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  saveButton: {
    backgroundColor: '#1e293b',
  },
});
