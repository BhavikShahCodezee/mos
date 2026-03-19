/**
 * Image Processing Module
 * 
 * Handles image loading, resizing, and conversion to formats suitable for printing.
 * 
 * Ported from Python implementation: catprinter/img.py
 */

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image as RNImage } from 'react-native';
import { 
  applyDithering, 
  DitheringAlgorithm, 
  GrayscaleImage, 
  BinaryImage 
} from './dithering';
import { Canvas, Image as CanvasImage } from 'react-native-canvas';

export const PRINT_WIDTH = 384;

/**
 * Convert image URI to grayscale pixel array using Canvas
 *
 * @param uri - Image URI (local file or base64)
 * @param width - Image width
 * @param height - Image height
 * @param transparentAsWhite - If true, treat transparent pixels as white
 */
async function imageToGrayscale(
  uri: string,
  width: number,
  height: number,
  transparentAsWhite: boolean = true,
  brightness: number = 0x80
): Promise<GrayscaleImage> {
  return new Promise((resolve, reject) => {
    const canvas = new Canvas(width, height);
    const ctx = canvas.getContext('2d');

    // `react-native-canvas` uses a WebView Image constructor that requires the canvas
    // as first argument. (See node_modules/react-native-canvas/readme.md)
    const img = new CanvasImage(canvas, height, width);
    img.onload = () => {
      try {
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;
        const grayscale: GrayscaleImage = [];

        for (let y = 0; y < height; y++) {
          const row: number[] = [];
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
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
    img.src = uri;
  });
}

/**
 * Resize image to printer width (optionally rotate 90° first, like Cat-Printer).
 */
export async function resizeImage(
  uri: string,
  targetWidth: number = PRINT_WIDTH,
  rotate90: boolean = false
): Promise<string> {
  const actions: Parameters<typeof manipulateAsync>[1] = [];
  if (rotate90) {
    actions.push({ rotate: 90 });
  }
  actions.push({
    resize: { width: targetWidth },
  });
  const result = await manipulateAsync(uri, actions, {
    compress: 1,
    format: SaveFormat.PNG,
  });
  return result.uri;
}

/**
 * Convert image to grayscale using expo-image-manipulator
 * 
 * @param uri - Image URI
 * @returns Grayscale image URI
 */
export async function convertToGrayscale(uri: string): Promise<string> {
  // expo-image-manipulator doesn't have built-in grayscale,
  // so we'll need to handle this differently
  // For now, return the original URI and handle grayscale conversion
  // in the native layer or using a different approach
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

  console.log('⏳ Resizing image to', PRINT_WIDTH, 'pixels wide...');
  const resizedUri = await resizeImage(uri, PRINT_WIDTH, rotate);
  const dimensions = await getImageDimensions(resizedUri);
  console.log(`   Image size: ${dimensions.width}x${dimensions.height}`);

  console.log('⏳ Converting to grayscale...');
  const grayscaleImage = await imageToGrayscale(
    resizedUri,
    dimensions.width,
    dimensions.height,
    transparentAsWhite,
    threshold
  );

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
