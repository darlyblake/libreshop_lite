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

      // PASSE 1 : Détection et localisation d'objet (Object Detection)
      console.log('[ImageProcessor] Passe 1 : Détection d\'objet...');
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
          // DeepLab Pascal VOC colors: black [0,0,0] is background, everything else is object
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
      let cropW = origW;
      let cropH = origH;

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
          console.log(`[ImageProcessor] Objet localisé et cadré : ${cropW}x${cropH} à (${cropX}, ${cropY})`);
        }
      }

      // PASSE 2 : Détourage Studio Blanc Ultra-Précis sur l'objet cadré
      console.log('[ImageProcessor] Passe 2 : Détourage ciblé (Studio Blanc)...');
      const secondPass = await this.model.segment(croppedImg);
      const width = secondPass.width;
      const height = secondPass.height;

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = width;
      maskCanvas.height = height;
      const maskCtx = maskCanvas.getContext('2d')!;
      const maskData = maskCtx.createImageData(width, height);

      let fineMinX = width;
      let fineMaxX = 0;
      let fineMinY = height;
      let fineMaxY = 0;
      let fineHasObject = false;

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

      const transparentCanvas = document.createElement('canvas');
      transparentCanvas.width = cropW;
      transparentCanvas.height = cropH;
      const transCtx = transparentCanvas.getContext('2d')!;
      transCtx.drawImage(croppedImg, 0, 0);

      transCtx.globalCompositeOperation = 'destination-in';
      transCtx.drawImage(maskCanvas, 0, 0, width, height, 0, 0, cropW, cropH);

      // Cadrage final parfait à 85% de la surface du canvas carré
      const finalCanvas = document.createElement('canvas');
      const canvasSize = Math.max(origW, origH);
      finalCanvas.width = canvasSize;
      finalCanvas.height = canvasSize;
      const finalCtx = finalCanvas.getContext('2d')!;

      finalCtx.fillStyle = '#ffffff';
      finalCtx.fillRect(0, 0, canvasSize, canvasSize);

      if (fineHasObject) {
        const origMinX = Math.max(0, Math.floor((fineMinX / width) * cropW));
        const origMaxX = Math.min(cropW, Math.ceil((fineMaxX / width) * cropW));
        const origMinY = Math.max(0, Math.floor((fineMinY / height) * cropH));
        const origMaxY = Math.min(cropH, Math.ceil((fineMaxY / height) * cropH));

        const bboxW = origMaxX - origMinX;
        const bboxH = origMaxY - origMinY;

        if (bboxW > 0 && bboxH > 0) {
          const targetSize = canvasSize * 0.85;
          const scale = Math.min(targetSize / bboxW, targetSize / bboxH);

          const sw = bboxW * scale;
          const sh = bboxH * scale;

          const dx = (canvasSize - sw) / 2;
          const dy = (canvasSize - sh) / 2;

          finalCtx.drawImage(
            transparentCanvas,
            origMinX, origMinY, bboxW, bboxH,
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
      console.error('[ImageProcessor] DeepLab failed:', error);
      throw error;
    }
  }
}

export const imageProcessorService = new ImageProcessorService();
