import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
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
import { Toast } from '../components/Toast';

export const SellerMarketingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { getColor: COLORS, spacing: SPACING, radius: RADIUS, fontSize: FONT_SIZE } = useTheme();
  const store = useStoreStore((s) => s.store);

  const [products, setProducts] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  const [selectedProductIdx, setSelectedProductIdx] = useState(0);
  const [selectedTextIdx, setSelectedTextIdx] = useState<number | null>(null);

  const storyRef = React.useRef<View>(null);
  const posterRef = React.useRef<View>(null);
  const qrRef = React.useRef<View>(null);
  const storePosterRef = React.useRef<View>(null);
  const bannerRef = React.useRef<View>(null);

  useEffect(() => {
    if (store?.id) {
      productService.getByStoreAll(store.id).then(setProducts).catch(console.error);
      collectionService.getByStore(store.id).then(res => setCollections(res || [])).catch(console.error);
    }
  }, [store?.id]);

  const displayToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
  };

  const resolveText = (textTemplate: string) => {
    const product = products[selectedProductIdx] || null;
    let text = textTemplate
      .replace('{NomBoutique}', store?.name || 'Notre Boutique')
      .replace('{UrlBoutique}', `https://libreshop.shop/store/${store?.slug || 'notre-boutique'}`);
    if (product) {
      text = text
        .replace('{NomProduit}', product.name)
        .replace('{Prix}', product.price ? `${product.price} FCFA` : 'Prix sur demande');
    } else {
      text = text
        .replace('{NomProduit}', 'nos nouveaux articles')
        .replace('{Prix}', 'des prix imbattables');
    }
    return text;
  };

  const handleCopyText = async (textTemplate: string) => {
    await Clipboard.setStringAsync(resolveText(textTemplate));
    displayToast('Texte copié dans le presse-papier !', 'success');
  };

  // Calendrier dynamique événements Gabon
  const buildEvents = () => {
    const now = new Date();
    const y = now.getFullYear();
    const events = [
      { name: 'Fête du Travail', date: new Date(y, 4, 1), emoji: '🧰', color: '#ef4444' },
      { name: 'Indépendance Gabon', date: new Date(y, 7, 17), emoji: '🇬🇦', color: '#009e60' },
      { name: 'Rentrée Scolaire', date: new Date(y, 8, 1), emoji: '📚', color: '#3b82f6' },
      { name: 'Fête Nationale', date: new Date(y, 10, 28), emoji: '🎆', color: '#f59e0b' },
      { name: 'Black Friday', date: new Date(y, 10, 28), emoji: '🛍️', color: '#111827' },
      { name: 'Noël', date: new Date(y, 11, 25), emoji: '🎄', color: '#dc2626' },
      { name: 'Nouvel An', date: new Date(y + 1, 0, 1), emoji: '🎉', color: '#7c3aed' },
    ];
    const future = events.filter(e => e.date >= now);
    return (future.length > 0 ? future : events).slice(0, 5).map(e => ({
      ...e,
      dateLabel: e.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
    }));
  };
  const upcomingEvents = buildEvents();

  const quickActions = [
    { title: 'Story Produit', subtitle: 'Format 9:16', icon: 'logo-instagram', color: '#ec4899', type: 'story' },
    { title: 'Affiche Produit', subtitle: 'Format carré 1:1', icon: 'logo-whatsapp', color: '#22c55e', type: 'poster' },
    { title: 'Affiche Boutique', subtitle: 'Lancement', icon: 'megaphone-outline', color: '#8b5cf6', type: 'store_poster' },
    { title: 'Bannières Promo', subtitle: 'SellerPromoBanners', icon: 'images-outline', color: '#f59e0b', type: 'banners' },
    { title: 'Catalogue PDF', subtitle: 'Par collections', icon: 'document-text', color: '#ef4444', type: 'pdf' },
    { title: 'QR Code', subtitle: 'Pour imprimer', icon: 'qr-code', color: '#6366f1', type: 'qr' },
  ];

  const socialTexts = [
    {
      title: 'Lancement Promotion',
      template: '🎉 Promo spéciale chez {NomBoutique} ! Découvrez notre produit star : {NomProduit} à seulement {Prix}. Stock limité, commandez vite ici : {UrlBoutique}'
    },
    {
      title: 'Nouveauté',
      template: '✨ Nouveauté exclusive chez {NomBoutique} ! Ne ratez pas {NomProduit}. Cliquez ici pour le découvrir : {UrlBoutique}'
    },
    {
      title: 'Rappel Panier',
      template: '🛍️ Vous cherchez {NomProduit} ? Il est disponible chez {NomBoutique} au prix de {Prix}. Commandez en ligne facilement : {UrlBoutique}'
    },
  ];

  const generatePDF = async () => {
    setIsGenerating(true);
    displayToast('Génération du catalogue PDF...', 'info');
    try {
      let html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; color: #333; }
              .header { text-align: center; margin-bottom: 30px; }
              .logo { max-width: 150px; border-radius: 75px; }
              h1 { color: #111; }
              .collection { margin-top: 40px; page-break-inside: avoid; }
              .collection-title { background: #f3f4f6; padding: 10px; border-radius: 8px; margin-bottom: 20px; }
              .grid { display: flex; flex-wrap: wrap; gap: 20px; }
              .product { width: 30%; text-align: center; border: 1px solid #eee; border-radius: 12px; padding: 10px; box-sizing: border-box; }
              .product img { width: 100%; height: 200px; object-fit: cover; border-radius: 8px; }
              .price { color: #e11d48; font-weight: bold; font-size: 1.2em; margin-top: 10px; }
              .footer { text-align: center; margin-top: 50px; font-size: 0.9em; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              ${store?.logo_url ? `<img src="${store.logo_url}" class="logo" />` : ''}
              <h1>Catalogue de ${store?.name || 'Boutique'}</h1>
              <p>Découvrez nos produits sur <strong>libreshop.shop/${store?.slug || ''}</strong></p>
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
                ${p.images?.[0] ? `<img src="${p.images[0]}" />` : '<div style="height:200px;background:#eee;"></div>'}
                <h3>${p.name}</h3>
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
            ${p.images?.[0] ? `<img src="${p.images[0]}" />` : '<div style="height:200px;background:#eee;"></div>'}
            <h3>${p.name}</h3>
            <div class="price">${p.price} FCFA</div>
          </div>`;
        });
        html += `</div>`;
      }

      html += `
            <div class="footer">
              <p>Généré le ${new Date().toLocaleDateString('fr-FR')}</p>
            </div>
          </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        // Sur le web, expo-print ignore le paramètre `html` et imprime la page entière.
        // On crée donc une iframe invisible pour imprimer uniquement le catalogue.
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
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 2000);
        }, 500); // Temps pour charger les images

        displayToast('Veuillez sélectionner "Enregistrer au format PDF"', 'info');
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri);
        displayToast('Catalogue généré avec succès !', 'success');
      }
    } catch (e) {
      console.error(e);
      displayToast('Erreur génération PDF', 'error');
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  };

  const handleAction = async (type: string) => {
    if (type === 'pdf') {
      await generatePDF();
      return;
    }

    if (!['story', 'poster', 'store_poster', 'qr', 'banners'].includes(type)) {
      displayToast('Bientôt disponible', 'info');
      return;
    }

    if ((type === 'story' || type === 'poster' || type === 'banners') && !products.length) {
      displayToast('Vous devez avoir au moins un produit', 'error');
      return;
    }

    try {
      setIsGenerating(true);
      setGeneratingType(type);
      displayToast('Génération de l\'image...', 'info');

      // Un délai pour s'assurer que le composant invisible a bien rendu les images (logo, QR, etc.)
      await new Promise(resolve => setTimeout(resolve, 1000));

      let targetRef = storyRef;
      if (type === 'poster') targetRef = posterRef;
      if (type === 'store_poster') targetRef = storePosterRef;
      if (type === 'qr') targetRef = qrRef;
      if (type === 'banners') targetRef = bannerRef;

      let uri = '';

      if (Platform.OS === 'web') {
        const htmlToImage = await import('html-to-image');
        const toPng = htmlToImage.toPng;
        const node = targetRef.current as any;

        if (!node) throw new Error('DOM Node introuvable');

        uri = await toPng(node, {
          quality: 1,
          pixelRatio: 2,
          skipFonts: true,
          cacheBust: true,
        });

        if (type === 'banners') {
          navigation.navigate('SellerPromoBanners', {
            storeId: store?.id,
            autoOpenModal: true,
            autoImageUri: uri,
            autoProductId: topProduct?.id,
            autoTitle: selectedSocialText?.title || 'Nouvelle Promotion',
            autoSubtitle: topProduct?.name || ''
          });
          return;
        }

        const a = document.createElement('a');
        a.href = uri;
        a.download = `libreshop-${type}-${store?.slug || 'promo'}.png`;
        a.click();

        displayToast('Image téléchargée avec succès !', 'success');
      } else {
        uri = await captureRef(targetRef, {
          format: 'png',
          quality: 1,
        });

        if (type === 'banners') {
          navigation.navigate('SellerPromoBanners', {
            storeId: store?.id,
            autoOpenModal: true,
            autoImageUri: uri,
            autoProductId: topProduct?.id,
            autoTitle: selectedSocialText?.title || 'Nouvelle Promotion',
            autoSubtitle: topProduct?.name || ''
          });
          return;
        }

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Partager LibreShop',
          });
        } else {
          displayToast('Le partage n\'est pas disponible sur cet appareil', 'error');
        }
      }
    } catch (error) {
      console.error('Erreur génération image:', error);
      displayToast('Erreur lors de la génération', 'error');
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  };

  const topProduct = products.length > 0 ? products[selectedProductIdx] || products[0] : null;
  const selectedSocialText = selectedTextIdx !== null ? socialTexts[selectedTextIdx] : null;

  return (
    <View style={[styles.container, { backgroundColor: COLORS.bg, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: COLORS.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('SellerTabs');
          }
        }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>Centre Marketing</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Banner Calendrier Marketing */}
        <View style={[styles.section, { marginBottom: SPACING.xl }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: 8 }}>
            <Ionicons name="calendar" size={20} color={COLORS.primary} />
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Calendrier Gabon {new Date().getFullYear()}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.md }}>
            {upcomingEvents.map((event, index) => (
              <LinearGradient
                key={index}
                colors={[event.color, event.color + 'BB']}
                style={styles.eventCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.eventCardContent}>
                  <Text style={styles.eventDate}>{event.emoji} {event.dateLabel}</Text>
                  <Text style={styles.eventName}>{event.name}</Text>
                  <TouchableOpacity
                    style={styles.eventBtn}
                    onPress={() => navigation.navigate('SellerPromoBanners' as never)}
                  >
                    <Text style={styles.eventBtnText}>Préparer 🚀</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            ))}
          </ScrollView>
        </View>

        {/* Sélecteur de Produit */}
        {products.length > 1 && (
          <View style={[styles.section, { marginBottom: SPACING.xl }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: 8 }}>
              <Ionicons name="cube-outline" size={18} color={COLORS.primary} />
              <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Produit mis en avant</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {products.map((p, i) => (
                <TouchableOpacity
                  key={p.id || i}
                  onPress={() => setSelectedProductIdx(i)}
                  style={[
                    styles.productChip,
                    {
                      borderColor: i === selectedProductIdx ? COLORS.primary : COLORS.border,
                      backgroundColor: i === selectedProductIdx ? COLORS.primary + '15' : COLORS.card
                    }
                  ]}
                >
                  {p.images?.[0] ? (
                    <Image source={{ uri: p.images[0] }} style={{ width: 32, height: 32, borderRadius: 8 }} />
                  ) : (
                    <Ionicons name="image-outline" size={24} color={COLORS.textMuted} />
                  )}
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: i === selectedProductIdx ? COLORS.primary : COLORS.text }} numberOfLines={1}>{p.name}</Text>
                    <Text style={{ fontSize: 11, color: COLORS.textMuted }}>{p.price} FCFA</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Création Rapide */}
        <View style={[styles.section, { marginBottom: SPACING.xl }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text, marginBottom: SPACING.md }]}>Création Rapide</Text>
          <View style={styles.gridContainer}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.actionCard, { backgroundColor: COLORS.card, borderColor: COLORS.border, opacity: isGenerating ? 0.6 : 1 }]}
                onPress={() => handleAction(action.type)}
                activeOpacity={0.8}
                disabled={isGenerating}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: action.color + '15' }]}>
                  {generatingType === action.type ? (
                    <ActivityIndicator color={action.color} size="small" />
                  ) : (
                    <Ionicons name={action.icon as any} size={28} color={action.color} />
                  )}
                </View>
                <Text style={[styles.actionTitle, { color: COLORS.text }]}>{action.title}</Text>
                <Text style={[styles.actionSubtitle, { color: COLORS.textMuted }]}>{action.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Textes Magiques */}
        <View style={[styles.section, { marginBottom: SPACING.xl }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: 8 }}>
            <Ionicons name="sparkles" size={20} color={COLORS.warning} />
            <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Textes prêts à l'emploi</Text>
          </View>

          <Text style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: SPACING.md }}>
            💡 Sélectionnez un texte pour l'inclure dans votre affiche
          </Text>
          {socialTexts.map((text, index) => {
            const isSelected = selectedTextIdx === index;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.textCard, {
                  backgroundColor: isSelected ? COLORS.primary + '10' : COLORS.card,
                  borderColor: isSelected ? COLORS.primary : COLORS.border,
                  borderWidth: isSelected ? 2 : 1,
                }]}
                onPress={() => setSelectedTextIdx(isSelected ? null : index)}
                activeOpacity={0.8}
              >
                <View style={styles.textCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />}
                    <Text style={[styles.textCardTitle, { color: isSelected ? COLORS.primary : COLORS.text }]}>{text.title}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.copyBtn, { backgroundColor: COLORS.primary + '15' }]}
                    onPress={() => handleCopyText(text.template)}
                  >
                    <Ionicons name="copy-outline" size={16} color={COLORS.primary} />
                    <Text style={[styles.copyBtnText, { color: COLORS.primary }]}>Copier</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.textContent, { color: COLORS.textMuted }]}>
                  {resolveText(text.template).replace('{UrlBoutique}', '...')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

      </ScrollView>

      {/* Composant Invisible pour la Story (Hors de l'écran) */}
      <View style={{ position: 'absolute', top: -10000, left: -10000 }}>
        <View
          ref={storyRef}
          style={{
            width: 1080,
            height: 1920,
            backgroundColor: COLORS.accent,
            padding: 8,
            borderRadius: 8,
            marginBottom: 16,
          }}>
          <LinearGradient
            colors={[COLORS.accent, COLORS.bg]}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Header de la Story */}
          <View style={{ padding: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            {store?.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={{ width: 150, height: 150, borderRadius: 75, marginRight: 40 }} />
            ) : null}
            <Text style={{ fontSize: 72, fontWeight: '900', color: '#FFF' }}>{store?.name || 'Boutique'}</Text>
          </View>

          {/* Contenu Produit */}
          {topProduct && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 80 }}>
              <View style={{ width: 800, height: 800, backgroundColor: '#FFF', borderRadius: 40, padding: 20, elevation: 10 }}>
                {topProduct.images && topProduct.images[0] ? (
                  <Image source={{ uri: topProduct.images[0] }} style={{ width: '100%', height: '100%', borderRadius: 30 }} resizeMode="cover" />
                ) : (
                  <View style={{ width: '100%', height: '100%', backgroundColor: '#f3f4f6', borderRadius: 30, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="image-outline" size={200} color="#9ca3af" />
                  </View>
                )}
              </View>

              <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 60, paddingVertical: 40, borderRadius: 60, marginTop: -60, elevation: 15, alignItems: 'center' }}>
                <Text style={{ fontSize: 54, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 20 }}>{topProduct.name}</Text>
                <Text style={{ fontSize: 64, fontWeight: '900', color: COLORS.accent }}>{topProduct.price} FCFA</Text>
              </View>
            </View>
          )}

          {/* Footer Call To Action */}
          <View style={{ padding: 80, alignItems: 'center', marginBottom: 40 }}>
            <View style={{ backgroundColor: COLORS.accent, paddingHorizontal: 80, paddingVertical: 40, borderRadius: 100 }}>
              <Text style={{ fontSize: 48, fontWeight: '900', color: '#FFF' }}>
                {selectedSocialText ? selectedSocialText.title.toUpperCase() : 'COMMANDER MAINTENANT'}
              </Text>
            </View>
            {selectedSocialText && (
              <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', marginTop: 30, paddingHorizontal: 60, paddingVertical: 30, borderRadius: 40 }}>
                <Text style={{ fontSize: 28, color: '#FFF', textAlign: 'center', lineHeight: 40 }}>
                  {resolveText(selectedSocialText.template).replace(`https://libreshop.shop/store/${store?.slug || 'notre-boutique'}`, '').trim()}
                </Text>
              </View>
            )}
            <Text style={{ fontSize: 36, fontWeight: '600', color: '#FFF', marginTop: 40 }}>
              libreshop.shop/{store?.slug || ''}
            </Text>
          </View>
        </View>

        {/* Composant Invisible pour l'Affiche WhatsApp (Format Carré 1:1) */}
        <View
          ref={posterRef}
          style={{
            width: 1080,
            height: 1080,
            backgroundColor: '#FFF',
            overflow: 'hidden'
          }}
        >
          {/* Header de l'affiche */}
          <View style={{ paddingHorizontal: 60, paddingTop: 60, paddingBottom: 40, flexDirection: 'row', alignItems: 'center' }}>
            {store?.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={{ width: 120, height: 120, borderRadius: 60, marginRight: 30 }} />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 48, fontWeight: '900', color: '#111827' }}>{store?.name || 'Boutique'}</Text>
              <Text style={{ fontSize: 28, fontWeight: '600', color: COLORS.accent }}>
                {selectedSocialText ? selectedSocialText.title : 'Nouveau Produit Disponible'}
              </Text>
            </View>
          </View>

          {/* Contenu Produit */}
          {topProduct && (
            <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: 60, paddingBottom: 60, alignItems: 'center' }}>
              <View style={{ width: 500, height: 500, backgroundColor: '#f3f4f6', borderRadius: 40, overflow: 'hidden', elevation: 5 }}>
                {topProduct.images && topProduct.images[0] ? (
                  <Image source={{ uri: topProduct.images[0] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="image-outline" size={150} color="#9ca3af" />
                  </View>
                )}
              </View>

              <View style={{ flex: 1, marginLeft: 60 }}>
                <Text style={{ fontSize: 64, fontWeight: '800', color: '#111827', marginBottom: 20 }}>{topProduct.name}</Text>
                <Text style={{ fontSize: 72, fontWeight: '900', color: COLORS.accent, marginBottom: 40 }}>{topProduct.price} FCFA</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', padding: 20, borderRadius: 20 }}>
                  <Ionicons name="cart" size={40} color={COLORS.accent} style={{ marginRight: 20 }} />
                  <Text style={{ fontSize: 28, fontWeight: '700', color: '#4b5563' }}>Achetez sur libreshop.shop/{store?.slug || ''}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Composant Invisible pour l'Affiche Boutique (Format Carré 1:1) */}
        <View
          ref={storePosterRef}
          style={{
            width: 1080,
            height: 1080,
            backgroundColor: COLORS.accent,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <LinearGradient
            colors={[COLORS.accent, COLORS.bg]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={{ padding: 60, alignItems: 'center' }}>
            {store?.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={{ width: 250, height: 250, borderRadius: 125, marginBottom: 40, borderWidth: 8, borderColor: '#FFF' }} />
            ) : null}
            <Text style={{ fontSize: 72, fontWeight: '900', color: '#FFF', textAlign: 'center', marginBottom: 20 }}>
              {store?.name || 'Votre Boutique'}
            </Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 40, paddingVertical: 20, borderRadius: 100, marginBottom: 60 }}>
              <Text style={{ fontSize: 36, fontWeight: '800', color: '#FFF' }}>EST MAINTENANT DISPONIBLE SUR</Text>
            </View>
            <Text style={{ fontSize: 54, fontWeight: '900', color: '#FFF', marginBottom: 60 }}>
              libreshop.shop/{store?.slug || ''}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 30, borderRadius: 40, elevation: 20 }}>
              <View style={{ borderWidth: 4, borderColor: COLORS.border, borderRadius: 20, overflow: 'hidden', padding: 10, marginRight: 40 }}>
                <Image
                  source={{ uri: qrCodeService.getQrImageUrl(qrCodeService.getStoreUrl(store?.slug || ''), 250) }}
                  style={{ width: 250, height: 250 }}
                />
              </View>
              <View style={{ maxWidth: 400 }}>
                <Text style={{ fontSize: 40, fontWeight: '800', color: '#111827', marginBottom: 15 }}>Scannez ce code</Text>
                <Text style={{ fontSize: 26, color: '#4b5563', lineHeight: 36 }}>Découvrez tous nos articles et commandez directement en ligne !</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Composant Invisible pour la Bannière Promo (Format Paysage 1080x540) */}
        <View
          ref={bannerRef}
          style={{
            width: 1080,
            height: 540,
            backgroundColor: COLORS.accent,
            overflow: 'hidden',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 60
          }}
        >
          <LinearGradient
            colors={[COLORS.accent, COLORS.bg]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={{ flex: 1, height: '100%', justifyContent: 'center' }}>
            {store?.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={{ width: 200, height: 200, borderRadius: 100, borderWidth: 8, borderColor: '#FFF' }} />
            ) : (
              <View style={{ width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.2)' }} />
            )}
          </View>
          {topProduct?.images?.[0] && (
            <View style={{ width: 440, height: 440, borderRadius: 30, overflow: 'hidden', borderWidth: 8, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: '#FFF' }}>
              <Image source={{ uri: topProduct.images[0] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </View>
          )}
        </View>

        {/* Composant Invisible pour le Flyer QR Code */}
        <View
          ref={qrRef}
          style={{
            width: 1080,
            height: 1080,
            backgroundColor: COLORS.accent,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <LinearGradient
            colors={[COLORS.accent, COLORS.bg]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={{ width: 850, height: 850, backgroundColor: '#FFF', borderRadius: 60, alignItems: 'center', justifyContent: 'center', padding: 60, elevation: 20 }}>
            {store?.logo_url && (
              <Image source={{ uri: store.logo_url }} style={{ width: 150, height: 150, borderRadius: 75, marginBottom: 40 }} />
            )}
            <Text style={{ fontSize: 56, fontWeight: '900', color: '#111827', textAlign: 'center', marginBottom: 10 }}>{store?.name || 'Notre Boutique'}</Text>
            <Text style={{ fontSize: 32, fontWeight: '600', color: '#6b7280', textAlign: 'center', marginBottom: 50 }}>Scannez ce QR Code pour voir nos offres !</Text>

            <View style={{ borderWidth: 4, borderColor: COLORS.border, borderRadius: 40, overflow: 'hidden', padding: 20 }}>
              <Image
                source={{ uri: qrCodeService.getQrImageUrl(qrCodeService.getStoreUrl(store?.slug || ''), 400) }}
                style={{ width: 400, height: 400 }}
              />
            </View>

            <Text style={{ fontSize: 36, fontWeight: '800', color: COLORS.accent, marginTop: 50 }}>libreshop.shop/{store?.slug || ''}</Text>
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
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  section: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  eventCard: {
    width: 220,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
    })
  },
  eventCardContent: {
    flex: 1,
  },
  eventDate: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  eventName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  eventBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  eventBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  productChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    maxWidth: 180,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }
    })
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
  },
  textCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  textCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  textCardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  textContent: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  }
});
