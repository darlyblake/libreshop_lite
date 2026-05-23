import React from 'react';
import { Image, ImageProps } from 'expo-image';
import { Platform } from 'react-native';

// Use a nice blurhash as the placeholder while images load
const BLURHASH =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[';

// Extend ImageProps if we need to support legacy 'uri' prop passed by old code
type Props = ImageProps & { uri?: string };

const OptimizedImage = (props: Props) => {
  const { source, uri, style, placeholder, ...rest } = props;

  // Resolve source backward compatibility
  const resolvedSource = source || (uri ? { uri } : undefined);

  return (
    <Image
      style={style}
      source={resolvedSource}
      placeholder={placeholder || BLURHASH}
      contentFit="cover"
      transition={300}
      cachePolicy="disk"
      {...rest}
    />
  );
};

// Add static preload method for compatibility
OptimizedImage.preload = async (urls: string[] = []) => {
  try {
    const validUrls = urls.filter(Boolean);
    if (validUrls.length > 0) {
      await Image.prefetch(validUrls);
    }
    return true;
  } catch (e) {
    console.warn('Failed to preload images', e);
    return false;
  }
};

export default OptimizedImage;
