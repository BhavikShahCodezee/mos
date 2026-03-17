/**
 * App settings (Cat-Printer–style).
 * In-memory; can be wired to AsyncStorage later.
 */

let scanTimeMs = 4000;
let flip = false;
let dryRun = false;
/** Paper feed speed 28–40. Slower = better heating. */
let quality = 36;

export function getScanTimeMs(): number {
  return scanTimeMs;
}

export function setScanTimeMs(ms: number): void {
  scanTimeMs = Math.max(1000, Math.min(10000, ms));
}

export function getFlip(): boolean {
  return flip;
}

export function setFlip(value: boolean): void {
  flip = value;
}

export function getDryRun(): boolean {
  return dryRun;
}

export function setDryRun(value: boolean): void {
  dryRun = value;
}

export function getQuality(): number {
  return quality;
}

export function setQuality(value: number): void {
  quality = Math.max(28, Math.min(40, value));
}
