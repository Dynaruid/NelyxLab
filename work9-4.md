# work9-4 — 4부: Android·Linux 호스트

> 2026-11-07: 사용자 요청으로 본문의 독립 테스트·감사·실험 명령을 폐기했다. 이전 검증 기록과 미완료 판정은 보존하며, 현행 확인·정리 기준은 [전체 목차의 정리 안내](work9.md)를 따른다.

작성: **2026-11-05 KST** · 갱신: **2026-11-08 KST** · 상태: **RN/RNL 소스 이식 계획 교정 / Android PARTIAL · Linux DEFERRED**

> **2026-11-08 사용자 교정:** Android 플랫폼 API는 **RN Android**, Linux GTK 플랫폼 API는 **RNL**의 필요한 소스를 실제로 가져와 Nelyx에 맞게 수정·사용한다. 기존 자체 OS 구현 우선·알고리즘/사례 참고만으로 완료하는 방침을 대체한다. 기존 standalone/emulator·공급 기록은 보존하며 RN/RNL 소스 이식 완료와 구분한다. 이번 변경은 계획 문서이며 새 이식·build/run은 수행하지 않았다. [우선 계약과 다음 W9B-00-H](work9-b.md#11-사용자-확정-host플랫폼-api-구현-방식)를 따른다.

[전체 목차](work9.md) · [이전: 3부](work9-3.md) · [후속: 5부 iOS·macOS](work9-5.md)

**범위:** 원문 §11.4·§5. RN Android의 플랫폼 API 소스 수정 이식·Activity/JNI standalone 연결과 RNL의 GTK 플랫폼 API 소스 수정 이식·GTK4/DMA-BUF·IM/AT-SPI·공급을 다룬다. 기존 절 번호와 단계 ID를 유지한다.

**개발 순서:** Windows/Web 1차 → **4부 Android·Linux 2차** → 후속 5부 iOS·macOS 3차다. 4부의 W9-12-B(Android)·W9-03은 Windows/Web의 **W9-13 기술 완료** 후 착수하며, iOS/macOS 구현·Apple toolchain·공급을 기다리지 않는다. [완료·차수 전환 기준](work9-3.md#125-차수-전환과-완료-판정)

**2026-11-07 사용자 지정:** Android 부분 구현과 emulator 사용, 필요한 공통 영역 수정에 이어 전체 API·자동 복구·개발 reload 구성을 요청하여 Android를 먼저 진행했다. 위 기본 순서의 Android 착수 시점만 변경하며 Windows/Web W9-13 완료나 Linux·Apple 착수를 뜻하지 않는다.

**공통 계약과 완료 조건:** [2부 §11.2의 mirror/ACK·입력 수명](work9-2.md#112-중립-adapter와-상태-계약), [§11.6의 M0–M4](work9-2.md#116-도입-순서와-의존성-gate), [§11.7의 공통 corpus](work9-2.md#117-공통-입력수명-검증-corpus)를 Android에 적용한다. Android와 Linux 각각의 W9-05–11 corpus·[W9-13/14](work9-3.md#123-단계별-범위와-완료-조건)를 연결하고 API·host·공급 통합을 마친 뒤 5부에 착수한다. 물리 입력·성능 수락은 대상별로 남긴다.

**디자인 패키지 구현:** Android/Linux에서도 `packages/cupertino`·`packages/material`은 같은 **TypeScript Widget/State·theme·callback·controller·컴포넌트 동작**을 실행한다. [1부 §1.1의 책임](work9-1.md#11-typescript-디자인-패키지와-c-엔진의-책임)과 [2부 §8.2의 연결/검증](work9-2.md#82-디자인-패키지의-typescript-구현-유지)을 그대로 적용한다. C++/JNI/GTK 구현 범위는 공통 engine/provider와 OS adapter이며 두 디자인 패키지의 C++/Kotlin/GTK Widget 재구현을 포함하지 않는다.

두 target 모두 2부 §10의 generation reload·세대 차단·loss/재시작·close 계약을 해당 host/CLI에 적용한다. Android는 W9-12-B, Linux는 W9-03에서 시작하고 W9-13에서 전체 기능과 통합한다. Windows/Web의 복구 통과를 후속 target에 복사하지 않는다.

## Android 호스트

<a id="114-android--기존-nelyx-os-코드를-먼저-분리"></a>

### 11.4 Android — RN 플랫폼 API 소스 이식

**2차 W9-12-B(Android) / IN_PROGRESS · PARTIAL.** 사용자 지정에 따라 standalone 경로와 아래 API·복구·개발 구성을 구현했다. 전체 원래 API 호환성과 제품 수락은 계속 별도 gate이며 iOS·macOS 구현이나 Apple 공급을 이 단계의 완료 조건으로 요구하지 않는다.

1. **RN Android의 필요한 플랫폼 API 소스를 가져와 수정한다.** 설치 RN **0.83.10**의 `ReactEditText`·`ReactEditTextInputConnectionWrapper`·`ReactAccessibilityDelegate`·clipboard/accessibilityinfo/appstate/deviceinfo 등에서 API별 실제 구현·의존성을 고정한다. `NelyxInputConnectionView`와 현재 standalone 구현의 소비자·기능을 대조하고 RN Context/map/event/ViewManager/Promise를 일반 Context/Activity·owned view·값/handle·JNI/Core port로 수정한다. 이미 작성한 Nelyx 구현만 분리해 완료로 처리하지 않는다.
2. Commit/composing/selection/batch/delete와 hardware key를 Core 입력으로 연결한다. UTF-16 길이·`deleteSurroundingTextInCodePoints`의 code-point 수·grapheme 삭제를 구별하고 `newCursorPosition`, nested batch, 오래된 connection과 조합 종료 중 App 변경을 검사한다.
3. RN의 IME·focus·keyboard inset·Activity/lifecycle·환경/설정·clipboard/linking/feedback 등 필요한 플랫폼 API 구현을 실제 이식하고 기존 직접 구현 소비자를 교체한다. Root/tag 조회는 owned Activity/view·engine handle로 바꾸며 ReactHost·ReactContext·UIManager나 RN event dispatch의 실행 의존성을 제거한다. 필요한 Nelyx 전용 연결 코드와 원본 구현이 없는 gap을 API별로 기록한다.
4. RN 접근성 구현의 이벤트/role/action·focus·OS 설정 처리를 가져와 Core node 세대와 Android virtual node/action에 수정 연결한다. RN ViewGroup·native text control을 그대로 배치한 것만으로 전체 C++ semantics tree·range/action이 제공된다고 가정하지 않는다.
5. Native surface·device/resize/background/foreground·close/drain을 연결한다. Engine frame 수요는 Android Choreographer에서 host clock 계약으로 전달하며 RN frame scheduler를 필요로 하지 않는다. 원래 TypeScript AnimationController/Ticker·컴포넌트 callback은 App에 유지하고 필요한 host frame 시각을 전달한다. GPU owner와 App/Content 독립성은 기존 native 계약을 적용한다.

Surface/ANativeWindow와 JNI reference는 획득·전달·해제 owner와 세대를 명시한다. Surface 파괴 뒤 이전 frame의 제출을 차단하고 새 surface/metrics가 준비된 뒤 게시한다. UI에서 Render/IME callback을 기다리는 blocking join을 넣지 않으며 background·Activity 재생성·종료 때 Choreographer/observer·오래된 InputConnection·pending/lease를 회수한다. OS 동기 질의의 text/selection mirror와 `updateSelection`·후보창 갱신은 같은 focus/edit revision을 사용한다.

초기 대상은 arm64-v8a 최소 scene·입력·InputConnection·접근성·공급/drain이다. Emulator와 실기기·IME별 자동/물리 결과는 각각 기록하며 전체 Testbed·디자인 제품 수락과 구분한다.

2차에서 원본 RN tag/commit·파일 hash·수정/출처·license와 Android 최저 OS·SDK/NDK/JDK/Gradle·Hermes/Skia ABI를 고정한다. 수정 이식본이 React 앱 runtime 없이 일반 앱의 create/build/run/doctor/pack·실제 OS API·종료에 사용되는지 W9-12-B/13에서 확인한다. 현재 source의 이식/미이식 API·기존 소비자 교체·공급/notice가 필수 gate이며 **RN 실제 소스 이식 0개나 자체 구현만으로 통과하지 않는다.** 전체 원래 API·TypeScript 디자인·복구 corpus와 물리/성능 판정은 별도 유지한다.

### 현재 Android 구현과 실행

아래는 사용자 교정 전 standalone 구현과 실행 근거다. 기존 API·복구·emulator PASS를 RN Android 소스 수정 이식본의 완료/검증으로 복사하지 않는다. 이번 교정 뒤 RN 원본/파일·수정·실제 소비자·API별 실행을 다시 대응시킨다. 최신 W9B-00 공급·실행은 [work9-b §3.2](work9-b.md#32-현재-공급검사실행-근거)에 별도로 기록돼 있다.

구현 위치는 [Android host](Nelyx/engine/platform/android/host.cpp), [Render provider](Nelyx/engine/platform/android/renderer.hpp), [일반 Android 프로젝트](Nelyx/engine/platform/android/project/app/build.gradle), [중립 InputConnection buffer](Nelyx/engine/platform/android/shared/dev/nelyx/input/NelyxInputBuffer.java), [CLI](Nelyx/sdk/tooling/cli/src/engine-v2-android.mjs)다. 기존 Windows의 Skia·paragraph/image·App text 서비스를 [공통 provider](Nelyx/engine/platform/common/skia_provider.hpp)로 추출했으며 기존 v1 RN host는 유지한다. RN 입력 wrapper와 standalone 입력 buffer는 같은 UTF-16 validator를 사용한다. 전체 RN IME 구현을 추출·재검증한 것으로 확대하지 않는다.

| 영역 | 구현 범위 |
| --- | --- |
| Runtime/owner | 일반 Activity/TextureView·JNI registry와 UI/App(Hermes)/Content/Render 네 owner. RN Activity/Context/ReactHost/UIManager·RN scheduler 없이 실행. JSI는 독립 library이며 React runtime은 링크하지 않음 |
| GPU/surface | 고정한 Android Skia 공급에 맞는 Graphite/Dawn/Vulkan. ANativeWindow 획득/해제와 SurfaceTexture retire를 분리하고 키보드/resize에는 같은 native surface를 재설정. Render에서 GPU 완료를 기다리며 UI join 없음. 성능 수락은 별도 |
| 입력/mirror | Core ACK 기반 buffer·UTF-16 경계·code-point/grapheme 삭제·Hangul composing/commit·nested batch·newCursorPosition·stale connection/close. 게시된 Skia caret/hit와 baseline을 사용하며 CursorAnchorInfo/selection을 같은 revision으로 갱신 |
| 접근성 | Core generation을 virtual ID에 연결. tree/bounds·focus·hover·click·range·text/selection·password masking. OS action은 같은 살아 있는 node에 대해 stale NACK일 때만 최신 publication을 재조회하며 중복 실행하지 않음 |
| Clock/수명 | Choreographer monotonic clock·hide/resume·Activity recreation/new native generation·오래된 JNI edit 거부. App dispose → native worker/GPU drain → close 결과를 비동기로 회수. 종료 요약은 메모리 내 최근 8개로 제한 |
| 공급/CLI | RN 없는 create/build/doctor/run/pack. SHA-256/ABI/native library·APK identity 검사, HBC96 compile, 설치본 source identity·C++/SDK 작업 수·첫 GPU frame 확인. 현재 공급/출력만 유지 |
| 공통 수정 | controlled callback이 값을 거부해도 native 값을 재적용. 원본 Material padded button의 최소 크기는 자식 layout에 전파하지 않고 여백 hit를 자식 중앙으로 전달. 이미 수락한 capture는 수집한 좌표 변환으로 종료하며 새 contact는 바뀐 hit 규칙을 사용 |
| Original 편집기 | 원래 EditableTextState·TextEditingController·formatters·undo·focus·callback을 유지하고 C++ 편집 document/paragraph에 연결. Material decoration 없는 TextField·기본 CupertinoTextField. Style-only 갱신은 편집 text/revision을 덮어쓰지 않음. Caret·selection·hit·가로 reveal은 Content geometry를 사용. 같은 revision의 선행 native 관측/뒤늦은 programmatic ACK와 더 오래된 ACK를 구별 |
| Android 공개 서비스 | 같은 원래 API로 root/NetworkAssetBundle·AssetManifest·FontLoader·TextPainter layout/hit/range/line 질의·ImmutableBuffer·ImageDescriptor/PNG/GIF codec/readback을 실행. Android system sans-serif의 실제 font face를 Roboto catalog로 사용하고 byte/face 수·credit을 제한 |
| 자동 복구 | 실제 Dawn device loss와 Graphite context/surface 손실을 복구 가능 오류로 분리. 이전 App dispose·worker/GPU drain·ledger 0 뒤 새 native session/State로 교체. Activity당 2회 제한; 시작·치명적 오류·회수 실패는 종료 오류 |
| 개발 reload | RN/Metro 없는 `dev --engine v2 --target android`. 새 APK 준비 실패는 기존 PID/세대를 유지. 성공하면 debuggable Activity control의 PID·native owner·ticket을 대조하고 이전 세대 drain 뒤 설치. 지연된 중복 file notification과 `.nelyx` cache 변경은 추가 reload를 만들지 않음 |

공급은 [suppliers.json](Nelyx/engine/platform/android/suppliers.json)에 고정한다. min SDK **26**, compile/target **36**, NDK **27.1.12297006**, build-tools **36.0.0**, HotSpot JDK **21**, Gradle **8.14.3**, AGP **8.13.1**, Hermes/compiler **0.14.1·HBC96**, Skia **154.1.0**, Dawn **dawn-chrome-m154a**, ABI **arm64-v8a/x86_64**다. 각 ABI는 engine/JSI/Hermes/fbjni/Dawn/libc++ **6 library**를 함께 공급하며 ELF LOAD alignment는 **16 KiB**다. 클래스는 Babel로 내린 후 고정한 Hermes 옵션으로 bytecode를 만든다. 이 APK는 개발용 debug key로 서명한다. 배포용 signing/store qualification은 완료하지 않았다.

Windows PowerShell에서 emulator를 시작한 뒤 저장소 루트에서 실행한다. 로컬 GraalVM JDK의 Android jlink 실패 때문에 이 환경은 Temurin 21을 선택한다. `JAVA_HOME`은 설치한 HotSpot JDK 21 경로로 맞춘다.

```powershell
$env:JAVA_HOME='C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot'
$env:Path="$env:JAVA_HOME/bin;$env:Path"
npm.cmd run build:engine-v2:android
npm.cmd run run:engine-v2:android -- --device=emulator-5554
npm.cmd run dev:engine-v2:android -- --device=emulator-5554
npm.cmd run test:engine-v2:android
```

일반 실행 명령은 현재 source/공급과 ABI를 확인하고 필요하면 Core/SDK/디자인 패키지와 두 Android ABI를 갱신한다. 현재 engine 공급은 `Nelyx/engine/dist-android`, 샘플 APK는 `sample/nelyx-engine-v2-android/dist/v2-android/android/application.apk`다. CLI의 `--target android --architecture x86_64`는 명시적 emulator Vulkan profile이며 일반 arm64-v8a profile은 hardware Vulkan을 요구한다. 일반 프로젝트 명령은 [SDK 사용 안내](Nelyx/sdk/README.ko.md#일반-v2-프로젝트)를 따른다.

**검증 기록 — 2026-11-07 KST:** 현재 source/Windows·Web/Android 공급 identity는 **`19de18b7…` / ABI 2·schema 4042167114 / App service 12**로 일치한다. Windows/Web 공급 **349파일**, Android **43파일**이며 두 Android ABI의 Skia/Dawn library hash와 필수 6 library의 16 KiB LOAD alignment를 빌드에서 검사한다. Emulator는 **Pixel_5 / Android 13(API 33) / x86_64 / host GPU(Dawn-Vulkan)**이며 arm64-v8a는 cross-build다.

| 검사 | 결과 |
| --- | --- |
| Android 일반 공급/설치 | arm64-v8a·x86_64 빌드 PASS. 일반 `run:engine-v2:android -- --device=emulator-5554`로 실제 APK 설치·동일 source 로드·C++ **466명령 = SDK 466**, fallback **0**·첫 GPU frame을 확인 |
| Data Widget 설치 앱 | **56조건 PASS**. 네 native owner·Material/Cupertino State와 controlled 수락/거부·실제 OS InputConnection·nested batch·Hangul 조합·UTF-16/code-point/grapheme·newCursorPosition·실제 터치 caret/키보드 resize·stale connection·password·UiAutomation·Activity 재생성/늦은 JNI 거부·실제 Dawn loss와 복구 뒤 입력 |
| 원본 Widget 설치 앱 | **22조건 PASS**. 원래 TypeScript theme/State·padded 버튼 여백의 실제 탭·controlled 수락/거부·AnimationController/Opacity·TextField 입력 거부 후 correction ACK·emoji/한글 조합·controller 교체/refocus·실제 Dawn loss와 새 State·종료. 명시한 InkRipple theme를 사용. C++ **1407명령 = SDK 1407**, fallback **0** |
| Android 공개 API corpus | 설치한 Original 앱에서 실제 자산 **20읽기**·네트워크 **14읽기**·동적 글꼴·TextPainter 질의·raw RGBA/BGRA·PNG/GIF **10 decode/animated 4 frame**과 readback 실행. C++ **32명령 = SDK 32**, fallback **0**. Header/body 대기 IO 두 개를 취소하고 App dispose·worker 종료·ledger **0** 확인 |
| 자동 복구/회수 | Data·Original 각각 실제 Dawn device를 잃게 한 뒤 이전 owner의 **status=0 / reservedBytes=0 / memoryTotal=0 / workersJoined=true / appDisposed=true / recoverable=true / failed=true**를 확인하고 새 native generation/State·GPU frame으로 복구. 정상 종료는 `failed=false`. Ledger/worker 종료 증거이며 Java heap/RSS 0이나 모든 loss/vendor 조합을 뜻하지 않음 |
| Android 개발 reload | 첫 APK 실행 → 문법 오류에서 기존 PID/세대 유지 → 수정된 소스의 새 APK 준비 → 이전 세대 drain → 새 PID/세대 실행 → close drain PASS. Source 중복 알림·`.nelyx` cache 변경은 추가 세대를 만들지 않음. Dispose를 거부하면 exit **1**, 기존 세대 번호 유지·새 APK 실행 거부·임시 candidate 삭제. 전체 Android Node suite **4/4 PASS** |
| 일반 CLI | 독립 package의 공급 포함·설치/첫 frame, 손상 HBC/공급·누락 capability·ABI 중복/RN profile 거부와 RN 없는 create graph PASS |
| 공통 C++/Widget/픽셀 | **430/430 PASS**, Native·single-worker·threaded와 편집 ACK/focus 순서 회귀 포함. Style-only 보존·가로 caret reveal·최소 터치 영역/여백 capture·controlled refusal 확인. 실제 CanvasKit 그림/텍스트/clip·hairline/none border 픽셀 **11/11 PASS** |
| Windows/Web host | **17/17 PASS**. 두 Windows host의 TSF/UIA 실제 편집·pointer/control·회수, Chromium/Chrome/Edge의 두 profile·pressure·실제 탭 visibility. 첫 갱신의 editable style-only 명령을 포함해 같은 ACK의 실제 C++ 총계와 SDK 증가분을 대조. Bounded App event 증거는 해당 입력 구간에서 검사 |
| Windows/Web 개발 회귀 | **7/7 PASS**. 시작 중 source 변경·Web 두 profile의 정상 교체/준비 실패·시작 중 close/늦은 build 차단·dispose 실패·superseded candidate 미게시·두 Windows VM/host의 drain 후 교체 |
| 공유 App 서비스/도구 | App text/image/network/bootstrap/font **16/16**, 일반 runner/설치 compiler·archive/pack **20/20**, API audit 회귀 **21/21**, 기존 RN Android source/lifetime/pointer **5/5** PASS. v1 RN 설치/IME 두 harness는 별도 emulator serial/설치 준비 gate에서 종료했으며 이번 v1 설치 runtime 검증으로 세지 않음 |
| 입력 geometry/정적 검사 | geometry **2/2**, retained/활성화 실패 **7/7** PASS. 전체 workspace type check·두 Android sample의 strict type check·lint·변경 JS/TS format·`git diff --check` PASS |
| 화면 확인 | 일반 실행 APK의 한국어·password masking·두 디자인 버튼/스위치 표시를 직접 확인. ADB swipe 두 번 후 실제 마지막 **Android scroll item 12**가 표시됨을 확인. 스크린샷·검증 로그·시험용 package/앱 임시 폴더를 정리했으며 시험 emulator도 정상 종료. 아래 출력 파일 2개의 정리만 남음 |

Emulator 성공을 arm64 실기기·IME별 물리 조작·TalkBack 제품 수락·display/scanout·성능으로 판정하지 않는다. 최소 OS 26의 runtime·제품 signing/고지·전체 공급 조합 qualification도 별도다.

**정리 잔여:** 자동 승인 검토가 `Remove-Item` 정리 명령을 `blocked by policy`로 거절하여 `.nelyx/android-v2/emulator-current.out`·`emulator-current.err` 두 출력 파일이 남았다. Emulator는 `computer-use` 스킬의 정상 창 닫기로 종료했으며 실행 중인 검증 기기는 없다. 이전 출력 사본이나 검증 archive를 추가하지 않았다.

**전체 API 구성과 판정:** [전체 감사 도구](Nelyx/engine/tools/api-audit.mjs)의 기본 target에 Android를 포함했다. 원래 **4 package/834 subpath**의 고정 분모와 현재 **848 module/4,630 export occurrence**를 유지한다. Android 적용 **811 module/4,489 occurrence**, OS별 비적용 **37/141**이며 적용 여부가 승인 allowlist를 뜻하지 않는다. TypeScript **7.0.2**, NodeNext·ES2022·`types: []`·DOM 없음·`skipLibCheck: false`의 전체 Android 선언 검사는 **inputValid=true / error=0**다. Windows/Web도 각 전체 선언 검사는 통과한다.

전체 API의 원래 surface 대조는 **inputValid=false / compatible=false / originalSurfaceChanged 18건**이다. 전체 상태는 `missing=4028`, canonical data reuse의 behavior 미검증 **452**, `signatureChanged=127`, 부분 behavior **7**, behavior 검증 **1**, asset 미검증 **15**다. 기존 Source 코드나 strict import 성공만으로 runtime 호환을 승인하지 않는다. `npm.cmd run audit:engine-v2:api`는 현재 strict 미통과(exit 1)이며 이 gate를 숨기거나 원래 분모를 줄이지 않았다.

**남은 gate / 다음 작업:** W9-12-B/13의 전체 원래 API·서명/structural 차이와 Original 전체 디자인 catalog를 계속 구현·검증해야 한다. 이번 편집기 범위는 Material `decoration: null`·Cupertino 기본 단일행이며 샘플 Theme는 지원하는 `InkRipple.splashFactory`를 명시한다. Android 기본 InkSparkle의 native shader는 미연결이며 기본 theme 전체 호환으로 승인하지 않는다. Selection handle/toolbar·Source 동기 editing geometry·custom/multiline layout·전체 keyboard/autofill/platform/messenger service와 OS font 변경 알림도 미완료다. Decoder/IO corpus가 모든 Image/Canvas 장면의 GPU 복구를 입증하지도 않는다. 실제 arm64 기기의 IME/vendor·TalkBack·메모리/입력/resize 성능과 display/scanout은 W9-14에서 별도로 확인한다. 전체 API `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`와 Android W9-13 **PARTIAL**을 유지한다. Linux·iOS·macOS는 **DEFERRED**다.

## 5. Linux — GTK4 호스트

**2차 W9-03 / DEFERRED.** 아래 설계는 보존하며 GTK prototype·toolchain·DMA-BUF 추출은 Windows/Web 1차 작업에 포함하지 않는다.

**RNL의 GTK 플랫폼 API 소스를 가져와 수정하는 것을 기본 구현 경로로 삼는다.** 기존 [Linux template](Nelyx/sdk/tooling/cli/templates/nelyx-app/linux/CMakeLists.txt)과 [입력 공급 검증기](Nelyx/sdk/tooling/cli/src/linux-inputs.mjs)의 `@lucid-softworks/react-native-linux`·원본 revision `9412cf605c7cc77f920916401926ff9a9873ecd3`를 선정 출발점으로 삼고 실제 소스·license·GTK 버전/API·필수 의존성을 M0에서 고정한다. 기존 runner가 RNL을 사용한다는 사실만으로 새 v2 이식을 완료 처리하지 않는다.

RNL의 window/이벤트·pointer/key/focus·IME·접근성·clipboard·환경/lifecycle/service 구현을 실제 추출·수정하고 React tag/context/renderer 연결을 Nelyx dispatcher·view/handle·Core port로 바꾼다. 아래 GTK4·IM·AT-SPI 단계는 이 수정 이식본의 연결·검증 의무다. 원본의 toolkit/API가 GTK4/4.22 계약과 다르면 해당 부분을 수정 이식하고 gap을 기록하며, GTK API를 처음부터 별도 구현해 ‘RNL 참고 완료’로 바꾸지 않는다.

**GTK4 UI와 독립 Render worker 사이에 immutable GPU frame을 전달한다.** GTK widget·window·IM·접근성 객체는 UI main context에서 관리하고 App/Hermes·Content/layout·Render/GPU owner는 분리한다. GTK 객체를 Render thread에서 임의로 조작하지 않는다. [GTK threading 규칙](https://docs.gtk.org/gtk4/section-threading.html)

저장소에는 이미 [DMA-BUF exporter](Nelyx/skia/native/platforms/vulkan/dmabuf.inc)와 [GdkTexture import helper](Nelyx/skia/packages/rn/native/linux/DmaBufTexture.h)가 있다. RN/JSI 수명을 제거한 공통 계층으로 추출해 재사용을 검토한다. 해당 소스는 출발점이며 v2의 실제 GTK4/GPU 실행 증거는 아직 없다.

로컬 [Flutter Linux GTK 설정](reference/flutter-master/engine/src/flutter/shell/platform/linux/config/BUILD.gn)은 `gtk+-3.0`을 사용한다. Flutter는 owner/frame 경계의 보조 비교 자료다. 플랫폼 API의 실제 원본은 RNL로 고정하고 수정 이식본을 아래 GTK4 공개 계약에 연결한다.

1. UI에서 GDK display의 지원 fourcc/modifier를 조회하고 Render device와 교집합을 고정한다. 기본 후보는 기존 ARGB8888 경로다. Alpha·stride/offset·color state·물리 크기와 scale을 명시하고 Wayland/X11 및 driver별 실제 import를 확인한다.
2. Render가 GPU frame을 완성하고 외부 consumer가 읽어도 되는 상태로 넘긴 뒤 UI가 `GdkDmabufTextureBuilder`로 texture를 만든다. 기존 exporter의 동기 GPU 완료 대기는 **Render owner**에서만 허용하며 UI를 막지 않는다. GPU copy/대기·할당 비용은 계측 대상이고, DMA-BUF라는 이유로 전체 경로를 zero-copy나 저지연으로 판정하지 않는다.
3. Custom GtkWidget의 snapshot 또는 GtkPicture가 준비된 texture를 GTK scene에 연결한다. Engine publication 후보·GTK 채택·GPU 완료를 구분하고 입력은 해당 host publication의 geometry를 사용한다. GTK snapshot 실행이나 frame-clock callback을 물리 scanout 증거로 쓰지 않는다.
4. Frame lease는 GDK의 최종 texture release까지 FD·VkImage·memory를 보유한다. Reference 해제 callback은 engine/App callback에 재진입하지 않고 해당 GPU owner로 회수를 전달한다. Resize·hide·import 실패·close에서 GDK reference와 늦은 callback을 먼저 정리할 수 있도록 pump와 Render drain 순서를 고정한다.
5. Core frame hold·최신 게시 대기·GDK consumer hold와 exporter의 별도 제한을 한 ledger에 연결한다. 기존 exporter의 **4096축/64 MiB** 제한과 v2 provider의 크기/예산 차이는 W9-03 착수 때 조정한다. 큰 창에서 숨은 CPU readback이나 무제한 buffer를 켜지 않으며 초과는 명시적 거부다.
6. Keyboard·pointer·`GtkEventControllerScroll`·focus·clipboard를 canonical input으로 변환한다. `GtkIMMulticontext`의 preedit/commit/surrounding/delete/cursor-location을 Core editing revision에 연결하고 UTF-8 byte/문자 offset과 UTF-16을 각 API 규약대로 변환한다. IME가 소비한 key를 다시 일반 text로 적용하지 않는다.
7. Semantics node의 GtkAccessible peer와 formatted text용 GtkAccessibleText를 구성한다. GTK label만 갱신한 것을 전체 tree/text/action 지원으로 세지 않는다. AT-SPI 질의·action·focus·stale node·게시 range bounds와 caret/selection 변경을 실제 peer에서 검사한다. 접근성 character offset도 UTF-16과 구별해 변환하고 변경 요청은 Core revision/ACK·GTK의 변경 통지에 연결한다.

**Linux 최소 GTK는 4.22 이상으로 올린다.** DMA-BUF builder와 AccessibleText 기본 조회는 4.14, text extents/offset은 4.16부터지만 계획에 포함한 caret·selection 변경 vfunc는 **4.22부터**다. 4.16의 조회 기능만으로 전체 편집 접근성/action 완료를 선언하지 않는다. Compile/link와 실행 환경 모두 4.22 이상 및 실제 사용하는 API의 도입 버전을 확인한다. [DMA-BUF builder](https://docs.gtk.org/gdk4/class.DmabufTextureBuilder.html), [build/release 계약](https://docs.gtk.org/gdk4/method.DmabufTextureBuilder.build.html), [IMContext](https://docs.gtk.org/gtk4/class.IMContext.html), [AccessibleText](https://docs.gtk.org/gtk4/iface.AccessibleText.html), [caret 변경](https://docs.gtk.org/gtk4/vfunc.AccessibleText.set_caret_position.html), [selection 변경](https://docs.gtk.org/gtk4/vfunc.AccessibleText.set_selection.html)

DMA-BUF import 성공 때만 GDK consumer로 lease를 넘긴다. Import 실패의 임시 FD/lease·builder/GError는 호출 측에서 회수하고 성공 후에는 최종 texture release까지 frame을 재사용/변경하지 않는다. Release callback의 실행 thread를 가정해 GPU를 직접 파괴하지 않고 owner로 회수를 전달하며 close는 UI pump·그 회수 mailbox·GPU owner가 살아 있는 동안 마친다. GDK와 exporter의 hold를 함께 계수하고 실패/resize/close 뒤 FD·native/GPU 자원·ledger를 대조한다.

W9-03 착수 때 Linux 배포판/glibc·GLib/GTK·Vulkan loader/driver·libdrm·font/ICU 기준을 고정한다. Wayland/X11 각각 같은 일반 앱의 build/run/doctor/pack·동적 library/rpath·설치본 실행과 손상 거부를 W9-13에 연결한다. 개발 PC에만 있는 library나 환경 변수로 실행된 prototype을 일반 배포 성공으로 세지 않는다.

W9-03/13은 RNL 원본·가져온 파일/함수·Nelyx 수정·기존/새 소비자·필수 dependency·license/notice와 실제 GTK4 OS API 실행을 함께 확인한다. 입력/IME·접근성·서비스·수명별 이식/미이식 상태를 남기고, 실제 RNL 소스가 사용되지 않거나 전체 기능을 직접 재작성한 상태는 완료가 아니다.

GTK widget은 surface/texture 게시·입력·접근성 host를 담당한다. Material/Cupertino 화면은 원래 TypeScript 패키지가 구성하고 C++ engine이 그리며, GtkButton/GtkSwitch 등으로 디자인 Widget을 바꿔 전체 호환을 판정하지 않는다. Wayland/X11에서 같은 TypeScript theme·State/callback과 공통 engine의 입력/paint 결과를 검사한다.

`GtkGLArea`는 OpenGL framebuffer를 GTK에 통합하는 별도 방식이다. 현재 Graphite/Vulkan renderer를 그 안에 바로 연결할 수 있다고 가정하지 않는다. DMA-BUF prototype이 실패하면 실패한 capability·환경을 기록하고 Linux gate를 미완료로 유지한다. GL provider 추가는 owner·Skia 공급·기능 동등성을 다시 설계하는 명시적 대안이다. [GtkGLArea 계약](https://docs.gtk.org/gtk4/class.GLArea.html)

Android/Linux W9-13은 TypeScript 디자인/자산과 공통 native engine/provider/host 공급의 분리를 확인한다. 두 디자인 패키지 아래에 native Widget source/target·engine binary를 추가하지 않고, 기존 capability 안의 theme/스타일 변경이 TypeScript 패키지/adapter 갱신으로 반영되는지 검사한다. 명시적 platform view는 W9-11의 별도 계약을 따른다. 현재 Android는 위 구현 **PARTIAL**, Linux는 **DEFERRED / notVerified**이며 전체 W9-13과 제품 수락 조건을 유지한다.
