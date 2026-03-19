/**
 * Cat Printer - React Native Implementation
 * 
 * Main exports for the printer functionality.
 * 
 * @example
 * ```typescript
 * import { getPrintService } from '@/src';
 * 
 * const printService = getPrintService();
 * await printService.print({
 *   imageUri: 'file:///path/to/image.png',
 *   algorithm: 'floyd-steinberg',
 *   energy: 0xffff,
 * });
 * ```
 */

// Services
export { PrintService, getPrintService } from './services/printService';
export type { PrintOptions, PrintResult } from './services/printService';

// Bluetooth
export { PrinterService, getPrinterService } from './bluetooth/printerService';
export { 
  POSSIBLE_SERVICE_UUIDS,
  TX_CHARACTERISTIC_UUID,
  RX_CHARACTERISTIC_UUID,
} from './bluetooth/printerService';

// Image Processing
export {
  floydSteinbergDither,
  atkinsonDither,
  halftoneDither,
  meanThresholdBinarize,
  simpleBinarize,
  applyDithering,
} from './image/dithering';
export type {
  DitheringAlgorithm,
  GrayscaleImage,
  BinaryImage,
} from './image/dithering';

export {
  processImageForPrinting,
  resizeImage,
  convertToGrayscale,
  invertBinaryImage,
  getImageDimensions,
  PRINT_WIDTH,
} from './image/imageProcessor';

// Printer Commands
export {
  cmdsPrintImg,
  cmdSetEnergy,
  cmdFeedPaper,
  cmdApplyEnergy,
  cmdDrawBitmap,
  makeCommand,
  toBuffer,
  CMD_GET_DEVICE_STATE,
  CMD_GET_DEVICE_INFO,
  CMD_LATTICE_START,
  CMD_LATTICE_END,
  CMD_SET_DPI_AS_200,
  CMD_START_PRINTING,
  CMD_START_PRINTING_NEW,
  CMD_UPDATE_DEVICE,
} from './printer/commandGenerator';
