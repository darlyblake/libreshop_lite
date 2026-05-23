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
   * Initialise RMBG-1.4 (U²-Net) via AutoModel + AutoProcessor.
   * IMPORTANT : briaai/RMBG-1.4 ne supporte PAS pipeline() car son architecture
   * SegformerForSemanticSegmentation n'est pas reconnue par le système de tâches.
   * On utilise l'approche bas-niveau officielle des démos HuggingFace.
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

      const { env, AutoModel, AutoProcessor } = await import(
        /* webpackChunkName: "transformers-rmbg" */
        '@huggingface/transformers'
      );

      env.allowLocalModels = false;

      console.log('[ImageProcessor] Téléchargement du modèle RMBG-1.4 (mis en cache après le premier usage)...');

      // Chargement en parallel : modèle et processor
      const [model, processor] = await Promise.all([
        AutoModel.from_pretrained('briaai/RMBG-1.4', {
          // Bypass obligatoire : le config.json déclare SegformerForSemanticSegmentation
          // mais le modèle est une IS-Net custom — on force 'custom' pour l'AutoModel
          config: { model_type: 'custom' } as any,
          dtype: 'fp32',
        }),
        AutoProcessor.from_pretrained('briaai/RMBG-1.4', {
          config: {
            do_normalize: true,
            do_pad: false,
            do_rescale: true,
            do_resize: true,
            image_mean: [0.5, 0.5, 0.5],
            feature_extractor_type: 'ImageFeatureExtractor',
            image_std: [1.0, 1.0, 1.0],
            resample: 2,
            rescale_factor: 0.00392156862745098,
            size: { width: 1024, height: 1024 },
          },
        }),
      ]);

      this.segmenter = { model, processor };
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
      // 1. Initialiser RMBG-1.4 (AutoModel + AutoProcessor)
      await this.initSegmenter();

      const { model, processor } = this.segmenter;

      // 2. Charger l'image via RawImage (API HuggingFace transformers.js)
      console.log('[ImageProcessor] Détourage via RMBG-1.4 en cours...');
      const { RawImage } = await import(
        /* webpackChunkName: "transformers-rmbg" */
        '@huggingface/transformers'
      );

      const image = await RawImage.fromURL(imageUri);
      const origW = image.width;
      const origH = image.height;

      // 3. Préparer les pixels via le processor (resize 1024×1024, normalize)
      const { pixel_values } = await processor(image);

      // 4. Inférence IS-Net : produit un tenseur de saillance [0, 1]
      const { output } = await model({ input: pixel_values });

      // 5. Post-traitement : convertir le tenseur en masque 8-bit et redimensionner
      const maskTensor = output[0].mul(255).to('uint8');
      const maskImage = await RawImage.fromTensor(maskTensor);
      const maskResized = await maskImage.resize(origW, origH);

      const mW = maskResized.width;
      const mH = maskResized.height;


      // 4. Appliquer le masque pixel par pixel comme canal alpha sur l'image originale
      const transparentCanvas = document.createElement('canvas');
      transparentCanvas.width = origW;
      transparentCanvas.height = origH;
      const transCtx = transparentCanvas.getContext('2d')!;

      // Dessiner l'image originale depuis RawImage (converti en canvas HTML)
      const originalCanvas = document.createElement('canvas');
      originalCanvas.width = origW;
      originalCanvas.height = origH;
      const origCtx = originalCanvas.getContext('2d')!;
      const origImgData = origCtx.createImageData(origW, origH);
      const rgbaData = (image as any).toRGBA8();
      origImgData.data.set(rgbaData);
      origCtx.putImageData(origImgData, 0, 0);

      transCtx.drawImage(originalCanvas, 0, 0);

      const origPixels = transCtx.getImageData(0, 0, origW, origH);
      // Appliquer le masque IS-Net directement pixel par pixel
      // maskResized.data contient des valeurs 0-255 (canal unique grayscale)
      for (let i = 0; i < origW * origH; i++) {
        origPixels.data[i * 4 + 3] = maskResized.data[i];
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
