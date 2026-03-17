/**
 * Image Processing Module
 * 
 * Handles image loading, resizing, and conversion to formats suitable for printing.
 * 
 * Ported from Python implementation: catprinter/img.py
 */

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';
import { 
  applyDithering, 
  DitheringAlgorithm, 
  GrayscaleImage, 
  BinaryImage 
} from './dithering';
import { Canvas } from 'react-native-canvas';

export const PRINT_WIDTH = 384;

/**
 * Convert image URI to grayscale pixel array using Canvas
 * 
 * @param uri - Image URI (local file or base64)
 * @param width - Image width
 * @param height - Image height
 * @returns 2D array of grayscale pixel values (0-255)
 */
async function imageToGrayscale(
  uri: string, 
  width: number, 
  height: number
): Promise<GrayscaleImage> {
  return new Promise((resolve, reject) => {
    // Create a canvas element
    const canvas = new Canvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Load image
    const img = new Image();
    img.onload = () => {
      try {
        // Draw image to canvas
        ctx.drawImage(img, 0, 0, width, height);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;
        
        // Convert RGBA to grayscale
        const grayscale: GrayscaleImage = [];
        
        for (let y = 0; y < height; y++) {
          const row: number[] = [];
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            
            // Standard grayscale conversion formula
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            row.push(gray);
          }
          grayscale.push(row);
        }
        
        resolve(grayscale);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = (error) => {
      reject(new Error(`Failed to load image: ${error}`));
    };
    
    img.src = uri;
  });
}

/**
 * Resize image to printer width while maintaining aspect ratio
 * 
 * @param uri - Image URI
 * @param targetWidth - Target width in pixels (default: PRINT_WIDTH)
 * @returns Resized image URI
 */
export async function resizeImage(
  uri: string, 
  targetWidth: number = PRINT_WIDTH
): Promise<string> {
  const result = await manipulateAsync(
    uri,
    [
      {
        resize: {
          width: targetWidth,
        },
      },
    ],
    {
      compress: 1,
      format: SaveFormat.PNG,
    }
  );
  
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

/**
 * Process image for printing
 * 
 * This is the main entry point for image processing. It:
 * 1. Resizes the image to printer width
 * 2. Converts to grayscale
 * 3. Applies the specified dithering algorithm
 * 4. Returns binary image (inversion happens in print service)
 * 
 * @param uri - Image URI
 * @param algorithm - Dithering algorithm to use
 * @returns Binary image ready for printing
 */
export async function processImageForPrinting(
  uri: string,
  algorithm: DitheringAlgorithm = 'floyd-steinberg'
): Promise<BinaryImage> {
  console.log('⏳ Resizing image to', PRINT_WIDTH, 'pixels wide...');
  
  // Resize image
  const resizedUri = await resizeImage(uri, PRINT_WIDTH);
  
  // Get dimensions of resized image
  const dimensions = await getImageDimensions(resizedUri);
  
  console.log('⏳ Converting to grayscale...');
  console.log(`   Image size: ${dimensions.width}x${dimensions.height}`);
  
  // Convert to grayscale pixel array
  const grayscaleImage = await imageToGrayscale(
    resizedUri, 
    dimensions.width, 
    dimensions.height
  );
  
  console.log(`⏳ Applying ${algorithm} dithering...`);
  
  // Apply dithering algorithm
  const binaryImage = applyDithering(grayscaleImage, algorithm);
  
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
    Image.getSize(
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
