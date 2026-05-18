import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

const CANVASKIT_VERSION = '0.41.0';

let initPromise: Promise<void> | null = null;
let wasmBlobUrl: string | null = null;

export async function initSkiaWeb(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('[SkiaLoader] Initializing LoadSkiaWeb...');
      await LoadSkiaWeb({ 
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${CANVASKIT_VERSION}/bin/full/${file}`
      });
      console.log('[SkiaLoader] Skia Web initialized successfully.');
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[SkiaLoader] CRITICAL: Failed to load Skia Web:', errorMsg, err?.stack || '');
      
      if (errorMsg === 'Infinity') {
        try {
          console.log('[SkiaLoader] Retrying with unpkg URL due to Infinity error...');
          await LoadSkiaWeb({ 
            locateFile: (file) => `https://unpkg.com/canvaskit-wasm@${CANVASKIT_VERSION}/bin/full/${file}`
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
