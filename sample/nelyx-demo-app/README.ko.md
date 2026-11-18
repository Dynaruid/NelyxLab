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

Windows는 Source 위젯과 direct Hermes host를 사용합니다. Visual Studio C++ 도구·
Windows SDK·LLVM·CMake·Ninja와 현재 native Skia 공급이 필요합니다.

```powershell
npm.cmd run prepare:windows --workspace @nelyx/demo
npm.cmd run build:windows --workspace @nelyx/demo
npm.cmd run run:windows --workspace @nelyx/demo
```

`prepare:windows`는 현재 SDK를 공급·설치하고
`Nelyx/skia/vendor/inputs/windows-x64/source-inputs.json`을 검증하며,
일치하는 Hermes toolchain을 `.nelyx/windows-hermes/`에 준비합니다. 두 공급의 경로와 hash는
앱의 `.nelyx/native-windows/inputs.json`에 기록합니다. 다른 native Skia 공급 경로는
`prepare:windows` 뒤에 `-- <source-inputs.json>`을
추가하거나, 설치 후 `node sample/nelyx-demo-app/eng/windows-inputs.mjs <inputs.json>`으로 지정합니다.
공급이 없거나 일치하지 않으면 준비 단계에서 명시적으로 실패합니다.

`build:windows`는 optimized Hermes bytecode와 direct C++ host를
`.nelyx/native-windows/current-bytecode/`에 빌드합니다. `run:windows`는 앱·SDK·준비한 공급의 변경을 확인해
필요한 경우 현재 SDK를 다시 공급하고 패키지를 갱신하며, 변경이 없으면 재사용합니다.
재빌드 전에 기존 데모 창을 닫으세요. direct host는 experimental이며 물리 입력·성능 결과는
[W12 종료 요약](../../history/26/11/14/work12-summary.md)에 구분해 보존했습니다.
달력은 창을 최대화한 뒤 **메뉴 → Selection → Choose date**에서 열 수 있습니다.

개선판 달력을 직접 사용하려면 저장소 루트에서 다음 명령을 실행하세요.
현재 SDK 공급과 필요한 빌드를 자동으로 갱신하며, 창을 닫을 때까지 실행됩니다.

```powershell
npm.cmd run run:windows:prepared --workspace @nelyx/demo
```

같은 선택은 `npm.cmd run run:windows --workspace @nelyx/demo -- --preparation split`로도
가능합니다. 기존 창을 닫고 옵션 없는 `run:windows` 또는 `--preparation legacy`로 실행하면
기본 동기 경로로 돌아갑니다. 진입점 선택이 달라지면 현재 패키지를 다시 빌드하며,
`--preparation`과 고정 snapshot인 `--package`는 함께 지정할 수 없습니다.

실험적인 cold 월 생산 분할은 기본값이 꺼져 있습니다. 앱의
`main(undefined, { calendarPreparation: true })`가 날짜 dialog에만
`PageViewPreparation`과 `childPolicy: { mode: 'split' }`을 적용합니다.
PageView에 같은 옵션을 직접 지정할 수도 있습니다. 새 State의 init/build가 표시 전에
실행될 수 있고, 취소하면 생성분을 한 번 dispose합니다. 사용자 timer·구독의 해제는
State의 책임입니다. View당 미게시 세대 1개, optional 보관분과 합산 Element 2,048개,
중첩 finite grid/fixed list당 child 64개가 첫 지원 범위입니다. LayoutBuilder를 통한
추가 생산 발견은 builder 실행 전에 거절합니다. 필수 페이지는 같은 생산 cursor를
동기로 완결하고 실제 부모 pipeline의 layout 후 CPU 게시합니다. 관측된 작업 deadline을
제공하지 않는 Web host에서는 선택 생산을 시작하지 않습니다.

동일한 현재 공급에서 비교할 경로를 선택할 수 있습니다. 실제 판정·제약은
[work5](../../work5.md)에 기록합니다.
후속 개선에서 실제 날짜 선행 생산을 확인했습니다. 전체 성능 수락은 미완료이며 기본 동기 경로를 유지합니다.

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

각 `prepare:<platform>` 명령은 현재 SDK 공급과 해당 러너 설치를 수행합니다.
앱 설정·폰트·이미지 선언은 [package.json](package.json)의 `nelyx`에 있습니다.

이 프로젝트는 공개 Source Widget/Material API와 Windows direct Hermes·Android RN·Web
backend를 사용합니다. Doroti의 모든 컴포넌트를
일대일로 이식한 것은 아니며 현재 Nelyx 공개 API로 구성한 15개 데모를 제공합니다.
플랫폼 러너 포함과 타입·빌드 통과는 기기 실행·물리 입력·성능 검증을 뜻하지 않습니다.

## 출처와 라이선스

화면 구성은 DorotiDemoApp의 Components 화면을 참고했습니다. 컨트롤 예제와 러너는
Nelyx Testbed의 공개 API 사용 패턴을 이 프로젝트 안에 독립적으로 옮겼습니다.
[LICENSE.flutter](LICENSE.flutter)의 Flutter 고지, Noto Sans KR·Noto Color Emoji의 OFL과 공급 시 복사되는
Material Icons 라이선스를 유지합니다. 로컬 사진은 Mae Mu / Unsplash입니다.
