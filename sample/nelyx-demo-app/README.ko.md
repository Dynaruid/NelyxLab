# Nelyx Demo

[English](README.md) | **한국어**

`DorotiLab/samples/DorotiDemoApp`을 참고한 독립 Material 3 데모앱입니다.
앱을 열면 **Components** 갤러리가 바로 표시됩니다. 공통 TypeScript UI와
에셋을 이 프로젝트가 소유하며 Web·Windows·Android 러너에서 같은 앱을 실행합니다.

화면 폭이 1,000px를 넘으면 독립적으로 스크롤하는 2열, 그 이하면 1열로 표시합니다.
상단의 밝기 버튼으로 라이트·다크 테마를 전환하고, 메뉴 버튼의 드로어에서
컴포넌트 그룹을 선택합니다. **Show all**로 전체 갤러리로 돌아옵니다.

| 그룹          | 데모                                                                               |
| ------------- | ---------------------------------------------------------------------------------- |
| Actions       | Elevated·Filled·Tonal·Outlined·Text 버튼, 아이콘 버튼과 선택 상태                  |
| Communication | 클릭으로 증가하는 배지, 고정·애니메이션 진행 표시                                  |
| Containment   | Elevated·Filled·Outlined 카드, 다이얼로그와 구분선                                 |
| Navigation    | 선택 가능한 목적지, 그룹 선택 드로어                                               |
| Selection     | 체크박스·삼중 상태·라디오·스위치·칩·슬라이더·범위 슬라이더                         |
| Text inputs   | Filled·Outlined 입력, 한글·emoji, 보안 입력, 줄 수·선택·Clear·Undo                 |
| Images        | 로컬·URL 이미지, Contain·Cover, 실패 시 재시도, 이미지에서 밝은·어두운 팔레트 추출 |

이미지 URL에는 네트워크 연결과 서버의 CORS 허용이 필요합니다. 기본 로컬 이미지는
네트워크 없이 표시합니다. 팔레트 추출은 앱을 소유한 이미지·rasterization 서비스를 사용합니다.

## 실행

저장소 루트의 PowerShell에서 실행합니다. Node.js 24.3 이상 25 미만이 필요합니다.
첫 실행 전에는 저장소 의존성과 SDK를 준비합니다.

```powershell
npm.cmd ci
npm.cmd run build:sdk
```

Web은 준비된 Nelyx CanvasKit 런타임과 WebGL2 브라우저가 필요합니다.

```powershell
node Nelyx/skia/eng/prepare-web-runtime.mjs --check
npm.cmd run prepare:web --workspace @nelyx/demo
npm.cmd run dev:web --workspace @nelyx/demo
```

`http://127.0.0.1:8081/`을 열고 Ctrl+C로 서버를 종료합니다.
정적 Web 빌드는 `npm.cmd run build:web --workspace @nelyx/demo`이며
현재 출력은 이 앱의 `.nelyx/web/`에 있습니다.

Windows는 Visual Studio C++ 도구·Windows SDK와 현재 렌더러 공급이 필요합니다.

```powershell
npm.cmd run prepare:windows --workspace @nelyx/demo
npm.cmd run build:windows --workspace @nelyx/demo
npm.cmd run run:windows --workspace @nelyx/demo
```

[Windows 네이티브 입력 빌드](../../Nelyx/skia/README.ko.md#windows-네이티브-입력)의
`--runner`에는 `sample/nelyx-demo-app/windows/runner`를 지정합니다.
`prepare:windows`는 공유 출력 `.nelyx/windows-rnw-native/supplier/inputs.json`이 있으면
설치된 SDK 소스와 모든 파일 hash를 검사해 직접 참조합니다. 네이티브 라이브러리를
앱마다 복제하지 않습니다. 다른 공급 경로는 `prepare:windows` 뒤에 `-- <inputs.json>`을
추가하거나, 설치 후 `node sample/nelyx-demo-app/eng/windows-inputs.mjs <inputs.json>`으로 지정합니다.
공급이 없으면 먼저 패키지 설치가 끝난 뒤 네이티브 입력을 빌드하고 이 등록 명령을 실행하세요.

기본값은 RNW·Hermes bytecode입니다. `run:windows`는 앱 입력과 SDK 변경을 확인해
필요한 경우 현재 SDK를 다시 공급하고 패키지를 갱신합니다. 재빌드 전에 기존 데모 창을 닫으세요.

Android는 OpenJDK 21·SDK 36·NDK와 대상 아키텍처의 렌더러 공급이 필요합니다.
현재 기본값은 x86_64 에뮬레이터용 `emulator-vulkan`입니다.

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
npm.cmd run prepare:android --workspace @nelyx/demo
npm.cmd run build:android:emulator --workspace @nelyx/demo
npm.cmd run run:android --workspace @nelyx/demo -- --device emulator-5554
```

JDK 경로는 설치된 일반 OpenJDK 21의 경로로 바꾸세요. 이 Windows 환경에서는
GraalVM JDK의 Android `jlink` 변환이 실패할 수 있어 Temurin을 선택합니다.
`adb devices -l`에 표시된 serial이 다르면 `emulator-5554`를 바꿉니다.
SDK CLI가 Release APK를 빌드·검증·설치하며 별도 Metro 서버 없이 실행합니다.
ARM64 기기는 `package.json`의 `nelyx.targets.android.profile`을 `graphite-vulkan`으로
바꾸고 `build:android`에 `-- --architecture arm64-v8a`를 전달합니다.
플랫폼 준비 조건과 런타임 소스 빌드는 [Testbed 가이드](../nelyx-testbed-app-2/README.ko.md)와
[SDK 가이드](../../Nelyx/sdk/README.ko.md)를 참고하세요.

## 개발

```powershell
npm.cmd run check --workspace @nelyx/demo
npm.cmd run check:web --workspace @nelyx/demo
npm.cmd run check:windows --workspace @nelyx/demo
```

첫 명령은 공통 UI, 나머지는 준비·설치한 플랫폼 러너의 타입을 검사합니다.
각 `prepare:<platform>` 명령은 현재 SDK 공급과 해당 러너 설치를 수행합니다.
앱 설정·폰트·이미지 선언은 [package.json](package.json)의 `nelyx`에 있습니다.

이 프로젝트는 기존 Testbed와 같은 공개 Widget/Material API와 RNW·RN·Web 러너를
사용합니다. 자체 C++ v2 엔진으로의 연결은 포함하지 않습니다. Doroti의 모든 컴포넌트를
일대일로 이식한 것은 아니며 현재 Nelyx 공개 API로 구성한 15개 데모를 제공합니다.
플랫폼 러너 포함과 타입·빌드 통과는 기기 실행·물리 입력·성능 검증을 뜻하지 않습니다.

## 출처와 라이선스

화면 구성은 DorotiDemoApp의 Components 화면을 참고했습니다. 컨트롤 예제와 러너는
Nelyx Testbed의 공개 API 사용 패턴을 이 프로젝트 안에 독립적으로 옮겼습니다.
[LICENSE.flutter](LICENSE.flutter)의 Flutter 고지, Noto Sans KR·Noto Color Emoji의 OFL과 공급 시 복사되는
Material Icons 라이선스를 유지합니다. 로컬 사진은 Mae Mu / Unsplash입니다.
