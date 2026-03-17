/**
 * Print Service
 * 
 * Main orchestrator for the printing workflow.
 * Coordinates image processing, command generation, and BLE communication.
 * 
 * Ported from Python implementation: print.py
 */

import { DitheringAlgorithm, BinaryImage } from '../image/dithering';
import { processImageForPrinting, invertBinaryImage, ProcessImageOptions } from '../image/imageProcessor';
import { cmdsPrintImg } from '../printer/commandGenerator';
import { getPrinterService } from '../bluetooth/printerService';
import { getDryRun, getQuality } from '../settings';
import type { Device } from 'react-native-ble-plx';

/**
 * Print configuration options (Cat-Printer–style)
 */
export interface PrintOptions {
  imageUri: string;
  algorithm?: DitheringAlgorithm;
  energy?: number;
  /** Brightness/threshold 0-255. Higher = darker. */
  threshold?: number;
  /** Rotate image 90° before printing. */
  rotate?: boolean;
  transparentAsWhite?: boolean;
  deviceName?: string;
  /** Use this device if already connected. */
  device?: Device | null;
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
      threshold = 127,
      rotate = false,
      transparentAsWhite = true,
      deviceName,
      device,
      showPreview = false,
    } = options;

    try {
      console.log('🖨️ Starting print job...');
      console.log(`   Image: ${imageUri}`);
      console.log(`   Algorithm: ${algorithm}`);
      console.log(`   Energy: 0x${energy.toString(16)}`);

      const processOpts: ProcessImageOptions = {
        threshold,
        rotate,
        transparentAsWhite,
      };
      console.log('⏳ Processing image...');
      const binaryImage = await processImageForPrinting(imageUri, algorithm, processOpts);
      
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
      
      console.log('⏳ Generating printer commands...');
      const quality = getQuality();
      const commandData = cmdsPrintImg(invertedImage, energy, quality);
      console.log(`✅ Generated ${commandData.length} bytes of commands`);
      
      const printerService = getPrinterService();
      if (getDryRun()) {
        console.log(' Dry run: skipping BLE send');
      } else {
        console.log('⏳ Sending to printer...');
        if (device) {
          if (!printerService.isConnected() || printerService.getConnectedDevice()?.id !== device.id) {
            await printerService.disconnect();
            await printerService.connect(device);
          }
          await printerService.sendData(commandData);
        } else {
          await printerService.print(commandData, deviceName);
        }
      }
      
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
   * Scan for printers (like Cat-Printer /devices).
   *
   * @param scanTimeMs - How long to scan in ms
   * @param listAll - If true, return all BLE devices (test unknown device)
   * @returns List of BLE devices (pass one to connectToDevice or print options.device)
   */
  async scanForPrinters(scanTimeMs?: number, listAll?: boolean): Promise<Device[]> {
    const printerService = getPrinterService();
    return printerService.scanForDevices({
      scanTimeMs: scanTimeMs ?? 4000,
      listAll,
    });
  }

  /**
   * Connect to a specific device (by Device object from scan).
   */
  async connectToDevice(device: Device): Promise<PrintResult> {
    try {
      const printerService = getPrinterService();
      await printerService.initialize();
      await printerService.connect(device);
      return { success: true, message: 'Connected' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Disconnect from current printer.
   */
  async disconnect(): Promise<void> {
    await getPrinterService().disconnect();
  }

  /** Whether a printer is currently connected. */
  isConnected(): boolean {
    return getPrinterService().isConnected();
  }

  /**
   * Test printer connection without printing.
   */
  async testConnection(deviceName?: string): Promise<PrintResult> {
    try {
      const printerService = getPrinterService();
      await printerService.initialize();
      const device = await printerService.scanForPrinter(deviceName);
      await printerService.connect(device);
      await printerService.disconnect();
      return { success: true, message: 'Printer connection successful' };
    } catch (error) {
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
