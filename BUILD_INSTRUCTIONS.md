# Quick Build Instructions

## 🚨 IMPORTANT: Expo Go Won't Work

**Bluetooth requires a custom build.** Expo Go does NOT support `react-native-ble-plx`.

---

## ⚡ Fastest Way to Test (Android)

```bash
# 1. Install EAS CLI (one-time setup)
npm install -g eas-cli

# 2. Login to Expo
eas login

# 3. Build for Android (takes ~15-20 minutes)
eas build --profile development --platform android

# 4. Download and install the APK on your Android phone

# 5. Start the dev server
npx expo start --dev-client

# 6. Scan QR code with the custom app (not Expo Go!)
```

**That's it!** Bluetooth will work in the custom build.

---

## 🍎 For iOS (Requires Apple Developer Account)

```bash
# Build for iOS
eas build --profile development --platform ios

# Download and install on your iPhone
# Then run:
npx expo start --dev-client
```

---

## 🔧 Alternative: Local Build (Faster After Setup)

### Android
```bash
npx expo run:android
```

### iOS (Mac only)
```bash
npx expo run:ios
```

---

## 📱 What You'll Get

After building, you'll have a custom app that:
- ✅ Has full Bluetooth support
- ✅ Can scan for printers
- ✅ Can connect and print
- ✅ Works like Expo Go for development
- ✅ Updates instantly when you save code

---

## ❓ Which Method Should I Use?

| If you want... | Use this |
|----------------|----------|
| Quickest test on Android | `eas build --profile development --platform android` |
| Test on iPhone | `eas build --profile development --platform ios` |
| Fastest rebuilds | `npx expo run:android` or `npx expo run:ios` |
| Production app | `eas build --profile production --platform [ios/android]` |

---

## 🎯 Expected Timeline

1. **First build**: 15-20 minutes (cloud build)
2. **Install on device**: 1 minute
3. **Start dev server**: 30 seconds
4. **Ready to test!** ✅

---

## 💡 Pro Tips

1. **Start with Android** - no Apple account needed
2. **Keep the custom app installed** - you only build once
3. **Use `npx expo start --dev-client`** - not regular `npx expo start`
4. **Physical device required** - BLE doesn't work in simulators

---

## 🆘 Need Help?

See full guide: [BLUETOOTH_SETUP_GUIDE.md](./BLUETOOTH_SETUP_GUIDE.md)

---

## ✅ Quick Check

Before building, verify:
- [ ] Node.js installed
- [ ] Project dependencies installed (`npm install`)
- [ ] Expo account created (free at expo.dev)
- [ ] Physical device available (Android or iPhone)
- [ ] Printer powered on and nearby

Ready? Run:
```bash
eas build --profile development --platform android
```
