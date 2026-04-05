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

      // On crée un masque opaque pour l'objet, transparent pour le fond
      for (let i = 0; i < segmentationMap.length; i++) {
        const classIndex = segmentationMap[i];
        const alpha = classIndex === 0 ? 0 : 255; // 0 = Background dans Pascal VOC
        
        maskData.data[i * 4] = 255;     // R
        maskData.data[i * 4 + 1] = 255; // G
        maskData.data[i * 4 + 2] = 255; // B
        maskData.data[i * 4 + 3] = alpha; // A
      }
      maskCtx.putImageData(maskData, 0, 0);

      // 4. On redimensionne le masque à la taille originale
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = origW;
      finalCanvas.height = origH;
      const finalCtx = finalCanvas.getContext('2d')!;

      // On dessine l'image originale
      finalCtx.drawImage(originalImg, 0, 0);

      // On utilise le masque pour détourer ("destination-in" garde seulement ce qui est dans le masque)
      finalCtx.globalCompositeOperation = 'destination-in';
      finalCtx.drawImage(maskCanvas, 0, 0, width, height, 0, 0, origW, origH);

      // 5. Retour en base64
      return finalCanvas.toDataURL('image/png');

    } catch (error) {
      console.error('[ImageProcessor] DeepLab failed:', error);
      throw error;
    }
  }
}

export const imageProcessorService = new ImageProcessorService();
