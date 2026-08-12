/**
 * PosReceiptModal.tsx
 * Composant partagé : Modal de reçu + partage pour les interfaces POS
 * Contient la logique corrigée de partage (fix image blanche)
 * Utilisé par : SellerCaisseScreen, RestaurantCaisseScreen, BarCaisseScreen
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
import * as Sharing from 'expo-sharing';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../config/theme';

type OrderShareInfo = {
  id: string;
  total: string;
  url: string;
  storeName: string;
};

type Props = {
  visible: boolean;
  receiptHtml: string;
  orderInfo: OrderShareInfo | null;
  customerPhone?: string;
  accentColor?: string;
  onClose: () => void;
  onNewSale?: () => void;
};

export const PosReceiptModal = ({
  visible,
  receiptHtml,
  orderInfo,
  customerPhone = '',
  accentColor = COLORS.info,
  onClose,
  onNewSale,
}: Props) => {
  const [sharingLoading, setSharingLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);

  const handleShare = async () => {
    setSharingLoading(true);
    try {
      if (Platform.OS === 'web') {
        // Conteneur visible mais invisible (opacity 0) — garantit le rendu complet du DOM
        const wrapper = document.createElement('div');
        wrapper.style.position = 'fixed';
        wrapper.style.left = '0px';
        wrapper.style.top = '0px';
        wrapper.style.width = '340px';
        wrapper.style.backgroundColor = '#ffffff';
        wrapper.style.padding = '0px';
        wrapper.style.zIndex = '-1';
        wrapper.style.opacity = '0';
        wrapper.style.pointerEvents = 'none';

        // Supprimer l'import Google Fonts (bloque le rendu hors-ligne)
        const cleanHtml = receiptHtml.replace(/@import url\(.*?google.*?\);/g, '');
        wrapper.innerHTML = cleanHtml;
        document.body.appendChild(wrapper);

        // Attendre que toutes les images soient chargées (QR code, etc.)
        const waitForImages = (el: HTMLElement): Promise<void> => {
          const imgs = Array.from(el.querySelectorAll('img'));
          if (imgs.length === 0) return Promise.resolve();
          return Promise.all(
            imgs.map(img => {
              if (img.complete) return Promise.resolve();
              return new Promise<void>(resolve => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              });
            })
          ).then(() => {});
        };

        await waitForImages(wrapper);

        // Attendre 2 frames pour garantir le reflow complet
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        try {
          const htmlToImage = await import('html-to-image');
          const blob = await htmlToImage.toBlob(wrapper, {
            backgroundColor: '#ffffff',
            pixelRatio: 2,
            skipFonts: false,
            cacheBust: true,
          });

          if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
          if (!blob) throw new Error('Échec génération image');

          const filename = `Ticket_${orderInfo?.id.slice(0, 8).toUpperCase() || 'LibreShop'}.png`;
          const file = new File([blob], filename, { type: 'image/png' });

          // Partage natif Web Share API (mobile web)
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Ticket - ${orderInfo?.storeName || 'LibreShop'}`,
              text: `Reçu #${orderInfo?.id.slice(0, 8).toUpperCase()} - ${orderInfo?.total || ''}`,
            });
            return;
          }

          // Desktop : copier dans presse-papier + télécharger
          let copiedToClipboard = false;
          if (navigator.clipboard && (window as any).ClipboardItem) {
            try {
              await navigator.clipboard.write([
                new (window as any).ClipboardItem({ 'image/png': blob }),
              ]);
              copiedToClipboard = true;
            } catch {}
          }

          const dataUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = filename;
          link.click();
          setTimeout(() => URL.revokeObjectURL(dataUrl), 5000);

          // Ouvrir WhatsApp
          let formattedPhone = customerPhone.replace(/\D/g, '');
          if (formattedPhone && !formattedPhone.startsWith('225') && formattedPhone.length === 10) {
            formattedPhone = '225' + formattedPhone;
          }

          const message = copiedToClipboard
            ? `Bonjour ! Voici votre reçu (${orderInfo?.total || ''}). 🖼️ L'image a été copiée dans le presse-papier ! Collez-la (Ctrl+V) ici.`
            : `Bonjour ! Voici votre reçu (${orderInfo?.total || ''}). 🖼️ L'image a été téléchargée sur votre appareil.`;

          const waUrl = formattedPhone
            ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`
            : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

          window.open(waUrl, '_blank');

          window.alert(
            copiedToClipboard
              ? `🖼️ Image copiée et téléchargée ! Collez-la sur WhatsApp.`
              : `🖼️ Image téléchargée ! Ajoutez-la sur WhatsApp.`
          );
        } catch (err) {
          console.warn('Erreur partage image:', err);
          if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
        }
      } else {
        // Mobile natif : PDF via expo-print + partage
        const { uri } = await Print.printToFileAsync({ html: receiptHtml });
        await Sharing.shareAsync(uri);
      }
    } catch (e) {
      console.warn('Erreur partage reçu:', e);
    } finally {
      setSharingLoading(false);
    }
  };

  const handlePrint = async () => {
    setPrintLoading(true);
    try {
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(receiptHtml);
          printWindow.document.close();
          setTimeout(() => {
            try {
              printWindow.focus();
              printWindow.print();
              setTimeout(() => { try { printWindow.close(); } catch {} }, 1000);
            } catch {}
          }, 600);
        }
      } else {
        await Print.printAsync({ html: receiptHtml });
      }
    } catch (e) {
      console.warn('Erreur impression:', e);
    } finally {
      setPrintLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <BlurView intensity={90} tint="dark" style={styles.overlay}>
        <View style={styles.container}>
          {/* Icône succès */}
          <View style={[styles.successIcon, { backgroundColor: COLORS.success + '20' }]}>
            <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
          </View>

          <Text style={styles.title}>Vente validée !</Text>
          <Text style={styles.subtitle}>
            Le ticket de caisse a été généré.{'\n'}Que souhaitez-vous faire ?
          </Text>

          {orderInfo && (
            <View style={[styles.orderInfo, { borderColor: accentColor + '30' }]}>
              <Text style={styles.orderInfoLabel}>Ticket N°</Text>
              <Text style={[styles.orderInfoValue, { color: accentColor }]}>
                {orderInfo.id.slice(0, 8).toUpperCase()}
              </Text>
              <Text style={styles.orderInfoTotal}>{orderInfo.total}</Text>
            </View>
          )}

          {/* Bouton Partager */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: accentColor }]}
            onPress={handleShare}
            disabled={sharingLoading}
          >
            {sharingLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="share-outline" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>Envoyer / Partager</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Bouton Imprimer */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.accent }]}
            onPress={handlePrint}
            disabled={printLoading}
          >
            {printLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="print-outline" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>Imprimer</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Bouton Nouvelle vente */}
          {onNewSale && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.success }]}
              onPress={() => { onClose(); onNewSale(); }}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Nouvelle vente</Text>
            </TouchableOpacity>
          )}

          {/* Fermer */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Modal>
  );
};

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
    alignItems: 'center',
    gap: SPACING.md,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  orderInfo: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  orderInfoLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
  },
  orderInfoValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    letterSpacing: 1,
  },
  orderInfoTotal: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
  },
  actionBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    minHeight: 50,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  closeBtn: {
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  closeText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
});
