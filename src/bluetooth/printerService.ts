/**
 * Bluetooth Low Energy Printer Service
 * 
 * Handles BLE communication with the thermal printer.
 * 
 * Ported from Python implementation: catprinter/ble.py
 */

import { BleManager, Device, State, Characteristic } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

/**
 * BLE Service UUIDs
 * The printer advertises different UUIDs on different platforms
 */
export const POSSIBLE_SERVICE_UUIDS = [
  '0000ae30-0000-1000-8000-00805f9b34fb',  // Raspberry Pi
  '0000af30-0000-1000-8000-00805f9b34fb',  // macOS
];

/**
 * BLE Characteristic UUIDs
 */
export const TX_CHARACTERISTIC_UUID = '0000ae01-0000-1000-8000-00805f9b34fb';  // Send data
export const RX_CHARACTERISTIC_UUID = '0000ae02-0000-1000-8000-00805f9b34fb';  // Receive data

/**
 * Printer ready notification signature
 */
const PRINTER_READY_NOTIFICATION = Buffer.from([
  0x51, 0x78, 0xae, 0x01, 0x01, 0x00, 0x00, 0x00, 0xff
]);

/**
 * Timing constants
 */
const SCAN_TIMEOUT_MS = 10000;
const WAIT_AFTER_EACH_CHUNK_MS = 20;
const WAIT_FOR_PRINTER_DONE_TIMEOUT_MS = 30000;

/**
 * Printer Service Class
 * 
 * Manages BLE connection and communication with the thermal printer.
 */
export class PrinterService {
  private bleManager: BleManager | null = null;
  private connectedDevice: Device | null = null;
  private isPrinterReady = false;
  
  constructor() {
    try {
      this.bleManager = new BleManager();
    } catch (error) {
      console.warn(
        '⚠️ BLE Manager not available. ' +
        'This is expected in Expo Go. ' +
        'Please use a development build or production build to test Bluetooth.'
      );
      this.bleManager = null;
    }
  }
  
  /**
   * Check if BLE is available
   */
  private checkBleAvailable(): void {
    if (!this.bleManager) {
      throw new Error(
        'Bluetooth is not available. ' +
        'You are likely running in Expo Go, which does not support react-native-ble-plx. ' +
        'Please create a development build using: eas build --profile development --platform android'
      );
    }
  }
  
  /**
   * Initialize BLE manager and check permissions
   */
  async initialize(): Promise<void> {
    this.checkBleAvailable();
    
    const state = await this.bleManager!.state();
    
    if (state !== State.PoweredOn) {
      throw new Error(
        `Bluetooth is not powered on. Current state: ${state}. ` +
        'Please enable Bluetooth and try again.'
      );
    }
    
    console.log('✅ BLE Manager initialized');
  }
  
  /**
   * Scan for printer devices
   * 
   * @param deviceName - Optional device name to search for (e.g., "GT01", "GB02")
   * @returns Found device
   */
  async scanForPrinter(deviceName?: string): Promise<Device> {
    this.checkBleAvailable();
    
    console.log(
      deviceName 
        ? `⏳ Looking for BLE device named ${deviceName}...`
        : '⏳ Trying to auto-discover a printer...'
    );
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.bleManager!.stopDeviceScan();
        reject(new Error(
          'Unable to find printer. Make sure it is turned on and in range.'
        ));
      }, SCAN_TIMEOUT_MS);
      
      this.bleManager!.startDeviceScan(
        null,
        null,
        (error, device) => {
          if (error) {
            clearTimeout(timeout);
            this.bleManager.stopDeviceScan();
            reject(error);
            return;
          }
          
          if (!device) {
            return;
          }
          
          // Check if device matches criteria
          const isMatch = deviceName
            ? device.name === deviceName
            : device.serviceUUIDs?.some(uuid => 
                POSSIBLE_SERVICE_UUIDS.includes(uuid.toLowerCase())
              );
          
          if (isMatch) {
            clearTimeout(timeout);
            this.bleManager!.stopDeviceScan();
            console.log(`✅ Found printer: ${device.name || device.id}`);
            resolve(device);
          }
        }
      );
    });
  }
  
  /**
   * Connect to a printer device
   * 
   * @param device - Device to connect to
   */
  async connect(device: Device): Promise<void> {
    console.log(`⏳ Connecting to ${device.name || device.id}...`);
    
    this.connectedDevice = await device.connect();
    await this.connectedDevice.discoverAllServicesAndCharacteristics();
    
    const mtu = await this.connectedDevice.requestMTU(512);
    
    console.log(
      `✅ Connected: ${this.connectedDevice.isConnected}; MTU: ${mtu}`
    );
  }
  
  /**
   * Disconnect from the printer
   */
  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      await this.connectedDevice.cancelConnection();
      this.connectedDevice = null;
      console.log('✅ Disconnected from printer');
    }
  }
  
  /**
   * Set up notification listener for printer ready signal
   */
  private async setupNotifications(): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }
    
    this.isPrinterReady = false;
    
    // Find the service that contains our characteristic
    const services = await this.connectedDevice.services();
    let targetService = null;
    
    for (const service of services) {
      const serviceUuid = service.uuid.toLowerCase();
      if (POSSIBLE_SERVICE_UUIDS.includes(serviceUuid)) {
        targetService = service;
        break;
      }
    }
    
    if (!targetService) {
      throw new Error('Printer service not found');
    }
    
    // Monitor notifications
    this.connectedDevice.monitorCharacteristicForService(
      targetService.uuid,
      RX_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          console.error('Notification error:', error);
          return;
        }
        
        if (characteristic?.value) {
          const data = Buffer.from(characteristic.value, 'base64');
          console.log('📡 Received notification:', data);
          
          if (data.equals(PRINTER_READY_NOTIFICATION)) {
            this.isPrinterReady = true;
          }
        }
      }
    );
  }
  
  /**
   * Wait for printer to be ready
   */
  private async waitForPrinterReady(): Promise<void> {
    console.log('⏳ Done printing. Waiting for printer to be ready...');
    
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (this.isPrinterReady) {
          clearInterval(checkInterval);
          console.log('✅ Printer is ready');
          resolve();
        } else if (Date.now() - startTime > WAIT_FOR_PRINTER_DONE_TIMEOUT_MS) {
          clearInterval(checkInterval);
          reject(new Error('Timed out waiting for printer done event'));
        }
      }, 100);
    });
  }
  
  /**
   * Send data to printer in chunks
   * 
   * @param data - Data to send (Uint8Array or Buffer)
   */
  async sendData(data: Uint8Array | Buffer): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }
    
    // Find the service that contains our characteristic
    const services = await this.connectedDevice.services();
    let targetService = null;
    
    for (const service of services) {
      const serviceUuid = service.uuid.toLowerCase();
      if (POSSIBLE_SERVICE_UUIDS.includes(serviceUuid)) {
        targetService = service;
        break;
      }
    }
    
    if (!targetService) {
      throw new Error('Printer service not found');
    }
    
    // Set up notifications
    await this.setupNotifications();
    
    // Get MTU size (default to 23 if not available)
    const mtu = await this.connectedDevice.requestMTU(512);
    const chunkSize = mtu - 3;  // BLE overhead
    
    console.log(
      `⏳ Sending ${data.length} bytes of data in chunks of ${chunkSize} bytes...`
    );
    
    // Convert to Buffer if needed
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    
    // Send data in chunks
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.slice(i, Math.min(i + chunkSize, buffer.length));
      const base64Chunk = chunk.toString('base64');
      
      await this.connectedDevice.writeCharacteristicWithResponseForService(
        targetService.uuid,
        TX_CHARACTERISTIC_UUID,
        base64Chunk
      );
      
      // Wait between chunks
      await new Promise(resolve => 
        setTimeout(resolve, WAIT_AFTER_EACH_CHUNK_MS)
      );
    }
    
    console.log('✅ Data sent successfully');
    
    // Wait for printer to finish
    await this.waitForPrinterReady();
  }
  
  /**
   * Complete print workflow: scan, connect, send, disconnect
   * 
   * @param data - Print data
   * @param deviceName - Optional device name
   */
  async print(data: Uint8Array | Buffer, deviceName?: string): Promise<void> {
    try {
      await this.initialize();
      
      const device = await this.scanForPrinter(deviceName);
      await this.connect(device);
      await this.sendData(data);
      
    } catch (error) {
      console.error('🛑 Print error:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.bleManager) {
      this.bleManager.destroy();
    }
  }
}

/**
 * Singleton instance for easy access
 */
let printerServiceInstance: PrinterService | null = null;

export function getPrinterService(): PrinterService {
  if (!printerServiceInstance) {
    printerServiceInstance = new PrinterService();
  }
  return printerServiceInstance;
}
