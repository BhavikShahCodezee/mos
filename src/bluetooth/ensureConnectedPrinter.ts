import type { Device } from 'react-native-ble-plx';
import { getPrintService } from '../services/printService';
import { getPrinterService } from './printerService';
import { loadSavedPrinter } from '../storage/savedPrinter';

export async function ensureConnectedPrinter(): Promise<Device> {
  const printService = getPrintService();
  if (printService.isConnected()) {
    const device = getPrinterService().getConnectedDevice();
    if (device) {
      return device;
    }
  }

  const saved = await loadSavedPrinter();
  if (!saved) {
    throw new Error('Printer not connected');
  }

  const list = await printService.scanForPrinters(2500, true);
  const match = list.find((d) => d.id === saved.id) || (saved.name ? list.find((d) => d.name === saved.name) : undefined);
  if (!match) {
    throw new Error('Saved printer not found. Please reconnect from Home.');
  }
  const result = await printService.connectToDevice(match);
  if (!result.success) {
    throw new Error(result.message || 'Unable to connect printer');
  }
  return match;
}

