/**
 * PosOrderTicket.tsx
 * Composant partagé : Bon de commande cuisine (Restaurant)
 * Génère le HTML du bon de commande pour impression
 * Utilisé par : RestaurantCaisseScreen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Print from 'expo-print';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../config/theme';
import { type PosCartItem } from './PosMenuGrid';

type Props = {
  visible: boolean;
  tableLabel: string | number;
  items: PosCartItem[];
  storeName?: string;
  notes?: string;
  onClose: () => void;
};

const generateTicketHtml = (
  tableLabel: string | number,
  items: PosCartItem[],
  storeName: string,
  notes?: string
) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bon de commande</title>
  <style>
    body {
      font-family: 'Courier New', monospace;
      margin: 0 auto;
      padding: 15px;
      width: 300px;
      color: #000;
      font-size: 14px;
      line-height: 1.5;
      background: white;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .dashed { border-top: 1px dashed #000; margin: 10px 0; }
    .store-name { font-size: 18px; font-weight: bold; text-transform: uppercase; }
    .table-label {
      font-size: 28px;
      font-weight: bold;
      text-align: center;
      border: 3px solid #000;
      padding: 10px;
      margin: 12px 0;
      letter-spacing: 2px;
    }
    .item { margin: 8px 0; }
    .item-qty { font-weight: bold; font-size: 16px; }
    .item-name { font-size: 14px; text-transform: uppercase; }
    .item-notes { font-size: 11px; font-style: italic; padding-left: 20px; }
    .time { font-size: 12px; color: #333; }
  </style>
</head>
<body>
  <div class="center">
    <div class="store-name">${storeName}</div>
    <div class="time">Bon émis à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
  </div>
  
  <div class="table-label">TABLE ${tableLabel}</div>
  
  <div class="dashed"></div>
  
  ${items.map(item => `
    <div class="item">
      <span class="item-qty">${item.quantity}x</span>
      <span class="item-name"> ${item.name.toUpperCase()}</span>
      ${item.notes ? `<div class="item-notes">→ ${item.notes}</div>` : ''}
    </div>
  `).join('')}
  
  <div class="dashed"></div>
  
  ${notes ? `<div class="item-notes bold">Note : ${notes}</div>` : ''}
  
  <div class="center" style="margin-top: 15px; font-size: 11px;">
    LibreShop Restaurant
  </div>
</body>
</html>
`;

export const PosOrderTicket = ({
  visible,
  tableLabel,
  items,
  storeName = 'Restaurant',
  notes,
  onClose,
}: Props) => {
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const html = generateTicketHtml(tableLabel, items, storeName, notes);
      if (Platform.OS === 'web') {
        const win = window.open('', '_blank');
        if (win) {
          win.document.open();
          win.document.write(html);
          win.document.close();
          setTimeout(() => {
            try { win.focus(); win.print(); setTimeout(() => { try { win.close(); } catch {} }, 800); } catch {}
          }, 500);
        }
      } else {
        await Print.printAsync({ html });
      }
    } catch (e) {
      console.warn('Erreur impression bon cuisine:', e);
    } finally {
      setPrinting(false);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <BlurView intensity={90} tint="dark" style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Ionicons name="restaurant" size={32} color={COLORS.warning} />
            <Text style={styles.title}>Bon de commande cuisine</Text>
          </View>

          <View style={[styles.tableBox, { borderColor: COLORS.warning }]}>
            <Text style={styles.tableBoxLabel}>TABLE</Text>
            <Text style={styles.tableBoxNumber}>{tableLabel}</Text>
          </View>

          <View style={styles.itemsList}>
            {items.map(item => (
              <View key={item.id} style={styles.item}>
                <Text style={styles.itemQty}>{item.quantity}×</Text>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name.toUpperCase()}</Text>
                  {item.notes ? (
                    <Text style={styles.itemNotes}>→ {item.notes}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.printBtn, { backgroundColor: COLORS.warning }]}
            onPress={handlePrint}
            disabled={printing}
          >
            {printing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="print-outline" size={20} color="#fff" />
                <Text style={styles.printBtnText}>Envoyer en cuisine</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Modal>
  );
};

export { generateTicketHtml };

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  container: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.xxl,
    padding: SPACING.xxl,
    width: '100%',
    maxWidth: 400,
    gap: SPACING.lg,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  title: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  tableBox: {
    borderWidth: 3,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxxl,
    alignItems: 'center',
  },
  tableBoxLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    letterSpacing: 2,
  },
  tableBoxNumber: {
    color: COLORS.text,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 2,
  },
  itemsList: {
    width: '100%',
    gap: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  itemQty: {
    color: COLORS.warning,
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    minWidth: 32,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  itemNotes: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontStyle: 'italic',
    marginTop: 2,
  },
  printBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  printBtnText: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  cancelBtn: {
    padding: SPACING.sm,
  },
  cancelText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
  },
});
