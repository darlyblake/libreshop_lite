import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full';

async function localAvailable(localPath: string, timeout = 2000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    // Try to fetch a small portion and validate it's actually a WASM file.
    const res = await fetch(localPath, { method: 'GET', signal: controller.signal });
    clearTimeout(id);

    if (!res.ok) return false;

    // Check content-type when available
    const ct = res.headers.get('content-type') || '';
    if (ct && ct.indexOf('application/wasm') === -1 && ct.indexOf('application/octet-stream') === -1) {
      // If content-type is not wasm/octet, still read first bytes to be sure
    }

    // Read first 4 bytes to verify the WASM magic header (0x00 0x61 0x73 0x6d)
    try {
      const ab = await res.arrayBuffer();
      if (ab && ab.byteLength >= 4) {
        const dv = new Uint8Array(ab.slice(0, 4));
        if (dv[0] === 0x00 && dv[1] === 0x61 && dv[2] === 0x73 && dv[3] === 0x6d) {
          return true;
        }
      }
    } catch (e) {
      // fallback to false
      return false;
    }

    return false;
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
      const msg = (err && (err.message || err.toString())) || JSON.stringify(err) || String(err);
      console.warn('Failed to load Skia Web from local public/canvaskit/bin/full, falling back...', { error: err, message: msg });
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
      const msg = (err && (err.message || err.toString())) || JSON.stringify(err) || String(err);
      console.warn('Failed to load Skia Web from local root /canvaskit.wasm, falling back...', { error: err, message: msg });
    }
  }

  try {
    await LoadSkiaWeb({
      locateFile: (file: string) => `${CDN_BASE}/${file}`,
    });
    console.log('Skia Web initialized successfully via CDN');
    return;
  } catch (err2) {
    const msg2 = (err2 && (err2.message || err2.toString())) || JSON.stringify(err2) || String(err2);
    console.error('Failed to load Skia Web completely (CDN):', { error: err2, message: msg2 });
  }
}
