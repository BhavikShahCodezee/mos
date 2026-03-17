/**
 * Print Service
 * 
 * Main orchestrator for the printing workflow.
 * Coordinates image processing, command generation, and BLE communication.
 * 
 * Ported from Python implementation: print.py
 */

import { DitheringAlgorithm, BinaryImage } from '../image/dithering';
import { processImageForPrinting, invertBinaryImage } from '../image/imageProcessor';
import { cmdsPrintImg } from '../printer/commandGenerator';
import { getPrinterService } from '../bluetooth/printerService';

/**
 * Print configuration options
 */
export interface PrintOptions {
  imageUri: string;
  algorithm?: DitheringAlgorithm;
  energy?: number;
  deviceName?: string;
  showPreview?: boolean;
}

/**
 * Print result information
 */
export interface PrintResult {
  success: boolean;
  message: string;
  error?: Error;
  imageSize?: { width: number; height: number };
  dataSize?: number;
}

/**
 * Main Print Service Class
 * 
 * Handles the complete printing workflow from image to printed output.
 */
export class PrintService {
  /**
   * Process and print an image
   * 
   * @param options - Print configuration
   * @returns Print result
   */
  async print(options: PrintOptions): Promise<PrintResult> {
    const {
      imageUri,
      algorithm = 'floyd-steinberg',
      energy = 0xffff,
      deviceName,
      showPreview = false,
    } = options;
    
    try {
      console.log('🖨️ Starting print job...');
      console.log(`   Image: ${imageUri}`);
      console.log(`   Algorithm: ${algorithm}`);
      console.log(`   Energy: 0x${energy.toString(16)}`);
      
      // Step 1: Process image
      console.log('⏳ Processing image...');
      const binaryImage = await processImageForPrinting(imageUri, algorithm);
      
      // Invert image (printer logic)
      const invertedImage = invertBinaryImage(binaryImage);
      
      const imageSize = {
        height: invertedImage.length,
        width: invertedImage[0]?.length || 0,
      };
      
      console.log(`✅ Image processed: ${imageSize.height}x${imageSize.width} pixels`);
      
      // Step 2: Show preview if requested
      if (showPreview) {
        // TODO: Implement preview functionality
        console.log('ℹ️  Preview requested (not yet implemented)');
      }
      
      // Step 3: Generate printer commands
      console.log('⏳ Generating printer commands...');
      const commandData = cmdsPrintImg(invertedImage, energy);
      console.log(`✅ Generated ${commandData.length} bytes of commands`);
      
      // Step 4: Send to printer via BLE
      console.log('⏳ Sending to printer...');
      const printerService = getPrinterService();
      await printerService.print(commandData, deviceName);
      
      console.log('✅ Print job completed successfully!');
      
      return {
        success: true,
        message: 'Print completed successfully',
        imageSize,
        dataSize: commandData.length,
      };
      
    } catch (error) {
      console.error('🛑 Print job failed:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
  
  /**
   * Test printer connection without printing
   * 
   * @param deviceName - Optional device name
   * @returns Connection test result
   */
  async testConnection(deviceName?: string): Promise<PrintResult> {
    try {
      console.log('🔍 Testing printer connection...');
      
      const printerService = getPrinterService();
      await printerService.initialize();
      
      const device = await printerService.scanForPrinter(deviceName);
      await printerService.connect(device);
      await printerService.disconnect();
      
      console.log('✅ Connection test successful');
      
      return {
        success: true,
        message: 'Printer connection successful',
      };
      
    } catch (error) {
      console.error('🛑 Connection test failed:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
  
  /**
   * Get list of available dithering algorithms
   */
  getAvailableAlgorithms(): DitheringAlgorithm[] {
    return [
      'floyd-steinberg',
      'atkinson',
      'halftone',
      'mean-threshold',
      'none',
    ];
  }
  
  /**
   * Get algorithm description
   */
  getAlgorithmDescription(algorithm: DitheringAlgorithm): string {
    const descriptions: Record<DitheringAlgorithm, string> = {
      'floyd-steinberg': 
        'High-quality error diffusion dithering. Best for photos and detailed images.',
      'atkinson': 
        'Lighter error diffusion with artistic effect. Good for illustrations.',
      'halftone': 
        'Classic newspaper-style halftone pattern. Creates a vintage look.',
      'mean-threshold': 
        'Simple threshold based on image mean. Fast but lower quality.',
      'none': 
        'No dithering, simple black/white conversion. Requires 384px width.',
    };
    
    return descriptions[algorithm];
  }
}

/**
 * Singleton instance for easy access
 */
let printServiceInstance: PrintService | null = null;

export function getPrintService(): PrintService {
  if (!printServiceInstance) {
    printServiceInstance = new PrintService();
  }
  return printServiceInstance;
}
