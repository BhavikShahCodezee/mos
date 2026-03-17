/**
 * Image Dithering Algorithms
 * 
 * This module implements various dithering algorithms for converting grayscale images
 * to binary (black and white) images suitable for thermal printing.
 * 
 * Ported from Python implementation: catprinter/img.py
 */

export type DitheringAlgorithm = 
  | 'floyd-steinberg' 
  | 'atkinson' 
  | 'halftone' 
  | 'mean-threshold' 
  | 'none';

/**
 * Represents a grayscale image as a 2D array of pixel values (0-255)
 */
export type GrayscaleImage = number[][];

/**
 * Represents a binary image as a 2D array of boolean values (true = black, false = white)
 */
export type BinaryImage = boolean[][];

/**
 * Floyd-Steinberg Dithering Algorithm
 * 
 * Applies error diffusion dithering to a grayscale image.
 * The algorithm distributes quantization error to neighboring pixels:
 * - 7/16 to the right pixel
 * - 3/16 to the bottom-left pixel
 * - 5/16 to the bottom pixel
 * - 1/16 to the bottom-right pixel
 * 
 * @param img - Grayscale image (2D array of 0-255 values)
 * @returns Binary image (2D array of booleans)
 */
export function floydSteinbergDither(img: GrayscaleImage, threshold: number = 127): BinaryImage {
  const height = img.length;
  const width = img[0].length;
  
  // Create a copy to avoid modifying the original
  const workingImg = img.map(row => [...row]);
  
  const adjustPixel = (y: number, x: number, delta: number): void => {
    if (y < 0 || y >= height || x < 0 || x >= width) {
      return;
    }
    workingImg[y][x] = Math.min(255, Math.max(0, workingImg[y][x] + delta));
  };
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const oldPixel = workingImg[y][x];
      const newPixel = oldPixel > threshold ? 255 : 0;
      const error = oldPixel - newPixel;
      
      workingImg[y][x] = newPixel;
      
      // Distribute error to neighboring pixels
      adjustPixel(y, x + 1, error * 7 / 16);      // Right
      adjustPixel(y + 1, x - 1, error * 3 / 16);  // Bottom-left
      adjustPixel(y + 1, x, error * 5 / 16);      // Bottom
      adjustPixel(y + 1, x + 1, error * 1 / 16);  // Bottom-right
    }
  }
  
  return workingImg.map(row => row.map(pixel => pixel > threshold));
}

/**
 * Atkinson Dithering Algorithm
 * 
 * Similar to Floyd-Steinberg but distributes error to 6 neighboring pixels
 * with equal weights (1/8 each). Only distributes 6/8 of the error, creating
 * a lighter, more artistic effect.
 * 
 * @param img - Grayscale image (2D array of 0-255 values)
 * @returns Binary image (2D array of booleans)
 */
export function atkinsonDither(img: GrayscaleImage, threshold: number = 127): BinaryImage {
  const height = img.length;
  const width = img[0].length;
  
  // Create a copy to avoid modifying the original
  const workingImg = img.map(row => [...row]);
  
  const adjustPixel = (y: number, x: number, delta: number): void => {
    if (y < 0 || y >= height || x < 0 || x >= width) {
      return;
    }
    workingImg[y][x] = Math.min(255, Math.max(0, workingImg[y][x] + delta));
  };
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const oldPixel = workingImg[y][x];
      const newPixel = oldPixel > threshold ? 255 : 0;
      const error = oldPixel - newPixel;
      
      workingImg[y][x] = newPixel;
      
      // Distribute error to 6 neighboring pixels
      adjustPixel(y, x + 1, error * 1 / 8);      // Right
      adjustPixel(y, x + 2, error * 1 / 8);      // Right + 1
      adjustPixel(y + 1, x - 1, error * 1 / 8);  // Bottom-left
      adjustPixel(y + 1, x, error * 1 / 8);      // Bottom
      adjustPixel(y + 1, x + 1, error * 1 / 8);  // Bottom-right
      adjustPixel(y + 2, x, error * 1 / 8);      // Bottom + 1
    }
  }
  
  return workingImg.map(row => row.map(pixel => pixel > threshold));
}

/**
 * Halftone Dithering Algorithm
 * 
 * Creates a classic newspaper-style halftone effect by dividing the image into
 * small squares and drawing circles with radius proportional to the darkness
 * of each square.
 * 
 * @param img - Grayscale image (2D array of 0-255 values)
 * @returns Binary image (2D array of booleans)
 */
export function halftoneDither(img: GrayscaleImage): BinaryImage {
  const height = img.length;
  const width = img[0].length;
  
  const side = 4;
  const jump = 4;
  const alpha = 3;
  
  const heightOutput = side * Math.ceil(height / jump);
  const widthOutput = side * Math.ceil(width / jump);
  
  // Initialize canvas with white (false)
  const canvas: boolean[][] = Array(heightOutput)
    .fill(null)
    .map(() => Array(widthOutput).fill(false));
  
  const squareAvgValue = (startY: number, startX: number): number => {
    let sum = 0;
    let count = 0;
    
    for (let y = startY; y < Math.min(startY + jump, height); y++) {
      for (let x = startX; x < Math.min(startX + jump, width); x++) {
        sum += img[y][x];
        count++;
      }
    }
    
    return count > 0 ? sum / count : 0;
  };
  
  const drawCircle = (
    centerY: number, 
    centerX: number, 
    radius: number
  ): void => {
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        const dy = y - side / 2;
        const dx = x - side / 2;
        const distance = Math.sqrt(dy * dy + dx * dx);
        
        if (distance <= radius) {
          const canvasY = centerY + y;
          const canvasX = centerX + x;
          if (canvasY < heightOutput && canvasX < widthOutput) {
            canvas[canvasY][canvasX] = true;
          }
        }
      }
    }
  };
  
  let yOutput = 0;
  for (let y = 0; y < height; y += jump) {
    let xOutput = 0;
    for (let x = 0; x < width; x += jump) {
      const intensity = 1 - squareAvgValue(y, x) / 255;
      const radius = Math.floor(alpha * intensity * side / 2);
      
      if (radius > 0) {
        drawCircle(yOutput, xOutput, radius);
      }
      
      xOutput += side;
    }
    yOutput += side;
  }
  
  return canvas;
}

/**
 * Mean Threshold Binarization
 * 
 * Simple thresholding. If threshold is provided use it; else use image mean.
 * 
 * @param img - Grayscale image (2D array of 0-255 values)
 * @param threshold - Optional fixed threshold (0-255). If not set, uses image mean.
 * @returns Binary image (2D array of booleans)
 */
export function meanThresholdBinarize(img: GrayscaleImage, threshold?: number): BinaryImage {
  if (threshold != null) {
    return img.map(row => row.map(pixel => pixel > threshold));
  }
  const height = img.length;
  const width = img[0].length;
  let sum = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      sum += img[y][x];
    }
  }
  const mean = sum / (height * width);
  return img.map(row => row.map(pixel => pixel > mean));
}

/**
 * No Dithering - Simple Threshold
 * 
 * Converts grayscale to binary using a fixed threshold.
 * 
 * @param img - Grayscale image (2D array of 0-255 values)
 * @param threshold - Threshold 0-255 (default 127)
 * @returns Binary image (2D array of booleans)
 */
export function simpleBinarize(img: GrayscaleImage, threshold: number = 127): BinaryImage {
  return img.map(row => row.map(pixel => pixel > threshold));
}

/**
 * Apply the specified dithering algorithm to a grayscale image
 * 
 * @param img - Grayscale image (2D array of 0-255 values)
 * @param algorithm - The dithering algorithm to use
 * @param threshold - Brightness/threshold 0-255 (default 127). Higher = darker result.
 * @returns Binary image (2D array of booleans)
 */
export function applyDithering(
  img: GrayscaleImage, 
  algorithm: DitheringAlgorithm,
  threshold: number = 127
): BinaryImage {
  switch (algorithm) {
    case 'floyd-steinberg':
      return floydSteinbergDither(img, threshold);
    case 'atkinson':
      return atkinsonDither(img, threshold);
    case 'halftone':
      return halftoneDither(img);
    case 'mean-threshold':
      return meanThresholdBinarize(img, threshold);
    case 'none':
      return simpleBinarize(img, threshold);
    default:
      throw new Error(`Unknown dithering algorithm: ${algorithm}`);
  }
}
