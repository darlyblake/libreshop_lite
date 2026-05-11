import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { useResponsive } from '../utils/useResponsive';
import { useAuthStore } from '../store';
import { storeService } from '../services/storeService';
import { reportsService, DailySalesReport, MonthlySalesReport, CategorySalesReport, MarginReport, ReturnReport, InventoryReport, ClientReport } from '../services/reportsService';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type ReportType = 'daily' | 'monthly' | 'category' | 'margin' | 'return' | 'inventory' | 'client';

const REPORTS = [
  { id: 'daily', title: 'Ventes par Jour', icon: 'calendar-outline', description: 'Ventes quotidiennes détaillées' },
  { id: 'monthly', title: 'Ventes par Mois', icon: 'calendar-number-outline', description: 'Ventes mensuelles agrégées' },
  { id: 'category', title: 'Ventes par Catégorie', icon: 'pricetag-outline', description: 'Performance par catégorie' },
  { id: 'margin', title: 'Marges', icon: 'trending-up-outline', description: 'Analyse des marges bénéficiaires' },
  { id: 'return', title: 'Retours', icon: 'refresh-outline', description: 'Rapport des retours' },
  { id: 'inventory', title: 'Inventaire', icon: 'cube-outline', description: 'État du stock' },
  { id: 'client', title: 'Clients', icon: 'people-outline', description: 'Analyse de la clientèle' },
];

export const SellerReportsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { spacing, fontSize, isMobile, isTablet, isDesktop } = useResponsive();

  const [selectedReport, setSelectedReport] = useState<ReportType>('daily');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  const [dailySales, setDailySales] = useState<DailySalesReport[]>([]);
  const [monthlySales, setMonthlySales] = useState<MonthlySalesReport[]>([]);
  const [categorySales, setCategorySales] = useState<CategorySalesReport[]>([]);
  const [margins, setMargins] = useState<MarginReport[]>([]);
  const [returns, setReturns] = useState<ReturnReport[]>([]);
  const [inventory, setInventory] = useState<InventoryReport[]>([]);
  const [clients, setClients] = useState<ClientReport[]>([]);

  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(new Date());

  useEffect(() => {
    loadStore();
  }, [user?.id]);

  useEffect(() => {
    if (storeId) {
      loadReports();
    }
  }, [storeId, selectedReport, startDate, endDate]);

  const loadStore = async () => {
    if (!user?.id) return;
    try {
      const store = await storeService.getByUser(user.id);
      if (store?.id) {
        setStoreId(store.id);
      }
    } catch (e) {
      errorHandler.handleDatabaseError(e as Error, 'Error loading store');
    }
  };

  const loadReports = async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      
      switch (selectedReport) {
        case 'daily':
          const daily = await reportsService.getDailySalesReport(storeId, startDate, endDate);
          setDailySales(daily);
          break;
        case 'monthly':
          const monthly = await reportsService.getMonthlySalesReport(storeId, startDate.getFullYear());
          setMonthlySales(monthly);
          break;
        case 'category':
          const category = await reportsService.getCategorySalesReport(storeId, startDate, endDate);
          setCategorySales(category);
          break;
        case 'margin':
          const margin = await reportsService.getMarginReport(storeId, startDate, endDate);
          setMargins(margin);
          break;
        case 'return':
          const returnData = await reportsService.getReturnReport(storeId, startDate, endDate);
          setReturns(returnData);
          break;
        case 'inventory':
          const inventoryData = await reportsService.getInventoryReport(storeId);
          setInventory(inventoryData);
          break;
        case 'client':
          const clientData = await reportsService.getClientReport(storeId);
          setClients(clientData);
          break;
      }
    } catch (e) {
      errorHandler.handleDatabaseError(e as Error, 'Error loading reports');
      Alert.alert('Erreur', 'Impossible de charger les rapports');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };

  const exportReport = async () => {
    try {
      let data: any[] = [];
      let filename = 'rapport';

      switch (selectedReport) {
        case 'daily':
          data = dailySales;
          filename = 'ventes_journalieres';
          break;
        case 'monthly':
          data = monthlySales;
          filename = 'ventes_mensuelles';
          break;
        case 'category':
          data = categorySales;
          filename = 'ventes_par_categorie';
          break;
        case 'margin':
          data = margins;
          filename = 'marges';
          break;
        case 'return':
          data = returns;
          filename = 'retours';
          break;
        case 'inventory':
          data = inventory;
          filename = 'inventaire';
          break;
        case 'client':
          data = clients;
          filename = 'clients';
          break;
      }

      if (data.length === 0) {
        Alert.alert('Information', 'Aucune donnée à exporter');
        return;
      }

      const csv = reportsService.exportToCSV(data, filename);
      
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const html = `
          <html>
            <head><title>${filename}</title></head>
            <body>
              <pre style="font-family: monospace;">${csv}</pre>
            </body>
          </html>
        `;
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri);
      }

      Alert.alert('Succès', 'Rapport exporté avec succès');
    } catch (e) {
      errorHandler.handleDatabaseError(e as Error, 'Error exporting report');
      Alert.alert('Erreur', 'Impossible d\'exporter le rapport');
    }
  };

  const formatAmount = (amount: number) => amount.toLocaleString('fr-FR') + ' FCFA';

  const renderDailySales = () => (
    <FlatList
      data={dailySales}
      keyExtractor={(item) => item.date}
      renderItem={({ item }) => (
        <View style={styles.reportItem}>
          <View style={styles.reportItemHeader}>
            <Text style={styles.reportItemTitle}>{item.date}</Text>
            <Text style={styles.reportItemValue}>{formatAmount(item.totalRevenue)}</Text>
          </View>
          <View style={styles.reportItemDetails}>
            <Text style={styles.reportItemDetail}>{item.totalOrders} commandes</Text>
            <Text style={styles.reportItemDetail}>{formatAmount(item.averageOrderValue)} / commande</Text>
            <Text style={styles.reportItemDetail}>{item.totalItemsSold} articles</Text>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>Aucune donnée disponible</Text>}
    />
  );

  const renderMonthlySales = () => (
    <FlatList
      data={monthlySales}
      keyExtractor={(item, index) => `${item.month}-${index}`}
      renderItem={({ item }) => (
        <View style={styles.reportItem}>
          <View style={styles.reportItemHeader}>
            <Text style={styles.reportItemTitle}>{item.month} {item.year}</Text>
            <Text style={styles.reportItemValue}>{formatAmount(item.totalRevenue)}</Text>
          </View>
          <View style={styles.reportItemDetails}>
            <Text style={styles.reportItemDetail}>{item.totalOrders} commandes</Text>
            <Text style={styles.reportItemDetail}>{formatAmount(item.averageOrderValue)} / commande</Text>
            <Text style={styles.reportItemDetail}>{item.totalItemsSold} articles</Text>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>Aucune donnée disponible</Text>}
    />
  );

  const renderCategorySales = () => (
    <FlatList
      data={categorySales}
      keyExtractor={(item) => item.categoryId}
      renderItem={({ item }) => (
        <View style={styles.reportItem}>
          <View style={styles.reportItemHeader}>
            <Text style={styles.reportItemTitle}>{item.categoryName}</Text>
            <Text style={styles.reportItemValue}>{formatAmount(item.totalRevenue)}</Text>
          </View>
          <View style={styles.reportItemDetails}>
            <Text style={styles.reportItemDetail}>{item.percentage.toFixed(1)}% du total</Text>
            <Text style={styles.reportItemDetail}>{item.totalOrders} commandes</Text>
            <Text style={styles.reportItemDetail}>{item.totalItemsSold} articles</Text>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>Aucune donnée disponible</Text>}
    />
  );

  const renderMargins = () => (
    <FlatList
      data={margins}
      keyExtractor={(item) => item.productId}
      renderItem={({ item }) => (
        <View style={styles.reportItem}>
          <View style={styles.reportItemHeader}>
            <Text style={styles.reportItemTitle}>{item.productName}</Text>
            <Text style={[styles.reportItemValue, { color: item.marginPercentage >= 20 ? COLORS.success : COLORS.warning }]}>
              {item.marginPercentage.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.reportItemDetails}>
            <Text style={styles.reportItemDetail}>Coût: {formatAmount(item.costPrice)}</Text>
            <Text style={styles.reportItemDetail}>Vente: {formatAmount(item.sellingPrice)}</Text>
            <Text style={styles.reportItemDetail}>Marge: {formatAmount(item.margin)}</Text>
            <Text style={styles.reportItemDetail}>Total: {formatAmount(item.totalMargin)} ({item.quantitySold} vendus)</Text>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>Aucune donnée disponible</Text>}
    />
  );

  const renderReturns = () => (
    <FlatList
      data={returns}
      keyExtractor={(item) => item.orderId}
      renderItem={({ item }) => (
        <View style={styles.reportItem}>
          <View style={styles.reportItemHeader}>
            <Text style={styles.reportItemTitle}>{item.productName}</Text>
            <Text style={[styles.reportItemValue, { color: COLORS.danger }]}>{formatAmount(item.refundAmount)}</Text>
          </View>
          <View style={styles.reportItemDetails}>
            <Text style={styles.reportItemDetail}>Commande: {item.orderId.slice(0, 8)}</Text>
            <Text style={styles.reportItemDetail}>Quantité: {item.quantity}</Text>
            <Text style={styles.reportItemDetail}>Raison: {item.reason}</Text>
            <Text style={styles.reportItemDetail}>Statut: {item.status}</Text>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>Aucun retour enregistré</Text>}
    />
  );

  const renderInventory = () => (
    <FlatList
      data={inventory}
      keyExtractor={(item) => item.productId}
      renderItem={({ item }) => (
        <View style={[styles.reportItem, item.status === 'out' && styles.reportItemCritical, item.status === 'low' && styles.reportItemWarning]}>
          <View style={styles.reportItemHeader}>
            <Text style={styles.reportItemTitle}>{item.productName}</Text>
            <Text style={[styles.reportItemValue, { color: item.status === 'out' ? COLORS.danger : item.status === 'low' ? COLORS.warning : COLORS.success }]}>
              {item.currentStock}
            </Text>
          </View>
          <View style={styles.reportItemDetails}>
            <Text style={styles.reportItemDetail}>Catégorie: {item.category}</Text>
            <Text style={styles.reportItemDetail}>Seuil: {item.lowStockThreshold}</Text>
            <Text style={styles.reportItemDetail}>Valeur: {formatAmount(item.value)}</Text>
            <Text style={styles.reportItemDetail}>Statut: {item.status === 'out' ? 'Rupture' : item.status === 'low' ? 'Faible' : 'OK'}</Text>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>Aucun produit en inventaire</Text>}
    />
  );

  const renderClients = () => (
    <FlatList
      data={clients}
      keyExtractor={(item) => item.clientId}
      renderItem={({ item }) => (
        <View style={styles.reportItem}>
          <View style={styles.reportItemHeader}>
            <Text style={styles.reportItemTitle}>{item.clientName}</Text>
            <Text style={styles.reportItemValue}>{formatAmount(item.totalSpent)}</Text>
          </View>
          <View style={styles.reportItemDetails}>
            <Text style={styles.reportItemDetail}>Téléphone: {item.clientPhone}</Text>
            <Text style={styles.reportItemDetail}>{item.totalOrders} commandes</Text>
            <Text style={styles.reportItemDetail}>{formatAmount(item.averageOrderValue)} / commande</Text>
            <Text style={[styles.reportItemDetail, item.status === 'inactive' && { color: COLORS.textMuted }]}>
              Statut: {item.status === 'active' ? 'Actif' : 'Inactif'}
            </Text>
          </View>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>Aucun client enregistré</Text>}
    />
  );

  const renderReportContent = () => {
    switch (selectedReport) {
      case 'daily':
        return renderDailySales();
      case 'monthly':
        return renderMonthlySales();
      case 'category':
        return renderCategorySales();
      case 'margin':
        return renderMargins();
      case 'return':
        return renderReturns();
      case 'inventory':
        return renderInventory();
      case 'client':
        return renderClients();
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rapports Avancés</Text>
        <TouchableOpacity onPress={exportReport} style={styles.exportButton}>
          <Ionicons name="download-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Report Type Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reportTypesContainer}>
          {REPORTS.map((report) => (
            <TouchableOpacity
              key={report.id}
              style={[
                styles.reportTypeButton,
                selectedReport === report.id && styles.reportTypeButtonActive,
              ]}
              onPress={() => setSelectedReport(report.id as ReportType)}
            >
              <Ionicons
                name={report.icon}
                size={20}
                color={selectedReport === report.id ? COLORS.white : COLORS.textMuted}
              />
              <Text
                style={[
                  styles.reportTypeButtonText,
                  selectedReport === report.id && styles.reportTypeButtonTextActive,
                ]}
              >
                {report.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Date Range Selector */}
        <View style={styles.dateRangeContainer}>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => {
              // TODO: Implement date picker
              Alert.alert('Information', 'Sélecteur de date à implémenter');
            }}
          >
            <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
            <Text style={styles.dateButtonText}>
              {startDate.toLocaleDateString('fr-FR')} - {endDate.toLocaleDateString('fr-FR')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Report Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Chargement des rapports...</Text>
          </View>
        ) : (
          <View style={styles.reportContent}>
            {renderReportContent()}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  exportButton: {
    padding: SPACING.xs,
  },
  content: {
    flex: 1,
  },
  reportTypesContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  reportTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  reportTypeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  reportTypeButtonText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  reportTypeButtonTextActive: {
    color: COLORS.white,
  },
  dateRangeContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  dateButtonText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
  },
  reportContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  reportItem: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reportItemCritical: {
    borderColor: COLORS.danger,
    backgroundColor: `${COLORS.danger}10`,
  },
  reportItemWarning: {
    borderColor: COLORS.warning,
    backgroundColor: `${COLORS.warning}10`,
  },
  reportItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  reportItemTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  reportItemValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.primary,
  },
  reportItemDetails: {
    gap: SPACING.xs,
  },
  reportItemDetail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: SPACING.xxl,
  },
});
