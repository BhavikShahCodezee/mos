/**
 * Printer Command Generator
 * 
 * Generates binary commands for the thermal printer.
 * All commands are reverse-engineered from the official Android app.
 * 
 * Ported from Python implementation: catprinter/cmds.py
 */

import { Buffer } from 'buffer';
import { BinaryImage } from '../image/dithering';

export const PRINT_WIDTH = 384;

/**
 * Convert a signed byte to unsigned byte
 * (Handles Java-style signed bytes from reverse engineering)
 */
function toUnsignedByte(val: number): number {
  return val >= 0 ? val : val & 0xff;
}

/**
 * Create a Uint8Array from a list of signed bytes
 */
function bs(lst: number[]): Uint8Array {
  return new Uint8Array(lst.map(toUnsignedByte));
}

/**
 * Checksum lookup table for command validation
 */
const CHECKSUM_TABLE = bs([
  0, 7, 14, 9, 28, 27, 18, 21, 56, 63, 54, 49, 36, 35, 42, 45, 112, 119, 126, 121,
  108, 107, 98, 101, 72, 79, 70, 65, 84, 83, 90, 93, -32, -25, -18, -23, -4, -5,
  -14, -11, -40, -33, -42, -47, -60, -61, -54, -51, -112, -105, -98, -103, -116,
  -117, -126, -123, -88, -81, -90, -95, -76, -77, -70, -67, -57, -64, -55, -50,
  -37, -36, -43, -46, -1, -8, -15, -10, -29, -28, -19, -22, -73, -80, -71, -66,
  -85, -84, -91, -94, -113, -120, -127, -122, -109, -108, -99, -102, 39, 32, 41,
  46, 59, 60, 53, 50, 31, 24, 17, 22, 3, 4, 13, 10, 87, 80, 89, 94, 75, 76, 69, 66,
  111, 104, 97, 102, 115, 116, 125, 122, -119, -114, -121, -128, -107, -110, -101,
  -100, -79, -74, -65, -72, -83, -86, -93, -92, -7, -2, -9, -16, -27, -30, -21, -20,
  -63, -58, -49, -56, -35, -38, -45, -44, 105, 110, 103, 96, 117, 114, 123, 124, 81,
  86, 95, 88, 77, 74, 67, 68, 25, 30, 23, 16, 5, 2, 11, 12, 33, 38, 47, 40, 61, 58,
  51, 52, 78, 73, 64, 71, 82, 85, 92, 91, 118, 113, 120, 127, 106, 109, 100, 99, 62,
  57, 48, 55, 34, 37, 44, 43, 6, 1, 8, 15, 26, 29, 20, 19, -82, -87, -96, -89, -78,
  -75, -68, -69, -106, -111, -104, -97, -118, -115, -124, -125, -34, -39, -48, -41,
  -62, -59, -52, -53, -26, -31, -24, -17, -6, -3, -12, -13,
]);

/**
 * Calculate checksum for command validation
 */
function chkSum(bArr: Uint8Array, start: number, length: number): number {
  let checksum = 0;
  for (let i = start; i < start + length; i++) {
    checksum = CHECKSUM_TABLE[(checksum ^ bArr[i]) & 0xff];
  }
  return checksum;
}

/**
 * Pre-defined printer commands (reverse-engineered)
 */
export const CMD_GET_DEV_STATE = bs([81, 120, -93, 0, 1, 0, 0, 0, -1]);

export const CMD_SET_QUALITY_200_DPI = bs([81, 120, -92, 0, 1, 0, 50, -98, -1]);

export const CMD_GET_DEV_INFO = bs([81, 120, -88, 0, 1, 0, 0, 0, -1]);

export const CMD_LATTICE_START = bs([
  81, 120, -90, 0, 11, 0, -86, 85, 23,
  56, 68, 95, 95, 95, 68, 56, 44, -95, -1
]);

export const CMD_LATTICE_END = bs([
  81, 120, -90, 0, 11, 0, -86, 85,
  23, 0, 0, 0, 0, 0, 0, 0, 23, 17, -1
]);

export const CMD_SET_PAPER = bs([81, 120, -95, 0, 2, 0, 48, 0, -7, -1]);

export const CMD_PRINT_IMG = bs([81, 120, -66, 0, 1, 0, 0, 0, -1]);

export const CMD_PRINT_TEXT = bs([81, 120, -66, 0, 1, 0, 1, 7, -1]);

/**
 * Generate command to feed paper
 */
export function cmdFeedPaper(amount: number): Uint8Array {
  const bArr = bs([
    81, 120, -67, 0, 1, 0,
    amount & 0xff,
    0,
    0xff,
  ]);
  bArr[7] = chkSum(bArr, 6, 1);
  return bArr;
}

/**
 * Generate command to set thermal energy (darkness)
 * 
 * @param val - Energy value (0x0000 = light, 0xFFFF = darkest)
 */
export function cmdSetEnergy(val: number): Uint8Array {
  const bArr = bs([
    81, 120, -81, 0, 2, 0,
    (val >> 8) & 0xff,  // High byte
    val & 0xff,          // Low byte
    0,
    0xff,
  ]);
  bArr[8] = chkSum(bArr, 6, 2);
  return bArr;
}

/**
 * Generate command to apply energy setting
 */
export function cmdApplyEnergy(): Uint8Array {
  const bArr = bs([
    81, 120, -66, 0, 1, 0, 1, 0, 0xff,
  ]);
  bArr[7] = chkSum(bArr, 6, 1);
  return bArr;
}

/**
 * Set paper feed speed (quality). Lower = faster feed; 28–40 typical. Slower = better heating.
 * Cat-Printer: make_command(0xbd, int_to_bytes(value))
 */
export function cmdSetSpeed(value: number): Uint8Array {
  const v = Math.max(4, Math.min(255, value));
  const bArr = bs([
    81, 120, -67, 0, 1, 0, v, 0, 0xff,
  ]);
  bArr[7] = chkSum(bArr, 6, 1);
  return bArr;
}

/**
 * Encode a run of repeated values for run-length compression
 */
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

/**
 * Run-length encode an image row
 * 
 * Compresses consecutive identical pixel values.
 */
function runLengthEncode(imgRow: boolean[]): number[] {
  const res: number[] = [];
  let count = 0;
  let lastVal = -1;
  
  for (const pixel of imgRow) {
    const val = pixel ? 1 : 0;
    if (val === lastVal) {
      count++;
    } else {
      res.push(...encodeRunLengthRepetition(count, lastVal));
      count = 1;
    }
    lastVal = val;
  }
  
  if (count > 0) {
    res.push(...encodeRunLengthRepetition(count, lastVal));
  }
  
  return res;
}

/**
 * Byte encode an image row (8 pixels per byte)
 * 
 * Fallback encoding when run-length compression is inefficient.
 */
function byteEncode(imgRow: boolean[]): number[] {
  const res: number[] = [];
  
  for (let chunkStart = 0; chunkStart < imgRow.length; chunkStart += 8) {
    let byte = 0;
    for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
      if (imgRow[chunkStart + bitIndex]) {
        byte |= 1 << bitIndex;
      }
    }
    res.push(byte);
  }
  
  return res;
}

/**
 * Generate command to print a single row of pixels
 */
export function cmdPrintRow(imgRow: boolean[]): Uint8Array {
  // Try run-length compression first
  let encodedImg = runLengthEncode(imgRow);
  
  // If compression doesn't help, use fixed-length encoding
  if (encodedImg.length > PRINT_WIDTH / 8) {
    encodedImg = byteEncode(imgRow);
    const bArr = bs([
      81, 120, -94, 0,
      encodedImg.length, 0,
      ...encodedImg,
      0, 0xff
    ]);
    bArr[bArr.length - 2] = chkSum(bArr, 6, encodedImg.length);
    return bArr;
  }
  
  // Build run-length encoded command
  const bArr = bs([
    81, 120, -65, 0,
    encodedImg.length, 0,
    ...encodedImg,
    0, 0xff
  ]);
  bArr[bArr.length - 2] = chkSum(bArr, 6, encodedImg.length);
  return bArr;
}

/**
 * Generate complete command sequence to print an image
 *
 * @param img - Binary image (2D array of booleans)
 * @param energy - Thermal energy (0x0000-0xFFFF)
 * @param quality - Paper feed speed 28-40 (lower = faster; slower = better heating)
 */
export function cmdsPrintImg(
  img: BinaryImage,
  energy: number = 0xffff,
  quality: number = 36
): Uint8Array {
  const parts: Uint8Array[] = [
    CMD_GET_DEV_STATE,
    CMD_SET_QUALITY_200_DPI,
    cmdSetSpeed(quality),
    cmdSetEnergy(energy),
    cmdApplyEnergy(),
    CMD_LATTICE_START,
  ];
  
  // Add row commands
  for (const row of img) {
    parts.push(cmdPrintRow(row));
  }
  
  // Add finalization commands
  parts.push(
    cmdFeedPaper(25),
    CMD_SET_PAPER,
    CMD_SET_PAPER,
    CMD_SET_PAPER,
    CMD_LATTICE_END,
    CMD_GET_DEV_STATE
  );
  
  // Concatenate all parts
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  
  return result;
}

/**
 * Convert Uint8Array to Buffer for BLE transmission
 */
export function toBuffer(data: Uint8Array): Buffer {
  return Buffer.from(data);
}
