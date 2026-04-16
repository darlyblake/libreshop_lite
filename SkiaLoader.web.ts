import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

export async function initSkiaWeb(): Promise<void> {
  try {
    await LoadSkiaWeb({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full/${file}`,
    });
    console.log("Skia Web initialized successfully via CDN");
    return;
  } catch (err) {
    console.warn("Failed to load Skia Web from CDN, trying local root...", err);
  }

  try {
    await LoadSkiaWeb({
      locateFile: (file: string) => `/${file}`,
    });
    console.log("Skia Web initialized successfully via local root");
  } catch (err2) {
    console.error("Failed to load Skia Web completely:", err2);
  }
}
