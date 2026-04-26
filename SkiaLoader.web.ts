import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full';

async function localAvailable(localPath: string, timeout = 2000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(localPath, { method: 'HEAD', signal: controller.signal });
    clearTimeout(id);
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function initSkiaWeb(): Promise<void> {
  // Prefer local copy. Check common local paths then fall back to CDN.
  const localRootA = '/canvaskit.wasm';
  const localRootB = '/canvaskit/bin/full/canvaskit.wasm';
  const hasA = await localAvailable(localRootA);
  const hasB = await localAvailable(localRootB);

  if (hasB) {
    try {
      await LoadSkiaWeb({
        locateFile: (file: string) => `/canvaskit/bin/full/${file}`,
      });
      console.log('Skia Web initialized successfully via local public/canvaskit/bin/full');
      return;
    } catch (err) {
      console.warn('Failed to load Skia Web from local public/canvaskit/bin/full, falling back...', err);
    }
  }

  if (hasA) {
    try {
      await LoadSkiaWeb({
        locateFile: (file: string) => `/${file}`,
      });
      console.log('Skia Web initialized successfully via local root /canvaskit.wasm');
      return;
    } catch (err) {
      console.warn('Failed to load Skia Web from local root /canvaskit.wasm, falling back...', err);
    }
  }

  try {
    await LoadSkiaWeb({
      locateFile: (file: string) => `${CDN_BASE}/${file}`,
    });
    console.log('Skia Web initialized successfully via CDN');
    return;
  } catch (err2) {
    console.error('Failed to load Skia Web completely (CDN):', err2);
  }
}
