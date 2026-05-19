import { Platform } from 'react-native';

/**
 * Service pour le traitement d'image local (IA)
 * Utilise Transformers.js + RMBG-1.4 (U²-Net) en local sans clé API.
 * Repli automatique sur DeepLab Pascal-VOC double-passe si non connecté ou échec.
 */

declare global {
  interface Window {
    tf: any;
    deeplab: any;
    transformers: any;
  }
}

class ImageProcessorService {
  private model: any = null;
  private isInitializing = false;
  private transformersSegmenter: any = null;
  private isInitializingTransformers = false;

  public lastAnalysisReports: Record<string, {
    brightness: number;
    isTooDark: boolean;
    coverage: number;
    isTooSmall: boolean;
    blurScore: number;
    isBlurry: boolean;
  }> = {};

  private async loadScripts(): Promise<void> {
    if (typeof window === 'undefined') return;
    
    const scripts = [
      'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
      'https://cdn.jsdelivr.net/npm/@tensorflow-models/deeplab@0.2.2/dist/deeplab.min.js'
    ];

    for (const src of scripts) {
      await new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
      });
    }
  }

  private async initModel() {
    if (this.model) return;
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise(res => setTimeout(res, 100));
        if (this.model) return;
      }
    }

    this.isInitializing = true;
    try {
      await this.loadScripts();
      console.log('[ImageProcessor] Initializing DeepLab (Pascal)...');
      this.model = await window.deeplab.load({ base: 'pascal', quantizationBytes: 2 });
      console.log('[ImageProcessor] DeepLab ready.');
    } finally {
      this.isInitializing = false;
    }
  }

  private async initTransformersSegmenter() {
    if (this.transformersSegmenter) return;
    if (this.isInitializingTransformers) {
      while (this.isInitializingTransformers) {
        await new Promise(res => setTimeout(res, 100));
        if (this.transformersSegmenter) return;
      }
    }

    this.isInitializingTransformers = true;
    try {
      // Transformers.js est un ES Module - on doit utiliser import() dynamique, PAS une balise <script>
      console.log('[ImageProcessor] Chargement de Transformers.js via import() dynamique ES Module...');
      const { env, pipeline } = await import(
        /* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js'
      ) as any;

      env.allowLocalModels = false;

      console.log('[ImageProcessor] Chargement du modèle RMBG-1.4 (premier usage : ~40Mo, ensuite mis en cache)...');
      this.transformersSegmenter = await pipeline('image-segmentation', 'briaai/RMBG-1.4');
      console.log('[ImageProcessor] Transformers.js + RMBG-1.4 prêt !');
    } finally {
      this.isInitializingTransformers = false;
    }
  }

  /**
   * Supprime l'arrière-plan de manière ultra-qualitative et locale (RMBG-1.4 / U²-Net)
   */
  async removeBackground(imageUri: string): Promise<string> {
    try {
      if (Platform.OS !== 'web') return imageUri;

      // 1. Charger l'image originale
      const originalImg = new Image();
      originalImg.crossOrigin = 'anonymous';
      originalImg.src = imageUri;
      await new Promise((res) => (originalImg.onload = res));

      const origW = originalImg.width;
      const origH = originalImg.height;

      let transparentCanvas = document.createElement('canvas');
      let isRmbgSuccess = false;
      let secondPassModel: any = null;

      // Tentative via Transformers.js + RMBG-1.4 (Qualité Studio Exceptionnelle Locale & Gratuite)
      try {
        console.log('[ImageProcessor] Détourage local via Transformers.js + RMBG-1.4...');
        await this.initTransformersSegmenter();

        // L'API de @xenova/transformers pour image-segmentation retourne un tableau de {label, score, mask}
        // 'mask' est un objet RawImage avec .width, .height, .data (Uint8ClampedArray grayscale)
        const results = await this.transformersSegmenter(imageUri, { threshold: 0.5 });
        
        if (!results || results.length === 0 || !results[0].mask) {
          throw new Error('RMBG-1.4 a retourné un masque vide');
        }

        const maskRaw = results[0].mask; // RawImage : { data: Uint8ClampedArray, width, height }

        // Convertir le masque grayscale en canal alpha sur le canvas original
        transparentCanvas.width = origW;
        transparentCanvas.height = origH;
        const transCtx = transparentCanvas.getContext('2d')!;
        transCtx.drawImage(originalImg, 0, 0);

        const origPixels = transCtx.getImageData(0, 0, origW, origH);
        const mW = maskRaw.width;
        const mH = maskRaw.height;

        for (let y = 0; y < origH; y++) {
          for (let x = 0; x < origW; x++) {
            // Interpolation bilinéaire simple du masque vers la résolution originale
            const mx = Math.round((x / origW) * mW);
            const my = Math.round((y / origH) * mH);
            const maskValue = maskRaw.data[my * mW + mx]; // valeur 0-255 (blanc = objet, noir = fond)
            origPixels.data[(y * origW + x) * 4 + 3] = maskValue;
          }
        }
        transCtx.putImageData(origPixels, 0, 0);

        isRmbgSuccess = true;
        console.log('[ImageProcessor] Détourage RMBG-1.4 local réussi avec succès !');
      } catch (rmbgErr) {
        console.warn('[ImageProcessor] Échec de Transformers.js + RMBG-1.4, repli local DeepLab:', rmbgErr);
      }

      let cropW = origW;
      let cropH = origH;
      let fineMinX = 0;
      let fineMaxX = origW;
      let fineMinY = 0;
      let fineMaxY = origH;
      let fineHasObject = true;

      // Repli local hors-ligne / sans clé (DeepLab double-passe)
      if (!isRmbgSuccess) {
        await this.initModel();

        // PASSE 1 : Détection et localisation d'objet (Object Detection)
        console.log('[ImageProcessor] Passe 1 : Détection d\'objet locale...');
        const firstPass = await this.model.segment(originalImg);
        
        let minX = firstPass.width;
        let maxX = 0;
        let minY = firstPass.height;
        let maxY = 0;
        let hasObject = false;

        for (let y = 0; y < firstPass.height; y++) {
          for (let x = 0; x < firstPass.width; x++) {
            const idx = (y * firstPass.width + x) * 4;
            const r = firstPass.segmentationMap[idx];
            const g = firstPass.segmentationMap[idx + 1];
            const b = firstPass.segmentationMap[idx + 2];
            const isObject = (r > 0 || g > 0 || b > 0);
            
            if (isObject) {
              hasObject = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        let croppedImg: HTMLImageElement | HTMLCanvasElement = originalImg;
        let cropX = 0;
        let cropY = 0;

        if (hasObject) {
          const origMinX = Math.max(0, Math.floor((minX / firstPass.width) * origW));
          const origMaxX = Math.min(origW, Math.ceil((maxX / firstPass.width) * origW));
          const origMinY = Math.max(0, Math.floor((minY / firstPass.height) * origH));
          const origMaxY = Math.min(origH, Math.ceil((maxY / firstPass.height) * origH));

          cropW = origMaxX - origMinX;
          cropH = origMaxY - origMinY;

          if (cropW > 10 && cropH > 10) {
            cropX = origMinX;
            cropY = origMinY;

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = cropW;
            cropCanvas.height = cropH;
            const cropCtx = cropCanvas.getContext('2d')!;
            cropCtx.drawImage(originalImg, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            
            const cropImg = new Image();
            cropImg.src = cropCanvas.toDataURL();
            await new Promise(res => cropImg.onload = res);
            croppedImg = cropImg;
          }
        }

        // PASSE 2 : Détourage local
        console.log('[ImageProcessor] Passe 2 : Détourage local...');
        const secondPass = await this.model.segment(croppedImg);
        secondPassModel = secondPass;
        const width = secondPass.width;
        const height = secondPass.height;

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d')!;
        const maskData = maskCtx.createImageData(width, height);

        fineMinX = width;
        fineMaxX = 0;
        fineMinY = height;
        fineMaxY = 0;
        fineHasObject = false;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = secondPass.segmentationMap[idx];
            const g = secondPass.segmentationMap[idx + 1];
            const b = secondPass.segmentationMap[idx + 2];
            
            const isObject = (r > 0 || g > 0 || b > 0);
            const alpha = isObject ? 255 : 0;
            
            if (isObject) {
              fineHasObject = true;
              if (x < fineMinX) fineMinX = x;
              if (x > fineMaxX) fineMaxX = x;
              if (y < fineMinY) fineMinY = y;
              if (y > fineMaxY) fineMaxY = y;
            }

            const i = y * width + x;
            maskData.data[i * 4] = 255;
            maskData.data[i * 4 + 1] = 255;
            maskData.data[i * 4 + 2] = 255;
            maskData.data[i * 4 + 3] = alpha;
          }
        }
        maskCtx.putImageData(maskData, 0, 0);

        transparentCanvas.width = cropW;
        transparentCanvas.height = cropH;
        const transCtx = transparentCanvas.getContext('2d')!;
        transCtx.drawImage(croppedImg, 0, 0);

        transCtx.globalCompositeOperation = 'destination-in';
        transCtx.drawImage(maskCanvas, 0, 0, width, height, 0, 0, cropW, cropH);
      } else {
        // Analyse de la Bounding Box du produit détouré par RMBG-1.4
        const transCtx = transparentCanvas.getContext('2d')!;
        const imgData = transCtx.getImageData(0, 0, origW, origH);
        
        let minX = origW;
        let maxX = 0;
        let minY = origH;
        let maxY = 0;
        let hasObj = false;

        for (let y = 0; y < origH; y++) {
          for (let x = 0; x < origW; x++) {
            const alpha = imgData.data[(y * origW + x) * 4 + 3];
            if (alpha > 30) {
              hasObj = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (hasObj) {
          fineMinX = minX;
          fineMaxX = maxX;
          fineMinY = minY;
          fineMaxY = maxY;
          fineHasObject = true;
          cropW = origW;
          cropH = origH;
        } else {
          fineHasObject = false;
        }
      }

      // Cadrage final parfait à 85% de la surface du canvas carré
      const finalCanvas = document.createElement('canvas');
      const canvasSize = Math.max(origW, origH);
      finalCanvas.width = canvasSize;
      finalCanvas.height = canvasSize;
      const finalCtx = finalCanvas.getContext('2d')!;

      finalCtx.fillStyle = '#ffffff';
      finalCtx.fillRect(0, 0, canvasSize, canvasSize);

      if (fineHasObject) {
        const srcMinX = isRmbgSuccess ? fineMinX : Math.max(0, Math.floor((fineMinX / secondPassModel.width) * cropW));
        const srcMaxX = isRmbgSuccess ? fineMaxX : Math.min(cropW, Math.ceil((fineMaxX / secondPassModel.width) * cropW));
        const srcMinY = isRmbgSuccess ? fineMinY : Math.max(0, Math.floor((fineMinY / secondPassModel.height) * cropH));
        const srcMaxY = isRmbgSuccess ? fineMaxY : Math.min(cropH, Math.ceil((fineMaxY / secondPassModel.height) * cropH));

        const bboxW = srcMaxX - srcMinX;
        const bboxH = srcMaxY - srcMinY;

        if (bboxW > 0 && bboxH > 0) {
          const targetSize = canvasSize * 0.85;
          const scale = Math.min(targetSize / bboxW, targetSize / bboxH);

          const sw = bboxW * scale;
          const sh = bboxH * scale;

          const dx = (canvasSize - sw) / 2;
          const dy = (canvasSize - sh) / 2;

          finalCtx.drawImage(
            transparentCanvas,
            srcMinX, srcMinY, bboxW, bboxH,
            dx, dy, sw, sh
          );
        } else {
          finalCtx.drawImage(transparentCanvas, 0, 0, cropW, cropH, 0, 0, canvasSize, canvasSize);
        }
      } else {
        finalCtx.drawImage(transparentCanvas, 0, 0, cropW, cropH, 0, 0, canvasSize, canvasSize);
      }

      // Analyse de la qualité d'image (Luminosité, flou et couverture) sur version réduite (Ultra Rapide)
      const analysisW = 150;
      const analysisH = 150;
      const analysisCanvas = document.createElement('canvas');
      analysisCanvas.width = analysisW;
      analysisCanvas.height = analysisH;
      const analysisCtx = analysisCanvas.getContext('2d')!;
      analysisCtx.drawImage(transparentCanvas, 0, 0, cropW, cropH, 0, 0, analysisW, analysisH);

      const imgData = analysisCtx.getImageData(0, 0, analysisW, analysisH);
      let totalBrightness = 0;
      let activePixels = 0;
      for (let j = 0; j < imgData.data.length; j += 4) {
        const r = imgData.data[j];
        const g = imgData.data[j+1];
        const b = imgData.data[j+2];
        const a = imgData.data[j+3];
        if (a > 50) {
          totalBrightness += (r * 0.299 + g * 0.587 + b * 0.114);
          activePixels++;
        }
      }

      const avgBrightness = activePixels > 0 ? totalBrightness / activePixels : 128;
      const isTooDark = avgBrightness < 50;

      const coverage = activePixels / (analysisW * analysisH);
      const isTooSmall = coverage < 0.08;

      let contrastSum = 0;
      let samplesCount = 0;
      for (let y = 5; y < analysisH - 5; y += 4) {
        for (let x = 5; x < analysisW - 5; x += 4) {
          const idx = (y * analysisW + x) * 4;
          const leftIdx = idx - 4;
          if (imgData.data[idx+3] > 50 && imgData.data[leftIdx+3] > 50) {
            const val = imgData.data[idx];
            const leftVal = imgData.data[leftIdx];
            contrastSum += Math.abs(val - leftVal);
            samplesCount++;
          }
        }
      }
      const blurScore = samplesCount > 0 ? contrastSum / samplesCount : 30;
      const isBlurry = blurScore < 8;

      const resultUri = finalCanvas.toDataURL('image/jpeg', 0.95);
      this.lastAnalysisReports[resultUri] = {
        brightness: Math.round(avgBrightness),
        isTooDark,
        coverage: Math.round(coverage * 100),
        isTooSmall,
        blurScore: Math.round(blurScore),
        isBlurry
      };

      return resultUri;
    } catch (error) {
      console.error('[ImageProcessor] Processing failed:', error);
      throw error;
    }
  }
}

export const imageProcessorService = new ImageProcessorService();
