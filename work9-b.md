# work9-b — v2 단일 실행 경로 완성과 제품 전환

작성·갱신: **2026-11-08 KST** · 상태: **PAUSED / 구조 개편 PARTIAL · 재개 대기**

이 문서는 사용자 요청으로 종료한 [work9-a.md](work9-a.md)의 **남은 작업과 재개 절차를 이어받는 실행 계약**이다. 이미 구현한 기반을 다시 만드는 대신 최근 미검증 변경부터 확인하고 Core·디자인·SDK·도구·대표 앱을 같은 실행 경로로 완성한다. 이번 문서 전환에서 제품 구현·빌드·실행을 재개하지 않았다.

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

| 항목 | 문서 전환 시 확인한 상태 |
| --- | --- |
| 미검증 구현 | `rendering/mouse-region.ts`·`widgets/raw-tooltip.ts`의 exact-prototype/exclusive 정책, retained pointer path, Wrap native 설정, Flex baseline, positioned Stack과 관련 scene/codec/Core 변경 |
| 당시 완료한 검사 | Core package build·전체 check:types·변경 C++ 5개 unit의 `/W4 /WX` compile-only. 실제 동작·protocol 통합·설치 소비·host 실행은 **notVerified** |
| Source protocol | ABI 2·schema **3719990506**·layout wire **192 bytes** |
| 마지막 검증 공급 | Windows/Web `engine/dist`와 Android `engine/dist-android`는 source **f26ab2f19156a30d936c2a03f0a2e3aaf027e1e6aea53ad1afe2f0aea27f43a5**·schema **855578348** |
| 현재 소스와 공급 | 이번 읽기 확인에서도 **불일치**. 이전 문서의 source identity 문자열을 현재값으로 사용하지 않고 재개 직전 `sourceIdentity()`를 다시 산출한다 |
| 마지막 원래 Gallery 실행 | 실제 878 modules·original-elements·NotoSansKR/MaterialIcons/CupertinoIcons 사용. Web 두 profile 모두 `_RenderExclusiveMouseRegion`에서 명시 실패했고 close 예약 0·worker 종료 확인 |
| 새 코드의 Gallery 판정 | 실행하지 않았으므로 위 차단의 해소 여부와 그다음 실패 지점은 **미확인** |

이전 공급으로 새 wire 동작을 판정하지 않는다. 공급 갱신 후에도 첫 화면만으로 resize·탐색·controls·전체 catalog를 통과 처리하지 않는다.

## 3. 첫 재개 묶음: W9B-00

**목표:** 최근 작성한 mouse/Wrap/Flex/Stack 코드의 의미와 wire 경계를 검토·보완하고 현재 공급으로 원래 Gallery의 실제 진행 지점을 확인한다. 우선순위는 아래 순서다.

- [ ] 현재 소스·git 상태와 [이전 미검증 기록](work9-a.md#11-현재-구현과-다음-시작점)을 대조한다. 변경이 이미 commit돼 있으면 해당 소스를 기준으로 검토하며 미검증 구현을 검증 완료로 간주하지 않는다.
- [ ] **MouseRegion/Tooltip:** 원래 exact-prototype 설정, 중첩 exclusive 선택, opaque/translucent·child-first hit 경로, enter/exit/hover·이동/제거·capture 경계를 확인한다. Tooltip 위치 delegate와 overlay 연결의 미지원 범위도 확인한다.
- [ ] **Wrap:** 양축 방향·줄/자식 정렬·음수 spacing/runSpacing·bounded/unbounded 제약·overflow clip과 dry/intrinsic 의미를 원래 Source 구현과 대조한다.
- [ ] **Flex baseline:** alphabetic/ideographic·baseline 없는 자식·cross alignment·RTL/수직 제약·dry/intrinsic 경계를 확인한다.
- [ ] **Positioned Stack:** offset/크기 조합·fit/alignment·부모 resize·positioned-only·unbounded·dry/intrinsic 의미를 확인한다. Stack intrinsic이 미해결이면 명시적으로 남긴다.
- [ ] **Protocol/Core:** 192-byte layout·새 event policy의 정상 입력과 malformed/reserved/flag·identity 경계를 확인한다. 실패한 준비와 NACK 뒤 이전 accepted/active scene 및 resource 수명을 보존한다.
- [ ] **영향 회귀:** Source 목록·controller·공유 예산·State/Key·resize/empty/0 높이, LayoutBuilder, TapRegion, Offstage, semantics/route, Snapshot 중 변경된 layout/hit/wire의 영향을 받는 범위를 묶어 확인한다.
- [ ] 필요한 보완 후 Core·Windows/Web 엔진·Android 두 ABI 공급을 갱신한다. 실제 source identity·manifest의 모든 파일 hash·ABI/schema·App service version·font cohort와 원래 API 기준 파일을 확인한다.
- [ ] 새 8개 package의 일회성 설치 소비자에서 실제 TypeScript 7.0.2·NodeNext·ES2022·`types: []`·`skipLibCheck: false`, template·관련 Core/Material/Cupertino/SDK 선언과 CLI doctor/build/pack을 확인한다.
- [ ] Web single-worker/threaded와 Windows HWND/App SDK에서 실제 원래 Widget 앱과 Gallery를 실행한다. 첫 화면·resize·hover/Tooltip·실제 탐색의 성공 범위와 다음 미지원 지점을 기록한다. Android는 두 ABI 빌드와 emulator/실기기 실행 여부를 각각 남긴다.
- [ ] 정상 close·실패 drain의 App dispose·worker join·예약/메모리/holder 회수를 확인하고 임시 App·설치본·archive·browser/server·native 창을 회수한다.

**완료 조건:** 최근 구현에 대한 Source/Core 의미·protocol·설치 소비·대상별 실제 실행 결과가 구분돼 있고 현재 소스와 공급이 일치한다. Gallery의 이전 차단 해소와 새 차단 유무를 실제로 관측한다. 미해결 기능은 다음 묶음에 연결하며 이 단계만으로 전체 catalog나 성능 수락을 선언하지 않는다.

## 4. 남은 실행 단계와 의존성

| 단계 | 선행·이전 단계 대응 | 작업과 완료 조건 |
| --- | --- | --- |
| **W9B-00 미검증 묶음 정리** | 현재 재개점 · W9A-04/05 | §3 수행. 새 layout/hit/wire의 의미와 공급을 맞추고 원래 Gallery의 실제 차단 상태 확인 |
| **W9B-01 Core 실행 이관** | 00 · W9A-04 | 표준 RenderObject의 설정·invalidation·parent data를 최종 TS 실행과 분리. 각 모듈이 native 설정을 소유하고 마지막 TS 실행 소비자 제거 |
| **W9B-02 디자인·접근성 정책 연결** | 01의 필요한 연산 · W9A-05 | 원래 theme/State/painter·controls·폼·route/overlay/localization/assets 실행. 축소 `/v2` 컴포넌트 소비자 종료와 전체 catalog 잔여 추적 |
| **W9B-03 SDK 서비스·수명 완성** | 00/01의 필요한 서비스 · W9A-06 | 공통 session/view/service owner·OS/VM·reload/loss·공개 host API 대응. 실패·취소·늦은 resolve·close에서 실제 terminal까지 보존·회수 |
| **W9B-04 CLI·설정·공급 통합** | 03과 현재 App 경로 · W9A-07 | 공통 target descriptor와 하나의 config/template. 후보 create/doctor/build/run/dev/pack이 같은 App entry·공급 사용. 기본값 전환은 07 |
| **W9B-05 대표 앱 이관** | 01/02/03/04 · W9A-08 | Testbed/Demo의 원래 catalog·상태·탐색·입력·자산 보존. Android sample의 남은 기능 연결. 샘플 UI는 엔진 공급의 필수 입력이 아님 |
| **W9B-06 제품 통합 확인** | 05 · W9A-09 | 생성·설치 앱의 Windows/Web/Android 화면·입력·reload/loss·종료·선언을 확인. W9-13과 W9-14 대상/profile별 판정 분리 |
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

- [ ] Asset/font/text/image/network·buffer의 현재 version·quota·font cohort·credit·업로드 수명을 유지한다. ACK·활성화·host 게시·표시를 구분하고 불확정 ACK/IO/GPU holder는 실제 terminal까지 보존한다.
- [ ] Clipboard/feedback 외 OS 환경·font 알림·lifecycle·VM globals와 언어 의미를 연결한다. Windows evaluator의 TDZ 미동등을 포함한 미해결 VM 계약을 명시한다.
- [ ] Visibility·새 surface generation·device loss·준비 실패·활성 IME/input·FontLoader/image 취소·reload의 실패/복구/재사용을 실제 session에서 확인한다. 일부 fatal drain 성공을 전체 matrix로 확대하지 않는다.
- [ ] 기존 SDK AppDefinition/서비스와 React component·직접 Renderer 주입 API의 대체 또는 명시적 계약 변경을 대응시킨다. 공통 App/client 선언의 React/RN/DOM ambient 의존성을 제거하고 Web 선언은 별도 browser 환경으로 검사한다.
- [ ] 신규 `nelyx.app/1` 설정과 기존 `nelyx.v2.json`·`package.json.nelyx`의 남은 소비자를 이관한다. 설정 공존·의미가 다른 구 VM/renderer 옵션은 명시 실패하며 조용히 버리지 않는다.
- [ ] Hermes/V8/JSC의 VM 선택과 렌더 엔진 선택을 구분하고 미공급 조합은 실패한다. 현재 `--engine v2` 후보 경로를 유지하며 수락 전 기본 CLI를 바꾸지 않는다.
- [ ] Metro의 남은 asset/compiler helper·Hermes bytecode tool을 분리하고 RN bundling/autolinking/Static AOT 구 경로는 마지막 의존성이 끝난 뒤 제거한다. 공통 helper·Skia/CanvasKit/Hermes supplier·license는 보존한다.

## 5. 제품 확인과 전환 gate

| 대상·범위 | 실제 확인할 동작 | 판정 경계 |
| --- | --- | --- |
| Windows HWND·App SDK | 일반 원래 App/Gallery·resize·mouse/key/capture·TSF/UIA·한글/emoji/선택·close | 두 host를 각각 확인. 자동 OS 입력·UIA·GPU screenshot은 물리 touchpad·scanout 수락을 대신하지 않음 |
| Web | Chrome/Edge의 single-worker/threaded·실제 원래 catalog·textarea/ARIA·hover·resize·reload/loss·close | browser/profile별 현재 입력을 확인. 권한을 부여한 context와 사용자 권한 UI 수락을 구분 |
| Android | arm64-v8a/x86_64 공급·일반 설치/run·InputConnection/IME·접근성 virtual node·Activity/visibility·loss/reload·정식 stop | cross-build·emulator·물리 기기를 구분. 기존 PARTIAL 결과를 지우거나 실기기 PASS로 승격하지 않음 |
| 단일 framework·디자인 | State lifecycle·GlobalKey reparent·Inherited/theme·controlled refusal·원래 기본 painter·catalog/상세/form/modal | 최소 App/축소 showcase의 성공은 전체 원래 API·catalog 완료가 아님 |
| 설치·개발/배포 | 설치 package만 사용하는 create/doctor/build/run/dev/pack·조건부 export·strict 선언·source map/실제 graph | repository alias·dist 잔재가 파일 누락·중복 Core identity를 감추지 않아야 함 |
| 수명·복구 | ACK/NACK/불확정 ACK·upload/IO·font/image/GPU holder·진행 중 close·준비 실패·loss/reload | accepted/activated/submitted/presented와 실제 scanout을 구분. 미확정 해제를 성공으로 바꾸지 않음 |
| 성능·기본값 전환 | 실제 일반 명령과 같은 화면/입력 패턴의 scroll/resize·IME 반응·메모리·표시 | 기능 PASS·CPU 시간·합성 입력으로 성능 flag를 올리지 않음. W9-14는 대상/profile별 별도 수락 |

**W9B-07의 전환 조건:** 해당 대상의 원래 API 대응·W9-13 기술·설치/복구/종료·W9-14 제품 전환 조건을 충족한 뒤 기본값을 바꾼다. 현재의 두 성능 flag false와 물리/display notVerified가 남은 범위는 수락 완료로 기록하지 않는다.

**W9B-08의 전역 삭제 조건:** Linux/Apple의 대체 또는 명시적인 지원 범위 결정, 모든 마지막 소비자·공급 의존성 종료가 선행한다. 한 target의 전환을 저장소 전체 삭제 완료로 확대하지 않는다.

## 6. 마지막 소비자 이관 후 제거할 대상

| 대상 | 제거 전 확인할 대체·마지막 소비자 |
| --- | --- |
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

아래는 **구현 재개 시 변경 범위에 맞춰 실행할 현행 명령**이다. 이번 문서 작성에서 제품 빌드·앱 실행을 수행했다는 뜻이 아니다.

```powershell
git status --short
npm.cmd run check:types
npm.cmd run lint
npm.cmd run format:check
node Nelyx/engine/tools/generate-schema.mjs --check
npm.cmd run build:core
npm.cmd run build:engine-v2
npm.cmd run build:engine-v2:android
git diff --check
```

엔진 공급이 현재 Source identity·ABI/schema·실제 파일 hash와 일치한 뒤 원래 Widget Windows App의 일반 경로를 확인한다.

```powershell
$w9bEngineInputs = (Resolve-Path .\Nelyx\engine\dist).Path
node Nelyx/sdk/tooling/cli/src/main.mjs build --engine v2 --app sample/nelyx-engine-v2-android --target windows --engine-inputs $w9bEngineInputs
node Nelyx/sdk/tooling/cli/src/main.mjs run --engine v2 --app sample/nelyx-engine-v2-android --target windows --engine-inputs $w9bEngineInputs
```

Root `run:engine-v2:windows`·`run:engine-v2:windows-app-sdk`·`run:engine-v2:web`는 현재 전환 중인 data Testbed 후보를 사용하므로 원래 Gallery와 구분한다. Android 일반 명령은 실제 선택한 serial·SDK/JDK·ABI를 맞춰 `npm.cmd run run:engine-v2:android -- --device=emulator-5554`로 실행한다. 원래 Gallery/생성·설치 App은 해당 App entry와 graph를 확인한 뒤 같은 CLI로 실행한다.

- 저장소 지침의 **20분 timeout**·보통 **30회 이내** 반복을 적용한다. 변경이 무효화한 검사와 실제 실패를 해결하는 범위만 다시 확인한다.
- 폐기한 독립 `test:*`·`audit:*`·`experiment:*`·측정 harness를 선행 작업으로 복원하지 않는다. 의미 비교·malformed wire 등 필요한 확인은 한 실행의 임시 묶음과 실제 제품 흐름에서 수행한다.
- 현재 dist·실제 build cache·supplier만 남긴다. 검증 로그·immutable receipt·checkpoint/history JSON·이전 dist/staging/archive·독립 설치본·browser profile을 누적하지 않는다.
- 임시 App·archive·설치본·browser/server·listener·native 창은 실행별 최소 범위로 사용하고 성공/실패/중단 모두 `finally`에서 회수한다. 삭제 전 절대 경로와 소유 범위를 확인한다.
- 기능 묶음 종료 시 이 문서에 완료 범위·미해결 의무·실행 명령·미실행 대상·현재 공급 상태·다음 시작점만 갱신한다. 이전 PASS 수치를 새 Source의 근거로 복사하지 않는다.

## 8. 전체 완료 체크리스트와 현재 재개점

- [ ] W9B-00의 최근 미검증 변경을 확인하고 소스·공급·설치 소비·원래 Gallery의 실제 상태를 맞췄다.
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

**현재 상태:** 문서 작성·이관만 완료했다. 제품 구현은 **PAUSED / PARTIAL**, 전체 API **compatible=false**, 물리/display/scanout **notVerified**, 두 성능 flag **false**, Linux·iOS/macOS **DEFERRED**다. 문서 전환 시 소스와 두 공급 manifest의 불일치를 읽기 확인했으며 제품 빌드·실행·수락은 재검증하지 않았다.

**다음 시작점:** §3 W9B-00의 미검증 mouse/Wrap/Flex/Stack 의미 검토부터 시작한다. 사용자 재개 요청 전에는 구현을 자동으로 이어서 실행하지 않는다.

**재개 요청:** `work9-b.md의 W9B-00부터 재개해줘`
