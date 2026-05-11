import React from 'react';
import { TouchableOpacity, Alert, Platform, Share, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

interface ShareButtonProps {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  price?: string;
  type?: 'product' | 'store';
  style?: any;
}

interface ShareOptions {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  price?: string;
  type?: 'product' | 'store';
}

// Function for programmatic sharing
export const shareContent = async (options: ShareOptions) => {
  const { title, description, url, price, type = 'product' } = options;
  
  try {
    // Générer l'URL web pour le partage (pour les aperçus riches sur WhatsApp/Facebook)
    const webUrl = type === 'product' 
      ? `https://libreshop.shop/api/product?id=${url.split('/').pop()}`
      : `https://libreshop.shop/api/store?id=${url.split('/').pop()}`;

    // Créer le message de partage selon le type
    let shareMessage = '';
    
    if (type === 'product') {
      shareMessage = `🛍️ ${title}\n`;
      if (price) shareMessage += `💰 ${price}\n`;
      shareMessage += `📝 ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}\n\n`;
      shareMessage += `🔗 ${webUrl}\n\n`;
      shareMessage += `Découvrez sur LibreShop 🛒`;
    } else {
      shareMessage = `🏪 ${title}\n`;
      shareMessage += `📝 ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}\n\n`;
      shareMessage += `🔗 ${webUrl}\n\n`;
      shareMessage += `Découvrez cette boutique sur LibreShop 🛒`;
    }

    console.log('[shareContent] platform=', Platform.OS, 'navigator.share=', typeof navigator !== 'undefined' && !!(navigator as any).share, 'imageUrl=', options.imageUrl, 'webUrl=', webUrl);
    if (Platform.OS === 'web') {
      // Sur web: ouvrir le native share sheet via Web Share API quand elle est supportée.
      // Important: ne pas faire de copier-coller au lieu du share sheet.
      // Certains environnements (WebView/PWA) peuvent exposer navigator.share mais
      // avec des contraintes de sécurité; on tente quand même.
      const canUseWebShare =
        typeof navigator !== 'undefined' &&
        typeof (navigator as any).share === 'function' &&
        // canShare est optionnel
        (typeof (navigator as any).canShare === 'function'
          ? (navigator as any).canShare({ url })
          : true);

      if (canUseWebShare) {
        await navigator.share({
          title,
          text: shareMessage,
          url: webUrl,
        });
      } else {
        // Fallback: copier dans le presse-papiers (si Web Share indisponible)
        try {
          await navigator.clipboard.writeText(webUrl);
          Alert.alert('Lien copié !', 'Le lien a été copié dans votre presse-papiers.');
        } catch {
          // dernier recours: copier le texte complet
          try {
            await navigator.clipboard.writeText(shareMessage);
          } catch (e) {
            Alert.alert('Partager', 'Impossible de partager automatiquement.');
          }
        }
      }
    } else {
      // Sur mobile, utiliser expo-sharing
      try {
        // If there's an image URL, try to download it and share the local file for richer previews
        if (options.imageUrl) {
          try {
            const extMatch = String(options.imageUrl).match(/\.(png|jpg|jpeg)$/i);
            const ext = extMatch ? extMatch[1] : 'jpg';
            const baseDir = (FileSystem as any).Paths?.documentDirectory || '';
            const localPath = `${baseDir}share-${Date.now()}.${ext}`;
            const downloaded = await FileSystem.downloadAsync(options.imageUrl, localPath);
            const fileUri = downloaded?.uri || localPath;
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(fileUri, {
                dialogTitle: `Partager ${type === 'product' ? 'ce produit' : 'cette boutique'}`,
                mimeType: `image/${ext}`,
                UTI: `public.image`,
              });
              // attempt to remove cached file
              try { await FileSystem.deleteAsync(fileUri, { idempotent: true }); } catch (_) {}
              return;
            } else {
              // Fallback to RN Share with message + url
              await Share.share({ message: shareMessage, title, url });
              try { await FileSystem.deleteAsync(fileUri, { idempotent: true }); } catch (_) {}
              return;
            }
          } catch (imgErr) {
            console.warn('Image share failed, falling back to text share', imgErr);
            // continue to fallback below
          }
        }

        // For URL/text sharing prefer React Native Share which reliably opens the native share sheet
        console.log('[shareContent] no image - using Share.share');
        await Share.share({ message: shareMessage, title: title, url: webUrl });
      } catch (err) {
        throw err;
      }
    }
  } catch (error) {
    console.error('Erreur lors du partage:', error);
    Alert.alert('Erreur', 'Impossible de partager pour le moment.');
  }
};

export const ShareButton: React.FC<ShareButtonProps> = ({
  title,
  description,
  url,
  imageUrl,
  price,
  type = 'product',
  style,
}) => {
  const handleShare = async () => {
    await shareContent({ title, description, url, price, type });
  };

  return (
    <TouchableOpacity
      onPress={handleShare}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          backgroundColor: '#8b5cf6',
          gap: 8,
        },
        style,
      ]}
    >
      <Ionicons name="share-outline" size={20} color="white" />
      <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>
        Partager
      </Text>
    </TouchableOpacity>
  );
};
