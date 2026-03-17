# Cat Printer - React Native Implementation

A React Native mobile application for printing images to thermal printers via Bluetooth Low Energy (BLE). This is a complete port of the [Python catprinter project](https://github.com/rbaron/catprinter).

## Features

- 📱 **Mobile-First**: Native iOS and Android support
- 🖨️ **Bluetooth Printing**: Connect to thermal printers via BLE
- 🎨 **Multiple Dithering Algorithms**: 
  - Floyd-Steinberg (high quality, best for photos)
  - Atkinson (artistic, lighter effect)
  - Halftone (classic newspaper style)
  - Mean Threshold (fast, simple)
  - None (direct conversion)
- 🔧 **Adjustable Settings**: Control print darkness (thermal energy)
- 📸 **Image Selection**: Pick images from photo library
- ⚡ **Optimized**: Run-length encoding for efficient data transmission

## Supported Printers

- GT01
- GB02
- GB03
- Other compatible thermal printers with BLE

## Architecture

```
src/
├── bluetooth/
│   └── printerService.ts      # BLE communication layer
├── image/
│   ├── dithering.ts           # Dithering algorithms
│   └── imageProcessor.ts      # Image processing pipeline
├── printer/
│   └── commandGenerator.ts    # Printer command generation
└── services/
    └── printService.ts        # Main orchestrator
```

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator / Android Emulator or physical device

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Usage

### Basic Printing

```typescript
import { getPrintService } from '@/src/services/printService';

const printService = getPrintService();

await printService.print({
  imageUri: 'file:///path/to/image.png',
  algorithm: 'floyd-steinberg',
  energy: 0xffff,
  deviceName: 'GT01', // Optional, auto-discovers if omitted
});
```

### Test Connection

```typescript
const result = await printService.testConnection('GT01');
if (result.success) {
  console.log('Printer connected!');
}
```

### Custom Dithering

```typescript
import { applyDithering } from '@/src/image/dithering';

const grayscaleImage = [[128, 255, 0], [64, 192, 128]]; // 2D array
const binaryImage = applyDithering(grayscaleImage, 'atkinson');
```

## API Reference

### PrintService

#### `print(options: PrintOptions): Promise<PrintResult>`

Main printing function.

**Options:**
- `imageUri` (string): Image file URI
- `algorithm` (DitheringAlgorithm): Dithering algorithm (default: 'floyd-steinberg')
- `energy` (number): Thermal energy 0x0000-0xFFFF (default: 0xFFFF)
- `deviceName` (string, optional): Printer device name
- `showPreview` (boolean, optional): Show preview before printing

**Returns:**
```typescript
{
  success: boolean;
  message: string;
  imageSize?: { width: number; height: number };
  dataSize?: number;
  error?: Error;
}
```

#### `testConnection(deviceName?: string): Promise<PrintResult>`

Test printer connection without printing.

#### `getAvailableAlgorithms(): DitheringAlgorithm[]`

Get list of supported dithering algorithms.

#### `getAlgorithmDescription(algorithm: DitheringAlgorithm): string`

Get human-readable description of an algorithm.

### Dithering Algorithms

#### `floydSteinbergDither(img: GrayscaleImage): BinaryImage`

High-quality error diffusion dithering. Best for photos.

#### `atkinsonDither(img: GrayscaleImage): BinaryImage`

Lighter error diffusion with artistic effect.

#### `halftoneDither(img: GrayscaleImage): BinaryImage`

Classic newspaper-style halftone pattern.

#### `meanThresholdBinarize(img: GrayscaleImage): BinaryImage`

Simple threshold based on image mean.

#### `simpleBinarize(img: GrayscaleImage): BinaryImage`

Direct black/white conversion at threshold 127.

### Command Generator

#### `cmdsPrintImg(img: BinaryImage, energy?: number): Uint8Array`

Generate complete command sequence for printing.

#### `cmdSetEnergy(val: number): Uint8Array`

Generate energy setting command (0x0000-0xFFFF).

#### `cmdFeedPaper(amount: number): Uint8Array`

Generate paper feed command.

### Printer Service

#### `scanForPrinter(deviceName?: string): Promise<Device>`

Scan for printer devices.

#### `connect(device: Device): Promise<void>`

Connect to a printer device.

#### `sendData(data: Uint8Array | Buffer): Promise<void>`

Send print data to connected printer.

#### `disconnect(): Promise<void>`

Disconnect from printer.

## Technical Details

### Image Processing Pipeline

1. **Load Image**: Pick from photo library
2. **Resize**: Scale to 384px width (printer resolution)
3. **Convert to Grayscale**: Using standard formula (0.299R + 0.587G + 0.114B)
4. **Apply Dithering**: Convert to binary using selected algorithm
5. **Invert**: Flip black/white for printer logic
6. **Generate Commands**: Create printer command sequence
7. **Send via BLE**: Transmit in chunks with proper timing

### BLE Communication

- **Service UUIDs**: `0000ae30-...` / `0000af30-...`
- **TX Characteristic**: `0000ae01-...` (send data)
- **RX Characteristic**: `0000ae02-...` (receive notifications)
- **MTU**: Negotiated up to 512 bytes
- **Chunk Size**: MTU - 3 bytes (BLE overhead)
- **Delay**: 20ms between chunks
- **Timeout**: 30 seconds for printer ready

### Command Protocol

Commands follow this structure:
```
[Header: 0x51 0x78] [Command] [Reserved] [Length] [Reserved] [Data...] [Checksum] [Footer: 0xFF]
```

Example commands:
- Get Device State: `51 78 A3 00 01 00 00 00 FF`
- Set Quality 200 DPI: `51 78 A4 00 01 00 32 9E FF`
- Set Energy: `51 78 AF 00 02 00 [HIGH] [LOW] [CHK] FF`

### Run-Length Encoding

Images are compressed using run-length encoding:
- Consecutive identical pixels are encoded as count + value
- Falls back to byte encoding if compression is inefficient
- Reduces BLE transmission time significantly

## Permissions

### iOS (Info.plist)
```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app needs Bluetooth to connect to the thermal printer.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>This app needs access to your photos to print images.</string>
```

### Android (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.BLUETOOTH"/>
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN"/>
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
```

## Troubleshooting

### Printer Not Found

1. Ensure printer is powered on
2. Check Bluetooth is enabled on device
3. Verify printer is not connected to another device
4. Try specifying device name explicitly

### Connection Fails

1. Check app permissions (Settings → App → Permissions)
2. Restart printer
3. Restart app
4. Try moving closer to printer

### Poor Print Quality

1. Try different dithering algorithms
2. Adjust energy/darkness setting
3. Use higher resolution source images
4. Ensure image is well-lit and high contrast

### Image Processing Slow

1. Resize images before processing
2. Use simpler dithering algorithms (mean-threshold)
3. Consider implementing native modules for performance

## Comparison with Python Version

| Feature | Python | React Native |
|---------|--------|--------------|
| **Platform** | Desktop | Mobile (iOS/Android) |
| **Interface** | CLI | Touch UI |
| **Image Input** | File path | Photo library |
| **BLE Library** | bleak | react-native-ble-plx |
| **Image Processing** | OpenCV + NumPy | JavaScript + Canvas |
| **Algorithms** | ✅ Identical | ✅ Identical |
| **Commands** | ✅ Identical | ✅ Identical |
| **Output** | ✅ Same | ✅ Same |

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed comparison.

## Development

### Project Structure

```
mos/
├── app/                    # Expo Router pages
│   └── (tabs)/
│       ├── index.tsx      # Main printer screen
│       └── explore.tsx    # Settings screen
├── src/                   # Core logic
│   ├── bluetooth/
│   ├── image/
│   ├── printer/
│   └── services/
├── components/            # UI components
├── constants/             # Theme and constants
└── assets/               # Images and fonts
```

### Adding New Dithering Algorithms

1. Add algorithm to `src/image/dithering.ts`:
```typescript
export function myDither(img: GrayscaleImage): BinaryImage {
  // Your algorithm here
  return binaryImage;
}
```

2. Update `DitheringAlgorithm` type:
```typescript
export type DitheringAlgorithm = 
  | 'floyd-steinberg' 
  | 'my-algorithm';
```

3. Add to `applyDithering()` switch statement

4. Update UI in `app/(tabs)/index.tsx`

### Testing

```bash
# Run type checking
npx tsc --noEmit

# Run linter
npm run lint

# Build for production
npm run build
```

## Performance Optimization

### Current Performance

- Image processing: ~1-3 seconds (depends on size)
- Command generation: <100ms
- BLE transmission: ~5-10 seconds (depends on image complexity)

### Optimization Ideas

1. **Native Modules**: Implement dithering in Swift/Kotlin
2. **Web Workers**: Offload processing to background thread
3. **Caching**: Cache processed images
4. **Streaming**: Process and send image in chunks
5. **GPU Acceleration**: Use Metal/OpenGL for image processing

## Contributing

Contributions are welcome! Please ensure:

1. Code follows TypeScript best practices
2. Algorithms maintain compatibility with Python version
3. UI is accessible and user-friendly
4. Documentation is updated

## License

MIT License - see LICENSE file

## Credits

- Original Python implementation: [rbaron/catprinter](https://github.com/rbaron/catprinter)
- Dithering algorithms: Wikipedia, Tanner Helland
- BLE protocol: Reverse-engineered from official Android app

## Support

For issues and questions:
- Check [Troubleshooting](#troubleshooting) section
- Review [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
- Open an issue on GitHub

---

**Made with ❤️ for thermal printer enthusiasts**
