# Nelyx Demo

[English](README.md) | **한국어**

적응형 레이아웃과 폼, 이미지, 탐색을 제공하는 Material 컴포넌트 갤러리입니다.

## 공급과 개발 실행

저장소 루트에서 Node.js 24.x와 고정 CanvasKit을 준비합니다. [SDK 준비](../../README.ko.md#testbed와-demo-실행)

```powershell
npm.cmd ci
npm.cmd run build:sdk
npm.cmd run prepare:sample -- web sample/nelyx-demo-app
npm.cmd ci --prefix sample/nelyx-demo-app/web/runner --workspaces=false
npm.cmd run dev --workspace @nelyx/demo
```

## PWA와 Tauri

```powershell
npm.cmd run build:pwa --workspace @nelyx/demo
npm.cmd run run:pwa --workspace @nelyx/demo -- --base /demo/
```

브라우저는 게시된 .nelyx/pwa를 사용합니다. 설치 ID는 버전이 바뀌어도 유지됩니다. OS별 패키징에는 같은 디렉터리를 전달합니다.

```powershell
npm.cmd run prepare:windows --workspace @nelyx/demo
npm.cmd run pack:windows --workspace @nelyx/demo
npm.cmd run run:windows --workspace @nelyx/demo
```

dev:windows를 실행하면 Vite에 연결된 앱 창이 열립니다. Linux·macOS·iOS도 해당 도구를 설치하고 각 플랫폼의 prepare, pack, run, dev 명령을 실행합니다. build:windows는 PWA 빌드와 Windows 패키징을 차례로 실행합니다. [CLI 명령](../../Nelyx/sdk/tooling/cli/README.ko.md#tauri-호스트-추가)

앱에서 공용 소스·자산·라이선스와 src-tauri를 관리합니다. [저장소 문서](../../README.ko.md#문서)

## Android에서 실행

저장소 루트에서 [공급과 개발 실행](#공급과-개발-실행)의 Demo 러너용 `npm.cmd ci`까지 실행합니다. Temurin 같은 JDK 21과 `rustup`으로 관리하는 Rust를 설치합니다. Android Studio의 SDK Manager에서는 아래 패키지를 설치합니다. x86_64 에뮬레이터를 실행하려면 Android Emulator와 x86_64 시스템 이미지도 설치합니다.

- Android SDK Platform 37.0 및 Build-Tools 37.0.0
- Android SDK Platform-Tools(ADB)
- NDK 30.0.14904198

PowerShell에서 `JAVA_HOME`에 설치한 JDK 경로를 넣고, SDK를 다른 경로에 설치했다면 `ANDROID_HOME`을 바꿉니다. 이어지는 명령도 같은 PowerShell에서 실행합니다.

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-21'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:NDK_HOME = Join-Path $env:ANDROID_HOME 'ndk\30.0.14904198'
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
```

### x86_64 에뮬레이터

Android Studio의 Device Manager에서 x86_64 가상 기기를 시작합니다. `adb devices -l`에서 상태가 `device`인지 확인하고, 실제 시리얼이 다르면 `emulator-5554`를 바꿉니다.

```powershell
adb devices -l
rustup target add x86_64-linux-android
npm.cmd run prepare:android --workspace @nelyx/demo -- --architecture x64
npm.cmd run build:android --workspace @nelyx/demo -- --architecture x64
npm.cmd run run:android --workspace @nelyx/demo -- --device emulator-5554
```

### ARM64 휴대폰

- USB로 연결하려면 개발자 옵션에서 USB 디버깅을 켜고, 케이블을 연결한 뒤 휴대폰에서 디버깅을 허용합니다.
- Android 11 이상에서 무선으로 연결하려면 휴대폰과 PC를 같은 Wi-Fi에 연결합니다. 휴대폰에서 무선 디버깅을 켠 뒤 Android Studio의 **Pair Devices Using Wi-Fi**로 페어링합니다. [Android 무선 디버깅](https://developer.android.com/studio/run/device?hl=ko#wireless)

입력 프롬프트가 나오면 `adb devices -l`에서 상태가 `device`인 휴대폰의 첫 번째 열에 표시된 시리얼을 넣습니다.

```powershell
adb devices -l
$device = Read-Host '휴대폰 ADB 시리얼'
rustup target add aarch64-linux-android
npm.cmd run prepare:android --workspace @nelyx/demo -- --architecture arm64
npm.cmd run build:android --workspace @nelyx/demo -- --architecture arm64
npm.cmd run run:android --workspace @nelyx/demo -- --device $device
```

`build:android`는 PWA를 빌드하고 Tauri로 패키징합니다. `run:android`는 서명된 디버그 APK를 선택한 기기에 설치하고 앱을 엽니다. 빌드된 앱을 다시 실행할 때는 `run:android` 명령을 사용합니다. `app-universal-debug.apk`는 `sample/nelyx-demo-app/.nelyx/tauri/android-x64/` 또는 `sample/nelyx-demo-app/.nelyx/tauri/android-arm64/`에 생성됩니다.
