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
  getOptimizedUrl(url: string, width?: number): string {
    if (!url || !url.includes('res.cloudinary.com')) return url;

    const uploadSegment = '/upload/';
    const uploadIndex = url.indexOf(uploadSegment);
    if (uploadIndex === -1) return url;

    // Everything up to and including '/upload/'
    const base = url.substring(0, uploadIndex + uploadSegment.length);
    const afterUpload = url.substring(uploadIndex + uploadSegment.length);

    // Cloudinary URLs after /upload/ can be:
    //   <version>/<path>              e.g. v123456/folder/file.jpg
    //   <transforms>/<version>/<path> e.g. q_auto,f_auto/v123456/folder/file.jpg
    //   <path>                        e.g. folder/file.jpg (rare, no versioning)
    //
    // Strategy: find the version segment (v followed by digits then slash)
    // which can appear at position 0 (no transforms) or after transforms.
    const versionMatch = afterUpload.match(/(^|\/)v(\d+)\//);
    let assetPath: string;
    if (versionMatch && versionMatch.index !== undefined) {
      // Start asset path from the 'v' character of the version
      const vStart = versionMatch.index + (versionMatch[1] ? 1 : 0);
      assetPath = afterUpload.substring(vStart); // e.g. "v123456/folder/file.jpg"
    } else {
      // No version segment — strip any leading transform block
      assetPath = afterUpload.replace(/^([a-z_,0-9.]+\/)+/, '');
    }

    // Build fresh transforms
    const transforms = ['q_auto', 'f_auto'];
    if (width) transforms.push(`w_${width},c_fill,g_auto`);

    return `${base}${transforms.join(',')}/${assetPath}`;
  },

  async uploadImage(uri: string, opts?: { folder?: string; enhance?: boolean }): Promise<string> {
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
    
    // Note: eager transformations require signed uploads, not allowed with upload_preset
    // Images are optimized on-the-fly using getOptimizedUrl() instead
    if (opts?.enhance) {
      formData.append('tags', 'auto_enhance');
    }

    if (Platform.OS === 'web') {
      try {
        // Handle both blob URLs and regular URLs
        let blob: Blob;
        
        if (uri.startsWith('blob:')) {
          // For blob URLs, we need to fetch them differently
          const response = await fetch(uri);
          if (!response.ok) {
            throw new Error(`Failed to fetch blob: ${response.statusText}`);
          }
          blob = await response.blob();
        } else if (uri.startsWith('data:')) {
          // Handle data URLs
          const arr = uri.split(',');
          const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
          const bstr = atob(arr[1]);
          const n = bstr.length;
          const u8arr = new Uint8Array(n);
          for (let i = 0; i < n; i++) {
            u8arr[i] = bstr.charCodeAt(i);
          }
          blob = new Blob([u8arr], { type: mime });
        } else {
          // Regular URLs
          const response = await fetch(uri);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
          }
          blob = await response.blob();
        }

        formData.append('file', blob, `image_${Date.now()}.jpg`);
      } catch (error) {
        throw new Error(`Failed to process image: ${error instanceof Error ? error.message : String(error)}`);
      }
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
      console.error('[Cloudinary] Error response:', text);
      throw new Error(`Cloudinary upload failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as UploadResult;
    const url = data.secure_url || data.url;
    if (!url) {
      throw new Error('Cloudinary response missing secure_url');
    }
    return cloudinaryService.getOptimizedUrl(url);
  },
};
