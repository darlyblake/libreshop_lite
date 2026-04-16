Vosk integration (offline speech recognition)
===========================================

Overview
--------
This project can use Vosk for native, offline speech recognition on Android/iOS. The repo includes a JS wrapper at `src/services/voskService.ts` which will use a native bridge `VoskBridge` when available, and fall back to the Web Speech API on web.

Options
-------
- Use an existing RN package: `react-native-vosk` (if maintained). This is fastest.
- Implement a small native module that exposes the Vosk API (recommended if you need control).

High-level steps (Expo / Managed)
--------------------------------
1. Expo-managed apps must use a custom dev client or eject to bare workflow because Vosk requires native libs.
2. Build a dev client with the native module or eject: `expo prebuild` + configure native code, or run `expo run:android` after prebuild.

Android (native) - summary
-------------------------
1. Add Vosk Android dependency in `android/app/build.gradle` (see Vosk docs):

   implementation 'com.alphacephei:vosk-android:0.3.47@aar'

2. Add the model files to `android/app/src/main/assets/models/your-model` and load from that path.
3. Request `RECORD_AUDIO` permission at runtime.
4. Implement a `VoskBridge` native module that:
   - `init(modelPath: string)` – loads the model
   - `start(callback)` – starts recognition and sends partial/final results
   - `stop()` – stops recognition

iOS (native) - summary
----------------------
1. Add Vosk iOS pod / source following Vosk iOS build docs.
2. Include model files in the app bundle and load them by path.
3. Request microphone permission (`NSMicrophoneUsageDescription`) in `Info.plist`.
4. Implement `VoskBridge` Objective-C / Swift module with the same methods as Android.

Concrete iOS steps (example)
----------------------------
- If you use Expo managed workflow: run `expo prebuild` to generate the native `ios/` project.
- Open `ios/Podfile` and add the Vosk pod or follow the Vosk iOS build instructions. Example placeholder (check Vosk docs for exact pod):

  pod 'Vosk'

- Then run:

Then run:

```bash
cd ios
pod install
cd ..
```

Download a small model automatically (example script added):

```bash
./scripts/download_vosk_model.sh fr
```

This will place the model under `android/app/src/main/assets/models/<model>` and `ios/Models/<model>`.

- Ensure `NSMicrophoneUsageDescription` is present in `ios/YourApp/Info.plist`.
- Add the Swift files under `ios/` (we added `ios/VoskBridge.swift` and `ios/VoskBridge.m` in this repo). In Xcode, make sure they are part of the app target.
- Build from Xcode or via CLI:

```bash
npx react-native run-ios
# or with Expo after prebuild
expo run:ios
```

Notes:
- The exact Pod name and setup steps depend on the Vosk iOS packaging; consult https://github.com/alphacep/vosk-api for up-to-date instructions. Some setups require building the Vosk framework locally and linking it into the app.
- After `pod install` you should be able to call the Swift bridge methods from JS (`VoskBridge.initModel`, `VoskBridge.start`, `VoskBridge.stop`).

Using the existing package (recommended quick path)
-----------------------------------------------
1. Try `npm install react-native-vosk` (or the package recommended by Vosk docs).
2. For Expo: build a custom dev client: `expo prebuild && expo run:android` (or `expo run:ios`).
3. Copy small model files into `android/app/src/main/assets` and `ios/YourApp/Resources` or follow package instructions for downloading models at runtime.

Example usage (JS)
-------------------
import voskService from './src/services/voskService';

async function start() {
  if (!voskService.isAvailable()) return;
  await voskService.init('models/vosk-model-small-fr');
  voskService.startListening((text, isFinal) => {
    console.log('vosk', text, isFinal);
  }, { partialResults: true });
}

Notes & tradeoffs
-----------------
- Models are the main size cost; choose a small model for mobile.
- Offline recognition gives privacy and low latency but increases app size.
- Building and debugging native modules requires a bare or custom dev client.

Want help?
-----------
If you want, I can:
- Try adding `react-native-vosk` to `package.json` and scaffold minimal native bridge files.
- Generate a concrete Android `VoskBridge` Java file and iOS Swift/ObjC stub plus exact Gradle/pod instructions.

Tell me which path you prefer: "quick: react-native-vosk" or "custom native bridge" and whether to target Android, iOS, or both.
