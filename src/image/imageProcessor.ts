/**
 * Image Processing Module
 * 
 * Handles image loading, resizing, and conversion to formats suitable for printing.
 * 
 * Ported from Python implementation: catprinter/img.py
 */

import { Image as RNImage } from 'react-native';
import { 
  applyDithering, 
  DitheringAlgorithm, 
  GrayscaleImage, 
  BinaryImage 
} from './dithering';
import { Canvas, Image as CanvasImage } from 'react-native-canvas';

export const PRINT_WIDTH = 384;

export interface ResizePlan {
  width: number;
  height: number;
}

/**
 * Compute printer target dimensions with optional 90deg rotation.
 * This is a pure sizing helper (safe on all runtimes).
 */
export function resizeImage(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number = PRINT_WIDTH,
  rotate90: boolean = false
): ResizePlan {
  const baseWidth = rotate90 ? sourceHeight : sourceWidth;
  const baseHeight = rotate90 ? sourceWidth : sourceHeight;
  const scale = targetWidth / Math.max(1, baseWidth);
  return {
    width: targetWidth,
    height: Math.max(1, Math.round(baseHeight * scale)),
  };
}

/**
 * Convert image URI to grayscale pixel array using Canvas
 *
 * @param uri - Image URI (local file or base64)
 * @param width - Image width
 * @param height - Image height
 * @param transparentAsWhite - If true, treat transparent pixels as white
 */
interface GrayscaleFromSourceOptions {
  sourceUri: string;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  rotate90?: boolean;
  transparentAsWhite?: boolean;
  brightness?: number;
}

async function imageToGrayscaleFromSource(
  options: GrayscaleFromSourceOptions
): Promise<GrayscaleImage> {
  const {
    sourceUri,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    rotate90 = false,
    transparentAsWhite = true,
    brightness = 0x80,
  } = options;

  return new Promise((resolve, reject) => {
    const canvas = new Canvas(targetWidth, targetHeight);
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // `react-native-canvas` uses a WebView Image constructor that requires the canvas
    // as first argument. (See node_modules/react-native-canvas/readme.md)
    const img = new CanvasImage(canvas, sourceHeight, sourceWidth);
    img.onload = () => {
      try {
        if (rotate90) {
          ctx.translate(targetWidth, 0);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(
            img,
            0,
            0,
            sourceWidth,
            sourceHeight,
            0,
            0,
            targetHeight,
            targetWidth
          );
        } else {
          ctx.drawImage(
            img,
            0,
            0,
            sourceWidth,
            sourceHeight,
            0,
            0,
            targetWidth,
            targetHeight
          );
        }

        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const pixels = imageData.data;
        const grayscale: GrayscaleImage = [];

        for (let y = 0; y < targetHeight; y++) {
          const row: number[] = [];
          for (let x = 0; x < targetWidth; x++) {
            const i = (y * targetWidth + x) * 4;
            let r = pixels[i];
            let g = pixels[i + 1];
            let b = pixels[i + 2];
            const a = pixels[i + 3] / 255;
            if (transparentAsWhite && a < 1) {
              // Match Cat-Printer `monoGrayscale` behaviour:
              // treat transparency as white by blending towards 255.
              r = r * a + (1 - a) * 255;
              g = g * a + (1 - a) * 255;
              b = b * a + (1 - a) * 255;
            } else if (!transparentAsWhite && a < 1) {
              r *= a;
              g *= a;
              b *= a;
            }
            // Match Cat-Printer `monoGrayscale` weighting + brightness curve.
            // m = r*0.2125 + g*0.7154 + b*0.0721
            // m += (brightness-0x80)*(1-m/255)*(m/255)*2
            let m = r * 0.2125 + g * 0.7154 + b * 0.0721;
            m += (brightness - 0x80) * (1 - m / 255) * (m / 255) * 2;
            const gray = Math.round(Math.min(255, Math.max(0, m)));
            row.push(gray);
          }
          grayscale.push(row);
        }
        resolve(grayscale);
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = (err: unknown) => reject(new Error(`Failed to load image: ${String(err)}`));
    img.src = sourceUri;
  });
}

/**
 * Legacy helper kept for API compatibility.
 * Grayscale conversion now happens inside `processImageForPrinting`.
 * 
 * @param uri - Image URI
 * @returns Original URI
 */
export async function convertToGrayscale(uri: string): Promise<string> {
  return uri;
}

export interface ProcessImageOptions {
  algorithm?: DitheringAlgorithm;
  /** Brightness/threshold 0-255 (default 127). Higher = darker. */
  threshold?: number;
  /** Rotate image 90° before printing (like Cat-Printer). */
  rotate?: boolean;
  /** Treat transparent pixels as white (default true). */
  transparentAsWhite?: boolean;
}

/**
 * Process image for printing (same flow as Cat-Printer).
 * Resize → optional rotate → grayscale → dithering → binary.
 */
export async function processImageForPrinting(
  uri: string,
  algorithm: DitheringAlgorithm = 'floyd-steinberg',
  options: ProcessImageOptions = {}
): Promise<BinaryImage> {
  const {
    threshold = 127,
    rotate = false,
    transparentAsWhite = true,
  } = options;

  // Cat-Printer expects a fixed width (384px). For text printing, we already capture
  // the view at exactly `width: 384`, so we avoid an extra resize/toDataURL step
  // (which is currently the most fragile part on some Android builds).
  let originalDimensions: { width: number; height: number };
  try {
    originalDimensions = await getImageDimensions(uri);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`imageProcessor.getImageDimensions failed: ${msg}`);
  }
  const originalWidthPx = Math.round(originalDimensions.width);

  const plan = resizeImage(
    Math.round(originalDimensions.width),
    Math.round(originalDimensions.height),
    PRINT_WIDTH,
    rotate
  );
  const outWidth = plan.width;
  const outHeight = plan.height;
  const needsScale = originalWidthPx !== PRINT_WIDTH || rotate;

  if (needsScale) {
    console.log(`⏳ Resizing image ${Math.round(originalDimensions.width)}x${Math.round(originalDimensions.height)} -> ${outWidth}x${outHeight}`);
  } else {
    console.log(`ℹ️ Image already printer width (${PRINT_WIDTH}px), keeping size ${Math.round(originalDimensions.width)}x${Math.round(originalDimensions.height)}`);
  }

  console.log('⏳ Converting to grayscale...');
  let grayscaleImage: GrayscaleImage;
  try {
    grayscaleImage = await imageToGrayscaleFromSource({
      sourceUri: uri,
      sourceWidth: Math.round(originalDimensions.width),
      sourceHeight: Math.round(originalDimensions.height),
      targetWidth: outWidth,
      targetHeight: outHeight,
      rotate90: rotate,
      transparentAsWhite,
      brightness: threshold,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`imageProcessor.grayscale failed: ${msg}`);
  }

  // In Cat-Printer frontend, the UI "Brightness" influences grayscale conversion,
  // while the binarization threshold is always 0x80.
  const binarizeThreshold = 0x80;
  console.log(`⏳ Applying ${algorithm} dithering (threshold=${binarizeThreshold})...`);
  const binaryImage = applyDithering(grayscaleImage, algorithm, binarizeThreshold);
  console.log('✅ Image processing complete');
  return binaryImage;
}

/**
 * Invert binary image (swap black and white)
 * 
 * The printer expects inverted images, so we flip all boolean values.
 * 
 * @param img - Binary image
 * @returns Inverted binary image
 */
export function invertBinaryImage(img: BinaryImage): BinaryImage {
  return img.map(row => row.map(pixel => !pixel));
}

/**
 * Get image dimensions from URI
 * 
 * @param uri - Image URI
 * @returns Object with width and height
 */
export async function getImageDimensions(
  uri: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    RNImage.getSize(
      uri,
      (width, height) => {
        resolve({ width, height });
      },
      (error) => {
        reject(new Error(`Failed to get image dimensions: ${error}`));
      }
    );
  });
}
