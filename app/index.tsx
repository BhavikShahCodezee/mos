import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
  useColorScheme,
  TextInput,
  Text,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import type { Device } from 'react-native-ble-plx';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getPrintService } from '@/src/services/printService';
import { getPrinterService } from '@/src/bluetooth/printerService';
import { DitheringAlgorithm } from '@/src/image/dithering';
import { wrapTextToLines } from '@/src/text/textWrap';
import { printTextDirect } from '@/src/text/textPrintService';
import {
  getScanTimeMs,
  setScanTimeMs,
  getFlip,
  setFlip,
  getDryRun,
  setDryRun,
  getQuality,
  setQuality,
} from '@/src/settings';
import { loadSavedPrinter, savePrinter, clearSavedPrinter } from '@/src/storage/savedPrinter';

const ALGO_LABELS: Record<DitheringAlgorithm, string> = {
  'floyd-steinberg': 'Picture',
  atkinson: 'Atkinson',
  halftone: 'Pattern',
  'mean-threshold': 'Mean',
  none: 'Text',
};

const isDark = (scheme: string | null | undefined) => scheme === 'dark';

export default function HomeScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [algorithm, setAlgorithm] = useState<DitheringAlgorithm>('floyd-steinberg');
  const [threshold, setThreshold] = useState(127);
  const [energy, setEnergy] = useState(0xffff);
  const [quality, setQualityState] = useState(getQuality());
  const [rotate, setRotate] = useState(false);
  const [transparentAsWhite, setTransparentAsWhite] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [savedDeviceId, setSavedDeviceId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanTimeSec, setScanTimeSec] = useState(String(getScanTimeMs() / 1000));
  const [flip, setFlipState] = useState(getFlip());
  const [dryRun, setDryRunState] = useState(getDryRun());
  const [textContent, setTextContent] = useState('');
  const [textSize, setTextSize] = useState(20);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [wrapBySpaces, setWrapBySpaces] = useState(true);

  const colorScheme = useColorScheme();
  const dark = isDark(colorScheme);
  const printService = getPrintService();
  const algorithms = printService.getAvailableAlgorithms();
  const connected = printService.isConnected();
  const connectedDeviceName = connected ? getPrinterService().getConnectedDevice()?.name ?? 'Printer' : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadSavedPrinter();
        if (cancelled) return;
        if (!saved) return;

        setSavedDeviceId(saved.id);

        // Auto-connect: scan briefly and connect if found.
        // We try by ID first (best on Android), then by name.
        const list = await printService.scanForPrinters(2500, true);
        if (cancelled) return;
        const match =
          list.find((d) => d.id === saved.id) ||
          (saved.name ? list.find((d) => d.name === saved.name) : undefined);

        if (match) {
          setSelectedDevice(match);
          await printService.connectToDevice(match);
        }
      } catch {
        // Silent: permissions/BLE state might not be ready on first open.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [printService]);

  const onScan = useCallback((listAll: boolean) => async () => {
    setScanning(true);
    try {
      const list = await printService.scanForPrinters(getScanTimeMs(), listAll);
      setDevices(list);
      if (list.length === 0) {
        Alert.alert('No devices', 'No printers found. Turn on the printer and try again.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Scan failed';
      if (!msg.includes('Expo Go')) Alert.alert('Scan error', msg);
    } finally {
      setScanning(false);
    }
  }, [printService]);

  const onSelectDevice = useCallback(async (device: Device) => {
    setSelectedDevice(device);
    setIsPrinting(true);
    try {
      const result = await printService.connectToDevice(device);
      if (!result.success) Alert.alert('Connection failed', result.message);
      else {
        await savePrinter({ id: device.id, name: device.name });
        setSavedDeviceId(device.id);
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsPrinting(false);
    }
  }, [printService]);

  const onDisconnect = useCallback(async () => {
    await printService.disconnect();
    setSelectedDevice(null);
  }, [printService]);

  const onForgetDevice = useCallback(async () => {
    await clearSavedPrinter();
    setSavedDeviceId(null);
    Alert.alert('Saved device cleared', 'We will not auto-connect next time.');
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Permission to access photos is required!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) setSelectedImage(result.assets[0].uri);
  };

  const onReset = () => setSelectedImage(null);

  const textLines = wrapTextToLines(textContent, textSize, wrapBySpaces);
  const hasText = textContent.trim().length > 0;

  const handlePrintText = async () => {
    const showPrintErrorDialog = (title: string, err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      const body = [
        message,
        stack ? `\nStack:\n${stack}` : '',
      ].join('');
      // Alert can get very long; keep useful diagnostics while staying readable in screenshot.
      const clipped = body.length > 1800 ? `${body.slice(0, 1800)}\n\n...truncated...` : body;
      Alert.alert(title, clipped);
    };

    if (!hasText) {
      Alert.alert('No text', 'Enter some text first.');
      return;
    }
    if (!connected || !selectedDevice) {
      Alert.alert('Printer not connected', 'Connect a printer before printing text.');
      return;
    }
    setIsPrinting(true);
    try {
      console.log('📝 Text print requested');
      console.log(`   chars=${textContent.length} lines=${textLines.length}`);
      console.log(`   textSize=${textSize} align=${textAlign} wrapBySpaces=${wrapBySpaces}`);
      const result = await printTextDirect({
        text: textContent,
        fontSize: textSize,
        align: textAlign,
        wrapBySpaces,
        energy,
        device: selectedDevice,
      });
      if (result.success) {
        Alert.alert('Success', `Text printed!\n${result.imageSize?.width}x${result.imageSize?.height}px • ${result.dataSize} bytes`);
      } else {
        showPrintErrorDialog('Print Failed', result.error ?? new Error(result.message));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('Expo Go')) {
        Alert.alert('Bluetooth Not Available', 'Use a development build for Bluetooth.', [{ text: 'OK' }]);
      } else {
        showPrintErrorDialog('Print Failed', error);
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrint = async () => {
    const showPrintErrorDialog = (title: string, err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      const body = [
        message,
        stack ? `\nStack:\n${stack}` : '',
      ].join('');
      const clipped = body.length > 1800 ? `${body.slice(0, 1800)}\n\n...truncated...` : body;
      Alert.alert(title, clipped);
    };

    if (!selectedImage) {
      Alert.alert('No Image', 'Please select an image first');
      return;
    }
    setIsPrinting(true);
    try {
      const result = await printService.print({
        imageUri: selectedImage,
        algorithm,
        energy,
        threshold,
        rotate,
        transparentAsWhite,
        ...(connected && selectedDevice ? { device: selectedDevice } : { deviceName: selectedDevice?.name ?? undefined }),
      });
      if (result.success) {
        Alert.alert('Success', `Print completed!\n${result.imageSize?.height}x${result.imageSize?.width}px • ${result.dataSize} bytes`);
      } else {
        showPrintErrorDialog('Print Failed', result.error ?? new Error(result.message));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('Expo Go')) {
        Alert.alert('Bluetooth Not Available', 'Use a development build. See BUILD_INSTRUCTIONS.md.', [{ text: 'OK' }]);
      } else {
        showPrintErrorDialog('Print Failed', error);
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const testConnection = async () => {
    setIsPrinting(true);
    try {
      const result = await printService.testConnection(selectedDevice?.name ?? undefined);
      Alert.alert(result.success ? 'Success' : 'Connection Failed', result.message);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsPrinting(false);
    }
  };

  const syncScanTime = () => {
    const sec = parseFloat(scanTimeSec);
    if (!Number.isNaN(sec) && sec >= 1 && sec <= 10) {
      setScanTimeMs(Math.round(sec * 1000));
    }
  };

  return (
    <ScrollView
      style={[styles.container, dark && styles.containerDark]}
      contentContainerStyle={styles.contentWrap}
      showsVerticalScrollIndicator={false}
    >
      <ThemedView style={styles.content}>
        <ThemedText type="title" style={styles.title}>Cat Printer</ThemedText>

        {Platform.OS !== 'web' && (
          <ThemedView style={styles.warningBanner}>
            <ThemedText style={styles.warningText}>⚠️ Expo Go? Use a dev build for Bluetooth</ThemedText>
          </ThemedView>
        )}

        {/* Device */}
        <ThemedView style={[styles.section, dark && styles.sectionDark]}>
          {connected ? (
            <View style={styles.connectedRow}>
              <View style={styles.connectedBadge}>
                <View style={styles.connectedDot} />
                <ThemedText style={styles.connectedLabel}>Connected to {connectedDeviceName}</ThemedText>
              </View>
              <TouchableOpacity style={styles.disconnectBtn} onPress={onDisconnect} disabled={isPrinting}>
                <ThemedText style={styles.disconnectBtnText}>Disconnect</ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ThemedText type="subtitle" style={styles.sectionTitle}>Device</ThemedText>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.primaryButton, scanning && styles.buttonDisabled]}
                  onPress={onScan(false)}
                  disabled={isPrinting}
                >
                  {scanning ? <ActivityIndicator color="#fff" size="small" /> : <ThemedText style={styles.primaryButtonText}>Scan</ThemedText>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryButton, scanning && styles.buttonDisabled]}
                  onPress={onScan(true)}
                  disabled={isPrinting}
                >
                  <ThemedText style={styles.secondaryButtonText}>Test unknown device</ThemedText>
                </TouchableOpacity>
              </View>
              {!!savedDeviceId && (
                <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ThemedText style={{ fontSize: 13, opacity: 0.75 }}>Saved device: {savedDeviceId}</ThemedText>
                  <TouchableOpacity onPress={onForgetDevice} disabled={isPrinting}>
                    <ThemedText style={{ fontSize: 13, fontWeight: '600', color: '#FF5722' }}>Forget</ThemedText>
                  </TouchableOpacity>
                </View>
              )}
              {devices.length > 0 && !connected && (
                <View style={styles.deviceList}>
                  {devices.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.deviceItem, dark && styles.deviceItemDark, selectedDevice?.id === d.id && styles.deviceItemSelected]}
                      onPress={() => onSelectDevice(d)}
                      disabled={isPrinting}
                    >
                      <ThemedText style={styles.deviceName}>
                        {(d.name ?? 'Unknown')}{savedDeviceId === d.id ? ' (Saved)' : ''}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </ThemedView>

        {/* Image */}
        <ThemedView style={[styles.section, dark && styles.sectionDark]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Image</ThemedText>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.primaryButton, isPrinting && styles.buttonDisabled]} onPress={pickImage} disabled={isPrinting}>
              <ThemedText style={styles.primaryButtonText}>Insert picture</ThemedText>
            </TouchableOpacity>
            {selectedImage && (
              <TouchableOpacity style={styles.secondaryButton} onPress={onReset} disabled={isPrinting}>
                <ThemedText style={styles.secondaryButtonText}>Reset</ThemedText>
              </TouchableOpacity>
            )}
          </View>
          {selectedImage && (
            <View style={[styles.imagePreview, dark && styles.imagePreviewDark]}>
              <Image source={{ uri: selectedImage }} style={styles.previewImage} contentFit="contain" />
            </View>
          )}
        </ThemedView>

        {/* Insert text (Cat-Printer style: size, align, wrap, preview) */}
        <ThemedView style={[styles.section, dark && styles.sectionDark]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Insert text</ThemedText>
          <TextInput
            style={[styles.textArea, dark && styles.textAreaDark]}
            placeholder="Enter text here..."
            placeholderTextColor={dark ? '#888' : '#999'}
            value={textContent}
            onChangeText={setTextContent}
            multiline
            editable={!isPrinting}
          />
          <ThemedText style={styles.label}>Size</ThemedText>
          <View style={styles.chipRow}>
            {[12, 16, 20, 24, 28].map((size) => (
              <TouchableOpacity
                key={size}
                style={[styles.chip, dark && styles.chipDark, textSize === size && styles.chipActive]}
                onPress={() => setTextSize(size)}
                disabled={isPrinting}
              >
                <ThemedText style={[styles.chipText, textSize === size && styles.chipTextActive]}>{size}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
          <ThemedText style={styles.label}>Align</ThemedText>
          <View style={styles.chipRow}>
            {(['left', 'center', 'right'] as const).map((align) => (
              <TouchableOpacity
                key={align}
                style={[styles.chip, dark && styles.chipDark, textAlign === align && styles.chipActive]}
                onPress={() => setTextAlign(align)}
                disabled={isPrinting}
              >
                <ThemedText style={[styles.chipText, textAlign === align && styles.chipTextActive]}>{align === 'left' ? 'Left' : align === 'center' ? 'Center' : 'Right'}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.switchRow}>
            <ThemedText style={styles.switchLabel}>Wrap words by spaces</ThemedText>
            <Switch value={wrapBySpaces} onValueChange={setWrapBySpaces} disabled={isPrinting} />
          </View>
          <ThemedText style={styles.label}>Preview (horizontal strip)</ThemedText>
          <View
            style={styles.textPreviewStrip}
          >
            {textLines.length > 0 ? (
              textLines.map((line, i) => (
                <Text
                  key={i}
                  style={[
                    styles.textPreviewLine,
                    { fontSize: textSize, textAlign },
                  ]}
                >
                  {line}
                </Text>
              ))
            ) : (
              <Text style={[styles.textPreviewLine, styles.textPreviewPlaceholder]}>Preview</Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.primaryButton, (isPrinting || !hasText) && styles.buttonDisabled]}
            onPress={handlePrintText}
            disabled={isPrinting || !hasText}
          >
            <ThemedText style={styles.primaryButtonText}>Print text</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {/* Process as */}
        <ThemedView style={[styles.section, dark && styles.sectionDark]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Process as</ThemedText>
          <View style={styles.chipRow}>
            {algorithms.map((algo) => (
              <TouchableOpacity
                key={algo}
                style={[styles.chip, dark && styles.chipDark, algorithm === algo && styles.chipActive]}
                onPress={() => setAlgorithm(algo)}
                disabled={isPrinting}
              >
                <ThemedText style={[styles.chipText, algorithm === algo && styles.chipTextActive]}>{ALGO_LABELS[algo]}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
          <ThemedText style={styles.hint}>{printService.getAlgorithmDescription(algorithm)}</ThemedText>
        </ThemedView>

        {/* Brightness, Strength, Quality */}
        <ThemedView style={[styles.section, dark && styles.sectionDark]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Brightness & strength</ThemedText>
          <ThemedText style={styles.label}>Brightness</ThemedText>
          <View style={styles.chipRow}>
            {([64, 127, 192] as const).map((v) => (
              <TouchableOpacity key={v} style={[styles.chip, dark && styles.chipDark, threshold === v && styles.chipActive]} onPress={() => setThreshold(v)} disabled={isPrinting}>
                <ThemedText style={[styles.chipText, threshold === v && styles.chipTextActive]}>{v === 64 ? 'Light' : v === 127 ? 'Mid' : 'Dark'}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
          <ThemedText style={styles.label}>Strength</ThemedText>
          <View style={styles.chipRow}>
            {([0x5000, 0xa000, 0xffff] as const).map((v) => (
              <TouchableOpacity key={v} style={[styles.chip, dark && styles.chipDark, energy === v && styles.chipActive]} onPress={() => setEnergy(v)} disabled={isPrinting}>
                <ThemedText style={[styles.chipText, energy === v && styles.chipTextActive]}>{v === 0x5000 ? 'Light' : v === 0xa000 ? 'Medium' : 'Dark'}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
          <ThemedText style={styles.label}>Quality (paper speed, slower = better heating)</ThemedText>
          <View style={styles.chipRow}>
            {[28, 32, 36, 40].map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.chip, dark && styles.chipDark, quality === v && styles.chipActive]}
                onPress={() => { setQualityState(v); setQuality(v); }}
                disabled={isPrinting}
              >
                <ThemedText style={[styles.chipText, quality === v && styles.chipTextActive]}>{v}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </ThemedView>

        {/* Options */}
        <ThemedView style={[styles.section, dark && styles.sectionDark]}>
          <View style={styles.switchRow}>
            <ThemedText style={styles.switchLabel}>Rotate image 90°</ThemedText>
            <Switch value={rotate} onValueChange={setRotate} disabled={isPrinting} />
          </View>
          <View style={styles.switchRow}>
            <ThemedText style={styles.switchLabel}>Transparent as white</ThemedText>
            <Switch value={transparentAsWhite} onValueChange={setTransparentAsWhite} disabled={isPrinting} />
          </View>
        </ThemedView>

        {/* Settings (Cat-Printer style, on same page) */}
        <ThemedView style={[styles.section, dark && styles.sectionDark]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Settings</ThemedText>
          <View style={styles.settingRow}>
            <ThemedText style={styles.settingLabel}>Scan time (seconds)</ThemedText>
            <TextInput
              style={[styles.input, dark && styles.inputDark]}
              value={scanTimeSec}
              onChangeText={setScanTimeSec}
              onBlur={syncScanTime}
              keyboardType="decimal-pad"
              placeholder="4"
            />
          </View>
          <View style={styles.switchRow}>
            <ThemedText style={styles.switchLabel}>Flip (cat face toward)</ThemedText>
            <Switch value={flip} onValueChange={(v) => { setFlipState(v); setFlip(v); }} />
          </View>
          <View style={styles.switchRow}>
            <ThemedText style={styles.switchLabel}>Dry run (no paper)</ThemedText>
            <Switch value={dryRun} onValueChange={(v) => { setDryRunState(v); setDryRun(v); }} />
          </View>
        </ThemedView>

        {/* Print image */}
        <ThemedView style={[styles.section, dark && styles.sectionDark]}>
          <TouchableOpacity style={[styles.printButton, isPrinting && styles.buttonDisabled]} onPress={handlePrint} disabled={isPrinting || !selectedImage}>
            {isPrinting ? <ActivityIndicator color="#fff" size="small" /> : <ThemedText style={styles.printButtonText}>Print image</ThemedText>}
          </TouchableOpacity>
          {!connected && (
            <TouchableOpacity style={[styles.secondaryButton, isPrinting && styles.buttonDisabled]} onPress={testConnection} disabled={isPrinting}>
              <ThemedText style={styles.secondaryButtonText}>Test connection</ThemedText>
            </TouchableOpacity>
          )}
        </ThemedView>

        <ThemedView style={[styles.footer, dark && styles.footerDark]}>
          <ThemedText style={styles.footerText}>GT01, GB02, GB03, YT01 • Bluetooth required</ThemedText>
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerDark: { backgroundColor: '#0f0f0f' },
  contentWrap: { paddingBottom: 32 },
  content: { padding: 20 },
  title: { marginBottom: 8, textAlign: 'center', fontSize: 24, fontWeight: '700' },
  warningBanner: {
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  warningText: { color: '#996300', fontSize: 13, fontWeight: '500' },
  section: {
    marginBottom: 20,
    padding: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.04)',
    ...Platform.select({ ios: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 2 } }),
  },
  sectionDark: { backgroundColor: 'rgba(255,255,255,0.06)' },
  sectionTitle: { marginBottom: 12, fontSize: 15, fontWeight: '600' },
  connectedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  connectedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(52, 199, 89, 0.15)', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, flex: 1, minWidth: 120 },
  connectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34C759', marginRight: 10 },
  connectedLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
  disconnectBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: 'rgba(255, 87, 34, 0.15)' },
  disconnectBtnText: { color: '#FF5722', fontSize: 15, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  primaryButton: { flex: 1, backgroundColor: '#0a7ea4', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
  secondaryButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.06)' },
  secondaryButtonText: { fontSize: 15, fontWeight: '600' },
  deviceList: { marginTop: 14, gap: 10 },
  deviceItem: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.06)' },
  deviceItemDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  deviceItemSelected: { backgroundColor: 'rgba(10, 126, 164, 0.2)' },
  deviceName: { fontSize: 15 },
  imagePreview: { marginTop: 14, height: 200, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.06)' },
  imagePreviewDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  previewImage: { width: '100%', height: '100%' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  chip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.08)' },
  chipDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  chipActive: { backgroundColor: '#0a7ea4' },
  chipText: { fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  hint: { marginTop: 12, fontSize: 13, opacity: 0.75 },
  label: { fontSize: 14, marginTop: 14, marginBottom: 6 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  switchLabel: { fontSize: 15, flex: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  settingLabel: { fontSize: 15, flex: 1 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minWidth: 72, fontSize: 16 },
  inputDark: { borderColor: 'rgba(255,255,255,0.3)' },
  textArea: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, fontSize: 16, minHeight: 80, textAlignVertical: 'top' },
  textAreaDark: { borderColor: 'rgba(255,255,255,0.3)' },
  textPreviewStrip: {
    width: 384,
    minHeight: 60,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    borderRadius: 8,
  },
  textPreviewLine: { color: '#000', marginVertical: 1 },
  textPreviewPlaceholder: { color: '#999', fontSize: 14 },
  printButton: { backgroundColor: '#34C759', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  printButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  footer: { marginTop: 8, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 12 },
  footerDark: { backgroundColor: 'rgba(255,255,255,0.04)' },
  footerText: { fontSize: 12, opacity: 0.7 },
});
