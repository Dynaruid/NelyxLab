# work9-b — v2 단일 실행 경로 완성과 제품 전환

작성·갱신·종료: **2026-11-09 KST** · 문서 상태: **CLOSED / 후속 문서 이관** · 구현 판정: **PARTIAL**

> **이 문서는 종료했다.** 남은 작업과 정확한 재개 절차의 실행 계약은 [work9-c.md](work9-c.md)로 이관했다. 아래 계획·체크리스트·§3의 구현/검증 기록과 §3.22의 미검증 초안은 종료 시점의 기록으로 보존한다. 문서 종료는 구조 개편·API 호환·제품 전환·레거시 삭제의 완료를 뜻하지 않는다. 제품 구현은 **PAUSED / PARTIAL**이며 이번 이관에서 build/run을 재개하지 않았다.

이 문서는 사용자 요청으로 종료한 [work9-a.md](work9-a.md)의 **남은 작업과 재개 절차를 이어받아 진행한 실행 계약과 종료 기록**이다. W9B-00의 당시 기능·공급·실행 결과는 §3.1–3.3에 보존한다. §3.4의 **W9B-00-H**에서 App SDK 단일 host·독립 HWND target 제거·RNW clipboard 소스 이식을 구현했다. 플랫폼별 원본/기존 소비자/부족 범위와 당시 실행 근거는 §3.4–3.5를 따른다.

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

아래 표는 **W9B-00 시작 전 문서 전환 시점**의 상태다. 최신 공급과 검증 결과는 §3.20을 따른다.

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

### 3.6 W9B-01–05 Windows/Web 구현과 통합 수정 — 진행 중

**PARTIAL / 첫 Windows/Web 구현 묶음의 W9B-06 영향 확인 완료.** 아래는 이번 변경과 직접 확인 범위이며, §3.2/3.5의 과거 PASS를 새 공급의 결과로 복사하지 않는다. 전체 catalog와 남은 API는 다음 구현 묶음으로 이어간다.

- **원래 입력 경로:** `RenderPointerListener`가 모듈 소유 native 설정을 내보낸다. Core의 child-first retained path와 down 시 inverse를 contact 종료까지 유지하고, 원래 down/move/up/cancel/hover/scroll 객체와 global pointer route에 연결했다. 밖으로 이동·resize 취소·제거·close 수명, Ignore/Absorb와 labels를 보존하는 semantics action 차단을 처리한다. instance hook override와 pan/zoom 등 미지원 계약은 명시 거부한다.
- **Tooltip/Overlay:** 원래 TS State·timer·overlay·theme·trigger 정책을 유지한다. 기본 Material 위치 정책을 Core의 현재 target/child geometry로 계산하고, 임의 delegate를 JS 최종 layout으로 실행하지 않는다. Overlay의 형제 entry 갱신을 BuildOwner 상태와 frame 종료에 맞춰 지연하고 native Overlay를 canonical Stack으로 연결했다. 지원 device mask도 Core recognizer에 전달한다.
- **공통 layout/paint:** Divider의 양축·margin·hairline·색상·hit 영역을 모듈이 설정하고 Core가 해석한다. Badge는 모듈이 anchor 계수와 intrinsic 크기 정책을 설정하며 Core의 기존 paragraph/provider·query continuation을 사용한다. ColorShapeDecoration과 기본 Decoration/ShapeBorder clipper의 rrect/stadium/circle 설정을 연결했다. 진행률의 원래 Linear/Circular/Refresh painter는 범용 arc·stroke cap·수치식 명령을 내보내며 기본 그림·방향·gap·animation/color listener 정책을 유지한다. native RenderCustomPaint의 repaint 구독도 claim/update/release 수명에 연결했다. 표시와 custom clip hit를 함께 처리하고 사용자 정의 hook은 명시 거부한다. C++ Material/Cupertino 컴포넌트는 추가하지 않았다.
- **준비/명령 수명:** 늦게 도달한 이전 문서의 LayoutBuilder 요청이 최신 문서를 막던 대기를 고쳤다. SceneWriter는 생략 가능한 기본 설정 명령을 보내지 않고 opcode로 diff하며, reset과 NACK/불확정 ACK의 이전 producer를 보존한다. 기존 4096-command 예산은 늘리지 않았다. unbounded intrinsic 높이 조회의 측정 packet에 Infinity가 들어가던 오류도 수정·공급 확인했다. Web ARIA 내부 pointerleave가 중복 packet을 만들어 mandatory event queue를 넘던 문제와 실패한 rebuild 도중 close의 dispose 대기를 보완했다. 실제 외부 이탈은 계속 Core에 전달하고 queue 예산은 유지한다.
- **통합 실행에서 고친 수명:** 연속 repaint가 현재 LayoutBuilder 요청을 보내기 전에 새 문서를 설치해 요청을 굶기던 순서를 수정했다. 새 repaint 전 현재 accepted 문서·node generation·builder revision에 맞는 요청을 먼저 처리한다. InkResponse의 keep-alive 해제가 다른 subtree 빌드 중 setState하던 문제는 BuildOwner도 확인해 지연하고, 분리된 Focus binding의 늦은 알림은 폐기한다. App 오류는 최대 8192자/8개 원인으로 실제 내부 예외를 전달하며 Core 오류도 상태·발생 위치·native owner를 구분한다.
- **native 예산:** 준비 실패를 버리던 native event 소비부에 상태·문서 진단을 연결해 `budgetExceeded(19)`와 ledger 거부 증가를 확인했다. 작은 clip마다 최대 **8192점** 전체를 예약하던 GraphicsPath를 nested vector의 실제 할당 전 reserve/해제 시 release하는 ledger allocator로 바꿨다. command capacity도 포함하며 기존 **64MiB session / 8192점** 상한은 유지한다. Native `/W4 /WX` 단위 확인에서 사각 경로 **488 bytes**, 200개 경로, nested move/copy·예산 거부·부분 생성/점 한도 실패의 마지막 예약 0 PASS. 새 공통 공급에서 관련 Core **6개 테스트**, Web Gallery 네 조합과 Windows 실제 앱의 animation·resize·최종 문서 게시·정상 close를 확인했다.
- **RNW/서비스:** 고정 RNW 0.83.2 원본 KeyboardUtils와 AccessibilityInfo를 가져와 수정·컴파일·출처 공급에 포함했다. 실제 교체한 소비자는 modifier-state 조회와 Tooltip UIA notification이다. key/code 표 전체의 소비자 이관·pointer/capture/focus·IME·UIA provider/settings 전체 이식은 미완료다. App service **3**의 bounded Tooltip 채널은 Windows의 소유 UI queue/현재 Core provider, Web의 회수 가능한 ARIA live region에 연결한다. startup/runtime 오류의 제한된 stack·Core 상태도 전달한다.
- **대표 앱/도구:** Testbed의 `ComponentsGallery`와 Demo의 원래 `DemoApplication`을 `defineApp`·원래 font/image catalog로 연결했다. root Windows/Web 명령도 실제 Gallery를 준비한다. sample UI는 엔진 공급 입력에 포함하지 않는다. 한 현재 asset 집합만 준비하며, 디자인 `/v2`·data 앱·구 runner의 마지막 소비자와 제품 gate가 남아 있으므로 전역 삭제하지 않았다.
- **후속 목록 연결:** native ListView/Sliver 어댑터가 dormant 정책을 일괄 거부하던 조건을 제거해 기존 SliverMultiBoxAdaptorElement·DormantChildCache를 사용한다. 별도 row cache나 TS layout은 추가하지 않았다. 실제 Source Element/State와 Core를 연결한 국소 검사에서 capacity **2**·State 값 **7** 보존·재활성화 **2회**·퇴출 **10회**·empty/복구·캐시가 남은 close의 **State 20/20 / cache 0 / Core memory 0 / TS layout fallback 0** PASS. 이 TS/App 후속 변경은 엔진 공급 identity를 바꾸지 않는다. 원래 Gallery의 ListTile 탐색과 전체 dormant catalog 제품 확인은 다음 구현 묶음의 통합 대기다.

| 직접 확인한 범위 | 현재 결과와 한계 |
| --- | --- |
| Core/Source 의미 | retained inverse·child-first·delta·밖 이동·hover·Ignore/Absorb·semantics actions·Tooltip 위치·NACK rollback·resize cancel, 늦은 LayoutBuilder 복구·bounded empty Listener·unbounded intrinsic packet PASS. Divider **10개**, Badge **8개**, clip hit **20개** 비교 PASS. Progress painter **20개**의 Source/Core geometry와 malformed arc/cap·실패 준비의 active 보존, repaint 구독 교체/해제/실패 rollback PASS. 각 session close memory 0 |
| Web 원래 소규모 App | **Chrome/Edge × single-worker/threaded 4조합**에서 Counter **0→1**, Tooltip 표시·해제·semantics·ARIA 안내, determinate 65/indeterminate progress 역할, animation의 activated/published document 진행, **900×650** resize PASS. 오류 없음, close 예약 0/worker 종료 확인 |
| 설치 소비자 | 첫 통합 공급의 새 **8개 package** offline 설치, 실제 TS **7.0.2**·NodeNext·ES2022·types=[]·skipLibCheck=false, CLI create/doctor/Windows **713**·Web **712 modules** original-elements build·Web pack과 폐기 windows-hwnd 거부 PASS. 설치 package의 일반 Windows App에서 진행률 표시·animation·Counter **0→1**·Tooltip UIA notification·실제 화면과 Alt+F4 close **status/예약/메모리 0 / workersJoined=true** 확인. 임시 설치본/archive 회수. 이후 host/keep-alive/focus·Core 경로 할당 수정은 repository의 실제 Windows/Web Gallery와 영향 Core 검사로 재확인했으며, 최종 소스를 다시 독립 설치한 결과로 확대하지 않음 |
| 실제 Web Gallery | **Chrome/Edge × 두 profile** 모두 원래 font/catalog로 첫 화면, Filled 한 번 클릭의 **1 · Filled pressed**, **900×650** resize 후 상태 보존 확인. 추가로 최종 엔진 공급의 네 조합에서 **960→1280** resize, animation 시작·정지·**65% 복귀**·재시작·실행 중 **960** 복원, 마지막 accepted/activated/published 문서·metrics 일치와 오류 없음·close 예약 0/worker 종료 PASS. 앞선 ListView 탐색은 **dormant child policy** 거부로 명시 실패했고 Edge/threaded의 같은 실패 중 즉시 close도 예약 0/worker 종료 확인. 후속 dormant 조건 연결은 위 국소 검사만 통과했으며 ListTile을 포함한 전체 탐색 PASS는 아님 |
| 실제 Windows Gallery | 일반 root 명령과 같은 원래 App entry·CLI run **879 modules / original-elements**에서 첫 화면·Filled **0→1**·최대화의 두 열 배치 확인. 최종 공급에서 animation 시작·중지·65% 복귀·재시작·실행 중 **1280→960→1280** 창 복원/최대화·상태 보존과 실제 UIA·화면을 확인. 마지막 **accepted=active=published 200 / failedDocument=0**, 준비/host 오류 **0**. Alt+F4의 정상 **status/예약/메모리 0 / workersJoined=true** PASS. 이전 124/118 정체는 경로 예약의 budgetExceeded였으며 같은 실제 흐름에서 해소 확인. 합성 OS 입력의 기능 결과이며 물리 입력·표시 성능 수락은 아님 |
| 실제 Demo | pointer·Divider·Badge·shape·progress painter의 이전 차단을 지나 **RenderChipRedirectingHitDetection** 미지원까지 도달. 첫 화면 미통과. Chip/ListTile/InputDecoration/toolbar 및 dormant list의 원래 정책 연결을 후속 구현 묶음으로 남김 |
| 정적/공급 | Core/Material/SDK·Windows/Web 엔진 빌드, check:types·lint·format·schema·diff 검사 PASS. 최종 source identity **128e846f2c192464732d2bec75f1b90f6616a6ff21f0b36f53304a1eeaf20211**와 Windows/Web **355개** manifest 파일의 전체 hash·목록·RNW 원본/수정 6개·license·원래 API 기준 hash 일치 확인. ABI **2**·schema **3344070931**·layout **192 bytes**·App text **12**·App service **3** |

Android는 앞선 공급 이후 공통 wire/Core/service가 변경돼 **현재 소스와 불일치 / notVerified**다. Android 빌드·설치/run·RN API 이식은 해당 차수에 묶어 진행한다. Linux·iOS/macOS **DEFERRED**, API **compatible=false**, 두 성능 flag **false**, 물리/display/scanout **notVerified**를 유지한다. 통합 실행이 막은 후속 화면·IME/UIA·reload/loss·전체 OS 서비스 의무를 완료로 처리하지 않는다.

중단했던 빌드의 임시 `Nelyx/engine/.cache/engine-vTz0Je` 삭제는 자동 승인 검토가 `blocked by policy`로 거부해 보류했다. 새로운 빌드의 staging은 자체 finally로 회수됐다. 통합 회차의 독립 설치본/archive와 browser/server/native 창은 종료·회수했다. 마지막 `.nelyx/w9b-current` 임시 App/harness 및 단위 compile의 `vc140.pdb` 삭제도 절대 경로·workspace 소유 범위를 확인한 PowerShell 요청이 같은 `blocked by policy`로 거부됐다. 이 파일들은 우회 삭제하지 않았으며 정리 미완료다.

### 3.7 후속 Windows/Web layout·목록·Ink 묶음 — 목록 통합 확인 / PARTIAL

- **공통 연산:** 컴포넌트 이름을 모르는 Core layout 명령을 추가했다. 모듈이 수치식·유한한 자식 측정/질의 순서·배치·두 baseline·intrinsic 결과를 기록하고 Content가 기존 layout/query continuation에서 해석한다. App callback이나 TS 최종 geometry는 실행하지 않는다. 최대 **64 children / 128 variables / 512 expressions / 512 commands**, 수치식 depth **64**와 기존 layout operation/session 예산을 적용한다. 정의 전 변수·전방/순환 참조·누락 mode/child·reserved/범위를 거부한다.
- **실제 모듈 연결:** 원래 `RenderListTile`의 leading/title/subtitle/trailing 정책과 두 selection-toolbar delegate를 연결했다. 기본 `RenderProxyBox`도 해당 모듈 소유 설정으로 등록했다. 임의 delegate/instance hook과 relayout listener는 여전히 명시 거부하며 전체 custom layout API 완료가 아니다. Material/Cupertino 클래스별 C++ 구현은 추가하지 않았다.
- **직접 의미 확인:** Source ListTile **18개**의 LTR/RTL·다섯 alignment·dense/3-line/compact·슬롯 없음·baseline 없음·tight/0 폭과 layout/dry/4개 intrinsic 비교, toolbar **5개** 비교 PASS. 잘못된 wire **6개**, 실패 준비의 이전 active 보존·복구, forward/reverse hit 순서와 이전 publication 거부 PASS. baseline 없는 자식의 잘못된 게시 값을 수정했으며 마지막 Core memory **0**이다. retained pointer/clip·dormant 수명 영향 검사도 통과했다.
- **Ink 의존성:** 실제 목록 진입에서 드러난 `InkDecoration` reader 누락을 연결했다. 원래 빈 장식·visibility·ColorShape/BoxDecoration의 유한 fill/uniform border 정책을 보존하고 참조 크기/변환은 Core에 맡긴다. Source active sliver chain 밖의 참조는 그리지 않으며 Material 소유 clip을 기록한다. 스크롤을 사이에 둔 highlight/ripple도 현재 compositor 행렬로 해석하고 두 provider가 hard-edge clip을 지킨다. Source metadata와 **0/20/70px** compositor scroll, 비활성 참조·dispose·memory **0** 검사 PASS. image/gradient/shadow/custom decoration은 완료 범위가 아니다.
- **의미 병합:** 실제 목록에서 행 전체가 한 group으로 합쳐진 문제를 수정했다. Source의 nullable flag word·명시 역할·명시 자식·강제 병합 정책을 기록하고 Core가 원래 부모와 모든 형제 쌍의 충돌을 먼저 판정한다. 충돌한 두 형제를 모두 유지하며 label/hint·상태·역할·동작 출처를 병합한다. `RenderMergeSemantics`도 원래 모듈 설정으로 연결했다. 실제 Source 의미 파이프라인과 Core **19개** 비교(같은 동작/false 상태/명시 역할/value 충돌, boundary·강제 병합·차단·제외·Offstage, 동작 출처), 오래된 publication과 잘못된 nullable wire 거부, 마지막 memory **0** PASS. 전체 semantics API·정렬/custom action/identifier·OS feature ingress 완료는 아니다.
- **실제 선택·복귀 보완:** Icon이 의미를 소유하고 내부 glyph paragraph를 제외하는 원래 정책에 맞춰, 그 paragraph의 사용하지 않는 초기 transport 라벨을 제거했다. glyph 변경 뒤 오래된 라벨 때문에 재게시가 거부되던 문제를 해결한다. SceneWriter는 새 Core 노드의 정확한 기본값에 해당하는 properties/paint/constraints/비활성 layout/빈 event policy 쓰기만 생략하고 ACK 기록에는 남긴다. **4096 commands** 제한을 유지하며 **800개 자식 / 801 nodes**의 원자 생성 **2402**, 전체 교체 **4003** 명령, 불명확한 ACK 회수·기본값 reset과 마지막 memory **0** 검사 PASS.
- **Tooltip fade 추가 보완:** Windows에서 느린 hover 후 복귀가 `RenderAnimatedOpacity` 미지원으로 종료되는 것을 확인해 수정했다. 정적/애니메이션 opacity의 native 설정을 원래 모듈로 옮기고, Source animation listener가 TS PipelineOwner 없는 native claim·교체·detach·재연결·dispose를 따르게 했다. alpha 양자화·semantics 포함 정책과 listener 회수 검사 PASS. 수정 후 Web 4개 profile에서도 복귀 버튼 **1.2초 hover**를 포함한 전체 목록 왕복을 재확인했다. C++ opacity·clock으로 Source animation을 복제하지 않는다.
- **목록 묶음 공급:** Windows/Web source **`c62f8e762415dd782914be6515c307c9d90847690203f7c987ae3dd5af862cc5`**, ABI **2 / schema 2754532446 / layout 192 bytes / semantics header 88 bytes**, manifest **355개** hash·목록·RNW 6개·license·원래 API 기준 hash 일치를 확인했다. Core/Material/SDK·Windows/Web 엔진 빌드와 strict type/lint/format을 확인했다. 원래 Gallery build는 Web **880 / Windows 881 modules / original-elements**다. §3.6의 128e846… 공급과 실행 PASS는 앞선 묶음의 근거다. Icon/SceneWriter의 App 모듈 변경은 독립 App 입력 hash와 새 번들에 반영하며 engine 공급 hash에 넣지 않는다.
- **Web 통합:** 실제 Gallery의 **Chrome/Edge × plain/isolated 4개**에서 원래 ListView 진입·각 행의 독립 button 게시·첫 항목 선택·1,000번째 이동/선택·**1100×800→900×650** resize·처음 이동·선택 해제·Gallery 복귀 PASS. 게시된 경계 중심에 브라우저 포인터를 보내 원래 Core hit/gesture와 TS State를 실행했고 ARIA label·게시 갱신을 확인했다. 최종 accepted=active=published, failed=0, App 오류 없음, 매번 close 예약 **0 / workersStopped=true**다. 보조 검증 주입이나 TS geometry fallback은 사용하지 않았다.
- **Windows 통합:** 일반 App SDK Gallery에서 첫 항목/1,000번째 선택·처음/끝 이동·선택 해제를 확인했다. 느린 hover 복귀의 opacity 실패를 위와 같이 수정한 뒤 실제 복귀·최대화·960×720 복원·정상 종료를 확인했다. 최종 **accepted=active=published=33 / failed=0**, host/preparation 오류 **0**, 종료 status **0 / reservedBytes=0 / memoryTotal=0 / workersJoined=true**다. 자동 OS 입력·UIA·화면 관측의 기능 근거이며 물리/표시/성능 수락은 아니다.
- **이번 독립 설치:** 새 **8개 package**를 offline 외부 소비자에 설치했다. TS **7.0.2 / NodeNext / ES2022 / types: [] / skipLibCheck: false**에서 기존 App과 새 layout·의미 설정 선언 PASS. 설치 CLI의 Material/Cupertino template create, Web/Windows doctor/build(**714/715 modules / original-elements**), Web pack과 폐기 `windows-hwnd` 설정 거부 PASS. archive·설치본·pack은 finally에서 제거했다. 이번 설치본의 native run은 실행하지 않았으며 실제 Gallery 실행은 별도의 workspace App 검증이다.
- **남은 범위:** Chip/InputDecoration의 별도 layout/hit/paint·기본 theme/paint와 전체 catalog·남은 RNW/서비스를 계속 구현한다. Android stale/notVerified·Linux/Apple DEFERRED·전체 compatible=false·물리/성능 수락 경계는 유지한다.

### 3.8 InputDecoration·공통 layout/paint 결과 연결 — 진행 중 / PARTIAL

- **공통 연산:** 기존 수치 layout 명령에 자식 배율·최대 16개 paint 결과·조건부 child query를 추가했다. paint는 해당 Core 결과를 읽고 조건부 path·acos/asin을 해석한다. App에서 최종 크기·위치·경로를 계산하지 않는다. 구조가 같은 식은 공유하며 기존 64 children / 128 variables / 512 expressions / 512 commands 예산을 유지한다. 전체 InputDecoration 슬롯은 303 expressions / 155 commands다.
- **원래 모듈:** `RenderInputDecoration`의 슬롯 측정·두 방향 배치·baseline/dry/intrinsic·floating label 배율을 연결했다. 기본 underline과 원래 outline의 label gap·corner path, fill과 border animation의 native 수명을 연결했다. custom/instance hook·elliptical outline·곡선 bottom underline은 명시 거부하며 전체 custom painter 지원으로 세지 않는다.
- **의미·host:** helper/error 안내의 `liveRegion`을 Source의 기존 31-bit 의미 flag로 전달한다. Web ARIA polite와 Windows UIA LiveSetting/변경 알림을 연결했다. RNW 새 API 소스 이식 완료나 reader 음성 확인을 뜻하지 않는다.
- **직접 비교:** 실제 Source layout 19개·border path 10개 비교, 게시 frame의 label 배율·네 intrinsic·유한/무한 폭·RTL·누락 슬롯·0 폭·확장 높이 PASS. 조건부 query의 불필요한 실패 회피, 새 wire 4개 거부, 미정의 paint 결과의 이전 active 보존·복구와 최종 memory 0 PASS. 의미 비교는 live region·형제 충돌을 포함한 21개 PASS다. 기존 layout/toolbar·retained input·clip·Ink·dormant·progress·SceneWriter 영향 검사도 통과했다.
- **일반 Web App:** 원래 MaterialApp/InputDecorator/TextField로 만든 작은 App(755 modules / original-elements)에서 Chrome/Edge × plain/isolated의 focus/해제·RTL·helper/error·resize·실제 textarea 입력 → 원래 State 반영 PASS. live region의 ARIA 게시와 마지막 예약 0 / workersStopped=true를 확인했다. 임시 App·junction·bundle·browser/server는 finally로 회수했다.
- **당시 Gallery의 차단:** 입력·버튼 스크롤 화면은 `CustomScrollView` 미지원에서 막혔다. 후속 box sliver 연결·명령 예산 수정과 실제 12개 TextField 화면의 확인은 §3.9–3.10에 구분한다. 전체 catalog 완료는 아니다.
- **Windows 통합:** 일반 입력 App은 처음 UIA의 `text navigation order` 검증에서 중단됐다. 빈 editor의 측정용 U+200B line end가 실제 빈 문서의 stop에 섞인 것을 고쳤고, 빈 필드 click은 유효한 ticket/context/좌표 검증 후 실제 문서의 삽입 위치 0을 반환하도록 보완했다. 범위·순서·surrogate 검증을 유지한다. 수정 공급의 일반 App SDK App(756 modules)에서 빈 필드 click·`Nelyx test` 입력 → 원래 State 반영·focus/error·RTL·최대화/960×720 복원·정상 종료를 확인했다. 마지막 accepted=active=published=47 / failed=0, host/preparation 오류 0, 종료 status 0 / reservedBytes=0 / memoryTotal=0 / workersJoined=true다. 전체 선택 뒤 Backspace가 반영되지 않는 문제는 후속 §3.9의 수정 범위로 분리했다.
- **당시 공급·설치:** source **`11008835f3bf6a5ac07d7e5e3438de5572aca9b80f141a98b3871f641f614e48`**, ABI 2 / schema 2391260344 / layout 192 bytes / semantics header 88 bytes다. manifest 355개 파일의 실제 tree·전체 SHA-256, RNW 원본/수정 6개와 license, 기존 834 subpath 기준 hash를 확인했다. 새 8개 package 설치의 TS 7.0.2 strict 선언·CLI create/doctor·Web/Windows 714/715 modules build·Web pack은 PASS이며 설치본 native run은 미실행이다. 전체 compatible=false, Android stale/notVerified, Linux/Apple DEFERRED, 두 성능 flag false·물리/display/scanout notVerified를 유지한다.

### 3.9 유한 box sliver·삭제 Action·원자적 명령 축소 — 진행 중 / PARTIAL

- **Scroll 연결:** 원래 CustomScrollView의 forward vertical·hardEdge·기본 physics와 유한 SliverToBoxAdapter 경로를 연결했다. 원래 adapter/자식 Element·State를 유지하며 모듈의 수치 layout을 Core가 실행한다. 여러 box sliver·빈 adapter를 지원하고 ListView와 controller 부착/교체/종료를 공유한다. 임의 sliver·수평/reverse·shrinkWrap·custom hook/cache/physics·명시 semanticChildCount는 별도 미지원이다. 국소 Source/Core 확인에서 초기 offset 50·끝 clamp 480·State 값 7 보존·controller 교체·320×120→500×140 resize와 max extent 480→460·빈 내용/복구 PASS, State init/dispose 4/4·최종 memory 0·TS layout fallback 0이다. 기존 dormant 비교도 State 20/20·cache 0·memory 0으로 통과했다.
- **편집 Action:** native 모드에 없는 TS RenderEditable geometry를 문자 삭제/기존 선택 삭제의 선행 조건으로 삼던 것을 제거했다. 원래 nested ReplaceText Action·formatter·controller·onChanged 경로를 유지한다. 이전 §3.8 공급과 새 App에서 Windows의 단일 문자/전체 선택 삭제·RTL 빈 caret·결합 문자/ZWJ emoji 단위 삭제 → 원래 State 반영을 확인했다. 마지막 accepted=active=published=37 / failed=0, host/preparation 오류 0, 종료 status/예약/메모리 0·workersJoined=true다. line/word/visual caret 등 geometry가 필요한 편집 의무는 남아 있다.
- **Web 후속 수정:** 일반 DOM Backspace가 결합 표시만 지워 Source grapheme 정책과 달라지는 것을 확인했다. IME·문자 ingress는 DOM carrier에 유지하고 조합 중이 아닌 일반 Backspace/Delete를 원래 Action에 보낸다. keyup은 실제 전달한 editor key와 짝을 맞춘다. 작은 원래 Material App의 Chrome/Edge × plain/isolated 4개에서 단일/전체 선택 삭제·결합 문자/ZWJ emoji 단위 삭제·RTL·resize·State 반영과 close 예약 0/worker 종료를 확인했다.
- **실제 Gallery와 명령 예산:** CustomScrollView의 이전 차단을 지난 실제 12개 입력 화면은 atomic transaction의 4096-command 예산에서 중단됐다. 기본 설정 축소 후에도 1,001개 node / 4,384개 command가 필요했고 신규 노드 attach만 990개였다. 명령 상한·packet/node/memory 예산을 늘리지 않고, 새 노드의 closed 기본 layout/hit flag·생성과 부착·부착 해제 후 삭제를 각각 한 명령에 묶었다. SceneWriter는 부모→자식 순서로 생성하고 모든 reference 대상이 생긴 뒤 설정을 적용한다. 완전히 같은 기본 설정만 생략하며 기존 노드의 reset·move·NACK/불확정 ACK 수명은 유지한다. cascade 삭제나 부분 문서 게시를 추가하지 않는다. 801-node 생성 1,602/전체 교체 2,403 commands, 1,101-node canonical tree 교체 1,902 commands, retained reparent·새/기존 형제 순서·불확정 ACK·reset과 malformed wire 11개 거부·이전 active 보존 PASS다.
- **마지막 완료 공급:** Windows/Web source **`06f9c87da55c3fdc77c19d37b71f7b1d87470c096a669d1d47bb8f812ad89a7f`**, ABI 2 / schema **1149443889** / layout 192 bytes / semantics header 88 bytes / App text 12 / App service 3다. manifest 355개 파일의 tree·모든 SHA-256·RNW 6개 원본/수정/소유 license와 기존 834-subpath 기준 hash를 확인했다. Core 영향 묶음 **13/13**·최종 memory 0 PASS. 새 8개 package의 offline 독립 설치에서 TS 7.0.2 strict 선언·CustomScrollView/SliverToBoxAdapter/새 commands API·CLI create/doctor·Web/Windows 714/715 modules build·Web pack PASS이며 설치본 native run은 미실행이다. 아래 §3.10의 후속 수정은 새 공급·실행 확인 전까지 이 PASS에 포함하지 않는다.

### 3.10 실제 입력 Gallery 통합·Web heap·Windows 문자 carrier — 해당 입력 흐름 통과 / PARTIAL

- **실제 앱 연결:** 원래 Gallery는 Web 882 / Windows 883 modules / original-elements다. 아래 Picture API3 수정 공급에서 **Chrome/Edge × plain/isolated 4개 모두** 12개 textarea·첫/마지막 한글 입력/전송·독립 count·실제 wheel·처음/끝 이동·두 줄 입력·값 보존/초기화·1100×800→900×650 resize를 확인했다. 최종 accepted=active=published/failed=0, App/host 오류 없음, close 예약 0/workersStopped=true다. 이전 Edge isolated 메모리 실패의 해소를 실제 같은 입력 흐름으로 확인했다.
- **공유 Wasm view:** threaded 실제 입력에서 다른 owner의 memory growth 뒤 coordinator/owner의 오래된 HEAPU8 길이로 output bounds 실패가 발생했다. 로컬 고정 Emscripten 소스의 view 갱신 함수를 호출하는 명시 export를 추가하고 입력/출력 복사·heap 예산 보고 직전에 현재 view를 확보한다. 별도 단일/공유 Wasm 33,554,432→33,619,968-byte view 갱신과 실제 exchange의 65,536→131,072-byte output 복사 확인 PASS. 위 Chrome isolated 실제 전체 흐름도 수정 후 통과했다.
- **Edge isolated 메모리 문제:** 반복 확인에서도 Core 1,001 nodes·Render live Pictures 1,001개를 유지하는 동안 Render CanvasKit committed heap이 증가해 기존 unified 768 MiB 한도를 넘었다. Picture 복원의 매번 새로운 변형 face 생성 경로를 확인했다. 실제 base-face identity와 정렬한 변형 좌표를 키로 provider가 최대 16개를 소유/재사용하고 memory pressure/close 때 비우도록 Picture API3를 작성했다. CanvasKit **m153-nelyx-paragraph.6**의 고정 소스 build/adopt와 24회 복원·실제 draw 시 128 MiB heap 유지, 잘못된 참조/축 3개 거부·18개 변형의 16-entry eviction/clear, 동일 bytes라도 독립 decode한 실제 base identity 분리 확인 PASS. 실제 Edge isolated 전체 흐름도 변형 3개·최종 cache hits 2,716/misses 3·Content/Render 각각 128 MiB·peak 746,150,656 bytes·rejected 0을 유지하고 마지막 문서 63/close 예약 0으로 통과했다. 상한은 그대로다.
- **Windows 이전 범위:** §3.9의 06f9c87… 공급에서는 UIA 값 설정으로 첫/마지막 한글 값 → 원래 전송 callback, 독립 count·처음/끝 이동·값 보존·첫 행 초기화·Gallery 복귀와 정상 종료를 확인했다. 마지막 accepted=active=published=40 / failed=0, host/preparation 오류 0, close status/예약/메모리 0·workersJoined=true다. 마지막 필드의 일반 `a` 키도 원래 값에 추가됐다. 당시 자동화 `type_text`의 문자열은 이 다중 입력 Gallery에 반영되지 않았으며, VK_PACKET을 일반 Source 물리 key/TSF test에서 제외하는 수정만으로는 해소되지 않았다. 아래 새 clipboard/논리 key 수정의 확인과 구분한다.
- **Windows clipboard 입력 순서:** 일반 앱 내 Ctrl+A/Ctrl+C·삭제·Ctrl+V의 한글 값 복구는 성공했다. 문자열 타이핑에서 요청 문구 대신 직전 복사값이 들어오는 경우를 확인해, App의 나중 clipboard 읽기가 OS 입력 시점과 달라지는 경로를 분리했다. RNW의 GetContent를 실제 paste-key UI turn에 시작하고 기존 GetTextAsync/Completed·취소 수명을 유지한다. Core 키 이벤트의 opaque snapshot token을 SDK가 원래 Source Action에 범위 지정하며 처리/폐기/예외 뒤 release한다. native snapshot 32개·reader 32개·문자/ledger 예산, pending read의 release-before-complete와 close/late terminal·memory 0 검사, 실제 Source Clipboard channel의 snapshot/live 읽기 분리와 handled/drop/exception release 검사 PASS. 실제 Core의 Ctrl+V/Shift+Insert/repeat 3개 token·기존 keyup, 잘못된 wire 7개·오래된 publication·canonical receiver 없음의 거부와 추가 key/event 작업 없음·close memory 0도 확인했다.
- **Picture 수정 묶음 공급·설치:** source **`7d1a12d013ebb5e534af6f93d56e5984e6a090ee163bb29d4505fe3384743157`**, ABI 2 / schema 1149443889 / App text 12 / App service 3다. source identity·manifest 355개 전체 tree/hash·기존 API 기준 hash 일치와 Core/SDK build·전체 type/lint/format/schema 검사 PASS. 새 8개 package의 offline 독립 설치·TS 7.0.2 strict 선언·Material/Cupertino create·Web/Windows doctor/build 714/715 modules·Web pack도 통과하고 임시 설치본/archive/pack을 회수했다. 설치본 native run은 미실행이다. 위 clipboard key 수정은 다음 공급의 별도 확인 범위다.
- **Clipboard 묶음 공급·설치:** source **`0e840012bcb2b1a10c2b49380a430230d234a9544f9fc2c140badc7af76c4e1d`**, ABI 2 / schema **4202727879** / layout 192 bytes / semantics header 88 bytes / App text 12 / **App service 4**다. Windows/Web engine·Core/SDK build, manifest 355개 전체 tree/hash·RNW 원본/정규화 upstream/수정본 6개와 license·기존 API 기준 hash 일치, Core 영향 묶음 **13/13**·memory 0 PASS. 같은 공급의 실제 Web Gallery 4개 profile과 새 8개 package offline 설치의 TS 7.0.2 strict 선언·snapshot keyBody 인자·두 디자인 create/doctor·Windows/Web 715/714 modules build·Web pack PASS. 설치본 native run은 미실행이다.
- **App 논리 key 대기:** caret/compositor 게시가 full semantics query와 다음 poll 사이에 전진하면 기존 publication 완전 일치 gate가 Source key를 오래 대기시켰다. Core가 publication/node generation을 검증해 접수한 논리 focus/key는 App 안정/visible/focused gate로 전달하고, 실제 geometry 질의·새 Core focus 요청의 엄격한 fence는 유지한다. 다른 publication의 key 전달·폐기 token release 국소 검사와 변경 후 소규모 원래 Material App의 Web 4개 profile(선택/단일/grapheme 삭제·State·RTL·resize·close) PASS. App-only 변경으로 위 engine identity는 그대로다.
- **새 Windows 중간 관측:** 0e84001… 공급·위 App 수정의 일반 Gallery에서 `type_text` 첫/마지막 한글 문자열 → 전송·독립 count, 실제 wheel·끝/처음 이동·첫 값 보존, Backspace 한 문자 삭제·다중 문자열 추가, 최대화/복원·두 항목 초기화·Gallery 복귀를 실제 화면/UIA로 확인했다. 마지막 accepted=active=published=42 / failed=0, host/preparation 오류 0, clipboard snapshots 0, 정상 close status/예약/메모리 0·workersJoined=true다. **삭제 직후 한 글자 재입력 1회는 누락돼 이 실행 자체는 전체 문자열 입력 PASS가 아니다.** native key가 오래된 UI publication으로 거부돼도 버리던 경로를 수정했다. 실제 ingress snapshot에서 시작하고 focus/session·문서·metrics/device가 같은 경우에만 stale 거부를 최대 3회 접수하며 성공한 key는 재전달하지 않는다.
- **Windows key 수정의 최종 통합:** 현재 공급 source **`2f3486fc38ca057dd82629496856ba57fa3bf91cf7792057cc9e45a016084e0e`**, ABI 2 / schema 4202727879 / App text 12 / App service 4 / CanvasKit m153-nelyx-paragraph.6다. native/single-worker/threaded·App SDK host 빌드, manifest 355개 전체 tree/hash·RNW 원본/수정/정규화 upstream와 license·기존 834-subpath 기준 hash PASS. Gallery Web 882 / Windows 883 modules를 갱신했다. 실제 Web 4개 profile 전체 입력 흐름이 각각 최종 문서 **83/69/72/61**·accepted=active=published·failed=0·오류 없음·close 예약 0/workersStopped=true로 통과했다. Windows 일반 Gallery는 첫 빈 필드 **가 → Backspace → 나 → 다 = 나다**와 전송, 마지막 필드 **마지막 입력 확인 → Backspace → 인 = 마지막 입력 확인**과 전송, 처음/끝 왕복의 값 보존·Gallery 복귀를 화면/UIA로 확인했다. 전달 key **24**, 거부 **0**, snapshot **0**, 마지막 accepted=active=published=**39** / failed=0 / host·preparation 오류 0, close status/예약/메모리 **0 / workersJoined=true** PASS. 이 실행에서는 stale retry 자체는 **0회**로 강제 경합·3회 소진/소유권 변경 중단까지 실행한 근거는 아니다. 위 0e84001… 공급의 설치/API·Core 13개 근거는 같은 wire/Core의 이전 확인으로 남기며 host-only 수정 후 독립 설치 전체를 다시 수행한 것으로 확대하지 않는다.
- **남은 통합:** 위 입력 흐름의 기능 통과와 별개로 물리 IME/조합·selection·전체 UIA focus/reader·geometry가 필요한 editing은 남아 있다. Chip·기본 theme/paint·나머지 RNW API와 Android/후속 플랫폼 의무를 다음 구현 묶음으로 이어간다. 전체 compatible=false, Android stale/notVerified, Linux/Apple DEFERRED, 물리/display/scanout notVerified와 두 성능 flag false를 유지한다.

### 3.11 Chip 모듈·공통 hit 투영·의미 영역 — 구현 / 국소 PASS · 실제 앱 통합 대기

- **모듈 소유 정책:** 원래 `RenderChip`의 세 slot 측정·배치·baseline·intrinsic·avatar/delete drawer·RTL 정책을 수치 명령으로 기록한다. 원래 Widget/State와 세 개의 지속 proxy slot을 유지하고, avatar → delete → label의 Source paint 순서·enable alpha·체크 표시의 전경/진행/역방향 색 정책을 연결했다. native claim·교체·detach·dispose·부분 구독 실패에서 원래 animation listener를 회수한다. C++ Chip 클래스나 App 최종 geometry 실행은 추가하지 않았다.
- **공통 연산:** 기존 layout program의 크기/쿼리/명령 예산을 유지하며 수치 hit rectangle·자식 선택·초기 점 투영/retained 상수 좌표·self 영역 합집합·별도 semantics rectangle을 추가했다. 순서상 첫 일치 자식만 선택하고 실제 ancestor clip을 통과한 뒤 자식 좌표에서 검사한다. 기존 input-padding의 경로와 새 contact 투영을 구분한다. 투영/영역이 바뀐 이전 publication도 같은 입력 geometry로 재사용하지 않는다. 의미 영역은 layout 크기를 바꾸지 않으며 Core가 최종 local/world 영역·행렬을 게시하고 Web/Windows가 이를 소비한다. 새 semantic geometry blob은 **112 bytes**, schema는 **1729734369**다.
- **체크 표시/paint:** 공통 foreground children 경계와 shape/path의 제한된 `srcATop`, 경로 stroke-width 수치식을 연결했다. native/CanvasKit provider가 해당 blend를 실행하고 다음 paint에 남기지 않는다. stroke 식은 기존 **512-byte paint record**의 명시 필드를 사용하며 범위/잘못된 kind·색·경로의 기존 admission을 유지한다. 전체 shader/filter/custom painter 완료 범위가 아니다.
- **Source/Core 국소 확인:** 실제 원래 RenderChip과 Core의 **16개** LTR/RTL·avatar/checkmark/delete 없음·부분 drawer·custom constraints·density·disabled·reverse·0/좁은/무한 폭·baseline 없음에 대해 layout/child 위치·dry·alphabetic baseline·4개 intrinsic 비교 PASS. **22개** 접촉은 본문/삭제 선택과 RTL 경계의 양쪽/정확한 경계·이동 뒤 원래 상수 inverse를 비교했다. 체크 경로 **15개**의 Source 색/점/굵기·avatar tint와 잘못된 program **6개** 거부·투영 변경 뒤 오래된 publication 거부·close memory **0** PASS. Source Path의 float32 저장 오차는 경로 점에만 **0.00002px** 이내로 비교했다.
- **추가 국소 확인:** 실제 Source tap-padding의 초기 x/중앙 y와 이동 뒤 상수 좌표, 최소 의미 영역 **[-14,-19,48,48]**의 90도 변환 후 world 영역 **[71,46,48,48]**·기존 layout **20×10** 보존·close memory 0 PASS. animation 구독 교체/부분 실패 rollback·detach/dispose 회수와 instance policy 거부도 통과했다. 잘못된 paint wire **3개** 거부와 음수 dynamic stroke의 prepare rollback·후속 복구도 확인했다. 새 blob의 실제 게시에서 빠진 decoder 허용 목록을 발견해 수정했으며, 수정 뒤 해당 실제 Core 게시 검사가 통과했다.
- **공급/회귀 상태:** 첫 Chip 묶음 source **`e63da7f3353284ecb420430c2028a958cfac68238602eabc304cecd8143303c1`**에서 Core 영향 **13/13**·memory 0, Core/Material/SDK build·전체 type/lint/format을 확인했다. decoder 허용 목록 수정까지 포함한 source **`e193bbb626a36a129ca1bd5cadcbaafd78a074cc1545b3fc281d50d3f9fd9870`**의 native/single-worker/threaded·App SDK host 빌드와 manifest **355개** 전체 hash·출처·원래 834-subpath 기준을 확인했다. 이 공급의 실제 기본 theme Chip Web App은 **746 modules**로 빌드됐으나 라벨의 기본 `TextOverflow.fade` 미지원에서 시작이 거부됐다. 실패 종료도 예약 **0**·worker 종료·임시 자료 회수를 확인했다. 기본 스타일을 유지하며 paragraph overflow paint를 다음 수정 묶음으로 연결한다. Chip App의 실제 기능·Windows·Demo·새 설치 소비자는 아직 PASS가 아니다.

### 3.12 Paragraph fade·기본 Chip App 통합 — Windows/Web 해당 흐름 PASS / PARTIAL

- **Source/공통 실행 경계:** 원래 `RenderParagraph`의 fade 방향·길이를 Source 수치 paint로 기록했다. Core가 실제 overflow와 같은 font cohort의 보조 paragraph 측정을 소유하며 App에서 최종 geometry를 계산하지 않는다. 말줄임표 텍스트·크기·weight/variation 등 선언은 Source에서 전달한다. 보조 paragraph는 한 단계만 허용하고 원래 run 예산 안에 포함한다. 별도 **24-byte 보조 측정 header**를 사용하며 schema는 **1622171931**, ABI 2·layout 192·기존 512-byte paint record·App text 12·App service 4를 유지한다.
- **공통 paint:** 수치식으로 해석한 linear opacity mask를 node·inline 자식 전체의 layer에 적용한다. Native/CanvasKit 모두 white→transparent white의 `modulate`를 사용하고 해당 layer를 닫은 뒤 다음 paint를 실행한다. overflow가 없으면 mask와 보조 측정 요청을 생략한다. 임의 shader/filter/custom painter 전체의 지원 완료가 아니다.
- **국소/설치 확인:** 동일한 명시 측정 fixture에서 원래 Source `RenderParagraph`의 paint/gradient와 Core의 LTR/RTL·세로 overflow·line limit·짧은 문장 높이 제한·overflow 없음·0 폭 **7개**를 비교했다. 잘못된 paragraph **6개**·paint **6개** 거부와 prepare 실패의 이전 문서 보존/복구·close memory **0** PASS. Chip의 세 국소 검사와 Core 영향 **13/13**·각 close memory 0도 통과했다. Core/Material/SDK build·전체 type/lint/format, 독립 설치 **8 packages**의 TS **7.0.2 / NodeNext / ES2022 / types=[] / skipLibCheck=false** 선언 검사와 Material/Cupertino CLI create·doctor·Web/Windows build **714/715 modules**·Web pack·폐기 host 거부를 통과했다. 새 설치 fixture는 hit 투영·self/semantics 영역·foreground·dynamic stroke/srcATop·mask/보조 paragraph 선언을 포함한다.
- **실제 Web:** source **`dda6c90f7bbc9294950e5ff5fe49dffab0e82435baf9a07ef2c5f9fab204ff59`**의 native/single-worker/threaded·App SDK build, manifest **355개** hash·출처·원래 834-subpath 기준을 확인했다. 기본 Material theme의 원래 Chip App은 Web **746 modules**·`original-elements`로 빌드됐다. Chrome/Edge × plain/isolated **4개**에서 Action 증가·Filter 선택/해제·삭제 아이콘 클릭·resize/State 보존·Core document/active/published 일치·오류 0·close 예약 **0**/worker 종료 PASS. 원래 RichText의 두 red WidgetSpan에서 LTR/RTL/세로 fade 가장자리 픽셀과 후속 blue box의 paint 상태 보존도 네 profile에서 확인했다. 별도 이름의 삭제 button을 가정한 첫 locator는 Source의 결합된 Chip semantics와 달라 실제 아이콘 위치 클릭으로 바로잡았다. 전체 접근성 수락으로 확대하지 않는다.
- **Windows 실패와 수정 묶음:** fade 패널을 포함한 첫 일반 CLI 실행이 Render GPU 예산 **status 19**로 종료됐다. 기본 Chip만 실행하면 **960×720**에서 Action **1**·Filter **true**/체크 표시·삭제 **true**가 동작했지만 확대 후 선택 애니메이션에서 같은 거부가 발생했다. 두 실패 실행 모두 close status/예약/메모리 **0**, worker join을 확인했다. 보이지 않거나 singular한 노드에도 예약하던 opacity layer를 제외하고, Native mask는 먼저 clip한 실제 device 영역과 한 pixel 여유만 예약하도록 고쳤다. GPU/통합 예산은 늘리지 않았다. 수정한 공통 Skia provider의 MSVC 엄격 검사를 통과했다. 최종 source **`6172ad5bba21191259bb75a7ba8f0c894e8480133fb9540855bc6ce77d269f3a`**의 native/single-worker/threaded·App SDK build·manifest **355개** 전체 hash/출처/기준을 확인했다. 이 공급의 일반 Windows CLI **747 modules**에서 fade 패널을 포함한 초기 **960×720**·확대 **1280×729.5**의 Filter 선택/해제·Action **1**·삭제 **true**·창 복원/State 보존, LTR/RTL/세로 자식 fade와 후속 blue box 화면을 확인했다. 마지막 **document/active/published=32**, prepare/host 오류 **0**, close status/예약/메모리 **0**·worker join·dispatcher 종료 PASS. GPU 예약의 관측값은 **66,732,032–78,543,344 bytes**, 전체 memoryPeak는 **373,223,395 bytes**다. 확대 경계에서 누적 입력 **rejected=5**가 관측됐으므로 이를 입력 거부 0이나 물리 입력 수락으로 기록하지 않는다. 같은 최종 공급의 Web 네 profile도 위 기능/픽셀/resize/정식 종료를 다시 통과했다. 변경하지 않은 Core/선언의 13개·8-package 검사는 앞선 동일 wire 근거로 남기며, provider-only 수정 후 독립 설치 전체를 반복했다고 기록하지 않는다.

### 3.13 대표 Gallery/Demo의 새 진행 지점 — 시작/일부 흐름 PASS · drawer ListView 차단

- **실제 공급/앱:** §3.12의 최종 **6172ad5…** 공급으로 일반 CLI에서 Gallery **Web 884 / Windows 885 modules**, Demo **Web 850 / Windows 851 modules**를 빌드했다. 모두 `original-elements`다. Chrome plain에서 두 앱의 첫 화면·오류 0·close 예약 **0**/worker 종료를 확인했다. Windows 두 App bundle의 빌드는 실제 실행 PASS를 뜻하지 않는다.
- **Gallery 입력 회귀:** 최종 공급의 Edge isolated에서 입력 **12개**·처음/끝 이동·wheel·multiline·전송/버튼 상태·resize·값 유지/초기화·정식 종료 PASS. 마지막 **document/active/published=73**, failed **0**, 종료 예약 **0**·worker 종료를 확인했다. §3.10의 이전 공급 Windows 입력 근거를 새 schema의 Windows 실행으로 복사하지 않는다.
- **Demo 다음 차단:** 실제 Demo는 Chip 때문에 첫 진입이 거부되던 단계를 지났고 `Filled` 클릭 후 **Filled pressed**까지 통과했다. `Explore components` drawer를 열자 원래 `ListView(children: …)`의 **list-requires-fixed-or-indexed-extent** 거부가 관측됐다. 실패한 실행도 정식 close 예약 **0**·worker 종료를 확인했다. drawer 진입 뒤 Selection/Chip·editor·theme/반응형·dialog 흐름은 아직 도달하지 않아 PASS가 아니다. Source의 임의/고정 높이로 앱을 바꾸지 않고, 유한 delegate의 원래 child owner·State/keep-alive와 Core의 실제 가변 높이 측정/게시를 연결하는 다음 W9B-01/02 묶음으로 이어간다.

### 3.14 유한 가변 높이 ListView·Navigator home 갱신 — 해당 Source/Windows/Web 흐름 PASS / PARTIAL

- **목록 소유권:** 원래 `RenderSliverList` 모듈이 공통 native sliver 설정을 등록한다. 길이 정보가 없는 유한 `ListView(children: …)`/유한 builder는 원래 Sliver Element·lazy 생성/폐기·명시적 keep-alive·게시 중인 자식 보존을 사용한다. 앱에 임의 `itemExtent`를 추가하거나 eager box 목록으로 바꾸지 않았다. Core의 공통 list flag **sequential=2**는 미측정 앞부분을 건너뛰지 않고 실제 자식을 순서대로 측정하며, 관측한 높이의 평균으로 남은 길이를 추정한다. 초기/모든 항목 높이 0도 허용한다. Source는 추정 높이를 계산하지 않는다. 기존 fixed/indexed 정책과 **128 children / 4,096 source metrics** 한도는 유지한다. 폭 변경의 generation과 원래 숫자 offset 이동 의도를 보존해 초기 추정 끝보다 먼 이동도 실제 측정 후 보정한다.
- **Navigator:** 부모 App의 `home` 변경에도 같은 Builder Widget을 재사용하던 페이지 캐시를 갱신한다. 페이지 GlobalKey와 Element/State는 보존하고, transition tick마다 페이지를 다시 만들지는 않는다. 실제 Source 계약에서 light→dark 인자 갱신·원래 페이지 State/count **7**·생성 **1** 유지와 종료 후 dispose **1**을 확인했다.
- **Source/Core 계약:** children·유한 builder 각각 초기 lazy **0–2**만 생성, 초기 추정 scrollMaximum **588**을 넘는 `jumpTo(850)`의 실제 offset **850**, 끝 초과 이동의 **1,100 / total 1,280**, 역이동·첫 행 keep-alive State/count **7** 보존·나머지 행 폐기/재생성, 폭 **500→320** 재측정의 **offset 1,372 / total 1,552**, 빈 목록·6개 0높이 항목을 확인했다. 각 목록의 생성/종료 폐기 **31/31**, TS layout fallback **0**이다. 잘못된 flag·fixed 충돌·sequential의 양수 estimate·source metric 한도 초과·builder 제거 **5개씩**의 NACK/이전 active 보존과 encoder 오설정 거부도 확인했다. Navigator 포함 **3개 계약 PASS**, 각 Core session 종료 memory **0**이다.
- **새 공급·설치:** source **`b38c6a94543b29d3b74d305f1a61fef54bcda81087f9f382e63fadc030f3d744`**, ABI 2 / schema **1093392488**, App text 12 / service 4, layout 192·semantics header 88/geometry 112·native paint 512·paragraph probe 24 bytes다. Windows/single-worker/threaded·App SDK 및 Core/SDK build, 전체 type/lint/format/schema/diff 검사, manifest **355개** 전체 tree/hash·source identity·RNW 6개 원본/수정본/license·원래 834 API 기준 hash 일치 PASS. 같은 공급의 Core 영향 **13/13**, Chip **3/3**, fade **7 cases**와 각 종료 memory 0을 재확인했다. 새 **8개 package** offline 설치의 TS 7.0.2 strict 선언은 sequential list 설정까지 포함하며, Material/Cupertino create·Web/Windows doctor/build **714/715 modules**·Web pack·폐기 host 거부 PASS다. 설치본 native run은 이 회차에 실행하지 않았다. 임시 설치본/archive는 회수했다.
- **실제 Web:** Gallery **884/885**, Demo **850/851 modules**의 Web/Windows App bundle을 새 공급으로 갱신했다. Chrome plain 첫 진입 두 앱·오류 0·close 예약 0 PASS. 실제 Gallery의 기존 1,000행 목록 선택·끝/처음 이동·상태 유지·복귀는 **Chrome/Edge × plain/isolated 4조합**에서 PASS이고 마지막 document/active/published는 각각 **90/77/75/88**, failed 0·close 예약 0/worker 종료다. 실제 Demo의 별도 경로는 Filled callback·테마 light→dark→light·dialog 열기/닫기·**1,100×800→560×700→1,100×800**와 상태 보존 PASS, 마지막 문서 **121** 일치·오류 0·close 예약 0/worker 종료다. drawer 8개 항목도 실제 게시됐으며 아래 새 차단까지 진행했다.
- **실제 Windows Demo:** 일반 CLI/App SDK **851 modules**에서 Filled pressed, light→dark, 원래 가변 높이 drawer의 **8개 항목**, Containment 그룹 선택·스크롤, **960×720→1,280×729.5→960×720**, dialog 열기/닫기·Dialog closed, light 복귀·Show all의 실제 화면/UIA를 확인했다. 마지막 **document=active=published=137 / failed=0**, 준비/host 오류 0이다. Alt+F4 종료는 **status/예약/메모리 0 / workersJoined=true / dispatcher closed**, 소유 창 없음까지 확인했다. 관측 GPU **66,732,032–78,374,912 bytes**는 5초 간격 상태 관측이며 GPU peak가 아니다. 전체 memoryPeak **516,087,037 bytes**, Core input rejected **5**를 함께 기록한다. 첫 wheel의 화면 이동은 확인되지 않았고 후속 wheel에서 이동·dialog 도달을 확인했다. 입력 거부 0이나 전체 wheel 경합 해결로 확대하지 않는다. OS 자동 입력/UIA·화면 관측은 물리 입력·scanout·성능 수락을 대신하지 않는다.

### 3.15 Demo 그룹 탐색 후 확인한 다음 공통 차단

- **Selection:** drawer의 Selection 선택이 실제 Source 그룹을 만들면서 `custom-or-unported-render-object:MaterialRangeSliderRender`에서 거부된다. Choice/Filter/ActionChip 조작까지 도달한 결과가 아니다. 원래 RangeSlider State·두 thumb의 입력/semantics·기본 shape/painter를 TS에 유지하고 공통 Core layout/paint/geometry에 연결하는 다음 묶음으로 이어간다.
- **Text inputs:** 별도 새 실행에서 drawer의 Text inputs 선택 후 `editable-layout-configuration` 거부를 확인했다. 이 화면의 두 번째 TextField는 원래 `messageScroll` controller와 2–4행 설정을 사용한다. 현재 native editing bridge가 외부 scrollController 등 해당 layout 옵션을 거부한다. 이를 앱에서 제거하지 않고 Core 편집 viewport 관측·명령과 원래 controller 수명을 연결해야 한다. 실제 편집·전송·선택/undo/secure/scroll 버튼은 이 실행에서 미도달이다.
- 두 실패 실행도 정식 close의 예약 **0**·worker 종료를 확인했다. §3.14의 독립 theme/dialog/resize PASS와 이 미도달 범위를 구분한다. 전체 API compatible=false, Android 새 공급/실행 stale/notVerified, 물리/display/scanout notVerified·두 성능 flag false·Linux/Apple DEFERRED를 유지한다.

### 3.16 RangeSlider·편집 viewport와 실제 Demo 연결 — 해당 계약 PASS / PARTIAL

- **원래 RangeSlider:** 기존 TS State·theme·controller·gesture callback을 유지하고 기본 round/rect/gapped track·round/handle thumb·tick·overlay를 공통 native layout/paint 프로그램에 연결했다. 두 thumb의 실제 Source Focus/Semantics 자식을 Core가 48×48로 배치한다. Source paint와 Core 출력의 기본/신형·LTR/RTL·비활성 **5 cases**, 두 range 값·increment·controlled callback 거부, TS layout fallback **0**, 종료 memory **0** PASS다. 임의 shape hook과 debug shadow override는 명시 거부한다. **labels가 있는 value indicator overlay와 전체 custom shape 계약은 미완료**다.
- **편집 viewport:** 원래 EditableText State·formatter·undo와 외부 ScrollController의 attach/transfer/detach 수명을 유지한다. 공통 editor viewport **24-byte** 설정과 한 공백 paragraph의 실제 측정으로 preferred line height를 구하고 min/maxLines·expands·가로/세로 scroll extent·caret reveal·텍스트/selection/caret offset을 Core에서 계산한다. 독립 line probe는 caret 높이를 행 높이로 대신하지 않는다. single-line 끝에는 cursor 폭을 포함한다. caret 자동 이동 뒤 수동 jump가 이전 캐시를 재사용하던 반복 준비 문제도 수정했다. 단일/여러 행·RTL·expands·수동 이동·편집 후 caret reveal·malformed **4개** NACK/기존 active 보존과 잘못된 expands 타입 거부 PASS, 측정 **22 / probe 11**, 종료 memory **0**이다. custom physics/scroll behavior·strut/non-start alignment와 editor의 양수 duration animate는 아직 명시 미지원이다.
- **Web 입력·접근성:** textarea에서 Enter·Ctrl+Enter를 버리던 host 필터를 수정해 Source의 줄바꿈/submit 정책으로 보낸다. IME 조합 중 carrier ingress는 유지한다. Chip의 nullable checked/selected Source flag word를 ARIA에 반영한다. 실제 Demo Chrome plain에서 Choice/Filter/ActionChip·한글 입력/Enter submit·theme/resize까지 진행했고, 별도 편집 흐름은 **48→96px** viewport·scrollMaximum **192**, 실제 외부 controller의 **0↔192**, Enter 줄바꿈·Ctrl+Enter 제출·undo·secure의 password carrier 및 값 유지·**1,100×1,000→560×700** PASS다. 마지막 **document=active=published=210**, 오류 0·close 예약 0/worker 종료다. trusted Core editing packet의 원문과 OS/ARIA 노출 마스킹을 구분한다. 초기 클릭 테스트는 Core clip 밖의 부분 노출 버튼 중심을 눌렀으므로 제품 입력 결함 근거로 쓰지 않는다.
- **검증 공급:** 위 결과는 source **`67a5add4c41cf2a30d674bcd78a755c3a8b925b5c29f7885c6f29282c8aa918a`**, ABI 2 / schema **3345925968** 기준이다. Windows/single-worker/threaded·App SDK·Core/SDK build, 전체 type/lint/format/diff 검사, manifest **355 files** tree/hash·source identity·RNW 6개·원래 834 기준 hash PASS다. Core **13/13**·Source list/Navigator **3/3**·Chip **3/3**·fade **7 cases**·각 memory 0, 새 **8 packages** strict 선언(editor viewport 포함)·Material/Cupertino create·Web/Windows doctor/build **714/715**·pack·폐기 host 거부 PASS다. Gallery **885/886**, Demo **851/852 modules** 시작/close PASS. 실제 Gallery 12-field 흐름은 **Edge isolated**, 마지막 문서 **66** 일치·오류 0/close 0 PASS이며 새 공급의 전체 4-profile 재검증은 아직 아니다.
- **Windows 해당 흐름:** 같은 공급의 일반 CLI/App SDK Demo에서 drawer Selection 진입·ChoiceChip Week의 실제 check/paint 변경을 확인했다. 마지막 문서 **67** 일치·failed/host/preparation 오류·input rejected/canceled **0**, GPU 관측 **66,732,032 bytes**, 전체 memoryPeak **491,229,194**다. Alt+F4 종료 status/예약/메모리 **0**·workers joined/dispatcher closed·소유 창 없음 PASS. 이 실행에서 Range thumb·편집기는 아직 조작하지 않았으며 physical/display/scanout·성능 수락은 아니다.
- **wheel coverage 수정:** 좁은 Demo indexed 목록의 목적지 **450**이 준비 coverage 끝 **2**로 사라지던 scheduler 결함을 수정했다. pointer stream이 없는 wheel도 목적지를 보존해 새 행 준비 뒤 적용하고, 연속 입력·역방향·resize 취소를 처리한다. 후속 공급 **`8b1c44fc25cbd2604506353747d16cc022353f74381514ab74847b6747b08f4e`** / 같은 schema 3345925968·manifest 355/source identity/기준 hash PASS, Core 영향 **13/13**·editor 계약·Range 5 cases와 종료 0 PASS다. 실제 Source indexed/sequential 두 계약에서 **225+225→450→0**, 대기 중 역방향 취소와 올바른 afterInput fence의 resize 취소를 통과했다. Source 박스/목록의 최종 geometry를 앱에서 대신 계산하지 않는다.
- **8b1c 실제 Web matrix:** 같은 Gallery/Demo App bundle을 갱신하고 두 앱 첫 진입/close를 확인했다. Demo의 Filled·drawer·Choice/Filter/ActionChip·한글 입력/Enter submit·**1,100×800→560×700**·dark theme·새 행을 준비하는 wheel·Containment dialog 열기/닫기·Show all은 **Chrome/Edge × plain/isolated 4/4 PASS**, 마지막 문서 **366/344/359/372** 일치·failed/오류 0·close 예약 0/worker 종료다. 상세 편집도 같은 **4/4 PASS**이며 행 높이 **48→96**·max **192**·실제 controller **0↔192**·Enter/Ctrl+Enter·undo·secure·resize와 마지막 문서 **212/197/206/186** 일치·오류/close 0을 확인했다. 이는 해당 실제 흐름의 matrix이며 전체 catalog·물리/scanout/성능 gate는 아니다.
- **8b1c Windows 추가 문제:** 일반 CLI/App SDK에서 Selection 진입 후 wheel이 반복 거부됐고, resize 뒤 첫 새 slider 행 준비에서 transaction **invalidHandle(16)**로 App이 종료됐다. 해당 실행은 **FAIL / 마지막 document 63·active/published 60·input rejected 7**, 준비 실패 0·host/App 오류 1이며 close status/예약/memory 0·workers joined/dispatcher closed·소유 창 없음이다. retired pointer가 공유 stream에 남긴 denied 상태 때문에 새 standalone wheel이 거부되는 원인은 별도 Core 계약으로 **stale(27)** 재현했다. standalone wheel admission과 Windows mouse/precision/wheel stream **1/2/3** 분리를 수정 중이며 invalidHandle의 transaction 참조도 함께 진단한다. **이 새 수정은 위 8b1c PASS에 포함하지 않는다.** native Range 두 thumb·편집기 조작은 아직 미도달이다.


### 3.17 게시 geometry·가변 목록 경합·retained layer 수정 묶음 — 해당 흐름 PASS / PARTIAL

- **retained layer:** Windows의 invalidHandle(16)은 offscreen Source 행에 남아 있는 leader를 실제 scene에 있는 것으로 등록해, 삭제한 Core handle을 follower가 참조한 문제였다. leader/follower 등록을 실제 host의 scene 투영에 맞추고 follower의 참조를 그 투영 뒤 해석한다. Source의 State/cache를 버리거나 Core의 stale-handle 검사를 약화하지 않았다. disposed/dormant leader의 제거·재생성, 두 retained follower의 숨김/표시·재연결 계약 **2개 PASS**, TS layout fallback **0**, 각 close memory **0**이다.
- **게시 좌표 변환:** 원래 RangeSlider의 pointer callback이 `globalToLocal`에서 native geometry 거부에 걸리던 문제를 공통 `RenderObject.getTransformTo`에서 해결했다. 현재 Core가 게시한 transform을 관측하며 동일 owner/snapshot/publication·같은 render tree를 요구한다. 게시 전·새 metrics 관측 후 이전 게시·retired render·다른 snapshot/잘못된 대상 거부와 global/local·ancestor/sibling 변환·singular 대상 결과를 확인했다. TS layout/paint/hit-test 실행으로 대체하지 않는다. `constraints` 등 전체 동기 geometry 계약의 완료는 아니다.
- **휠과 준비 경합:** pointer retirement와 standalone wheel의 상태를 분리하고 Windows mouse/precision/wheel stream을 **1/2/3**으로 나눴다. 목적 구간이 기존 offset을 포함하지 않는 bounded Source 목록도 준비한 wheel 목적지에서 활성화한다. **0→31(준비 대기)→260**의 실제 Source 재현과 indexed/sequential **225+225→450→0**, 역이동·resize 취소 PASS다. 별도 old-publication/retired-pointer fence도 보존했다. 준비가 끝난 직후 숫자 jump가 오면 이전 구간의 실패로 종료하던 경합은, 준비에 사용한 offset과 새 목적지를 비교해 다시 준비하도록 고쳤다. 동일 재현이 이전 공급의 **failedDocument=10 / Native scroll failed(31)**에서 새 공급의 **failedDocument=0 / offset=0 / close memory=0**으로 바뀌었다.
- **Source controller·커서:** 숫자 jump는 Source 목록 세대를 붙여 보내며 stale일 때 새 게시의 목록 identity를 기다린다. 이미 해석한 항목 탐색도 항목 기반 요청임을 보존해 다른 목록에 재시도하지 않는다. 목록 교체 뒤 숫자 jump 계약 PASS다. native EditableText가 원래 Source의 blink timer로 문서를 반복 갱신하지 않도록 했으며, 커서의 표시 시계는 Core에 유지한다. Core/Source idle 확인 근거는 아래 통합 결과에 기록했다.
- **321700e 공급과 설치 검사:** 당시 engine source **`321700e21056e9a375a514c9dc8b9fcc529933e4be89f562b67428422d824f34`**, ABI **2 / schema 3345925968**. native/single-worker/threaded·App SDK build, manifest **355 files** tree/hash·source identity·RNW **6개**·원래 834 기준 hash PASS다. 전체 type/lint/format·schema/diff, Core 영향 **5/5**와 위 경합/좌표/목록 검사 PASS다. 앞 공급 `17319ccf`의 Core **13/13**, Range **5 cases**·editor **22 measurements / 11 probes / 4 malformed**·각 close **0**도 보존하며 최종 공급에서 반복했다고 확대하지 않는다. 새 **8 packages**의 strict TS **7.0.2 / NodeNext / ES2022 / types=[] / skipLibCheck=false**, Material/Cupertino create·doctor·Web/Windows build **714/715 modules**·Web pack·폐기 host 거부 PASS다. 임시 설치본/archive는 finally로 회수했다.
- **실제 Windows 중간 통합:** `17319ccf`의 일반 Demo CLI **852 modules / original-elements**에서 Selection wheel·Range 시작 thumb 드래그 **20→30**·track click으로 끝 값 **80→60**, resize **960×720→1280×729.5**, Text inputs 전환·한글/emoji·Enter 줄바꿈·Ctrl+Enter 로컬 제출·undo·secure 표시를 확인했다. 마지막 **document=active=published=591**, prepare/host 오류 **0**, resize 경계 입력 rejected **4**, close status/예약/memory **0**, memoryPeak **498,759,103**, workers joined/dispatcher closed·소유 창 없음이다. 최신 공급의 추가 확인은 아래에 별도로 기록한다. 물리 IME·UIA reader·scanout·성능 수락으로 확대하지 않는다.
- **321700e 실제 Web 통합:** Demo **851 modules / original-elements**의 Chrome/Edge × plain/isolated에서 Range pointer·좁은 화면 wheel·Text inputs 전환, 상세 editor, 일반 controls/drawer/Chips/theme/resize/dialog 흐름을 확인했다. 고정 대기 뒤 resize publication 전에 wheel을 보내던 검사 경계는 현재 metrics/device의 게시와 문서 활성화를 관측한 뒤 입력하도록 고친다. 이전 공급의 PASS나 일부 profile 성공을 최종 4조합 완료로 쓰지 않는다.
- **321700e 통합 결과와 추가 baseline 수정:** 상세 editor는 **4/4 PASS**(마지막 문서 **176/175/186/183**, **48→96px**, max **192**, controller **0↔192**), 일반 controls/drawer/Chips/theme/resize/dialog도 **4/4 PASS**(문서 **306/320/316/357**)다. Range pointer는 세 조합 PASS와 resize 게시를 먼저 관측하도록 고친 Chrome isolated 재확인 PASS이며, 고정 대기만 쓰던 첫 matrix의 **3/4** 기록을 지우지 않는다. 각 종료 예약 **0**/worker 종료다. Chrome plain의 focused editor는 **1.2초** 동안 문서 **82**를 유지하며 커서가 Source 문서를 갱신하지 않았고, Windows에서도 커서 frame **118→128** 동안 문서 **115**·native command **4947**이 그대로였다. Windows 최신 공급의 wheel·Range 드래그 **20→30**·UIA 끝 값 **80→60**·Text inputs 전환과 UIA 12행 입력은 동작했으나, `Scroll to end` 뒤 부모 입력 상자가 커지는 **제품 실패**를 발견했다. harness의 마지막 문서 **132** 일치·오류 0·close **0**/peak **490,734,969**/worker join·창 회수는 수명 근거이며 이 화면 실패를 PASS로 바꾸지 않는다. Core baseline이 paint scroll **20px**를 따라 **15→-5**가 되는 별도 재현도 실패했다. 원래 RenderEditable의 baseline은 scroll paint와 독립이며 높이 안에 제한되므로 Core도 같은 정책으로 수정했다. 이 마지막 baseline 수정의 최종 공급 결과는 아래에 기록한다.

- **최종 baseline 공급과 제품 확인:** engine source **`5d76573ece6a4e05e9b1535c7ef73b9c4e82300a069cc509bdb062036a6c9ff7`**, 같은 ABI/schema·355-file 공급·출처·834 기준 hash PASS다. native/single-worker/threaded·App SDK build와 전체 type/lint/format·schema/diff 검사, baseline을 보강한 editor **22 measurements / 11 probes / 4 malformed**·close **0**, input/layout geometry 영향 **4/4**·각 close **0**을 확인했다. Demo Web/Windows **851/852 modules**를 갱신했다. 상세 editor는 부모 안의 textbox 위치·높이 유지 assertion을 추가해 **Chrome/Edge × plain/isolated 4/4 PASS**, 마지막 문서 **199/208/200/195** 일치·오류 0·viewport **48→96px / max 192 / controller 0↔192**·Enter/Ctrl+Enter·undo·secure·resize·close 예약 **0**/worker 종료다. Windows 일반 CLI에서도 UIA 12행 입력 뒤 **1–4행→9–12행→1–4행**을 같은 입력 상자 안에서 표시하고 두 scroll 버튼이 계속 보였다. **960×720→1280×729.5** resize 뒤 값·4행 viewport를 보존했다. 마지막 **document=active=published=77**, prepare/host 오류 **0**, resize 경계 입력 rejected **4**, close status/예약/memory **0**·peak **491,020,108**, workers joined/dispatcher closed·소유 창 회수를 확인했다. 321700e의 일반/Range matrix와 설치 선언 근거는 해당 입력 기준으로 유지하며 이 마지막 C++ baseline 변경 뒤 전체 설치·전체 catalog를 반복했다고 쓰지 않는다. Gallery/Testbed의 이전 App bundle과 Android 공급을 이번 최종 source의 검증 결과로 승격하지 않는다. 실행별 임시 자료와 이번 browser profile/server를 회수했으며 §3.6의 자동 승인 거부 3개 경로는 우회 삭제하지 않았다.

### 3.18 RangeSlider 값 표시기·paragraph 연결 — 해당 흐름 PASS / PARTIAL

- **구현:** 원래 RangeSlider의 TS State·Overlay·theme·TextPainter를 유지하고 Rectangular/RoundedRect/Drop/Paddle 값 표시기를 공통 native paint/paragraph placement에 연결했다. 두 thumb의 표시 순서·겹침 stroke·화면 가장자리·RTL·활성화/text scale 정책은 TS가 설정하며, 최종 참조 좌표·경로·글자 변환은 Core가 계산한다. 초기 `alwaysVisible` 설정도 게시 전 TS 크기를 읽지 않는다. Paddle의 목 곡선에는 공통 scalar `cos`를 추가했으며 Material 전용 C++ 컴포넌트나 TS 최종 geometry fallback을 만들지 않았다. 실제 Demo의 RangeLabels도 값 변경과 연결했다. 임의 shape subclass/instance hook의 전체 지원은 미완료다.
- **Source/Core 대응:** 네 원래 painter와 Core의 경로·색·stroke를 기본/좁은 폭·작은/화면보다 긴 라벨·LTR/RTL·겹침·가장자리·활성화 및 text scale 1–3의 **32 cases**로 대조했다. 작은 RRect의 반경은 원래 `scaleRadii()`로 정규화해 실제 renderer와 같은 경계를 비교한다. 측정한 shape 설정은 최대 **247/512 expressions**이며 quota를 늘리지 않았다. `cos`의 폭 변경·반복 instance **6개**, 잘못된 wire **5개**의 원자적 rollback과 encoder arity **2개** 거부, 각 종료 memory **0** PASS다. 기존 Core 영향 회귀도 **13/13 PASS**다.
- **공급·설치:** engine source **`42898fc977e1b31f35cd0020273fc55861525456f9890bd4773f6a01305f2e57`**, ABI **2 / schema 975282906**이다. Windows/single-worker/threaded·App SDK·Core/Material/SDK build, 전체 type/lint/format·schema 생성 검사와 manifest **355 files**의 정확한 tree/hash·source identity·RNW 6개·원래 834 기준 hash PASS다. 독립 **8 packages** strict 선언은 `cos`·editor viewport를 포함해 통과했고, 설치 create/doctor·Web/Windows build **714/715 modules**·pack·폐기 host 거부를 확인했다. Material pack 목록에 새 표시기의 JS/선언과 Range entry가 포함된다. Gallery/Testbed의 이전 App bundle과 Android 공급은 새 schema의 실행 근거가 아니다.
- **실제 Demo Web:** 새 **852 modules / original-elements**에서 **Chrome/Edge × plain/isolated 4/4 PASS**다. 트랙 **20–80→20–60**, thumb drag **30–60**, 두 표시기·실제 글자 픽셀·dismiss 뒤 paragraph 회수, resize 게시 뒤 wheel·Text inputs 전환과 종료 예약 **0**/worker 종료를 확인했다. 표시기 게시 문서는 각각 **88/85/91/85**다. 초기 검사의 고정 대기·layoutSnapshot에 없는 글자 blob 가정과 alpha 합성을 제외한 픽셀 비교는 검증 코드 실패였으며, 게시 fence·실제 paragraph/font·화면과 합성된 픽셀 조건으로 고친 결과다. 이 실패를 제품 수정이나 전체 catalog 수락으로 세지 않는다.
- **네 모양의 실제 글자:** 한 임시 원래 App을 Windows/Web에 공유했다(**717/716 modules**). `alwaysVisible` 첫 게시에서 네 모양과 한글 라벨 **8개**를 확인했고, Web **Chrome plain / Edge isolated 2/2**에서 배경과 글자 픽셀·종료 **0**을 통과했다. Windows GPU 화면에서도 Rectangular/RoundedRect/Drop/Paddle, 양 끝 **0/100** 한글 라벨과 **45/55** 라벨을 확인했다. **960×720→1280×729.5** resize 뒤에도 표시됐고 마지막 **document=active=published=3**, prepare/host 오류 **0**, resize 경계 rejected **4**, close status/예약/memory **0**·peak **481,514,923**·workers joined/dispatcher closed·창 회수 PASS다. 별도 일반 Demo **853 modules**에서도 wheel·트랙 click·thumb drag·마지막 문서 **84** 일치·오류 **0**·close **0**/peak **492,071,656**를 확인했다. 물리 입력·scanout·성능 수락은 아니다.
- **정리 예외:** 설치 소비자·공유 임시 App·정상 종료한 browser/server와 Windows 창은 회수했다. 단, 화면을 관측하려고 입력 대기시킨 진단 helper의 stdin이 닫혀 재개되지 않았고, 자동 승인 검토가 해당 helper/browser 종료 및 임시 화면/profile 삭제를 **`blocked by policy`**로 거부했다. **helper PID 32240 / browser PID 21152**, `%TEMP%/nelyx-w9b-indicator-screen-1JLlzA/screen.png`, `%TEMP%/playwright_chromiumdev_profile-tytH2I`는 남아 있음을 확인했으며 우회 정리하지 않았다. 이 진단 실행을 종료 PASS로 세지 않는다. §3.6의 기존 승인 거부 3개 경로도 그대로다.


### 3.19 Semantics identifier·정렬·custom action과 공통 hit path — 해당 흐름 PASS / PARTIAL

- **Source 소유 설정:** 정규 RenderSemanticsAnnotations/원래 Semantics Widget이 canonical configuration·identifier·방향·OrdinalSortKey·custom action registry ID·hint override를 native metadata로 제공한다. Runtime의 해당 prototype/속성 선별을 Source 모듈로 옮겼다. identifier의 boundary 의미, 같은 action 값의 동일 ID, 일반 action과 hint-only 항목의 구분, blockUserActions를 보존했다. 임의 sort-key subclass·instance 비교 hook·미지원 semantics 속성은 명시 거부한다.
- **Core 게시·동작:** 공통 semantic metadata를 병합하고 최종 게시 geometry로 Source의 overlap sweep·knot walk·LTR/RTL·동률·연속된 동일 이름의 ordinal 그룹 순서를 계산한다. 실제 Source 렌더 파이프라인이 제공한 자식 순서에서 시작하며 paint/hit 순서를 접근성 순서로 바꾸지 않는다. 부모/순번과 custom ID별 원래 callback 출처를 게시한다. custom action은 ID 0을 포함해 publication·세대·descriptor/원래 출처·활성 상태·차단 정책을 검사하고, Source callback과 SemanticsActionEvent.arguments로 전달한다.
- **host·실제 Demo:** Windows AutomationId와 Web data-nelyx-identifier에 Source identifier를 전달한다. Windows UIA navigation은 Core 순서를 소비하며 named custom action을 가상 Invoke peer로 노출한다. 가상 항목은 물리 hit 대상/사각형을 갖지 않는다. Web은 Core 순서의 ARIA ownership·접근성 action 버튼을 사용하며, 반복 focus snapshot이 action의 키보드 focus를 빼앗거나 custom-only 부모가 자식 포인터를 가로채지 않게 했다. Demo Badges의 Inbox에는 메시지 수를 먼저 읽는 ordinal 순서와 실제 상태를 바꾸는 “Mark all messages as read” action·일반 버튼을 연결했다.
- **통합 중 수정한 포인터 문제:** Badge의 큰 defer-to-child 배치 박스가 자식을 맞히지 못했는데도 flat gesture 검색이 스크롤 조상을 먼저 선택했다. listener/mouse/tap region에서 사용하는 공통 Core child-first hit path를 gesture 대상 선택에도 사용하고, numeric route·InputPadding의 projection을 보존했다. 수정 전 공급의 실패를 재현한 뒤 실제 Source hit와 Core의 뒤쪽 버튼 선택/Badge 자체 hit 차단을 대조해 PASS했다. JS 최종 hit-test fallback이나 Badge 전용 C++ 분기를 만들지 않았다.

| 검증 | 이번 공급의 근거와 경계 |
| --- | --- |
| Source/Core semantics | 정렬·방향 상속/재정의·변환·작은 rect·동률/이름/빈 key 그룹 **16개**, identifier 경계·custom 충돌/강제 병합/원래 callback·hint 우선순위·action 차단 **7개**, 합계 **23 cases PASS**. callback 출처·ID 0·알 수 없는 ID·이전 publication·게시 전 descriptor 변경 거부, close memory **0** |
| Wire·영향 회귀 | malformed metadata **13개**를 command/decoder 각각 거부하고 원자적 rollback, traversal 변조 **6개**, encoder 입력 **4개** 거부 PASS. 기존 Core **13/13**, 게시 global/local/sibling/ancestor 좌표와 관측 fence, 네 Range 표시기 **32 cases**, 새 Badge hit 비교 PASS. 각 session close **0** |
| 공급·설치 | source **7392b5eb26f7e555167679028ba8160064830bf1a4ca5626e077417c84a22a0d**, ABI **2 / schema 3519614002**, semantics header **120 bytes**. Windows/single-worker/threaded·App SDK 및 변경 Core/SDK build, 전체 type/lint/format·schema·diff 검사 PASS. manifest **355 files**의 정확한 tree/hash·source identity·RNW 6개·원래 **4 packages / 834 subpaths** 기준 hash 불변. 최신 **8 packages** 설치 strict 선언에 새 semantics metadata를 포함했고 create/doctor·Web/Windows **716/717 modules** build·pack·폐기 host 거부 PASS. 설치본 native run은 미실행 |
| 실제 Demo Web | **854 modules / original-elements**, **Chrome/Edge × plain/isolated 4/4 PASS**. 실제 browser AX tree의 identifier/읽기 순서·named action, Enter/Space **9→0**, 일반 Badge 버튼 **0→1**, 제거한 옛 action 버튼의 무효화, **1100×900** resize 후 **1→0**, 오류 없음·종료 예약 **0**/workers stopped. 최종 publication **89/90/78/71** |
| 포인터 직접 영향 회귀 | 같은 Demo의 Range 트랙 **20–80→20–60**, drag **30–60**, 실제 표시기 glyph·dismiss 회수·resize/wheel·Text inputs 전환을 전체 **4조합 PASS**. 게시 표시기 문서 **79/83/83/81**, threaded Chrome 재검증 **92**. 초기 threaded Chrome 검사는 900/800ms 뒤 pending 문서를 읽어 실패했다. 다음 publication의 실제 회수를 관측하고 dismiss·wheel의 준비/게시 fence로 해당 조합을 다시 확인했다 |
| Windows 실제 창 | **855 modules / original-elements**, UIA Source ID·count→add→read 순서·가상 action의 노출/제거/재노출, 실제 마우스 **9→10→0**, **960×720→1280×729.5** resize와 **0→1** PASS. 마지막 **document=active=published=38**, prepare/host 오류 **0**, resize 경계 rejected **4**. close status/예약/memory **0**, peak **504,194,772**, workers joined·dispatcher closed·창 회수 PASS. 도구의 coordinate click은 빈 사각형의 가상 action을 Invoke하지 못하므로 **외부 UIA Invoke·reader 음성은 notVerified** |

**남은 범위:** 이 결과는 canonical Source 경로의 해당 흐름이다. arbitrary SemanticsSortKey/child delegate·traversal parent/child identifier·전체 semantics 역할/OS feature ingress·focus/range listener, Windows 외부 UIA Invoke/reader 및 RNW 실제 소스 이식은 남아 있다. 전체 catalog·W9-13/14·물리 장치 입력·display/scanout·성능 수락으로 확대하지 않는다. 전체 **compatible=false**, 두 성능 flag **false**, Android **stale/notVerified**, Linux·iOS/macOS **DEFERRED**를 유지한다.

**정리:** 이번 browser/server·설치 소비자·Windows 창은 회수했다. §3.18의 자동 승인 거부 helper **32240**/browser **21152**와 해당 임시 화면/profile은 아직 남아 있으며 종료/삭제를 재시도하지 않았다. §3.6의 승인 거부 3개 경로도 유지한다.



### 3.20 RNW key/code·Source 키 identity와 의미/DOM 병합 — 해당 흐름 PASS / PARTIAL

- **실제 RNW 소비자:** 보관한 KeyboardUtils의 key/code table과 InputKeyboardSource modifier/lock query를 Windows canonical key ingress → Core → 원래 Focus/HardwareKeyboard에 연결했다. WM_KEY scan/extended 값으로 일반 modifier의 좌우를 down/up 모두 해석하고, NumLock과 독립적인 keypad 위치·Numpad Enter·location을 보존한다. Source에 맞게 keypad 연산 label과 ContextMenu/PrintScreen table의 빈 부분을 보완했다. RNW 수정 SHA·출처·공급 API inventory도 갱신했다. 비정규 숫자 shortcut 소비자와 RNW의 layout별 VK label 한계는 별도 범위다.
- **공통 전송·경계:** 기존 숫자 24/32-byte key 형식과 clipboard snapshot을 유지하고 선택적인 48-byte header·각각 최대 64-byte UTF-8 key/code·location 및 event-index/owner를 검사하는 blob 34를 추가했다. Event wire는 160 bytes를 유지하고 보유한 identity 메모리는 Core event 장부에 포함한다. 원래 App은 새 identity가 있으면 추측한 숫자 대응 대신 이를 사용하고 미식별 RNW label에만 기존 호환 대응을 쓴다. Web은 실제 DOM identity를 전달한다. Resize 중 snapshot 조회와 key 제출 사이 metrics가 바뀌는 경합은 Core stale로 거부한다. Web은 준비되지 않은 geometry/focus를 거부하고, 같은 문서·session·metrics·device에서만 제한적으로 재시도하며 정상 경합을 App 오류로 올리지 않는다.
- **의미 문자열:** Core label/hint 병합을 Source concat의 방향 채택·LTR/RTL embedding·빈 문자열 규칙에 맞췄다. 일반 config 흡수와 boundary를 가진 강제 병합의 차이, wrapper UTF-8 bytes 상한을 보존했다. 임의 TS layout/geometry 실행을 추가하지 않았다.
- **Demo·통합 중 발견한 DOM 문제:** Text inputs → Test keyboard는 실제 Source Focus 콜백의 down/up/repeat·key·physical key를 보여 준다. 입력 FocusNode를 버튼 자체에 부착해 DOM이 focus하는 대상과 callback 소유자를 맞췄다. 별도 부모 Focus를 요청하던 중간 예제에서 Edge/plain은 버튼 focus만 남았으므로 그 경합을 전체 Focus 해결로 세지 않는다. Web의 새 부모 semantic peer가 자식 geometry 뒤에 append되어 textarea 위를 덮는 문제를 elementsFromPoint·Core 게시 좌표로 재현했다. 부모 자신의 peer를 자식 carrier 앞에 배치하여 자식이 위에 오도록 수정했다. 실제 마우스의 editor 전환과 입력/선택/삭제를 대조했으며 DOM focus만 강제로 주는 우회로 PASS시키지 않았다.

| 검증 | 이번 공급의 근거와 경계 |
| --- | --- |
| Core·Source | identity **11개**, legacy/새 clipboard **4개**, 잘못된 ingress **15개**·indexed response 변조 **7개**·encoder **6개**, 이전 publication·미게시 metrics·unfocused 거부 PASS. 기존 Core **13/13**, 방향이 섞인 label/hint·nested/identifier boundary·빈 label **6개**를 더한 Source/Core semantics **29 cases PASS**. 각 session close memory **0** |
| RNW C++ | 실제 수정 KeyboardUtils.cpp를 App SDK **1.8.260508005**·MSVC **/W4 /WX**로 별도 최소 실행에 컴파일해 **27 cases PASS**. Shift/Caps 조합·명시적/일반 modifier·keyup 상태와 독립적인 좌우·Numpad Enter·NumLock off 위치·navigation·연산·unknown을 대조했다. 제공한 scan/extended 값의 변환 검사이며 물리 키 입력 증거는 아니다. 임시 project는 finally 회수 |
| 공급·설치 | source **95c74477abc15d51002d4a3c7aac3dc27f486f9051c86f841b40f45e882e1c0b**, ABI **2 / schema 2115239553**, Windows/single-worker/threaded·App SDK와 변경 Core/SDK build PASS. manifest **355 files**의 정확한 tree/hash·source identity·RNW **6개**·원래 **4 packages / 834 subpaths** hash 불변. 전체 type/lint/format·schema·diff PASS. 최종 **8 packages** 설치 strict 선언의 새 key identity·create/doctor·Web/Windows **717/718 modules** build·pack·폐기 host 거부 PASS. 설치본 native run은 미실행 |
| 실제 Demo Web | **855 modules / original-elements**, **Chrome/Edge × plain/isolated 4/4 PASS**. Source modifier 좌우·Shift+A·repeat·Numpad Enter·resize 뒤 입력, 실제 mouse로 textarea focus·emoji 입력·Ctrl+A·Backspace, browser AX 순서·custom Enter/Space·retired action·Badge click을 확인했다. 각 조합 Source 표시 **15회**, 최종 publication **206/203/243/187**, 오류 없음·종료 예약 **0**/workers stopped. 초기 검사의 drawer 누락과 고정 대기로 인한 publication 선행 관측을 수정했으며, 실제 Core resize 경합과 DOM 부모 덮음은 위 구현에서 수정했다 |
| DOM 순서 직접 영향 | Range의 실제 track **20–80→20–60**, drag **30–60**, 두 glyph·dismiss 회수·resize/wheel·Text inputs 전환 **4/4 PASS**. 표시기 게시 문서 **75/84/80/80**, 각 close **0**/workers stopped. 이 흐름을 전체 catalog/성능 수락으로 세지 않는다 |
| 최종 Windows 실제 창 | **856 modules / original-elements**, 오른쪽 Control의 Source 표시와 maximize resize 뒤 왼쪽 Control 복구, 실제 editor 전환·Ctrl+A·문자 입력 **Native edit**를 확인했다. 종료 직전 전달 key **12**·key 거부 **0**. 마지막 **document=active=published=73**, failed/host/preparation 오류 **0**, resize 경계 일반 입력 rejected **4**, close status/예약/memory **0**, peak **490,067,104**, workers joined·dispatcher closed·창 회수 PASS. 중간 실행의 Sky Shift_R/KP_Enter 호출의 마지막 Source 표시는 Shift Left/일반 Enter였으며 실제 수집 scan/extended를 관측하지 않았으므로 Windows 해당 물리 키 수락은 **notVerified** |

**남은 범위:** RNW table의 연결을 전체 Windows keyboard/IME/pressing-state 이식으로 세지 않는다. 국제 layout·shifted OEM·dead key·물리 Shift Right/Numpad Enter, 별도 부모 Focus 요청과 DOM focus의 경합·descendant 키 전달, pointer/capture/focus·IME/UIA/provider/settings와 기타 OS service source port, arbitrary semantics sort/child delegate·traversal 식별자·외부 UIA Invoke/reader, editor custom physics/animate/동기 geometry와 전체 catalog는 남는다. 전체 **compatible=false**, 물리/display/scanout **notVerified**, 두 성능 flag **false**, Android **stale/notVerified**, Linux·iOS/macOS **DEFERRED**를 유지한다.

**정리:** 이번 browser/server·설치본·RNW 임시 project·Windows 창은 finally/정상 close로 회수했다. 자동 승인 검토가 “blocked by policy”로 거부한 기존 helper **32240**/browser **21152**와 임시 화면/profile, §3.6의 3개 경로는 종료/삭제를 재시도하지 않고 유지한다.


### 3.21 부모 Focus 요청·DOM 입력 순서·게시 geometry — 해당 흐름 PASS / PARTIAL

- **두 경합 재현과 수정:** 별도 부모 Focus 아래 버튼의 callback에서 부모를 요청해도 자식이 primary로 남는 원형을 재현했다. App의 focus/key만 큐에 보관하고 pointer/gesture/action은 먼저 실행하던 순서를 통합했다. 이어 GlobalKey 자식이 있는 Chrome 원형에서 DOM focus가 pointer tap 뒤에 Core에 도착하는 두 번째 경합을 확인했다. Web pointer packet도 DOM focus/key·App 명령과 같은 UI 큐에 넣어 수집 순서를 보존했다. UI 큐는 Core 응답만 기다리며 Source callback 실행을 기다리지 않는다.
- **Source 수명·취소:** App 큐는 기존 64개 상한을 유지하고 native focus가 파생시키는 Source/editor 통지를 FIFO로 다음 입력 앞에 처리한다. 각 Source 요청은 입력 당시 native session을 캡처한다. 해제 통지의 이전 id를 현재 session으로 사용하지 않고 0으로 바꾸며, 더 새로운 native focus·요청 교체·unbind·세대 교체·close가 이전 요청을 취소한다. 실제 Core 요청 직전에 새 semantics snapshot과 목표 identity를 확인하고 exact session으로 제출한다. 지연된 입력 callback은 같은 SceneReference/세대의 현재 소유자에게 전달한다. Callback 하나가 실패해도 뒤의 key snapshot을 회수하며 close 중의 남은 key는 실행하지 않고 해제한다.
- **Geometry·traversal:** Focus rect의 대각선 두 점 계산을 제거하고 Core가 게시한 bounds를 소비한다. Source traversal은 그대로 유지한다. Semantics 조회와 input poll 사이 compositor publication이 바뀌어 key 관측이 어긋나면 일관된 snapshot을 새로 조회한 뒤 전달한다. 미게시 metrics는 다음 publication까지 보류하고 즉시 재조회 loop를 만들지 않는다. 이는 모든 custom 동기 geometry API를 구현한 것이 아니다.
- **실제 소비자:** Demo → Text inputs → Test keyboard를 별도 부모 Focus가 요청을 받고 descendant key도 받는 형태로 바꿨다. §3.20의 버튼 자체 Focus 우회 상태와 부모 요청 잔여 항목은 이 차수의 해당 흐름으로 대체한다. TS Widget/State와 Source focus policy를 유지하며 C++ component나 TS 최종 layout/hit fallback을 추가하지 않았다. Core·SDK README의 입력 큐와 관측 경계도 갱신했다.

| 검증 | 이번 구현의 근거와 경계 |
| --- | --- |
| App focus 계약 | 실제 Source FocusManager와 제어 가능한 View adapter로 **18 cases PASS**. 입력 순서·새 native session 취소·요청 교체·목표 제거/세대 교체·close·미게시 metrics·중첩 editor FIFO·callback 예외 뒤 snapshot 해제·surface focus loss·publication drift 강제·조회 중 close/새 publication을 확인했다. 실제 OS 입력이나 Core 실행의 대체 근거로 세지 않는다 |
| Source/Core geometry | 실제 single-worker Core와 OriginalWidgetHost에서 identity·mirror X·90/45도 회전·skew·두 축 음수 배율 **6 cases PASS**, resize 중 관측 거부·복구와 제거 후 거부 PASS. Core 최종 bounds/offset과 원래 FocusNode 결과를 대조했으며 close memory **0**. 초기 검사 설정의 platform 인자와 제거 후 오류 문자열 기대값을 바로잡았다 |
| Focus 원형 Web | **729 modules / original-elements**, **Chrome/Edge × plain/isolated 4/4 PASS**. 실제 mouse의 부모 요청과 Core focus owner, 부모/자식 down/up 전파와 child handled 중단, GlobalKey 이동 뒤 State/native handle 보존·새 부모 route, resize·Tab·canRequestFocus false/true·제거/재부착·연속 요청을 확인했다. 최종 document **215/220/218/204**, 오류 없음·각 close 예약 **0**/workers stopped. 중간 Edge/isolated Tab 오류를 새 publication 조회와 강제 경계 검사로 보강한 뒤 전체 matrix를 다시 확인했다 |
| 실제 Demo Web | **855 modules**, 부모 Focus를 사용한 최종 Demo **4/4 PASS**. 조합마다 Source key 표시 **15회**, modifier 좌우·Shift+A·repeat·Numpad Enter·resize 뒤 입력, 실제 mouse의 editor 전환·emoji 입력·선택/삭제, AX 순서·custom Enter/Space·retired action·Badge click을 확인했다. 최종 publication **243/221/233/221**, 오류 없음·각 close 예약 **0**/workers stopped |
| Pointer 큐 영향 | 실제 Demo Range track **20–80→20–60**, drag **30–60**, 두 label glyph·dismiss 회수·resize/wheel·Text inputs 전환 **4/4 PASS**. 표시기 게시 document **90/85/84/86**, 각 close 예약 **0**/workers stopped. 기존 Core 회귀 **13/13 PASS**, 각 session memory **0** |
| 공급·설치 | Core/SDK build·전체 type/lint/format·schema/diff PASS. 실제 provider graph의 source **95c74477abc15d51002d4a3c7aac3dc27f486f9051c86f841b40f45e882e1c0b**, ABI **2 / schema 2115239553**, manifest **355 files** tree/hash·RNW **6개**와 원래 **4 packages / 834 subpaths** baseline은 불변이다. 이번 변경은 App/Core/SDK bundle 범위여서 native/Wasm 공급을 다시 빌드하지 않았다. 최종 **8 packages** 설치 strict 선언·create/doctor·Web/Windows **717/718 modules** build·pack·폐기 host 거부 PASS. 설치본 native run은 미실행 |
| 최종 Windows 실제 창 | CLI build/run의 **856 modules / original-elements**. Sky 입력으로 부모 Focus 요청 뒤 오른쪽 Control, maximize 뒤 왼쪽 Control, Tab 전환 뒤 자식의 c → 부모 Source 표시, 실제 editor click·Ctrl+A·입력 **Focus edit**를 확인했다. 마지막 **document=active=published=86**, failed/host/preparation 오류 **0**, key admitted **16**·key stale/rejected **0**·resize 경계 일반 입력 rejected **4**. Close status/예약/memory **0**, peak **500,275,714**, workers joined·dispatcher closed·창 회수 PASS. 수동 물리 장치·scanout·성능 수락은 아니다 |

**남은 범위:** 이 부모/자식 원형과 queue 계약을 전체 keyboard/focus/IME 수락으로 확대하지 않는다. 임의 custom geometry·모든 traversal/재진입/복구 조합, RNW layout별 shifted OEM·dead key·물리 Shift Right/Numpad Enter, pointer/capture·IME/UIA/settings와 OS service source port, arbitrary semantics sort/child delegate·traversal 식별자·외부 UIA Invoke/reader, Range custom shape·상태/수명 및 editor custom physics/animate/동기 geometry와 전체 catalog는 남는다. 전체 **compatible=false**, 물리/display/scanout **notVerified**, 두 성능 flag **false**, Android **stale/notVerified**, Linux·iOS/macOS **DEFERRED**를 유지한다.

**정리:** 이번 원형 임시 app·browser/server/profile·설치 소비자·Windows 창은 finally/정상 close로 회수했다. 자동 승인 검토가 “blocked by policy”로 거부한 기존 helper **32240**/browser **21152**와 임시 화면/profile, §3.6의 3개 경로는 종료/삭제를 재시도하지 않고 유지한다.


### 3.22 Range 선언 확장·editor 곡선 animation — PAUSED / PARTIAL, 구현 중·검증 대기

**중간 마무리:** 사용자 요청으로 새 구현과 장시간 build/run을 중단했다. 아래 변경은 working tree에 보존한다. §3.21의 PASS는 당시 공급의 근거이며 **이번 미검증 소스의 PASS가 아니다**. 전체 W9B 목표의 범위는 유지하고 재개 요청 전에는 자동으로 진행하지 않는다.

- **Range 초안:** `range-native-shape.ts`와 기존 `slider-shapes` export에 exact custom prototype별 track·thumb·tick·overlay·indicator 선언 reader를 추가했다. Track rect·thumb 배치·paint·indicator label 배치를 Core expression으로 전달하며 등록하지 않은 subclass는 계속 거부한다. Indicator는 paragraph resource와 overlap/horizontal-shift 선언을 받는다. 이는 기존 임의 Canvas/getPreferredRect callback을 자동 이식한 것이 아니며 새 명시 extension 계약의 검토·문서화가 남아 있다.
- **Source 정책 공유:** `range-paint-policy.ts`에 pressed thumb size/track gap 계산을 모아 원래 TS painter와 native 설정이 같이 소비하게 했다. Custom track의 enabled/discrete rect와 centers rect를 구분하고 native layout scalar 연결을 작성했다. Custom tick은 순서를 보존해 개별 설정을 내보내며 현재 divisions 127 초과를 거부한다. 실제 custom shape 소비자·Source/Core 대조·상태 교체·제거·label 수명 검증은 아직 없다.
- **곡선·editor animation 초안:** Source `curves.ts`에 native 데이터와 exact custom Curve reader를, `scroll-curve.ts`에 최대 **32 nodes / depth 16**의 캡처·전송을 추가했다. Core `input/curve.hpp`는 cubic·split·interval·flipped·threshold·sawtooth·decelerate·bounce·elastic 데이터 평가와 wire 검사를 작성했다. 기존 56-byte scroll body도 유지하며 선택적 curve tail을 추가했다. Curve/명령 보유 메모리 예약도 View에 포함했다. Source controller와 client를 연결하고 duration 상한 **60s**·timeout 최대 **62s**를 선언했다. Editor duration=0 제한을 제거하고 중간 offset 일치만으로 animation이 조기 종료되지 않게 수정했다. **C++ compile·수치/수명·제품 실행은 전부 미검증**이다.
- **미착수·미연결:** Editor custom physics/scrollBehavior의 거부는 그대로다. Demo의 custom Range/curved editor animation UI와 소비자를 아직 연결하지 않았다. 모든 custom delegate·동기 geometry·arbitrary Curve/shape callback 호환을 해결한 것으로 세지 않는다. Runtime request/terminal·입력 취소·text/extent/resize·controller 교체·hide/close 경계도 재개 후 확인해야 한다.

| 현재 확인 | 정확한 상태 |
| --- | --- |
| Material 타입 | Range 선언 경로 추가 직후 `npm.cmd run check --workspace @nelyx/material` PASS. 그 뒤 indicator reader·공유 painter policy 수정 후에는 재실행하지 않았다 |
| Core 타입 | `npm.cmd run check --workspace @nelyx/core` **FAIL**. Source 단계 뒤 runtime 단계가 이전 dist의 `curves` 선언을 읽어 새 `nativeCurveConfiguration` / `NativeCurveConfiguration` export를 찾지 못했고 파생 TS7053도 발생했다. Staged Core build가 새 선언을 대상으로 runtime을 검사하도록 구성된 것은 소스에서 확인했지만 **build:core는 실행하지 않았다** |
| 짧은 마무리 검사 | 변경 TS **11 files format check PASS**, `generate-schema.mjs --check` PASS, `git diff --check` PASS. 전체 lint/type·native/Wasm compile·설치·browser/Windows run은 이번 초안에서 미실행 |
| 공급 불일치 | 현재 source **2dbcec2cd97c85fa7652a9f84f2ce19b896999319f652c712ed9cbb8fb1f504e / schema 905102333**. 기존 engine dist는 **95c74477abc15d51002d4a3c7aac3dc27f486f9051c86f841b40f45e882e1c0b / schema 2115239553**이다. Core/Material/SDK dist도 이번 변경으로 갱신하지 않았다. 현재 소스를 기존 공급으로 실행한 결과를 새 검증으로 세면 안 된다 |
| 실행·정리 | 이번 차수에 새 browser/server·설치 소비자·Native 창·장시간 build/test를 시작하지 않았다. 진행 중인 이번 소유 작업은 없고 새 검증 임시 출력도 없다. 기존 승인 거부 helper **32240**/browser **21152**, 임시 화면/profile과 §3.6의 3개 경로는 재시도하지 않았다 |

**정확한 재개 순서:** 먼저 `npm.cmd run build:core`로 새 Source 선언과 runtime의 실제 compile 결과를 확인하고 오류를 고친다. 이어 Range extension의 계약·실제 custom 소비자와 editor animation 소비자를 연결한다. Source/Curve 데이터 캡처·기존 56-byte 호환·malformed/depth/budget·수치 일치, editor 중간/최종 offset·cancel/supersede/timeout·text 축소/resize·controller 교체/close를 묶어서 작성한다. 구현을 모은 뒤 Core/Material/SDK build와 `npm.cmd run build:engine-v2`를 실행하고 새 manifest source/schema/tree/hash를 확인한다. 같은 공급으로 설치 소비·Web 두 profile과 실제 Windows 흐름을 검증한다. §3.21 Focus/입력 큐와 Range 기존 흐름은 직접 영향 회귀로 포함한다. 작은 수정마다 전체 설치·공급 행렬을 반복하지 않는다.

**보존하는 판정:** **PAUSED / PARTIAL / compatible=false**. 물리/display/scanout **notVerified**, 두 성능 flag **false**, Android **stale/notVerified**, Linux·iOS/macOS **DEFERRED**다.


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

## 7. 종료 전 재개 명령과 기록 원칙

이 절의 명령은 종료 당시 실행 절차의 보존 기록이다. 현재 재개는 [work9-c §7](work9-c.md#7-재개-명령과-기록정리-규칙)을 따른다.

**재개 직후에는 현재 diff·§3.6–3.20의 진행 지점을 읽고 §4.3의 구현/통합 수정 묶음을 이어간다.** 아래 명령 목록을 재개·기능 추가·수정 시도마다 전부 실행하지 않는다. §3.5는 과거 완료 공급의 기록이며, 추가 변경은 해당 묶음의 새 공급 확인 전까지 **검증 대기 / notVerified**다.

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

Windows root 진입점 `npm.cmd run run:engine-v2:windows`와 Web `npm.cmd run run:engine-v2:web`는 원래 Gallery를 준비·실행한다. Demo는 `sample/nelyx-demo-app/engine-v2`를 일반 CLI의 `--app`으로 지정한다. 별도 Windows host 선택 명령은 제거했다. Android 일반 명령 `npm.cmd run run:engine-v2:android -- --device=emulator-5554`는 해당 차수의 App entry·serial·SDK/JDK·ABI를 확인해 사용한다.

- 저장소 지침의 테스트별 **20분 timeout**·보통 **30회 이내** 반복 제한을 적용한다. 30회는 채울 목표가 아니며, 통합 검증 후에는 변경이 무효화한 검사와 실제 실패를 해결하는 범위만 다시 확인한다.
- 폐기한 독립 `test:*`·`audit:*`·`experiment:*`·측정 harness를 선행 작업으로 복원하지 않는다. 의미 비교·malformed wire 등 필요한 확인은 한 실행의 임시 묶음과 실제 제품 흐름에서 수행한다.
- 현재 dist·실제 build cache·supplier만 남긴다. 검증 로그·immutable receipt·checkpoint/history JSON·이전 dist/staging/archive·독립 설치본·browser profile을 누적하지 않는다.
- 임시 App·archive·설치본·browser/server·listener·native 창은 실행별 최소 범위로 사용하고 성공/실패/중단 모두 `finally`에서 회수한다. 삭제 전 절대 경로와 소유 범위를 확인한다.
- 구현 중에는 연결한 범위와 통합 검증에 남긴 항목만 간단히 갱신하고, 미실행 구현을 완료로 기록하지 않는다. 통합 검증·수정 묶음 종료 시 이 문서에 완료 범위·남은 문제/차단·실행 명령·미실행 대상·현재 공급 상태·다음 시작점만 갱신한다. 이전 PASS 수치를 새 Source의 근거로 복사하지 않는다.

## 8. 종료 체크리스트와 후속 이관

아래 미완료 의무는 [work9-c.md](work9-c.md)에 모두 이관했다. 체크박스와 기존 PASS는 이 문서 종료 당시의 판정을 유지한다.

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

**종료 상태:** **CLOSED / 후속 문서 이관 · 구현 PAUSED / PARTIAL**. W9B-00/00-H 완료, W9B-01–05/06은 미완료이며 §3.21까지의 당시 공급 PASS와 §3.22의 미검증 초안을 구분한다. 종료 시 Source와 Core/Material/SDK/engine dist가 일치하지 않고 Core runtime 타입 검사는 새 선언 미공급으로 실패했다. 전체 API **compatible=false**, 물리/display/scanout **notVerified**, 두 성능 flag **false**, Android **stale/notVerified**, Linux·iOS/macOS **DEFERRED**를 유지한다.

**후속 시작점:** [work9-c W9C-00](work9-c.md#31-w9c-00--첫-재개-구현-묶음)에서 §3.22 미검증 초안의 실제 compile과 소비자 연결을 이어간다. 첫 제품 빌드는 `npm.cmd run build:core`다. Range/editor 외 custom physics·전체 delegate/동기 geometry·semantics·RNW/OS 서비스·전체 catalog·플랫폼별 수락·마지막 소비자 삭제 의무도 후속 문서에 보존한다.

**후속 재개 요청:** `work9-c.md의 W9C-00부터 남은 Windows/Web 구현을 묶어서 진행하고 W9C-06 통합 검증 후 나온 문제를 수정해줘`
