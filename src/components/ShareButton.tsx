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
    // Créer le message de partage selon le type
    let shareMessage = '';
    
    if (type === 'product') {
      shareMessage = `🛍️ ${title}\n`;
      if (price) shareMessage += `💰 ${price}\n`;
      shareMessage += `📝 ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}\n`;
      shareMessage += `🔗 ${url}\n\n`;
      shareMessage += `Découvrez sur LibreShop 🛒`;
    } else {
      shareMessage = `🏪 ${title}\n`;
      shareMessage += `📝 ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}\n`;
      shareMessage += `🔗 ${url}\n\n`;
      shareMessage += `Découvrez cette boutique sur LibreShop 🛒`;
    }

    if (Platform.OS === 'web') {
      // Sur web, utiliser l'API Web Share si disponible, sinon copier dans le presse-papiers
      if (navigator.share) {
        await navigator.share({
          title: title,
          text: shareMessage,
          url: url,
        });
      } else {
        // Fallback: copier dans le presse-papiers
        await navigator.clipboard.writeText(shareMessage);
        Alert.alert('Lien copié !', 'Le lien a été copié dans votre presse-papiers.');
      }
    } else {
      // Sur mobile, utiliser expo-sharing
      try {
        // If there's an image URL, try to download it and share the local file for richer previews
        if (options.imageUrl) {
          try {
            const extMatch = String(options.imageUrl).match(/\.(png|jpg|jpeg)$/i);
            const ext = extMatch ? extMatch[1] : 'jpg';
            const localPath = `${FileSystem.cacheDirectory}share-${Date.now()}.${ext}`;
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

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(url, {
            dialogTitle: `Partager ${type === 'product' ? 'ce produit' : 'cette boutique'}`,
            subject: title,
            message: shareMessage,
          });
        } else {
          // Fallback: utiliser React Native Share
          await Share.share({ message: shareMessage, title: title, url: url });
        }
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
