import { Platform } from 'react-native';
import { cloudinaryConfig } from '../config/theme';

type UploadResult = {
  secure_url?: string;
  url?: string;
  public_id?: string;
};

const guessMimeType = (uri: string) => {
  const u = uri.toLowerCase();
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
};

export const cloudinaryService = {
  async uploadImage(uri: string, opts?: { folder?: string }): Promise<string> {
    const cloudName = cloudinaryConfig?.cloudName;
    const uploadPreset = cloudinaryConfig?.uploadPreset;

    if (!cloudName || cloudName === 'YOUR_CLOUD_NAME') {
      throw new Error('Cloudinary cloudName not configured');
    }
    if (!uploadPreset) {
      throw new Error('Cloudinary uploadPreset not configured');
    }

    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    const formData = new FormData();
    formData.append('upload_preset', uploadPreset);
    if (opts?.folder) {
      formData.append('folder', opts.folder);
    }

    if (Platform.OS === 'web') {
      const blob = await fetch(uri).then((r) => r.blob());
      formData.append('file', blob);
    } else {
      const name = uri.split('/').pop() || `image_${Date.now()}.jpg`;
      formData.append('file', {
        uri,
        name,
        type: guessMimeType(uri),
      } as any);
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData as any,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudinary upload failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as UploadResult;
    const url = data.secure_url || data.url;
    if (!url) {
      throw new Error('Cloudinary response missing secure_url');
    }
    return url;
  },
};
