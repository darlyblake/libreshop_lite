import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
  ActivityIndicator,
  TextInput,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { captureRef } from 'react-native-view-shot';
import { useTheme } from '../hooks/useTheme';
import { useStoreStore } from '../store';
import { productService } from '../services/productService';
import { collectionService } from '../services/collectionService';
import { qrCodeService } from '../services/qrCodeService';
import { networkService } from '../services/networkService';
import { offlineSyncManager } from '../services/offlineSyncManager';
import { Toast } from '../components/Toast';

// Thèmes de couleurs professionnels & calibrés
const COLOR_THEMES = [
  { id: 'violet', name: 'Royal Violet', colors: ['#6366f1', '#4338ca'] as const, accent: '#a5b4fc', text: '#ffffff' },
  { id: 'rose', name: 'Néon Sunset', colors: ['#f43f5e', '#be123c'] as const, accent: '#fecdd3', text: '#ffffff' },
  { id: 'amber', name: 'Gold Prestige', colors: ['#d97706', '#78350f'] as const, accent: '#fde68a', text: '#ffffff' },
  { id: 'emerald', name: 'Emerald Pro', colors: ['#059669', '#064e3b'] as const, accent: '#a7f3d0', text: '#ffffff' },
  { id: 'sky', name: 'Ocean Cyan', colors: ['#0284c7', '#0c4a6e'] as const, accent: '#bae6fd', text: '#ffffff' },
  { id: 'dark', name: 'Midnight Cyber', colors: ['#1e293b', '#0f172a'] as const, accent: '#fbbf24', text: '#ffffff' },
  { id: 'gabon', name: 'Gabon Green', colors: ['#009e60', '#3a75c4'] as const, accent: '#fcd116', text: '#ffffff' },
];

// Formats disponibles
const FORMATS = [
  { id: 'story', name: 'Story 9:16', ratio: '9:16', icon: 'logo-instagram', subtitle: 'Instagram & WhatsApp Status' },
  { id: 'poster', name: 'Affiche Carrée', ratio: '1:1', icon: 'logo-whatsapp', subtitle: 'Posts WhatsApp & Feed' },
  { id: 'store_poster', name: 'Affiche Boutique', ratio: '1:1', icon: 'megaphone-outline', subtitle: 'Présentation de boutique' },
  { id: 'qr', name: 'Flyer QR Code', ratio: '1:1', icon: 'qr-code-outline', subtitle: 'Impression & Affichage' },
  { id: 'pdf', name: 'Catalogue PDF', ratio: 'A4', icon: 'document-text-outline', subtitle: 'Export catalogue complet' },
];

export const SellerMarketingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 900;
  const { getColor: COLORS } = useTheme();
  const store = useStoreStore((s) => s.store);

  // Données
  const [products, setProducts] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');
  const [isGenerating, setIsGenerating] = useState(false);

  // Recherche & Filtres Produit
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState<string | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);

  // Navigation par Onglets Principaux (Studio, Textes, Événements)
  const [activeMainTab, setActiveMainTab] = useState<'studio' | 'texts' | 'events'>('studio');

  // Sélections pour le Studio Visuel
  const [selectedFormatId, setSelectedFormatId] = useState<string>('poster');
  const [selectedProductIdx, setSelectedProductIdx] = useState(0);
  const [selectedThemeIdx, setSelectedThemeIdx] = useState(0);

  // Personnalisation dynamique des visuels
  const [customTitle, setCustomTitle] = useState('FÊTE DE L\'INDÉPENDANCE 🇬🇦');
  const [customBadge, setCustomBadge] = useState('VIVE LE GABON');
  const [customSubtitle, setCustomSubtitle] = useState('Offres exclusives à l\'occasion de la fête nationale');
  const [customCta, setCustomCta] = useState('COMMANDER SUR LIBRESHOP');
  const [customPrice, setCustomPrice] = useState('');

  // Caractéristiques du produit (Points clés / Spécifications)
  const [feature1, setFeature1] = useState('Produit Neuf');
  const [feature2, setFeature2] = useState('En stock immédiat');
  const [feature3, setFeature3] = useState('Garantie Qualité');

  // Rédacteur de textes réseaux sociaux
  const [selectedSocialTextIdx, setSelectedSocialTextIdx] = useState(0);
  const [editableTextContent, setEditableTextContent] = useState('');

  // Refs de capture d'images haute résolution
  const storyRef = useRef<View>(null);
  const posterRef = useRef<View>(null);
  const qrRef = useRef<View>(null);
  const storePosterRef = useRef<View>(null);

  const [isOnline, setIsOnline] = useState<boolean>(networkService.isOnline());

  useEffect(() => {
    const unsub = networkService.subscribe(setIsOnline);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (store?.id) {
      if (networkService.isOnline()) {
        productService.getByStoreAll(store.id).then(res => {
          setProducts(res || []);
          offlineSyncManager.saveOfflineProducts(store.id, res || []).catch(console.error);
        }).catch(async () => {
          const cached = await offlineSyncManager.getOfflineProducts(store.id);
          if (cached) setProducts(cached);
        });

        collectionService.getByStore(store.id).then(res => {
          setCollections(res || []);
          offlineSyncManager.saveOfflineCollections(store.id, res || []).catch(console.error);
        }).catch(async () => {
          const cachedCols = await offlineSyncManager.getOfflineCollections(store.id);
          if (cachedCols) setCollections(cachedCols);
        });
      } else {
        offlineSyncManager.getOfflineProducts(store.id).then(setProducts).catch(console.error);
        offlineSyncManager.getOfflineCollections(store.id).then(setCollections).catch(console.error);
      }
    }
  }, [store?.id, isOnline]);

  const currentProduct = products[selectedProductIdx] || null;

  // Extraire et pré-remplir les caractéristiques réelles du produit quand le produit change
  useEffect(() => {
    if (currentProduct) {
      let f1 = '';
      let f2 = '';
      let f3 = '';

      if (currentProduct.condition) {
        f1 = `État: ${currentProduct.condition}`;
      } else if (currentProduct.category) {
        f1 = `Catégorie: ${currentProduct.category}`;
      } else {
        f1 = 'Produit de qualité';
      }

      if (typeof currentProduct.stock === 'number' && currentProduct.stock > 0) {
        f2 = `En Stock (${currentProduct.stock} dispo)`;
      } else {
        f2 = 'Livraison rapide';
      }

      if (currentProduct.attributes && typeof currentProduct.attributes === 'object') {
        const keys = Object.keys(currentProduct.attributes);
        if (keys.length > 0) {
          f3 = `${keys[0]}: ${currentProduct.attributes[keys[0]]}`;
        }
      } else if (currentProduct.description && typeof currentProduct.description === 'string') {
        const cleanDesc = currentProduct.description.trim();
        if (cleanDesc.length > 0) {
          f3 = cleanDesc.slice(0, 28);
        }
      } else {
        f3 = 'Garantie LibreShop';
      }

      setFeature1(f1);
      setFeature2(f2);
      setFeature3(f3);
    }
  }, [selectedProductIdx, currentProduct]);

  const socialTemplates = [
    {
      title: '🎉 Lancement Promotion',
      badge: 'PROMO SPÉCIALE',
      template: '🎉 Promo spéciale chez {NomBoutique} ! Découvrez notre article phare : {NomProduit} à seulement {Prix}. Quantités limitées, achetez directement ici : {UrlBoutique}'
    },
    {
      title: '✨ Nouveauté Exclusive',
      badge: 'NOUVEAUTÉ EXCLUSIVE',
      template: '✨ Nouveauté disponible chez {NomBoutique} ! Venez découvrir {NomProduit}. Cliquez ici pour commander : {UrlBoutique}'
    },
    {
      title: '🛍️ Produit Star en Stock',
      badge: 'PRODUIT STAR',
      template: '🛍️ {NomProduit} est disponible chez {NomBoutique} au prix de {Prix}. Commandez en ligne simplement : {UrlBoutique}'
    },
    {
      title: '🚚 Livraison Gratuite',
      badge: 'LIVRAISON OFFERTE',
      template: '🚚 Offre spéciale chez {NomBoutique} ! Commandez {NomProduit} aujourd\'hui. Lien direct : {UrlBoutique}'
    }
  ];

  // Filtre dynamique des produits (recherche + collection)
  const filteredProducts = products.filter(p => {
    const matchesSearch = productSearchQuery.trim() === '' || 
      p.name?.toLowerCase().includes(productSearchQuery.toLowerCase());
    const matchesCollection = !selectedCollectionFilter || 
      p.collection_id === selectedCollectionFilter;
    return matchesSearch && matchesCollection;
  });

  const activePrice = customPrice.trim() !== '' 
    ? customPrice 
    : (currentProduct?.price ? `${currentProduct.price} FCFA` : 'Prix sur demande');
  const activeTheme = COLOR_THEMES[selectedThemeIdx] || COLOR_THEMES[0];

  useEffect(() => {
    if (socialTemplates[selectedSocialTextIdx]) {
      const resolvedText = resolveVariables(socialTemplates[selectedSocialTextIdx].template);
      setEditableTextContent(resolvedText);
    }
  }, [selectedSocialTextIdx, selectedProductIdx, store, customPrice]);

  const displayToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
  };

  const resolveVariables = (template: string) => {
    let result = template
      .replace(/\{NomBoutique\}/g, store?.name || 'Notre Boutique')
      .replace(/\{UrlBoutique\}/g, `https://libreshop.shop/store/${store?.slug || 'notre-boutique'}`);
    if (currentProduct) {
      result = result
        .replace(/\{NomProduit\}/g, currentProduct.name)
        .replace(/\{Prix\}/g, activePrice);
    } else {
      result = result
        .replace(/\{NomProduit\}/g, 'nos collections')
        .replace(/\{Prix\}/g, 'des prix exclusifs');
    }
    return result;
  };

  // Copier ET appliquer automatiquement aux champs du Studio Visuel !
  const handleCopyAndApplyTextToVisual = async (text: string) => {
    await Clipboard.setStringAsync(text);
    
    const currentTpl = socialTemplates[selectedSocialTextIdx];
    if (currentTpl) {
      setCustomTitle(currentTpl.title.toUpperCase());
      setCustomBadge(currentTpl.badge);
    }
    setCustomSubtitle(text.length > 70 ? text.slice(0, 67) + '...' : text);

    displayToast('Texte copié ET appliqué au Visuel ! 🎨', 'success');
  };

  // Événements Gabon
  const buildGabonEvents = () => {
    const now = new Date();
    const y = now.getFullYear();
    const list = [
      { id: '1', name: 'Fête du Travail', date: new Date(y, 4, 1), emoji: '🧰', themeIdx: 3, title: 'OFFRES FÊTE DU TRAVAIL', badge: 'PROMO SPÉCIALE' },
      { id: '2', name: 'Indépendance Gabon', date: new Date(y, 7, 17), emoji: '🇬🇦', themeIdx: 6, title: 'FÊTE DE L\'INDÉPENDANCE 🇬🇦', badge: 'VIVE LE GABON' },
      { id: '3', name: 'Rentrée Scolaire', date: new Date(y, 8, 1), emoji: '📚', themeIdx: 4, title: 'SPÉCIAL RENTRÉE SCOLAIRE', badge: 'REMISE ÉCOLE' },
      { id: '4', name: 'Fête Nationale', date: new Date(y, 10, 28), emoji: '🎆', themeIdx: 2, title: 'EXPOSITION FÊTE NATIONALE', badge: 'GRANDES SOLDES' },
      { id: '5', name: 'Black Friday', date: new Date(y, 10, 28), emoji: '🛍️', themeIdx: 5, title: 'BLACK FRIDAY LIBRESHOP', badge: 'JUSQU\'À -50%' },
      { id: '6', name: 'Fêtes de fin d\'année', date: new Date(y, 11, 25), emoji: '🎄', themeIdx: 1, title: 'OFFRES SPÉCIALES NOËL 🎄', badge: 'CADEAU INCLUS' },
      { id: '7', name: 'Nouvel An', date: new Date(y + 1, 0, 1), emoji: '🎉', themeIdx: 0, title: 'BONNE ANNÉE ! 🎉', badge: 'NOUVELLE SAISON' },
    ];
    const future = list.filter(e => e.date >= now);
    return (future.length > 0 ? future : list).slice(0, 6).map(e => ({
      ...e,
      dateLabel: e.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
    }));
  };
  const eventsList = buildGabonEvents();

  const handleApplyEventCampaign = (event: typeof eventsList[0]) => {
    setCustomTitle(event.title);
    setCustomBadge(event.badge);
    setSelectedThemeIdx(event.themeIdx);
    setCustomSubtitle(`Offres exclusives à l'occasion de la ${event.name}`);
    setActiveMainTab('studio');
    displayToast(`Campagne "${event.name}" appliquée au Studio !`, 'success');
  };

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    displayToast('Génération du catalogue PDF...', 'info');
    try {
      let html = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; color: #1e293b; margin: 24px; }
              .header { text-align: center; margin-bottom: 32px; }
              .logo { max-width: 110px; border-radius: 55px; }
              h1 { color: #0f172a; margin-top: 12px; font-size: 24px; }
              .collection { margin-top: 36px; page-break-inside: avoid; }
              .collection-title { background: #f1f5f9; padding: 12px 16px; border-radius: 8px; font-size: 18px; margin-bottom: 16px; color: #334155; }
              .grid { display: flex; flex-wrap: wrap; gap: 16px; }
              .product { width: 31%; text-align: center; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; box-sizing: border-box; background: #fafafa; }
              .product img { width: 100%; height: 160px; object-fit: cover; border-radius: 8px; }
              .price { color: #e11d48; font-weight: bold; font-size: 1.1em; margin-top: 8px; }
              .footer { text-align: center; margin-top: 48px; font-size: 0.85em; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; }
            </style>
          </head>
          <body>
            <div class="header">
              ${store?.logo_url ? `<img src="${store.logo_url}" class="logo" />` : ''}
              <h1>Catalogue de ${store?.name || 'Notre Boutique'}</h1>
              <p>Retrouvez tous nos produits sur <strong>libreshop.shop/${store?.slug || ''}</strong></p>
            </div>
      `;

      if (collections.length > 0) {
        collections.forEach(col => {
          const colProducts = products.filter(p => p.collection_id === col.id);
          if (colProducts.length > 0) {
            html += `<div class="collection">
              <h2 class="collection-title">${col.name}</h2>
              <div class="grid">`;
            colProducts.forEach(p => {
              html += `<div class="product">
                ${p.images?.[0] ? `<img src="${p.images[0]}" />` : '<div style="height:160px;background:#e2e8f0;border-radius:8px;"></div>'}
                <h3 style="font-size:14px;margin:8px 0 4px 0;">${p.name}</h3>
                <div class="price">${p.price} FCFA</div>
              </div>`;
            });
            html += `</div></div>`;
          }
        });
      } else {
        html += `<div class="grid">`;
        products.forEach(p => {
          html += `<div class="product">
            ${p.images?.[0] ? `<img src="${p.images[0]}" />` : '<div style="height:160px;background:#e2e8f0;border-radius:8px;"></div>'}
            <h3 style="font-size:14px;margin:8px 0 4px 0;">${p.name}</h3>
            <div class="price">${p.price} FCFA</div>
          </div>`;
        });
        html += `</div>`;
      }

      html += `
            <div class="footer">
              <p>Catalogue généré automatiquement via LibreShop - ${new Date().toLocaleDateString('fr-FR')}</p>
            </div>
          </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
        }

        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => document.body.removeChild(iframe), 2000);
        }, 500);

        displayToast('Impression du catalogue lancée !', 'info');
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri);
        displayToast('Catalogue PDF généré avec succès !', 'success');
      }
    } catch (e) {
      console.error(e);
      displayToast('Erreur génération PDF', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportVisual = async (formatId: string) => {
    if (formatId === 'pdf') {
      await handleGeneratePDF();
      return;
    }

    if ((formatId === 'story' || formatId === 'poster') && !products.length) {
      displayToast('Veuillez ajouter au moins un produit pour créer ce visuel', 'error');
      return;
    }

    try {
      setIsGenerating(true);
      displayToast('Génération du visuel en cours...', 'info');

      await new Promise(r => setTimeout(r, 600));

      let targetRef = storyRef;
      if (formatId === 'poster') targetRef = posterRef;
      if (formatId === 'store_poster') targetRef = storePosterRef;
      if (formatId === 'qr') targetRef = qrRef;

      let uri = '';

      if (Platform.OS === 'web') {
        const htmlToImage = await import('html-to-image');
        const node = targetRef.current as any;

        if (!node) throw new Error('Cible de capture non disponible');

        // Correction pour éviter les erreurs "Not allowed to load local resource: blob:"
        uri = await htmlToImage.toPng(node, {
          quality: 0.95,
          pixelRatio: 2,
          skipFonts: true,
          cacheBust: false,
          fontEmbedCSS: '',
        });

        const a = document.createElement('a');
        a.href = uri;
        a.download = `libreshop-${formatId}-${store?.slug || 'promo'}.png`;
        a.click();

        displayToast('Visuel téléchargé avec succès !', 'success');
      } else {
        uri = await captureRef(targetRef, { format: 'png', quality: 1 });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Partager le visuel LibreShop',
          });
        } else {
          displayToast('Partage indisponible sur cet appareil', 'error');
        }
      }
    } catch (err) {
      console.error('Erreur export:', err);
      displayToast('Erreur lors de la création du visuel', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const activeFeatures = [feature1, feature2, feature3].filter(f => f && f.trim() !== '');

  return (
    <View style={[styles.container, { backgroundColor: COLORS.bg, paddingTop: insets.top }]}>
      {/* 1. EN-TÊTE PRINCIPALE PRO */}
      <View style={[styles.header, { borderBottomColor: COLORS.border }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('SellerTabs')}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.headerTitle, { color: COLORS.text }]}>Studio Marketing Pro</Text>
            {!isOnline && (
              <View style={{ backgroundColor: '#f59e0b', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '800' }}>⚡ Hors-Ligne</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 11, color: COLORS.textMuted }}>{store?.name || 'LibreShop Store'}</Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {/* 2. BARRE DE NAVIGATION PAR ONGLETS PRO */}
      <View style={[styles.tabBarContainer, { borderBottomColor: COLORS.border, backgroundColor: COLORS.card }]}>
        {[
          { id: 'studio', label: 'Studio Visuel', icon: 'color-palette-outline' },
          { id: 'texts', label: 'Rédacteur & Légendes', icon: 'create-outline' },
          { id: 'events', label: 'Opportunités & Fêtes', icon: 'calendar-outline' },
        ].map((tab) => {
          const isActive = activeMainTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveMainTab(tab.id as any)}
              style={[
                styles.tabItem,
                isActive && { borderBottomColor: COLORS.primary, borderBottomWidth: 3 }
              ]}
            >
              <Ionicons name={tab.icon as any} size={18} color={isActive ? COLORS.primary : COLORS.textMuted} />
              <Text style={[styles.tabLabel, { color: isActive ? COLORS.primary : COLORS.textMuted, fontWeight: isActive ? '700' : '500' }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. CONTENU PRINCIPAL PAR ONGLET */}
      <View style={{ flex: 1 }}>

        {/* ================= ONGLET 1: STUDIO VISUEL ================= */}
        {activeMainTab === 'studio' && (
          <ScrollView contentContainerStyle={styles.contentPadding} showsVerticalScrollIndicator={false}>
            <View style={[styles.studioLayout, isDesktop && styles.desktopSplitLayout]}>
              
              {/* PANNEAU GAUCHE: CONTRÔLES ET CONFIGURATION */}
              <View style={[styles.controlsPanel, isDesktop && { flex: 1.1 }]}>

                {/* Étape 1: Choix du Format */}
                <View style={[styles.cardSection, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                  <Text style={[styles.sectionHeading, { color: COLORS.text }]}>1. Format d'Exportation</Text>
                  <View style={styles.formatGrid}>
                    {FORMATS.map((f) => {
                      const isSelected = selectedFormatId === f.id;
                      return (
                        <TouchableOpacity
                          key={f.id}
                          onPress={() => setSelectedFormatId(f.id)}
                          style={[
                            styles.formatCard,
                            {
                              borderColor: isSelected ? COLORS.primary : COLORS.border,
                              backgroundColor: isSelected ? COLORS.primary + '12' : COLORS.bg
                            }
                          ]}
                        >
                          <Ionicons name={f.icon as any} size={20} color={isSelected ? COLORS.primary : COLORS.textMuted} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? COLORS.primary : COLORS.text }}>{f.name}</Text>
                            <Text style={{ fontSize: 10, color: COLORS.textMuted }} numberOfLines={1}>{f.subtitle}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Étape 2: Choix du Produit avec Recherche & Filtres par Collection */}
                {products.length > 0 && selectedFormatId !== 'store_poster' && selectedFormatId !== 'qr' && selectedFormatId !== 'pdf' && (
                  <View style={[styles.cardSection, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={[styles.sectionHeading, { color: COLORS.text, marginBottom: 0 }]}>2. Produit à Mettre en Avant</Text>
                      {products.length > 5 && (
                        <TouchableOpacity 
                          onPress={() => setShowProductModal(true)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                          <Ionicons name="grid-outline" size={14} color={COLORS.primary} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.primary }}>
                            Voir tout ({products.length})
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Barre de Recherche Rapide Produit */}
                    <View style={[styles.searchBoxContainer, { backgroundColor: COLORS.bg, borderColor: COLORS.border }]}>
                      <Ionicons name="search-outline" size={16} color={COLORS.textMuted} />
                      <TextInput
                        style={[styles.searchInput, { color: COLORS.text }]}
                        value={productSearchQuery}
                        onChangeText={setProductSearchQuery}
                        placeholder="Rechercher un produit..."
                        placeholderTextColor={COLORS.textMuted}
                      />
                      {productSearchQuery !== '' && (
                        <TouchableOpacity onPress={() => setProductSearchQuery('')}>
                          <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Filtres par Collection */}
                    {collections.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 8 }}>
                        <TouchableOpacity
                          onPress={() => setSelectedCollectionFilter(null)}
                          style={[
                            styles.collectionFilterTag,
                            {
                              backgroundColor: !selectedCollectionFilter ? COLORS.primary : COLORS.bg,
                              borderColor: !selectedCollectionFilter ? COLORS.primary : COLORS.border,
                            }
                          ]}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: !selectedCollectionFilter ? '#FFF' : COLORS.text }}>
                            Toutes
                          </Text>
                        </TouchableOpacity>
                        {collections.map(col => {
                          const isSelected = selectedCollectionFilter === col.id;
                          return (
                            <TouchableOpacity
                              key={col.id}
                              onPress={() => setSelectedCollectionFilter(isSelected ? null : col.id)}
                              style={[
                                styles.collectionFilterTag,
                                {
                                  backgroundColor: isSelected ? COLORS.primary : COLORS.bg,
                                  borderColor: isSelected ? COLORS.primary : COLORS.border,
                                }
                              ]}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? '#FFF' : COLORS.text }}>
                                {col.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}

                    {/* Liste des résultats filtrés */}
                    {filteredProducts.length === 0 ? (
                      <Text style={{ fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic', marginVertical: 8 }}>
                        Aucun produit ne correspond à votre recherche.
                      </Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 4 }}>
                        {filteredProducts.slice(0, 8).map((p) => {
                          const realIdx = products.findIndex(item => item.id === p.id);
                          const isSelected = realIdx === selectedProductIdx;
                          return (
                            <TouchableOpacity
                              key={p.id}
                              onPress={() => setSelectedProductIdx(realIdx >= 0 ? realIdx : 0)}
                              style={[
                                styles.productChip,
                                {
                                  borderColor: isSelected ? COLORS.primary : COLORS.border,
                                  backgroundColor: isSelected ? COLORS.primary + '15' : COLORS.bg
                                }
                              ]}
                            >
                              {p.images?.[0] ? (
                                <Image source={{ uri: p.images[0] }} style={{ width: 36, height: 36, borderRadius: 8 }} />
                              ) : (
                                <Ionicons name="cube-outline" size={24} color={COLORS.textMuted} />
                              )}
                              <View style={{ maxWidth: 130 }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? COLORS.primary : COLORS.text }} numberOfLines={1}>
                                  {p.name}
                                </Text>
                                <Text style={{ fontSize: 10, color: COLORS.textMuted }}>{p.price} FCFA</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>
                )}

                {/* Étape 3: Thème de Couleur */}
                {selectedFormatId !== 'pdf' && (
                  <View style={[styles.cardSection, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                    <Text style={[styles.sectionHeading, { color: COLORS.text }]}>3. Thème Visuel & Ambiance</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                      {COLOR_THEMES.map((theme, idx) => {
                        const isSelected = idx === selectedThemeIdx;
                        return (
                          <TouchableOpacity
                            key={theme.id}
                            onPress={() => setSelectedThemeIdx(idx)}
                            style={{ alignItems: 'center' }}
                          >
                            <LinearGradient
                              colors={theme.colors}
                              style={[
                                styles.themeCircle,
                                isSelected && { borderWidth: 3, borderColor: COLORS.primary }
                              ]}
                            />
                            <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.text, marginTop: 4 }}>{theme.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Étape 4: Caractéristiques du Produit */}
                {selectedFormatId !== 'pdf' && (
                  <View style={[styles.cardSection, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Ionicons name="checkmark-done-circle-outline" size={18} color={COLORS.primary} />
                      <Text style={[styles.sectionHeading, { color: COLORS.text, marginBottom: 0 }]}>
                        4. Caractéristiques du Produit sur l'Image
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 12 }}>
                      Personnalisez les 3 avantages clés qui seront affichés sous forme de badges sur votre visuel :
                    </Text>

                    <View style={styles.inputField}>
                      <Text style={[styles.inputLabel, { color: COLORS.textMuted }]}>Caractéristique 1</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: COLORS.bg, color: COLORS.text, borderColor: COLORS.border }]}
                        value={feature1}
                        onChangeText={setFeature1}
                        placeholder="Ex: État Neuf / 100% Coton"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>

                    <View style={styles.inputField}>
                      <Text style={[styles.inputLabel, { color: COLORS.textMuted }]}>Caractéristique 2</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: COLORS.bg, color: COLORS.text, borderColor: COLORS.border }]}
                        value={feature2}
                        onChangeText={setFeature2}
                        placeholder="Ex: En stock immédiat"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>

                    <View style={styles.inputField}>
                      <Text style={[styles.inputLabel, { color: COLORS.textMuted }]}>Caractéristique 3</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: COLORS.bg, color: COLORS.text, borderColor: COLORS.border }]}
                        value={feature3}
                        onChangeText={setFeature3}
                        placeholder="Ex: Garantie LibreShop"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>
                  </View>
                )}

                {/* Étape 5: Édition des Textes du Visuel */}
                {selectedFormatId !== 'pdf' && (
                  <View style={[styles.cardSection, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                    <Text style={[styles.sectionHeading, { color: COLORS.text }]}>5. Personnalisation des Slogans</Text>

                    <View style={styles.inputField}>
                      <Text style={[styles.inputLabel, { color: COLORS.textMuted }]}>Titre Principal</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: COLORS.bg, color: COLORS.text, borderColor: COLORS.border }]}
                        value={customTitle}
                        onChangeText={setCustomTitle}
                        placeholder="Ex: FÊTE DE L'INDÉPENDANCE 🇬🇦"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>

                    <View style={styles.inputField}>
                      <Text style={[styles.inputLabel, { color: COLORS.textMuted }]}>Badge Promotionnel (ex: -20%, VIVE LE GABON)</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: COLORS.bg, color: COLORS.text, borderColor: COLORS.border }]}
                        value={customBadge}
                        onChangeText={setCustomBadge}
                        placeholder="Ex: VIVE LE GABON"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>

                    <View style={styles.inputField}>
                      <Text style={[styles.inputLabel, { color: COLORS.textMuted }]}>Sous-titre / Description</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: COLORS.bg, color: COLORS.text, borderColor: COLORS.border }]}
                        value={customSubtitle}
                        onChangeText={setCustomSubtitle}
                        placeholder="Ex: Offres exclusives à l'occasion..."
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>

                    <View style={styles.inputField}>
                      <Text style={[styles.inputLabel, { color: COLORS.textMuted }]}>Bouton d'Action (Call-to-Action)</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: COLORS.bg, color: COLORS.text, borderColor: COLORS.border }]}
                        value={customCta}
                        onChangeText={setCustomCta}
                        placeholder="Ex: COMMANDER SUR LIBRESHOP"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>

                    {currentProduct && selectedFormatId !== 'store_poster' && selectedFormatId !== 'qr' && (
                      <View style={styles.inputField}>
                        <Text style={[styles.inputLabel, { color: COLORS.textMuted }]}>Prix Personnalisé (facultatif)</Text>
                        <TextInput
                          style={[styles.textInput, { backgroundColor: COLORS.bg, color: COLORS.text, borderColor: COLORS.border }]}
                          value={customPrice}
                          onChangeText={setCustomPrice}
                          placeholder={`Par défaut : ${currentProduct.price} FCFA`}
                          placeholderTextColor={COLORS.textMuted}
                        />
                      </View>
                    )}
                  </View>
                )}

              </View>

              {/* PANNEAU DROITE: PRÉVISUALISATION CANVAS EN DIRECT */}
              <View style={[styles.previewPanel, isDesktop && { flex: 0.9, position: 'sticky', top: 20 }]}>
                <View style={[styles.previewCardBox, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>👁️ Aperçu Direct</Text>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.primary, backgroundColor: COLORS.primary + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                      Format {FORMATS.find(f => f.id === selectedFormatId)?.name}
                    </Text>
                  </View>

                  {/* RENDU LIVE D'APERÇU - TAILLE IMAGE AGRANDIE */}
                  <View style={styles.canvasContainer}>
                    <LinearGradient
                      colors={activeTheme.colors}
                      style={[
                        styles.canvasCard,
                        selectedFormatId === 'story' ? { height: 440 } : { height: 380 }
                      ]}
                    >
                      {/* Logo & Nom Boutique */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        {store?.logo_url ? (
                          <Image source={{ uri: store.logo_url }} style={{ width: 28, height: 28, borderRadius: 14, marginRight: 6 }} />
                        ) : (
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.3)', marginRight: 6 }} />
                        )}
                        <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFF' }}>{store?.name || 'Ma Boutique'}</Text>
                      </View>

                      {/* TITRE PRINCIPAL SUR LE CANVAS */}
                      {customTitle ? (
                        <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFF', textAlign: 'center', marginVertical: 2 }} numberOfLines={1}>
                          {customTitle}
                        </Text>
                      ) : null}

                      {/* SOUS-TITRE / DESCRIPTION SUR LE CANVAS */}
                      {customSubtitle ? (
                        <Text style={{ fontSize: 10, color: activeTheme.accent, textAlign: 'center', marginBottom: 4 }} numberOfLines={2}>
                          {customSubtitle}
                        </Text>
                      ) : null}

                      {/* Contenu Canvas Produit / QR */}
                      {selectedFormatId === 'qr' || selectedFormatId === 'store_poster' ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          {customBadge ? (
                            <View style={{ backgroundColor: activeTheme.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginBottom: 4 }}>
                              <Text style={{ fontSize: 9, fontWeight: '900', color: '#0f172a' }}>{customBadge}</Text>
                            </View>
                          ) : null}
                          <View style={{ backgroundColor: '#FFF', padding: 6, borderRadius: 10, marginTop: 4 }}>
                            <Image
                              source={{ uri: qrCodeService.getQrImageUrl(qrCodeService.getStoreUrl(store?.slug || ''), 90) }}
                              style={{ width: 85, height: 85 }}
                            />
                          </View>
                        </View>
                      ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          {customBadge ? (
                            <View style={{ backgroundColor: activeTheme.accent, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 4 }}>
                              <Text style={{ fontSize: 10, fontWeight: '900', color: '#0f172a' }}>{customBadge}</Text>
                            </View>
                          ) : null}

                          {/* IMAGE DU PRODUIT AGRANDIE (120x120 au lieu de 85x85) */}
                          {currentProduct?.images?.[0] ? (
                            <Image
                              source={{ uri: currentProduct.images[0] }}
                              style={{ width: 120, height: 120, borderRadius: 14, marginBottom: 4 }}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={{ width: 110, height: 110, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, marginBottom: 4, alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name="image-outline" size={42} color="#FFF" />
                            </View>
                          )}

                          <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFF', textAlign: 'center' }} numberOfLines={1}>
                            {currentProduct?.name || 'Produit'}
                          </Text>
                          <Text style={{ fontSize: 15, fontWeight: '900', color: activeTheme.accent, marginTop: 1 }}>
                            {activePrice}
                          </Text>

                          {/* BADGES DES CARACTÉRISTIQUES DU PRODUIT */}
                          {activeFeatures.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, marginTop: 6 }}>
                              {activeFeatures.map((feat, fIdx) => (
                                <View key={fIdx} style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                  <Ionicons name="checkmark-circle" size={10} color="#FFF" />
                                  <Text style={{ fontSize: 8, fontWeight: '700', color: '#FFF' }}>{feat}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}

                      {/* CTA Footer */}
                      <View style={{ backgroundColor: 'rgba(0,0,0,0.3)', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 14, alignSelf: 'center', marginTop: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFF' }}>{customCta}</Text>
                      </View>
                    </LinearGradient>
                  </View>

                  {/* BOUTON D'EXPORTATION PRINCIPAL */}
                  <TouchableOpacity
                    style={[styles.exportBtn, { backgroundColor: COLORS.primary, opacity: isGenerating ? 0.7 : 1 }]}
                    onPress={() => handleExportVisual(selectedFormatId)}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <Ionicons name="download-outline" size={18} color="#FFF" />
                        <Text style={styles.exportBtnText}>
                          {selectedFormatId === 'pdf' ? 'Télécharger Catalogue PDF' : 'Télécharger l\'Image (PNG)'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

            </View>
          </ScrollView>
        )}

        {/* ================= ONGLET 2: RÉDACTEUR & LÉGENDES ================= */}
        {activeMainTab === 'texts' && (
          <ScrollView contentContainerStyle={styles.contentPadding} showsVerticalScrollIndicator={false}>
            <View style={[styles.cardSection, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
              <Text style={[styles.sectionHeading, { color: COLORS.text }]}>✍️ Modèles de Publications Réseaux Sociaux</Text>
              <Text style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 16 }}>
                Sélectionnez un modèle pré-rédigé, adaptez-le directement puis copiez ou appliquez automatiquement le texte sur votre visuel !
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {socialTemplates.map((t, idx) => {
                  const isSelected = idx === selectedSocialTextIdx;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => setSelectedSocialTextIdx(idx)}
                      style={[
                        styles.chipOption,
                        {
                          borderColor: isSelected ? COLORS.primary : COLORS.border,
                          backgroundColor: isSelected ? COLORS.primary + '15' : COLORS.bg
                        }
                      ]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? COLORS.primary : COLORS.text }}>{t.title}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={[styles.editorBox, { backgroundColor: COLORS.bg, borderColor: COLORS.border }]}>
                <TextInput
                  style={[styles.multilineInput, { color: COLORS.text }]}
                  multiline
                  value={editableTextContent}
                  onChangeText={setEditableTextContent}
                  placeholder="Écrivez ou modifiez votre texte..."
                  placeholderTextColor={COLORS.textMuted}
                />
                
                <View style={styles.editorFooter}>
                  <Text style={{ fontSize: 11, color: COLORS.textMuted }}>Variables : NomBoutique, Prix, Lien</Text>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.copyActionBtn, { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border }]}
                      onPress={() => handleCopyAndApplyTextToVisual(editableTextContent)}
                    >
                      <Ionicons name="copy-outline" size={15} color={COLORS.text} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text }}>Copier</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.copyActionBtn, { backgroundColor: COLORS.primary }]}
                      onPress={() => {
                        handleCopyAndApplyTextToVisual(editableTextContent);
                        setActiveMainTab('studio');
                      }}
                    >
                      <Ionicons name="sparkles" size={15} color="#FFF" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }}>Copier & Remplir le Visuel 🎨</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        )}

        {/* ================= ONGLET 3: OPPORTUNITÉS & ÉVÉNEMENTS ================= */}
        {activeMainTab === 'events' && (
          <ScrollView contentContainerStyle={styles.contentPadding} showsVerticalScrollIndicator={false}>
            <View style={[styles.cardSection, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
              <Text style={[styles.sectionHeading, { color: COLORS.text }]}>📅 Calendrier Marketing & Opportunités Gabon</Text>
              <Text style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 16 }}>
                Préparez vos campagnes en amont des fêtes et temps forts de l'année pour multiplier vos ventes !
              </Text>

              <View style={styles.eventsGrid}>
                {eventsList.map((event) => (
                  <LinearGradient
                    key={event.id}
                    colors={COLOR_THEMES[event.themeIdx].colors}
                    style={styles.eventBannerCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '700', textTransform: 'uppercase' }}>
                        {event.emoji} {event.dateLabel}
                      </Text>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: '#FFF', marginTop: 4 }}>{event.name}</Text>
                      <Text style={{ fontSize: 12, color: COLOR_THEMES[event.themeIdx].accent, marginTop: 2 }}>{event.title}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.applyCampaignBtn}
                      onPress={() => handleApplyEventCampaign(event)}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#0f172a' }}>Appliquer au Studio 🚀</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                ))}
              </View>
            </View>
          </ScrollView>
        )}

      </View>

      {/* MODAL SÉLECTEUR DE PRODUITS AVEC RECHERCHE */}
      <Modal
        visible={showProductModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProductModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            {/* Header Modal */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: COLORS.text }]}>Sélectionner un produit ({products.length})</Text>
              <TouchableOpacity onPress={() => setShowProductModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Input Recherche Modal */}
            <View style={[styles.searchBoxContainer, { backgroundColor: COLORS.bg, borderColor: COLORS.border, marginBottom: 12 }]}>
              <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: COLORS.text }]}
                value={productSearchQuery}
                onChangeText={setProductSearchQuery}
                placeholder="Rechercher par nom de produit..."
                placeholderTextColor={COLORS.textMuted}
                autoFocus
              />
              {productSearchQuery !== '' && (
                <TouchableOpacity onPress={() => setProductSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Grille des produits du Modal */}
            <ScrollView contentContainerStyle={styles.modalProductsGrid} showsVerticalScrollIndicator={false}>
              {filteredProducts.map((p) => {
                const realIdx = products.findIndex(item => item.id === p.id);
                const isSelected = realIdx === selectedProductIdx;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => {
                      setSelectedProductIdx(realIdx >= 0 ? realIdx : 0);
                      setShowProductModal(false);
                    }}
                    style={[
                      styles.modalProductCard,
                      {
                        backgroundColor: isSelected ? COLORS.primary + '15' : COLORS.bg,
                        borderColor: isSelected ? COLORS.primary : COLORS.border,
                      }
                    ]}
                  >
                    {p.images?.[0] ? (
                      <Image source={{ uri: p.images[0] }} style={styles.modalProductImg} />
                    ) : (
                      <View style={[styles.modalProductImg, { backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="cube-outline" size={32} color={COLORS.textMuted} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? COLORS.primary : COLORS.text }} numberOfLines={2}>
                        {p.name}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.primary, marginTop: 2 }}>
                        {p.price} FCFA
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* COMPOSANTS INVISIBLES POUR RENDU HAUTE RÉSOLUTION / EXPORT PNG */}
      <View style={{ position: 'absolute', top: -10000, left: -10000 }}>
        
        {/* Story 9:16 (1080x1920) - IMAGE AGRANDIE À 760x760 */}
        <View ref={storyRef} style={{ width: 1080, height: 1920, backgroundColor: activeTheme.colors[0], padding: 50 }}>
          <LinearGradient colors={activeTheme.colors} style={StyleSheet.absoluteFillObject} />
          
          <View style={{ padding: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            {store?.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={{ width: 120, height: 120, borderRadius: 60, marginRight: 24 }} />
            ) : null}
            <Text style={{ fontSize: 56, fontWeight: '900', color: '#FFF' }}>{store?.name || 'Boutique'}</Text>
          </View>

          {/* Titre Principal */}
          {customTitle ? (
            <Text style={{ fontSize: 54, fontWeight: '900', color: '#FFF', textAlign: 'center', marginHorizontal: 40, marginBottom: 16 }}>
              {customTitle}
            </Text>
          ) : null}

          {/* Sous-titre / Description */}
          {customSubtitle ? (
            <Text style={{ fontSize: 32, fontWeight: '600', color: activeTheme.accent, textAlign: 'center', marginHorizontal: 60, marginBottom: 26 }}>
              {customSubtitle}
            </Text>
          ) : null}

          {/* Badge */}
          {customBadge ? (
            <View style={{ backgroundColor: activeTheme.accent, paddingHorizontal: 36, paddingVertical: 18, borderRadius: 40, alignSelf: 'center', marginBottom: 26 }}>
              <Text style={{ fontSize: 36, fontWeight: '900', color: '#0f172a' }}>{customBadge}</Text>
            </View>
          ) : null}

          {currentProduct && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {/* IMAGE BOÎTE AGRANDIE (760x760 au lieu de 680x680) */}
              <View style={{ width: 760, height: 760, backgroundColor: '#FFF', borderRadius: 44, padding: 20, elevation: 10 }}>
                {currentProduct.images?.[0] ? (
                  <Image source={{ uri: currentProduct.images[0] }} style={{ width: '100%', height: '100%', borderRadius: 32 }} resizeMode="cover" />
                ) : (
                  <View style={{ width: '100%', height: '100%', backgroundColor: '#f1f5f9', borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="image-outline" size={200} color="#94a3b8" />
                  </View>
                )}
              </View>

              <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 48, paddingVertical: 24, borderRadius: 36, marginTop: -40, elevation: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 42, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 6 }}>{currentProduct.name}</Text>
                <Text style={{ fontSize: 52, fontWeight: '900', color: activeTheme.colors[0] }}>{activePrice}</Text>

                {/* Caractéristiques sur Story PNG */}
                {activeFeatures.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 14 }}>
                    {activeFeatures.map((feat, fIdx) => (
                      <View key={fIdx} style={{ backgroundColor: activeTheme.colors[0], paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16 }}>
                        <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFF' }}>✓ {feat}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={{ padding: 50, alignItems: 'center', marginBottom: 30 }}>
            <View style={{ backgroundColor: '#FFF', paddingHorizontal: 48, paddingVertical: 22, borderRadius: 80 }}>
              <Text style={{ fontSize: 34, fontWeight: '900', color: activeTheme.colors[0] }}>{customCta}</Text>
            </View>
            <Text style={{ fontSize: 28, fontWeight: '600', color: '#FFF', marginTop: 24 }}>
              libreshop.shop/{store?.slug || ''}
            </Text>
          </View>
        </View>

        {/* Affiche Carrée 1:1 (1080x1080) - IMAGE BOÎTE AGRANDIE À 520x520 */}
        <View ref={posterRef} style={{ width: 1080, height: 1080, backgroundColor: '#FFF', overflow: 'hidden' }}>
          {/* Header Gradient */}
          <LinearGradient colors={activeTheme.colors} style={{ paddingHorizontal: 50, paddingTop: 40, paddingBottom: 30, flexDirection: 'row', alignItems: 'center' }}>
            {store?.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={{ width: 90, height: 90, borderRadius: 45, marginRight: 20 }} />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 36, fontWeight: '900', color: '#FFF' }}>{store?.name || 'Boutique'}</Text>
              {customTitle ? (
                <Text style={{ fontSize: 24, fontWeight: '800', color: activeTheme.accent }}>{customTitle}</Text>
              ) : null}
              {customSubtitle ? (
                <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)', marginTop: 2 }}>{customSubtitle}</Text>
              ) : null}
            </View>
          </LinearGradient>

          {currentProduct && (
            <View style={{ flex: 1, flexDirection: 'row', padding: 36, alignItems: 'center' }}>
              {/* IMAGE AGRANDIE (520x520 au lieu de 440x440) */}
              <View style={{ width: 520, height: 520, backgroundColor: '#f1f5f9', borderRadius: 36, overflow: 'hidden', elevation: 6 }}>
                {currentProduct.images?.[0] ? (
                  <Image source={{ uri: currentProduct.images[0] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="image-outline" size={150} color="#94a3b8" />
                  </View>
                )}
              </View>

              <View style={{ flex: 1, marginLeft: 36 }}>
                {customBadge ? (
                  <View style={{ backgroundColor: activeTheme.colors[0], paddingHorizontal: 18, paddingVertical: 8, borderRadius: 14, alignSelf: 'flex-start', marginBottom: 10 }}>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFF' }}>{customBadge}</Text>
                  </View>
                ) : null}
                <Text style={{ fontSize: 38, fontWeight: '800', color: '#0f172a', marginBottom: 6 }} numberOfLines={2}>{currentProduct.name}</Text>
                <Text style={{ fontSize: 48, fontWeight: '900', color: activeTheme.colors[0], marginBottom: 14 }}>{activePrice}</Text>

                {/* Badges Caractéristiques Produit */}
                {activeFeatures.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {activeFeatures.map((feat, fIdx) => (
                      <View key={fIdx} style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#334155' }}>✓ {feat}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#334155' }}>{customCta}</Text>
                  <Text style={{ fontSize: 18, color: '#64748b', marginTop: 4 }}>libreshop.shop/{store?.slug || ''}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Affiche Boutique (1080x1080) */}
        <View ref={storePosterRef} style={{ width: 1080, height: 1080, backgroundColor: activeTheme.colors[0], alignItems: 'center', justifyContent: 'center' }}>
          <LinearGradient colors={activeTheme.colors} style={StyleSheet.absoluteFillObject} />
          <View style={{ padding: 50, alignItems: 'center' }}>
            {store?.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={{ width: 180, height: 180, borderRadius: 90, marginBottom: 20, borderWidth: 5, borderColor: '#FFF' }} />
            ) : null}
            <Text style={{ fontSize: 54, fontWeight: '900', color: '#FFF', textAlign: 'center', marginBottom: 10 }}>
              {store?.name || 'Votre Boutique'}
            </Text>

            {customTitle ? (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 36, marginBottom: 12 }}>
                <Text style={{ fontSize: 26, fontWeight: '800', color: '#FFF' }}>{customTitle}</Text>
              </View>
            ) : null}

            {customBadge ? (
              <View style={{ backgroundColor: activeTheme.accent, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, marginBottom: 16 }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#0f172a' }}>{customBadge}</Text>
              </View>
            ) : null}

            {customSubtitle ? (
              <Text style={{ fontSize: 24, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginBottom: 28 }}>{customSubtitle}</Text>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 24, borderRadius: 24, elevation: 10 }}>
              <View style={{ borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, overflow: 'hidden', padding: 6, marginRight: 20 }}>
                <Image
                  source={{ uri: qrCodeService.getQrImageUrl(qrCodeService.getStoreUrl(store?.slug || ''), 180) }}
                  style={{ width: 180, height: 180 }}
                />
              </View>
              <View style={{ maxWidth: 400 }}>
                <Text style={{ fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 6 }}>Scannez ce QR Code</Text>
                <Text style={{ fontSize: 20, color: '#475569', lineHeight: 28 }}>Commandez sur libreshop.shop/{store?.slug || ''}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Flyer QR Code (1080x1080) */}
        <View ref={qrRef} style={{ width: 1080, height: 1080, backgroundColor: activeTheme.colors[0], alignItems: 'center', justifyContent: 'center' }}>
          <LinearGradient colors={activeTheme.colors} style={StyleSheet.absoluteFillObject} />
          <View style={{ width: 800, height: 800, backgroundColor: '#FFF', borderRadius: 40, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            {store?.logo_url && (
              <Image source={{ uri: store.logo_url }} style={{ width: 120, height: 120, borderRadius: 60, marginBottom: 20 }} />
            )}
            <Text style={{ fontSize: 44, fontWeight: '900', color: '#0f172a', textAlign: 'center', marginBottom: 6 }}>{store?.name || 'Notre Boutique'}</Text>
            
            {customTitle ? (
              <Text style={{ fontSize: 24, fontWeight: '800', color: activeTheme.colors[0], textAlign: 'center', marginBottom: 4 }}>{customTitle}</Text>
            ) : null}

            {customSubtitle ? (
              <Text style={{ fontSize: 20, fontWeight: '600', color: '#64748b', textAlign: 'center', marginBottom: 24 }}>{customSubtitle}</Text>
            ) : null}

            <View style={{ borderWidth: 4, borderColor: activeTheme.colors[0], borderRadius: 20, overflow: 'hidden', padding: 12 }}>
              <Image
                source={{ uri: qrCodeService.getQrImageUrl(qrCodeService.getStoreUrl(store?.slug || ''), 320) }}
                style={{ width: 320, height: 320 }}
              />
            </View>

            <Text style={{ fontSize: 24, fontWeight: '800', color: activeTheme.colors[0], marginTop: 28 }}>libreshop.shop/{store?.slug || ''}</Text>
          </View>
        </View>

      </View>

      {showToast && (
        <Toast
          visible={showToast}
          message={toastMessage}
          type={toastType}
          onHide={() => setShowToast(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginLeft: -4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  tabBarContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  tabLabel: {
    fontSize: 13,
  },
  contentPadding: {
    padding: 16,
  },
  studioLayout: {
    flexDirection: 'column',
    gap: 16,
  },
  desktopSplitLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  controlsPanel: {
    gap: 16,
  },
  previewPanel: {
    width: '100%',
  },
  cardSection: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  formatGrid: {
    gap: 8,
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  searchBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  collectionFilterTag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  productChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    maxWidth: 200,
  },
  themeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  inputField: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  previewCardBox: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  canvasContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  canvasCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    padding: 14,
    justifyContent: 'space-between',
    elevation: 4,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 12,
  },
  exportBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  chipOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  editorBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
  },
  multilineInput: {
    fontSize: 14,
    lineHeight: 22,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  editorFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  copyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  eventsGrid: {
    gap: 12,
  },
  eventBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
  },
  applyCampaignBtn: {
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    elevation: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '80%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalProductsGrid: {
    gap: 10,
    paddingBottom: 16,
  },
  modalProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  modalProductImg: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
});
