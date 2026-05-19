import { Platform } from 'react-native';

/**
 * Service pour le traitement d'image local (IA)
 * Utilise TensorFlow.js avec le modèle DeepLab pour la segmentation d'objets.
 * Fixe : Correction de la résolution et compatibilité Webpack.
 */

declare global {
  interface Window {
    tf: any;
    deeplab: any;
  }
}

class ImageProcessorService {
  private model: any = null;
  private isInitializing = false;
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
    
    // On utilise des scripts UMD classiques pour une compatibilité maximale avec Webpack/Metro
    const scripts = [
      'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
      'https://cdn.jsdelivr.net/npm/@tensorflow-models/deeplab@0.2.2/dist/deeplab.min.js'
    ];

    for (const src of scripts) {
      await new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const script = document.createElement('script');
        script.src = src;
        script.async = false; // Chargement séquentiel
        script.onload = () => resolve();
        script.onerror = (e) => reject(new Error(`Failed to load script: ${src}`));
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

  /**
   * Supprime l'arrière-plan avec une gestion précise de la résolution
   */
  async removeBackground(imageUri: string): Promise<string> {
    try {
      if (Platform.OS !== 'web') return imageUri;

      await this.initModel();

      // 1. Charger l'image originale
      const originalImg = new Image();
      originalImg.crossOrigin = 'anonymous';
      originalImg.src = imageUri;
      await new Promise((res) => (originalImg.onload = res));

      const origW = originalImg.width;
      const origH = originalImg.height;

      // 2. Prédiction avec DeepLab
      // DeepLab gère le redimensionnement interne
      console.log('[ImageProcessor] Predicting...');
      const { segmentationMap, width, height } = await this.model.segment(originalImg);
      
      // 'width' et 'height' sont les dimensions de la carte de segmentation (souvent 513x513)
      console.log(`[ImageProcessor] Segmentation map size: ${width}x${height}`);

      // 3. Créer un canvas pour la CARTE DE SEGMENTATION (masque)
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = width;
      maskCanvas.height = height;
      const maskCtx = maskCanvas.getContext('2d')!;
      const maskData = maskCtx.createImageData(width, height);

      let minX = width;
      let maxX = 0;
      let minY = height;
      let maxY = 0;
      let hasObject = false;

      // On crée un masque opaque pour l'objet, transparent pour le fond
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          const classIndex = segmentationMap[i];
          const alpha = classIndex === 0 ? 0 : 255; // 0 = Background
          
          if (classIndex !== 0) {
            hasObject = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }

          maskData.data[i * 4] = 255;     // R
          maskData.data[i * 4 + 1] = 255; // G
          maskData.data[i * 4 + 2] = 255; // B
          maskData.data[i * 4 + 3] = alpha; // A
        }
      }
      maskCtx.putImageData(maskData, 0, 0);

      // 4. Créer un canvas temporaire pour obtenir l'objet détouré transparent
      const transparentCanvas = document.createElement('canvas');
      transparentCanvas.width = origW;
      transparentCanvas.height = origH;
      const transCtx = transparentCanvas.getContext('2d')!;

      // Dessiner l'image originale
      transCtx.drawImage(originalImg, 0, 0);

      // Appliquer le masque
      transCtx.globalCompositeOperation = 'destination-in';
      transCtx.drawImage(maskCanvas, 0, 0, width, height, 0, 0, origW, origH);

      // 5. Calculer le recadrage & l'alignement à 85% de la surface
      let finalCanvas = document.createElement('canvas');
      const canvasSize = Math.max(origW, origH);
      finalCanvas.width = canvasSize;
      finalCanvas.height = canvasSize;
      const finalCtx = finalCanvas.getContext('2d')!;

      // Fond blanc studio parfait
      finalCtx.fillStyle = '#ffffff';
      finalCtx.fillRect(0, 0, canvasSize, canvasSize);

      if (hasObject) {
        const origMinX = Math.max(0, Math.floor((minX / width) * origW));
        const origMaxX = Math.min(origW, Math.ceil((maxX / width) * origW));
        const origMinY = Math.max(0, Math.floor((minY / height) * origH));
        const origMaxY = Math.min(origH, Math.ceil((maxY / height) * origH));

        const bboxW = origMaxX - origMinX;
        const bboxH = origMaxY - origMinY;

        if (bboxW > 0 && bboxH > 0) {
          // L'objet doit occuper exactement 85% de la surface finale
          const targetSize = canvasSize * 0.85;
          const scale = Math.min(targetSize / bboxW, targetSize / bboxH);

          const sw = bboxW * scale;
          const sh = bboxH * scale;

          const dx = (canvasSize - sw) / 2;
          const dy = (canvasSize - sh) / 2;

          // Dessiner l'objet détouré recadré et centré au millimètre
          finalCtx.drawImage(
            transparentCanvas,
            origMinX, origMinY, bboxW, bboxH,
            dx, dy, sw, sh
          );
        } else {
          finalCtx.drawImage(transparentCanvas, 0, 0, origW, origH, 0, 0, canvasSize, canvasSize);
        }
      } else {
        finalCtx.drawImage(transparentCanvas, 0, 0, origW, origH, 0, 0, canvasSize, canvasSize);
      }

      // 6. Analyse de la qualité d'image (Luminosité, flou et couverture)
      const imgData = transCtx.getImageData(0, 0, origW, origH);
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

      const coverage = activePixels / (origW * origH);
      const isTooSmall = coverage < 0.08;

      let contrastSum = 0;
      let samplesCount = 0;
      for (let y = 10; y < origH - 10; y += 15) {
        for (let x = 10; x < origW - 10; x += 15) {
          const idx = (y * origW + x) * 4;
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
      console.error('[ImageProcessor] DeepLab failed:', error);
      throw error;
    }
  }
}

export const imageProcessorService = new ImageProcessorService();
