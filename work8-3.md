# Nelyx 엔진 v2 — 공통 C++ 백엔드 설계·구축 계획 — 3부: 구현 순서·검증·완료 기준

설계: **2026-11-04 KST** · 구현 갱신: **2026-11-05 KST** · 상태: **PAUSED / PARTIAL — 그래픽·API/runner·통합 예산 최신 변경 미검증**

[전체 목차](work8.md) · [1부](work8-1.md) · [2부](work8-2.md) · **3부**

**2026-11-05 17:33 KST:** 사용자의 중간 마무리 요청으로 중단했다. 그래픽/합산 ledger의 중간 코어 193개 통과 이후 provider·접근성·일반 runner 소스가 변경됐으며 최신 전체 build/host 검증과 전체 API 이식은 남아 있다. 현재 dist는 이전 공급이다. [2부 현재 중단 상태](work8-2.md#현재-중단-상태)에 실패·미검증 변경·정확한 재개 순서를 기록했다. 사용자 재개 요청 전 자동 진행하지 않으며 아래 과거 검사 결과를 최신 변경의 통과 증거로 사용하지 않는다.

원문 범위: **§15–19**. 전체 설계의 절 번호와 W8 단계 식별자를 유지한다.

## 15. 소스 구조와 의존 방향

다음은 **전체 소스 구조의 설계안**이다. `engine`의 core/protocol·scene·input·scheduler·layout·interaction·bindings·tests, `runtime/engine-client`의 v2 Widget·codec/client, `render/canvaskit-web`·`platform/windows`·`platform/web`를 구현했다. Intrinsic/dry query·편집/semantics와 Windows TSF/UIA·Web DOM/ARIA를 실제 Testbed에 연결했다. 세로 lazy builder/anchor·표준 gesture/control·v2 Material/Cupertino subpath·Navigator/modal·IME 종료 교섭도 연결했다. 전체 framework/디자인 API·Android 호환은 남았다.

```text
Nelyx/
  engine/
    include/nelyx/          # versioned C ABI, opaque handles, capability
    core/
      protocol/            # transaction, validation, epochs, terminal
      scene/               # document, immutable scene, property tree
      layout/              # constraints, flex, sliver, intrinsic/baseline
      text/                # paragraph, font dependency, query
      input/               # route, gesture, scroll model, physics
      animation/           # native motion graph
      semantics/           # scene-linked semantic model
      resources/           # budgets, leases, pressure, retirement
      scheduler/           # input cut, content demand, frame credit
    render/skia/           # scene replay, Graphite/Ganesh, GPU lifetime
    render/canvaskit-web/  # npm CanvasKit public-API adapter, module-local resources
    platform/              # windows, android, apple, linux, web host ports
    bindings/              # runtime-owner JSI binding, Wasm messaging
    tests/                 # core contract, differential, host integration
  runtime/
    framework/             # v2 TS Widget/Element/State/reconciler
    engine-client/         # schema codec, commands, snapshots, errors
    extensions/            # AppDrivenBoundary and declared contracts
  sdk/                     # runner, assets, OS service facade, tooling
  skia/                    # existing vendor sources, patches, supply tooling
packages/material/         # common v2 primitives/motion으로 이식
packages/cupertino/
sample/nelyx-testbed-app-2/ # 동일 기능·동일 입력으로 제품 비교
```

의존 방향은 TS framework→engine-client→ABI, engine core→abstract ports, platform/render adapter→해당 OS/Skia다. Core는 SDK·RN·JSI·Win32를 import하지 않는다. 기존 `Nelyx/skia/native/core`의 검증된 계산·자원 코드를 옮기거나 연결할 수 있지만, 새 엔진의 스케줄·render model을 Skia adapter의 부속 서비스로 넣지 않는다.

소스 생성·공급은 canonical 파일 한 곳에서 수행하고 generated/install 사본을 직접 수정하지 않는다. 신규 npm package 수와 공개 export 재배치는 W8-01에서 확정하되, 내부 경계를 만들기 위해 앱의 import 전체를 무조건 바꾸지는 않는다. [§13.2](work8-2.md#132-점진-이식의-경계)의 engine 선택과 TS module 해석을 같은 빌드 설정에 연결하고 bundle/host의 major·schema를 함께 검사한다. `v2`는 엔진 설계 세대이며 이 문서가 npm publish나 버전 승격을 수행하지 않는다.

## 16. 구현 순서와 단계별 완료 조건

**공통 C++ 코어 → ABI·TS binding → Native/Wasm 실행 → 엔진 기능과 UI 이식 → 통합 검증·공급 순서로 백엔드를 구축한다.** 작은 실제 화면으로 연결과 수명을 일찍 확인하고 모듈별 구현을 확대한다. 현재 트랙패드 증상의 재현·물리 확인·FPS 측정을 백엔드 착수의 선행 조건으로 두지 않는다.

| 단계 | 작업과 산출물 | 완료 조건 |
| --- | --- | --- |
| W8-00 | C++ 백엔드의 모듈·소유권·ABI·대상별 빌드 범위 확정, 기존 소스·공급·API 이식표 작성 | [§1.4](work8-1.md#14-첫-백엔드-완료에-포함할-대상)/[16.2](#162-이식-범위를-잃지-않는-방법)의 필수 범위와 [§16.3](#163-구현-전에-값정책을-고정할-결정표)의 결정표 고정. npm CanvasKit 버전/variant와 [§8.2](work8-2.md#82-text-service) 전용 API 대체·의도한 차이 명시 |
| W8-01 | 독립 engine core·C ABI·transaction·handle·resource ledger·가짜 clock/renderer, TS entrypoint/resolver 계약 구축 | Native와 threaded/non-shared headless Wasm에서 같은 protocol/실패 계약 통과. Unbounded codec·그래프 검증·ACK 유실·중복 ID·준비 시도/승인 뒤 실패·예산 초과·멱등 회수 확인. Bundle/host major·schema 불일치 거부 |
| W8-02 | Windows 자체 host의 고정 배치 box·text·image·clip, 두 Web profile·npm CanvasKit adapter·자동 loader·최소 Android port | 실제 surface·최소 입력·정상 종료. Owner별 비동기 READY·두 engine+공식 CanvasKit 연결·공개 text API·Picture/font/image 전달·canvas 이전/resize·provider credit/게시 stage·[§16.4](#164-web-비격리-배포와-profile-검증표) 초기 배포 검사 확인 |
| W8-03 | Retained scene·scheduler·frame credit·native input/scroll/motion·최소 게시 hit-test/route·고정 coverage 처리 구현 | 실제 surface/게시 snapshot·완료/drain·hide/zero-size/restore 연결. [§16.1](#161-백엔드-연결을-확인하는-최소-수직-구현)의 profile별 독립/협력 실행·연속 input/commit·busy에서 bounded 진행, starvation/lost wake 없음 |
| W8-04 | Native render node·표준 layout·paragraph·invalidation·scene activation 구현 | Unbounded/expand·intrinsic/baseline·텍스트 차등·metrics/extent 변경·같은 document 재준비의 late 결과 검사. 새 scene이 scroll/motion을 되감지 않으며 실패 후 다음 수정으로 복구 |
| W8-05 | TS Widget/Element reconciler·render transaction·list builder/coverage 이식 | Key/State/의존성·reparent·NACK 뒤 최신 diff/handle/dispose 정합성·가변 높이·반전·준비 지연·메모리 한도 유지 |
| W8-06 | 전체 hit-test·focus·native editing document·semantics·Web DOM 편집/platform action 연결 | Gallery 두 열→Mixed 편집→Gallery 복귀, 한국어 composing/undo·키·clipboard·접근성 action과 종료 정합성. EditContext 없는 경로와 trusted browser event 조건도 확인 |
| W8-07 | 표준 control·motion·overlay/navigation·Material/Cupertino 이식 | 필수 기능/API 표의 실제 지원 범위 확인. 표준 control이 매 frame JS paint나 appControlled로 돌아가지 않음 |
| W8-08 | 두 Web profile의 통합 기능과 Android 최소 port·공통 계약, 대상별 graphics 복구 검증 | [§1.4](work8-1.md#14-첫-백엔드-완료에-포함할-대상)/[16.4](#164-web-비격리-배포와-profile-검증표)의 필수 범위·실제 백엔드 작업·기능 회귀 확인. Android 전체 제품과 물리 입력/IME/접근성은 별도 상태 |
| W8-09 | Testbed에서 C++ 백엔드 통합 기능·작업 집계·TS fallback·수명 검증 | [§18.1](#181-엔진-v2-c-백엔드-완료-기준)의 구현/실행/정합성 조건 확인. 최종 공급 gate는 W8-10 뒤 닫고 미지원·미검증/후속 제품 평가를 구분 |
| W8-10 | 백엔드 package·SDK·CLI·template·README 공급 정리 | Native/두 Wasm profile의 실제 설치·실행 identity 일치. V2 명시 선택·Web auto/강제 profile과 비격리 배포 사용법 제공 |

W8-02는 고정 constraints/배치의 최소 node·text provider와 host를 연결하며 완전한 layout/Widget 이식 완료를 주장하지 않는다. W8-04가 표준 layout 의미·invalidation을 완성하고 W8-05 이후가 앱의 builder/State를 연결한다. W8-03의 caret는 준비된 record의 blink overlay 검사이며 실제 편집은 W8-06에서 구현한다.

단계 의존성을 구별한다. W8-02는 최소 입력 packet/생성·변경 연결을 검사하고, W8-03은 입력을 받을 최소 route·게시 snapshot과 미리 만든 coverage/지연 fixture를 포함한다. 따라서 W8-06의 전체 hit-test·편집이나 W8-05의 TS list builder를 기다려야 scroll 검사를 시작할 수 있는 순환을 만들지 않는다. W8-05/06에서는 같은 계약을 실제 가변 목록·전체 입력 대상으로 확대한다.

W8-08의 platform 확대는 Windows 통합 검증과 일부 독립 진행할 수 있지만 platform 미검증을 통합 PASS로 묶지 않는다. 기본값 전환·v1 제거와 체감·성능 평가는 백엔드 공급 이후 [§18.2](#182-후속-제품-기본값-전환과-v1-정리)의 후속 제품 단계에서 판단한다.

### 16.1 백엔드 연결을 확인하는 최소 수직 구현

처음 필요한 화면은 TS transaction으로 만든 box·text·image·clip과 native 입력으로 갱신되는 node다. Native와 Web/Wasm에서 같은 node/protocol이 실제 렌더링·자원 해제까지 이어지는지 확인한다. W8-03에서는 scroll 영역·버튼 motion·텍스트/caret overlay를 추가해 각 엔진 모듈을 연결한다.

필수 연결 검사는 다음을 확인한다.

- TS가 생성·변경·삭제한 node가 C++ document·scene·renderer에 순서대로 반영된다.
- Native/Wasm의 capability·실제 작업 집계와 TS 요청이 일치하고, 요구 기능을 v1 TS 경로로 대체하지 않는다.
- Input·frame credit·content-ready가 해당 native owner에서 처리되고, 제출·완료·취소·stale 결과가 정확하게 종료된다.
- Resize·view close·실패 rollback에서 handle·resource·GPU 참조가 drain된다.
- 같은 document의 metrics/font/device 재준비를 `PreparationId`로 구별하고, skipped epoch를 기다리는 명령·late provider 결과가 정확한 terminal과 회수로 끝난다.

App/Content의 50/100/200ms 지연, 연속 producer/commit, renderer busy 실험은 scheduler·motion 모듈의 **필수 기능 검사**다. 실행 profile별 판정은 다음과 같다.

| 검사 | Native / Web threaded | Web single-worker |
| --- | --- | --- |
| App worker/runtime 지연 | 준비 범위의 입력 소비·property revision·서로 다른 상태의 실제 surface 갱신이 지연 중 진행 | 같은 계약. Engine 진행에 App ACK가 필요하지 않음 |
| Content 지연 | 별도 compositor가 준비된 scene으로 지연 중 계속 진행 | 협력적 지연/분할 작업 사이에는 입력·Render·Content가 진행. 같은 worker를 50/100/200ms 동기 점유시키면 그 구간 정지는 허용하고 `contentIndependent=false`로 확인. 반환 뒤 회복·순서·최신 상태 제출·drain은 필수 |
| 연속 input/commit·renderer busy | 입력 생산 종료 없이 frame 진행, 반복 commit 중 중간 scene 활성화. Busy 중 입력 소비·credit 반환 뒤 최신 상태 제출 | 같은 순서·포화·진행 계약을 유한 task/quota로 검사. 병렬 실행 수치나 특정 FPS는 요구하지 않음 |

준비 범위 밖은 `contentUnavailable`로 분리한다. 두 Web profile의 지연 결과를 합쳐 하나의 독립 진행 PASS로 보고하지 않는다. Single-worker의 동기 점유 허용은 일반 scheduler의 무한 loop·불필요한 blocking wait·회복 실패를 허용하는 규칙이 아니다. 이 실행 계약은 백엔드 완료에 포함하지만, 특정 FPS·물리 트랙패드 체감 수락과 혼동하지 않는다.

작은 scene의 성공은 연결 검증이다. 이후 모듈 구현·Testbed 통합·공급까지 수행해야 백엔드가 완료되며, 성능·물리 입력 수락은 별도로 남긴다.

### 16.2 이식 범위를 잃지 않는 방법

다음 표를 Windows와 **두 Web profile 각각**의 필수 기능표의 최소 틀로 사용한다. W8-00에서 현재 API·Testbed 사용 목록을 연결해 빠진 필수 항목을 채우고, Android에는 [§1.4](work8-1.md#14-첫-백엔드-완료에-포함할-대상)의 최소 port 범위를 적용한다.

| 기능 | 필수 확인 장면/실패 경계 | 구현 단계 |
| --- | --- | --- |
| Protocol·선언 설치 | 최종 그래프 cycle/소속·중복 ID·NACK/승인 뒤 실패·같은 epoch 재준비·skipped epoch 명령·terminal/회수 | W8-01/03/04 |
| TS 선언·State/Key·의존성 | 같은 Key의 상태 보존·reparent·dispose·상속 값 변경·NACK 뒤 최신 diff/handle 재동기화 | W8-05 |
| Layout·text | Box/Flex/Stack/Wrap/Grid·bounded/unbounded/expand 제약·유한한 최종 박스·extent 상태·intrinsic/baseline·다국어/emoji·fallback font 교체·DPI/text scale | W8-04 |
| Paint·자원 | image decode 실패/교체·clip/transform·opacity·shadow·필수 effect·동일 자원 공유/회수·device loss | W8-02/04/08 |
| 입력·scroll/motion | 양 열·nested scroll·반전/종료·programmatic 충돌·실제 extent와 coverage 경계·[§16.1](#161-백엔드-연결을-확인하는-최소-수직-구현)의 profile별 지연/진행 | W8-03/05 |
| List/sliver | 가변 높이·anchor·빠른 방향 변경·느린/실패 builder·stale NeedChildren·bounded retention | W8-05 |
| Focus·편집 | Mixed 12 fields/36 buttons·재클릭 없는 키·한국어 composing/commit/undo·selection/clipboard·scroll 중 caret·Web DOM 입력/권한·trusted event | W8-06 |
| Semantics | 실제 OS/browser proxy 질의·action·focus/value revision·게시 전후 bounds·삭제 node 거부 | W8-06/08 |
| Controls·navigation | W8-00 필수 API 목록·hover/focus/pressed·Material/Cupertino·overlay/modal·route 종료·입력 차단 | W8-07 |
| 다중 view·수명 | 두 view의 quota·독립 close·resize/hide/zero-size와 idle 복귀·reload·late 완료·복구 중 종료/drain | W8-03/06/08/09 |
| 공급·개발 실행 | assets/font/image/shader 공급·현재 package 설치·bundle/host 일치·engine/두 Web profile 선택·실행 identity·[§16.4](#164-web-비격리-배포와-profile-검증표) 비격리 성공/명시 요구 실패 | W8-01/02/10 |

각 항목은 필수 여부·예상 owner/capability·확인 위치와 함께 `notStarted`, `implemented`, `sourceVerified`, `runtimeVerified`, `unsupported`를 **대상별** 기록한다. 물리 입력·체감·성능 검증은 별도 열로 둔다. 필수 항목에 `runtimeVerified`가 없는 경우 그 대상의 백엔드 gate는 미완료다. Progress는 이 루트 work 문서의 짧은 현황에만 반영하고 별도 plans/migrations/checkpoint 기록을 누적하지 않는다.

### 16.3 구현 전에 값/정책을 고정할 결정표

| 결정 | 고정할 내용 | 확정 기한 |
| --- | --- | --- |
| 대상·필수 API | [§1.4](work8-1.md#14-첫-백엔드-완료에-포함할-대상)의 OS/ABI·두 필수 Web profile과 공통 최소 환경·[§16.2](#162-이식-범위를-잃지-않는-방법)의 필수 export/장면과 의도한 API 차이 | W8-00 종료 전 |
| ABI/schema·TS 해석 | Canonical schema 경로·생성기·version 협상·C struct와 wire 분리·정수/float 폭·문자열·unbounded/expand/extent 표현·handle/ID 소진·PreparationId·error/terminal·release API·v1/v2 entrypoint/resolver | W8-01 검증 전 |
| 자원·큐 상한 | Node/depth·transaction bytes·256 input의 슬롯 분할·App/observer/edit/result 큐·scene/retired bytes·session/device 합산 | W8-01 검증 전 |
| 실패·재시도 | 결과 창/ACK 하한·timeout·bounded resource retry·base conflict 재동기화·reload/host 실패 종료 | W8-01 검증 전 |
| Scheduler·scroll·수명 | Tick/content task quota·single-worker 재개 경계와 최대 동기 점유 관측·wake 경합·clock/time 단위·physics 오차·deferred catch-up 속도·gesture/command/anchor 충돌·skipped epoch·hide/zero-size/restore | W8-03 검증 전 |
| 게시·geometry | Port별 publication stage/관측 신호·제출/GPU/publication credit의 차이·snapshot 보유 한도·metrics 전환/입력 fence·canvas backing resize·Web DOM 기본 조작/activation 정책 | W8-02 최소 경로, W8-06 통합 전 |
| Graphics/Wasm 공급 | Native Skia 공급·engine별 toolchain/flags/manifest·npm CanvasKit 버전/variant/integrity·공개 API 대체·module별 heap/worker·비동기 owner/provider READY·Picture/font/image 전달·auto/배포 실패 분류 | W8-02 종료 전 |

표의 값이 아직 미정이라는 사실을 구현자가 임의로 추측해 채운 것으로 숨기지 않는다. 해당 단계에서 canonical 상수/타입과 계약 검사로 고정한 뒤 다음 의존 단계로 넘어간다. 지금 문서의 제안 값은 검증된 최적값이나 기존 제품보다 큰 예산을 허용한 결정이 아니다.

### 16.4 Web 비격리 배포와 profile 검증표

다음은 **구현 후 통과해야 할 검사**이며 현재 실행 결과가 아니다. HTTPS 또는 localhost의 실제 응답 header와 page/worker context를 사용한다. `crossOriginIsolated`나 SAB 전역을 mock한 검사만으로 비격리 실행을 수락하지 않는다.

| 배포/요청 조건 | 필수 결과 |
| --- | --- |
| 유효 COOP+COEP·threaded capability 충족, `auto` | `threaded` 선택·shared memory·실제 Content/Render 작업·작은 화면·정상 drain |
| **COOP/COEP 모두 없음**, `auto` | page/worker의 실제 isolation=false. **`single-worker` 자동 선택 후 화면·입력·font/image·정상 종료 성공**. Threaded 자산/SAB 없이 동작 |
| COOP 또는 COEP 한쪽만 설정 / header가 있어도 정책·embedding 때문에 isolation=false | `auto`는 single-worker. 남아 있는 COEP/CORS 등 자산 제한을 지키며 동작; header 존재만으로 threaded를 고르지 않음 |
| 격리 환경에서 `single-worker` 강제 | 실제 non-shared memory와 engine worker 하나에서 실행. 두 profile에 같은 protocol/기능 corpus 적용 |
| 비격리 환경에서 `threaded` 또는 `contentIndependent` 필수 요구 | 명확한 capability 오류로 시작 실패. 부분 view·pending Promise·worker 누수 없음 |
| 공통 Worker가 CSP로 차단되거나 OffscreenCanvas/worker WebGL2가 없음 | 해당 최소 환경 부족으로 실패. COOP/COEP 누락과 다른 원인을 보고 |
| 선택된 profile의 파일 누락·HTTP/해시/ABI/cohort 오류·초기화 예외 | 공급/시작 오류로 실패. 다른 profile로 바꿔 잘못된 공급을 숨기지 않음 |
| Threaded worker pool/owner/provider 지연·실패·재시작 | 실제 Content/Render realm에서 engine·로컬 CanvasKit/adapter READY 확인. 동기 join 교착·다른 owner로 draw proxy·시작 전 입력/document admission·이전 worker 상태 승계 없음 |
| npm CanvasKit의 고정 JS/Wasm·공개 paragraph API | 두 engine profile에서 같은 npm 원본/variant를 사용. 전용 `nelyxParagraphApiVersion` 없이 [§8.2](work8-2.md#82-text-service)의 text/caret/soft-hyphen corpus와 공개 지원 범위 확인 |
| Threaded Content→Render의 Picture/text/font/image 전달 | 같은 CanvasKit npm build 사이의 직렬화/복원·바이트 상한·resource 수명·정확한 glyph/paint 확인. Module-local handle 교차 사용 없음 |
| Canvas 이전/context 생성 실패·재시도·옛 worker의 late 메시지 | 실패 terminal·port/worker 정리·세대 차단. 필요시 새 canvas/view로 시작하며 이전 engine 중복 실행 없음 |
| 이전 뒤 CSS/DPR/backing resize·zero-size→restore | Main은 CSS/metrics만 전달하고 Render가 OffscreenCanvas/surface를 갱신. HTML placeholder의 width/height 대입·DOM software fallback 의존 없음. 같은 metrics의 게시/입력과 App commit 없는 복귀 확인 |
| GPU 완료를 공개하지 않는 provider의 flush/게시 | 제출 credit·안전한 provider release·관측 수준을 구별. `flush`/메시지를 GPU fence나 실제 표시로 기록하지 않으며 엔진 hold 상한과 종료 회수 확인 |
| EditContext 없음·실제 copy/paste/focus·activation/권한 거부 | 같은 document revision의 DOM 입력으로 필수 편집 성공. Main의 게시 정책과 worker 검증 일치·조합 중복/취소·실패 terminal 확인. 임의 worker 메시지를 trusted 입력으로 간주하지 않음 |
| 두 profile의 resize·hide/resume·context loss·reload/close | 같은 profile에서 복구/실패·resource credit·게시 geometry·drain 정합성 확인 |

W8-02는 이 표의 초기 선택·공급·작은 화면을 확인하고, W8-03은 [§16.1](#161-백엔드-연결을-확인하는-최소-수직-구현) scheduler를, W8-08은 두 profile에서 [§16.2](#162-이식-범위를-잃지-않는-방법)의 전체 필수 장면과 복구를 확인한다. 격리된 개발 서버만 성공하거나 threaded만 실행한 결과로 Web 백엔드를 완료하지 않는다.

## 17. 백엔드 검증·공급과 후속 제품 평가

### 17.1 기존 제품의 재현 명령

다음은 현재 존재하는 **v1 재현·비교용 명령**이다. 후속 제품 비교에 참고하며 백엔드 구축의 착수 조건은 아니다. 이 문서에서는 실행하지 않았다.

```powershell
# 사용자의 평소 실행 경로
npm.cmd run run:windows --workspace @nelyx/testbed-2

# work7의 수정 공급을 확인할 때의 별도 C++ scroll 경로
npm.cmd run run:windows:cpp -- --module=scroll
```

V2 앱 실행 선택·CLI option은 구현 전이다. 현재 headless 명령은 `npm.cmd run test:engine-v2`와 `npm.cmd run build:engine-v2`이며 실제 앱 실행을 제공하지 않는다. W8-01/02에서 parser→capability→실제 host→실행 보고를 연결한 뒤 앱 명령을 문서화한다. `--engine=v2` 같은 미구현 option을 현재 사용할 수 있는 명령으로 안내하지 않는다.

### 17.2 계층별 검사

백엔드 완료 검증은 공통 C++ 코어·ABI·TS 연결·Native/Wasm 빌드·실제 실행·기능·자원 수명·공급을 중심으로 한다. 아래의 물리 확인과 제품 성능 비교는 별도 평가이며, 서로 다른 검증을 하나의 완료 상태로 합치지 않는다.

| 계층 | 확인할 내용 | 대신할 수 없는 확인 |
| --- | --- | --- |
| Core contract | handle 재사용·schema/overflow·승인 전 rollback/승인 뒤 실패·중복 ID/ACK 유실·bounded queue·dirty 전파·physics 재생 | 실제 platform input·GPU·display |
| Differential | 같은 constraints·text·sample stream에서 v1 의미와 비교. 의도한 v2 API 차이는 명시 | 전체 제품 성능 |
| Host integration | 실제 frame credit·resize·late completion·IME/semantics proxy·device loss·close/drain | 사용자의 물리 트랙패드 체감 |
| 구조 실험 | [§16.1](#161-백엔드-연결을-확인하는-최소-수직-구현)의 profile별 독립/협력 진행·계속 생산되는 입력/commit·renderer busy 회복 | 전체 Testbed 성능 |
| Web 배포 | [§16.4](#164-web-비격리-배포와-profile-검증표)의 실제 격리/비격리 응답·profile 선택·memory/worker·두 빌드의 실제 기능 실행 | 다른 profile의 지원·제품 성능 |
| Testbed 제품 | 전체 기능·양 열 범위·편집 복귀·공급 identity·메모리와 실제 surface 갱신 | 다른 장치·다른 OS의 지원 수락 |
| 물리 확인 | 같은 일반 실행에서 접촉 시작·연속·반전·관성·재접촉·체감 | 모든 장치·장시간·scanout 보장 |

Node 검사는 저장소 지침대로 **20분 timeout**, 즉 `--test-timeout=1200000`을 사용한다. 새로운 core 검사는 구현 계약에 맞춰 만들고, 기존 `test:input-geometry`, `test:retained-input-geometry`, frame backpressure/visual commit·scroll·runtime close·native shadow 회귀는 관련 경로 변경 시 유지·이식한다. 검증이 실패하면 범위를 확인해 수정하고, 통과한 검사를 이유 없이 수백 번 반복하지 않는다.

Native/Wasm 계약 검사는 같은 입력 corpus를 사용한다. Layout/physics의 double 오차·text metrics/font 조건을 비교 전에 고정하고, 의도한 API 차이·platform font 차이를 명시한다. 필수 잘못된 packet·순서·동시성 interleaving·포화·OOM/device loss를 한정된 결정적 fixture로 검사한다. 지원 toolchain에서는 sanitizer로 use-after-free/data race를 확인하되 source 검사나 sanitizer 통과를 실제 host 실행으로 대신하지 않는다. Native 검사에도 20분 실행 한도를 적용한다.

재검토에서 추가한 필수 실패 경계도 같은 단계의 검사에 포함한다.

| 경계 | 필요한 결과 |
| --- | --- |
| Unbounded/expand·추정/무한 extent·NaN/Infinity 오입력 | 의미 태그 왕복과 부모 제약 결합 보존. 최종 박스/좌표는 finite, 잘못된 packet은 NACK/layout 실패 |
| Create/reparent/destroy transaction NACK | 기존 document/scene 보존·staging hold 회수·TS State/Key/handle/dispose 정합성. 최신 선언의 다음 diff로 복구 |
| 같은 epoch의 font/metrics/device 재준비·skipped epoch 명령 | 준비 시도별 terminal 한 번·late 결과 분리/해제·후속 호환 scene에서 명령 실행 또는 명시적 취소 |
| Data 포화 중 focus/metrics/close fence·idle/hide/zero-size 복귀 | 이전 stream 종료와 packet accounting 보존·App 응답 없는 redraw/종료·마지막 metrics의 게시 |
| Bundle/host major 또는 schema 불일치 | 첫 document 승인 전 시작 실패. V1 framework가 연결된 채 v2 실행으로 보고되지 않음 |

Web의 thread/memory·owner·선택 사유와 실제 C++ layout/scroll/compose 작업 수를 profile별로 대조한다. CanvasKit의 공개 graphics/text 호출은 선택한 provider 실행으로 별도 집계하며 v1 TS layout/paint fallback과 구분한다. Single-worker를 v1 TS fallback으로 집계하거나, threaded 미실행을 non-shared의 성공으로 감추지 않는다.

### 17.3 후속 제품 성능 비교 — 백엔드 완료와 별도 평가

이 절은 백엔드 구축 후 제품을 평가할 때의 참고 절차다. 기존 스크롤 문제 해결·60fps·물리 trackpad 확인을 백엔드 구현 완료의 조건으로 추가하지 않는다.

아래 60fps 제품 기준은 native/threaded의 평가에 적용한다. Web single-worker는 [§16.2](#162-이식-범위를-잃지-않는-방법)/[16.4](#164-web-비격리-배포와-profile-검증표)의 기능·정합성 검사를 통과하면 비격리 환경의 기능 지원으로 공급할 수 있고, 60fps 달성을 그 지원의 전제조건으로 두지 않는다. 성능 측정은 같은 브라우저/콘텐츠/graphics·profile과 격리 조건을 명시해 별도로 비교하고, 낮은 FPS/Content 점유 지연을 공개한다. 기능 지원을 threaded와 같은 성능 수락으로 표시하지 않는다.

- 기준 조건은 현재 모니터·해상도·배율·창 크기·Release·optimized·Hermes bytecode·같은 콘텐츠/기능/physics다. VM 교체·AOT·진단 instrumentation을 동시에 섞지 않는다.
- V1 RNW와 v2 자체 host의 차이는 host 교체까지 포함한 제품 비교로 표기한다. 지원 가능한 장면에서는 v1 자체 host와도 같은 VM cohort로 비교해 engine 기여를 분리한다. 그 control이 없으면 모든 이득을 엔진 단독 효과라고 단정하지 않는다.
- 주 장면은 [work6](history/26/11/03/work6-summary.md)의 All components 양 열 전체 예열·top→실제 bottom·중간 section coverage다. 새 v2 관측도 같은 표시 ID·extent·resource 준비와 실제 표시 구간을 확인한다. 작은 반복 구간이나 eager 전환으로 대신하지 않는다.
- Mixed의 버튼·hover·focus·한국어 입력·편집 복귀와 일반 ListView/Cupertino, 정지→시작→10초 이상 연속→반전→관성→재접촉을 포함한다.
- 기본은 기준/후보 **3쌍**이다. 실행 중 빌드·다른 성능 도구를 병렬 수행하지 않는다. 실제 trackpad와 OS wheel은 입력 source를 구별하고 서로의 실행 증거로 대체하지 않는다.
- Surface에 실제로 반영된 서로 다른 이동 상태의 갱신 수/시간과 대상·표본을 기록한다. CPU callback·native wake·제출·반복된 동일 화면만으로 60fps를 계산하지 않는다.
- Warm 일반 이동은 60fps 기준으로 판단하고, 새 콘텐츠 준비 구간의 일시적 jitter는 별도로 표시해 허용한다. 준비 후에도 계속되는 정지·입력 불응·지속적인 60fps 미만은 허용 예외로 처리하지 않는다.
- 입력 수집→엔진 소비→property 반영→submit→surface commit의 지연과 CPU/GPU·p95/p99·max는 원인 분석값이다. 센서/scanout 시각을 관측하지 못하면 추정값을 해당 시각으로 이름 붙이지 않는다.
- 메모리는 같은 장면·이동·복귀에서 ledger와 process/GPU 관측을 함께 본다. 모든 위젯 keep-alive·무제한 tile·많은 frame queue로 얻은 FPS를 같은 예산의 개선으로 쓰지 않는다.

일반 사용 기준을 만족하면 **관측된 platform·scene·입력 source의 범위로** 수락할 수 있다. 미관찰 scanout이나 개별 GC 시간을 추가로 알아야 한다는 이유만으로 이 수락을 무조건 막지 않는다. 반대로 자동 surface 수치가 좋아도 사용자가 실제 연속 입력의 정지를 확인하면 해당 물리 입력 경로를 성공으로 표시하지 않는다.

### 17.4 공급과 정리

현재 canonical source·engine ABI·runtime/compiler·Skia vendor·native library/Wasm·SDK·설치본·실행 package와 TS bundle/module graph의 identity를 연결한다. V2 선택과 실제 native node/layout/scroll/compose 작업을 장면 안에서 확인한다. Native 작업 0·관측 누락·v1 fallback은 실행/성능 판정 실패 또는 명시적인 control이며 성공이 아니다.

Web package에는 두 engine profile의 현재 공급물·공통 npm CanvasKit 자산·배포 index를 포함하고 module/profile별 실행 identity를 연결한다. npm 버전·variant·lock integrity·배포 byte identity와 자체 engine ABI를 따로 확인한다. 이는 과거 dist 사본 보관과 다르며, 정리 과정에서 필수 non-shared 공급을 삭제하지 않는다. SDK/template·문서는 기본 `auto`와 비격리 지원 조건·강제 선택·공개 API 차이·시작 실패 사유를 함께 제공한다.

필요한 작은 진단은 opt-in·bounded로 만들고 일반 성능 실행에서는 끈다. 임시 fixture·runner entry·staging은 한 실행 범위에서만 만들고 성공·실패·중단 시 finally로 정리한다. 현재 dist/package만 남기며 과거 receipt·로그·설치본·별도 archive를 누적하지 않는다. `Nelyx/docs/plans/`·`Nelyx/docs/migrations/`를 생성하거나 복구하지 않는다.

V1 제거·파일 이동·큰 cleanup은 이식 gate 통과 후 대상 목록과 preview를 먼저 확인하는 별도 단계다. 설계 문서 작성이나 새 core prototype을 이유로 현재 코드를 일괄 삭제하지 않는다.

## 18. 백엔드 완료와 후속 제품 전환

### 18.1 엔진 v2 C++ 백엔드 완료 기준

1. **공통 코어:** [§1.1](work8-1.md#11-주목표--엔진-v2-c-백엔드-구축)의 엔진 모듈과 상태 소유권이 실제 C++ 코드로 구현되고, TS와 중복된 권위 상태 없이 작동한다. [§16.1](#161-백엔드-연결을-확인하는-최소-수직-구현)의 profile별 App/Content 지연·연속 input/commit·busy 검사가 독립/협력 진행·회복을 확인한다.
2. **연결:** Versioned ABI·transaction·TS binding·SDK가 초기화·변경·질의·오류·종료를 연결한다. 명시적으로 요구한 capability 누락은 시작 단계에서 실패하고, Web `auto`의 비격리 선택은 허용된 single-worker로 처리한다. ACK 유실·승인 뒤 실패·재동기화에도 선언을 중복 적용하거나 대기를 무한히 남기지 않는다.
3. **실행:** Windows와 Web threaded/non-shared single-worker 각각이 같은 코어 계약과 [§16.2](#162-이식-범위를-잃지-않는-방법)의 필수 통합 장면을 실행하며 Android는 [§1.4](work8-1.md#14-첫-백엔드-완료에-포함할-대상)의 최소 port 검사를 통과한다. Web은 [§16.4](#164-web-비격리-배포와-profile-검증표)의 COOP/COEP 없는 자동 실행도 필수다. 장면 안의 native/Wasm 작업과 SDK 요청·TS fallback을 대조한다. 선택하지 않은/수요가 없는 모듈은 control로 구분한다.
4. **정합성·수명:** 고정한 필수 기능·세대/순서·승인 전 rollback/승인 뒤 복구·게시 단계와 입력 geometry·자원 예산·GPU/platform drain의 검사가 통과한다. 필수 미지원/미검증을 목록에서 빼서 통과시키지 않는다.
5. **공급:** 재현 가능한 빌드·현재 package·설치본·runner가 같은 backend identity를 사용하고, 사용자가 v2를 명시적으로 선택해 실행할 수 있다. Web은 두 engine profile과 수정하지 않은 npm CanvasKit 공급·자동/강제 선택·공개 text/graphics API·실제 worker·격리/비격리 headers·자산 조건에서 확인하며 headless compile만으로 완료하지 않는다.

백엔드 구현 완료와 제품의 물리 입력·체감·성능 수락은 별도 상태로 보고한다. 물리 확인이나 특정 FPS가 미검증이라는 이유만으로 백엔드 구현 작업을 미완료로 고정하지 않으며, 반대로 백엔드 완료를 제품 성능 개선의 증거로 쓰지 않는다.

### 18.2 후속 제품 기본값 전환과 v1 정리

백엔드 공급 뒤 일반 제품의 기본값을 전환할 때는 platform별로 다음 조건을 별도 확인한다.

1. **구조:** Native/threaded는 준비된 표준 화면의 입력·motion·합성에 App/Content 응답이 필요하지 않다. Single-worker는 App 독립·Content와의 협력 실행 및 동기 점유 뒤 회복을 제공한다. [§16.1](#161-백엔드-연결을-확인하는-최소-수직-구현)의 profile별 실제 지연 실험과 C++ 작업으로 확인한다.
2. **정확성:** 해당 platform 기능표·Testbed·입력/geometry·편집/접근성·자원/drain의 필수 회귀가 통과했다.
3. **체감·성능:** Native/threaded는 현재 설정의 일반 사용 60fps와 실제 연속 입력의 사용자 확인을 해당 범위에서 받는다. Single-worker의 기능 지원은 60fps 수락에 종속하지 않고 성능·지연 제한을 명시한다([§17.3](#173-후속-제품-성능-비교--백엔드-완료와-별도-평가)). Lazy 준비 예외와 남은 미검증은 profile별로 공개한다.
4. **공급:** SDK·CLI·template·현재 설치본과 실행 package가 같은 engine을 선택하고 실제로 실행한다.
5. **이식:** 공개 API 변경과 미지원 기능이 타입·문서·migration 목록에 드러나며, 사용 가능한 기존 앱의 이식 경로가 있다.

위 gate 전에는 기존 normal 제품을 유지하고 v2를 별도 후보로 실행한다. 특정 platform gate가 통과하면 그 platform의 기본값을 전환할 수 있지만 다른 platform까지 제품 지원 완료로 표시하지 않는다. V1 제거는 사용되는 기능과 이식 범위를 확인한 뒤 수행한다.

**이 작업의 완료 대상은 Native와 Web/Wasm에서 사용할 수 있는 Nelyx 엔진 v2 C++ 백엔드다.** 상태 소유권·ABI·TS 연결·기능·수명·공급을 구현·검증하고, 그 기반 위의 제품 체감·성능과 기본값 전환은 별도로 평가한다.

## 19. 작성 시점의 상태

**PARTIAL / 연결 실행 확인:** 사용자의 재개 요청으로 Windows와 두 Web profile의 최소 고정 배치 host·화면·owner 연결을 구현·검증했다. 전체 백엔드 gate와 물리 입력/성능은 별도다. 최신 실행·수치·미완료 범위는 [1부 연결 실행 현황](work8-1.md#연결-실행-현황)에 있다.

| 항목 | 현재 상태 |
| --- | --- |
| 저장소 지침·기존 work 기록·관련 소스 검토 | 완료 |
| 주목표 | 엔진 v2 공통 C++ 백엔드 구축으로 정리 |
| 기존 스크롤·성능 요구 | 짧은 배경과 후속 제품 평가로 분리 |
| v2 책임·실행 owner·protocol·스크롤/scene 정합성 설계 | 기본 property/overlay·승인 뒤 실패·연속 commit starvation·재시도 계약 구체화 |
| UI API·custom extension·편집/접근성·가상화·Web 경계 | 게시 관측 수준·입력 route·편집 revision·coverage 정책·worker/context 조건 구체화 |
| Web COOP/COEP 부재 지원 설계 | Non-shared single-worker를 필수 범위로 변경. 별도 빌드·기본 auto·capability/공급 오류 구분·Content 점유 제한·실제 비격리 검사 정의 |
| Web CanvasKit 공급 방침 | npm 공식 배포본 사용으로 변경. 자체 engine/CanvasKit module 분리·retained adapter·전용 text API 이식·Picture 전달의 초기 검증 gate 정의 |
| 3부 문서 재검토 | 현재 source/타입·공식 Flutter/Emscripten/HTML 계약 대조. 제약/finite·준비 시도·NACK·Web READY/resize/credit·DOM 입력·bundle 선택·검증 단계 보강 |
| 구현 순서·최소 수직 구현·백엔드 완료·후속 제품 전환 | 플랫폼/두 Web profile별 필수 범위·기능표·독립/협력 실행 gate·기능 지원과 성능 수락 구분 |
| 문서의 링크·구조·공백 검사 | 현재 work 문서와 관련 README의 로컬 링크/앵커·공백 검사. 최신 집계는 2부 참조 |
| 새 engine/runtime·ABI·Wasm 공급·CLI 구현 | C++/C ABI·공개 Core/SDK·layout/intrinsic/dry query·leaf padding·compositor caret clock·Widget/State/Key diff와 예외 복구·native editing/semantics·Windows TSF/UIA·Web DOM/ARIA와 실제 Testbed. 코어 계약·UIA/DOM 편집·glyph geometry/pixel·owner·입력 geometry 회귀를 검사. 최신 수치와 [남은 계약](work8-2.md#2026-11-05-잔여-작업-재검토)은 2부 참조 |
| W8-00/01 전체 gate | PARTIAL. ABI/수치·실제 owner transport·현재 공급 구현. 전체 public API 의미·Android ABI·일반 Widget resolver/runner 이식은 남음 |
| W8-02/03 실제 surface·독립 실행 | Windows와 Web 두 profile의 고정 배치 box/text/image/clip·input·App/Content 50/100/200 ms 지연·resize/복구·close 통과. Coverage 코어 추가. 세로 lazy/anchor와 표준 gesture·control·IME 종료 교섭을 추가. Android·전체 gesture/API와 통합 기능표는 미완료 |
| 새 성능 측정·앱 빌드/실행·물리 트랙패드 확인 | 현재 v2 host/App 빌드·실행·자동 input·화면 확인. FPS/제품 성능·물리 trackpad는 미검증 |
| 일반 App 기본값·기존 후보 판정 | 변경 없음: TS / NO_ADOPTION |
| 기존 제품 수락 | PARTIAL, `performanceAccepted=false`, `resizePerformanceAccepted=false` 유지 |
| v2 성능·물리 입력 수락 | notVerified |

심화 검토에서 수정한 핵심은 다음과 같다.

| 발견한 빈틈 | 반영한 계약 |
| --- | --- |
| 새 document마다 준비 취소 시 scene 활성화 starvation | 고정된 진행 작업과 최신 후속 수요·중간 활성화·연속 commit 회귀 ([§5.3](work8-1.md#53-취소coalescing재진입)/[6](work8-1.md#6-프레임-일정과-backpressure)/[16.1](#161-백엔드-연결을-확인하는-최소-수직-구현)) |
| DocumentAccepted 뒤 오류·ACK 유실 시 상태 불명 | 승인 전/후 실패 분리·bounded 멱등 결과·재동기화·명령 terminal ([§5.4](work8-1.md#54-승인후속-실패재시도의-terminal)/[5.5](work8-1.md#55-c-abi와-transport의-최소-계약)) |
| Content 기본값과 compositor 상태가 충돌 | Property identity/overlay·scroll 명령/anchor·motion 교체 규칙 ([§4.3](work8-1.md#43-scene의-기본값과-실행-중-property의-결합)/[7.4](work8-1.md#74-새-콘텐츠가-이전-스크롤로-되돌리지-않게-한다)/[9.2](work8-2.md#92-표준-motion)) |
| GPU 제출·host 게시·실제 표시의 혼동 | Port별 publication stage·관측 없는 commit ID 금지·입력 snapshot 고정 ([§6.2](work8-1.md#62-상한과-frame-교체)/[10.1](work8-2.md#101-화면과-같은-property를-사용한다)) |
| 입력·App 이벤트·게시 작업의 숨은 무제한 대기 | 합산 상한·포화 accounting·처리 quota·lost wake/종료 경합 ([§6](work8-1.md#6-프레임-일정과-backpressure)/[7](work8-1.md#7-입력제스처스크롤을-엔진-상태로-만든다)/[11.3](work8-2.md#113-예산과-해제)) |
| 미준비 list의 반전·손 뗌 이후 이동 의미 미정 | Requested/visual 분리·한 viewport 목표·end/cancel 폐기·ancestor handoff ([§7.4](work8-1.md#74-새-콘텐츠가-이전-스크롤로-되돌리지-않게-한다)/[11.2](work8-2.md#112-준비-범위를-넘어갈-때의-정책)) |
| Web 최소 compile과 제품 실행의 간격 | Profile마다 하나의 engine/document·context affinity·DOM 조작·실제 배포 gate ([§12.2](work8-2.md#122-web)/[16.4](#164-web-비격리-배포와-profile-검증표)) |
| COOP/COEP 부재 시 선택 모드라 동작을 보장하지 못함 | Non-shared 공급·기본 auto·같은 필수 기능표·비격리 실배포 성공을 완료 기준에 포함 ([§1.4](work8-1.md#14-첫-백엔드-완료에-포함할-대상)/[12.2](work8-2.md#122-web)/[16.4](#164-web-비격리-배포와-profile-검증표)/[18.1](#181-엔진-v2-c-백엔드-완료-기준)) |
| Pthread 바이너리의 thread만 끄는 전환 불가 | 같은 소스를 별도 compile/link하고 profile별 manifest·memory·worker identity 검사 ([§12.2.2](work8-2.md#1222-두-빌드와-공급-identity)) |
| npm 의존성이 있어도 실제로는 전용 CanvasKit을 요구 | v2는 수정하지 않은 npm 배포본 사용. 자체 engine 두 빌드와 공통 CanvasKit 공급·module/worker별 heap·공개 API 이식·준비 resource 재생으로 변경 ([§8.2](work8-2.md#82-text-service)/[9.1](work8-2.md#91-scene에-오래-보유할-것)/[12.2.2](work8-2.md#1222-두-빌드와-공급-identity)/[12.2.6](work8-2.md#1226-enginecanvaskit-adapter와-retained-자원)) |
| Single-thread에도 Content 독립 실행을 요구하는 모순 | Owner 책임과 물리 thread 분리·협력적 scheduler·동기 점유 제한·profile별 검사/성능 공개 ([§4.1](work8-1.md#41-네-개의-주요-owner)/[6.1](work8-1.md#61-엔진이-계속-움직일-수-있는-조건)/[12.2.4](work8-2.md#1224-single-worker-scheduler와-전송)/[16.1](#161-백엔드-연결을-확인하는-최소-수직-구현)/[17.3](#173-후속-제품-성능-비교--백엔드-완료와-별도-평가)) |
| Header 검사·광범위한 catch로 잘못된 공급을 숨김 | 실제 context probe·시작 전 capability 선택·명시 요구/공급 오류 실패·session 고정과 canvas 수명 ([§12.2.3](work8-2.md#1223-자동-선택과-시작-실패)/[16.4](#164-web-비격리-배포와-profile-검증표)) |
| 지원 범위를 줄이면 완료로 보일 위험 | 대상별 필수 범위·API/기능표·미정 결정 기한·필수 unsupported 차단 ([§1.4](work8-1.md#14-첫-백엔드-완료에-포함할-대상)/[16](#16-구현-순서와-단계별-완료-조건)/[18.1](#181-엔진-v2-c-백엔드-완료-기준)) |
| 모든 숫자의 finite 요구와 unbounded/expand·scroll extent 의미 충돌 | 상한/extent 상태와 실제 박스·좌표 분리·명시적 wire 표현·Flutter 근거·codec/layout 실패 검사 ([§5.2](work8-1.md#52-서로-다른-버전을-한-숫자로-합치지-않는다)/[8.1](work8-2.md#81-native-render-model)) |
| 같은 document 재준비·skipped epoch 대기의 수명 불명 | PreparationId·의존 revision·시도별 terminal·명령의 epoch 하한과 timeout ([§5.4](work8-1.md#54-승인후속-실패재시도의-terminal)/[7.4](work8-1.md#74-새-콘텐츠가-이전-스크롤로-되돌리지-않게-한다)) |
| Native NACK와 TS reconciler 상태가 따로 진행 | 최종 그래프/소속 검증·ACK된 선언과 최신 앱 선언 분리·handle/callback 세대·State/dispose 회귀 ([§5.1](work8-1.md#51-ts가-보내는-것은-render-node의-변경이다)/[16.2](#162-이식-범위를-잃지-않는-방법)) |
| Thread가 있어도 JS provider·surface가 준비되지 않을 수 있음 | Owner별 realm/READY·비동기 pool 시작·CanvasKit 별도 context/게시 계약·OffscreenCanvas resize와 실패 경로 ([§12.2.3](work8-2.md#1223-자동-선택과-시작-실패)/[12.2.5](work8-2.md#1225-canvas게시dom-서비스)) |
| GPU 미관측 credit·숨김/복귀·DOM 입력 조건 누락 | Port별 credit/안전한 release·lifecycle/fence·EditContext 없는 편집·main의 activation 정책 ([§6.2](work8-1.md#62-상한과-frame-교체)/[6.3](work8-1.md#63-metrics숨김복구의-진행-조건)/[10.2](work8-2.md#102-편집-document)/[16.4](#164-web-비격리-배포와-profile-검증표)) |
| Host flag만 v2이고 앱 module은 v1일 수 있음·앞 단계 검사가 뒤 단계에 의존 | 빌드 resolver/bundle major 검사·W8-03 최소 route/coverage와 W8-05/06 확장 경계 명시 ([§13.2](work8-2.md#132-점진-이식의-경계)/[16](#16-구현-순서와-단계별-완료-조건)) |

다음 단계는 [2부 현황](work8-2.md#이번-작업의-구현검증-현황)에 남긴 전체 public API/기능표·디자인 전체 호환·provider/GPU peak 메모리 합산·전체 중첩 gesture arena/motion graph·그래픽/text 확장·IME/reader 물리 수락과 Android 최소 port 이식이다. 현재 Widget Testbed 연결을 전체 W8 완료로 세지 않는다. 기존 제품의 물리 재확인 대기와 성능 수락은 유지한다.

---

이전: [2부 — 렌더링·플랫폼·API 이식](work8-2.md) · [전체 목차](work8.md)

사용자의 두 문서 전체 작업 요청으로 재개했다. 수평 list·먼 index seek, bounded raw observer/App 제어 입력, admitted input snapshot·C ABI capability 정합성, prepared ancestor focus/caret reveal·Windows clipboard 실패 처리를 보완했다. 최신 검증/공급과 잔여 범위는 [2부 재개 현황](work8-2.md#2026-11-05-재개--입력-publication과-list-계약)을 따른다. 전체 W8 완료 선언은 아니다.
