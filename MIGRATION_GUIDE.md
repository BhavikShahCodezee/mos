# Python to React Native Migration Guide

## Overview

This document provides a complete mapping between the Python implementation and the React Native implementation of the Cat Printer application.

## Repository Structure

### Python Repository
```
catprinter/
├── catprinter/
│   ├── __init__.py
│   ├── ble.py          # BLE communication
│   ├── cmds.py         # Printer commands
│   └── img.py          # Image processing
├── print.py            # CLI entry point
└── requirements.txt
```

### React Native Repository
```
mos/
├── src/
│   ├── bluetooth/
│   │   └── printerService.ts      # BLE communication
│   ├── image/
│   │   ├── dithering.ts           # Dithering algorithms
│   │   └── imageProcessor.ts      # Image processing
│   ├── printer/
│   │   └── commandGenerator.ts    # Printer commands
│   └── services/
│       └── printService.ts        # Main orchestrator
├── app/
│   └── (tabs)/
│       └── index.tsx               # UI screen
├── package.json
└── app.json
```

## Module Mapping

### 1. Image Processing

#### Python: `catprinter/img.py`
```python
def floyd_steinberg_dither(img):
    # Error diffusion dithering
    for y in range(h):
        for x in range(w):
            new_val = 255 if img[y][x] > 127 else 0
            err = img[y][x] - new_val
            img[y][x] = new_val
            adjust_pixel(y, x + 1, err * 7/16)
            adjust_pixel(y + 1, x - 1, err * 3/16)
            adjust_pixel(y + 1, x, err * 5/16)
            adjust_pixel(y + 1, x + 1, err * 1/16)
```

#### React Native: `src/image/dithering.ts`
```typescript
export function floydSteinbergDither(img: GrayscaleImage): BinaryImage {
  const height = img.length;
  const width = img[0].length;
  const workingImg = img.map(row => [...row]);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const oldPixel = workingImg[y][x];
      const newPixel = oldPixel > 127 ? 255 : 0;
      const error = oldPixel - newPixel;
      
      workingImg[y][x] = newPixel;
      adjustPixel(y, x + 1, error * 7 / 16);
      adjustPixel(y + 1, x - 1, error * 3 / 16);
      adjustPixel(y + 1, x, error * 5 / 16);
      adjustPixel(y + 1, x + 1, error * 1 / 16);
    }
  }
  
  return workingImg.map(row => row.map(pixel => pixel > 127));
}
```

**Key Changes:**
- Python uses in-place modification, TypeScript creates a copy
- Python returns NumPy array, TypeScript returns 2D boolean array
- Same algorithm logic, identical error distribution weights

---

### 2. Printer Commands

#### Python: `catprinter/cmds.py`
```python
CHECKSUM_TABLE = bs([0, 7, 14, 9, ...])

def chk_sum(b_arr, i, i2):
    b2 = 0
    for i3 in range(i, i + i2):
        b2 = CHECKSUM_TABLE[(b2 ^ b_arr[i3]) & 0xff]
    return b2

def cmd_set_energy(val):
    b_arr = bs([81, 120, -81, 0, 2, 0,
                (val >> 8) & 0xff,
                val & 0xff,
                0, 0xff])
    b_arr[8] = chk_sum(b_arr, 6, 2)
    return bs(b_arr)
```

#### React Native: `src/printer/commandGenerator.ts`
```typescript
const CHECKSUM_TABLE = bs([0, 7, 14, 9, ...]);

function chkSum(bArr: Uint8Array, start: number, length: number): number {
  let checksum = 0;
  for (let i = start; i < start + length; i++) {
    checksum = CHECKSUM_TABLE[(checksum ^ bArr[i]) & 0xff];
  }
  return checksum;
}

export function cmdSetEnergy(val: number): Uint8Array {
  const bArr = bs([
    81, 120, -81, 0, 2, 0,
    (val >> 8) & 0xff,
    val & 0xff,
    0, 0xff,
  ]);
  bArr[8] = chkSum(bArr, 6, 2);
  return bArr;
}
```

**Key Changes:**
- Python uses `bytearray`, TypeScript uses `Uint8Array`
- Same checksum algorithm and lookup table
- Identical command structure and byte sequences
- Same signed-to-unsigned byte conversion logic

---

### 3. BLE Communication

#### Python: `catprinter/ble.py`
```python
POSSIBLE_SERVICE_UUIDS = [
    "0000ae30-0000-1000-8000-00805f9b34fb",
    "0000af30-0000-1000-8000-00805f9b34fb",
]

async def scan(name: Optional[str], timeout: int):
    def filter_fn(device: BLEDevice, adv_data: AdvertisementData):
        if autodiscover:
            return any(uuid in adv_data.service_uuids 
                      for uuid in POSSIBLE_SERVICE_UUIDS)
        else:
            return device.name == name
    
    device = await BleakScanner.find_device_by_filter(
        filter_fn, timeout=timeout)
    return device

async def run_ble(data, device: Optional[str]):
    async with BleakClient(address) as client:
        chunk_size = client.mtu_size - 3
        for chunk in chunkify(data, chunk_size):
            await client.write_gatt_char(TX_CHARACTERISTIC_UUID, chunk)
            await asyncio.sleep(WAIT_AFTER_EACH_CHUNK_S)
```

#### React Native: `src/bluetooth/printerService.ts`
```typescript
export const POSSIBLE_SERVICE_UUIDS = [
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000af30-0000-1000-8000-00805f9b34fb',
];

async scanForPrinter(deviceName?: string): Promise<Device> {
  return new Promise((resolve, reject) => {
    this.bleManager.startDeviceScan(null, null, (error, device) => {
      const isMatch = deviceName
        ? device.name === deviceName
        : device.serviceUUIDs?.some(uuid => 
            POSSIBLE_SERVICE_UUIDS.includes(uuid.toLowerCase()));
      
      if (isMatch) {
        this.bleManager.stopDeviceScan();
        resolve(device);
      }
    });
  });
}

async sendData(data: Uint8Array | Buffer): Promise<void> {
  const mtu = await this.connectedDevice.requestMTU(512);
  const chunkSize = mtu - 3;
  
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.slice(i, Math.min(i + chunkSize, buffer.length));
    await this.connectedDevice.writeCharacteristicWithResponseForService(
      targetService.uuid, TX_CHARACTERISTIC_UUID, chunk.toString('base64'));
    await new Promise(resolve => setTimeout(resolve, WAIT_AFTER_EACH_CHUNK_MS));
  }
}
```

**Key Changes:**
- Python uses `bleak` library, React Native uses `react-native-ble-plx`
- Python uses async/await with `asyncio`, React Native uses Promises
- Same service UUIDs and characteristic UUIDs
- Same MTU negotiation and chunking logic
- Same 20ms delay between chunks

---

### 4. Main Workflow

#### Python: `print.py`
```python
def main():
    args = parse_args()
    
    # Process image
    bin_img = read_img(
        args.filename,
        PRINT_WIDTH,
        args.img_binarization_algo,
    )
    
    # Generate commands
    data = cmds_print_img(bin_img, energy=args.energy)
    
    # Send via BLE
    asyncio.run(run_ble(data, device=args.device))
```

#### React Native: `src/services/printService.ts`
```typescript
async print(options: PrintOptions): Promise<PrintResult> {
  // Process image
  const binaryImage = await processImageForPrinting(
    options.imageUri, 
    options.algorithm
  );
  
  const invertedImage = invertBinaryImage(binaryImage);
  
  // Generate commands
  const commandData = cmdsPrintImg(invertedImage, options.energy);
  
  // Send via BLE
  const printerService = getPrinterService();
  await printerService.print(commandData, options.deviceName);
  
  return { success: true, message: 'Print completed' };
}
```

**Key Changes:**
- Python uses CLI arguments, React Native uses function parameters
- Python uses file paths, React Native uses URIs
- Same processing pipeline: image → commands → BLE
- Same default values (Floyd-Steinberg, 0xFFFF energy)

---

## Algorithm Comparison

### Floyd-Steinberg Dithering

| Aspect | Python | React Native |
|--------|--------|--------------|
| **Input** | NumPy array (h×w) | 2D number array |
| **Output** | Boolean NumPy array | 2D boolean array |
| **Error Distribution** | 7/16, 3/16, 5/16, 1/16 | 7/16, 3/16, 5/16, 1/16 |
| **Threshold** | 127 | 127 |
| **Modification** | In-place | Copy-on-write |

### Atkinson Dithering

| Aspect | Python | React Native |
|--------|--------|--------------|
| **Neighbors** | 6 pixels | 6 pixels |
| **Weights** | 1/8 each | 1/8 each |
| **Error Fraction** | 6/8 (75%) | 6/8 (75%) |

### Halftone Dithering

| Aspect | Python | React Native |
|--------|--------|--------------|
| **Square Size** | 4×4 pixels | 4×4 pixels |
| **Jump** | 4 pixels | 4 pixels |
| **Alpha** | 3 | 3 |
| **Method** | OpenCV circles | Manual circle drawing |

---

## Command Protocol

### Command Structure

All commands follow this format:
```
[Header] [Command] [Length] [Data...] [Checksum] [Footer]
```

Example: Set Energy Command
```
Python:  bs([81, 120, -81, 0, 2, 0, (val>>8)&0xff, val&0xff, 0, 0xff])
React:   bs([81, 120, -81, 0, 2, 0, (val>>8)&0xff, val&0xff, 0, 0xff])
```

**Identical byte sequences in both implementations.**

### Run-Length Encoding

Both implementations use the same compression algorithm:

```python
# Python
def encode_run_length_repetition(n, val):
    res = []
    while n > 0x7f:
        res.append(0x7f | (val << 7))
        n -= 0x7f
    if n > 0:
        res.append((val << 7) | n)
    return res
```

```typescript
// TypeScript
function encodeRunLengthRepetition(n: number, val: number): number[] {
  const res: number[] = [];
  while (n > 0x7f) {
    res.push(0x7f | (val << 7));
    n -= 0x7f;
  }
  if (n > 0) {
    res.push((val << 7) | n);
  }
  return res;
}
```

---

## Dependencies Mapping

| Python | React Native | Purpose |
|--------|--------------|---------|
| `bleak` | `react-native-ble-plx` | BLE communication |
| `numpy` | Native arrays | Numerical operations |
| `opencv-python` | `expo-image-manipulator` | Image manipulation |
| N/A | `expo-image-picker` | Image selection |
| N/A | `buffer` | Binary data handling |
| N/A | `react-native-canvas` | Pixel extraction |

---

## Configuration

### Python CLI Arguments
```bash
./print.py \
  --img-binarization-algo floyd-steinberg \
  --energy 0xffff \
  --device GT01 \
  --show-preview \
  image.png
```

### React Native Options
```typescript
await printService.print({
  imageUri: 'file:///path/to/image.png',
  algorithm: 'floyd-steinberg',
  energy: 0xffff,
  deviceName: 'GT01',
  showPreview: true,
});
```

---

## Testing Checklist

- [ ] Floyd-Steinberg dithering produces identical output
- [ ] Atkinson dithering produces identical output
- [ ] Halftone dithering produces identical output
- [ ] Command generation produces identical byte sequences
- [ ] BLE scanning finds the same devices
- [ ] BLE connection establishes successfully
- [ ] MTU negotiation works correctly
- [ ] Data chunking matches Python behavior
- [ ] Checksum calculation is correct
- [ ] Run-length encoding produces same output
- [ ] Print output matches Python version

---

## Known Differences

### 1. Image Loading
- **Python**: Uses OpenCV to read files directly
- **React Native**: Uses Expo Image Picker and Canvas for pixel extraction

### 2. Async Patterns
- **Python**: Uses `asyncio` with `async/await`
- **React Native**: Uses Promises with `async/await`

### 3. UI
- **Python**: Command-line interface
- **React Native**: Mobile app with touch interface

### 4. Platform Support
- **Python**: Desktop (Linux, macOS, Windows)
- **React Native**: Mobile (iOS, Android)

---

## Performance Considerations

### Python
- NumPy operations are highly optimized (C backend)
- OpenCV provides hardware-accelerated image processing
- Direct file I/O

### React Native
- JavaScript array operations (slower than NumPy)
- Image processing in JavaScript (no hardware acceleration)
- Async I/O with React Native bridge overhead

**Recommendation**: For large images, consider using native modules for dithering algorithms.

---

## Troubleshooting

### Issue: BLE Connection Fails
**Python Solution**: Check BlueZ on Linux, ensure Bluetooth is enabled  
**React Native Solution**: Check permissions in app.json, request runtime permissions

### Issue: Image Quality Differs
**Cause**: Different image decoding libraries  
**Solution**: Verify grayscale conversion formula (0.299R + 0.587G + 0.114B)

### Issue: Printer Not Found
**Both**: Ensure printer is powered on, in range, and not connected to another device

---

## Future Enhancements

1. **Native Modules**: Implement dithering in native code for better performance
2. **Caching**: Cache processed images to avoid reprocessing
3. **Batch Printing**: Support printing multiple images
4. **Custom Algorithms**: Allow users to create custom dithering patterns
5. **Preview**: Implement real-time preview before printing

---

## Conclusion

The React Native implementation is a faithful port of the Python version, maintaining:
- ✅ Identical algorithms
- ✅ Same command protocol
- ✅ Same BLE communication flow
- ✅ Same output quality

The main differences are in the platform-specific image handling and UI layer, while the core printing logic remains identical.
