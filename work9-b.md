# work9-b — v2 단일 실행 경로 완성과 제품 전환

작성·갱신: **2026-11-08 KST** · 상태: **W9B-00 완료 / W9B-00-H 완료 / 구조 개편 PARTIAL**

이 문서는 사용자 요청으로 종료한 [work9-a.md](work9-a.md)의 **남은 작업과 재개 절차를 이어받는 실행 계약**이다. W9B-00의 당시 기능·공급·실행 결과는 §3.1–3.3에 보존한다. §3.4의 **W9B-00-H**에서 App SDK 단일 host·독립 HWND target 제거·RNW clipboard 소스 이식을 구현했다. 플랫폼별 원본/기존 소비자/부족 범위와 당시 실행 근거는 §3.4–3.5를 따른다.

**2026-11-08 사용자 요청으로 작업 방식 변경:** 이후에는 **W9B-01–05의 구현을 묶어서 진행 → W9B-06 통합 검증 → 발견한 문제를 모아서 수정 → 영향 범위 재검증** 순서로 실행한다. 개별 기능·파일·구현 시도마다 전체 빌드·설치·대상별 실행을 반복하지 않는다. 먼저 Windows/Web 차수의 구현과 실제 앱 연결을 모으고, Android와 후속 플랫폼은 기존 차수 경계를 따른다. 상세 실행 규칙은 §4.3·§7에 두며, 이번 계획 수정으로 구현·검증 완료 상태를 바꾸지 않는다.

[전체 work9 목차](work9.md) · [이전 구조 계약과 종료 기록](work9-a.md) · [API·디자인·입력 계약](work9-2.md) · [기술·제품 수락 기준](work9-3.md) · [Android·Linux](work9-4.md) · [후속 iOS·macOS](work9-5.md)

## 1. 이어받는 목표와 경계

- **단일 frontend:** 원래 Widget/Element/State/BuildContext/Key를 사용한다. BuildOwner가 native 설정을 만들고 SceneWriter에 직접 전달하며 두 번째 Widget tree를 만들지 않는다.
- **실행 소유권:** TypeScript는 구성·State·theme·controller·callback·명령 기록을, C++는 최종 layout·geometry·hit-test·gesture·편집 document·scene·자원 권한을 맡는다. OS/Web host는 surface·clock·입력 carrier·IME·clipboard·접근성·종료를 맡는다.
- **디자인 소유권:** `packages/material`·`packages/cupertino`의 원래 TypeScript 컴포넌트와 기본 정책을 유지한다. C++ 컴포넌트 사본이나 adapter 전용 State를 만들지 않는다.
- **API 기준:** [public-api.json](Nelyx/engine/schema/public-api.json)의 4개 package·**834 subpath**와 원래 서명 hash를 보존한다. 미지원 export를 삭제하거나 분모를 다시 만들어 호환 완료로 처리하지 않는다. 전체 판정은 **compatible=false**다.
- **동기 API:** App 로컬 C++/Wasm paragraph 질의를 유지한다. 게시 geometry 관측은 원래 동기 geometry 계약의 대체 완료가 아니다. custom layout/paint/hit-test·React component·직접 Renderer 주입 API의 미해결 의미를 명시적으로 해결한다.
- **전환 순서:** 대체 구현 → 실제 소비자 이관 → 제품 확인 → 구 실행부·설정 삭제를 따른다. 미지원 capability·target·공급 불일치는 명시 실패하며 TS/RN renderer로 자동 fallback하지 않는다.
- **수락 경계:** W9-13 기술 완료와 W9-14 물리 입력·표시·성능·기본값 전환을 구분한다. `performanceAccepted=false`·`resizePerformanceAccepted=false`, 물리/display/scanout **notVerified**, Linux·iOS/macOS **DEFERRED**를 이어받는다.

기존 W9-00–14와 W9A-00–12의 원래 의무는 유지한다. 아래 W9B 번호는 남은 실행 묶음의 순서이며, 이전 미완료 항목을 완료로 바꾸는 재번호가 아니다.

### 1.1 사용자 확정 host·플랫폼 API 구현 방식

**플랫폼 API는 아래 upstream의 필요한 구현 소스를 실제로 가져와 Nelyx에 맞게 수정·사용한다.** 기능 목록이나 회귀 사례만 참고한 뒤 자체 구현을 처음부터 만드는 방식을 기본 경로로 두지 않는다. 기존 자체 구현은 현재 동작·소비자·교체 경계를 확인하는 기반이며, 이미 동작한다는 이유만으로 소스 이식 의무를 생략하지 않는다.

| 대상 | 채택 host | 플랫폼 API의 소스 기반과 적용 |
| --- | --- | --- |
| Windows | **Windows App SDK + C++/WinRT 단일 host** | **RNW(React Native Windows)**의 입력·IME·focus/capture·UIA·clipboard·환경/설정·lifecycle/service 구현을 선별 복사하고 App SDK dispatcher·Core port에 맞게 수정 |
| Android | Activity/View·JNI + 공통 C++ engine | **RN(React Native) Android**의 플랫폼 API 구현을 가져와 Context/Activity/view 소유권·JNI·Core mirror/ACK로 수정 |
| iOS | UIKit·Objective-C++ + 공통 C++ engine | **RN iOS**의 입력·keyboard·접근성·서비스·scene/lifecycle 구현을 가져와 UIKit host와 Core 계약으로 수정 |
| macOS | AppKit·Objective-C++ + 공통 C++ engine | **RNM(React Native macOS)**의 AppKit 플랫폼 API 구현을 이식. RNW를 macOS 원본으로 사용하지 않음 |
| Linux | GTK4 + 공통 C++ engine | **RNL(React Native Linux)**의 GTK 입력·IME·접근성·서비스·window/lifecycle 소스를 가져와 GTK4 host와 Core 계약으로 수정 |
| Web | 기존 DOM·Worker·CanvasKit host | 현재 두 profile 유지. 이번 native 소스 이식 결정으로 Web 구조를 바꾸지 않음 |

App SDK를 사용하지 않는 **독립 `windows-hwnd` host는 제거 대상**이다. App SDK 내부의 HWND interop·surface/input handle과 공통 native Core/provider library는 필요한 구현으로 유지한다. 원래 Widget·Material/Cupertino·State/theme/controller는 계속 TypeScript이고, C++ Core의 최종 layout·editing document·gesture·scene 권위와 App/Content/Render owner는 유지한다.

각 API는 `upstream 원본 → 가져온 파일/함수 → Nelyx 수정 → 기존 소비자 교체 → 일반 앱 확인`으로 대응시킨다. 원본 repository·tag/commit/package integrity·원본/수정 파일 hash·license/notice와 필요한 의존성을 현재 소스의 출처 정보로 관리한다. ReactContext/React tag·Fabric/TurboModule/bridge callback은 Nelyx의 owned view/dispatcher·값/handle·Core port로 수정한다. 소스 출처를 보존한 fork·수정은 허용하며, React renderer/Yoga·별도 VM/scheduler를 추가 실행 권위로 들이지 않는다.

Upstream에 해당 API가 없거나 분리할 수 없는 부분은 **구체적인 부족 범위·필요한 연결 코드·남은 동작**을 명시한다. Nelyx 전용 wire/세대·Core geometry·toolkit 연결 코드는 작성할 수 있지만, 기능 전체를 직접 다시 만든 뒤 ‘참고/재사용 완료’로 기록하지 않는다. 실제 이식이 0개인 상태는 native 플랫폼 API 이식 완료가 아니다.

## 2. 시작 시점의 구현과 공급 상태

### 2.1 구현된 기반과 남은 범위

| 범위 | 이어받는 구현·확인 기록 | 남은 의무 |
| --- | --- | --- |
| W9A-00–03 기반 | 소비자 대응·App 계약·중립 native/tooling helper·BuildOwner → SceneWriter 직접 연결, `@nelyx/sdk/app`의 defineApp/launchApp | 플랫폼별 최소 수직 앱의 전체 확인 범위, 원래 API·custom hook·동기 geometry의 미해결 의미 |
| W9A-04 Core | 모듈 소유 Box/Flex/Stack/clip/transform 설정, LayoutBuilder, 고정/가변 Source 목록·controller·공유 예산, Icon/CJK run | 최근 mouse/Wrap/baseline/positioned 변경의 동작 검증, 남은 render/layer/gesture/focus/editing 설정과 TS 실행 소비자 정리 |
| W9A-05 디자인 | 원래 Material/Cupertino 일부 controls·Snapshot/Zoom 정책·기본 semantics/route 연결 | 기본 theme/painter·InkSparkle·Tooltip 위치·form·route/overlay·전체 catalog |
| W9A-06 서비스 | 공통 session·asset/buffer/font/text/image/network 기반, clipboard·feedback·게시 semantics binding | 전체 OS 환경/font/lifecycle·VM globals/언어 의미·reload/loss·SDK host API 대응 |
| W9A-07 도구 | 신규 `nelyx.json`·원래 Widget template·compiler helper 분리·엔진 공급과 App bundle 분리 | 공통 target descriptor·전체 설정 이관·create/doctor/build/run/dev/pack 조합과 기존 RN tooling 종료 |
| W9A-08 대표 앱 | Android sample은 일반 App entry와 원래 controls/controller 사용 | Testbed/Demo의 실제 화면·상태·탐색 전체 이관, Android 기본 painter·기기 확인 |
| W9A-09–12 전환·삭제 | 부분 기능·설치 소비자·host 실행의 과거 근거 존재 | 기술·제품 수락, 대상별 기본값 전환, 후속 플랫폼과 저장소 전체 레거시 제거 |

상세 기능·설치·종료 기록은 [work9-a §11](work9-a.md#11-현재-구현과-다음-시작점)에 보존한다. 최소 앱, 일부 controls, 목록, clipboard 등의 PASS는 해당 소스·공급·기능 범위의 기록이다. 새 schema에 영향을 받는 회귀와 아직 확인하지 않은 조합을 구분한다.

### 2.2 최근 미검증 변경과 공급 불일치

아래 표는 **W9B-00 시작 전 문서 전환 시점**의 상태다. 이번 실행의 현재 공급과 검증 결과는 §3.2를 따른다.

| 항목 | 문서 전환 시 확인한 상태 |
| --- | --- |
| 미검증 구현 | `rendering/mouse-region.ts`·`widgets/raw-tooltip.ts`의 exact-prototype/exclusive 정책, retained pointer path, Wrap native 설정, Flex baseline, positioned Stack과 관련 scene/codec/Core 변경 |
| 당시 완료한 검사 | Core package build·전체 check:types·변경 C++ 5개 unit의 `/W4 /WX` compile-only. 실제 동작·protocol 통합·설치 소비·host 실행은 **notVerified** |
| Source protocol | ABI 2·schema **3719990506**·layout wire **192 bytes** |
| 마지막 검증 공급 | Windows/Web `engine/dist`와 Android `engine/dist-android`는 source **f26ab2f19156a30d936c2a03f0a2e3aaf027e1e6aea53ad1afe2f0aea27f43a5**·schema **855578348** |
| 시작 시 소스와 공급 | 당시 읽기 확인에서도 **불일치**. 이전 문서의 source identity 문자열을 현재값으로 사용하지 않고 `sourceIdentity()`를 다시 산출해야 했음 |
| 마지막 원래 Gallery 실행 | 실제 878 modules·original-elements·NotoSansKR/MaterialIcons/CupertinoIcons 사용. Web 두 profile 모두 `_RenderExclusiveMouseRegion`에서 명시 실패했고 close 예약 0·worker 종료 확인 |
| 당시 새 코드의 Gallery 판정 | 실행하지 않아 위 차단의 해소 여부와 그다음 실패 지점은 **미확인**이었음 |

이전 공급으로 새 wire 동작을 판정하지 않는다. 공급 갱신 후에도 첫 화면만으로 resize·탐색·controls·전체 catalog를 통과 처리하지 않는다.

## 3. 첫 재개 묶음: W9B-00 — 완료

아래 완료는 당시 기능·공급 검증에 한정된다. 당시 두 Windows host의 PASS는 새 host 채택 결정의 완료를 뜻하지 않으며, 사용자 교정에 따른 구조 변경은 §3.4에서 별도로 수행한다.

**목표:** 최근 작성한 mouse/Wrap/Flex/Stack 코드의 의미와 wire 경계를 검토·보완하고 현재 공급으로 원래 Gallery의 실제 진행 지점을 확인한다. 우선순위는 아래 순서다.

- [x] 현재 소스·git 상태와 [이전 미검증 기록](work9-a.md#11-현재-구현과-다음-시작점)을 대조한다. 변경이 이미 commit돼 있으면 해당 소스를 기준으로 검토하며 미검증 구현을 검증 완료로 간주하지 않는다.
- [x] **MouseRegion/Tooltip:** 원래 exact-prototype 설정, 중첩 exclusive 선택, opaque/translucent·child-first hit 경로, enter/exit/hover·이동/제거·capture 경계를 확인한다. Tooltip 위치 delegate와 overlay 연결의 미지원 범위도 확인한다.
- [x] **Wrap:** 양축 방향·줄/자식 정렬·음수 spacing/runSpacing·bounded/unbounded 제약·overflow clip과 dry/intrinsic 의미를 원래 Source 구현과 대조한다.
- [x] **Flex baseline:** alphabetic/ideographic·baseline 없는 자식·cross alignment·RTL/수직 제약·dry/intrinsic 경계를 확인한다.
- [x] **Positioned Stack:** offset/크기 조합·fit/alignment·부모 resize·positioned-only·unbounded·dry/intrinsic 의미를 확인한다. Stack intrinsic이 미해결이면 명시적으로 남긴다.
- [x] **Protocol/Core:** 192-byte layout·새 event policy의 정상 입력과 malformed/reserved/flag·identity 경계를 확인한다. 실패한 준비와 NACK 뒤 이전 accepted/active scene 및 resource 수명을 보존한다.
- [x] **영향 회귀:** Source 목록·controller·공유 예산·State/Key·resize/empty/0 높이, LayoutBuilder, TapRegion, Offstage, semantics/route, Snapshot 중 변경된 layout/hit/wire의 영향을 받는 범위를 묶어 확인한다.
- [x] 필요한 보완 후 Core·Windows/Web 엔진·Android 두 ABI 공급을 갱신한다. 실제 source identity·manifest의 모든 파일 hash·ABI/schema·App service version·font cohort와 원래 API 기준 파일을 확인한다.
- [x] 새 8개 package의 일회성 설치 소비자에서 실제 TypeScript 7.0.2·NodeNext·ES2022·`types: []`·`skipLibCheck: false`, template·관련 Core/Material/Cupertino/SDK 선언과 CLI doctor/build/pack을 확인한다.
- [x] Web single-worker/threaded와 Windows HWND/App SDK에서 실제 원래 Widget 앱과 Gallery를 실행한다. 첫 화면·resize·hover/Tooltip·실제 탐색의 성공 범위와 다음 미지원 지점을 기록한다. Android는 두 ABI 빌드와 emulator/실기기 실행 여부를 각각 남긴다.
- [x] 정상 close·실패 drain의 App dispose·worker join·예약/메모리/holder 회수를 확인하고 임시 App·설치본·archive·browser/server·native 창을 회수한다.

**완료 조건:** 최근 구현에 대한 Source/Core 의미·protocol·설치 소비·대상별 실제 실행 결과가 구분돼 있고 현재 소스와 공급이 일치한다. Gallery의 이전 차단 해소와 새 차단 유무를 실제로 관측한다. 미해결 기능은 다음 묶음에 연결하며 이 단계만으로 전체 catalog나 성능 수락을 선언하지 않는다.

### 3.1 구현 검토와 보완

- **Mouse:** pressed movement에서도 live mouse annotation 경로의 enter/exit를 갱신하고 hover sample만 onHover를 보낸다. 이전 hit 경로의 inverse transform을 보존해 이동한 영역의 exit local 좌표를 계산한다. mouse/exclusive/opaque 정책 변경은 retained input geometry 공유를 무효화하며 잘못 조합한 event policy는 transaction에서 거부한다. 원래 exact-prototype·중첩 exclusive·child-first/translucent 정책을 유지한다.
- **Layout:** baseline 유무를 음수 좌표와 분리하고 alphabetic/ideographic을 각각 전달한다. baseline 없는 Flex 자식과 음수 Wrap overlap의 baseline을 보존한다. Flex cross intrinsic의 baseline은 원래 child constraints의 dry layout으로 구하며, Wrap max intrinsic은 음수 spacing의 실제 span을 계산한다. canonical Stack intrinsic에서 positioned 자식은 제외한다. 위치·크기·fit·resize와 positioned-only/empty·unbounded 제약을 대조했다.
- **Wire:** 192-byte layout과 schema를 유지한다. codec의 run alignment·overflow clip enum이 잘못된 JS 값을 0으로 바꾸지 않도록 검증한다. malformed layout/policy·reserved·identity 거부와 accepted/active·resource rollback을 구분한다.
- **영향 회귀에서 발견한 수정:** 가변 목록의 새 측정으로 index seek 목적지가 준비 범위 밖으로 이동하면, 기존 active scene을 보존한 채 실제 목적 구간을 다시 준비한다. 이전 anchor로 돌아가 pending seek를 잃던 경우를 고쳤다. Web resize 중 현재 route blob이 일시 누락돼도 마지막 안내문을 보존하고, 명시적인 빈 route에서만 지운다.
- **Android 공급:** Gradle/IDE가 만든 `.gradle`·`build` cache는 source identity와 project 복사에서 제외한다. wrapper JAR를 IDE가 열어 promotion을 막던 문제는 같은 volume의 TEMP에 한 staging을 만들고 `finally`로 회수하도록 보완했다. 현재 Android 공급은 cache 파일 없이 42개다.

### 3.2 W9B-00 당시 공급·검사·실행 근거

W9B-00 당시 Windows/Web와 Android 두 ABI의 source identity는 **`cc66ae1c056114544b417bb23b8cf8d80bbd7d2fc0d930b90716089b57c95c96`**다. `engine/dist` 343개와 `engine/dist-android` 42개 manifest 파일의 SHA-256을 모두 확인했다. ABI **2**·schema **3719990506**·layout **192 bytes**·App text **12**·App service **2**를 유지하며 default/Arabic/Hebrew/Emoji font cohort가 양쪽 공급에 포함된다. 원래 4개 package·834 subpath API 기준 파일 SHA-256 **`5133a536f72ef9ec31c411bc091cf29662ee315fd77268d4b8a34f532fb8dffd`**는 그대로다.

| 확인 묶음 | 이번 실행의 결과와 한계 |
| --- | --- |
| Source/Core 의미 | 실제 원래 RenderWrap/Flex/Stack과 현재 native Core의 **33개 사례·641개 값** 비교 PASS. 양축 정렬·RTL/up·음수 spacing/runSpacing·두 baseline·baseline 없는 자식·positioned/empty/resize·dry/intrinsic와 exact-prototype 거부를 확인. native `/W4 /WX` 비교와 mouse 경로 검사 PASS |
| Protocol/수명 | Wasm의 malformed/identity **19개 사례** 거부, NACK 뒤 이전 accepted/active·resource 보존, accepted 준비 실패 뒤 이전 active 보존과 복구 PASS. session close memory 0 |
| 설치 소비 | 현재 Core/SDK/Material/Cupertino/CLI/Metro/tooling-contracts/static-aot **8개 archive**를 새 소비자에 offline 설치. 실제 TS **7.0.2**, NodeNext·ES2022·`types: []`·`skipLibCheck: false`의 template·관련 선언 PASS. 설치 CLI create/doctor·Windows/Web build·standalone Web pack PASS |
| Web 원래 App | Chrome single-worker/threaded에서 생성 template, State·mouse enter/exit·tap·LayoutBuilder 220→180px·Wrap/Flex/positioned Stack App, 원래 sample controls의 첫 화면·상태 변경과 resize PASS. 실제 screenshot 확인. Edge·전체 controls/탐색·Tooltip 위치는 이번 수락 범위가 아님 |
| Web 영향 회귀 | 두 profile에서 고정/가변 Source 목록·0/소수 높이·capacity 0/2 공유 예산·index seek **83px**와 0 복귀·empty/복구·폭 220→180px·GlobalKey reparent PASS. 각 profile **State init 44/dispose 44**, stable State init 1. TapRegion inside/outside, Offstage 숨김/복원 semantics, route 안내와 resize 후 보존, Snapshot capture/reuse PASS |
| Windows 두 host | HWND/App SDK의 일반 CLI 실행에서 원래 Widget 화면과 OS mouse 입력·UIA·GPU screenshot·resize 확인. 최종 공급의 위 목록 회귀도 두 host에서 seek/복귀·empty/복구·Key 이동·TapRegion·maximize 후 화면을 확인하고 각각 **State 44/44** 회수. 물리 입력·scanout 확인은 아님 |
| 원래 Gallery | NotoSansKR/MaterialIcons/CupertinoIcons를 포함한 실제 원래 graph(Web **878**, Windows **879 modules**) 실행. Chrome 두 profile·HWND·App SDK 모두 이전 `_RenderExclusiveMouseRegion` 차단을 지나 **`custom-or-unported-render-object:RenderPointerListener`**에서 명시 실패. Gallery 첫 화면·catalog 탐색은 미통과 |
| Android | **arm64-v8a/x86_64 cross-build PASS**. 설치 CLI의 원래 Widget App을 **Pixel_5 / emulator-5554 / x86_64**에서 일반 build/run으로 설치·실행: native commands **627**, rejected fallbacks **0**, first frame 관측. 정상 stop에서 App dispose·worker join·예약/메모리 0. arm64 실행·물리 기기·Android Gallery/전체 입력은 미실행 |
| 종료·회수 | Web 정상/실패 close의 예약 0·worker 종료와 provider holder 회수, Windows 정상 Alt+F4/Gallery fatal drain의 App dispose·status 0·예약/메모리 0·worker join PASS. App SDK dispatcher 종료도 확인. 일회성 App·설치본·archive·browser/server·native 창·emulator와 임시 harness 회수 |

실행한 제품 명령은 `npm.cmd run build:core`, `npm.cmd run build:designs`, `node Nelyx/eng/build-packages.mjs sdk`, `npm.cmd run build:engine-v2`, `npm.cmd run build:engine-v2:android`다. `check:types`·SDK 변경 후 해당 package check·`lint`·`format:check`·schema `generate --check`·`git diff --check`를 통과했다. Source/Core 비교·malformed wire·설치/host 영향 회귀는 이번 실행의 임시 묶음으로 수행하고 제거했다.

### 3.3 다음 단계에 남긴 의무

- **W9B-00-H 후 W9B-01–05 구현 묶음:** Gallery가 드러낸 `RenderPointerListener`의 원래 listener/gesture 설정·수명부터 연결하되, 원래 Gallery·Testbed/Demo의 실제 graph에서 필요한 후속 render·디자인·서비스·CLI 연결까지 함께 구현한다. subclass/hook 거부를 유지하며 App SDK와 Web의 첫 화면 이후 navigation·control별 실행 문제는 W9B-06 통합 검증에서 모아 대응한다.
- **W9B-02:** `_RenderExclusiveMouseRegion` 지원만으로 Tooltip 완료를 선언하지 않는다. Tooltip의 위치 delegate/custom child transform·overlay 연결과 실제 hover 후 표시/해제, 전체 디자인 catalog·route/semantics·Snapshot 잔여 의무는 계속 미완료다.
- **수락:** 전체 API `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리/display/scanout `notVerified`, Linux·iOS/macOS `DEFERRED`를 유지한다. 이번 기능 PASS는 W9-13 전체 완료·W9-14 성능·기본값 전환의 근거로 확대하지 않는다.

### 3.4 W9B-00-H — host 단일화·플랫폼 소스 이식 착수

**완료.** 아래 항목은 이번 구현 범위이며, 실행·회수의 최종 판정은 §3.5를 따른다. 플랫폼별 원본·API·현재 소비자·남길 연결 코드·의존성·구체적인 부족 범위는 [native-api-ports.md](Nelyx/engine/platform/native-api-ports.md)에 기록했다.

**검토 결과:** 기존 계획의 ‘Nelyx 자체 OS 구현 우선·RNW 도입 0개도 완료 가능’과 ‘HWND/App SDK 두 host 유지’가 사용자 의도와 어긋났다. macOS RNM·Linux RNL의 실제 소스 이식도 실행 단계에 빠져 있었다. §1.1을 1–5부와 W9B의 우선 계약으로 적용한다.

- [x] **원본/소비자 대응:** Windows RNW·Android/iOS RN·macOS RNM·Linux RNL별로 현재 소스/패키지 위치와 원본 선정 상태, API 목록·가져올 구현·남길 Nelyx 연결 코드·기존 소비자·미해결 의존성을 작성한다. 첫 차수의 실제 이식은 Windows부터 하며 Linux/Apple 구현·toolchain 준비를 Windows/Web의 선행 조건으로 만들지 않는다.
- [x] **Windows 단일 실행 경로:** App SDK host로 일반 CLI·기본 Windows host 선택·sample/template·run/dev/doctor/build/pack·manifest/profile·설치 graph를 이관한다. 필요한 공통 코드를 분리한 뒤 `NelyxEngineV2Host.exe`의 App SDK 없는 실행 target과 `windows-hwnd` 선택·전용 공급/실행 분기를 같은 묶음에서 제거한다. App SDK 실패 시 구 HWND host로 fallback하지 않는다. 공통 native library와 App SDK가 쓰는 HWND는 삭제하지 않는다.
- [x] **RNW 첫 실제 이식:** §4.1의 RNW 원본을 고정하고 clipboard/OS 설정 등 작은 서비스부터 실제 소스를 가져와 수정한다. 기존 직접 구현의 소비자를 App SDK dispatcher·취소/close·Core 서비스 port에 연결한 이식본으로 교체하고 원본/수정 출처를 공급한다. 키보드·pointer/focus·IME·UIA 등 전체 API 이식 잔여는 W9B-03과 W9-07/13에 연결한다.
- [x] **동일 앱과 공급 확인:** App SDK의 원래 Widget 앱·설치 소비자의 생성/실행·입력·resize·close, RNW에서 이식한 API의 실제 OS 동작·늦은 callback/구독 해제·오류를 확인한다. Core/공급 변경 범위에 맞춰 Web 두 profile과 Android의 필요한 회귀를 수행하고 source identity·전체 파일 hash를 갱신한다. 공급에 독립 HWND executable/profile이 남지 않아야 한다.
- [x] **기록/정리:** 이식한 API와 아직 자체 구현/미지원인 API를 분리하고 출처·수정·실행 범위를 남긴다. 현재 dist와 출처만 유지하고 임시 설치본·archive·browser/server·창을 회수한다. W9B-00의 과거 PASS를 새 이식본의 검증으로 복사하지 않는다.

**완료 조건:** Windows의 제품 host는 App SDK 하나이며 정상 CLI·공급·설치 graph도 동일하다. RNW 첫 API가 실제 수정 소스에서 실행되고, 남은 모든 native API의 RNW/RN/RNM/RNL 이식 대응과 단계가 명시돼 있다. 이 범위 교정으로 불필요한 독립 HWND host를 제거하는 작업은 W9B-07의 전체 제품 전환·물리/성능 수락까지 미루지 않는다. 다른 v1 실행부의 제거는 기존 대체·소비자 이관·제품 확인 조건을 따른다.

### 3.5 W9B-00-H 구현과 이번 검증

- **단일 host:** CMake의 독립 executable target·기본 선택·전용 분기와 root의 별도 host 선택 명령을 제거했다. 일반 v2 CLI create/doctor/build/run/dev/pack, 생성 template과 두 v2 sample은 App SDK를 사용한다. 폐기한 host 설정·이전 공급 profile·runtime/출처 누락은 명시 실패한다. 공통 native Core library와 AppWindow의 HWND interop는 유지한다. 폐기한 host용 `native/hermesvm.dll` 사본도 공급에서 제거했다.
- **실제 RNW 소스:** 고정 RNW **0.83.2 / af0b597c18691c26d1e01a72d94edda46c1fab26**의 ClipboardModule.cpp/.h를 복사·수정했다. ReactContext/ReactPromise를 App SDK DispatcherQueue·값 completion으로 교체하고 기존 public Clipboard 소비자를 연결했다. 원본·수정 파일·npm integrity·Git hash·MIT license를 `windows-app-sdk/sources/rnw`에 공급한다. npm CRLF 원본과 Git LF 원본의 byte hash를 각각 보존하고 내용 동등성을 확인했다.
- **수명:** common AppServices에 비동기 completion을 추가하고 Android의 동기 pump도 같은 경계를 사용한다. stop은 provider를 취소하고 아직 실행하지 않은 쓰기를 차단한다. 늦은 완료는 closed App에 전달하지 않으며 port credit은 OS terminal까지 유지한다. Host close는 STA 완료를 drain한 뒤 App/worker/ledger와 App SDK dispatcher를 정리한다. Clipboard 변경 구독은 등록하지 않는다.
- **발견한 resize 보완:** 일반 Testbed의 **2560×1459** 최대화에서 4× MSAA attachment가 native allocator **256MiB** 상한을 초과했다. Windows WSI의 internal MSAA를 **2×**로 고정하고 실제 allocator 실패 범위가 오류에 남게 했다. 기존 frame/WSI fence·offscreen/제출 구조와 hard cap을 유지한다. 최대화·복원·정상 close를 실제 창에서 확인했다. 다른 offscreen/imported-texture context의 정책은 유지하며 성능 수락은 별개다.
- **남은 API:** public clipboard 서비스만 RNW 이식 완료다. `interaction.hpp/clipboard.hpp`의 동기 편집 단축키와 keyboard/pointer/focus·IME·UIA·환경/theme/locale/font·lifecycle/linking/네트워크는 W9B-03의 소비자 이관 대상으로 남긴다. Android/iOS RN·macOS RNM·Linux RNL은 원본과 부족 범위를 고정했으며 새 실제 API 이식은 미완료다. 특히 고정 RNL tree에 독립 clipboard·접근성 provider 등의 구현이 없는 범위를 명시했다.

**최종 공급:** Windows/Web와 Android 두 ABI의 source identity는 **`42d60bd959f145b56c9ceafcc34265382cd6cb837270088cdd7177063f1c7d84`**다. `engine/dist` **347개**, `engine/dist-android` **42개** manifest 파일의 전체 SHA-256과 실제 파일 목록 일치를 확인했다. Windows 제품 profile은 `windows-app-sdk` 하나이며 native Core library는 유지한다. 독립 executable·`native` host profile·폐기한 host용 Hermes DLL 사본은 없다. ABI **2**·schema **3719990506**·layout **192 bytes**·App text **12**·App service **2**, 기본/Arabic/Hebrew/Emoji cohort와 원래 4개 package·834 subpath 기준 hash **`5133a536f72ef9ec31c411bc091cf29662ee315fd77268d4b8a34f532fb8dffd`**를 유지한다. §3.2의 source identity와 PASS는 W9B-00 당시 기록이다.

| 이번 확인 | 결과와 수락 경계 |
| --- | --- |
| 공통 서비스 수명 | native `/W4 /WX` 검사에서 stop 전/후·unstarted 쓰기·중복/늦은 completion·owner 파괴 후 완료·terminal 전 credit 보존·잘못된/오류 응답·Android 동기 pump를 확인, 마지막 ledger **0** |
| 독립 설치 소비 | 새 **8개 package** archive를 일회성 외부 소비자에 offline 설치. 실제 TS **7.0.2**, NodeNext·ES2022·`types: []`·`skipLibCheck: false` 선언 PASS. SDK native helper의 최종 소스도 같은 설치본에 갱신·대조. 생성 template의 App SDK 설정·설치 CLI doctor/build/pack/run과 폐기 설정 거부 PASS |
| Windows 원래 App | 설치 package만 사용하는 원래 Widget App **698 modules / original-elements**. RNW clipboard 한글/emoji·빈 문자열·65,536 단위 왕복/hasStrings·초과 쓰기 거부, mouse hover/tap·Tab/Space의 **Count 0→1→2**, 실제 UIA·GPU screenshot, LayoutBuilder **912→1232→912** logical width와 최대화/복원 PASS |
| 실제 OS 실패·취소 | WinRT 비텍스트 clipboard의 빈 결과, OS가 가진 초과 길이 텍스트의 명시 오류, 지연 DataPackage provider 읽기 도중 close와 그 뒤 늦은 OS 완료를 확인. 늦은 성공을 closed App에 전달하지 않으며 모든 해당 host의 close status·예약·메모리 **0**, worker join·dispatcher 종료 PASS |
| 일반 root·dev | `npm.cmd run run:engine-v2:windows`가 별도 선택 없이 App SDK data Testbed를 실행. 같은 일반 명령의 2560×1459 최대화/복원과 Alt+F4 종료 확인. 설치 CLI의 Windows dev 첫 generation 실행·정상 close도 PASS. data Testbed는 원래 Gallery 전체 catalog와 구분 |
| Web 영향 회귀 | 설치 App **697 modules**, Chrome single-worker/threaded에서 clipboard·원래 버튼 상태 변경·960→720px viewport resize PASS. 각각 close 예약 **0 / workersStopped=true**. 테스트 context의 clipboard 권한을 사용했으며 Edge·권한 UI·전체 catalog·성능 수락은 미실행 |
| Android 영향 회귀 | 현재 소스에서 **arm64-v8a/x86_64** 재빌드. Temurin JDK 21·별도 **emulator-5556 / x86_64 / emulator-vulkan**에서 원래 App의 clipboard 한글/emoji·빈 문자열·hasStrings, **38 commands / fallback 0**, 실제 첫 프레임과 개발 제어의 App dispose·worker join·status/예약/메모리 **0** PASS. 테스트 APK·emulator 회수. arm64 실기기·reader·물리 입력/성능은 미실행 |

`check:types`·`lint`·`format:check`·schema check·`git diff --check`와 새 문서 링크/앵커 검사를 통과했다. 폐기된 검증 파일을 가리키는 기존 역사 링크는 보존했으며 harness를 복원하지 않았다. 임시 App·설치본·archive·browser/server·native 창·테스트 emulator·검증 harness를 모두 회수했고 현재 공급·기존 build cache·출처만 유지한다. 전체 API **compatible=false**, 물리/display/scanout **notVerified**, 두 성능 flag **false**, Linux·iOS/macOS **DEFERRED**는 유지한다.

## 4. 남은 실행 단계와 의존성

아래 W9B 번호는 **기능별 책임·선행 의존성·최종 완료 조건**을 나타낸다. W9B-01–05 각각을 빌드·설치·제품 실행까지 닫아야 다음 번호를 시작할 수 있다는 의미가 아니다. 필요한 구현 의존성만 지키며 같은 차수의 작업을 이어서 작성하고, 실행 근거와 완료 판정은 W9B-06에서 함께 확인한다. 구 실행부의 실제 삭제와 기본값 전환은 §5–6의 조건을 충족한 뒤 수행한다.

| 단계 | 선행·이전 단계 대응 | 작업과 완료 조건 |
| --- | --- | --- |
| **W9B-00 미검증 묶음 정리 — 완료** | W9A-04/05 | §3의 Source/Core·공급·설치·실행 확인 완료. Gallery의 다음 차단은 W9B-01로 연결 |
| **W9B-00-H host·플랫폼 API 교정 — 완료** | 00 | §3.4. App SDK 단일 Windows host로 CLI/공급/소비자 이관 후 독립 HWND target 제거. RNW 첫 실제 소스 이식과 모든 native API의 원본/교체 대응 확정 |
| **W9B-01 Core 실행 이관** | 00-H · W9A-04 | 표준 RenderObject의 설정·invalidation·parent data를 최종 TS 실행과 분리. 각 모듈이 native 설정을 소유하고 마지막 TS 실행 소비자 제거. OS endpoint는 §1.1의 이식 adapter 사용 |
| **W9B-02 디자인·접근성 정책 연결** | 01의 필요한 연산 · W9A-05 | 원래 theme/State/painter·controls·폼·route/overlay/localization/assets 실행. 축소 `/v2` 컴포넌트 소비자 종료와 전체 catalog 잔여 추적 |
| **W9B-03 SDK 서비스·수명 완성** | 00-H/01의 필요한 서비스 · W9A-06 | Windows RNW·Android/iOS RN·macOS RNM·Linux RNL의 플랫폼 API 소스를 해당 차수에서 실제 수정·이식. 공통 session/view/service·VM·reload/loss·공개 host API와 실패/취소/close 수명 완성 |
| **W9B-04 CLI·설정·공급 통합** | 03과 현재 App 경로 · W9A-07 | 공통 target descriptor와 하나의 config/template. Windows는 00-H의 App SDK 단일 선택 유지. 각 target의 이식 소스/출처를 같은 App/engine 공급에 포함. v2 제품 기본값 전환은 07 |
| **W9B-05 대표 앱 이관** | 01/02/03/04 · W9A-08 | Testbed/Demo의 원래 catalog·상태·탐색·입력·자산 보존. Android sample의 남은 기능 연결. 샘플 UI는 엔진 공급의 필수 입력이 아님 |
| **W9B-06 제품 통합 확인·문제 대응** | 해당 차수의 01–05 구현 묶음 · W9A-09 | 묶음별 공급 갱신·설치 소비·실제 앱 실행을 통합 수행. 실패를 모아 수정하고 영향 범위만 재검증. Windows/Web 차수 후 Android와 후속 차수를 진행하며 W9-13과 W9-14 대상/profile별 판정 분리 |
| **W9B-07 대상별 기본값 전환·삭제** | 06과 해당 API·기술·제품 gate · W9A-10 | 수락한 target의 일반 CLI/sample/template을 v2 기본값으로 전환. 마지막 구 소비자·중복 Widget·축소 디자인·불필요 export/dependency 제거 |
| **W9B-08 후속 플랫폼·전역 종료** | 07과 후속 차수 조건 · W9A-11/12 | Linux·iOS/macOS의 대체 host/API 또는 명시적 지원 범위 확정 후 잔여 runtime/공급/빌드/template/배포 파일 제거. 생성·문서 소유권 일치 |

W9B-02·03은 W9B-01에서 필요한 공통 연산이 준비된 기능부터 진행한다. 전체 디자인 완료를 기다리며 독립 서비스 이관을 막지 않는다. 기본 순서는 **Windows/Web → Android/Linux → iOS/macOS**이며 기존 Android 선행 구현과 검증은 보존한다.

### 4.1 W9B-01–02에서 빠뜨리지 않을 계약

- [ ] Paragraph/image·control/layer의 남은 중앙 설정 분기를 원래 모듈 소유로 이관한다. 미등록 subclass·instance 실행 hook 거부를 유지하고 명시 extension/custom draw 명령의 실제 지원 범위를 확정한다.
- [ ] Scroll/sliver/lazy list·gesture/focus/editing·overlay/route의 남은 실행 소비자를 연결한다. `RenderBox.size` 게시 관측과 별개로 `constraints`·`needsLayout`·게시 전 동기 geometry의 원래 의무를 해결한다.
- [ ] Material/Cupertino의 기본 theme와 painter를 그대로 실행한다. InkSparkle을 포함한 shader/paint 기능을 연결하고 지원 theme를 강제해 기본값의 미구현을 감추지 않는다.
- [ ] Controlled value 수락/거부·divisions·drag commit·callback 순서는 원래 TS 정책을 따른다. 축소 control 기본 그림은 마지막 소비자 이관 후 제거한다.
- [ ] Semantics merge 충돌·역할/정렬·custom action·OS accessibility feature ingress·focus/range listener 동등성을 해결한다. route/pane 이벤트의 Android 실제 수신·reader 음성과 기존 Web/Windows 관측 범위를 구분한다.
- [ ] TapRegion callback 안의 즉시 정책 변경·예외와 native가 이미 접수한 소비/분류의 원래 동기 계약을 해결한다. 등록 revision/dispose guard만으로 전체 호환 완료로 판정하지 않는다.
- [ ] Snapshot의 singular transform capture·미등록 painter/custom rasterizer·PlatformView와 남은 API 의무를 추적한다. Offstage의 숨긴 Web editor IME와 기능별 Android 입력/capture도 확인 범위로 남긴다.
- [ ] App frame/ticker와 C++ scheduler의 역할을 구분해 동일 입력/frame의 중복 실행을 없앤다. 모든 JS animation의 App 독립 진행을 약속하지 않는다.

### 4.2 W9B-03–04에서 빠뜨리지 않을 계약

- [ ] 플랫폼별 전체 공개 OS API를 RNW/RN/RNM/RNL 원본·실제 이식 파일·Nelyx 수정·기존/새 소비자·실행 결과에 대응시킨다. 입력/IME·focus·접근성뿐 아니라 clipboard·환경/theme/locale/font 알림·lifecycle·linking/서비스 등 해당 API 범위를 포함한다. 기존 직접 구현만 남은 API를 이식 완료로 세지 않는다.
- [ ] Asset/font/text/image/network·buffer의 현재 version·quota·font cohort·credit·업로드 수명을 유지한다. ACK·활성화·host 게시·표시를 구분하고 불확정 ACK/IO/GPU holder는 실제 terminal까지 보존한다.
- [ ] Clipboard/feedback 외 OS 환경·font 알림·lifecycle·VM globals와 언어 의미를 연결한다. Windows evaluator의 TDZ 미동등을 포함한 미해결 VM 계약을 명시한다.
- [ ] Visibility·새 surface generation·device loss·준비 실패·활성 IME/input·FontLoader/image 취소·reload의 실패/복구/재사용을 실제 session에서 확인한다. 일부 fatal drain 성공을 전체 matrix로 확대하지 않는다.
- [ ] 기존 SDK AppDefinition/서비스와 React component·직접 Renderer 주입 API의 대체 또는 명시적 계약 변경을 대응시킨다. 공통 App/client 선언의 React/RN/DOM ambient 의존성을 제거하고 Web 선언은 별도 browser 환경으로 검사한다.
- [ ] 신규 `nelyx.app/1` 설정과 기존 `nelyx.v2.json`·`package.json.nelyx`의 남은 소비자를 이관한다. 설정 공존·의미가 다른 구 VM/renderer 옵션은 명시 실패하며 조용히 버리지 않는다.
- [ ] Hermes/V8/JSC의 VM 선택과 렌더 엔진 선택을 구분하고 미공급 조합은 실패한다. 현재 `--engine v2` 후보 경로를 유지하며 수락 전 기본 CLI를 바꾸지 않는다.
- [ ] Metro의 남은 asset/compiler helper·Hermes bytecode tool을 분리하고 RN bundling/autolinking/Static AOT 구 경로는 마지막 의존성이 끝난 뒤 제거한다. 공통 helper·Skia/CanvasKit/Hermes supplier·license는 보존한다.

### 4.3 구현을 모은 뒤 통합 검증하는 실행 규칙

**기본 구현 묶음은 Windows App SDK·Web 두 profile의 W9B-01–05다.** Core 연산과 원래 Material/Cupertino·서비스·CLI·대표 앱을 실제 사용 경로까지 연결하는 것을 한 묶음으로 잡는다. `RenderPointerListener` 하나를 구현·검증하고 다음 미지원 기능을 찾는 반복 대신, 원래 Gallery·Testbed/Demo의 import·render·호출 graph와 §4.1–4.2를 먼저 대조해 필요한 기능을 함께 작성한다. Android 전용 이식·실행과 Linux/Apple 준비를 이 묶음의 선행 조건으로 만들지 않으며, 공통 변경이 해당 대상에 미친 영향은 다음 차수의 미검증 범위로 남긴다.

| 순서 | 실행 방식 | 다음으로 넘어가는 기준 |
| --- | --- | --- |
| **1. 구현 범위 모으기** | 현재 diff와 소비자 graph를 확인하고 01–05의 연결할 기능·공통 변경·아직 지원하지 않는 범위를 정한다. 이후 예상되는 render/control/overlay/service 의존성까지 함께 포함한다 | 이번 차수의 구현 범위와 통합 확인할 앱·흐름이 정해짐. 별도 검증 도구 복원이나 전체 baseline 재실행을 요구하지 않음 |
| **2. 일괄 구현** | 필요한 Core → 디자인/서비스 → CLI/대표 앱 연결을 의존성 순서대로 작성한다. 한 기능을 작성한 뒤 다음 기능으로 계속 진행하며, 기능마다 pack·새 설치 소비자·전체 플랫폼 실행을 끼우지 않는다 | 이번 범위의 앱 진입·탐색·입력·서비스·종료 경로를 코드로 연결했고 알려진 빌드 차단을 정리함. 실행 결과는 **검증 대기 / notVerified** |
| **3. W9B-06 통합 검증** | §7의 정적 검사·변경 대상 공급 빌드와 identity/hash 확인을 묶어서 수행한 뒤, 한 공급으로 설치 소비와 §5의 실제 앱 흐름을 확인한다. 첫 실패 뒤에도 독립적으로 실행 가능한 흐름을 계속 확인해 문제 목록을 모은다 | 성공·실패·차단·미실행 범위와 실패 원인이 구분됨. 선행 실패로 도달하지 못한 경로는 PASS로 세지 않음 |
| **4. 문제 일괄 수정·재검증** | 빌드/공급·공통 protocol·앱 진입 차단을 먼저 고치고 나머지 실패를 원인·의존성별로 묶어 수정한다. 수정 묶음이 끝나면 무효화된 공급·검사·실패 흐름과 직접 영향 회귀만 다시 확인한다 | 실패가 해결됐거나 미완료 의무로 명시됨. 통합 중 새 의존성이 발견되면 구현 묶음에 포함해 다시 진행하며, 작은 수정마다 전체 행렬을 처음부터 반복하지 않음 |
| **5. 차수 판정·다음 차수** | 해당 차수의 완료/미완료를 기록하고 준비된 다음 플랫폼의 01–05 구현·06 통합 검증을 같은 방식으로 진행한다. 기본값 전환·삭제는 별도 gate를 적용한다 | W9-13·W9-14와 대상/profile별 근거가 분리됨. 준비되지 않은 Linux·iOS/macOS의 **DEFERRED**와 전체 **PARTIAL**을 유지함 |

- **구현 중 최소 확인:** 다음 코드 작성에 필요한 문법·타입·국소 compile·schema 생성 정합성은 필요할 때만 확인한다. 컴파일 불가·wire 구조 충돌처럼 이후 구현을 막는 문제는 즉시 고치되, 이를 매번 전체 제품 검증을 실행하는 근거로 삼지 않는다.
- **통합 진입 기준:** 해당 차수의 계획한 구현과 소비자 연결이 모이면 실제 실행을 시도한다. 모든 플랫폼·834 API·전체 catalog의 수락을 먼저 요구하지 않으며, 명시한 미지원·남은 계약은 실패/차단/미검증 목록에 남긴다. 통합 시점까지 완료 판정과 체크박스는 보류한다.
- **재검증 범위:** 변경이 영향을 주지 않은 동일 입력의 PASS는 반복하지 않는다. 공통 wire·ABI/schema·자원 수명 변경이면 관련 대상/profile의 확인을 넓히고, 앱·디자인·CLI만 바뀌면 해당 package/App만 갱신한다. 새 공급과 이전 근거의 대응이 불명확하면 해당 결과를 **notVerified**로 남긴다.
- **빌드·설치 재사용:** 한 통합 검증 회차에서는 현재 공급과 한 번 만든 최소 설치 소비자를 관련 확인에 공유한다. 수정으로 입력이 바뀌면 필요한 산출물만 갱신하고, 회차 종료 시 임시 자료를 회수한다. 이전 dist나 소비자 사본을 누적해 재사용하지 않는다.

## 5. 제품 확인과 전환 gate

아래 행렬은 **W9B-06에서 구현 묶음 전체를 확인할 기준**이다. 개별 구현 시도의 반복 체크리스트로 사용하지 않는다. Windows/Web 차수에서 해당 앱·공통 기능·설치·수명을 모아 확인하고, Android 및 후속 플랫폼은 해당 차수에서 적용한다. 검증 순서를 묶어도 API 의무·실제 실행·물리/표시/성능 수락과 삭제 조건은 유지한다.

| 대상·범위 | 실제 확인할 동작 | 판정 경계 |
| --- | --- | --- |
| Windows App SDK 단일 host | RNW 소스 이식본에서 일반 App/Gallery·resize·mouse/key/capture·IME/UIA·한글/emoji/선택·OS 서비스·close | 독립 HWND host는 제품/검증 대상에서 제거. 자동 OS 입력·UIA·GPU screenshot은 물리 touchpad·scanout 수락을 대신하지 않음 |
| Web | Chrome/Edge의 single-worker/threaded·실제 원래 catalog·textarea/ARIA·hover·resize·reload/loss·close | browser/profile별 현재 입력을 확인. 권한을 부여한 context와 사용자 권한 UI 수락을 구분 |
| Android | arm64-v8a/x86_64 공급·일반 설치/run·InputConnection/IME·접근성 virtual node·Activity/visibility·loss/reload·정식 stop | cross-build·emulator·물리 기기를 구분. 기존 PARTIAL 결과를 지우거나 실기기 PASS로 승격하지 않음 |
| 단일 framework·디자인 | State lifecycle·GlobalKey reparent·Inherited/theme·controlled refusal·원래 기본 painter·catalog/상세/form/modal | 최소 App/축소 showcase의 성공은 전체 원래 API·catalog 완료가 아님 |
| 설치·개발/배포 | 설치 package만 사용하는 create/doctor/build/run/dev/pack·조건부 export·strict 선언·source map/실제 graph | repository alias·dist 잔재가 파일 누락·중복 Core identity를 감추지 않아야 함 |
| 수명·복구 | ACK/NACK/불확정 ACK·upload/IO·font/image/GPU holder·진행 중 close·준비 실패·loss/reload | accepted/activated/submitted/presented와 실제 scanout을 구분. 미확정 해제를 성공으로 바꾸지 않음 |
| 성능·기본값 전환 | 실제 일반 명령과 같은 화면/입력 패턴의 scroll/resize·IME 반응·메모리·표시 | 기능 PASS·CPU 시간·합성 입력으로 성능 flag를 올리지 않음. W9-14는 대상/profile별 별도 수락 |

**W9B-07의 전환 조건:** 해당 대상의 원래 API 대응·W9-13 기술·설치/복구/종료·W9-14 제품 전환 조건을 충족한 뒤 기본값을 바꾼다. 현재의 두 성능 flag false와 물리/display notVerified가 남은 범위는 수락 완료로 기록하지 않는다.

**W9B-08의 전역 삭제 조건:** Linux/Apple의 대체 또는 명시적인 지원 범위 결정, 모든 마지막 소비자·공급 의존성 종료가 선행한다. 한 target의 전환을 저장소 전체 삭제 완료로 확대하지 않는다.

RNW/RN/RNM/RNL에서 필요한 소스의 이식은 각 native target W9-13의 필수 조건이다. 출처 목록 작성·알고리즘 참고·독립 자체 구현만으로 이를 통과시키지 않는다. Windows의 불필요한 독립 HWND host 제거는 §3.4에서 처리하며, 이 조항을 이유로 두 Windows 제품 host를 계속 유지하지 않는다.

## 6. 마지막 소비자 이관 후 제거할 대상

| 대상 | 제거 전 확인할 대체·마지막 소비자 |
| --- | --- |
| App SDK 없는 `windows-hwnd` executable·target·profile·선택/실행 분기 | **W9B-00-H에서 제거.** App SDK에 필요한 공통 코드·Core library 보존, CLI/sample/template/설치 소비자를 단일 App SDK host로 이관하고 해당 앱/API·종료 확인 |
| 처음부터 작성한 기존 native 플랫폼 API의 중복 구현 | RNW/RN/RNM/RNL 수정 이식본으로 API별 소비자·수명을 이관하고 실행 확인 후 제거. 이식 소스·필수 dependency·copyright/notice와 Nelyx 전용 연결 코드는 보존 |
| `Nelyx/runtime/engine-client/widgets.ts`의 별도 Widget/State/Element 체계 | 전환 중인 data Testbed·list/navigation/graphics 및 디자인 `/v2` 소비자. 공통 SceneWriter/packet/client/handle 기능은 보존 |
| original 전용 entry/forwarding과 잔여 bridge 분기 | `runtime/app/*`의 기능·수명·미지원 거부가 일반 frontend 모듈에 존재하고 기존 import/API 전환이 명확해야 함 |
| `packages/material/src/v2.ts`·`packages/cupertino/src/v2.ts` | 생성자/theme/State 차이를 실제 소비자에서 이관. 계약이 다른 원래 클래스로 단순 alias하지 않음 |
| TS PipelineOwner·최종 layout/paint/hit-test와 구 AppSession/ViewRuntime 조립 | 하위 클래스·사용자 확장·SDK·앱의 마지막 실행 의존성 종료. 공통 값/설정/resource/service 계약은 유지 |
| SDK bootstrap/native-engine·React/RN Surface·구 browser/native-hermes backend·runner | 지원 target별 일반 App/service/host 대체·공개 API 대응. 재사용 OS/native/environment helper는 중립 소유로 먼저 분리 |
| 구 Skia JS renderer/RN wrapper·provider cohort·Metro/Static AOT 전용 경로 | 실제 v2 paragraph/font/Vulkan/CanvasKit/Hermes/compiler/asset 의존성·출처 보존과 마지막 구 bundling 종료 |
| 불필요 export/dependency/workspace/lock/script·구 template·배포 파일 | 설치 tarball/현재 dist/실제 bundle·native link graph 확인. 소스 삭제만으로 공급 파일 제거 완료 처리하지 않음 |
| 생성 ownership/upstream/recipe·README/CLI help/work 문서 | 폐기 코드를 재생성하지 않는 입력·productHash·license 일치. 전체 제품 재변환을 선행하지 않음 |

현재 실행에 필요한 중립 helper·supplier를 오래된 경로명만 보고 삭제하지 않는다. 이전 구조/삭제 대응의 원본은 [work9-a §7](work9-a.md#7-실제-삭제이관-목록)에 보존한다.

## 7. 재개 명령과 기록 원칙

**재개 직후에는 현재 diff·작업 범위를 읽고 §4.3의 일괄 구현을 이어간다.** 아래 명령 목록을 재개·기능 추가·수정 시도마다 전부 실행하지 않는다. 마지막으로 실행 검증한 공급은 §3.5의 기록이며, 구현으로 입력이 달라지면 새 공급 확인 전까지 해당 변경은 **검증 대기 / notVerified**다.

```powershell
git status --short
```

**W9B-06 통합 검증에 들어갈 때** 아래 정적 검사와 변경 범위에 필요한 빌드를 묶어서 실행한다. 정적 검사·제품 빌드가 실패하면 관련 오류를 모아 수정한 뒤 해당 단계부터 재개하며, 빌드되지 않은 새 코드를 이전 공급으로 실행해 판정하지 않는다.

```powershell
npm.cmd run check:types
npm.cmd run lint
npm.cmd run format:check
node Nelyx/engine/tools/generate-schema.mjs --check
npm.cmd run build:core
npm.cmd run build:engine-v2
git diff --check
```

Core·디자인·SDK/CLI package는 실제 변경 입력에 필요한 빌드/pack을 한 번씩 수행한다. 엔진 빌드는 native/Core·wire·provider/host 등 공급 입력이 바뀐 경우에 수행하며, 모든 TS/App 변경마다 강제하지 않는다. **Android 공급 빌드 `npm.cmd run build:engine-v2:android`와 설치/run은 Android 차수에서 묶어 수행한다.** 앞선 차수의 공통 변경이 Android에 영향을 주면 그 결과를 미검증으로 표시하며, 새 소스와 예전 Android 공급의 불일치를 숨기지 않는다.

공급 identity·전체 파일 hash·ABI/schema·service version·원래 API 기준과 설치 package 선언/graph 확인은 통합 검증 회차의 공급 확정 시 묶는다. Windows의 v2 기본 host·sample/template은 App SDK다. `windowsHost`를 생략해도 같은 host를 선택하며 폐기한 설정은 실패한다. 확정한 한 공급으로 아래 원래 Widget App과 Gallery·Testbed/Demo의 일반 경로를 이어서 확인한다.

```powershell
$w9bEngineInputs = (Resolve-Path .\Nelyx\engine\dist).Path
node Nelyx/sdk/tooling/cli/src/main.mjs build --engine v2 --app sample/nelyx-engine-v2-android --target windows --engine-inputs $w9bEngineInputs
node Nelyx/sdk/tooling/cli/src/main.mjs run --engine v2 --app sample/nelyx-engine-v2-android --target windows --engine-inputs $w9bEngineInputs
```

Windows root 진입점은 `npm.cmd run run:engine-v2:windows`이며 App SDK에서 data Testbed 후보를 실행한다. 원래 Gallery와 구분한다. 별도 host 선택 명령은 제거했다. Web 두 profile과 Android 일반 명령 `npm.cmd run run:engine-v2:android -- --device=emulator-5554`는 해당 App entry·serial·SDK/JDK·ABI를 확인해 사용한다.

- 저장소 지침의 테스트별 **20분 timeout**·보통 **30회 이내** 반복 제한을 적용한다. 30회는 채울 목표가 아니며, 통합 검증 후에는 변경이 무효화한 검사와 실제 실패를 해결하는 범위만 다시 확인한다.
- 폐기한 독립 `test:*`·`audit:*`·`experiment:*`·측정 harness를 선행 작업으로 복원하지 않는다. 의미 비교·malformed wire 등 필요한 확인은 한 실행의 임시 묶음과 실제 제품 흐름에서 수행한다.
- 현재 dist·실제 build cache·supplier만 남긴다. 검증 로그·immutable receipt·checkpoint/history JSON·이전 dist/staging/archive·독립 설치본·browser profile을 누적하지 않는다.
- 임시 App·archive·설치본·browser/server·listener·native 창은 실행별 최소 범위로 사용하고 성공/실패/중단 모두 `finally`에서 회수한다. 삭제 전 절대 경로와 소유 범위를 확인한다.
- 구현 중에는 연결한 범위와 통합 검증에 남긴 항목만 간단히 갱신하고, 미실행 구현을 완료로 기록하지 않는다. 통합 검증·수정 묶음 종료 시 이 문서에 완료 범위·남은 문제/차단·실행 명령·미실행 대상·현재 공급 상태·다음 시작점만 갱신한다. 이전 PASS 수치를 새 Source의 근거로 복사하지 않는다.

## 8. 전체 완료 체크리스트와 현재 재개점

- [x] W9B-00의 최근 미검증 변경을 확인하고 소스·공급·설치 소비·원래 Gallery의 실제 상태를 맞췄다.
- [x] W9B-00-H의 App SDK 단일 Windows host·독립 HWND target 제거·RNW 첫 실제 API 이식과 전체 native source 대응을 완료했다.
- [ ] Windows RNW·Android/iOS RN·macOS RNM·Linux RNL 수정 소스를 각 플랫폼 API의 실제 소비자가 사용하며 출처·의존성·실행 근거를 확인했다.
- [ ] 제품 Widget/Element/State가 하나이고 중복 `/v2` 컴포넌트 소비자가 없다.
- [ ] 최종 layout/geometry/hit-test/gesture/scene 권위가 v2 하나이며 구 TS/RN renderer 실행 경로가 없다.
- [ ] 원래 Material/Cupertino theme/State/controller/callback/painter와 실제 catalog가 동작한다.
- [ ] 전체 SDK 서비스·수명·VM·공개 host API·reload/loss와 미해결 동기/custom 계약을 해결했다.
- [ ] 기본 create/doctor/build/run/dev/pack·config/template·Testbed/Demo가 같은 App/engine 공급을 사용한다.
- [ ] 원래 API 834 subpath 대응·서명 의무와 명시적 계약 변경을 빠짐없이 판정했다.
- [ ] 대상/profile별 설치 소비·기능·복구·종료와 W9-13 기술 gate를 충족했다.
- [ ] 대상/profile별 W9-14 물리 입력·표시·성능·기본값 전환을 수락했다.
- [ ] 후속 플랫폼 대체/지원 범위를 확정하고 구 runtime·공급·불필요 dependency·배포 파일을 제거했다.
- [ ] 생성 소유권·출처·README·CLI help·work 문서가 실제 지원 상태와 일치한다.

**현재 상태:** **W9B-00 완료 / W9B-00-H 완료 / 구조 개편 PARTIAL**. §3.2의 과거 공급·실행 근거는 보존하며 이번 구현과 새 검증은 §3.4–3.5에 기록한다. Windows host는 App SDK 하나이고 RNW public clipboard를 실제 수정 소스로 연결했다. 전체 native API 이식과 W9-13/14 수락은 미완료다. 전체 API **compatible=false**, 물리/display/scanout **notVerified**, 두 성능 flag **false**, Linux·iOS/macOS **DEFERRED**를 유지한다.

**다음 시작점:** **Windows/Web의 W9B-01–05 일괄 구현**. `RenderPointerListener` 원래 listener/gesture 설정·수명에서 시작해 Tooltip 위치/overlay·남은 Core/디자인·RNW 플랫폼 API·서비스·CLI·대표 앱 연결까지 모아서 진행한다. 개별 기능마다 공급·설치·다중 대상 실행을 반복하지 않고, 이 묶음이 통합 실행 가능한 상태가 되면 **W9B-06 통합 검증 → 문제 일괄 수정 → 영향 재검증**으로 이어간다. Android 및 후속 플랫폼의 남은 이식·실행 의무는 다음 차수에 유지한다.

**다음 재개 요청:** `work9-b.md의 Windows/Web W9B-01–05를 묶어서 구현하고 W9B-06 통합 검증 후 나온 문제를 수정해줘`
