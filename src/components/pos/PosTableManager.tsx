/**
 * PosTableManager.tsx
 * Composant partagé : Gestionnaire de tables pour Restaurant et Bar
 * Utilisé par : RestaurantCaisseScreen, BarCaisseScreen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Modal,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { qrCodeService } from '../../services/qrCodeService';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../config/theme';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export type TableStatus = 'free' | 'occupied' | 'reserved' | 'bill_requested';

export type PosTable = {
  id: string;
  number: number | string;
  capacity: number;
  status: TableStatus;
  /** Token opaque pour le QR onsite */
  qr_token: string;
  /** Nombre de personnes actuellement à la table */
  guestCount?: number;
  /** Montant en cours sur cette table */
  currentAmount?: number;
  /** Heure d'ouverture de la table */
  openedAt?: Date;
};

type Props = {
  tables: PosTable[];
  selectedTableId?: string | null;
  onSelectTable: (table: PosTable) => void;
  onAddTable?: () => void;
  accentColor?: string;
  /** Label du type d'interface */
  interfaceLabel?: 'Restaurant' | 'Bar' | string;
  storeSlug?: string;
  storeName?: string;
};

const STATUS_CONFIG: Record<TableStatus, { label: string; color: string; icon: any }> = {
  free: { label: 'Libre', color: '#22c55e', icon: 'checkmark-circle' },
  occupied: { label: 'Occupée', color: '#f59e0b', icon: 'people' },
  reserved: { label: 'Réservée', color: '#6366f1', icon: 'time' },
  bill_requested: { label: 'Addition', color: '#ef4444', icon: 'receipt' },
};

const formatDuration = (openedAt?: Date | string) => {
  if (!openedAt) return '';
  const dateObj = new Date(openedAt);
  const mins = Math.floor((Date.now() - dateObj.getTime()) / 60000);
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? m + 'min' : ''}`;
};

// ── Palettes de thèmes dynamiques par table ──────────────────────────────────
const TABLE_THEMES = [
  { primary: '#f97316', secondary: '#fed7aa', accent: '#ea580c', emoji: '🍽️', decor: 'orange' },
  { primary: '#8b5cf6', secondary: '#ddd6fe', accent: '#7c3aed', emoji: '✨', decor: 'purple' },
  { primary: '#06b6d4', secondary: '#cffafe', accent: '#0891b2', emoji: '🌊', decor: 'cyan'  },
  { primary: '#10b981', secondary: '#d1fae5', accent: '#059669', emoji: '🌿', decor: 'green' },
  { primary: '#ef4444', secondary: '#fee2e2', accent: '#dc2626', emoji: '🌹', decor: 'red'  },
  { primary: '#f59e0b', secondary: '#fef3c7', accent: '#d97706', emoji: '⭐', decor: 'amber' },
  { primary: '#3b82f6', secondary: '#dbeafe', accent: '#2563eb', emoji: '🔵', decor: 'blue'  },
  { primary: '#ec4899', secondary: '#fce7f3', accent: '#db2777', emoji: '💖', decor: 'pink'  },
];

const getTableTheme = (tableNumber: number | string) => {
  const str = String(tableNumber);
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) % TABLE_THEMES.length;
  return TABLE_THEMES[Math.abs(hash) % TABLE_THEMES.length];
};

// ── Génération HTML décoratif pour impression QR ─────────────────────────────
const generateTableQrHtml = ({
  tableNumber, storeName, capacity, qrUrl,
}: {
  tableNumber: number | string;
  storeName: string;
  capacity: number;
  qrUrl: string;
}): string => {
  const t = getTableTheme(tableNumber);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>QR Table ${tableNumber}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
body{font-family:'Outfit',sans-serif;background:#f0f4f8;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;}
.card{width:360px;background:white;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.15);}
.header{background:linear-gradient(135deg,${t.primary},${t.accent});padding:30px 20px 20px;text-align:center;position:relative;}
.dots{position:absolute;top:0;left:0;right:0;bottom:0;background-image:radial-gradient(circle,rgba(255,255,255,.15) 2px,transparent 2px);background-size:20px 20px;}
.store{color:rgba(255,255,255,.85);font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;position:relative;}
.emoji{font-size:52px;display:block;margin:10px 0 6px;line-height:1;position:relative;}
.label{color:rgba(255,255,255,.8);font-size:13px;font-weight:600;letter-spacing:4px;text-transform:uppercase;position:relative;}
.num{color:white;font-size:88px;font-weight:900;line-height:1;text-shadow:0 4px 20px rgba(0,0,0,.25);position:relative;}
.body{padding:24px 20px;}
.qr-wrap{background:white;border:3px solid ${t.secondary};border-radius:18px;padding:14px;display:inline-block;box-shadow:0 4px 16px rgba(0,0,0,.08);}
.qr-wrap img{width:210px;height:210px;display:block;}
.title{margin-top:20px;color:${t.primary};font-size:17px;font-weight:800;}
.sub{margin-top:6px;color:#64748b;font-size:12px;line-height:1.5;}
.steps{margin:16px 0;display:flex;flex-direction:column;gap:8px;text-align:left;}
.step{display:flex;align-items:center;gap:10px;background:${t.secondary};border-radius:12px;padding:9px 12px;}
.sn{width:26px;height:26px;background:${t.primary};color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;flex-shrink:0;}
.st{color:#374151;font-size:12px;font-weight:600;}
.footer{background:${t.secondary};padding:14px 20px;text-align:center;border-top:2px dashed ${t.primary}40;}
.cap{display:inline-flex;align-items:center;gap:6px;background:white;border:2px solid ${t.primary}50;border-radius:20px;padding:5px 14px;color:${t.primary};font-weight:700;font-size:12px;}
.note{margin-top:8px;color:#94a3b8;font-size:10px;}
@media print{body{background:white;padding:0;}.card{box-shadow:none;}}
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="dots"></div>
    <div class="store">${storeName}</div>
    <span class="emoji">${t.emoji}</span>
    <div class="label">Table</div>
    <div class="num">${tableNumber}</div>
  </div>
  <div class="body" style="text-align:center;">
    <div class="qr-wrap"><img src="${qrUrl}" alt="QR Table ${tableNumber}"/></div>
    <div class="title">📱 Commandez depuis votre place</div>
    <div class="sub">Scannez le QR code avec la caméra de votre smartphone</div>
    <div class="steps">
      <div class="step"><div class="sn">1</div><div class="st">Scannez le code avec votre caméra</div></div>
      <div class="step"><div class="sn">2</div><div class="st">Parcourez le menu et ajoutez vos choix</div></div>
      <div class="step"><div class="sn">3</div><div class="st">Envoyez — un serveur s'occupe du reste</div></div>
    </div>
  </div>
  <div class="footer">
    <div class="cap">👥 Capacité : ${capacity} personne${capacity > 1 ? 's' : ''}</div>
    <div class="note">Aucune application requise — fonctionne sur tous les smartphones</div>
  </div>
</div>
</body>
</html>`;
};



export const PosTableManager = ({
  tables,
  selectedTableId,
  onSelectTable,
  onAddTable,
  accentColor = COLORS.info,
  interfaceLabel = 'Restaurant',
  storeSlug,
  storeName = '',
}: Props) => {
  const [qrTable, setQrTable] = React.useState<PosTable | null>(null);
  const [isPrinting, setIsPrinting] = React.useState(false);

  const freeTables = tables.filter(t => t.status === 'free').length;
  const occupiedTables = tables.filter(t => t.status === 'occupied').length;
  const billTables = tables.filter(t => t.status === 'bill_requested').length;

  const renderTable = ({ item }: { item: PosTable }) => {
    const config = STATUS_CONFIG[item.status];
    const isSelected = item.id === selectedTableId;
    const isOccupied = item.status !== 'free';

    return (
      <TouchableOpacity
        style={[
          styles.tableCard,
          isSelected && { borderColor: accentColor, borderWidth: 2.5 },
          item.status === 'bill_requested' && styles.billRequestedCard,
        ]}
        onPress={() => onSelectTable(item)}
        activeOpacity={0.8}
      >
        {/* Statut badge */}
        <View style={styles.tableHeaderRow}>
          <View style={[styles.statusBadge, { backgroundColor: config.color + '20' }]}>
            <Ionicons name={config.icon} size={14} color={config.color} />
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
          {storeSlug && (
            <TouchableOpacity 
              style={styles.qrButton}
              onPress={(e) => {
                e.stopPropagation();
                setQrTable(item);
              }}
            >
              <Ionicons name="qr-code-outline" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Numéro de table */}
        <View style={[
          styles.tableNumber,
          { backgroundColor: isSelected ? accentColor : isOccupied ? config.color + '20' : COLORS.card }
        ]}>
          <Text style={[
            styles.tableNumberText,
            { color: isSelected ? '#fff' : isOccupied ? config.color : COLORS.textMuted }
          ]}>
            {item.number}
          </Text>
        </View>

        {/* Capacité */}
        <View style={styles.tableCapacity}>
          <Ionicons name="people-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.tableCapacityText}>
            {item.guestCount ? `${item.guestCount}/` : ''}{item.capacity}
          </Text>
        </View>

        {/* Durée + montant si occupée */}
        {isOccupied && (
          <View style={styles.tableExtra}>
            {item.openedAt && (
              <Text style={styles.tableDuration}>{formatDuration(item.openedAt)}</Text>
            )}
            {item.currentAmount != null && item.currentAmount > 0 && (
              <Text style={[styles.tableAmount, { color: accentColor }]}>
                {item.currentAmount.toLocaleString('fr-FR')} F
              </Text>
            )}
          </View>
        )}

        {/* Indicateur sélectionné */}
        {isSelected && (
          <View style={[styles.selectedIndicator, { backgroundColor: accentColor }]}>
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* En-tête stats */}
      <View style={styles.statsBar}>
        <View style={styles.statChip}>
          <View style={[styles.statDot, { backgroundColor: '#22c55e' }]} />
          <Text style={styles.statText}>{freeTables} libre{freeTables > 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.statChip}>
          <View style={[styles.statDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={styles.statText}>{occupiedTables} occupée{occupiedTables > 1 ? 's' : ''}</Text>
        </View>
        {billTables > 0 && (
          <View style={styles.statChip}>
            <View style={[styles.statDot, { backgroundColor: '#ef4444' }]} />
            <Text style={[styles.statText, { color: '#ef4444' }]}>{billTables} addition{billTables > 1 ? 's' : ''}</Text>
          </View>
        )}
        {onAddTable && (
          <TouchableOpacity
            style={[styles.addTableBtn, { borderColor: accentColor }]}
            onPress={onAddTable}
          >
            <Ionicons name="add" size={16} color={accentColor} />
            <Text style={[styles.addTableText, { color: accentColor }]}>Table</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Légende */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legend}>
        {(Object.entries(STATUS_CONFIG) as [TableStatus, typeof STATUS_CONFIG[TableStatus]][]).map(([key, cfg]) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: cfg.color }]} />
            <Text style={styles.legendText}>{cfg.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Grille de tables */}
      {tables.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="grid-outline" size={48} color="#94a3b8" />
          <Text style={styles.emptyTitle}>Aucune table configurée</Text>
          <Text style={styles.emptySubtitle}>
            Ajoutez vos tables pour commencer à prendre des commandes
          </Text>
          {onAddTable && (
            <TouchableOpacity
              style={[styles.emptyAddBtn, { backgroundColor: accentColor }]}
              onPress={onAddTable}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.emptyAddBtnText}>Ajouter une table</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={tables}
          renderItem={renderTable}
          keyExtractor={item => item.id}
          numColumns={3}
          key="tables-grid"
          columnWrapperStyle={styles.tableRow}
          contentContainerStyle={styles.tableGrid}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modale QR Code */}
      <Modal
        visible={!!qrTable}
        transparent
        animationType="fade"
        onRequestClose={() => setQrTable(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header coloré selon le thème de la table */}
            {qrTable && (() => {
              const theme = getTableTheme(qrTable.number);
              return (
                <View style={[styles.modalQrHeader, { backgroundColor: theme.primary }]}>
                  <Text style={styles.modalQrEmoji}>{theme.emoji}</Text>
                  <Text style={styles.modalQrTableLabel}>Table {qrTable.number}</Text>
                  <TouchableOpacity onPress={() => setQrTable(null)} style={styles.modalCloseBtn}>
                    <Ionicons name="close" size={22} color="rgba(255,255,255,0.9)" />
                  </TouchableOpacity>
                </View>
              );
            })()}
            <View style={styles.qrContainer}>
              {qrTable && storeSlug ? (
                <>
                  <Image
                    source={{ uri: qrCodeService.getQrImageUrl(qrCodeService.getOnsiteUrl(qrTable.qr_token), 280) }}
                    style={{ width: 220, height: 220 }}
                    resizeMode="contain"
                  />
                  <Text style={styles.qrInstruction}>
                    Scannez ce code pour commander depuis la table {qrTable.number}.
                  </Text>
                </>
              ) : null}
            </View>
            {/* Boutons */}
            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
              <TouchableOpacity
                style={[styles.modalActionBtn, { flex: 1, backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.border }]}
                onPress={() => setQrTable(null)}
              >
                <Text style={[styles.modalActionText, { color: COLORS.textMuted }]}>Fermer</Text>
              </TouchableOpacity>
              {qrTable && storeSlug && (
                <TouchableOpacity
                  style={[styles.modalActionBtn, { flex: 2, backgroundColor: accentColor, flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center' }]}
                  disabled={isPrinting}
                  onPress={async () => {
                    if (!qrTable || !storeSlug) return;
                    setIsPrinting(true);
                    try {
                      const qrUrl = qrCodeService.getQrImageUrl(
                        qrCodeService.getOnsiteUrl(qrTable.qr_token), 280
                      );
                      const html = generateTableQrHtml({
                        tableNumber: qrTable.number,
                        storeName: storeName || 'Mon Restaurant',
                        capacity: qrTable.capacity,
                        qrUrl,
                      });
                      if (Platform.OS === 'web') {
                        const blob = new Blob([html], { type: 'text/html' });
                        const url = URL.createObjectURL(blob);
                        const win = window.open(url, '_blank');
                        if (win) { win.onload = () => win.print(); }
                      } else {
                        const { uri } = await Print.printToFileAsync({ html, width: 400, height: 750 });
                        const canShare = await Sharing.isAvailableAsync();
                        if (canShare) {
                          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf' });
                        } else {
                          await Print.printAsync({ html });
                        }
                      }
                    } catch {
                      Alert.alert('Erreur', "Impossible d'imprimer le QR code.");
                    } finally {
                      setIsPrinting(false);
                    }
                  }}
                >
                  {isPrinting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="print-outline" size={17} color="#fff" />
                  }
                  <Text style={styles.modalActionText}>
                    {isPrinting ? 'Préparation...' : 'Imprimer / Partager'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  addTableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    marginLeft: 'auto' as any,
  },
  addTableText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  legend: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginRight: SPACING.lg,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  tableGrid: {
    padding: SPACING.md,
    paddingBottom: 80,
  },
  tableRow: {
    justifyContent: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tableCard: {
    width: '31%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    position: 'relative',
    minHeight: 110,
  },
  billRequestedCard: {
    borderColor: '#ef4444',
    borderWidth: 1.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.xs,
    alignSelf: 'center',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
  },
  tableNumber: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.xs,
  },
  tableNumberText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
  },
  tableCapacity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  tableCapacityText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  tableExtra: {
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  tableDuration: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  tableAmount: {
    fontSize: 11,
    fontWeight: '700',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: SPACING.xs,
  },
  qrButton: {
    padding: 4,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 360,
  },
  modalQrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  modalQrEmoji: {
    fontSize: 26,
  },
  modalQrTableLabel: {
    flex: 1,
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: '#fff',
  },
  modalCloseBtn: {
    padding: SPACING.xs,
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    backgroundColor: '#fff',
    marginBottom: SPACING.md,
  },
  qrInstruction: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  modalActionBtn: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    margin: SPACING.md,
    marginTop: 0,
  },
  modalActionText: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxxl,
    gap: SPACING.md,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  emptyAddBtnText: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
});
