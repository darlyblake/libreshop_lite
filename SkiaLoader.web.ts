import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

const CANVASKIT_VERSION = '0.41.0';

let initPromise: Promise<void> | null = null;
let wasmBlobUrl: string | null = null;

export async function initSkiaWeb(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // 1. Try to fetch and blobify WASM to bypass server MIME issues
    if (!wasmBlobUrl) {
      const sources = [
        { url: '/canvaskit.wasm', name: 'local root' },
        { url: `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${CANVASKIT_VERSION}/bin/full/canvaskit.wasm`, name: 'jsDelivr' },
        { url: `https://unpkg.com/canvaskit-wasm@${CANVASKIT_VERSION}/bin/full/canvaskit.wasm`, name: 'unpkg' }
      ];

      for (const source of sources) {
        try {
          console.log(`[SkiaLoader] Attempting to fetch WASM from: ${source.name}...`);
          const res = await fetch(source.url, { mode: 'cors' });
          if (res.ok) {
            const buffer = await res.arrayBuffer();
            if (buffer.byteLength < 1000) {
              console.warn(`[SkiaLoader] WASM from ${source.name} seems too small (${buffer.byteLength} bytes), likely an error page.`);
              continue;
            }
            const blob = new Blob([buffer], { type: 'application/wasm' });
            wasmBlobUrl = URL.createObjectURL(blob);
            console.log(`[SkiaLoader] Successfully blobified WASM from ${source.name}`);
            break;
          }
        } catch (e) {
          console.warn(`[SkiaLoader] Failed to fetch from ${source.name}:`, e);
        }
      }
    }

    if (!wasmBlobUrl) {
      console.error('[SkiaLoader] No valid WASM source found.');
      throw new Error('Skia WASM loading failed: No valid source.');
    }

    try {
      console.log('[SkiaLoader] Initializing LoadSkiaWeb with Blob URL...');
      await LoadSkiaWeb({ 
        locateFile: () => wasmBlobUrl! 
      });
      console.log('[SkiaLoader] Skia Web initialized successfully.');
    } catch (err: any) {
      // The 'Infinity' error often happens if the WASM is loaded but fails to initialize a context
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[SkiaLoader] CRITICAL: Failed to load Skia Web:', errorMsg, err?.stack || '');
      
      // Retry once with a direct CDN URL if Blob failed
      if (errorMsg === 'Infinity') {
        try {
          console.log('[SkiaLoader] Retrying with direct jsDelivr URL due to Infinity error...');
          await LoadSkiaWeb({ 
            locateFile: () => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${CANVASKIT_VERSION}/bin/full/canvaskit.wasm` 
          });
          console.log('[SkiaLoader] Skia Web initialized successfully on retry.');
        } catch (retryErr: any) {
          initPromise = null;
          throw retryErr;
        }
      } else {
        initPromise = null;
        throw err;
      }
    }
  })();

  return initPromise;
}
