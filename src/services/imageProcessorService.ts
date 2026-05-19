import { Platform } from 'react-native';

/**
 * Service de traitement d'image avec IA — Transformers.js + RMBG-1.4 (U²-Net)
 * Fonctionne 100% en local dans le navigateur, zéro clé API, zéro coût.
 * Architecture : chargement dynamique (lazy) pour ne pas alourdir le bundle initial.
 */

class ImageProcessorService {
  private segmenter: any = null;
  private isInitializing = false;

  public lastAnalysisReports: Record<string, {
    brightness: number;
    isTooDark: boolean;
    coverage: number;
    isTooSmall: boolean;
    blurScore: number;
    isBlurry: boolean;
  }> = {};

  /**
   * Initialise le pipeline RMBG-1.4 (U²-Net) via @xenova/transformers.
   * Chargement paresseux : déclenché uniquement au premier usage.
   * Le modèle (~40 Mo) est mis en cache automatiquement par le navigateur.
   */
  private async initSegmenter(): Promise<void> {
    if (this.segmenter) return;

    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise(res => setTimeout(res, 100));
        if (this.segmenter) return;
      }
    }

    this.isInitializing = true;
    try {
      console.log('[ImageProcessor] Chargement du pipeline Transformers.js + RMBG-1.4...');

      // Import dynamique avec code-splitting Webpack : le bundle @xenova/transformers
      // est chargé à la demande dans un chunk séparé, sans bloquer le démarrage de l'app.
      const { pipeline, env } = await import(
        /* webpackChunkName: "transformers-rmbg" */
        '@xenova/transformers'
      );

      // Forcer l'exécution locale (WASM / WebGL) — pas de serveur externe
      env.allowLocalModels = false;
      env.backends.onnx.wasm.numThreads = 1;

      console.log('[ImageProcessor] Téléchargement du modèle RMBG-1.4 (mis en cache après le premier usage)...');
      this.segmenter = await pipeline('image-segmentation', 'briaai/RMBG-1.4', {
        device: 'webgpu', // Utilise WebGPU si disponible, repli sur WASM sinon
        dtype: 'fp32',
      });

      console.log('[ImageProcessor] ✅ Transformers.js + RMBG-1.4 prêt !');
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Supprime l'arrière-plan d'une image via RMBG-1.4 (U²-Net).
   * Applique ensuite un fond blanc studio et un cadrage centré à 85%.
   */
  async removeBackground(imageUri: string): Promise<string> {
    if (Platform.OS !== 'web') return imageUri;

    try {
      // 1. Charger l'image originale
      const originalImg = new Image();
      originalImg.crossOrigin = 'anonymous';
      originalImg.src = imageUri;
      await new Promise<void>((res, rej) => {
        originalImg.onload = () => res();
        originalImg.onerror = () => rej(new Error('Impossible de charger l\'image source'));
      });

      const origW = originalImg.width;
      const origH = originalImg.height;

      // 2. Initialiser RMBG-1.4
      await this.initSegmenter();

      // 3. Lancer la segmentation RMBG-1.4
      console.log('[ImageProcessor] Détourage via RMBG-1.4 en cours...');
      const results = await this.segmenter(imageUri, { threshold: 0.5 });

      if (!results || results.length === 0 || !results[0].mask) {
        throw new Error('RMBG-1.4 n\'a retourné aucun masque');
      }

      const maskRaw = results[0].mask; // RawImage : { data: Uint8ClampedArray, width, height }
      const mW = maskRaw.width;
      const mH = maskRaw.height;

      // 4. Appliquer le masque pixel par pixel comme canal alpha sur l'image originale
      const transparentCanvas = document.createElement('canvas');
      transparentCanvas.width = origW;
      transparentCanvas.height = origH;
      const transCtx = transparentCanvas.getContext('2d')!;
      transCtx.drawImage(originalImg, 0, 0);

      const origPixels = transCtx.getImageData(0, 0, origW, origH);
      for (let y = 0; y < origH; y++) {
        for (let x = 0; x < origW; x++) {
          // Interpolation nearest-neighbor du masque vers la résolution d'origine
          const mx = Math.min(mW - 1, Math.round((x / origW) * mW));
          const my = Math.min(mH - 1, Math.round((y / origH) * mH));
          const maskValue = maskRaw.data[my * mW + mx]; // 0-255 : blanc = objet, noir = fond
          origPixels.data[(y * origW + x) * 4 + 3] = maskValue;
        }
      }
      transCtx.putImageData(origPixels, 0, 0);

      // 5. Calculer la boîte englobante (Bounding Box) de l'objet détouré
      let minX = origW, maxX = 0, minY = origH, maxY = 0;
      let hasObject = false;
      for (let y = 0; y < origH; y++) {
        for (let x = 0; x < origW; x++) {
          const alpha = origPixels.data[(y * origW + x) * 4 + 3];
          if (alpha > 30) {
            hasObject = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // 6. Composer le canvas final — fond blanc studio, objet centré à 85%
      const canvasSize = Math.max(origW, origH);
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = canvasSize;
      finalCanvas.height = canvasSize;
      const finalCtx = finalCanvas.getContext('2d')!;

      finalCtx.fillStyle = '#ffffff';
      finalCtx.fillRect(0, 0, canvasSize, canvasSize);

      if (hasObject) {
        const bboxW = maxX - minX;
        const bboxH = maxY - minY;

        if (bboxW > 0 && bboxH > 0) {
          const targetSize = canvasSize * 0.85;
          const scale = Math.min(targetSize / bboxW, targetSize / bboxH);
          const sw = bboxW * scale;
          const sh = bboxH * scale;
          const dx = (canvasSize - sw) / 2;
          const dy = (canvasSize - sh) / 2;

          finalCtx.drawImage(
            transparentCanvas,
            minX, minY, bboxW, bboxH,
            dx, dy, sw, sh
          );
        } else {
          finalCtx.drawImage(transparentCanvas, 0, 0, origW, origH, 0, 0, canvasSize, canvasSize);
        }
      } else {
        finalCtx.drawImage(transparentCanvas, 0, 0, origW, origH, 0, 0, canvasSize, canvasSize);
      }

      console.log('[ImageProcessor] ✅ Détourage RMBG-1.4 réussi !');

      // 7. Analyse de qualité rapide (150×150 pour la performance)
      const analysisW = 150, analysisH = 150;
      const analysisCanvas = document.createElement('canvas');
      analysisCanvas.width = analysisW;
      analysisCanvas.height = analysisH;
      const analysisCtx = analysisCanvas.getContext('2d')!;
      analysisCtx.drawImage(transparentCanvas, 0, 0, origW, origH, 0, 0, analysisW, analysisH);

      const imgData = analysisCtx.getImageData(0, 0, analysisW, analysisH);
      let totalBrightness = 0, activePixels = 0;
      for (let j = 0; j < imgData.data.length; j += 4) {
        if (imgData.data[j + 3] > 50) {
          totalBrightness += imgData.data[j] * 0.299 + imgData.data[j + 1] * 0.587 + imgData.data[j + 2] * 0.114;
          activePixels++;
        }
      }

      const avgBrightness = activePixels > 0 ? totalBrightness / activePixels : 128;
      const coverage = activePixels / (analysisW * analysisH);

      let contrastSum = 0, samplesCount = 0;
      for (let y = 5; y < analysisH - 5; y += 4) {
        for (let x = 5; x < analysisW - 5; x += 4) {
          const idx = (y * analysisW + x) * 4;
          const leftIdx = idx - 4;
          if (imgData.data[idx + 3] > 50 && imgData.data[leftIdx + 3] > 50) {
            contrastSum += Math.abs(imgData.data[idx] - imgData.data[leftIdx]);
            samplesCount++;
          }
        }
      }
      const blurScore = samplesCount > 0 ? contrastSum / samplesCount : 30;

      const resultUri = finalCanvas.toDataURL('image/jpeg', 0.95);
      this.lastAnalysisReports[resultUri] = {
        brightness: Math.round(avgBrightness),
        isTooDark: avgBrightness < 50,
        coverage: Math.round(coverage * 100),
        isTooSmall: coverage < 0.08,
        blurScore: Math.round(blurScore),
        isBlurry: blurScore < 8,
      };

      return resultUri;

    } catch (error) {
      console.error('[ImageProcessor] Erreur lors du traitement RMBG-1.4 :', error);
      throw error;
    }
  }
}

export const imageProcessorService = new ImageProcessorService();
