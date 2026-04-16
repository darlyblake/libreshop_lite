export async function initSkiaWeb(): Promise<void> {
  // Native builds do not use the web version of Skia.
  return Promise.resolve();
}
