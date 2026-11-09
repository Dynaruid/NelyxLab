# work9-c — v2 잔여 구현·통합 검증·제품 전환

작성·갱신: **2026-11-09 KST** · 문서 상태: **OPEN / W9C-00 구조 병목 수정·Windows/Web 부분 검증·물리 체감 재확인 대기** · 전체 판정: **PARTIAL**

이 문서는 사용자 요청으로 종료한 [work9-b.md](work9-b.md)의 **남은 작업과 정확한 재개 절차를 이어받는 실행 계약**이다. W9B-00·00-H의 완료와 §3.6–3.21의 부분 검증 기록은 이전 문서에 보존한다. §2는 문서 이관 당시의 미검증 상태이며, 이번 W9C-00 구현·공급·실행 결과는 §3.1.1에 기록한다. W9C-01은 시작하지 않았다.

**실행 방식:** **W9C-00–05의 챕터 하나를 단위로 전체 구현·소비자 연결 → W9C-06 통합 검증 → 문제 일괄 수정 → 영향 범위 재검증 → 다음 챕터**로 진행한다. W9C-06은 각 챕터 끝에서 적용하는 공통 절차다. 기능·파일·작은 수정마다 전체 빌드·설치·플랫폼 실행을 반복하지 않는다. Windows/Web부터 진행하고 Android와 후속 플랫폼은 해당 차수에서 같은 방식을 적용한다.

[전체 work9 목차](work9.md) · [직전 구현·검증·종료 기록](work9-b.md) · [원래 구조 계약](work9-a.md) · [API·디자인·입력 계약](work9-2.md) · [기술·제품 수락 기준](work9-3.md) · [Android·Linux](work9-4.md) · [후속 iOS·macOS](work9-5.md)

## 1. 이어받는 목표와 변경하지 않는 경계

- **단일 frontend:** 원래 Widget/Element/State/BuildContext/Key와 클래스 정체성을 사용한다. BuildOwner가 native 설정을 SceneWriter에 직접 전달하며 두 번째 Widget tree·adapter 전용 State를 만들지 않는다.
- **실행 소유권:** TypeScript는 구성·State·theme·controller·callback·명령 기록을, 공통 C++ Core는 최종 layout·geometry·hit-test·gesture·편집 document·scene·자원 권한을 맡는다. Host는 surface·clock·입력 carrier·IME·clipboard·접근성·종료를 맡는다. TS/RN renderer로 자동 fallback하지 않는다.
- **디자인 소유권:** `packages/material`·`packages/cupertino`의 원래 TypeScript 컴포넌트와 기본 정책을 유지한다. C++ 컴포넌트 사본·축소 theme/painter를 원래 구현의 대체 완료로 세지 않는다.
- **원래 API:** [public-api.json](Nelyx/engine/schema/public-api.json)의 **4 packages / 834 subpaths**와 원래 서명 hash를 보존한다. 미지원 export 삭제·분모 재작성으로 호환 완료를 만들지 않는다. 동기 geometry·custom layout/paint/hit-test·React component·직접 Renderer 주입 API는 대체 또는 명시적 계약 변경까지 대응시킨다. App 로컬 C++/Wasm paragraph 질의를 유지한다.
- **수락 경계:** W9-13 기술 완료와 W9-14 물리 입력·표시·성능·기본값 전환을 대상/profile별로 판정한다. 현재 **compatible=false**, **performanceAccepted=false**, **resizePerformanceAccepted=false**, 물리/display/scanout **notVerified**, Android **stale/notVerified**, Linux·iOS/macOS **DEFERRED**다.
- **전환 순서:** 대체 구현 → 실제 소비자 이관 → 제품 확인 → 구 실행부·설정 삭제를 따른다. W9-00–14·W9A-00–12·W9B의 원래 미완료 의무는 유지한다. W9C 번호는 남은 책임과 실행 묶음의 대응이며 이전 미완료를 완료로 바꾸는 재번호가 아니다.

### 1.1 Host와 플랫폼 API 소스 이식 계약

| 대상 | 채택 host | 실제 가져와 수정·사용할 플랫폼 API 소스 |
| --- | --- | --- |
| Windows | **Windows App SDK + C++/WinRT 단일 host** | **RNW**의 입력·IME·focus/capture·UIA·clipboard·환경/설정·lifecycle/service |
| Android | Activity/View·JNI + 공통 C++ engine | **RN Android**의 Context/Activity/view·입력·접근성·서비스·수명 |
| iOS | UIKit·Objective-C++ + 공통 C++ engine | **RN iOS**의 입력·keyboard·접근성·서비스·scene/lifecycle |
| macOS | AppKit·Objective-C++ + 공통 C++ engine | **RNM**의 AppKit 플랫폼 API. RNW를 macOS 원본으로 사용하지 않음 |
| Linux | GTK4 + 공통 C++ engine | **RNL**의 GTK 입력·IME·접근성·서비스·window/lifecycle을 GTK4에 맞게 수정 |
| Web | 기존 DOM·Worker·CanvasKit host | single-worker/threaded 유지. Native 소스 이식 때문에 Web 구조를 바꾸지 않음 |

각 API를 `upstream 원본 → 가져온 파일/함수 → Nelyx 수정 → 기존 소비자 교체 → 일반 앱 확인`으로 대응시킨다. [native-api-ports.md](Nelyx/engine/platform/native-api-ports.md)의 원본·소비자·부족 범위와 함께 repository·tag/commit/package integrity·원본/수정 hash·license/notice·필수 dependency를 관리한다. ReactContext/React tag·Fabric/TurboModule/bridge callback은 owned view/dispatcher·값/handle·Core port로 수정한다. React renderer/Yoga·별도 VM/scheduler를 추가 실행 권위로 넣지 않는다.

기능 목록·회귀 사례 참고나 기존 자체 구현의 동작만으로 실제 소스 이식 의무를 생략하지 않는다. Upstream에 없거나 분리할 수 없는 API는 구체적인 부족 범위·필요 연결 코드·남은 동작을 기록한다. Nelyx 전용 wire/세대·Core geometry·toolkit 연결은 작성할 수 있다. 독립 `windows-hwnd` executable/target/profile은 W9B-00-H에서 제거했으며 App SDK 내부 HWND interop과 공통 Core/provider는 유지한다.

## 2. 종료 시점에서 이어받는 구현·공급 상태

### 2.1 완료 기록과 미검증 소스의 구분

| 범위 | 이어받는 상태와 근거 | 남은 의무 |
| --- | --- | --- |
| W9B-00·00-H | 당시 mouse/Wrap/Flex/Stack·공급·설치·Gallery 확인, App SDK 단일 host·독립 HWND 제거·RNW clipboard 첫 이식 완료. 상세는 [이전 §3.1–3.5](work9-b.md#31-구현-검토와-보완) | 전체 플랫폼 API 이식·전체 API·제품 전환 완료는 아님 |
| W9B-01–05/06 부분 진행 | PointerListener·Tooltip/overlay·공통 layout/paint·목록/Ink·InputDecoration·Chip·paragraph fade·Range/표시기·editor viewport·게시 geometry·semantics/key identity·Focus 입력 큐의 해당 흐름 PASS. 상세는 [이전 §3.6–3.21](work9-b.md#36-w9b-0105-windowsweb-구현과-통합-수정--진행-중) | 모든 custom 계약·전체 catalog·OS API·설치본 native run·복구/수락 행렬을 통과한 것으로 확대하지 않음 |
| 마지막 완료 묶음 | [이전 §3.21](work9-b.md#321-부모-focus-요청dom-입력-순서게시-geometry--해당-흐름-pass--partial)의 부모 Focus·DOM 입력 순서·게시 geometry와 Windows/Web 해당 흐름 | 그때의 소스·공급 범위에 한정. 현재 초안의 PASS가 아님 |
| 최신 Range/editor 초안 | [이전 §3.22](work9-b.md#322-range-선언-확장editor-곡선-animation--paused--partial-구현-중검증-대기). 소스는 현재 checkout에 보존됨 | 실제 compile·사용자 앱 연결·수치/수명·공급·설치·제품 실행 **검증 대기 / notVerified** |

**문서 이관 시 읽기 확인:** `sourceIdentity()` 재산출과 현재 manifest 읽기에서 아래 불일치를 확인했다. Source schema는 생성된 TS/C++ 상수에서 읽었다. 이는 build·manifest 전체 tree/hash 검증·앱 실행의 대체 근거가 아니다. 이후 재개 때 변경 입력을 다시 확인한다.

| 항목 | 2026-11-09 이관 시점 |
| --- | --- |
| 현재 engine source identity | `2dbcec2cd97c85fa7652a9f84f2ce19b896999319f652c712ed9cbb8fb1f504e` |
| 현재 Source protocol | ABI **2 / schema 905102333** |
| 기존 Windows/Web engine dist | source `95c74477abc15d51002d4a3c7aac3dc27f486f9051c86f841b40f45e882e1c0b` / ABI **2 / schema 2115239553** |
| 기존 manifest | **355 files** 기재, profile은 `windows-app-sdk`·`threaded`·`single-worker`. 이번 이관에서 전체 파일 hash를 재검증하지 않음 |
| Core/Material/SDK dist | §3.22 초안 이후 미갱신이라는 종료 기록을 이어받음. 새 공급·선언으로 compile/설치 확인 필요 |
| Android | 앞선 공통 wire/Core/service 변경이 미반영된 **stale/notVerified**. Android 차수에서 두 ABI 공급·설치/run을 갱신 |

### 2.2 Range/editor 초안의 정확한 범위

- **Range 선언:** [range-native-shape.ts](packages/material/src/internal/slider/range-native-shape.ts)와 `slider-shapes` export에 exact custom prototype별 track·thumb·tick·overlay·indicator reader를 작성했다. Track rect·thumb 배치·paint·label 배치를 Core expression으로 전달하고 미등록 subclass는 거부한다. Indicator paragraph resource·overlap/horizontal shift도 초안이다. 기존 임의 Canvas/getPreferredRect callback과의 전체 호환을 구현한 것은 아니다.
- **공유 정책:** [range-paint-policy.ts](packages/material/src/internal/slider/range-paint-policy.ts)의 pressed thumb size/track gap을 원래 TS painter와 native 설정이 함께 소비한다. Enabled/discrete rect·centers rect·native scalar, custom tick 순서를 작성했고 현재 divisions **127 초과 거부**가 남아 있다. 실제 custom 소비자·Source/Core 대조·상태 교체/제거·label 수명은 미검증이다.
- **Curve/animation:** [curves.ts](Nelyx/src/framework/animation/curves.ts)의 native 데이터·exact custom Curve reader, [scroll-curve.ts](Nelyx/runtime/engine-client/scroll-curve.ts)의 최대 **32 nodes / depth 16** 캡처·전송, [curve.hpp](Nelyx/engine/core/input/curve.hpp)의 cubic/split/interval/flipped/threshold/sawtooth/decelerate/bounce/elastic 평가와 wire 검사를 작성했다. 기존 **56-byte scroll body**에 선택적 curve tail을 추가하고 View의 curve/명령 보유 메모리 예약을 작성했다. Duration 최대 **60s**, timeout 최대 **62s**이며 editor duration=0 제한 제거·중간 offset 일치에 의한 조기 종료 방지도 초안이다.
- **확인된 실패:** 이전 `npm.cmd run check --workspace @nelyx/core`는 runtime이 이전 dist의 curves 선언을 읽어 `nativeCurveConfiguration` / `NativeCurveConfiguration` export 누락과 파생 TS7053으로 실패했다. Staged Core build의 선언 연결은 소스에서 확인했으나 **build:core는 실행하지 않았다**. Material check는 초기 Range reader까지만 PASS이며 뒤의 indicator/shared policy 수정은 포함하지 않는다.
- **미실행/미연결:** 변경 TS 11 files format·schema 생성·diff 검사만 당시 PASS다. 전체 type/lint·C++/Wasm compile·수치/수명·설치·Windows/Web 제품 실행은 미실행이다. Demo custom Range/curved editor UI는 미연결, editor custom physics/scrollBehavior는 계속 거부한다. Request/terminal·입력 취소·text/extent/resize·controller 교체·hide/close도 남는다.

## 3. 남은 실행 단계와 이전 의무 대응

| 단계 | 이어받는 범위 | 작업과 완료 조건 |
| --- | --- | --- |
| **W9C-00 Range/editor 초안 완성** | W9B §3.22 · 01/02/05/06 | 새 선언을 대상으로 compile 오류 해결, custom Range 계약·실제 소비자와 curved editor 연결, 수치·취소·종료를 한 구현 묶음으로 작성하고 06에서 확인 |
| **W9C-01 Core 실행 이관** | W9B-01 · W9A-04 | 표준 RenderObject의 설정·invalidation·parent data를 모듈 소유로 이관. 마지막 TS 실행 소비자·중앙 분기 정리와 custom/동기 계약 대응 |
| **W9C-02 디자인·접근성 정책** | W9B-02 · W9A-05 | 원래 theme/State/controller/painter·controls·form·route/overlay/localization/assets·전체 catalog 연결. 축소 `/v2` 소비자 종료 |
| **W9C-03 SDK 서비스·수명** | W9B-03 · W9A-06 | 해당 native target의 실제 수정 소스 이식, session/view/service·VM·reload/loss·공개 host API와 실패/취소/close 완성 |
| **W9C-04 CLI·설정·공급** | W9B-04 · W9A-07 | 공통 target descriptor·하나의 config/template·원본/출처 포함 공급. 구 설정/도구 소비자 이관. v2 제품 기본값 전환은 07 |
| **W9C-05 대표 앱 이관** | W9B-05 · W9A-08 | Testbed/Demo의 원래 catalog·상태·탐색·입력·자산 보존과 Android sample 잔여 기능. Sample UI는 엔진 공급 필수 입력이 아님 |
| **W9C-06 통합 확인·문제 대응** | W9B-06 · W9A-09 | 각 챕터 구현 후 공통 적용. 변경 공급·설치 소비·실제 앱·복구/종료를 함께 확인하고 문제 일괄 수정·영향 범위 재검증. 00–05 연결 후 챕터 간 누락을 종합 확인하며 W9-13/14 분리 판정 |
| **W9C-07 대상별 기본값 전환·삭제** | W9B-07 · W9A-10 | 해당 API·기술·제품 gate를 통과한 target의 일반 CLI/sample/template 전환. 마지막 구 소비자·중복 Widget·축소 디자인·불필요 export/dependency 제거 |
| **W9C-08 후속 플랫폼·전역 종료** | W9B-08 · W9A-11/12 | Linux·iOS/macOS의 대체 host/API 또는 명시적 지원 범위 확정. 잔여 runtime/공급/빌드/template/배포 제거와 생성·문서 소유권 일치 |

00–05는 챕터 단위로 구현·통합 검증하며 필요한 공통 연산·서비스의 의존성 순서를 따른다. 다음 챕터의 연결이 있어야 실행할 수 있는 범위만 인접 챕터와 함께 묶고, 그 의존성과 통합 시점을 기록한다. 기본 차수는 **Windows/Web → Android/Linux → iOS/macOS**다. 준비되지 않은 후속 플랫폼을 Windows/Web 구현·통합 검증의 선행 조건으로 넣지 않으며 각 대상의 남은 의무와 DEFERRED는 보존한다.

**§3.1–3.4의 체크박스는 구현과 통합 검증을 모두 충족한 완료 조건이다.** 항목마다 구현·빌드·실행을 반복하는 순서로 사용하지 않는다. 챕터 안의 구현·소비자·확인할 시나리오를 먼저 함께 준비하고, 수치·수명·제품 실행 확인은 챕터 끝의 W9C-06에서 모아 수행한다. 구현을 마쳤어도 통합 확인 전에는 **구현 완료 / 검증 대기 / notVerified**로 기록하고 완료 체크는 보류한다.

### 3.1 W9C-00 — 첫 재개 구현 묶음

- [x] 새 Source 선언과 runtime의 compile 오류를 해결한다. 알려진 이전 dist 선언 오류가 후속 구현을 막으면 §7.1의 `npm.cmd run build:core`로 필요한 선언을 먼저 공급하고, 나머지 공급·제품 검증은 챕터 끝에 모은다.
- [x] Range exact custom extension의 등록·선언·미지원 callback 계약을 검토·문서화하고 실제 custom track/thumb/tick/overlay/indicator 소비자를 연결한다.
- [x] Source painter와 Core의 rect·thumb center·track gap·paint·label 배치를 대조하고 enabled/discrete·RTL·overlap/horizontal shift·text scale·상태 교체/제거·paragraph 수명을 확인한다. Divisions 127 제한을 원래 API 의무에 대응시킨다.
- [x] Source Curve 데이터 캡처·정확한 reader·기존 56-byte 호환·curve tail·malformed/reserved/depth/node/budget 경계와 Source/Core 수치 일치를 확인한다. 임의 Curve callback 전체 지원으로 판정하지 않는다.
- [x] Demo에 custom Range와 curved editor animation UI를 연결하고 실제 Source controller/client 소비 경로를 완성한다.
- [x] Editor request/terminal·중간/최종 offset·duration 0/상한·cancel/supersede/timeout·입력 취소·text 축소/extent/resize·controller 교체·hide/close와 메모리 회수를 확인한다.
- [x] W9C-00 전체 구현을 모은 뒤 Core/Material/SDK·변경 engine 공급을 갱신하고 같은 공급으로 설치 소비·Web 두 profile·Windows 실제 흐름을 06에서 확인한다. 이전 문서 §3.21의 Focus/입력 큐·기존 Range 흐름을 직접 영향 회귀에 포함한다. 아래의 간헐 오류 추적과 제품 수락은 별도 유지한다.

#### 3.1.1 2026-11-09 W9C-00 구현·통합 확인 — 현재 기능 범위 PASS / 전체 PARTIAL

- 이전 curves 선언 오류는 새 Core build로 해결했다. Range의 다섯 custom shape 역할과 등록 후 method identity 검사, concrete tick의 실제 entry budget 및 단일 program entry 반복 tick을 연결했다. 127 고정 제한을 제거하고 200 divisions 소비자를 Demo에 추가했다. [extension 계약](Nelyx/engine/range-editor.md)은 임의 callback 미지원·전체 API 의무와 자원 budget을 구분한다.
- 명령 ID별 `scrollCancel`을 추가했다. Source controller의 교체·dispose·supersede, hide/focus·metrics/device 무효화, editor 편집 입력에서 기존 명령을 정리하고 늦은 취소가 새 명령을 취소하지 않게 했다. Demo에는 등록한 Interval/ThreePointCubic Curve, 긴 editor text, animation/stop/jump/controller 교체 UI를 연결했다.
- 통합에서 custom indicator의 `worldX` 인자가 빠진 오류와 canonical Material에서 임시 `/v2` Widget export graph를 끌어온 import를 수정했다. Material은 중립 `@nelyx/core/engine`을 사용한다.
- 종료 대기 중인 layout 응답은 `SceneWriter.stop()` 이후 관측 callback/오류를 만들지 않게 했다. Core event overflow는 명시적 terminal status를 반환하고, view 종료로 해제된 active scene/edit target을 직렬화하지 않게 했다. Windows host도 닫힌 view를 감지하면 정상 close 또는 원인 status를 구분해 drain한다.

| 확인 | 현재 결과 |
| --- | --- |
| 정적·공급 | Core/Material/SDK build, 전체 workspace 타입 검사(마지막 Demo 수정 후 영향 타입 재확인), lint, format, schema 검사 PASS. 후속 close 보완의 Core 및 engine 재빌드 PASS. Windows App SDK·Web 두 profile compile PASS. Source/dist `52e4be1e97499f407158d0e5c30c93bd981ae4523d4b8d16c0592bd63c6aded0`, ABI 2 / schema **70183166**, **355 files** 전체 hash 확인. 원래 4 packages / 834 subpaths baseline 보존 |
| Curve | 실제 Source 19종 × 9 지점과 MSVC C++ 수치 일치. 32 nodes / depth 16 경계와 malformed 11종, cycle/미등록·변경 method/데이터 capture 거부 확인 |
| Range | 실제 Wasm Core와 Source rect/centers를 enabled/discrete/RTL 8개 조합에서 대조. 200 tick 순서·paint 제거·close 회수 PASS. Source indicator painter와 Core edge shift/text scale/activation 12조합 PASS. 겹침/비겹침·양쪽 edge shift·RTL·선택 thumb의 paint 순서/overlap context 16조합 PASS. Gapped/Handle pressed gap·thumb size·RTL 4조합 PASS(기록 시 SkScalar 정밀도 반영) |
| 명령·editor | Wasm의 기존 56-byte body, curve tail, 중간/최종 offset, 초기 offset 일치 시 조기 종료 방지, duration 0/60000·60001 거부, supersede·명령 ID cancel·timeout·hide·wheel·text replace·node 제거·session memory=0 PASS. Editor 측정은 이 수치 검증에서 명시 provider 값을 사용했고 실제 paragraph는 아래 앱에서 확인 |
| 종료·overflow | 실제 SceneWriter/Wasm의 publication/layout 응답을 보류한 상태에서 stop/close 후 재개해 late callback/error 없음·memory=0 PASS. Focus 이벤트 큐 overflow의 status 30, 이후 닫힌 layout snapshot의 status 14 및 viewClosed 원인 보존·memory=0 PASS |
| 설치 package | 8 tarballs 독립 설치, TS 7.0.2·NodeNext·ES2022·types=[]·skipLibCheck=false에서 custom shape/Curve/client 선언 PASS. 설치 CLI create/doctor/build(Web/Windows)/Web pack·폐기 Windows host 거부 PASS. App model `original-elements` |
| Web 실제 Demo | 현재 공급에서 Chrome/Edge × single-worker/threaded의 custom Range keyboard/drag/indicator·enabled·RTL·shape 교체, parent Focus, editor curved terminal/stop/controller 교체/resize/한글·emoji text 입력을 확인했다. Edge/threaded 첫 통합에서 busy(23) 1회 FAIL 후 같은 전체 흐름의 두 번 재검은 PASS. 이를 무오류 최초 통과로 바꾸지 않는다. 각 close reservedBytes=0 / workersStopped=true. 기존 Gallery도 Chrome single-worker·Edge threaded의 원래 Filled callback과 close PASS |
| Windows PowerShell·설치본 | 현재 공급의 원래 Demo를 일반 CLI와 독립 설치 CLI로 실행하고 PowerShell의 실제 mouse/key 입력으로 custom Range drag·enabled·RTL·shape 교체, 긴 editor 곡선 terminal/stop·controller 교체·재클릭, parent Focus `Up · a · Key A`, 한글/emoji·maximize/restore·text 축소/extent 재생성·animation 중 close PASS. 설치본 **860 modules / original-elements**, exit 0 / reservedBytes=0 / memoryTotal=0 / workersJoined=true. Core와 host를 함께 ASAN 빌드한 같은 입력 흐름도 오류 없이 종료 |

**관측한 실패와 후속 추적:** 초기 공급의 Windows editor 재클릭에서 **exit 3221225477 (0xC0000005)** 1회와 최소 소비자의 동일 exit를 관측했으나 당시 fault stack은 확보하지 못했다. 후속 §3.1.2에서 editor 포커스 전환 중 같은 접근 위반을 재현하고 실제 fault stack·소스 위치를 확보해 해당 경로를 수정했다. 최초 실행의 stack까지 소급해 확인한 것으로 확대하지 않는다. Web busy(23)는 최초 opcode/stack을 확보하지 못해 근본 원인 해결로 판정하지 않는다. 재발하면 상세 EngineError의 opcode·document·stack으로 정확한 경로부터 좁히고 영향 회귀만 다시 확인한다.

추가 Edge/threaded 6회 전환 진단은 첫 cycle 뒤 두 번째 Selection의 custom Range가 visible이 되는 대기에서 timeout했다. App/host 오류 수집은 비어 있었고 정상 close/drain했지만 이 진단을 6회 PASS로 세지 않는다. 반복 탐색 때 목록의 보존 위치·가시성/virtualization을 구분하는 검증은 W9C-01/05의 잔여 범위로 남긴다.

**버벅임 확인의 한계:** 사용자 요청 이후 Windows 실행·조작은 PowerShell로 수행했다. 독립 설치본의 세 시점에서 Core 처리 약 **0.6–1.9 ms**, 기록 약 **0.5–1.1 ms**, 제출 약 **0.7–4.5 ms**, 입력 queue 0을 관측했다. UIA 조회/PowerShell 동작/게시 대기를 포함한 관측 시간은 입력→표시 지연과 같지 않으며 이 표본으로 부드러움 개선·성능 수락을 선언하지 않는다. Scanout은 `unobserved`, 물리/display/scanout **notVerified**, 두 성능 flag **false**, Android **stale/notVerified**, 후속 플랫폼 **DEFERRED**를 유지한다.

#### 3.1.2 2026-11-09 Windows 트랙패드 스크롤 후 자동 종료 — 원인 수정·영향 회귀 PASS

- 사용자가 일반 PowerShell Demo 실행에서 스크롤 후 수 초 안에 종료됨을 보고했다. 제공한 로그의 첫 원인은 **Core view closed status=30(eventOverflow)**이며, 뒤의 `pollInteractionEvents` opcode 35/status 14(closed)는 이미 닫힌 view를 읽은 결과다. Exit 1 / 정상 메모리 drain과 앞서 원인 미확정인 `0xC0000005`는 구분한다.
- 출력을 즉시 소비하는 진단 창에서는 사용자가 트랙패드로 스크롤해도 유지됨을 확인했다. 수정 전 같은 공급에서 실제 DirectManipulation packet **213개 / rejected 0**, 사용자 창 닫기 후 exit 0 / memoryTotal=0 / workersJoined=true를 관측했다. 이것만으로 일반 콘솔 재현을 부정하지 않는다.
- **동일 원인 재현:** 원래 CLI로 Demo를 실행하고 stdout 소비를 6초 보류한 동안 Windows mouse-move/wheel carrier에 각 300개 합성 메시지를 보냈다. `native.notify → onExecution → SceneWriter.adopt`에서 App thread가 동기 콘솔 출력에 막혀 Core queue가 overflow하고 **status 30 / exit 1**로 종료됐다. 출력된 execution snapshot은 13개, 전체 출력은 43,956 bytes였다. 합성 입력 재현은 물리 트랙패드 수락과 구분한다.
- **수정:** Windows `native.notify`는 매 scene ACK의 execution counter를 계속 갱신하되, `app-execution` 전체 JSON을 매번 stdout에 쓰지 않는다. 명시적 `stats`의 observed/ACK/fallback counter와 app-ready/disposed/error 출력은 유지한다. Core event queue 크기·overflow 정책·물리 입력 cadence는 변경하지 않았다.
- 출력 정체를 해소한 뒤 **Original native focus/keyboard mailbox exceeded**도 재현했다. 연속 content/animation 갱신이 끝나기를 기다리며 Source 입력을 미뤘고, 반복 native 편집 중에는 새 desired document가 게시되기를 기다리는 조건과 비동기 geometry 조회가 짧은 ACK checkpoint를 벗어나는 문제가 겹쳤다. 각 scene ACK·retirement 뒤 Source 입력을 처리하며, 필요한 geometry 조회가 끝날 때까지 checkpoint를 유지한다. 키의 geometry는 현재 게시된 document/publication과 live node handle로 확인하고 metrics/device 검사는 유지한다. 입력 한도 증가·입력 버리기로 해결하지 않았다.
- **별도 접근 위반 원인 확보:** 일반/ASAN Windows 실행에서 editor와 부모 Focus를 오가다 `0xC0000005`를 재현했다. Vectored exception의 fault RVA `0x6d6f08`을 해당 PDB의 DIA 정보로 해석하면 `vector<int>::operator=` → `Interaction::sync`의 `t.words = q.words`였다. Prepared ID가 scene과 다를 때 만든 singular map iterator를 실제 `end()`와 비교한 뒤 역참조한 오류다. 해당 frame과 일치하는 Prepared를 지역 shared owner로 보존하고 실제 조회가 성공한 paragraph만 사용하며 UIA query context도 같은 Prepared에 묶었다. 문단이 아직 준비되지 않았으면 기존 text-only 경로를 사용한다.

| 후속 확인 | 현재 결과 |
| --- | --- |
| 현재 공급·앱 | Engine/Core 재빌드, Core 타입·lint·format·schema·diff 검사 PASS. Source/dist **`fad4be8d1c6e816f362f95cb33b9d3e353719f01a0f40bce4ec02c094f494d94`**, ABI **2 / schema 70183166**, **355 files** 전체 hash 일치. Demo Windows/Web **860/859 modules**, Gallery **893/892 modules**, `original-elements` 번들 재빌드·검사. 마지막 C++ 수정 전후 non-Windows 공급 27 files hash 동일 |
| 원래 CLI·출력 정체 | 같은 6초 stdout 보류·mouse-move/wheel 각 300개 합성 carrier 조건 PASS. **exit 0 / errors 0 / executionLogs 0**, 출력 **7,390 bytes**, App/Core ACK **5,581/5,581**, received/consumed **628/628**, queue **0**. Close reservedBytes=0 / memoryTotal=0 / workersJoined=true |
| 일반 Windows·PowerShell | Range drag·enabled·RTL·shape 교체, 긴 editor 곡선 terminal·controller 교체, 부모 Focus와 editor 간 **12회** 재진입·서로 다른 한글/emoji 입력, 마지막 Source `Up · b · Key B` 처리, maximize/restore·text 축소/extent 재생성·명시적 stop·animation 중 close PASS. Editor 시점 received/consumed **130/130**, queue 0. Exit 0 / close reservedBytes=0 / memoryTotal=0 / workersJoined=true |
| ASAN Windows | 최종 Source 입력 보완 후 editor 곡선·controller·Focus 재진입·서로 다른 한글/emoji 입력 **6회 PASS**. Received/consumed **71/71**, queue 0, ASAN/접근 위반/앱 오류 없음. Exit 0 / close reservedBytes=0 / memoryTotal=0 / workersJoined=true. ASAN Range drag는 앞선 시도에서 값 변경 대기가 timeout하여 전체 ASAN Range PASS로 세지 않는다. 일반 Windows Range와 Web Range 결과는 별도 판정 |
| Web | 최종 Source 입력 보완 후 Chrome/Edge × single-worker/threaded **4/4 PASS**. Range keyboard/drag·enabled·RTL·shape 교체, parent Focus key, editor 곡선 terminal/cancel/controller·resize·한글/emoji, close reservedBytes=0 / workersStopped=true |

§3.1.1의 독립 설치 소비자 결과는 그때의 공급에 한정하며 이번 후속은 현재 repository CLI·일반/ASAN host·현재 앱 번들로 확인한다. 수정 후 물리 트랙패드 재확인은 아직 **notVerified**다. 앞선 사용자 관측은 수정 전 빠른 출력 소비 조건의 근거다. 실제 부드러움·display/scanout·두 성능 flag·Android 및 후속 플랫폼의 수락 경계는 유지한다.

#### 3.1.3 2026-11-09 메뉴 재종료·상단 섹션 복원·physical 그림자 — 수정 및 통합 확인 중

§3.1.2는 당시 확인한 경로의 결과다. 이후 사용자가 목록/다른 화면에서 메뉴를 열다 다시 종료되는 로그와 ElevatedButton/Card의 사각형으로 잘린 듯한 그림자를 보고했다. 첫 로그의 **status 30(eventOverflow)** 뒤 mailbox 오류는 종료 후속 증상이며, 이전 출력 정체 수정 하나로 모든 종료 경로가 해결됐다고 확대하지 않는다.

- **연속 관측 큐:** Source가 새 장면을 만드는 동안 같은 listener의 연속 pointer update가 interaction queue 64개를 채우는 경로를 별도 재현했다. 동일 node generation·document·좌표 변환·stream/source/device/contact·버튼/수정 키의 연속 update만 합치며, 마지막 좌표/시각과 누적 delta를 보존한다. Down/up/cancel·키·다른 좌표계 경계와 discrete overflow 정책은 유지한다. 최초 overflow의 queue/kind/phase/종류별 개수를 `V2_EVENT_OVERFLOW`로 남기고 mailbox full/closed 메시지도 구분했다.
- **목록 초기화 timeout:** 최대화 Demo의 스크롤→메뉴 선택 반복에서 `Native scroll failed (28)`도 재현했다. 이미 Core의 현재/요청 위치에 있는 numeric jump를 Source seek로 보내 unrelated accepted document 활성화를 기다리게 하던 경로를 수정했다. 실제 Core snapshot의 두 위치가 목표와 같고 준비 범위 안이면 일반 native scroll로 활동 취소를 수행한다. 다른 위치로의 이동·새 목록 generation·미준비 목적지의 seek는 유지한다.
- **물리 입력에서 새 최초 오류 확보:** 위 수정 후 일반 PowerShell CLI의 실제 트랙패드 **admitted 364 / rejected 10** 실행에서 사용자가 재종료를 확인했다. 이번 최초 오류는 **opcode 40(listSeek) / status 23(busy), document=activeDocument=128**이며 status 30과 다르다. List seek의 내부 scroll 정규화에 일반 programmatic scroll의 interrupt/rebase 정책이 빠져 진행 중 입력을 busy로 거부했다. 해당 viewport의 입력을 취소하고 이동하도록 맞추며 다른 viewport의 입력은 유지한다. 오류 무시나 재시도로 숨기지 않는다.
- **상단 섹션으로 돌아가지 못함:** 사용자는 상단 위젯이 사라지고 위로 더 스크롤할 수도 없다고 확인했다. 동일 Core의 synthetic engineDriven begin/update/end로 **offset 362 → 역방향 후 212에 고정**, prepared minimum=212 / list begin=1을 재현했다. 정상 end가 미준비 영역으로 향하던 `requested`를 현재 coverage 경계로 지워 버리는 원인이다. 정상 종료는 pending destination을 Content가 준비할 때까지 보존하고 cancel에서만 폐기하도록 direct scroll/pointer pan 양쪽을 맞춘다. 모든 항목을 keep-alive하거나 window/queue 한도를 늘리지 않는다.
- **그림자:** physical rounded rectangle을 일반 cubic contour로 바꿔 Skia에 넘겨 fill과 shadow occluder의 도형 종류가 달라졌다. Windows/CanvasKit의 Content→Render 준비 경로에 원래 RRect/conic을 유지한다. Ink highlight/ripple의 clip도 paint sequence 전체 대신 각 ink entry에만 적용해 주변 그림자/paint outset을 자르지 않는다.
- **후속 물리 실패를 최종 근거로 보존:** 상단 복원 수정 공급에서 사용자는 상단은 복원되지만 메뉴가 열리지 않고 입력 반응·스크롤이 심하게 느리다고 보고했다. 실제 트랙패드 **admitted 939 / rejected 0** 뒤 **opcode 4(transaction) / status 19(budgetExceeded), document 285 / activeDocument 175**로 종료됐다. 이 실행을 물리 입력 PASS로 세지 않는다. 앞의 eventOverflow·listSeek busy와 서로 다른 최초 오류이며, 한도 초과의 세부 항목까지 당시 로그로 확정하지 않는다.
- **상태 조회와 장면 전송 분리:** Windows의 입력·clock/status와 Source의 스케줄러·폰트·편집 상태 확인이 기본 `inspect`의 전체 desired scene을 반복 직렬화하고 있었다. 기존 full inspect는 유지하고 같은 opcode의 명시적 `stateOnly=1` body를 추가해 상태·pending work metadata만 받는다. 공통 codec/client와 Windows/Web 내부 상태 소비자를 연결하고 ABI 2 / schema **896476372**로 갱신했다. Android 공급은 갱신하지 않았다.
- **게시 전 장면 교체 제어:** 보통 animation/input invalidation은 이전 accepted scene의 게시까지 합치되, 해당 document·metrics·device의 Source LayoutBuilder/list 요청은 계속 처리한다. Metrics/device/font 변경도 새 설정으로 진행한다. 대기 중과 ACK 뒤에 입력 checkpoint를 열어 입력을 끝없는 build promise 뒤에 두지 않는다. Windows App owner는 이미 도착한 응답이 있으면 2ms wait를 건너뛴다.
- **관측·직렬화 비용 축소:** bounded interaction queue를 먼저 읽고, publication·active preparation·property/input/focus/editing·metrics/device 변경으로 장면/레이아웃 관측을 갱신한다. 없는 optional 명령은 버퍼도 만들지 않는다. 자주 쓰는 설정은 ACK된 입력의 독립 데이터 snapshot과 비교해 동일한 명령 바이트를 재사용한다. 원래 객체의 in-place 변경, accessor/실행 값, NACK/재시도를 구분하며 새 callback은 계속 채택한다. 값 검증·reset·queue/resource 한도를 완화하지 않는다.
- **목록 준비 왕복 축소:** sequential list는 첫 실제 행을 측정한 뒤 그 prefix의 실제 높이로 최대 8개의 연속 미측정 행을 묶어 준비한다. 예측은 준비할 작업 선택에만 쓰고 최종 viewport/extent는 모든 행의 Content 측정으로 결정한다. 긴 이동에서 미측정 prefix를 건너뛰지 않고, 최종 window 밖의 미리 준비한 행은 정상적으로 제외한다. Non-sequential section의 준비 규칙과 전체 listChildren 한도는 유지한다.

- **통합 검사에서 발견한 별도 수명 오류:** Range의 값 표시 OverlayEntry 제거가 현재 Overlay build 뒤로 지연된 동안 비활성 Source Element에서 `Directionality.of`를 읽어 `Ancestor lookup requires an active Element`가 발생했다. Chrome/Edge × single/threaded **4/4 FAIL**을 확보했다. Range/Slider indicator builder가 live owner와 현재 entry identity를 먼저 확인하고, 이미 은퇴한 entry는 빈 구성으로 끝내도록 수정했다. 활성 owner의 새 방향·shape·callback은 그대로 읽는다.

| 이번 통합 확인 | 실제 결과 및 범위 |
| --- | --- |
| 현재 공급·앱 | Engine source/dist **`9c19f59ed7c5a04a0185ce65a165f8521f20487a0a19417f63ffbbc6323e3b2a`**, ABI **2 / schema 896476372**, **355 files** 전체 hash 확인. Core·SDK·Material 빌드, Web host 타입·lint·format·schema·diff 검사 PASS. Demo Windows/Web **860/859 modules**, Gallery **893/892 modules** 재빌드·manifest 파일 hash 확인, `original-elements`. Engine 공급 identity와 별도로 Source framework/SDK/design 변경은 새 App 번들에 포함된다. 이번 변경의 독립 설치 소비자는 재실행하지 않았다 |
| Core ASAN | 연속 pointer 300개→누적 delta 보존 1개, listener 순서·stream/generation/좌표계·discrete 경계, 65번째 discrete의 overflow 진단, indexed/numeric seek의 해당 viewport interrupt/rebase, 정상 end/cancel의 deferred 목적지 보존/폐기, 실제 측정 prefix의 bounded 목록 준비·0높이/긴 이동/최종 window 회수 PASS. 각 수명 종료 후 ledger=0 |
| 상태 wire | 실제 Engine의 151 nodes full inspect **55,168 bytes**, stateOnly **808 bytes**, 상태 epoch 일치·nodes=0, 잘못된 flag/body 거부, view/session close 뒤 inspection, ASAN 및 ledger=0 PASS |
| Source writer | optional 설정 제거의 NACK/재시도·ACK 후 no-op, 설정 객체의 in-place/중첩 변경·accessor·NaN 거부·이전 바이트 불변, 입력 poll 선행·publication/layout/input/focus/device epoch별 갱신·stop 뒤 callback 억제 PASS |
| Windows 메뉴 | 원래 PowerShell CLI에서 **3회 × wheel 30개** 및 **6회 × wheel 150개** 뒤 메뉴 열기/All components 선택 PASS. 긴 흐름 received/consumed **955/954**, queue **0**, 마지막 desired/active **214/208**, exit **0**, close reservedBytes=0 / memoryTotal=0 / workersJoined=true, peak **603,528,516 bytes**. 물리 트랙패드 테스트가 아니다 |
| Windows Range/editor | 일반 CLI·PowerShell에서 custom Range drag·enable/RTL/shape 교체, 긴 editor 곡선 terminal·controller 교체·부모 Focus key, 한글/emoji **3회** 재진입·Source `Up · b · Key B`, maximize/restore·text 축소/재생성·명시적 stop·animation 중 close PASS. Editor received/consumed **85/85**, queue 0, exit 0 / memoryTotal=0 / workersJoined=true. 진단 첫 시도의 foreground timeout, 다음 시도의 route 전환 직후 load-long timeout은 PASS로 세지 않는다. 후속은 버튼 출현에 더해 route publication/명령 안정 후 조작했다 |
| Web Range/editor | 위 overlay 수명 수정 후 Chrome/Edge × single-worker/threaded **4/4 PASS**. Custom Range keyboard/drag·indicator·enable·RTL·shape 교체, 부모 Focus·editor terminal/cancel/controller/resize·한글/emoji, 각 close reservedBytes=0 / workersStopped=true |
| Web lazy 역방향 | Chrome/Edge × single-worker/threaded **4/4 PASS**. Synthetic engineDriven begin/update/end의 offset **949 → 362 → 0**, coverage minimum=0 / list begin=0 / row 0 복원·상단 ElevatedButton visible, errors=[], 각 close reservedBytes=0 / workersStopped=true. 한 gesture의 deferred 이동 예산과 물리 입력 수락은 별도다 |
| 그림자 | Native와 CanvasKit ink 격리에서 영역 밖 shadow **1,564 pixels**, shadow mismatch **0**, ink leak **0**, 내부 ink **958 pixels**. 현재 native capture의 외곽 6점이 exact RRect CPU reference와 일치. 처음 네 점 `(253,247,255)`, 나머지 두 점 `(251,245,253)/(252,246,254)`이며 이전 generic cubic의 어두운 사각 모서리와 구분한다 |

**아직 해결 완료가 아닌 구조적 경계:** 메뉴의 PowerShell/UIA 관측은 일반 흐름 열기 **2.73–2.81초**, 긴 입력 흐름 **1.75–2.45초**였다. 별도 적은 입력 진단의 1.3–1.5초와 같은 조건의 수치로 섞지 않는다. 기존 약 6초보다 줄었어도 사용자 체감·scanout 지연이 아니며 부드러움 수락은 아니다. Source builder마다 전체 scene을 다시 capture하고 Core의 단일 pending builder 응답을 transaction으로 다시 준비하는 왕복이 남는다. 단순 queue 증설로 해결했다고 보지 않는다.

**별도 Web 장시간 실패도 보존:** synthetic engineDriven 입력과 Containment→Selection→All→Text inputs→All→Navigation 전환은 Chrome single-worker 6회 PASS, threaded는 5회 뒤 마지막 메뉴 준비에서 **CanvasKit committed heap / unified budget status 19 FAIL**이었다. 당시 보고된 total **784,120,867**, providerHeap **327,548,928**, 새 heap 요청 **231,997,440**, 한도 **805,306,368 bytes**다. App text의 고정 320MiB reservation과 독립 Content/Render Wasm heap의 성장·사후 account 사이에 headroom 문제가 남는다. 이를 초기 Windows transaction/19의 동일 원인으로 단정하지 않는다. 한도 증가·account 누락으로 숨기지 않았으며 Web 장시간 전체 PASS로 세지 않는다.

수정 공급의 실제 트랙패드·메뉴·반응 지연은 PowerShell 확인 창에서 **사용자 재확인 대기 / notVerified**다. 이전 자동 PASS는 실제 물리 입력 실패를 대체하지 않는다. **compatible=false**, 두 성능 flag **false**, display/scanout **notVerified**, Android **stale/notVerified**, 후속 플랫폼 **DEFERRED**를 유지한다.

#### 3.1.4 2026-11-09 problem.md 구조 검토와 수정

- TS 구성/Core 실행/host 입력·표시 소유권을 유지하면서 실제 병목을 수정했다. 상세 원인·보호 조건·검증은 [problem.md §8](problem.md#8-2026-11-09-구조-수정과-현재-검증)에 기록한다.
- **Core:** 직접 configuration revision과 조상 layout revision을 구분한다. 변경이 builder subtree에 국한되고 generation/constraints/metrics/device/font/native offset이 일치하면 부모 continuation·완료된 형제·preparation identity를 유지한다. 불일치 시 cache를 이용해 재시작한다. Release/전체 Core ASAN에서 geometry 일치·8종 거부 조건·resize·ledger=0 확인. 남은 작업 표본 **39 vs cold 122**는 Core work이며 표시 지연 수치가 아니다.
- **Source:** 동일 builder 요청의 중복 실행 방지, ACK 입력 snapshot에 의한 선택적 설정 바이트 재사용, layout observer index를 적용했다. in-place/accessor/reset/NACK/불변성 확인. 전체 Source tree 증분 캡처는 미구현이다.
- **Web:** Content는 4ms/최대 32 step씩 준비 가능한 작업을 처리한다. catalog별 `FontCollection` 재사용으로 문단마다 새 collection을 만들던 경로를 제거했다. 실제 heap 성장 전 admission·성장 실패 credit 복원, 오래된 candidate의 import 전 회수, 떠난 노드 기록의 prepare 전 회수를 적용했다. App credit 320MiB·CanvasKit 128/256MiB·통합 한도 768MiB를 유지한다.
- **Focus:** 전환 중 opcode 30/status 12에 대해 Source eligibility와 native 설정을 재검사하고, 응답이 게시 상태의 변경을 증명하는 경우만 재시도한다. 안정된 capability 오류는 그대로 보고한다. 결정적 검사 및 최종 Chrome/Edge × 두 profile 각 6회 전환 PASS.
- **현재 공급:** `626550fe7da0ae04854dcf62eed27c9e78992524573510b42f9424805dd521c0`, ABI 2/schema 896476372, 355 files hash PASS. CanvasKit **m153-nelyx-paragraph.7** 고정 source/patch 재빌드·adopt, 인스턴스 wasmMemory export. Core와 Demo **860/859**, Gallery **893/892** Windows/Web 번들 갱신; Gallery UI 재실행은 하지 않았다.
- **최종 Web:** 4개 조합 각각 6회 전환에서 memory.rejected=0 / failedDocument=0 / 오류 없음. provider heap single 128MiB / threaded 합계 256MiB 유지. threaded peak Chrome **741,885,808**, Edge **742,736,613 bytes**. 최종 Range/editor 4/4, Chrome threaded lazy **949→362→0** 복원, 모든 close 예약 0/workersStopped=true. Synthetic update와 route 교체는 입력 무손실 또는 물리 트랙패드 수락 근거가 아니다.
- **Windows:** 일반 PowerShell 명령 실행에서 최대화·메뉴·Text inputs 전환·정상 종료 확인. 최종 Source 재실행 startup/close도 exit=0 / memoryTotal=0 / workersJoined=true. 자동 편집 입력 결과와 물리 트랙패드/체감/scanout은 미검증이다. 이전 공급의 초 단위 메뉴 관측값과 직접 비교하지 않는다.
- 전체 타입 검사, 변경 TS lint, diff whitespace PASS. 각 검증 timeout 20분. 이번 `.nelyx/problem-rz7JpF` 삭제는 자동 승인 검토에서 거부되어 §7.6에 정리 미완료로 기록한다. §7.4–7.5의 이전 차단 경로는 건드리지 않았다.
- **남은 것:** Source 전체 증분 캡처·단계별 입력/표시 지연 측정·실제 사용자 트랙패드/편집/resize 성능 확인. W9C-01로 자동 진행하지 않으며 compatible=false, 두 performance flag=false, 물리/display/scanout notVerified, Android stale/notVerified, 후속 플랫폼 DEFERRED 유지.

#### 3.1.5 2026-11-09 잔여 버벅임 — 증분 캡처·입력 우선 전달

- 최신 사용자 평가: **“조금 더 나아졌지만 여전히 버벅임”**. §3.1.4의 물리 성능 수락은 충족되지 않았다.
- Source에 RenderObject invalidation→ancestor dirty 경로와 subtree SceneNode 재사용을 추가했다. parent/edge/metrics/device/font가 바뀌면 재캡처한다. 자원·builder·tap/layer·editable 등 동적 경계는 방문하며 Core geometry 권한은 유지한다.
- native semantics-only 및 OriginalNativeNode 설정 교체 invalidation을 연결하고, SceneWriter의 불변 내부 기록 재사용을 추가했다. 공개 mutable 입력·함수/accessor·control revision은 기존 경로를 유지한다.
- 큰 semantics/layout 관측 전에 입력 callback을 전달한다. semantic action이 ACK 후 교체된 임시 record 때문에 취소되던 오류는 실제 reference 수명으로 판정한다. 브라우저의 이미 focus를 잃은 편집 입력은 정상 취소로 집계한다.
- 결정적 검사: **501개 중 2개 재캡처 / 499개 재사용**, context/edge/dynamic/budget/NACK/public mutation/native invalidation, snapshot 미완료 중 입력 전달, ACK 뒤 action 보존·노드 제거 뒤 억제 PASS.
- Web 최종 기능 확인은 Chrome/Edge × 두 profile에서 완료했다. 테마·6개 메뉴·Range·편집·resize·Images/Navigation, failedDocument=0 / memory.rejected=0 / 오류 없음, close 예약 0/workersStopped=true. 중간 resize 대기 조건 오류와 stale 입력 거부, Edge threaded 합성 burst 상단 복원 실패 및 일반 wheel 재확인, fill selection 경합과 키보드 삽입 확인은 `problem.md` §9에 구분했다. 입력 무손실/물리 성능 PASS는 아니다.
- Windows 일반 CLI의 App SDK 시작·메뉴·Text inputs 게시·exit=0 확인. 상태 document=active=published=72 / failedDocument=0 / preparation=0 / rejected=0. 편집 내용 자동 변경·물리 트랙패드·scanout은 미검증이다.
- Core/SDK 및 Demo **861/860**, Gallery **894/893** Windows/Web 번들 갱신, 전체 타입/변경 TS lint/diff 검사 PASS. App/SDK 변경이므로 엔진 공급은 `626550fe7da0ae04854dcf62eed27c9e78992524573510b42f9424805dd521c0` 그대로이며 현재 source와 355 files 확인. Gallery UI 재실행은 없음.
- 구현·검증 상세는 [problem.md §9](problem.md#9-2026-11-09-후속-구조-수정--증분-캡처와-입력-우선-전달). 동적 경계/전체 diff와 단계별 latency·실제 사용자 수락은 남는다. compatible=false, 두 performance flag=false, 물리/display/scanout notVerified를 유지한다.

#### 3.1.6 2026-11-09 Windows 기본 그림자 소실·스크롤 깜빡임 후속

- 최신 사용자 보고를 Windows 일반 CLI와 실제 App SDK 창에서 확인했다. 기본 elevation=1 / black shadow / DPR=2이며 설정 누락이 아니다.
- v2에 빠져 있던 기존 Windows native stable-shadow 처리를 physical paint와 retained elevationShadow replay에 이식했다. 최종 device transform/clip에서 Skia의 연속적인 ambient/spot blur 모델을 사용한다. Material 기본 elevation·색은 그대로다.
- 실제 geometry의 스크롤 위치 8개, DPR 4종 × elevation 6종, fill-only 차분·GPU/CPU·retained replay·ledger=0 검사를 통과했다. 상세 근거와 범위는 [problem.md §10](problem.md#10-2026-11-09-windows-elevatedbutton-그림자-소실깜빡임).
- 새 Hermes 공급 생성에서 발견된 `/MD` 무시와 direct API export 누락도 생성기에서 수정했다. JSI `/MD`·API export 3개 및 실제 host 링크·실행 확인.
- 현재 Engine source SHA **`9ec9b741c87660a56e3b6d5ac8ebd9cbe884c84c8672d133aaf07957ea5885e9`** / source·355 files hash 확인. 전체 Windows/Web 공급 재빌드, Demo **861/860**, Gallery **894/893** 번들 갱신·검증.
- 최종 일반 Windows App SDK Demo는 **RTX 4060**에서 기본 그림자·스크롤 왕복·클릭/hover 해제 후 유지 확인. 수치 검사는 **AMD 780M**의 4 DPR/6 elevation·8 위치·retained replay·부모 opacity 0.5 기여율 0.521·ledger=0이며 실제 창과 구분한다. 최종 document=active=published=20 / preparation=0 / failedDocument=0 / input received=consumed=19 / rejected=0. Gallery/Web UI 재수락과 물리 트랙패드·전체 성능 수락은 별도다.

#### 3.1.7 2026-11-09 problem.md 지연 경로 구현 — Windows/Web 해당 회귀 PASS / 전체 PARTIAL

- [problem.md §9](problem.md#9-2026-11-09-구현-및-통합-확인)에 현재 구현·수치·미검증 범위를 기록했다. 이전 §3.1.4–3.1.6의 과거 problem.md 절 번호와 혼동하지 않는다.
- Windows bounded async GPU slot·완료 추적/lease, Hermes/Web 변경 알림, 16/8ms App 재조회 제거, 실제 timer deadline wake, interaction/raw의 Content queue 우회, bounded dispatch/frame trace와 Core lock 계측을 연결했다.
- 동일 scene semantics 병합·조건부 정렬 및 Prepared subtree index 재사용, record identity 재사용, indexed 미측정 row 최대 8개 batch를 반영했다. 빠른 click→wheel에서 발견한 paint-only publication 교체의 wheel stale 거부를 geometry 검증을 유지하며 수정했다.
- 최종 공급 **`2416cdf4ae7075a0567e22100b6c5ff3927f245e9eff4e2e68283c6e72004d32`**, ABI 2/schema 896476372, 355 files 검증. Demo Windows/Web **861/860** 갱신. Native/Wasm·Windows host 빌드, source 회귀, Web 두 profile, Windows 일반 CLI callback/scroll/종료 확인. Windows 종료 예약·메모리 0, Web 예약 0/worker 종료.
- Windows resident 왕복에서 document/layout/paragraph/picture 수 유지, Web 두 profile에서도 document/layout/measurement 유지. Cold/resize backing 비용과 일시적 빈 영역은 남으며, 전체 성능·물리 표시 수락은 하지 않았다. dirty subtree 전체 전환, Content snapshot/deadline, property revision, 독립 builder batch, v2 observed-budget 준비는 후속이다. 기존 compatible=false·성능 flag=false·물리/display/scanout notVerified·Android stale/notVerified를 유지한다.

### 3.2 W9C-01–02 — Core·디자인·접근성 잔여 계약

- [ ] Paragraph/image·control/layer의 남은 중앙 설정을 원래 모듈 소유로 옮긴다. 미등록 subclass·instance 실행 hook 거부를 유지하며 명시 extension/custom draw 지원 범위를 확정한다.
- [ ] Scroll/sliver/lazy list·gesture/focus/editing·overlay/route의 남은 실행 소비자와 pointer pan/zoom 등 미지원 입력 계약을 연결한다. `RenderBox.size` 게시 관측과 별개로 `constraints`·`needsLayout`·게시 전 동기 geometry·custom delegate·relayout listener 의무를 해결한다. Editor custom physics/scrollBehavior도 별도 대응한다.
- [ ] 원래 Material/Cupertino 기본 theme/painter·InkSparkle과 shader/paint·image/gradient/shadow/custom decoration의 미지원 범위를 연결한다. 원래 InputDecoration/custom border·clipper·shape 등은 명시 extension과 실제 API 대응을 남긴다.
- [ ] Controlled value의 수락/거부·divisions·drag commit·callback 순서와 Range 상태/수명은 원래 TS 정책을 따른다. 축소 control 그림은 마지막 소비자 이관 뒤 제거한다.
- [ ] Arbitrary SemanticsSortKey/child delegate·traversal parent/child identifier·전체 역할/병합·custom action·OS accessibility feature ingress·focus/range listener 동등성을 해결한다. 기존 canonical 순서/custom action PASS를 전체 호환으로 확대하지 않는다.
- [ ] Windows 외부 UIA Invoke·reader, Android route/pane 실제 수신·reader 음성을 해당 OS에서 확인한다. Web AX tree·UIA 속성 노출과 실제 reader 동작은 구분한다.
- [ ] TapRegion callback 안의 즉시 정책 변경·예외와 native가 이미 접수한 소비/분류의 원래 동기 계약을 해결한다. Revision/dispose guard만으로 완료 처리하지 않는다.
- [ ] Snapshot singular transform capture·미등록 painter/custom rasterizer·PlatformView를 대응시킨다. Offstage의 숨긴 Web editor IME와 Android 입력/capture를 확인한다.
- [ ] App frame/ticker와 C++ scheduler의 역할을 구분하고 같은 입력/frame의 중복 실행을 없앤다. 모든 JS animation의 App 독립 진행을 약속하지 않는다.
- [ ] 국제 layout·shifted OEM·dead key·물리 Shift Right/Numpad Enter와 모든 focus traversal/재진입/복구 조합을 남은 입력 계약으로 확인한다. 부모 Focus 원형의 PASS는 전체 keyboard/focus/IME 수락이 아니다.

### 3.3 W9C-03–04 — 플랫폼 API·서비스·SDK·도구

- [ ] Windows RNW pointer/capture/focus·IME·UIA provider/settings·환경/서비스의 실제 수정 소스를 기존 소비자에 연결한다. Clipboard·Tooltip notification·modifier/key table의 기존 이식만으로 전체 Windows 완료를 선언하지 않는다.
- [ ] Android/iOS RN·macOS RNM·Linux RNL의 전체 공개 OS API를 원본·이식 파일·Nelyx 수정·기존/새 소비자·실행 결과로 대응시킨다. Theme/locale/font 알림·lifecycle·linking/서비스도 포함한다.
- [ ] Asset/font/text/image/network·buffer의 version·quota·font cohort·credit·upload 수명을 유지한다. ACK·활성화·host 게시·표시를 구분하고 불확정 ACK/IO/GPU holder는 실제 terminal까지 보존한다.
- [ ] Clipboard/feedback 외 OS 환경·font 알림·lifecycle·VM globals/언어 의미를 연결한다. Windows evaluator의 TDZ 미동등 등 미해결 VM 계약을 판정한다.
- [ ] Visibility·새 surface generation·device loss·준비 실패·활성 IME/input·FontLoader/image 취소·reload의 실패/복구/재사용을 실제 session에서 확인한다. 일부 fatal drain PASS를 전체 matrix로 확대하지 않는다.
- [ ] 기존 SDK AppDefinition/서비스·React component·직접 Renderer 주입 API를 대체 또는 명시적 계약 변경으로 대응시킨다. 공통 App/client 선언의 React/RN/DOM ambient 의존성을 제거하고 Web 선언은 browser 환경에서 별도 검사한다.
- [ ] `nelyx.app/1`·공통 target descriptor로 통합하고 `nelyx.v2.json`·`package.json.nelyx`의 마지막 소비자를 이관한다. 설정 공존·의미가 다른 구 VM/renderer 옵션은 명시 실패한다.
- [ ] Hermes/V8/JSC VM 선택과 renderer 선택을 구분하며 미공급 조합은 실패한다. 현재 `--engine v2` 후보 경로와 App SDK 단일 선택을 유지하고 07 수락 전 일반 CLI 기본값을 바꾸지 않는다.
- [ ] Metro의 asset/compiler helper·Hermes bytecode tool을 분리한다. RN bundling/autolinking/Static AOT 구 경로는 마지막 의존성 종료 후 제거하고 중립 helper·Skia/CanvasKit/Hermes supplier·license는 보존한다.

### 3.4 W9C-05 — 실제 앱의 남은 연결

- [ ] Testbed의 ComponentsGallery와 DemoApplication의 원래 전체 catalog·상세·drawer/navigation·form/modal·theme/localization·font/image를 연결한다. 실제 import/render/호출 graph에서 예상되는 후속 의존성을 모아 구현한다.
- [ ] 기존 일부 controls·목록·Range·Text inputs·Badge·Focus의 PASS와 아직 도달/실행하지 못한 화면을 구분한다. 축소 showcase·첫 화면 성공을 전체 catalog 완료로 세지 않는다.
- [ ] Data Testbed·list/navigation/graphics·디자인 `/v2`·구 runner의 마지막 소비자를 추적해 일반 App/frontend로 이관한다.
- [ ] Android sample의 기본 painter·controls/controller·입력·서비스와 남은 화면을 해당 차수에 연결하고 emulator/물리 기기 결과를 구분한다.

## 4. 챕터 전체 구현 후 통합 검증하는 방식

**기본 구현 단위는 W9C-00–05 중 한 챕터다.** Windows App SDK·Web single-worker/threaded에서 해당 챕터의 남은 구현과 실제 소비자 연결을 한 번에 모은 뒤 W9C-06을 적용한다. §3.2의 01–02와 §3.3의 03–04는 관련 계약을 함께 설명한 절이며, 기본 실행 단위는 각각 01·02·03·04다. 실행에 필요한 인접 챕터 의존성만 함께 구현할 수 있다.

| 구현 챕터 | 한 번에 모을 범위 | 챕터 끝에서 통합 확인할 연결 |
| --- | --- | --- |
| W9C-00 | Range custom 선언·공유 painter 정책·Curve/wire·editor animation·Demo 연결 | Source/Core 수치·상태/취소/종료·설치 소비·Windows/Web 실제 흐름 |
| W9C-01 | Core 모듈 이관·custom/동기 geometry·scroll/gesture/focus/editing 실행 계약 | 원래 RenderObject·controller·실제 앱 소비 경로와 직접 영향 회귀 |
| W9C-02 | 원래 디자인/theme/painter·controls·semantics/접근성·관련 catalog 연결 | 원래 TS 정책·입력/접근성·화면/상태 전환 |
| W9C-03 | 해당 플랫폼 소스 이식·SDK 서비스/VM·자원/session/view 수명 | OS API 실제 소비·실패/취소/복구/종료 |
| W9C-04 | CLI/config/target descriptor·공급/출처·template·기존 도구 소비자 이관 | 설치 package의 create/doctor/build/run/dev/pack·선언/실제 graph |
| W9C-05 | Testbed/Demo의 남은 전체 catalog·상태/탐색/입력/자산·구 소비자 이관 | 앞선 챕터를 사용하는 전체 앱 흐름과 챕터 간 연결 |

이 표는 §3의 책임을 묶는 실행 단위이며 확인할 API·수명 의무를 줄이지 않는다. 해당 챕터 범위를 먼저 정하고 그 안의 작은 기능마다 통합 검증으로 전환하지 않는다. 모든 플랫폼·834 API·전체 catalog 수락을 한 챕터의 통합 진입 조건으로 요구하지 않으며, 해당 차수 밖의 범위와 미지원 계약은 미완료 의무로 남긴다.

| 순서 | 실행 방식 | 판정 |
| --- | --- | --- |
| 1. 챕터 범위 모으기 | 현재 diff·§2의 초안·앱 호출 graph·§3의 잔여 계약을 대조하고 해당 챕터의 구현·의존성·확인할 앱/흐름을 정한다 | 챕터 안의 후속 render/control/overlay/service 연결을 함께 포함 |
| 2. 챕터 전체 일괄 구현 | 의존성 순서로 끝까지 연결하고 필요한 문법·타입·국소 compile·schema 정합성만 확인 | 계획한 구현·소비자 연결과 알려진 빌드 차단을 정리. **검증 대기 / notVerified** 유지 |
| 3. 챕터 통합 검증 — W9C-06 | 챕터 구현을 모은 시점에 정적 검사·필요 제품 빌드·공급 identity/hash·설치 소비·§5의 관련 실제 흐름을 같은 공급으로 확인 | 첫 실패 후에도 독립적으로 가능한 흐름을 확인해 실패/차단/미실행 목록 수집 |
| 4. 문제 일괄 수정·재검증 | 빌드/공급·공통 protocol·앱 진입 차단을 먼저 수정하고 나머지 문제도 원인/의존성별로 모아 수정 | 수정 묶음이 끝난 뒤 무효화한 공급·실패 흐름·직접 영향 회귀만 재확인 |
| 5. 챕터 판정·다음 챕터 | 검증한 완료 범위와 실패/차단/미실행을 기록하고 다음 챕터로 진행. 00–05 연결 후 챕터 간 누락·남은 공통 회귀를 종합 확인 | 차단된 의존 범위는 미완료로 유지하고 독립 챕터는 진행 가능. W9-13/14·대상/profile·전체 PARTIAL 분리 |

- **구현 중 확인:** 다음 구현을 막는 문법·타입·국소 compile·schema 문제만 필요할 때 확인한다. 기능 하나가 연결됐다는 이유로 전체 check/build·pack·독립 설치·Windows/Web 실행을 끼우지 않는다. 알려진 선언 공급 차단을 푸는 국소 빌드는 허용하며 같은 입력이면 반복하지 않는다.
- **통합 검증 시점:** 해당 챕터의 계획한 구현과 소비자 연결이 모이면 최초 통합 검증을 한 회차로 수행한다. 확인 도중 발견한 독립 문제를 모아 수정하고 필요한 재검증을 수행한다. 한 번 시도했다는 이유로 실패/미실행을 완료 처리하지 않는다.
- **다음 챕터 진행:** 앞선 챕터의 문제는 남은 의무로 기록한다. 다음 챕터가 그 실패 경로에 의존하면 함께 고치고, 독립적인 범위는 계속 구현한다. 물리 입력·표시·성능 수락과 기본값 전환은 §5–6의 별도 gate를 유지한다.

동일 입력의 영향 없는 PASS는 반복하지 않는다. 공통 wire·ABI/schema·자원 수명 변경은 관련 target/profile 확인을 넓히며, App/디자인/CLI만 바뀌면 해당 package/App을 갱신한다. 한 통합 회차에서 현재 공급과 최소 설치 소비자를 공유하고 입력이 바뀌면 필요한 산출물만 갱신한다. 이전 dist/archive/설치본을 누적 보관하지 않는다.

## 5. W9C-06 제품 확인과 수락 경계

아래 행렬은 **챕터 끝의 통합 검증과 마지막 종합 확인에 적용할 기준**이다. 매 챕터에는 변경된 계약·소비자·직접 영향 범위에 해당하는 행을 모아 확인한다. 00–05 연결 후에는 아직 확인하지 못한 챕터 간 연결·공통 회귀·전환 gate를 확인하며, 입력과 영향이 같은 기존 PASS를 전부 다시 실행하지 않는다.

| 대상·범위 | 실제 확인할 동작 | 판정 경계 |
| --- | --- | --- |
| Windows App SDK | 일반 App/Gallery/Demo·resize·mouse/key/capture·한글/emoji/선택·IME/UIA·OS 서비스·close | RNW 이식본의 실제 소비 경로 확인. 자동 OS 입력·UIA·GPU screenshot은 물리 touchpad·scanout 수락의 대체가 아님 |
| Web | Chrome/Edge × single-worker/threaded, 원래 catalog·textarea/ARIA·hover·resize·reload/loss·close | Browser/profile별 현재 입력과 게시 확인. 권한 부여 context와 사용자 권한 UI 수락 구분 |
| Android | arm64-v8a/x86_64 공급·일반 설치/run·InputConnection/IME·virtual accessibility·Activity/visibility·loss/reload·정식 stop | 해당 차수에서 수행. Cross-build·emulator·물리 기기 구분 |
| Framework·디자인 | State lifecycle·GlobalKey reparent·Inherited/theme·controlled refusal·기본 painter·catalog/상세/form/modal | 일부 원형·축소 App의 PASS를 전체 API/catalog 완료로 세지 않음 |
| 설치·개발/배포 | 설치 package만 사용하는 create/doctor/build/run/dev/pack·조건부 export·strict 선언·source map/실제 graph | TS 7.0.2·NodeNext·ES2022·types=[]·skipLibCheck=false. Repository alias·잔여 dist가 누락/중복 Core identity를 감추지 않아야 함. 설치본 native run은 별도 확인 |
| 수명·복구 | ACK/NACK/불확정 ACK·upload/IO·font/image/GPU holder·진행 중 close·준비 실패·loss/reload | accepted/activated/submitted/presented·실제 scanout 구분. 미확정 해제를 성공 처리하지 않음 |
| 성능·기본값 전환 | 일반 명령과 같은 화면/입력 패턴의 scroll/resize·IME 반응·메모리·표시 | 기능/CPU/합성 입력만으로 성능 flag를 올리지 않음. 대상/profile별 W9-14 별도 수락 |

통합 검증에서 공급 source identity·전체 tree/hash·ABI/schema·App service version·font cohort·원래 834 API 기준을 확인한다. 선언·빌드·설치·앱 실행·물리 입력·표시·성능의 근거를 각각 남기며 선행 실패로 도달하지 못한 경로는 PASS로 세지 않는다.

## 6. W9C-07–08 전환과 제거할 마지막 소비자

**07 전환 조건:** 해당 대상의 원래 API 대응·W9-13 기술·설치/복구/종료·W9-14 제품 전환 조건을 충족한 뒤 일반 CLI/sample/template 기본값을 바꾼다. 현재 남은 두 성능 flag false·물리/display notVerified를 수락 완료로 바꾸지 않는다.

**08 전역 삭제 조건:** Linux/Apple의 대체 구현 또는 명시적인 지원 범위 결정과 모든 마지막 소비자·공급 의존성 종료가 선행한다. RNW/RN/RNM/RNL 실제 소스 이식은 해당 native target W9-13의 필수 조건이다.

| 제거·이관 대상 | 먼저 확인할 대체·마지막 소비자 |
| --- | --- |
| 기존 직접 작성한 native 플랫폼 API 중복 구현 | 실제 수정 소스 이식본의 소비자·수명·일반 앱 확인. 원본/수정 소스·필수 dependency·notice·Nelyx 연결 코드 보존 |
| `Nelyx/runtime/engine-client/widgets.ts` 별도 Widget/State/Element | Data Testbed·list/navigation/graphics·디자인 `/v2` 소비자 이관. 공통 SceneWriter/packet/client/handle 보존 |
| Original 전용 entry/forwarding·잔여 bridge 분기 | `runtime/app/*` 기능·수명·미지원 거부가 일반 frontend에 존재하고 import/API 전환이 명확해야 함 |
| `packages/material/src/v2.ts`·`packages/cupertino/src/v2.ts` | 생성자/theme/State 차이를 실제 소비자에서 이관. 계약이 다른 원래 클래스로 단순 alias하지 않음 |
| TS PipelineOwner·최종 layout/paint/hit-test·구 AppSession/ViewRuntime 조립 | 하위 클래스·사용자 확장·SDK·앱의 마지막 실행 의존성 종료. 공통 값/설정/resource/service 보존 |
| SDK bootstrap/native-engine·React/RN Surface·구 browser/native-hermes backend/runner | 지원 target별 일반 App/service/host 대체와 공개 API 대응. 재사용 OS/environment helper는 중립 소유로 분리 |
| 구 Skia JS renderer/RN wrapper·provider cohort·Metro/Static AOT 전용 경로 | 실제 v2 paragraph/font/Vulkan/CanvasKit/Hermes/compiler/asset 의존성·출처 보존, 마지막 구 bundling 종료 |
| 불필요 export/dependency/workspace/lock/script·구 template·배포 파일 | 설치 tarball·현재 dist·실제 App bundle/native link graph에서 마지막 소비자 확인 |
| 생성 ownership/upstream/recipe·README/CLI help/work 문서 | 폐기 코드를 재생성하지 않는 입력·productHash·license 일치. 문서가 실제 지원 상태와 일치 |

독립 `windows-hwnd` target은 이미 제거했으므로 새 삭제 의무로 다시 만들지 않는다. App SDK의 HWND interop·공통 Core/provider와 현재 필요한 중립 helper/supplier는 유지한다. 이전 전체 삭제 대응은 [work9-a §7](work9-a.md#7-실제-삭제이관-목록)에 보존한다.

## 7. 재개 명령과 기록·정리 규칙

### 7.1 재개 직후

이 문서 §2–3과 현재 diff·소스·소비자를 읽고 W9C-00 전체의 구현 범위를 정한 뒤 미검증 초안을 이어간다.

```powershell
git status --short
```

알려진 이전 curves 선언 오류가 후속 구현을 막으면 아래 빌드로 새 선언을 공급한다. 같은 입력으로 이미 공급했다면 재개할 때마다 반복하지 않는다. 선언 공급이 구현을 막지 않으면 챕터 통합 검증 시점에 수행한다.

```powershell
npm.cmd run build:core
```

선언 오류와 실제 compile 오류를 구분해 해결하고 Range custom 선언·공유 정책·Curve/wire·소비자·곡선 editor animation을 한 챕터로 함께 연결한다. 이 국소 빌드만으로 제품 확인을 완료 처리하지 않으며 이전 engine dist로 현재 초안을 실행한 결과를 새 코드의 검증으로 세지 않는다.

### 7.2 W9C-06 통합 검증에 진입할 때

해당 챕터의 계획한 구현과 실제 소비자 연결을 모두 모은 뒤 아래 검사 중 변경 범위에 필요한 항목과 package 빌드/pack을 묶어서 실행한다. Core 선언 공급이 필요하면 먼저 해결하고 전체 type 검사를 진행한다. 같은 입력의 유효한 결과·공급은 재사용하며, 실패를 모아 수정한 뒤 무효화된 단계부터 재개한다.

```powershell
# Core 소스·선언 입력이 바뀌었고 아직 공급하지 않은 경우
npm.cmd run build:core
npm.cmd run check:types
npm.cmd run lint
npm.cmd run format:check
node Nelyx/engine/tools/generate-schema.mjs --check
# native/Core·wire·provider/host 등 engine 공급 입력이 바뀐 경우
npm.cmd run build:engine-v2
git diff --check
```

Material/Cupertino·SDK/CLI는 실제 변경 입력에 필요한 빌드/pack을 수행한다. Engine 빌드는 native/Core·wire·provider/host 공급 입력이 바뀐 경우 수행하며 모든 TS/App 변경에 강제하지 않는다. 첫 Range/editor 묶음은 공통 wire/C++가 바뀌었으므로 새 Windows/Web 공급이 필요하다. **Android `npm.cmd run build:engine-v2:android`와 설치/run은 Android 차수에서 묶고**, 그전 공통 변경은 Android stale/notVerified로 남긴다.

확정한 공급으로 원래 Widget App과 Gallery·Testbed/Demo의 일반 경로를 실행한다. Windows v2 host는 App SDK 하나이며 `windowsHost` 생략도 같은 host를 선택하고 폐기 설정은 실패해야 한다.

```powershell
$w9cEngineInputs = (Resolve-Path .\Nelyx\engine\dist).Path
node Nelyx/sdk/tooling/cli/src/main.mjs build --engine v2 --app sample/nelyx-engine-v2-android --target windows --engine-inputs $w9cEngineInputs
node Nelyx/sdk/tooling/cli/src/main.mjs run --engine v2 --app sample/nelyx-engine-v2-android --target windows --engine-inputs $w9cEngineInputs
```

Root의 `npm.cmd run run:engine-v2:windows`·`npm.cmd run run:engine-v2:web`는 원래 Gallery를 준비·실행한다. Demo는 `sample/nelyx-demo-app/engine-v2`를 일반 CLI의 `--app`으로 지정한다. Android 차수에서는 SDK/JDK·App entry·serial·ABI를 확인한 뒤 `npm.cmd run run:engine-v2:android -- --device=emulator-5554`를 사용한다.

### 7.3 검증·임시 자료 운영

- 저장소 지침의 **테스트별 20분 timeout**, 보통 **30회 이내** 반복 제한을 적용한다. 30회는 채울 목표가 아니다.
- 폐기한 독립 `test:*`·`audit:*`·`experiment:*`·측정 harness를 선행 작업으로 복원하지 않는다. 필요한 의미 비교·malformed wire 확인은 한 실행의 임시 묶음과 제품 흐름에서 수행한다.
- 현재 dist·실제 build cache·supplier만 남긴다. 검증 로그·immutable receipt·checkpoint/history JSON·이전 dist/staging/archive·독립 설치본·browser profile을 누적하지 않는다.
- 임시 App·archive·설치본·browser/server·listener·native 창은 실행별 최소 범위로 사용하고 성공/실패/중단 모두 `finally`에서 회수한다. 삭제 전 절대 경로·workspace 안의 소유 범위·남은 process handle을 확인한다.
- 구현 중에는 챕터의 연결 범위와 통합 대기 항목을 간단히 갱신한다. 챕터 종료 시 완료 범위·남은 문제/차단·실행 명령·미실행 대상·현재 공급·정확한 다음 시작점을 기록한다. 중단 시에는 **구현 중 / 통합 검증 대기 / 일괄 수정 중 / 영향 범위 재검증 대기** 중 어디에서 이어갈지 명시한다. 새 소스에 이전 PASS 수치를 복사하지 않는다.

### 7.4 이전 정리 미완료의 별도 인계

[work9-b §3.6](work9-b.md#36-w9b-0105-windowsweb-구현과-통합-수정--진행-중)과 [§3.18](work9-b.md#318-rangeslider-값-표시기paragraph-연결--해당-흐름-pass--partial)은 자동 승인 검토가 다음 종료/삭제 요청을 **`blocked by policy`**로 거부한 사실을 기록한다.

- `Nelyx/engine/.cache/engine-vTz0Je`, `.nelyx/w9b-current`, `vc140.pdb`의 정리 미완료. 마지막 파일의 정확한 경로는 원래 실행의 소유 범위를 다시 확인해야 한다.
- 당시 helper PID **32240** / browser PID **21152**, `%TEMP%/nelyx-w9b-indicator-screen-1JLlzA/screen.png`, `%TEMP%/playwright_chromiumdev_profile-tytH2I`의 종료/삭제 미완료.

이번 문서 이관에서 process·경로의 현재 존재/소유권은 재확인하지 않았고 종료/삭제를 시도하지 않았다. 과거 PID를 현재 소유 process로 간주하거나 승인 거부를 우회하지 않는다. 향후 정리가 필요하면 실제 경로·실행 파일·소유 관계·남은 handle을 먼저 확인하고 미해결 범위를 계속 기록한다. 이 과거 정리 미완료를 새 구현 묶음의 전체 build/run 선행 조건으로 확대하지 않는다.

**2026-11-09 W9C-00 정리:** 각 독립 설치본·tarball은 검증의 `finally`에서 회수했고 browser/server·native 실행도 종료했다. 마지막 임시 검증 root `.nelyx/w9c00-4cUhKP`(진단 ASAN host/Core·수치 fixture·스크린샷)의 재귀 삭제 요청은 자동 승인 검토가 **`blocked by policy`**로 거부했다. 세부 사유는 제공되지 않았으며 삭제를 다른 도구로 우회하지 않았다. 거부 후 읽기 확인에서 이 root는 workspace 안의 2,384 files / 554,420,244 bytes, reparse point 0 / tracked file 0 / 해당 검증 process 0이었다. 이 root는 **정리 미완료**로 남기고 현재 dist와 구분한다. 이전 §7.4 경로/PID의 종료·삭제는 재시도하지 않았다.

**Windows 종료 후속 정리:** 새 진단 root `.nelyx/w9c-trackpad-7cf7c5b`(현재 ASAN host·PDB/DIA resolver·PowerShell/웹 fixture·스크린샷)의 재귀 삭제도 자동 승인 검토가 **`blocked by policy`**로 거부했다. 세부 사유는 제공되지 않았다. 거부 뒤 읽기 확인에서 workspace 내 **2,313 files / 440,084,159 bytes**, tracked/reparse/해당 process **각 0**, 남은 native host **0**이었다. 삭제를 우회하지 않아 이 root도 **정리 미완료**다. 개발·수정·빌드·실행 검증은 완료했으며 거부된 작업은 임시 root 삭제다. 앞서 거부된 root와 과거 PID의 종료·삭제를 재시도하지 않았다.

### 7.5 이번 메뉴·그림자·구조 진단 산출물 정리 차단

현재 실행에서 만든 `.nelyx/w9c-menu-shadow-207c08d3`는 **120 files / 158,605,505 bytes**, tracked/reparse/process **0/0/0**을 확인하고 해석된 절대 경로가 workspace 안의 정확한 대상과 같음을 검사했다. 해당 경로의 PowerShell `Remove-Item -LiteralPath ... -Recurse -Force` 1회는 실행 전 자동 승인 검토의 **`blocked by policy`**로 거부됐다. 삭제 완료로 기록하지 않으며 다른 셸·스크립트·언어로 우회하거나 재시도하지 않는다. 앞 절의 이전 차단 경로도 재시도하지 않았다. 실제 트랙패드 확인 창은 이전 fixture를 읽어 일반 CLI로 실행한 별도 앱이며, 이 임시 디렉터리를 사용하지 않는다.

### 7.6 problem.md 구조 수정 검증 임시 자료 정리 차단

이번 실행 소유 `.nelyx/problem-rz7JpF`에 대해 저장소 내부 절대 경로·tracked·reparse·실행 프로세스 검사 후 삭제하는 PowerShell 명령을 요청했으나, 명령 실행 전 자동 승인 검토가 `blocked by policy`로 거부했다. 세부 사유는 제공되지 않았다. 다른 shell/API로 삭제를 우회하지 않았다. 이후 읽기 전용 확인에서 **115 files / 124,408,990 bytes / tracked 0 / reparse 0 / 해당 경로 실행파일 프로세스 0**이었다. 테스트 및 자체 실행 Demo는 종료했다. 현재 공급과 앱 번들은 갱신됐으며 이 임시 디렉터리만 정리 미완료로 남는다. 이전 §7.4–7.5 경로의 상태도 그대로다.

### 7.7 증분 캡처 검증 자료 정리 차단

이번 소유 `.nelyx/retained-rdQYDQ`의 절대 경로와 5 files / 1,120,407 bytes, tracked/reparse/process 각 0을 확인했다. PowerShell 재귀 삭제 요청은 자동 승인 검토에서 `blocked by policy`로 실행 전 거부됐다. 세부 사유는 제공되지 않았으며 다른 API로 우회하지 않았다. 자체 browser/server/Windows 앱은 종료했으나 이 임시 자료는 정리 미완료다. 현재 dist 및 이전 차단 경로와 구분한다.

### 7.8 Windows 그림자 검증 자료 정리 차단

최종 Windows Demo는 status=0 / reservedBytes=0 / memoryTotal=0 / workersJoined=true 및 dispatcher 종료·native exit 0을 확인했다. 이번 소유 `.nelyx/shadow-XU2Ajw`는 workspace 내 정확한 절대 경로·**13 files / 7,667,459 bytes / tracked 0 / reparse 0 / 해당 process 0**을 확인했다. PowerShell 재귀 삭제는 자동 승인 검토가 `blocked by policy`로 실행 전 거부했다. 세부 사유는 제공되지 않았으며 우회·재시도하지 않아 임시 자료는 정리 미완료다. 현재 dist·앱 번들 및 실제 빌드 공급 `.nelyx/windows-hermes`는 유지하고 이전 차단 경로는 변경하지 않았다.

## 8. 전체 완료 체크리스트와 정확한 재개점

- [x] W9C-00의 새 선언/runtime compile·Range custom 소비자·editor 곡선 animation과 수치/취소/종료 계약을 Windows/Web 공급으로 확인했다. 이전 Windows 종료 수정은 §3.1.2, 이후 물리 재발·현재 공급의 기능 검사 및 미해결 장면 준비 지연/Web 메모리 한도는 §3.1.3으로 구분한다. 물리/성능 수락은 남은 범위다.
- [ ] Windows RNW·Android/iOS RN·macOS RNM·Linux RNL 수정 소스를 해당 플랫폼 API의 실제 소비자가 사용하며 출처·의존성·실행 근거를 확인했다.
- [ ] Widget/Element/State가 하나이고 중복 `/v2` 컴포넌트 소비자가 없다.
- [ ] 최종 layout/geometry/hit-test/gesture/scene 권위가 v2 하나이며 구 TS/RN renderer 실행 경로가 없다.
- [ ] 원래 Material/Cupertino theme/State/controller/callback/painter와 실제 전체 catalog가 동작한다.
- [ ] 전체 SDK 서비스·수명·VM·공개 host API·reload/loss·미해결 동기/custom 계약을 해결했다.
- [ ] 기본 create/doctor/build/run/dev/pack·config/template·Testbed/Demo가 같은 App/engine 공급을 사용한다.
- [ ] 원래 API 834 subpath 대응·서명 의무와 명시적 계약 변경을 빠짐없이 판정했다.
- [ ] 대상/profile별 최신 공급·설치 소비·기능·복구·종료와 W9-13 기술 gate를 충족했다.
- [ ] 대상/profile별 W9-14 물리 입력·표시·성능·기본값 전환을 수락했다.
- [ ] 후속 플랫폼 대체/지원 범위를 확정하고 구 runtime·공급·불필요 dependency·배포 파일을 제거했다.
- [ ] 생성 소유권·출처·README·CLI help·work 문서가 실제 지원 상태와 일치하고 정리 미완료를 처리 또는 명시했다.

**현재 상태:** **문서 OPEN / W9C-00 구조 병목 수정·통합 검사 통과·물리 체감 재확인 대기 · 전체 PARTIAL**. 현재 공급과 그림자 검증은 §3.1.6 및 `problem.md` §10이다. 증분 캡처 검증은 §3.1.5/§9에 구분한다. 새 선언·custom Range·editor Curve/취소·종료의 이전 소비 근거는 §3.1.1–2, 이후 물리 입력의 eventOverflow·listSeek busy·transaction budget 실패와 lazy 상단 복원·메뉴 지연은 §3.1.3에 구분한다. `fad4be8d…`와 후속 공급의 과거 자동 PASS를 현재 물리 입력 성공으로 확대하지 않는다. 전체 **compatible=false**, 두 성능 flag **false**, 물리/display/scanout **notVerified**, Android **stale/notVerified**, Linux·iOS/macOS **DEFERRED**다.

**다음 시작점:** §3.1.6의 현재 App 번들과 공급에서 실제 트랙패드로 목록 왕복·메뉴 열기/다른 항목 선택·반응 지연을 재확인한다. 재발 시 최초 opcode/status와 desired/active/published 진행·노드/자원 사용을 함께 좁힌다. 이 사용자 보고가 해결되기 전 W9C-01로 넘어가지 않는다. 실제 트랙패드와 버벅임은 아래 일반 명령·같은 화면과 입력으로 PowerShell에서 확인하고 물리 입력/표시/성능 수락과 자동 기능 근거를 구분한다.

```powershell
Set-Location C:\Users\parti\Labo\NelyxLab
node .\Nelyx\sdk\tooling\cli\src\main.mjs run --engine v2 --app .\sample\nelyx-demo-app\engine-v2 --target windows
```

**다음 재개 요청:** `work9-c.md의 W9C-01부터 Windows/Web 작업을 챕터별로 구현하고 각 챕터 끝에 W9C-06 통합 검증·문제 일괄 수정·영향 범위 재검증을 수행해줘. 실제 Windows 조작은 PowerShell로 하고 §3.1.1의 간헐 오류 추적도 유지해줘.`
