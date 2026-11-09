# work9-c — v2 잔여 구현·통합 검증·제품 전환

작성·갱신: **2026-11-09 KST** · 문서 상태: **OPEN / 재개 대기** · 구현 판정: **PAUSED / PARTIAL**

이 문서는 사용자 요청으로 종료한 [work9-b.md](work9-b.md)의 **남은 작업과 정확한 재개 절차를 이어받는 실행 계약**이다. W9B-00·00-H의 완료와 §3.6–3.21의 부분 검증 기록은 이전 문서에 보존하고, §3.22의 미검증 Range/editor 초안부터 이어간다. 문서 이관만 수행했으며 제품 구현·빌드·실행은 재개하지 않았다.

**실행 방식:** Windows/Web의 관련 구현과 실제 소비자 연결을 먼저 모은 뒤 **W9C-06 통합 검증 → 문제 일괄 수정 → 영향 범위 재검증**으로 진행한다. 기능·파일·작은 수정마다 전체 빌드·설치·플랫폼 실행을 반복하지 않는다. Android와 후속 플랫폼은 해당 차수에서 같은 방식을 적용한다.

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
| **W9C-06 통합 확인·문제 대응** | W9B-06 · W9A-09 | 구현 묶음의 공급 갱신·설치 소비·실제 앱·복구/종료를 확인. 문제를 모아 수정하고 직접 영향 범위 재검증. W9-13/14 분리 판정 |
| **W9C-07 대상별 기본값 전환·삭제** | W9B-07 · W9A-10 | 해당 API·기술·제품 gate를 통과한 target의 일반 CLI/sample/template 전환. 마지막 구 소비자·중복 Widget·축소 디자인·불필요 export/dependency 제거 |
| **W9C-08 후속 플랫폼·전역 종료** | W9B-08 · W9A-11/12 | Linux·iOS/macOS의 대체 host/API 또는 명시적 지원 범위 확정. 잔여 runtime/공급/빌드/template/배포 제거와 생성·문서 소유권 일치 |

00–05는 필요한 공통 연산·서비스가 준비된 기능부터 같은 차수에서 진행한다. 00을 기능별 전체 제품 검증으로 닫아야 01을 시작하는 구조로 만들지 않는다. 기본 차수는 **Windows/Web → Android/Linux → iOS/macOS**다. 준비되지 않은 후속 플랫폼을 Windows/Web 구현·통합 검증의 선행 조건으로 넣지 않으며 각 대상의 남은 의무와 DEFERRED는 보존한다.

### 3.1 W9C-00 — 첫 재개 구현 묶음

- [ ] `npm.cmd run build:core`로 새 Source 선언과 runtime의 실제 compile 결과를 확인하고 오류를 고친다. 이전 dist 선언으로 발생한 실패와 실제 구현 오류를 구분한다.
- [ ] Range exact custom extension의 등록·선언·미지원 callback 계약을 검토·문서화하고 실제 custom track/thumb/tick/overlay/indicator 소비자를 연결한다.
- [ ] Source painter와 Core의 rect·thumb center·track gap·paint·label 배치를 대조하고 enabled/discrete·RTL·overlap/horizontal shift·text scale·상태 교체/제거·paragraph 수명을 확인한다. Divisions 127 제한을 원래 API 의무에 대응시킨다.
- [ ] Source Curve 데이터 캡처·정확한 reader·기존 56-byte 호환·curve tail·malformed/reserved/depth/node/budget 경계와 Source/Core 수치 일치를 확인한다. 임의 Curve callback 전체 지원으로 판정하지 않는다.
- [ ] Demo에 custom Range와 curved editor animation UI를 연결하고 실제 Source controller/client 소비 경로를 완성한다.
- [ ] Editor request/terminal·중간/최종 offset·duration 0/상한·cancel/supersede/timeout·입력 취소·text 축소/extent/resize·controller 교체·hide/close와 메모리 회수를 확인한다.
- [ ] 구현을 모은 뒤 Core/Material/SDK·변경 engine 공급을 갱신하고 같은 공급으로 설치 소비·Web 두 profile·Windows 실제 흐름을 06에서 확인한다. §3.21 Focus/입력 큐·기존 Range 흐름을 직접 영향 회귀에 포함한다.

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

## 4. 구현을 모은 뒤 통합 검증하는 방식

**기본 묶음은 Windows App SDK·Web single-worker/threaded의 W9C-00–05다.** 모든 플랫폼·834 API·전체 catalog 수락을 기다리지 않고 해당 차수에서 모은 구현과 실제 소비자 연결로 06에 진입한다. 남은 API는 미완료 의무로 유지한다.

| 순서 | 실행 방식 | 판정 |
| --- | --- | --- |
| 1. 구현 범위 모으기 | 현재 diff·§2의 초안·앱 호출 graph·§3의 잔여 계약을 대조하고 실제 확인할 앱/흐름을 정한다 | 필요한 render/control/overlay/service 의존성을 함께 포함 |
| 2. 일괄 구현 | Core → 디자인/서비스 → CLI/대표 앱 순서로 연결. 필요한 문법·타입·국소 compile·schema 정합성만 확인 | 실행 결과는 **검증 대기 / notVerified**. 기능마다 pack·설치·전체 실행하지 않음 |
| 3. W9C-06 통합 검증 | 정적 검사·필요 제품 빌드·공급 identity/hash·설치 소비·§5 실제 흐름을 같은 공급으로 확인 | 첫 실패 후에도 독립적으로 가능한 흐름을 확인해 실패/차단/미실행 목록 수집 |
| 4. 문제 일괄 수정 | 빌드/공급·공통 protocol·앱 진입 차단을 먼저 수정하고 원인/의존성별 나머지를 함께 수정 | 변경이 무효화한 공급·실패 흐름·직접 영향 회귀만 재확인 |
| 5. 차수 판정 | 성공·실패·차단·미실행과 W9-13/14를 분리하고 준비된 다음 차수로 진행 | 준비되지 않은 Linux/Apple DEFERRED·전체 PARTIAL 유지 |

동일 입력의 영향 없는 PASS는 반복하지 않는다. 공통 wire·ABI/schema·자원 수명 변경은 관련 target/profile 확인을 넓히며, App/디자인/CLI만 바뀌면 해당 package/App을 갱신한다. 한 통합 회차에서 현재 공급과 최소 설치 소비자를 공유하고 입력이 바뀌면 필요한 산출물만 갱신한다. 이전 dist/archive/설치본을 누적 보관하지 않는다.

## 5. W9C-06 제품 확인과 수락 경계

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

이 문서 §2–3과 현재 diff·소스·소비자를 읽고 미검증 초안을 이어간다. 아래 첫 제품 빌드는 새 curves 선언으로 runtime을 검사하기 위한 것이며 이후 기능마다 반복할 전체 검증 절차가 아니다.

```powershell
git status --short
npm.cmd run build:core
```

이 단계에서 나온 compile 오류를 수정한 뒤 Range custom 선언·소비자·곡선 editor animation을 함께 연결한다. 이전 engine dist로 현재 초안을 실행한 결과를 새 코드의 검증으로 세지 않는다.

### 7.2 W9C-06 통합 검증에 진입할 때

계획한 구현과 실제 소비자 연결을 모은 뒤 아래 검사와 변경 package 빌드/pack을 묶어서 실행한다. Core 선언 공급을 먼저 해결하고 전체 type 검사를 진행한다. 실패를 모아 수정한 뒤 해당 단계부터 재개한다.

```powershell
npm.cmd run build:core
npm.cmd run check:types
npm.cmd run lint
npm.cmd run format:check
node Nelyx/engine/tools/generate-schema.mjs --check
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
- 구현 중에는 연결 범위와 통합 대기 항목을 간단히 갱신한다. 묶음 종료 시 완료 범위·남은 문제/차단·실행 명령·미실행 대상·현재 공급·정확한 다음 시작점을 기록한다. 새 소스에 이전 PASS 수치를 복사하지 않는다.

### 7.4 이전 정리 미완료의 별도 인계

[work9-b §3.6](work9-b.md#36-w9b-0105-windowsweb-구현과-통합-수정--진행-중)과 [§3.18](work9-b.md#318-rangeslider-값-표시기paragraph-연결--해당-흐름-pass--partial)은 자동 승인 검토가 다음 종료/삭제 요청을 **`blocked by policy`**로 거부한 사실을 기록한다.

- `Nelyx/engine/.cache/engine-vTz0Je`, `.nelyx/w9b-current`, `vc140.pdb`의 정리 미완료. 마지막 파일의 정확한 경로는 원래 실행의 소유 범위를 다시 확인해야 한다.
- 당시 helper PID **32240** / browser PID **21152**, `%TEMP%/nelyx-w9b-indicator-screen-1JLlzA/screen.png`, `%TEMP%/playwright_chromiumdev_profile-tytH2I`의 종료/삭제 미완료.

이번 문서 이관에서 process·경로의 현재 존재/소유권은 재확인하지 않았고 종료/삭제를 시도하지 않았다. 과거 PID를 현재 소유 process로 간주하거나 승인 거부를 우회하지 않는다. 향후 정리가 필요하면 실제 경로·실행 파일·소유 관계·남은 handle을 먼저 확인하고 미해결 범위를 계속 기록한다. 이 과거 정리 미완료를 새 구현 묶음의 전체 build/run 선행 조건으로 확대하지 않는다.

## 8. 전체 완료 체크리스트와 정확한 재개점

- [ ] W9C-00의 새 선언/runtime compile·Range custom 소비자·editor 곡선 animation과 수치/취소/종료 계약을 완성하고 현재 공급으로 확인했다.
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

**현재 상태:** **문서 OPEN / 재개 대기 · 구현 PAUSED / PARTIAL**. W9B-00·00-H 완료와 기존 부분 PASS를 보존하며 Range/editor 초안은 **notVerified**다. Source/dist 불일치와 Core runtime 타입 실패를 이어받는다. 전체 **compatible=false**, 두 성능 flag **false**, 물리/display/scanout **notVerified**, Android **stale/notVerified**, Linux·iOS/macOS **DEFERRED**다.

**다음 시작점:** W9C-00, §3.1·§7.1의 `npm.cmd run build:core`. 새 선언으로 실제 compile을 확인한 뒤 Range extension·실제 Demo·editor animation을 묶어 완성하고 W9C-06에서 공급·설치·제품 확인을 수행한다.

**다음 재개 요청:** `work9-c.md의 W9C-00부터 남은 Windows/Web 구현을 묶어서 진행하고 W9C-06 통합 검증 후 나온 문제를 수정해줘`
