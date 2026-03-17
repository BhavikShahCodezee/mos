# Bluetooth Setup Guide for Cat Printer App

## ⚠️ Important: Expo Go Limitation

**Bluetooth WILL NOT WORK in Expo Go** because `react-native-ble-plx` requires custom native code.

You must use one of the methods below to test Bluetooth functionality.

---

## 🚀 Method 1: Development Build (Recommended for Testing)

This creates a custom version of Expo Go with your native modules included.

### Step 1: Install EAS CLI
```bash
npm install -g eas-cli
```

### Step 2: Login to Expo
```bash
eas login
```

If you don't have an account, create one at [expo.dev](https://expo.dev)

### Step 3: Configure EAS
```bash
cd /Users/imac/Documents/BSshah-projects/demo/mos
eas build:configure
```

### Step 4: Build Development Client

**For iOS (requires Apple Developer account):**
```bash
eas build --profile development --platform ios
```

**For Android (free, no account needed):**
```bash
eas build --profile development --platform android
```

This will:
1. Upload your code to Expo's servers
2. Build a custom app with BLE support
3. Provide a download link when complete (~10-20 minutes)

### Step 5: Install on Device
1. Download the build from the link provided
2. Install on your physical device
3. Run the development server:
```bash
npx expo start --dev-client
```

### Step 6: Test Bluetooth
1. Open the custom app on your device
2. Scan the QR code from the terminal
3. App will load with full Bluetooth support ✅

---

## 🔧 Method 2: Local Development Build (Faster, Requires Setup)

Build and run directly on your machine without cloud builds.

### Prerequisites

**For iOS:**
- Mac computer
- Xcode installed
- iOS Simulator or physical iPhone
- Apple Developer account (for physical device)

**For Android:**
- Android Studio installed
- Android SDK configured
- Android Emulator or physical Android device

### Step 1: Prebuild Native Projects
```bash
cd /Users/imac/Documents/BSshah-projects/demo/mos
npx expo prebuild
```

This generates `ios/` and `android/` folders with native code.

### Step 2: Run on Device

**For iOS:**
```bash
npx expo run:ios
```

Or open in Xcode:
```bash
open ios/mos.xcworkspace
```
Then click Run in Xcode.

**For Android:**
```bash
npx expo run:android
```

Or open in Android Studio:
```bash
open -a "Android Studio" android/
```
Then click Run in Android Studio.

### Step 3: Test Bluetooth
The app will launch with full Bluetooth support ✅

---

## 📦 Method 3: Production Build (For Final Testing)

Build a production-ready APK/IPA.

### For Android (Easiest)
```bash
eas build --profile production --platform android
```

This creates an APK you can install directly on any Android device.

### For iOS (Requires Apple Developer Account)
```bash
eas build --profile production --platform ios
```

This creates an IPA for TestFlight or App Store distribution.

---

## 🧪 Quick Comparison

| Method | Setup Time | Build Time | Cost | Best For |
|--------|------------|------------|------|----------|
| **Expo Go** | 0 min | 0 min | Free | ❌ Won't work for BLE |
| **Development Build (EAS)** | 5 min | 15-20 min | Free* | ✅ Testing on device |
| **Local Build** | 30-60 min | 5-10 min | Free | ✅ Rapid iteration |
| **Production Build** | 5 min | 15-20 min | Free* | ✅ Final testing |

*Free tier: 30 builds/month

---

## 🎯 Recommended Workflow

### For Quick Testing (First Time)
```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Login
eas login

# 3. Build for Android (no Apple account needed)
eas build --profile development --platform android

# 4. Install APK on your Android phone

# 5. Run dev server
npx expo start --dev-client
```

### For Active Development (After Initial Setup)
```bash
# Use local builds for faster iteration
npx expo run:android
# or
npx expo run:ios
```

---

## 📱 Testing Bluetooth

Once you have a working build:

1. **Turn on your printer** (GT01/GB02/GB03)
2. **Enable Bluetooth** on your phone
3. **Open the app**
4. **Tap "Test Connection"** to verify BLE works
5. **Select an image** from your gallery
6. **Choose a dithering algorithm**
7. **Tap "Print Image"**

---

## 🐛 Troubleshooting

### "Bluetooth is not powered on"
- Enable Bluetooth in phone settings
- Grant Bluetooth permissions to the app

### "Unable to find printer"
- Ensure printer is powered on
- Check printer is not connected to another device
- Move closer to the printer
- Try specifying device name in settings

### "Permission denied"
- Go to Settings → App → Permissions
- Enable Bluetooth and Location (Android)
- Enable Bluetooth and Photos (iOS)

### Build fails with "BLUETOOTH_CONNECT requires Android 12"
This is normal. The permission is automatically handled for Android 12+.
On older Android versions, it falls back to BLUETOOTH permission.

### iOS Simulator shows "BLE not available"
BLE doesn't work in iOS Simulator. You MUST use a physical device.

---

## 🔐 Permissions Explained

### iOS
- **NSBluetoothAlwaysUsageDescription**: Connect to printer
- **NSPhotoLibraryUsageDescription**: Select images to print

### Android
- **BLUETOOTH**: Basic Bluetooth access
- **BLUETOOTH_ADMIN**: Discover devices
- **BLUETOOTH_CONNECT**: Connect to devices (Android 12+)
- **BLUETOOTH_SCAN**: Scan for devices (Android 12+)
- **ACCESS_FINE_LOCATION**: Required for BLE scanning (Android requirement)
- **READ_EXTERNAL_STORAGE**: Access photos

All permissions are already configured in `app.json`.

---

## 💡 Tips

### Faster Development
1. Use Android for testing (no Apple account needed)
2. Use local builds (`npx expo run:android`) after initial setup
3. Keep printer nearby during development

### Battery Optimization
- Bluetooth scanning drains battery
- App automatically stops scanning after finding device
- Connection is closed after printing completes

### Image Size
- Larger images take longer to process
- Images are automatically resized to 384px width
- Consider resizing large images before printing

---

## 📚 Additional Resources

- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [react-native-ble-plx Documentation](https://github.com/dotintent/react-native-ble-plx)
- [Bluetooth Permissions Guide](https://docs.expo.dev/versions/latest/sdk/bluetooth/)

---

## ✅ Summary

**To test Bluetooth functionality:**

1. ❌ **Don't use Expo Go** - it won't work
2. ✅ **Use EAS Development Build** - easiest for first test
3. ✅ **Use Local Build** - fastest for active development
4. ✅ **Always test on physical device** - BLE doesn't work in simulators

**Quickest path to testing:**
```bash
npm install -g eas-cli
eas login
eas build --profile development --platform android
# Wait 15-20 minutes, download APK, install, test!
```

---

Need help? Check the troubleshooting section or review the main README_PRINTER.md file.
