import { Platform, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { ADMIN_CONFIG } from '../config/admin';

type ContactParams = {
  rawPhone?: string | null;
  message?: string;
  fallback?: 'tel' | 'copy' | 'tel-or-copy';
};

const normalizePhone = (raw?: string | null) => {
  if (!raw) return null;
  let cleaned = String(raw).trim().replace(/[^0-9+]/g, '');

  // Remove leading + if present
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);

  // If number starts with 0 (local format), remove leading zeros
  // and try to prefix default admin country code (best-effort)
  if (/^0+/.test(cleaned)) {
    cleaned = cleaned.replace(/^0+/, '');
    try {
      const admin = String(ADMIN_CONFIG.WHATSAPP_NUMBER || '');
      // take first 2-3 digits of admin number as probable country code
      const probableCode = admin.length >= 3 ? admin.slice(0, 3) : admin;
      if (probableCode && !cleaned.startsWith(probableCode)) {
        cleaned = probableCode + cleaned;
      }
    } catch {
      // ignore and keep cleaned as-is
    }
  }

  return cleaned || null;
};

export const buildWhatsAppUrls = (rawPhone?: string | null, message?: string) => {
  const digits = normalizePhone(rawPhone);
  if (!digits) return [] as string[];
  const text = message ? `&text=${encodeURIComponent(message)}` : '';
  // Try official web API and wa.me short link
  const urls = [
    `https://api.whatsapp.com/send?phone=${digits}${text}`,
    `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`,
  ];
  return urls;
};

const openUrl = async (url: string) => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
      return true;
    }
    const supported = await Linking.canOpenURL(url);
    if (!supported) return false;
    await Linking.openURL(url);
    return true;
  } catch (e) {
    return false;
  }
};

export const contactStore = async ({ rawPhone, message, fallback = 'tel-or-copy' }: ContactParams) => {
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    Alert.alert('Numéro introuvable', 'Cette boutique n\'a pas de numéro de contact renseigné.');
    return;
  }

  // Try multiple WhatsApp URL formats
  const waUrls = buildWhatsAppUrls(phone, message);
  for (const url of waUrls) {
    try {
      const opened = await openUrl(url);
      if (opened) return;
    } catch (e) {
      // try next
    }
  }

  // Fallbacks
  if (fallback === 'tel' || fallback === 'tel-or-copy') {
    const telUrl = `tel:${phone}`;
    const telOpened = await openUrl(telUrl);
    if (telOpened) return;
  }

  if (fallback === 'copy' || fallback === 'tel-or-copy') {
    // Try to use navigator.clipboard on web, otherwise show alert with number
    if (typeof navigator !== 'undefined' && (navigator as any).clipboard && (navigator as any).clipboard.writeText) {
      try {
        await (navigator as any).clipboard.writeText(phone);
        Alert.alert('Numéro copié', "Le numéro du vendeur a été copié dans le presse-papiers.");
        return;
      } catch (e) {
        // ignore
      }
    }

    // Native fallback: show the number so the user can copy
    Alert.alert('Contact', `Numéro: ${phone}`);
  }
};

export const copyToClipboard = async (text: string, successMessage = 'Copié dans le presse-papiers') => {
  if (!text) {
    Alert.alert('Rien à copier', 'Aucun texte fourni');
    return false;
  }

  if (typeof navigator !== 'undefined' && (navigator as any).clipboard && (navigator as any).clipboard.writeText) {
    try {
      await (navigator as any).clipboard.writeText(text);
      Alert.alert('Succès', successMessage);
      return true;
    } catch (e) {
      // ignore and fallback
    }
  }

  // Native fallback: show alert with text for manual copy
  Alert.alert('Copier', text);
  return false;
};

export const buildWhatsAppUrl = (rawPhone?: string | null, message?: string) => {
  const urls = buildWhatsAppUrls(rawPhone, message);
  return urls.length > 0 ? urls[0] : null;
};

export default {
  buildWhatsAppUrl,
  contactStore,
  copyToClipboard,
};
