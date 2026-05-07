import React from 'react';
import { Image, ImageProps, Platform } from 'react-native';

type Props = ImageProps & { uri?: string };

let FastImage: any = null;
try {
  if (Platform.OS !== 'web') {
    // try to require fast-image if installed
    // Use concatenation to avoid static bundler resolution warnings when the
    // native module isn't installed for web builds.
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    try {
      // Use eval('require') to avoid static analysis by webpack or other bundlers.
      // This prevents build-time resolution errors when `react-native-fast-image`
      // is not installed for web builds.
      // eslint-disable-next-line no-eval, @typescript-eslint/no-explicit-any
      const req: any = eval('require');
      FastImage = req('react-native-fast-image');
    } catch (e) {
      FastImage = null;
    }
  }
} catch (e) {
  FastImage = null;
}

const OptimizedImage: React.FC<Props> = (props) => {
  const { source, uri, ...rest } = props as any;

  if (FastImage && Platform.OS !== 'web') {
    const src = source || (uri ? { uri } : undefined);
    return <FastImage.default source={src} {...rest} />;
  }

  // Fallback to RN Image (works on web and native if fast-image not installed)
  const imgSrc = source || (uri ? { uri } : undefined);
  return <Image source={imgSrc} {...rest} />;
};

// expose preload if FastImage is available
OptimizedImage['preload'] = async (urls: string[] = []) => {
  if (FastImage && FastImage.preload && Platform.OS !== 'web') {
    try {
      const items = urls.filter(Boolean).map((u) => ({ uri: u }));
      FastImage.preload(items);
      return Promise.resolve(true);
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  // Fallback to Image.prefetch for web/native
  try {
    await Promise.all(urls.map((u) => Image.prefetch(u)));
    return true;
  } catch (e) {
    return false;
  }
};

export default OptimizedImage;
