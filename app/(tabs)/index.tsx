import { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getPrintService } from '@/src/services/printService';
import { DitheringAlgorithm } from '@/src/image/dithering';

export default function PrinterScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [algorithm, setAlgorithm] = useState<DitheringAlgorithm>('floyd-steinberg');
  const [energy, setEnergy] = useState<number>(0xffff);
  const [isPrinting, setIsPrinting] = useState(false);
  const [deviceName, setDeviceName] = useState<string>('');

  const printService = getPrintService();
  const algorithms = printService.getAvailableAlgorithms();

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Permission to access photos is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handlePrint = async () => {
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
        deviceName: deviceName || undefined,
      });

      if (result.success) {
        Alert.alert(
          'Success', 
          `Print completed!\nImage: ${result.imageSize?.height}x${result.imageSize?.width}px\nData: ${result.dataSize} bytes`
        );
      } else {
        Alert.alert('Print Failed', result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('Expo Go')) {
        Alert.alert(
          'Bluetooth Not Available',
          'Bluetooth requires a development build.\n\n' +
          'Run: eas build --profile development --platform android\n\n' +
          'See BUILD_INSTRUCTIONS.md for details.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const testConnection = async () => {
    setIsPrinting(true);

    try {
      const result = await printService.testConnection(deviceName || undefined);

      if (result.success) {
        Alert.alert('Success', 'Printer connection successful!');
      } else {
        Alert.alert('Connection Failed', result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('Expo Go') || errorMessage.includes('not available')) {
        Alert.alert(
          'Bluetooth Not Available',
          'You are running in Expo Go, which does not support Bluetooth.\n\n' +
          '📱 To test Bluetooth:\n' +
          '1. Run: npm install -g eas-cli\n' +
          '2. Run: eas login\n' +
          '3. Run: eas build --profile development --platform android\n' +
          '4. Install the APK on your phone\n\n' +
          'See BUILD_INSTRUCTIONS.md for full details.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Cat Printer
        </ThemedText>

        {/* Warning banner for Expo Go */}
        {Platform.OS !== 'web' && (
          <ThemedView style={styles.warningBanner}>
            <ThemedText style={styles.warningText}>
              ⚠️ Running in Expo Go? Bluetooth won't work!
            </ThemedText>
            <ThemedText style={styles.warningSubtext}>
              Use: eas build --profile development --platform android
            </ThemedText>
          </ThemedView>
        )}

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">1. Select Image</ThemedText>
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={pickImage}
            disabled={isPrinting}
          >
            <ThemedText style={styles.buttonText}>
              📷 Pick Image from Gallery
            </ThemedText>
          </TouchableOpacity>

          {selectedImage && (
            <View style={styles.imagePreview}>
              <Image 
                source={{ uri: selectedImage }} 
                style={styles.previewImage}
                contentFit="contain"
              />
            </View>
          )}
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">2. Choose Dithering Algorithm</ThemedText>
          
          <View style={styles.algorithmContainer}>
            {algorithms.map((algo) => (
              <TouchableOpacity
                key={algo}
                style={[
                  styles.algorithmButton,
                  algorithm === algo && styles.algorithmButtonActive
                ]}
                onPress={() => setAlgorithm(algo)}
                disabled={isPrinting}
              >
                <ThemedText 
                  style={[
                    styles.algorithmText,
                    algorithm === algo && styles.algorithmTextActive
                  ]}
                >
                  {algo}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          <ThemedText style={styles.description}>
            {printService.getAlgorithmDescription(algorithm)}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">3. Print Settings</ThemedText>
          
          <ThemedText style={styles.label}>
            Darkness: {(energy / 0xffff * 100).toFixed(0)}%
          </ThemedText>
          
          <View style={styles.energyButtons}>
            <TouchableOpacity 
              style={styles.smallButton}
              onPress={() => setEnergy(0x5000)}
              disabled={isPrinting}
            >
              <ThemedText>Light</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.smallButton}
              onPress={() => setEnergy(0xa000)}
              disabled={isPrinting}
            >
              <ThemedText>Medium</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.smallButton}
              onPress={() => setEnergy(0xffff)}
              disabled={isPrinting}
            >
              <ThemedText>Dark</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">4. Print</ThemedText>
          
          <TouchableOpacity 
            style={[styles.printButton, isPrinting && styles.buttonDisabled]} 
            onPress={handlePrint}
            disabled={isPrinting || !selectedImage}
          >
            {isPrinting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.printButtonText}>
                🖨️ Print Image
              </ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.testButton, isPrinting && styles.buttonDisabled]} 
            onPress={testConnection}
            disabled={isPrinting}
          >
            <ThemedText style={styles.testButtonText}>
              🔍 Test Connection
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView style={styles.infoSection}>
          <ThemedText style={styles.infoText}>
            ℹ️ Make sure your printer is turned on and in range
          </ThemedText>
          <ThemedText style={styles.infoText}>
            📱 Bluetooth permissions are required
          </ThemedText>
          <ThemedText style={styles.infoText}>
            🖨️ Compatible with GT01, GB02, GB03 printers
          </ThemedText>
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
  },
  warningBanner: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  warningSubtext: {
    color: '#856404',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  section: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  imagePreview: {
    marginTop: 16,
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  algorithmContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  algorithmButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
  },
  algorithmButtonActive: {
    backgroundColor: '#007AFF',
  },
  algorithmText: {
    fontSize: 12,
    color: '#333',
  },
  algorithmTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  description: {
    marginTop: 12,
    fontSize: 13,
    opacity: 0.7,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  energyButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  smallButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
  },
  printButton: {
    backgroundColor: '#34C759',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  printButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  testButton: {
    backgroundColor: '#FF9500',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    marginTop: 24,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  infoText: {
    fontSize: 13,
    marginBottom: 8,
  },
});
