# work7 — 세션 목표 중심의 Nelyx 잔여 구현 계획

작성일: **2026-10-12 KST**. 중간 마무리: **2026-10-13 KST**. 상태: **CLOSED / SUPERSEDED BY W8 / 전체 제품 PARTIAL**.

사용자의 “일단 중간 마무리하고 작업계획에 현황 반영해줘” 요청으로 구현을 멈췄다. 최신 상태와 재개 순서는 **§9.45** 및 [.tmp/work7/sliver-viewport/pause-checkpoint.json](.tmp/work7/sliver-viewport/pause-checkpoint.json)에 기록했다. 이전 절의 ACTIVE/OPEN은 당시 이력이며 현재 실행 기준은 [work8.md](work8.md)이며 W7 잔여 전체를 W8로 승계했다. W7의 중단 checkpoint는 과거 증거로 보존한다. 전체 W7 완료 또는 이번 일반 sliver 세션의 최종 수락을 뜻하지 않는다.

`work6.md`는 CLOSED / SUPERSEDED로 닫고, 완료된 구현·출처·증거를 그대로 승계한다. W6의 제품 상태는 PARTIAL이다. 계획 작성 당시에는 구현을 시작하지 않았으며, 이후 사용자의 `/goal work7.md의 전체작업해줘` 요청으로 이 문서에 따른 구현·빌드·실행·검증을 시작했다. W6 종료 이력은 보존한다.

**새 기본 방식은 `세션 목표 선정 → 관련 여러 파트 연속 구현 → 목표 결과 통합 검증 → 결과 한 번 기록`이다.** 파일·클래스·작은 위젯 하나를 고칠 때마다 원본 실행, 패키징, 모든 runtime, 설치본 대조를 반복하지 않는다. 필요한 검증 범위는 유지하고 실행 시점과 중복을 줄인다.

## 1. 검토 결과와 변경 이유

### 1.1 오래 걸린 원인

W6의 9절 실행 기록과 마지막 인계를 읽었다. 사용자 지적과 부합하는 반복 비용이 확인된다. 다만 단계별 소요시간 집계는 없어 **전체 지연의 몇 %가 검증 때문인지, 몇 배 빨라질지는 단정하지 않는다.** 전체 Flutter 기능을 대응하는 구현 자체의 규모도 크다.

| 기록에서 확인한 방식 | 늘어나는 비용 | W7 변경 |
| --- | --- | --- |
| 작은 geometry/layout/foundation 묶음마다 원본 spans·수치/상태 oracle·별도 소비 fixture 구성 | 실제 기능 연결보다 원본 추출·receiver·테스트 준비 비중이 커짐 | 실제 사용자 흐름에 필요한 의존성을 함께 구현하고, 원본 비교는 의미 차이가 큰 변경에 모아 실행 |
| ESM/types·Metro·Hermes source/optimized·이전 foundation 회귀를 여러 묶음에서 반복 | 같은 준비와 동일 회귀를 다른 실행 경로에서 중복 수행 | 세션마다 변경 영향에 맞는 대표 runtime, 지정 통합 지점에서 호환 경로 전체 |
| version/provider/schema/CLI/template/lock 변경과 6개 archive 재공급·fresh install·파일별 대조 | 작은 API 변경에도 배포에 가까운 비용 발생; 설치본 불일치 복구도 발생 | 개발 중 workspace 연결을 우선하며 외부 공급/버전 이행을 명시한 통합 지점에 묶음 |
| coverage 전체 재생성·과거 source/destination hash·native supplier hash 재확인 | 변경하지 않은 원본/의존성까지 반복 검토 | source pin·도구·API mapping 변화에 따라 영향 부분 갱신; 전체 감사는 주요 지점과 최종에 수행 |
| 묶음별 임시 소비 환경 생성·정리·정리 후 재검사, 여러 checkpoint/장문 기록 | 검증 주변 운영 작업과 다음 세션의 읽기 비용 누적 | 실행용 환경 재사용, 세션별 짧은 인계 하나, 정리는 단계 종료 시 묶어서 수행 |

특히 마지막 채널 수락은 새 채널 498 groups와 버퍼 483 groups뿐 아니라 이전 serialization 1,116 / error 21 / platform 291 / basic-print 1,602 / diagnostics 567 groups 및 frame·FrameworkRoot·bootstrap 회귀를 ESM·Metro·Hermes 경로로 확인했다. 이런 회귀의 가치와 별개로, 작은 수정마다 같은 폭으로 반복할 필요는 없다. **서로 다른 사례 수와 같은 시나리오의 반복 횟수도 구별한다.**

W6 원래 운영 규칙에도 동일 검사 반복 금지와 가벼운 검증 방향이 있었다. 따라서 W7은 선언만 바꾸지 않고, 아래에 **무엇을 언제 실행하고 무엇을 이월하는지**를 정한다.

### 1.2 Doroti 방식에서 가져올 점

사용자가 설명한 여러 파트의 묶음 구현과 세션 결과 수락을 기본으로 삼는다. 현재 DorotiLab의 `work.md`에서도 E0/E1, E2/E3 등 관련 작업을 사용자 기능 체크포인트로 묶고 최종 설치형 수락을 별도로 두는 운영을 확인했다. 이것이 모든 과거 세션의 실제 시간 단축을 증명하는 자료는 아니다.

Nelyx에서도 **“이 클래스가 이식됐다”보다 “폼에서 입력·검증·제출·화면 이동이 이어진다”**를 세션 목표로 삼는다. 낮은 계층은 이를 소비하는 위젯·SDK·예제까지 함께 연결한다. 세션 수락은 목표 동작, 그 동작을 지탱하는 위험한 계약, 영향받은 기존 흐름을 포함한다.

## 2. 출발점과 승계 범위

### 2.1 이번 검토에서 확인한 기준

- Flutter pin: `71e4717a61786faab4c7aa39825989305ed29e8a`.
- 제품 version: core **0.9.0**, SDK **0.11.0**.
- `Nelyx/upstream/flutter-coverage.json`: **74,297 records / public 47,282 / evidence 40개**. 상태는 missing 68,462 / partial 985 / adapted 4,838 / implemented 7 / notApplicable 5다. 선언·member·private 의존성·대규모 상수/지역화 항목이 섞여 있으므로 구현률이나 예상 시간으로 환산하지 않는다.
- 현재 coverage bytes는 마지막 `platform-channels/flutter-coverage-adopted.json`과 같으며 checkpoint에 기록된 **제품 파일 133개 해시가 모두 일치**한다. 이는 현재 소스 기준 확인이며 새 runtime 수락이 아니다.
- 작업 시작 시 현재 HEAD는 `cf1026c`, tracked 변경은 없고 빈 `work7.md`만 미추적 상태였다. pause checkpoint의 과거 HEAD·dirty 목록은 당시 기록이다. 이후 착수에서는 그때의 실제 diff를 다시 확인한다.

인계 자료:

1. [W6 종료 및 실행 기록](work6.md).
2. `.tmp/work6/pause-checkpoint.json`.
3. `.tmp/work6/platform-channels/checkpoint.json`, `resume-progress.md`.
4. `Nelyx/upstream/flutter-coverage.json`, `Nelyx/upstream/framework-imports.json`.
5. `.tmp/work6/platform-channels/flutter-coverage-adopted.json`, `qualified-source`.

`.tmp` 경로는 현존하는 로컬 증거다. 제품이나 외부 소비 앱이 이 경로를 요구하게 만들지 않는다. `migrate/select/adopt/finalize` 같은 W6 일회성 스크립트를 재개 절차로 그대로 실행하지 않는다.

### 2.2 다시 만들지 않을 것과 실제 남은 것

| 영역 | 승계할 선정 구현 | 남은 작업의 중심 |
| --- | --- | --- |
| 출처·도구 | pin, resolved inventory, direct-module mapping, 기존 이식 도구와 40개 수락 기록 | 새 묶음에 필요한 규칙·mapping만 보강, 미배정/미완료 member 해소 |
| foundation·트리·layout | diagnostics/error/serialization, notifier·scheduler·Ticker, GlobalKey/Element/ParentData·다수 box/layout·inherited·LayoutBuilder | inventory상 잔여 의미와 실제 소비 경로; 기존 class 전체 완료로 확대하지 않음 |
| paint·geometry | scalar paint, opacity, Path/clip, 4×4 transform, Radius/RRect/Offset/Size/vector_math·directional geometry, wire5 | retained layers·효과·shader/filter·decoration·image pipeline과 backend 통합 |
| focus·편집 | 계층 focus/attachment·일부 key 전파·EditableText 연결·SDK blur | traversal/actions/hardware key, RenderEditable·고급 편집·실제 IME·reader |
| 서비스 | codecs·ChannelBuffers·messenger·Basic/Method/Optional/EventChannel, SDK per-app owner·retirement | built-in native/DOM port·plugin bridge·typed OS services·binding/worker 연결 |
| 플랫폼·공급 | 현행 runner/provider·sample/template·과거 선정 build/runtime/archive 증거 | 확장 기능의 실제 표시·입력·접근성·성능·복구·개발 갱신·최종 공급 |

마지막 채널 수락의 archive 2,667 files / Android 설치 2,656 / 외부 설치 1,141 및 runtime PASS는 **과거 해당 범위의 증거로 승계**한다. 이번 계획 검토에서 archive 설치·Hermes·native를 재실행하지 않았다.

## 3. 변하지 않는 최종 목표와 경계

W6의 고정 참조에 있는 공개 UI 기능과 필요한 내부 의존성을 TypeScript 제품에 대응한다. foundation·scheduler·animation·physics·gestures·painting·rendering·semantics·services·widgets·Material·Cupertino, localization과 필요한 외부 의존성 의미를 모두 포함한다. 최신 Flutter master를 계속 따라가며 범위를 늘리지 않는다.

| 대상 | 코드 범위 | 플랫폼 수락 |
| --- | --- | --- |
| Windows·Android·Web | framework·SDK·native/DOM·renderer·provider·runner/template·배포 구성 | 실제 실행·입력/IME·reader·성능/복구·외부 소비/배포까지 수행 |
| iOS·macOS·Linux | 같은 기능의 실제 port·등록·호출·수명·runner/공급/배포 설정 | 기존 사용자 결정대로 **SKIPPED (코드 구성만 수행)**, provider는 notVerified |

Apple/Linux 전용 compile/native build·simulator/display·입력/IME·reader·성능·서명/설치·clean-machine 확인과 전용 검증 harness는 만들거나 실행하지 않는다. 공통 TS build에 포함되는 소스 확인은 유지한다. 이 플랫폼들의 코드 누락/빈 stub은 미완료지만 합의된 플랫폼 검증 생략은 전체 계획 완료를 막지 않는다.

core는 UI·상태·계약, SDK는 플랫폼 조합/수명, Skia는 paint/text/GPU 실행, runner는 등록/빌드 도구를 담당한다. 공통 앱은 `src/`, 플랫폼 등록은 각 runner에 둔다. 직접 module import와 `.ts` source / `.js` ESM·declaration, re-export barrel 금지, BSD-3-Clause 및 제3자 notice 보존을 유지한다. Dart VM/ABI나 기존 Flutter plugin의 무수정 호환을 목표로 추가하지 않는다.

## 4. 세션 운영 규칙

### 4.1 세션은 사용자 결과 하나를 완성한다

세션은 채팅 한 번이나 파일 하나가 아니라 **관련 여러 계층을 변경해 하나의 결과를 수락하는 단위**다. 시작할 때 아래 네 줄만 정한다.

```text
목표: 이번 세션 후 실제로 가능한 사용자 흐름
함께 구현: core / SDK·backend / widget / sample 중 필요한 파트
종료 확인: 목표의 정상·오류·수명 시나리오와 영향받는 runtime
이월: 물리 환경 수락 또는 다음 통합 지점에서 할 확인과 담당 W7 ID
```

1. 현재 diff·직전 짧은 인계·관련 coverage만 읽는다. 전체 W6 실행 기록과 원본 inventory를 매번 다시 훑지 않는다.
2. 필요한 API·소유권·오류 경계를 정하고 관련 여러 파일을 연속 구현한다. 선택·초안·수동 보완·제품 연결·예제 수정도 한 흐름으로 진행한다.
3. 목표 구현이 끝난 뒤 타입/빌드, 필요한 의미 확인, 실제 목표 흐름을 **통합 검증 한 묶음**으로 실행한다.
4. 실패하면 원인을 수정하고 실패한 경로와 영향받은 회귀만 다시 실행한다. 수정으로 무효화되지 않은 성공 검사는 반복하지 않는다.
5. coverage·출처·간단한 인계를 한 번 갱신하고 다음 목표로 간다. 개별 helper마다 package 수락·checkpoint를 만들지 않는다.

여러 W7 항목이 같은 기반·화면·runtime을 쓰면 한 세션으로 합칠 수 있다. 너무 큰 항목은 “목록 → 상세”, “편집 → 제출” 같은 끝까지 이어지는 흐름으로 나눈다. class/함수별로 나누고 각각 전체 검증을 붙이는 방식으로 되돌아가지 않는다.

### 4.2 구현 중간 검사를 허용하는 경우

중간 검사는 다음 작업을 진행하는 데 필요한 **좁은 확인**이다. 세션 전체 수락을 앞당겨 반복하는 절차가 아니다.

- compiler/import 오류로 후속 구현이 막힐 때: 해당 workspace의 typecheck/build.
- frame wire·ABI·codec·native ownership·GPU retirement를 바꿀 때: 대응 backend와 경계 roundtrip/종료 확인. 틀린 계약 위로 구현을 계속 쌓지 않는다.
- 원본 의미가 불명확해 설계가 갈릴 때: 그 동작의 작은 oracle/재현 하나.
- 실제 native/DOM 연결이 처음 등장할 때: 연결 가능한지 확인할 최소 실행. 물리 입력 수락 전체와 구분한다.

일반 옵션 추가·스타일·단순 배치·문서·가역적 수정에는 개별 테스트를 새로 만들지 않는다. 어려운 동작은 정확히 확인하되 검증 체계 개발 자체를 세션 목표로 바꾸지 않는다.

### 4.3 반복 비용을 제한하는 규칙

- 전체 inventory 재생성, 과거 모든 hash 대조, 새 외부 소비 앱 생성, 6개 target 공급, 이전 전체 oracle의 모든 engine 재실행은 **매 세션 기본 작업이 아니다**.
- core/SDK 개발은 workspace source/dist의 연결을 우선한다. 실제 runner가 설치 archive를 요구하면 그 세션에 필요한 패키지/runner만 갱신하며, sample이 오래된 설치본을 보는 상태로 검증하지 않는다.
- 버전·range·migration 필요성은 변경과 함께 기록한다. breaking 변경을 외부 공급할 때는 관련 provider/CLI/template/lock을 한 번에 이행한다. version만 바꾸거나 호환 범위를 거짓으로 넓히지 않는다. 같은 version의 다른 archive bytes가 캐시에서 섞이지 않게 기존 공급 identity를 사용한다.
- 기존 실행 환경과 cache를 재사용한다. 실행별 raw log는 덮어쓰지 않되, 각 수정마다 fresh install·전용 harness·dashboard·새 검증 프레임워크를 만들지 않는다.
- 해시 불일치나 pin/tool/export 변화가 있으면 그 영향 범위를 재검토한다. 출처 검토를 생략하거나 오래된 수락을 현재 변경의 PASS로 복사하지 않는다.
- 테스트 실행에는 저장소 지침대로 **20분 timeout**을 적용한다. lifecycle 등 같은 시나리오의 반복은 대부분 **30회 이내**로 제한한다. 프로세스가 실행 중임을 알려주는 도구의 대기 시간과 실제 테스트 timeout은 다르다.
- 한 세션의 통합 검증 첫 실행을 기본으로 하고, 재실행은 실패 수정·새 변경·무효화된 증거가 있을 때만 한다. 실패가 남아 있으면 횟수 제한을 이유로 PASS 처리하지 않는다.

## 5. 검증을 실행하는 시점

### 5.1 세 수준의 수락

| 수준 | 시점 | 기본 실행 | 이 수준에서 매번 하지 않는 것 |
| --- | --- | --- | --- |
| 세션 수락 | 관련 구현을 모두 연결한 뒤 | 변경 workspace types/build, 의미가 중요한 계약, 목표 흐름과 인접 회귀, 영향받은 backend | 전 기능 원본 oracle·새 외부 설치·전 target 재공급 |
| 통합 수락 | 아래 I1/I2/I3, 또는 runtime/export/wire/native 변경으로 필요할 때 | 공통 types/build, 실제 변경 범위의 ESM/declaration·Metro/Hermes 호환, Windows/Android/Web 관련 흐름, 필요한 소비 패키지 | 변경 없는 Apple/Linux native 검증, 무관한 전체 과거 수락 반복 |
| 제품/배포 수락 | 기능 범위가 닫힌 최종 후보 | 전체 필수 coverage, 최종 archive·실제 외부 앱·설치/배포, 실제 물리/reader/성능/복구 | 과거 선정 PASS만으로 최종 현재 후보를 수락하는 것 |

통합 지점은 **I1: W7-01~03**, **I2: W7-04~08**, **I3: W7-09~12**를 기본으로 한다. 같은 세션에서 끝난 수락은 통합 수락에 포함해 한 번만 실행한다. packaging/export/resolver를 바꾸면 해당 소비 검증을 그 시점으로 당기되, 별도의 동일 검사를 다시 추가하지 않는다. 전체 새 외부 앱 생성은 최종 W7-14에서 수행하고, 중간에는 기존 소비 환경을 갱신해 재사용한다.

### 5.2 변경 영향별 최소 확인

| 변경 | 세션 종료 시 확인 | 확대가 필요한 때 |
| --- | --- | --- |
| 순수 core 알고리즘/Widget | 해당 types/build + 대표 의미/장면 + 인접 사용 흐름 | 클래스 초기화·import cycle·engine 민감 동작은 ESM/Metro/Hermes까지 |
| export·declaration·패키지 resolution | 실제 direct import·엄격 타입·`.js` 선언 참조·해당 설치 소비 | CLI 생성/공급·dependency range 변경이면 실제 공급/재설치 |
| paint/frame wire/resource | encode/decode·budget/lease + 변경 연산의 Web/native 실제 재생 | native/ABI 변경이면 영향을 받는 Windows·Android build/run; 동일 wire cohort 일치 |
| native/DOM service·편집·semantics | 실제 bridge 등록·호출·오류·late callback·close, 해당 OS/browser 흐름 | 실제 IME/candidate/reader 수락은 그 환경에서 별도 관찰 |
| 원본 parser/lowering/mapping | 바뀐 규칙의 실제 source selection·emit·소비 결과 | inventory schema/pin/exports 분석 변경이면 전체 재생성·기존 mapping 회귀 |
| 성능/회복 | 해당 workload와 failure/recovery·자원 경계 | 최종 수락은 Windows·Android·Web의 명시한 환경 전체 |

W6 기존 oracle는 중요한 의미와 회귀를 재현하는 데 재사용한다. 순수 함수나 미묘한 callback 순서에는 원본 비교가 적합하지만, 모든 getter/상수/옵션에 별도 Dart 실행 fixture와 여러 mode/engine 조합을 강제하지 않는다. mode 차이가 계약에 있는 diagnostics/assertions 등은 필요한 mode를 유지한다. UI 흐름이 통과해도 검토하지 않은 API/member를 자동 implemented/adapted로 바꾸지 않는다.

### 5.3 현행 명령 사용

현재 root scripts에 있는 명령은 다음과 같다. 각 세션에서는 변경 범위와 소비 연결에 필요한 것만 선택한다.

```powershell
npm.cmd run check:types
npm.cmd run build:core
npm.cmd run build:sdk
# CLI/Metro 선언을 변경한 경우
npm.cmd run check:cli-types
npm.cmd run check:metro-types
```

`build:sdk`는 core와 Skia build·provider 생성·CLI 준비를 포함한다. 따라서 그 앞뒤로 동일 build를 습관적으로 중복 실행하지 않는다. 부분 build는 각 workspace의 실제 scripts를 확인해 사용한다. root `check:types`는 sample도 포함하므로 package를 소비하는 runner 설치 상태를 먼저 맞춘다. 현재 없는 broad `npm run check`나 과거 삭제한 validator는 되살리지 않는다.

Web/Windows/Android 실행은 그때의 runner/CLI 명령과 환경을 확인한다. 이식 도구를 수정했을 때만 도구의 types 및 영향받은 실제 변환을 확인하며, lock이 바뀌지 않았으면 매번 `bun install`하지 않는다. 테스트는 기존 bounded 실행 경로에서 1,200초 timeout을 적용한다.

## 6. 남은 작업 묶음

아래 항목은 **의존성과 결과를 묶은 실행 순서**이며 각각이 무조건 한 채팅/하루에 끝난다는 일정 약속은 아니다. 항목 안에서는 여러 파트를 함께 구현한다. 새로 발견한 필수 API는 관련 묶음에 추가하며 별도 미세 수락 단계를 끝없이 만들지 않는다. W6의 기존 선정 구현은 사용하고 잔여 부분만 채운다.

### W7-01 — 실제 OS 서비스와 앱 소유권 연결

- **목표:** sample의 앱/View에서 실제 OS 서비스를 호출하고 응답·오류·구독·종료를 처리한다.
- **함께 구현:** built-in Web/native `PlatformMessagePort`·plugin 등록/dispatch, ServicesBinding/SystemChannels, per-app default owner, background/root token에 대응하는 worker/dispatcher 소유권, clipboard·환경/locale/brightness·lifecycle·system navigation 등 기반 service. 기능별 OS 차이는 typed capability/error로 드러낸다.
- 기존 messenger/channel/broadcast와 byte snapshot·cancel admission·native retirement를 재사용한다. Apple/Linux 대응 port·등록·수명 코드도 함께 구성한다. 편집/접근성/native view의 특수 서비스는 각각 W7-05/08/11에서 이어 붙인다.
- **세션 결과:** 실제 clipboard 호출·환경 변경 구독 → View 교체/앱 종료 → 늦은 응답 차단. 두 app owner의 격리와 오류/미지원 응답을 확인한다. 응답 없는 transport stub은 완료로 취급하지 않는다.
- **확인:** 영향받은 Windows·Android·Web 실제 service bridge와 통합 owner 흐름. ChannelBuffers native update missing도 실제 연결 여부에 따라 판정한다. 기존 498+483 전체 oracle 재실행은 channel 의미를 변경했을 때만 한다.

### W7-02 — 그리기·layer·이미지·decoration을 한 화면에 연결

- **목표:** 이미지·장식·clip·filter·그림자·투명도·follower가 함께 있는 실제 합성 화면을 완성한다.
- **함께 구현:** Paint/Path 잔여 연산·shader/gradient/blend/filter/saveLayer, retained layer/compositing·repaint boundary·leader/follower·raster cache, Border/Shape/Decoration, image provider/stream/cache·asset variant·비동기 decode·취소/eviction·animated image·BoxFit/repeat/nine-patch.
- 기존 wire5/geometry·layout를 재사용하고 필요한 RenderObject/layout 잔여 계약을 소비 위젯과 함께 보강한다. core 타입·serialization/budget·resource 열거·JSI/native/Web replay를 함께 바꾼다.
- **세션 결과:** 같은 장면에서 resize·transform·effect·image 교체/오류·overlay 추적을 수행하고, 제거된 자원이 제출된 frame retirement까지 유지된다.
- **확인:** 변경 연산의 actual Web/native pixels·hit test·decode 실패·cache 상한/retirement. 기반 wire가 바뀌면 조기에 좁은 roundtrip을 확인하고 세션 끝에서 통합 장면을 수락한다.

### W7-03 — 실제 글꼴·풍부한 본문·본문 선택

- **목표:** 한국어·영문·emoji·RTL·inline widget을 포함한 문서를 배치·선택·복사한다.
- **함께 구현:** TextStyle/TextScaler/Strut/TextHeightBehavior·InlineSpan/TextSpan/WidgetSpan·RichText/DefaultTextStyle, TextPainter metrics/caret/range·overflow·grapheme/word/line, locale/bidi/ligature·fallback·feature/variation·icon font, SelectionArea/Container/SelectableRegion/Text·gesture/toolbar/copy/semantics.
- W6의 app default font를 기반으로 실제 font 공급과 SkParagraph/CanvasKit를 연결한다. 이 흐름에 필요한 selection gesture/기본 semantics는 W7-04/08 전체를 기다리지 않고 함께 구현한다.
- **세션 결과:** 글꼴 fallback과 text scale/방향 변경 → WidgetSpan 배치/hit test → 범위 선택·복사·paragraph 교체/해제.
- **확인:** 동일 font/viewport의 geometry·actual text pixels와 선택 결과, paragraph lease. I1에서 서비스/합성/본문을 함께 쓰는 화면과 runtime 호환을 수락한다.

### W7-04 — pointer·gesture·focus·keyboard의 공통 입력 흐름

- **목표:** canvas control과 native editor 사이를 mouse/touch/keyboard로 이동하며 입력 충돌을 처리한다.
- **함께 구현:** router/capture/cancel·hover/buttons/cursor·wheel/trackpad, tap/double/long/secondary·axis drag/pan/scale/multidrag/team/velocity, RawGestureDetector/MouseRegion/TapRegion/drag-drop, focus traversal/group/policy·highlight·Actions/Shortcuts/Intent·logical/physical/pressed/repeat/handled 전파.
- 기존 계층 focus·GlobalKey attachment를 유지한다. W7-03의 선택 gesture와 새 widget control을 같은 입력 모델에 통합한다.
- **세션 결과:** focus 순회 → shortcut/activation → nested scroll/drag/scale 경쟁 → capture 중 subtree 제거·modal 전환·cancel 후 focus 복원.
- **확인:** 정상 입력과 경쟁·해제·late event를 하나의 상호작용 화면에서 확인한다. 초기 미해결이던 **Windows Move-editor-right InvokePattern**은 §9.21의 실제 UIA 이동 왕복에서 선정 수락했다. 나머지 UIA/reader 수락은 W7-08/13에 연결한다.

### W7-05 — 편집·폼·IME를 제출까지 연결

- **목표:** 여러 필드가 있는 폼에서 편집·검증·제출·복귀가 실제 OS 편집과 일치한다.
- **함께 구현:** TextEditingController/value/delta·RenderEditable, multiline/obscure/readOnly·formatter/maxLength·undo/redo·autofill·spell/context menu·selection handles/toolbar/magnifier·scroll-to-caret, Form/FormField/validation/save/reset/autovalidate·AutofillGroup.
- native/DOM IME port의 composing·anchor/focus·revision·caret geometry·ack·late event와 clip/transform/opacity/z-order를 연결한다. native control을 별도 기능으로 남겨야 하면 차이를 명시한다. reader의 proxy/Skia 본문 중복 노출을 방지한다.
- **세션 결과:** 한국어 조합 중 resize/route 이동·programmatic edit → emoji/RTL 선택·붙여넣기/undo → Next/Done·검증/제출 → editor 종료.
- **확인:** 자동화된 편집/geometry/수명 수락을 묶고 Windows·Android·Web 실제 IME/후보창 관찰을 별도로 누적한다. 물리 환경이 없으면 그 항목은 notVerified로 W7-13에 남기며 독립된 구현은 계속한다.

### W7-06 — motion·일반 sliver·가상 목록의 공통 기반

- **목표:** 가변 높이 목록과 grid를 애니메이션·스크롤·keep-alive와 함께 사용한다.
- **함께 구현:** animation/controller/Tween/Curve/Sequence·implicit/explicit transition·spring/friction·취소 future/reduce motion, ScrollPosition/Activity/Physics·metrics/notification, SliverConstraints/Geometry·Viewport/offset/multi-box child manager·가변/fixed/prototype/grid/mixed sliver·cache/scroll correction·key reorder·KeepAlive/PageStorage·shrinkWrap/reverse/anchor.
- scheduler/TickerMode와 기존 tree/layout를 재사용하고 관련 foundation/rendering 잔여를 이 소비 경로에서 닫는다. 기존 고정 extent LazyList를 일반 sliver 완료로 간주하지 않는다.
- **세션 결과:** 큰 가변 목록+grid → fling 중 항목 추가/삭제·크기 변화 → 위치/State 보존 → hidden/resume·animation 취소·close.
- **확인:** 경계/가시 항목/자원 상한과 대표 10,000 item workload를 한 장면에서 확인한다. JS timing은 실제 scanout/FPS와 구분한다.

### W7-07 — 고급 scroll·page·직접 조작 위젯

- **목표:** page·nested header·refresh·재배치·확대 화면을 공통 scroll/input 기반 위에서 완성한다.
- **함께 구현:** PageView/Controller·NestedScrollView·persistent/pinned/floating/resizing header·Scrollbar/Refresh 기반, AnimatedList/Grid·Reorderable/Dismissible·DraggableScrollableSheet·ListWheel·InteractiveViewer·two-dimensional viewport/scroll·TreeSliver.
- **세션 결과:** page 안의 가변 목록과 접히는 header → refresh/reorder/dismiss → 위치 복원, 별도 2D/tree/zoom 장면의 viewport·focus·semantics.
- **확인:** 공유 controller·gesture 경계·메모리/cache·취소/복원 중심으로 여러 위젯을 한 번에 수락한다. 항목별 native 앱을 따로 만들지 않는다.

### W7-08 — 앱·route·restoration·지역화·접근성

- **목표:** 여러 화면을 가진 앱이 deep link·뒤로가기·상태 복원·locale 변경·reader 탐색을 지원한다.
- **함께 구현:** WidgetsApp·Navigator Pages/Route/transition/observer/Hero·nested navigation, OverlayEntry/Portal·barrier/follower/focus trap, Router/URL/history/deep link·PopScope/Back/predictive Back, restoration buckets/properties·route/form/scroll 저장.
- Future/StreamBuilder·Notification·공통 async/state 위젯, MediaQuery/SafeArea·환경 변경, Localizations/delegate/locale resolution·Material/Cupertino 문구·숫자/날짜/복수형·RTL, semantics role/state/action·merge/exclude/live region·selection/virtual scroll와 native/DOM bridge를 함께 연결한다.
- **세션 결과:** URL/OS link 진입 → dialog/overlay → form/scroll 상태를 가진 nested route → Back/복원 → locale/scale/contrast 변경 → reader 탐색/action.
- **확인:** Windows UIA/Narrator·Android node/TalkBack·Web DOM/reader 증거를 구분한다. 지역화는 고정 inventory의 모든 대상 locale를 처리하며 ko/en 예시만으로 완료하지 않는다. I2에서 편집·스크롤·앱 흐름을 통합 수락한다.

### W7-09 — Material 앱 기반과 기본 control·폼

- **목표:** 실제 Material 앱에서 탐색·선택·편집·피드백을 공통 기반으로 제공한다.
- **함께 구현:** Material/Ink·shape/elevation/tint/splash·WidgetState·ColorScheme/Typography/TextTheme·theme extension/lerp, MaterialApp·Scaffold/Messenger/AppBar/drawer/FAB/navigation bar/rail/drawer, 전체 button·selection/chip/slider family, TextField/InputDecorator/TextFormField·dropdown/autocomplete/search, card/list/tile/divider/badge/avatar/progress/tooltip/icons.
- **세션 결과:** 반응형 navigation shell → hover/focus/pressed/disabled/selected 상태 → 폼 제출 → snackbar/banner. light/dark·RTL·scale·reader 동작도 같은 구성에서 본다.
- **확인:** control마다 독립 harness를 만들지 않고 공통 state/theme/input 계약과 대표 화면을 수락한다. 나머지 public member의 mapping/구현 검토는 함께 완료한다.

### W7-10 — Material 복합 UI와 Cupertino 전체 family

- **목표:** 완성된 공통 기반을 사용해 복합 Material 업무 흐름과 Cupertino 앱 흐름을 구성한다.
- **Material:** dialog/sheet/menu·date/range/time picker·tabs/table/pagination·expansion/stepper/carousel/refresh/reorder/about/license, 관련 theme/localization/selection toolbar/route/adaptive variant.
- **Cupertino:** App/Theme/DynamicColor/TextTheme/localizations·page/sliver navigation·interactive edge-back·tab별 navigator/keep-alive/focus, button/selection/slider/segment·text/search/form·picker/date/timer·dialog/action sheet/context menu·list/expansion/refresh/scrollbar·sheet/menu·selection/magnifier/haptic.
- **세션 분할 기준:** 필요하면 “Material 검색·표·선택·picker·dialog”와 “Cupertino tab·form·picker·back”의 두 결과로 나눈다. 디자인 위젯 하나씩 수락하지 않는다.
- **확인:** Windows·Android·Web의 실제 widget 상태/레이아웃/route/접근성. Cupertino UI 구현과 Apple native 플랫폼 수락은 구별한다.

### W7-11 — native view·texture·남은 플랫폼 코드 완결

- **목표:** 살아 있는 native/HTML view와 Skia UI가 화면·입력·접근성·수명을 공유한다.
- **함께 구현:** platform-view factory/controller·PlatformViewLink 계열·HtmlElementView·Texture·native/desktop menu, geometry/clip/transform/z-order·가림/교차 composition·focus/IME·semantics·resize/retirement와 잔여 typed service.
- 공통 작업마다 함께 갱신한 Apple/UIKit/AppKit/Metal와 Linux/GTK4/RNL/Vulkan 코드를 모아 실제 등록·호출·오류·owner·runner/template/배포 설정 누락을 닫는다. Linux X11 구성에서 Wayland 지원을 추정하지 않는다.
- **세션 결과:** 스크롤/overlay 안의 native view 앞뒤에 Skia UI 배치 → 실제 입력·focus 전환 → resize/제거·재생성 → 종료.
- **확인:** Windows·Android·Web composition과 자원 수명. snapshot 대체나 채널 응답만으로 live native view를 수락하지 않는다. Apple/Linux는 코드 구성 상태와 플랫폼 SKIPPED를 분리 기록한다.

### W7-12 — 개발 갱신·inspector·preview

- **목표:** 개발자가 UI를 수정하고 state 유지/재시작 경계를 이해하며 실제 tree·오류·성능을 조사한다.
- **함께 구현:** tree/state/layout/paint/semantics inspector·creator/source span·debug/semantics/performance overlay·preview/service extension, state-preserving reassemble·type/key/State shape/lease 호환·Metro Refresh, native full reload/teardown과 정식 공급 경로.
- **세션 결과:** 구현 중인 앱 수정 → 유지 가능한 State 보존 → 구조/소유권 변경 시 remount/restart → inspector로 실제 결과·오류 위치 확인 → 기존 editor/renderer/font 정리.
- **확인:** Web HMR와 stock RNW Core native full reload를 각각 관찰한다. private patch에 의존하면 공급·재현 경로까지 닫는다. I3에서 디자인 UI·native view·개발 갱신의 통합 수락과 package 소비를 수행한다.

### W7-13 — Windows·Android·Web 제품 수락과 성능·복구

- **목표:** 앞선 세션에서 누적한 기능을 실제 지원 환경의 제품 결과로 수락한다.
- 코드 완성 때까지 플랫폼 확인을 모두 미루지 않는다. 이전의 유효한 증거는 환경·build·변경 영향을 검토해 재사용하고, 무효화되거나 미관측인 항목만 보완한다. 마지막에는 최종 후보의 통합 흐름을 확인한다.
- **Web:** 선정 Chromium/Firefox/WebKit의 CanvasKit/WebGL2·DPR/resize·font/image·history/clipboard·visibility/context loss·실제 pointer/keyboard/touch·한국어 composition/candidate·DOM reader.
- **Windows:** 선언한 아키텍처·DPI/다중 monitor·mouse/keyboard/trackpad·실제 한국어 IME/caret·Narrator/UIA/InvokePattern·native reload·minimize/close/drain·GPU 복구.
- **Android:** ARM64 물리 기기/선정 API·Gboard 한국어/selection/autofill·TalkBack·predictive Back·회전/분할 화면/insets·background/resume/memory pressure. x86_64 emulator 결과는 별도로 기록한다.
- **공통 성능/복구:** 큰 keyed tree·10,000 가변 item·rich text/emoji·filter/animation·복수 editor/native view의 build/layout/paint/raster/present·p50/p95·missed frames·첫 표시·입력 지연·메모리. 기기/refresh rate별 budget을 먼저 정하고 60 Hz 16.67 ms / 120 Hz 8.33 ms frame interval과 비교한다. text/cache/command 제한은 workload와 lease 예산에 맞춘다.
- decode/asset/startup/submit 실패·loss·resize storm·비정상 종료·drain/재생성을 확인한다. submit/retire를 scanout/FPS로 집계하지 않는다. 수락 환경/장비가 필요한 항목은 정확한 다음 조치와 함께 남기고 자동화 결과로 대체하지 않는다.

### W7-14 — 최종 coverage·외부 소비·배포와 종료

- **목표:** repository 내부 연결에 의존하지 않는 최종 공급물로 합의한 기능·제품·개발 경험을 닫는다.
- 남은 mandatory missing/partial과 dependency·target code 누락을 전수 검토한다. 각 잔여는 해당 W7 묶음으로 돌려 구현하고, 대규모 localization/icons/constants는 정확한 생성 규칙·출처·대표 동작으로 관리하되 누락을 숨기지 않는다.
- core/SDK/Skia/Metro/CLI·source/ESM/declaration/map·assets/native·license/notice·export·version/range·migration·sample/template·6개 target 공급 구성을 **최종 후보 한 묶음**으로 맞춘다.
- 설치한 CLI와 archive만으로 새 외부 앱을 만들고 Windows·Android·Web install/typecheck/build/run/pack·production 서명/설치/업데이트/제거·clean-machine을 확인한다. `reference/`, DorotiLab, analyzer/도구·scratch 의존은 허용하지 않는다. Apple/Linux 공급 코드와 배포 설정은 포함하고 플랫폼 실행은 SKIPPED다.
- 소유 임시 자료/프로세스/포트를 명시한 allowlist로 정리한다. 정리로 runtime/build input이 바뀐 경우에만 관련 smoke를 다시 실행한다. 문서와 최종 결과에 실제 남은 artifact 및 미검증 경계를 반영한다.

## 7. W6 잔여 범위의 이관표

W6 체크박스는 초기 계획과 실행 기록이 섞여 있으므로 체크박스만으로 완료 여부를 판단하지 않는다. 기존 inventory의 W6 task ID와 evidence ID는 이력 연결을 위해 보존하며, 이 표가 W7 실행 담당을 정한다. **74,297개 record를 새 번호로 일괄 변환하는 작업부터 시작하지 않는다.**

| 이전 작업 | W7 담당 | 이관 방식 |
| --- | --- | --- |
| W6-00·01 pin/inventory/도구 | 전 묶음, 최종 14 | 구축된 기반 재사용; 필요한 도구 개선과 영향 mapping을 해당 구현에 포함 |
| W6-02 foundation/scheduler/services | 01·06, 각 소비 묶음, 최종 14 | 완료된 diagnostics/serialization 재이식 금지; 잔여 binding/환경/시간/보조 의미 구현 |
| W6-03 Widget/Element/State/Key | 02·06·08·12, 최종 14 | 기존 트리 기반 재사용; 잔여 수명·dependency·reassemble 의미 닫기 |
| W6-04 RenderObject/layout | 02·03·06·07, 최종 14 | 소비 화면의 layout/render 잔여 계약과 함께 구현 |
| W6-05 paint/layer | 02·11 | paint/backend·layer·composition을 실제 장면으로 수락 |
| W6-06 text/font/selection | 03·05 | 본문과 편집 흐름으로 분담 |
| W6-07 image/asset/decoration | 02 | decode·paint·cache·resource 수명 통합 |
| W6-08·09 gesture/focus/keyboard | 04 | 편집/scroll/native view의 인접 회귀 연결 |
| W6-10 editing/IME | 05·13 | 구현/자동화와 실제 IME 관찰 구분 |
| W6-11 animation/physics | 06, 소비 07·08·09·10 | scheduler·scroll·route/디자인 위젯과 통합 |
| W6-12·13 sliver/scroll | 06·07 | 일반 기반과 고급 조작 흐름 |
| W6-14 app/route/restoration | 08 | URL/Back/overlay·focus·저장 복원 통합 |
| W6-15 common/form/async | 03·05·08·09 | icon/본문·form·async/환경·control 소비 경로 |
| W6-16 semantics/localization | 03·05·08·09·10·13 | 위젯 의미와 bridge를 함께 구현; 전체 locale와 실제 reader 수락 유지 |
| W6-17·18 Material 기반/control | 09 | theme·shell·상태·폼을 같이 구현 |
| W6-19 Material 복합 UI | 10 | picker/menu/table/navigation 흐름 |
| W6-20·21 Cupertino | 10 | 기반·앱·control·복합 UI 함께 완결 |
| W6-22 service/PlatformView/Texture | 01·05·08·11 | 서비스 기반·편집/semantics port·native composition |
| W6-23 DX/inspector/preview | 12 | 현재 앱의 수정/진단 흐름 |
| W6-24 performance/recovery | 모든 관련 세션, 최종 13 | 변경 경계는 조기 확인, 제품 workload/환경 수락은 통합 |
| W6-25·26·27 Web/Windows/Android | 모든 관련 세션, 최종 13·14 | 실제 기능 수락 누적 후 최종 후보/배포 확인 |
| W6-28·29 Apple/Linux | 모든 공통 계약 변경, 누락 정리 11·14 | 6 target 코드 포함; 플랫폼 수락 SKIPPED 유지 |
| W6-30 package/외부 소비/최종 | I1·I2·I3 필요한 공급, 최종 14 | 패키지 반복 비용 통합, 최종 외부/배포 수락 보존 |

세부 필수 대상은 `flutter-coverage.json`의 required·dependency와 W6 5절 family 목록이다. 이 문서의 예시 밖 API, deprecated·conditional·외부 dependency·widget preview도 자동 제외하지 않는다. 매 묶음 종료에는 그 범위의 남은 항목과 다음 담당을 확인하고, 전체 source 재생성/대조는 pin·schema·분석 규칙 변경 또는 최종 감사 때 수행한다.

## 8. 진행 기록과 비용 관리

### 8.1 기록은 세션당 한 번

이 문서의 마지막 진행표에 결과를 갱신한다. 복잡한 실패의 raw log·snapshot은 `.tmp/work7/<세션>/`에 두고 해당 경로만 연결한다. 기존 W6 evidence를 다시 복사한 장문 보고서, 별도 dashboard/report tree는 만들지 않는다. 기존 coverage schema에 필요한 evidence는 통합 수락 단위로 기록한다.

```text
세션 / 목표 / 변경 묶음:
완성된 사용자 결과:
수락: 명령·환경·build 식별 / PASS·PARTIAL·FAIL
잔여: notVerified·SKIPPED / 원인 / 다음 W7 담당
비용: 대략적 구현 시간 / 검증·환경 준비 시간 / 재실행 횟수와 이유
다음 시작점 / 보존 artifact:
```

시간은 실제 기록 가능한 범위로만 적는다. 세션 둘 이상에서 검증·준비 시간이 구현보다 커지거나 같은 검사 재실행이 반복되면, 다음 세션 전에 **중복 명령·fresh install·전체 oracle·재공급 주기부터 줄인다.** 실패한 기능의 수락 조건을 낮춰 속도를 맞추지는 않는다. 목표는 검증 개수 감소 자체가 아니라 같은 비용으로 더 많은 사용자 기능을 완결하는 것이다.

### 8.2 자료·cache·정리

W6의 qualified-source·실패 로그·Flutter/Dart/native cache·최종 공급물을 보존한다. W7 실행 환경은 재사용하되 source/compile input이 달라졌으면 영향 cache를 갱신한다. 매 helper 수정 뒤 삭제·재생성·post-cleanup 검증을 반복하지 않는다.

정리는 명시한 소유 allowlist·preview·`-Execute`, 절대경로/workspace/link 확인 규칙을 유지한다. 사용자의 unrelated dirty와 제품 input은 보존하며, 알려지지 않은 경로를 비사용 추정만으로 삭제하지 않는다. 제거한 raw 증거가 남아 있다고 안내하지 않는다.

## 9. 완료 조건과 첫 실행

### 9.1 판정

- **세션 완료:** 선언한 사용자 흐름과 영향 계약이 실제 연결되고 해당 세션 수락을 통과했다. 이후의 물리/배포 수락은 명시해 이월할 수 있다.
- **기능 완료:** 고정 inventory의 mandatory missing/partial과 연결되지 않은 필수 dependency가 0이며 adapted/notApplicable에 실제 근거가 있다. 모든 6 target 코드 구성이 끝났다.
- **W7 전체 완료:** 기능 완료에 더해 Windows·Android·Web의 필수 실행·입력/IME·reader·성능/복구·개발 갱신·외부 소비·배포 수락을 완료했다. Apple/Linux는 코드 구성 완료 및 사용자 지정 SKIPPED/provider notVerified가 기록돼 있다.

PASS / PARTIAL / FAIL / SKIPPED / notVerified를 유지한다. 장비·서명·사람의 실제 입력/reader 확인이 필요한 항목이 남으면 전체 완료를 선언하지 않는다. 기존 사용자 합의 없이 기능을 범위 밖으로 옮기거나 Apple/Linux 검증 생략을 지원 PASS로 바꾸지 않는다.

### 9.2 첫 구현 세션의 구체적 목표

아래 순서는 계획 작성 당시의 첫 착수 절차다. **현재 재개는 §9.45의 pause checkpoint와 W7-06 viewport reveal 인계에서 시작한다.** W7-01의 잔여 작업도 전체 범위에 유지한다.

1. 현재 diff와 W6 마지막 인계를 확인하고 실제 browser/RN/native interaction 경로 및 ServicesBinding/SystemChannels를 필요한 범위만 읽는다.
2. native/DOM port·plugin dispatcher·per-app owner·clipboard/환경 구독·종료를 sample 화면까지 함께 연결한다. 실제 backend 소유권을 확인할 최소 probe만 중간에 한다.
3. 세션 마지막에 types/build와 실제 서비스 왕복·오류/취소·다중 owner·close 흐름을 통합 확인한다. Apple/Linux 대응 코드는 함께 구성하고 전용 native 검증은 하지 않는다.
4. 관련 coverage/출처와 짧은 인계를 갱신한다. 의미를 바꾸지 않은 diagnostics/geometry 전체 oracle·6 target fresh 설치·전체 과거 hash 감사는 재실행하지 않는다.

| 항목 | 현재 상태 | 다음 행동 |
| --- | --- | --- |
| W6 종료·현재 기준 확인 | 완료 — 문서/소스 hash 확인 범위 | W6 이력·증거 보존 |
| W7 계획 작성 | 완료 | 이 문서를 새 실행 기준으로 사용 |
| W7-01 구현 | PARTIAL — OS/worker/source dispatcher·언어/Back 흐름 수락 | 아래 9.4의 잔여 binding·플랫폼별 계약을 관련 묶음에서 계속 |
| W7-02 구현 | PARTIAL — effect 값·wire·backend 기초 구현/검증 | 아래 9.5 이후 decoration/image/layer·sample 통합 계속 |
| W7-03·04 구현 | PARTIAL — rich text/selection 및 입력 묶음 연속 수락 | §9.43~44와 해당 checkpoint의 잔여 범위 유지 |
| W7-06 구현 | PAUSED / PARTIAL — 일반 sliver·List/Grid/Viewport·scroll owner·shrinkWrap 연결, 현재 30 groups PASS | §9.45: reveal/ensureVisible → 잔여 owner·animation → 통합 장면·원본 비교·출처 감사 |
| W7-05·07~14 구현 | 미완료 / 기존 선정 구현 승계 | 의존성과 사용자 흐름에 따라 계속 |
| 전체 제품 수락 | PAUSED / PARTIAL | 재개 후 W7-01~14 잔여·I2·최종 수락 계속 |

### 9.3 W7-01 첫 실행 — 서비스 호출·구독·종료 및 worker 소유권

**목표/결과:** sample의 앱별 `platformServices`로 실제 클립보드를 호출하고 locale/brightness/lifecycle을 표시한다. 두 owner의 채널·구독·오류를 분리하며, 종료는 새 요청을 차단하고 이미 전달한 OS 요청을 기다린다. background worker는 전송된 MessagePort와 root token으로 지정 앱의 messenger만 호출한다. 전체 W7 및 W7-01의 잔여 원본 바인딩은 PARTIAL이다.

- core: 24개 SystemChannels 선언, Clipboard/Data, 선정 SystemNavigator, 부분 ServicesBinding과 typed environment/observer. 기본 realm은 기존 opt-in 소유권을 유지하며, 복수 앱은 명시적 messenger를 사용한다. custom byte-only port는 호환성을 위해 `initializePlatformServices`에 별도 opt-in한다.
- SDK/backend: 앱별 plugin registry·JSON method dispatch·OS error/미지원 응답·byte snapshot·pending/reentrant close; 실제 browser Clipboard/History/환경 observer와 RN Clipboard/Appearance/AppState/Dimensions 연결. RN write 뒤 ordered read로 native queue 완료를 기다린다.
- worker: `PlatformMessageWorkerOwner`·cloneable root identity·`BackgroundPlatformMessageConnection`; 16 peer/256 pending/1 MiB payload 제한, send-only background contract, root close admission gate 및 pending reply 후 endpoint 종료. 원본 Dart VM isolate/ABI나 RN용 Worker 생성기 구현으로 확대하지 않는다.
- sample: Copy/Paste, locale·brightness·lifecycle·호출 결과, View/State 제거 뒤 늦은 결과 차단. Apple/Linux는 같은 RN 경로의 코드 구성에 포함하며 플랫폼 검증은 사용자 지정 SKIPPED/provider notVerified다.

**수락:** 모든 명령에 1,200초 timeout을 적용했다. root `check:types`, core/SDK build, Metro types가 PASS다. 한 세션의 원본/계약·화면 검증으로 묶었으며 과거 498+483 전체 channel oracle·6 target fresh 설치·전체 hash 감사는 재실행하지 않았다.

| 증거 | 결과 / 실제 범위 |
| --- | --- |
| `.tmp/work7/os-services/contracts-result.json` | PASS — 14개 통합 계약; 앱 격리·source channel 선언·오류·snapshot·구독 해제·pending/reentrant close 및 5개 RN adapter receiver. receiver는 native 실행 증거와 구분 |
| `worker-result.json`, `browser-result.json` | PASS — 실제 Node worker threads 및 Chromium DedicatedWorker/MessagePort로 root dispatch·token mismatch·pre-ready snapshot·pending native-root 요청/종료. Chromium Clipboard OS 왕복·환경 observer·history도 확인 |
| `windows-ui-result.json`, `windows-close-result.txt` | PASS — 현재 RNW/Hermes/Graphite sample의 Copy를 자동 pointer로 실행하고 Windows OS clipboard의 실제 값과 대조; cooperative process exit. UIA InvokePattern·물리 입력은 수락하지 않음 |
| `android-ui-result.json`, `android.png` | PASS — API33/x86_64 Pixel_5 emulator의 실제 설치 sample에서 자동 tap으로 Copy/Paste 및 결과 표시; JS/AndroidRuntime 오류 없음. ARM64 물리 기기·runtime destroy drain 증거와 구분 |
| `web-sample-result.json`, `web-sample.png`, `web-module-result.json` | PASS — 설치 archive 소비의 실제 Metro sample/CanvasKit WebGL2/software GPU에서 pointer→Copy/Paste→OS clipboard→editor 반영. 순환 class import와 mutable named import의 live read도 확인 |
| `adoption-result.json` | 44개 선정 record: adapted 39 / partial 2 / notApplicable 3. 전체 74,297개 중 missing 68,418 / partial 987 / adapted 4,877 / implemented 7 / notApplicable 8, evidence 41. 선언 수를 구현률로 환산하지 않음 |

**발견/수정 및 재실행 이유:** Windows sample이 오래된 native supplier를 기억해 source mismatch로 중단됐다. 현재 compiled source와 일치하는 기존 `w6-rounded-3e2a13223120d3ca` supplier를 명시해 prepare 후 build PASS(152초)했다. 준비 완료 전에 실행한 시도도 실패 로그로 보존했다. Android는 기본 GraalVM jlink가 실패해 해당 명령에만 Android Studio JBR을 지정한 뒤 build PASS(102초)했다. Windows UI harness의 숨김/IntPtr 판정 오류를 고친 후 실제 UI 수락을 수행했으며 앞선 forced-stop을 정상 drain으로 수락하지 않았다.

Web 전체 sample은 Metro experimental ESM lowering이 순환 import의 `Element`를 조기에 undefined로 고정해 실패했다. Web transformer가 Babel CommonJS의 live property read를 사용하도록 바꾸고 직접 dependency/lock과 **Web runner만** 재공급했다. 수정 뒤 화면이 열렸다. semantics proxy button은 의도적으로 pointer-events:none이므로 harness를 실제 canvas pointer 입력으로 고쳐 최종 통과했다. OS 서비스·worker 라이브러리/Metro 변경으로 무효화된 경로만 재실행했다.

**공급/비용:** core0.9.0/SDK0.11.0 개발 후보는 SHA-qualified archive로 기존 Android/Windows/Web runner에 공급·설치했다(초기 공급 약46초). 새 worker export 이후 SDK 전체 최종 공급은 다음 통합 후보에 묶는다. 따라서 첫 native 화면 receipt는 worker 추가 전의 명시한 archive 후보이며, worker 추가 후 SDK build·Node/browser worker 수락은 별도다. 임시 자료 정리와 전체 재설치는 하지 않았다. 구현/준비의 별도 시간 계측은 없으며 위 로그의 실제 명령 시간만 사용한다.

**잔여/다음 시작점:** source `RootIsolateToken`/`BackgroundIsolateBinaryMessenger`/dispatcher 등록의 공개 API 및 현재 SDK worker adapter mapping, ChannelBuffers native update 선언의 정확한 대응, native preferred locale/configuration bridge와 platform navigation/Back 수명은 W7-01/08에서 계속한다. ServicesBinding의 keyboard·editing·restoration·licenses·view-focus·system chrome 등은 관련 W7-04/05/08/11에 남아 있다. 물리 입력/한국어 IME·reader·scanout/FPS·복구·서명/clean-machine은 W7-13/14의 notVerified다. 연결된 물리 Android 기기에 이번 x86_64 APK를 설치하지 않았다. 소유 emulator와 브라우저/Windows 테스트 프로세스는 종료했으며 unrelated 기기·프로세스는 유지했다.

raw 로그·최종 화면·fixture·실패 자료·개발 archive는 `.tmp/work7/os-services/`에 보존한다. 재개 시 `resume-progress.md`와 `checkpoint.json`, 현재 diff를 먼저 읽고 한 번 실행한 `adopt.mjs`를 재실행하지 않는다.

### 9.4 W7-01 후속 — source dispatcher·네이티브 언어 목록·Back 연결

**목표/결과:** source RootIsolateToken/BackgroundIsolateBinaryMessenger를 SDK의 실제 root/MessagePort 수명에 연결했다. sample에서 OS 선호 언어 목록을 읽고 Android의 상세 화면에서 hardware Back으로 복귀하며, `System back`으로 플랫폼 종료/뒤로가기를 요청한다. 전체 W7과 ServicesBinding/PlatformDispatcher의 나머지 API는 PARTIAL이다.

- core: per-app RootIsolateToken, 선정 PlatformDispatcher message/registration API, IO background messenger의 중복 초기화·send-only·요청 id/완료·실패·종료, 별도 Web UnsupportedError stand-in. ChannelBuffers의 private native update를 실제 SDK listener update에 연결했다. ServicesBinding root token/channelBuffers·서비스 오류/Back observer와 Navigator의 기본 Back 소유권을 연결했다.
- token은 Dart VM int64/권한 credential이 아닌 SDK identity이며 cloneable `toMessage/fromMessage`를 사용한다. pin의 C++ CompleteEmpty는 id 없는 null을 보내지만 Dart receiver는 indexed list를 기대한다. Nelyx는 누락 plugin을 종료 가능한 indexed nullable reply로 명시적으로 보완한다. source inspection 근거이며 VM wire/Future microtick parity를 주장하지 않는다.
- native: Windows GetUserPreferredUILanguages, Android Configuration.locales, Apple NSLocale.preferredLanguages, Linux GLib language names. 구독 중 1초 polling과 RN lifecycle/configuration refresh, typed 오류·중복 억제·마지막 정상 snapshot·복구·late callback gate를 연결했다. Windows/Android module 및 sample/template 등록, Apple local podspec/Podfile, Linux JSI host를 구성했다.
- navigation: Android BackHandler 단일 owner/boolean popRoute/late result gate, Windows의 기존 cooperative root-close 경로, Apple main-thread pop/dismiss/window close, Linux UI-owner GTK close를 연결했다. Apple/Linux native build/runtime/harness는 만들거나 실행하지 않았고 사용자 지정 SKIPPED/provider notVerified다.

**통합 수락:** 기존 runner 3개에 최신 core/SDK/Skia-RN/CLI archive를 SHA-qualified identity로 공급했다. Metro·Skia-Web archive는 유효한 기존 것을 재사용했다. root types·core/SDK build, OS 계약14·owner17/125 expectations·실제 Node worker8·native receiver 계약10이 PASS다. receiver와 native 실행은 구분한다.

| 증거 (`.tmp/work7/os-services/`) | 결과 / 범위 |
| --- | --- |
| `worker-result.json`, `native-contracts-result.json` | PASS — root/default/explicit dispatcher, source IO/Web 차이, 초기화·snapshot·누락/오류/종료; locale poll/error/recovery/late callback, Back conflict/late result |
| `source-services-windows-build.log`, `source-services-windows-visible-ui-result.json`, `source-services-windows-visible-close-result.txt` | PASS — 현재 후보 RNW/Hermes/Graphite build, OS Clipboard Copy, OS 언어 목록 ko-KR/en-US와 화면 일치, sample SystemNavigator.pop → cooperative process exit. 자동 pointer이며 InvokePattern/물리 입력 수락 아님 |
| `source-services-android-native-access-retry.log`, `source-services-android-ui-result.json`, `source-services-android.png` | PASS — API33/x86_64 Release 설치, Copy/Paste, app locales ko-KR/en-US 변경 → 실제 Configuration 표시, 상세 → hardware Back → home, SystemNavigator.pop 후 foreground 이탈. locale 변경의 Activity 재생성은 허용했으며 in-process native notification 증거로 확대하지 않음 |
| `source-services-web-build.log`, `source-services-web-ui.log`, `source-services-browser-ui.log` | PASS — 현재 설치 후보 Metro/CanvasKit/WebGL2 sample Copy/Paste, Chromium OS Clipboard·두 앱·DedicatedWorker·history/환경/close. software GPU이며 물리 입력/scanout 증거 아님 |
| `source-dispatch-adoption-result.json` | 새 선정29 및 영향 destination129 갱신. 74,297 records: missing68,389 / partial987 / adapted4,906 / implemented7 / notApplicable8, evidence42. 기존 증거·상태를 전면 재생성하지 않음 |

**실패/비용:** 공급55초, Windows build138초, Android 성공 build192초, Web build21초, Android 화면27초였다. Android 첫 build는 JBR25 native-access 경고에서 CMake configure가 실패했다. 해당 실행에만 `JAVA_TOOL_OPTIONS=--enable-native-access=ALL-UNNAMED`를 지정한 retry가 통과했다. 실패 package directory 재사용 거부도 로그에 보존했다. Windows 첫 화면 검사는 작은 viewport에서 환경 문장이 화면 밖에 있어 실패했고, 최대화 및 상태 갱신 대기 뒤 통과했다. 첫 cleanup close를 SystemNavigator.pop 증거로 사용하지 않았다. 관련 실패 경로만 재실행했으며 전체 과거 oracle·6 target fresh install은 하지 않았다.

**잔여/다음:** W7-02의 paint/effect/image/decoration 장면을 이어 구현한다. ServicesBinding의 keyboard/editing/restoration/licenses/view-focus/system chrome, PlatformDispatcher의 metrics/views/semantics/scheduling/locale model, nested/offstage navigation·predictive Back은 W7-04/05/08/11에 남는다. Linux host의 실제 GTK Clipboard 대응과 각 native OS 특수 서비스도 W7-11에서 닫는다. 물리 입력/IME/reader·성능/복구·최종 외부 공급/서명/clean-machine은 W7-13/14의 notVerified다. 테스트 앱의 Android locale 설정은 이전 값으로 복원하고 앱만 종료했다. 기존 에뮬레이터는 소유하지 않아 유지했고 Windows·browser·worker 테스트 프로세스는 종료했다.

현재 후보와 전체 제품 완료를 구분한다. 같은 경로의 `checkpoint.json`/`resume-progress.md`가 최신 인계이며 이전 checkpoint·raw 로그·packages는 보존한다. `adopt-source-dispatch.mjs`도 일회성으로 실행했으므로 그대로 재실행하지 않는다.

### 9.5 W7-02 진행 — paint effect 값·wire·backend 기초

**진행/경계:** gradient·color/image/mask filter를 실제 frame과 Skia 실행에 연결했다. 이는 W7-02의 기초 구현·조기 경계 검증이며, decoration/image pipeline/retained layer/sample을 합친 **전체 세션 수락은 아직 아니다**. W7 전체 목표는 ACTIVE/PARTIAL이다.

- core: Gradient linear/radial/focal/sweep·local matrix, ResourceId ImageShader tile/sampling, ColorFilter mode/matrix/gamma/saturation·value equality/hash, MaskFilter blur/style/value protocol, ImageFilter blur/morphology/matrix/compose와 Impeller-only shader 미지원 계약. Paint effect getter/setter/copy·invertColors 및 extension dither, 기록 시 독립 snapshot·유한 float32 값·재귀/색상 budget·이미지 resource 열거를 추가했다.
- source 의미: ColorFilter.matrix는 원본처럼 입력 list를 유지하고 각 기록에서 캡처한다. ImageFilter.compose는 첫 변환 때 description을 생성·유지한다. color matrix의 translation column은 Skia 경계에서 /255로 변환한다. null blur mode는 Paint에서 Decal, compose 자식에서는 pin engine처럼 Clamp로 선택한다. Dart VM/native wrapper·hash 정수 동등성을 주장하지 않는다. ARGB8 색, stricter Shader dispose/debug guard와 진단 문자열 차이는 장부에 남겼다.
- wire/native: ABI1을 유지하며 wire6 effect block 및 source manifest/provider를 갱신했다. 모든 stop/matrix row/filter node를 4,096 expanded records·512KiB 추정값에 포함하고 256 colors/64 nodes/16 depth를 제한한다. C++ decoder가 effect 구조·수치·실제 native 생성까지 화면 변경 전에 확인한다. Web/RN도 style을 먼저 만들며 임시 wrapper를 해제한 뒤 recording의 native 참조와 frame lease가 유지된다. JSI shader validity/cubic matrix-filter binding을 구성했다.

| 증거 (`.tmp/work7/paint-effects/`) | 결과 / 범위 |
| --- | --- |
| `portable-result.json` | PASS — source 기반 public factory·입력 list/snapshot·copy/dispose·lazy compose·cycle/record budget·resource 참조 7개 통합 계약, wire6 228 records/24 tiles |
| `native-result.json`, `native.png` | PASS — AMD Radeon 780M의 실제 Windows offscreen Graphite/native Vulkan C ABI effect 장면·분석 가능한 색상 점 검증. 잘못된 packet/미지원 bounds/singular shader 19종은 red clear prefix보다 먼저 거부돼 pixels 유지. wire1~5 clear 입력도 실행. RN host/window/물리 표시 수락과 구분 |
| `web-result.json`, `web.png` | PASS — 실제 Chromium CanvasKit/software WebGL2의 같은 core 장면, GPU fence 이후 image lease 해제, 미지원 bounds/invalid shader의 변경 전 거부, Skia가 null로 최적화하는 유효한 identity filter 처리 |
| `pixel-comparison.json` | 관측 — 두 backend의 differing pixels17,631 / max channel delta24 / mean channel delta0.0452. 화면을 직접 확인했으며 전체 raster parity로 승격하지 않음 |
| `provider-result.json` | PASS — 6 target 공통 provider의 wire6 및 stale wire5 거부, generated/native core5 files/manifest 일치. Apple/Linux 전용 native 검증 아님 |
| `isolated-imports-result.json` | PASS — 공개 effect/paint/frame-wire 7개 모듈을 각각 새 Node 프로세스의 첫 import로 실행. aggregate/warm cache로 숨길 수 있는 class 초기화 순환도 확인 |
| `adoption-result.json` | 선정76 records/영향 destination60 갱신. 합계74,297: missing68,314 / partial1,007 / adapted4,958 / implemented7 / notApplicable11, evidence43. 새 notApplicable3은 호출 API가 아닌 compiler-synthesized enum constructor |

**검증/비용:** root types와 core/SDK/RN/Web build가 PASS이며 명령은 1,200초 timeout으로 실행했다. pin Dart와 실제 git blob의 C++ paint/image-filter/Skia converter를 직접 확인해 `qualified-source/`에 보존했다. 이번에는 원본 Dart VM/Flutter raster oracle을 실행하지 않았다. C ABI 첫 compile은 이미 제거된 SkGradientShader header를 참조해 실패했고 현재 SDK의 SkGradient/SkShaders API로 고친 뒤 통과했다(약5초). 유효한 null filter 및 singular shader, source lazy timing을 확인하며 영향 검사를 보강했다. 개별 ImageFilter 첫 import에서 ColorFilter 상속의 TDZ가 드러나 공유 enum 값을 Paint에 의존하지 않는 파일로 이동했다. 수정 후 7개 독립 import와 Web을 확인했고 native scene bytes는 기존 수락 SHA와 같아 해당 검사를 재사용했다. 전체 과거 oracle·6 target fresh 설치·RN 앱 재패키징은 반복하지 않았다.

**잔여/다음:** normalized bounded blur는 현재 backend가 미지원 오류로 거부하며 구현 잔여다. ResourceId ImageShader는 frame admission까지 live producer가 필요해 owned Image/ImageShader 수명이 완성되지 않았다. BoxDecoration/Border/Shape/Shadow·painting Gradient·widget/sample, image provider/stream/cache/decode/animated assets·BoxFit/repeat/nine-patch, retained layer/leader-follower/raster cache, 추가 Color/Path/Canvas/Picture 기능을 계속 구현한다. 새 JSI binding을 포함한 Windows supplier 재빌드·Android/Windows 설치 후보 수락은 이 통합 흐름에 묶는다. 9.4의 설치 archive/native supplier는 이번 wire/binding 변경의 **과거 후보**이며 current effect 검증으로 사용하지 않는다. Apple/Linux 공통 native 코드는 구성했으며 target compile/run/harness는 사용자 지정 SKIPPED/provider notVerified를 유지한다.

최신 인계는 `.tmp/work7/paint-effects/checkpoint.json`·`resume-progress.md`다. 이전 서비스 증거·cache·raw 로그·실패·이미지·packages는 보존했고 이식 `adopt.mjs`는 일회성 실행 완료 상태다. commit/push·scratch 정리는 수행하지 않았다.

### 9.6 W7-02 진행 — painting decoration·widget·예제 연결

**구현:** painting Gradient/LinearGradient/RadialGradient/SweepGradient·GradientRotation, Shadow/BoxShadow, BorderSide/ShapeBorder/OutlinedBorder·compound, BoxBorder/Border/BorderDirectional, Decoration/BoxPainter/BoxDecoration 및 선택 ImageConfiguration을 직접 모듈로 추가했다. stop union 보간·AlignmentGeometry/LTR/RTL·geometry shadow scale·stroke inset/outset·방향성/물리 border 간 보간을 원본 pin과 대조했다. Canvas.drawCircle과 even-odd path로 기록하는 drawDRRect를 연결했다. 일반 ShapeBorder의 Path.contains 의존, private shadow encoding·일부 border helper·진단, ARGB8 밖의 Color 모델은 남는다.

RenderDecoratedBox/DecoratedBox는 실제 painter·foreground/background·configuration을 사용하고 기존 숫자 color/radius 생성자를 유지한다. 장식 교체는 paint를 요청하며 shader cache는 bounds와 textDirection에 따라 바뀐다. 원본의 rect-only cache에서 textDirection도 무효화하는 것은 의도한 보정이다. 교체/detach/dispose 때 painter와 캐시 shader를 해제하고 이전 generation·detach 이후의 늦은 콜백을 차단한다. 자식 detach와 painter disposal이 동시에 실패해도 두 오류를 보존하고 ownership을 정리한다. sample과 template에 그림자·gradient·방향성 모서리/테두리 카드 및 LTR/RTL 전환 버튼을 추가했다.

| 증거 (`.tmp/work7/decoration/`) | 결과 / 범위 |
| --- | --- |
| `portable-result.json` | PASS — 값·보간·제약·캐시 방향 전환·늦은 callback·detach/re-attach/dispose·동시 해제 실패·foreground 순서 12개 계약, 공개 모듈 9개 독립 첫 import. 실제 FrameworkRoot 위젯 트리가 wire6 293 records/12 tiles 생성 |
| `native-result.json`, `native.png` | PASS — 현재 standalone DLL로 Windows offscreen Graphite/Vulkan의 decoration 장면, 색상 지점8개, checked close/drain. RN window/installed sample 수락은 아님 |
| `web-result.json`, `web.png` | PASS — Chromium147 CanvasKit/software WebGL2의 같은 scene packet, 색상 지점8개·lease retirement. browser/page/server 종료 |
| `pixel-comparison.json` | 관측 — 두 화면 직접 확인. differing pixels11,613 / max channel delta90 / mean channel delta0.0309. 전체 source raster parity로 해석하지 않음 |
| `adoption-result.json`, `final-result.json` | 새 선정317 records·영향 destination437 갱신, 최종 teardown 변경 binding290 갱신. 합계74,297: missing68,006 / partial1,099 / adapted5,174 / implemented7 / notApplicable11, evidence44. 기존43 evidence envelope 보존. 내부 선언은 public anchor와 local/access metadata로 구별 |

**검증/경계:** core/SDK/RN/Web build 및 최종 root types가 PASS이며 1,200초 timeout을 사용했다. 선택 Dart file과 git blob을 대조·보존했으며 새 Dart VM/Flutter raster oracle은 실행하지 않았다. 첫 widget harness는 semantics capability가 없어 실패했고 harness를 보정했다. 첫 픽셀 assertion은 5px 테두리의 경계 바깥 점을 잡아 안쪽 점으로 고쳤다. mapping 최종 확인의 implicit constructor 처리 실패도 보정했으며 raw 로그를 보존했다. 전체 이전 oracle·6 target fresh install·native supplier 재빌드는 반복하지 않았다.

**잔여/다음:** DecorationImage는 아직 구현되지 않아 image 전달을 명시적으로 거부한다. ImageConfiguration의 bundle/locale은 source AssetBundle/Locale 대신 host 값이며 partial이다. owned ui.Image/ImageShader, image provider/stream/cache/async decode/asset variants·animated image·BoxFit/repeat/nine-patch 및 retained layer/compositing/leader-follower/raster cache를 이어 구현한다. 새 RN JSI supplier와 패키지 공급·Windows/Android/Web 설치 장면은 이 통합 흐름에 묶는다. 이전 OS-service 설치 archive는 현재 wire/binding의 과거 후보다. Apple/Linux target native 검증은 사용자 지정 SKIPPED/provider notVerified를 유지한다. W7-02 전체 세션 및 W7-03~14는 미완료이며 **전체 목표 ACTIVE/PARTIAL**이다.

최신 인계는 `.tmp/work7/decoration/checkpoint.json`·`resume-progress.md`다. product 파일104개 해시와 scene packet/화면 해시를 기록했다. 이전 증거·실패·cache·packages를 유지했으며 이 단계 `adopt.mjs`는 실행 완료한 일회성 스크립트다. commit/push·scratch 정리는 수행하지 않았다.

### 9.7 W7-02 진행 — 소유된 이미지·provider/cache·실제 DecorationImage 흐름

**구현:** ui.Image clone/dispose/debug observer/readback, Codec/FrameInfo, 플랫폼 독립 ImageService와 per-app 소유권을 추가했다. ImageShader·Canvas 기록·frozen frame·재사용 repaint cache·진행 중 readback이 별도 참조를 보존하고 마지막 GPU lease 이후 native image를 해제한다. 같은 ID라도 다른 registry의 이미지는 혼용하지 못한다. 기록 실패·abandoned frame·paint rollback·detach를 자원 해제와 연결했다. SDK가 공개하는 기존 asset ResourceId에도 registry 소유자를 바인딩한다. owner 종료는 IO 취소·codec drain을 기다리고, 초기화 중 drain 실패 시 image/message owner와 backend를 보존한다.

ImageStream/Info/Listener/Completer·MultiFrame, pending/live/LRU ImageCache, MemoryImage/NetworkImage/AssetImage/ExactAssetImage/ResizeImage, AssetBundle/CachingAssetBundle·StandardMessageCodec asset manifest와 Nx variant 선택을 연결했다. asset manifest cache hit의 키는 동기로 반환하고 eviction 때 무효화한다. Web/RN backend는 실제 SkAnimatedImage 또는 still decoder에서 독립 sRGB frame을 만들며, framework가 반복·timer/vsync·listener pause·cache 수명을 관리한다. HTTP는 AbortController와 연결하고 native local URI IO는 완료 뒤 cooperative cancel을 확인한다. encoded16MiB·dimension8192·pixels16M·read8·decoder32·codec/frame 추정256MiB 제한을 둔다. native 메모리 실측값이나 기존 eager startup bitmap pool 전체 제한은 아니다.

paintImage·DecorationImage는 fit/crop/alignment/repeat/반전/nine-patch·placeholder·이미지 혼합을 실제 Canvas 연산으로 기록한다. BoxDecoration은 background와 border 사이에서 shape clip을 적용해 이미지를 그린다. sample/template의 방향 전환 카드에 AssetImage를 연결했다. wire7에 crop/nine-patch를 추가하고 ABI1·wire1~6 입력을 유지했다. native/RN/Web 모두 resource/style을 clear 전에 확인한다. RN의 repetition/reset·sRGB raster factory 소스도 구성했지만 새 native supplier 실행 수락은 아직 아니다.

| 증거 (`.tmp/work7/images/`) | 결과 / 범위 |
| --- | --- |
| `contracts-result.json`, `ownership-result.json` | PASS — pipeline18개 및 ownership7개 계약. 외부 owner ID·clone/record/cache/lease/readback·입력 snapshot·late codec/frame·재진입 종료·observer 중 dispose/close·동기 cache hit·variant·resize·finite animation/pause·오류/취소·실제 BoxDecoration 기록. decoder/clock mock 범위와 실제 backend 검증을 구분 |
| `native-result.json`, `native.png` | PASS — 현재 DLL의 실제 Windows offscreen Graphite/Vulkan crop/nine-patch/repeat/반전 11색상 지점 및 low-filter crop 경계. malformed continuation·stale generation·missing image·nine-patch 소수/quality 오류5종은 leading clear 이전 거부. wire1~6 clear도 실행. static C ABI image이며 RN dynamic decoder/window 증거는 아님 |
| `web-result.json`, `web.png`, `widget-web.png` | PASS — Chromium147 CanvasKit0.41.0/software WebGL2의 동일 11지점, 실제 GIF6 frame/기간·resize/PNG/RGBA-Float32 readback·malformed decode·built-in Web asset service 2x 선택·FrameworkRoot provider/이미지 혼합/clip 6지점. producer/캐시 해제 후 GPU lease retirement, HTTP abort 서버 관측, dynamic wrapper0 및 종료 확인 |
| `adoption-result.json`, `audit-result.json`, `checkpoint.json` | 선정340 records는 모두 partial, 기존 destination311 갱신. 합계74,297: missing67,695 / partial1,427 / adapted5,157 / implemented7 / notApplicable11, evidence45. 기존44 envelope 보존. 현재 binding622·module17·type-only anchor39·private binding59 확인. product 파일128개 해시 기록 |

**검증/보정:** 관련 build:sdk·root check:types, 최종 observer core build와 asset-owner SDK build가 PASS다. 모든 실행은 1,200초 timeout을 사용했고 같은 시나리오 반복은 30회 이내다. source pin git blob을 대조·보존했으며 Dart VM/Flutter raster oracle·전체 과거 회귀·fresh six-target packaging은 반복하지 않았다. actual Float32 readback에서 CanvasKit 기본 버퍼의 과다 길이를 발견해 명시적 Malloc/rowBytes·정확한 owned byte copy로 보정했다. harness의 clear/attached DOM/module scope/abort 관측 대기와 metadata의 property/inheritance 처리는 raw 실패를 남기고 고쳤다. 다른 local Skia 공급 소스를 보고 한 fast-constraint 잠정 판단은 철회했다. **현재 배포 CanvasKit의 선정 low-filter crop 경계는 native strict와 일치**하며, 고급 filter·다양한 경계·전체 source raster parity는 미검증이다. 화면3개를 직접 확인했다.

**잔여/다음:** source Image/RawImage/RenderImage 위젯과 loading/progress/error/precache/scroll-aware 수명, retained layer/compositing/leader-follower/raster cache를 계속 구현한다. 현재 basic.Image는 기존 resource 위젯이다. full ImageDescriptor/ImmutableBuffer/Color/wide gamut·rawUnmodified·정확한 source post-frame/진단/chunk stream·native local-file 취소·추가 paint/path/picture 의미가 남는다. 새 RN supplier와 현재 wire7 package/Windows·Android·Web 설치 흐름은 완성된 image/layer 통합 지점에서 묶는다. 이전 설치 후보는 과거 증거다. Apple/Linux 전용 native 검증은 사용자 지정 SKIPPED/provider notVerified를 유지한다. W7-01의 잔여 서비스와 W7-03~14·물리 입력/IME/reader/scanout/performance/recovery/배포 수락까지 **전체 목표 ACTIVE/PARTIAL**이며 완료 처리하지 않았다.

최신 인계는 `.tmp/work7/images/checkpoint.json`·`resume-progress.md`다. `images/adopt.mjs`는 실행 완료한 일회성 스크립트이며 다시 실행하지 않는다. 이전 기록·실패·cache·packages는 보존했고 commit/push·정리는 수행하지 않았다.

### 9.8 W7-02 진행 — provider Image·RawImage·RenderImage와 수명 연결

**구현:** `rendering/image`의 RenderImage는 소유된 Image·중복 clone 해제·aspect/intrinsic 크기·fit/alignment/반전/색상/nine-patch/repeat/opacity를 처리한다. `widgets/raw-image`는 입력을 빌리고 render object에 clone을 전달하며 생성 실패·unmount 때 정리한다. opacity 구독은 attach/detach와 연결했다. `widgets/image`의 Image 및 asset/network/memory factory는 frame/loading/error builder·gapless 교체·이미지 semantics·TickerMode/disableAnimations/View visibility·post-frame ImageInfo 해제를 연결한다. DefaultAssetBundle·createLocalImageConfiguration·DisposableBuildContext·ScrollAwareImageProvider·precacheImage를 함께 추가했고 sample/template의 작은 이미지를 새 provider 위젯으로 이행했다. 기존 basic.Image는 legacy API로 남는다.

네트워크 진행률은 ImageReadRequest→provider→loadingBuilder로 전달한다. 완료/취소 뒤 늦은 progress를 무시하고 완료 request/encoded-byte Promise 참조를 끊는다. pin의 `_network_image_io.dart`·`_network_image_web.dart`를 확인해 **헤더 내용을 포함하는 캐시 키**로 고쳤다. Web은 HTML strategy도 구별하고 native는 그 strategy를 무시한다. HTTP 오류는 실제 status/resolved URL을 가진 NetworkImageLoadException으로 전달한다. Web HTML prefer/no-header 경로는 명시적으로 미지원이며 fallback의 byte fetch/decode가 실패하면 HTML backend 부족을 보고한다. source의 HTML/platform-view 동작을 완료로 대체하지 않는다.

native frame 해제 실패는 wrapper와 오류를 보존하고 decoder 입력을 닫는다. 종료 시 codec drain을 기다린 **뒤** 오류를 수집해 늦은 cleanup 실패도 backend 해제 전에 차단한다. 이미지 listener generation·errorBuilder 변경·동기 pause keepalive·opacity 교체 invalidation·clone rollback은 수명 경계를 보강했다. 원본 callback 순서보다 보강한 부분과 ARGB8/ValueListenable/string URI·일부 diagnostics 차이는 장부에 남겼다.

| 증거 (`.tmp/work7/image-widgets/`) | 결과 / 범위 |
| --- | --- |
| `contracts-result.json` | PASS — 실제 FrameworkRoot/State/RenderImage에서 geometry·clone/borrow·frame/semantics·gapless/빈 교체·late frame·progress/error·TickerMode/visibility·precache·bundle/DPR/RTL·빠른 scroll의 지연/캐시 hit/해제/정지 후 재개·cache0 동기 pause keepalive·제출 lease·native retirement 실패/late drain·헤더/strategy 키 18개 계약. decoder/clock/fault는 제어된 port이며 실제 native failure 주장은 아님 |
| `web-result.json`, `web.png`, `opacity-web.png`, `error-web.png` | PASS — Chromium147 CanvasKit/software WebGL2의 실제 Image/RawImage/RenderImage, 두 HTTP chunk의 진행률·404 타입/원인·decode error UI·동일 URL/다른 헤더의 별도 응답·GIF pause/resume·opacity repaint·DOM img 라벨. Root 종료 시 semantics 숨김, Surface 종료 시 제거, HTTP abort·dynamic wrapper0·종료 확인 |
| `native-result.json`, `initial-native.png`, `opacity-native.png` | PASS — 위 Web FrameworkRoot의 실제 frame packet 2개를 Windows offscreen Graphite/Vulkan에서 재생. PNG frame asset4개를 C ABI로 공급해 분석 지점7개 확인·retire/release/close 수행. 두 선정 화면의 Web/native pixel delta0. RN dynamic decoder/설치 host·물리 표시·Flutter raster oracle은 별도 |
| `metro-result.json`, `hermes-result.json`, `consumer.ts` | PASS — 현재 workspace direct exports의 Metro bundle, 실제 Windows Hermes source와 optimized HBC99의 widget/소유권·헤더 키·타입 초기화. 공개 경로7개 독립 Node 첫 import 및 strict NodeNext 선언 소비. 설치 archive/새 외부 앱/native host 증거는 아님 |
| `adoption-result.json`, `audit-result.json`, `checkpoint.json` | 선정209 records 모두 partial·기존 destination117 갱신. 합계74,297: missing67,514 / partial1,608 / adapted5,157 / implemented7 / notApplicable11, evidence46. 기존45 envelope 보존. 현재 destination320·public module10·type-only anchor12·private binding28 확인. product 파일137개 해시 기록 |

**검증/보정:** 관련 build:sdk·최종 core build·root check:types·엄격 선언 소비가 PASS다. 테스트는 모두 1,200초 timeout이며 반복은 30회 이내다. 원본 git blob을 대조·보존했고 VM/raster 전체 oracle·과거 전체 회귀·fresh target packaging은 반복하지 않았다. harness의 잘못된 Builder import를 고쳤다. DOM binding의 hide와 Surface의 remove를 혼동한 assertion은 실제 경계에 맞게 나눴다. HTTP 헤더 fixture에는 Vary/no-store를 지정하고 **캐시 완료 뒤 실제 새 위젯 paint**를 기다리도록 보정했다. raw 실패를 유지했다. Web/native 화면을 직접 확인했으며 현재 선정 화면의 pixel delta0을 전체 Flutter 동등성으로 확대하지 않는다.

**잔여/다음:** retained layer tree·compositing·PictureRecorder/리소스 수명·leader/follower/repaint/raster cache와 추가 painting/Canvas/Path/Color 의미를 계속 구현한다. FileImage/Image.file은 별도 native file IO가 필요하다. 현재 Windows/Linux asset stream의 root confinement를 일반 파일 API로 잘못 재사용하거나 완화하지 않는다. HTML/platform-view 이미지·전체 WidgetsBinding observer/accessibility/reassemble·native accessibility 전파·정확한 전역 PaintingBinding/cache post-frame 등도 남는다. 새 RN supplier와 wire7 Windows/Android/Web 설치 후보의 통합 수락은 image/layer 연결 뒤 묶는다. Apple/Linux 전용 native 검증은 사용자 지정 SKIPPED/provider notVerified다. W7-01 잔여·W7-03~14·물리/복구/성능/외부/배포 검증까지 **전체 목표 ACTIVE/PARTIAL**이며 완료 처리하지 않았다.

최신 인계는 `.tmp/work7/image-widgets/checkpoint.json`·`resume-progress.md`다. `image-widgets/adopt.mjs`는 실행 완료한 일회성 스크립트다. 이전 기록·cache·packages를 보존했고 commit/push·정리는 하지 않았다.

### 9.9 W7-02 진행 — CPU retained Picture·Scene·layer와 실제 filter/repaint 흐름

**진행/경계:** PictureRecorder·Picture·SceneBuilder·Scene, 소유권이 있는 layer 트리와 실제 소비 위젯을 연결했다. 이는 CPU subtree snapshot을 기존 wire7 frame으로 펼치는 구현이다. native retained root tree·GPU raster cache·leader/follower·Picture/Scene 이미지 rasterization은 미완료이며 **W7 전체 목표 ACTIVE/PARTIAL**을 유지한다.

**제품 연결:** `ui/picture-recorder`·`ui/picture`·`ui/scene`과 `framework/rendering/layer`·`rendering/filter`·`widgets/color-filtered`·`widgets/image-filtered`의 직접 공개 경로를 추가했다. Canvas(recorder)는 종료 때 남은 save를 복구하고 닫히며 cull bounds는 clip으로 바꾸지 않는다. Picture는 불변 명령과 이미지 참조를 소유하고 drawPicture·Scene·제출 frame은 독립 참조를 캡처한다. approximateBytesUsed는 CPU wire 저장량 추정값이다. SceneBuilder의 engine layer 종류는 선언 파일에서도 구별하며 미완성·해제·중복 subtree·잘못된 oldLayer 종류를 거부한다. 반환한 engine layer handle과 Scene은 사용 후 dispose한다.

LayerHandle·ContainerLayer·PictureLayer의 parent/sibling/depth·attach/detach·참조 수명·dirty 전파·composition callback을 실제 구현했다. offset/transform/rect·RRect·Path clip/opacity/color·image-filter layer가 그리기 명령을 만든다. 변경 없는 subtree의 snapshot을 재사용하고 부모 이동 뒤에도 변경 없는 자식 snapshot은 유지한다. 실패한 scene은 재시도할 수 있고 callback/정리 실패는 나머지 detach·자식 해제를 계속한 뒤 보고한다. callback 추가/제거와 중복 등록은 snapshot 순서로 전달한다. 전체 diagnostics·annotation 등 source class 완료로 확대하지 않는다.

PaintingContext.addLayer가 현재 transform·clip에서 Scene을 소비하며 새 자식 기록이 성공한 뒤 이전 layer 내용을 교체한다. RepaintBoundary는 종전 명령 배열 대신 OffsetLayer/PictureLayer를 소유한다. RenderOpacity와 ColorFiltered/ImageFiltered는 실제 layer 합성을 사용한다. ImageFiltered의 source updateCompositedLayer 최적화·전체 root engine layer 수명은 아직 남는다. sample/template의 기존 Flow.wrapAll 경로가 새 boundary 구현을 소비한다. 중복 explicit wrapper는 제거하고 이전 검증 app source bytes와 일치함을 확인했다. 한국어/영어 README에 공개 API와 해제 경계를 설명했다.

증거는 `.tmp/work7/layers/`에 있다.

| 증거 | 결과/범위 |
| --- | --- |
| `contracts-result.json`, `consumer.mts` | PASS — 별개 계약15개: recorder·불변 기록·독립 image 참조/두 frame lease·tree/handle·retained subtree/이동/교체·clip/filter/matrix·callback·실패 재시도·중복 engine 사용·기록 교체 실패. 공개 모듈7개 독립 Node import와 엄격 NodeNext emitted declaration 소비. 기존 image-widget18 계약도 현재 core에서 PASS |
| `scene-result.json`, `web-result.json` | PASS — 실제 FrameworkRoot 두 frame에서 opacity/clip/filter enabled 변경 후 painter 호출 `[1,1,1,1]` 유지. Chromium147 CanvasKit/software WebGL2가 frame마다 분석 지점10개·GPU fence retirement 확인 |
| `native-result.json` | PASS(선정 의미/수명) — 동일 packet을 Windows offscreen Graphite/Vulkan C ABI에서 재생해 frame당 분석 지점10개·retire/close 확인. **전체 PNG 비교 PARTIAL**: 타원 clip AA 경계 1.5px 이내에서 initial221/changed225 pixel이 채널 delta1 초과, 최대32. 나머지 픽셀은 delta1 이하. 원본·delta PNG와 최초 엄격 비교 실패 로그 보존. Flutter raster parity·native raster cache 증거가 아님 |
| `image-flow/web-result.json`, `image-flow/native-result.json` | PASS — RepaintBoundary를 적용한 실제 asset/RawImage·HTTP progress/header-key/typed404/decode error·GIF pause/resume·DOM semantics·pending abort와 dynamic wrapper0. 현재 packet의 PNG asset을 standalone C ABI로 공급한 initial/opacity 선정 화면 delta0. RN dynamic decoder·설치 host는 별도 |
| `metro-result.json`, `hermes-result.json` | PASS — 현재 workspace Metro와 실제 Windows Hermes source/optimized HBC99에서 FrameworkRoot Picture/layer/filter/RepaintBoundary·한 번의 자식 paint·마지막 frame lease 이후 image 해제. 새 RN native binding/GPU 수락은 아님 |
| `adoption-result.json`, `audit-result.json`, `checkpoint.json` | 선정196 records 모두 partial, 기존 destination42 갱신, 과거46 envelope 보존. 합계74,297: missing67,319 / partial1,803 / adapted5,157 / implemented7 / notApplicable11, evidence47. destination237 bindings·public module11·module-private1 확인, product 파일144개 해시 기록 |

**검증/보정:** 최종 build:sdk·core build·root check:types·선언 소비가 PASS다. 테스트 timeout은 1,200초이고 반복은 30회 이내이며 서로 다른 계약 수와 반복 수를 구분했다. source 파일7개의 pin Git blob을 대조·보존했다. TypeScript private field 충돌/추론과 harness의 번들러 경로 오류를 고쳤고 raw 실패를 유지했다. 타원 AA 차이를 전체 일치로 바꾸거나 숨기지 않았다. Web/native 화면을 직접 확인했다. 모든 소유 browser/server/Metro/Hermes/C ABI 작업은 종료했고 기존 device/emulator는 건드리지 않았다. 과거 전체 oracle·6개 target 재공급은 반복하지 않았다.

**잔여/다음:** 실제 leader/follower transform·hit test·annotation, retained root composition/native raster cache·Picture rasterization과 추가 painting/Canvas/Path/Color를 계속 구현한다. FileImage/Image.file 전용 native IO, HTML/platform-view 이미지·binding observer/accessibility/reassemble·native accessibility 전파·전역 PaintingBinding/cache post-frame 등도 남는다. 새 RN supplier와 현재 wire7 Windows/Android/Web 설치 image/layer 후보의 통합 수락을 진행해야 한다. Apple/Linux 전용 native build/run/harness는 사용자 지정 SKIPPED/provider notVerified다. W7-01 잔여 및 W7-03~14·물리 입력/IME/reader/scanout/FPS·복구/외부/배포까지 **전체 계획 미완료**다.

최신 인계는 `.tmp/work7/layers/checkpoint.json`·`resume-progress.md`다. `layers/adopt.mjs`는 실행 완료한 일회성 스크립트다. 기존 변경·증거·cache/packages를 보존했고 commit/push·정리는 하지 않았다.

### 9.10 W7-02 진행 — 공유 root layer 트리와 leader/follower 실제 소비

**제품 연결:** FrameworkRoot가 PipelineOwner에 붙인 OffsetLayer를 소유하고, paint에서 수집한 실제 layer 트리를 semantics 수집 전에 합성한다. PaintingContext는 Canvas 상태와 Picture·자식 layer를 순서대로 보존하며 최종 frame export 때 wire7로 펼친다. RepaintBoundary·opacity·filter 내부의 follower도 공유 트리에 남는다. 긴 순차 상태 기록은 얕은 내부 상태 scope로 합치고 rollback·재시도·Picture hooks·이미지 독립 참조·닫힌 Canvas 기록을 처리한다. native retained GPU 실행·raster cache·Picture/Scene rasterization은 아직 미완료다.

LayerLink·LeaderLayer·FollowerLayer, `rendering/proxy-layer`의 RenderLeaderLayer/RenderFollowerLayer, `widgets/composited-transform`의 Target/Follower 직접 공개 경로를 추가했다. 공통 조상까지의 전체 4×4 행렬, paint 순서·owner·트리 검사, anchor·offset·퇴화 행렬·unlink/hide를 구현했다. 마지막 합성 transform으로 자식 hit test와 semantics를 갱신한다. 부모 hit 영역은 이동한 자식을 포함해야 한다. RenderFollowerLayer.offset의 source 의미를 유지하기 위해 RenderBox 부모 배치 값을 layoutOffset으로 분리하고 실제 RenderBox receiver38곳을 옮겼다. 안정된 BoxWidget 갱신의 무조건 layout invalidation을 없애고 legacy Image의 크기/리소스 변경은 명시적으로 무효화한다. DOM에서 제거한 control의 원래 callback도 해제한다.

증거는 `.tmp/work7/compositing/`에 있다.

| 증거 | 결과/범위 |
| --- | --- |
| `contracts-result.json`, `consumer.mts`, `imports-result.json` | PASS — 서로 다른 계약20개: link/소유권·4×4 변환/이동/순서/퇴화·실제 Root에서 자식 painter1회 유지·이동 좌표 입력/semantics·hide/unlink·독립 image/frame lease·callback 실패 재시도·Picture hooks·Canvas 기록 종료·긴 순차 상태 기록. 엄격 NodeNext emitted 선언 소비와 공개 경로3개 독립 첫 import 확인. 기존 layer15/image18 계약도 별도 새 출력 경로에서 PASS |
| `web-result.json` | PASS — 실제 Chromium147/CanvasKit/software WebGL2 Root의 initial/moved/hidden/unlinked4 frame·분석 지점11개. target 이동 뒤 follower DOM bounds `(85,47,20,10)→(115,47,20,10)`, activation1회·숨김/제거·callback 해제 확인 |
| `native-result.json` | PASS — 같은4 packet을 Windows offscreen Graphite/Vulkan C ABI로 재생, 선정 전체 PNG delta0·retire/close 확인. 이전 타원 AA 비교 PARTIAL은 그대로이며 이 사각형 화면 PASS로 대체하지 않음 |
| `image-flow/web-result.json`, `image-flow/native-result.json` | PASS — 현재 공유 트리에서 실제 image/HTTP progress·header key·404/decode 오류·GIF pause/resume·precache/abort·DOM·wrapper0 회귀. standalone C ABI initial/opacity PNG delta0. RN dynamic codec/설치 host 증거는 아님 |
| `metro-result.json`, `hermes-result.json` | PASS — 현재 workspace Metro와 Windows Hermes source/optimized HBC99의 실제 Root 이동/retained/hit/hide/unlink·AggregateError. 두 mode 결과 일치. raw JS engine이며 RN host 수락은 별도 |
| `adoption-result.json`, `audit-result.json`, `checkpoint.json` | 선정87 모두 partial·현재 destination/exportSource1240 갱신·과거47 envelope 보존. 합계74,297: missing67,239 / partial1,883 / adapted5,157 / implemented7 / notApplicable11, evidence48. destination1321 bindings·public module28·type-only anchor52·module-private23 확인, product162개 해시 기록 |

**검증/보정:** 관련 SDK/core build·root types·선언 소비가 PASS다. 모든 테스트 timeout1,200초, 대부분 반복30회 이내다. pin 원본4개 Git blob을 대조·보존했다. 실제 root composition으로 드러난 boundary parent detach 중복, private link 이름 충돌, 부모 layout offset, setter invalidation, DOM control 교체와 callback 정리, assembly 이후 Canvas mutation을 고쳤다. raw 실패 로그는 보존한다. 과거 fixture를 잘못 직접 실행해 덮어쓴 historical layer packet은 제품을 되돌리지 않고 임시 legacy loader로 복원했고 이전 checkpoint artifact11개 해시가 모두 일치한다. 향후 회귀는 새 디렉터리에 출력한다. 소유 browser/server/Metro/Hermes/C ABI 프로세스는 종료했고 기존 emulator는 건드리지 않았다.

**잔여/다음:** 실제 native Picture/retained 실행·raster cache·Picture/Scene toImage와 annotation/backdrop/shader-mask/texture/platform-view·추가 Canvas/Path/Color를 계속 구현한다. ImageFiltered의 source composited update 최적화·전체 layer/render lifecycle·diagnostics도 남는다. FileImage/Image.file 전용 native IO는 confined asset stream을 완화하지 않고 별도로 구성한다. binding/native accessibility/HTML image·새 RN supplier와 현재 wire7 Windows/Android/Web 설치 통합·W7-01 잔여·W7-03~14·물리 입력/IME/reader/scanout/FPS·복구/성능/외부/배포 수락까지 **전체 목표 ACTIVE/PARTIAL**이다. Apple/Linux 전용 native 검증은 사용자 지정 SKIPPED/provider notVerified다.

최신 인계는 `.tmp/work7/compositing/checkpoint.json`·`resume-progress.md`다. `compositing/adopt.mjs`는 실행 완료한 일회성 스크립트다. 기존 변경·증거·cache/packages를 보존했고 commit/push·정리는 하지 않았다.

### 9.11 W7-02 진행 — 실제 layer annotation·Path query·follower repaint 보정

**제품 연결:** AnnotationEntry/Result·AnnotatedRegionLayer, `rendering/annotated-region`·`widgets/annotated-region`을 추가했다. 명시적인 AnnotationType<T> identity가 Dart의 reified generic 타입 비교를 대체하며 emitted 선언에서도 서로 다른 T를 구분한다. widget의 runtime type에도 token을 포함한다. reverse paint 순서·자식 우선 검색·타입별 opaque 흡수·own-region size/offset·불변 결과와 localPosition을 구현했다. sized는 자신의 annotation만 제한하며 자식 검색이나 paint를 clip하지 않는다.

Offset/transform/rect·RRect·Path clip/leader/follower와 내부 Canvas 상태 scope가 검색 좌표와 clip을 전파한다. FrameworkRoot.findAnnotation/findAllAnnotations는 마지막으로 합성한 실제 공유 트리를 사용한다. Path.contains는 명시적인 앱별 engine query 서비스를 받는다. SDK startup/View에 이를 전달하고 Web CanvasKit·공통 RN Skia host에 실제 공급했다. 렌더링과 query가 같은 path 생성 helper를 공유하고 builder/path/rectangle 임시 wrapper는 성공·구성 실패·query 실패·정리 실패에서 해제한다. 전역 native 상태나 곡선의 근사 polygon으로 대체하지 않았다.

**원본 차이/발견:** pin의 FollowerLayer annotation은 getLastTransform의 inverse XY에 linkedOffset을 추가 차감한다. 이 계산을 그대로 보존·검증·문서화했으며 nonzero linked offset에서는 render hit 좌표와 다르다. source VM oracle로 보정한 것은 아니다. 실제 annotation 값 갱신은 이전 follower 합성 transform을 자식 기록에 다시 적용하는 기존 repaint 버그를 드러냈다. 자식 paint는 base layout transform으로 기록하고 hit/semantics는 합성 transform을 계속 사용하도록 고쳤다. 이동 뒤 값 교체·화면·pointer local 좌표로 재현/보정을 확인했다.

증거는 `.tmp/work7/annotations/`에 있다.

| 증거 | 결과/범위 |
| --- | --- |
| `contracts-result.json`, `backend-contracts-result.json`, `regression-result.json` | PASS — annotation/실제 Root 계약10개, 실제 Web/RN JS translator의 제어된 binding 실패·wrapper retirement12개, 현재 core의 기존 compositing20 계약. binding fault 검사는 native geometry/host 실행 증거가 아님 |
| `consumer.mts`, `imports-result.json`, build/type logs | PASS — core/SDK build·root types, strict NodeNext emitted 선언의 invariant annotation token·값 타입·readonly 결과, 새 공개 모듈2개 독립 Node 첫 import |
| `web-result.json`, `native-result.json` | PASS — 실제 Chromium147/CanvasKit/software WebGL2의 앱별 SkPath.contains 곡선·evenOdd hole·Canvas clip, initial/moved/changed/hidden/unlinked5 Root frame의 annotation 갱신/이동/숨김/지역좌표와 repaint 후 pointer local `[5,4]`. 동일5 packet Windows offscreen Graphite/Vulkan 재생·선정 전체 PNG delta0·retire/close. 이전 타원 AA PARTIAL은 유지 |
| `metro-result.json`, `hermes-result.json` | PASS — 현재 workspace Metro와 실제 Windows Hermes source/optimized HBC99의 annotation 타입 identity·Root 이동/값 갱신/repaint/hit/hide/unlink·해제. 두 mode 결과 일치; RN 설치 host는 별도 |
| `adoption-result.json`, `audit-result.json`, `final-verification.json` | 선정47 모두 partial·기존 destination/exportSource216 갱신·과거48 envelope 보존. 합계74,297: missing67,192 / partial1,930 / adapted5,157 / implemented7 / notApplicable11, evidence49. 현재263 destination bindings·module5·type-only anchor3 확인. product167·현재 artifact18·이전 artifact26 해시와 diff check PASS |

**검증/보정:** 테스트 timeout은 모두1,200초이며 반복은 대부분30회 이내다. pin 원본4개 Git blob을 대조·보존했다. private phantom field의 타입이 emitted 선언에서 생략되어 token invariance가 사라지는 문제는 protected typed witness로 고쳤다. bundler 경로·실패 fixture의 조기 중단 예상·회귀 receipt 출력 경로도 보정했다. 회귀가 쓴 이전 contracts JSON은 이전 checkpoint와 deep-equal임을 확인해 원래 자료가 같은 bytes임을 보존했고 현재 receipt는 새 경로에 둔다. Web/native 화면을 직접 확인했다. 모든 소유 browser/server/Metro/Hermes/C ABI 작업은 종료했고 기존 emulator는 건드리지 않았다. 과거 전체 oracle·6-target packaging은 반복하지 않았다.

**잔여/다음:** native Picture/retained GPU 실행·raster cache·Picture/Scene toImage/toImageSync, backdrop/shader-mask/texture/platform-view와 추가 Canvas/Path/Color·전체 layer/render/diagnostics·SystemChrome annotation 소비를 이어 구현한다. RN native Path query 실행과 fresh supplier/현재 Windows·Android·Web 설치 image/layer 통합도 남는다. 전용 FileImage IO·binding/accessibility/HTML image와 W7-01 잔여·W7-03~14·물리 입력/IME/reader/scanout/FPS·복구/성능/외부/배포까지 **전체 목표 ACTIVE/PARTIAL**이다. Apple/Linux는 실제 공통 코드를 구성하며 전용 native 검증은 사용자 지정 SKIPPED/provider notVerified다.

최신 인계는 `.tmp/work7/annotations/checkpoint.json`·`resume-progress.md`다. `annotations/adopt.mjs`는 실행 완료한 일회성 스크립트다. 기존 변경·증거·cache/packages를 보존했고 commit/push·정리는 하지 않았다.

### 9.12 W7-02 진행 — 실제 SkPicture·GPU rasterization·이미지 복구와 소유권

**제품 연결:** Picture/Scene의 toImage·toImageSync, OffsetLayer의 bounds/pixelRatio capture, public `rendering/repaint-boundary`의 RenderRepaintBoundary capture를 구현했다. SDK가 앱별 RasterizationService를 startup/View에 공급한다. 대기 중 원본 Picture/Scene을 dispose해도 capture·입력 producer/lease를 유지한다. 출력 Image는 독립 producer·readback·frame lease를 사용하며 RawImage·drawImage·shader에서 기존 image resource로 소비한다. OffsetLayer는 자신의 offset과 논리 bounds를 상쇄하고 출력 크기를 올림한다. dirty boundary는 현재 paint 완료 전 capture를 거부한다.

Web/RN backend는 **실제 native SkPicture**를 기록·재사용하고 GPU surface에서 그린 뒤 CPU 복구 가능한 sRGB RGBA8 Image로 readback한다. cache는 recording identity·앱/backend별이며 64개/실제 approximateBytesUsed32MiB를 제한하고 recording retirement·owner 종료에서 해제한다. Web context 재생성 때 native cache를 비우고 CPU 기록에서 다시 만든다. native codec/decoded/raster 이미지와 임시 저장은 앱별 memory budget을 공유한다. raster 출력 ID는 기존 image/font/inflight ID를 건너뛰어 원래 backend map을 덮어쓰지 않는다.

**수명/포트:** JSI Picture 메모리 조회·recorder/surface borrowed canvas invalidation을 실제 코드와 Web facade에 연결했다. null recording submit을 건너뛰고 surface의 checked drain·Dawn submit 결과를 검사한다. 완료가 불명확한 GPU 작업은 capture·입력 lease·surface·임시 저장을 유지하고 checked drain 성공 뒤 해제한다. 실패한 drain은 backend/session을 보존한다. Vulkan offscreen은 bounded8192/16M image target을 구성하고 Dawn의 sRGB surface tagging도 맞췄다. C ABI1에 owner/thread별 picture_record/rasterize/release를 추가했으며 wire7은 유지한다. native surface/Picture readback callback은 heap 소유 상태를 사용해 실패 뒤 stack 주소를 남기지 않는다. GPU readback 완료가 불명확하면 C ABI owner는 checked close만 허용한다.

**경계:** 이는 rasterization용 native Picture cache다. FrameworkRoot/Canvas.drawPicture의 최종 frame export는 여전히 flatten하며 **retained GPU frame/layer 실행·raster cache는 미완료**다. sync adapter는 GPU readback까지 기다리며 pin의 deferred sync image·Picture.toImageSync TargetPixelFormat·wide gamut/precision 의미는 남는다. 클래스 전체 완료나 native RN 설치 host 수락으로 확대하지 않는다.

증거는 `.tmp/work7/rasterization/`에 있다.

| 증거 | 결과/범위 |
| --- | --- |
| `contracts-result.json`, `backend-contracts-result.json` | PASS — 서로 다른 core 계약14개: capture/cache·크기 변경 재사용·원본 선해제·두 frame lease·foreign registry·오류/stop·Scene/Offset/boundary·checked/failed drain. 실제 RN JS translator 제어된 binding fault/retirement·image/font ID 충돌11개. mock은 native GPU 실행 증거가 아님 |
| `web-result.json` | PASS — 실제 SDK startup→View rasterizer→RawImage/FrameworkRoot→boundary capture→context 재생성→Root 재표시→종료. CanvasKit/software WebGL2 실제 SkPicture는 다른 출력 크기에서도 첫 기록1회 재사용. Scene 선해제·offset/crop·7 capture·borrowed facade invalidation·선언된 raster ID 충돌·native cache/동적 image bytes0 확인 |
| `native-result.json`, `*-native.*`, `boundary-delta.png` | PASS(선정 기능/수명) — actual Windows Graphite/Vulkan C ABI retained Picture에서 원본 GPU image map producer를 해제한 뒤 재사용. 원본 paragraph/font 해제 뒤에도 text raster bytes 동일. duplicate/stale/wrong-thread/size/buffer 거부·checked close. **raster parity PARTIAL:** small/large/Scene/integer crop/restore 전후6 premultiplied RGBA 및 출력 image frame은 delta0. fractional1.5 nearest boundary는116 pixel이 delta1 초과·최대255이며 모든 차이는 인접 expected sample과 일치. 전체 raster parity가 아님. raw 실패와 delta PNG 보존; 이전 타원 AA PARTIAL도 유지 |
| `regression/`, compiler/type/import logs, `metro-result.json`, `hermes-result.json` | PASS — 현재 core의 기존 compositing20/annotation10 계약, core/SDK/root types·strict emitted 선언·새 direct module3개 독립 첫 import. Metro와 실제 Windows Hermes source/optimized HBC99의 sync/async capture/cache/output frame lease 결과 일치. native backend는 통제 mock이며 RN host 증거는 별도 |
| `windows-rn-srgb/supplier/inputs.json` | PASS-scoped — 현재 RN/JSI source compile·supplier 구성, source147 해시·library18개·file1795개. **이 후보의 Windows/Android/Web 설치 통합·native RN raster/codec 실행은 아직 미검증**. 앞서 만든 preview supplier는 최신 입력이 아님 |
| `adoption-result.json`, `audit-result.json`, `final-verification.json` | 선정14 모두 partial·기존 destination/exportSource228 갱신·과거49 envelope 보존. 합계74,297: missing67,182 / partial1,940 / adapted5,157 / implemented7 / notApplicable11, evidence50. 현재238 bindings/module5 확인. product185·현재 artifact45·이전 artifact44·최신 supplier source147 해시와 diff check PASS |

**검증/보정:** 테스트는 모두1,200초 timeout이며 같은 시나리오 반복은 대부분30회 이내다. pin 원본4개 Git blob을 대조·보존했다. 타입/borrowed Canvas 소유권·startup GPU context 초기화·readback 타입 추론·frame resolver fixture를 고쳤다. fixture의 원본 image 크기400×100/범위100이 실제48×48과 달랐던 것도 바로잡고 해당 raw 이미지를 별도 보존했다. 이후 드러난 fractional nearest 차이는 tolerance를 넓혀 PASS로 바꾸지 않았다. source 검토에서 추가한 checked GPU drain·heap callback·sRGB tag·ID 충돌 보정은 현재 증거에 명시적으로 반영했다. 현재 source의 Native/SDK 빌드와 필요한 경로만 재실행했고 전체 과거 oracle·6-target packaging은 반복하지 않았다. Web/native/text/delta 화면을 직접 확인했다. 모든 소유 browser/server/Metro/Hermes/C ABI/native supplier 작업은 종료했고 기존 emulator는 건드리지 않았다.

**잔여/다음:** native retained frame/layer Picture resource·GPU 실행·raster cache를 실제 frame/리소스/wire/backend에 연결한다. 이어 fresh Windows supplier를 사용해 현재 Windows·Android·Web image/layer/raster 설치 cohort를 묶어 수락한다. backdrop/shader-mask/texture/platform-view·추가 Canvas/Path/Color·deferred image/TargetPixelFormat·전체 layer/render/diagnostics·SystemChrome, 전용 FileImage IO·binding/accessibility/HTML image와 W7-01 잔여·W7-03~14·물리 입력/IME/reader/scanout/FPS·복구/성능/외부/배포까지 **전체 목표 ACTIVE/PARTIAL**이다. Apple/Linux 코드는 구성하며 전용 native 검증은 사용자 지정 SKIPPED/provider notVerified다.

최신 인계는 `.tmp/work7/rasterization/checkpoint.json`·`resume-progress.md`다. `rasterization/adopt.mjs`·`refresh-reviewed.mjs`는 실행 완료한 일회성 스크립트다. 기존 변경·증거·cache/packages를 보존했고 commit/push·정리는 하지 않았다.

### 9.13 W7-02 — 실제 native frame Picture 자원·GPU lease·context 복원 연결

**상태: scoped 구현/실행 PASS, W7-02와 전체 W7은 ACTIVE/PARTIAL.** 이전 9.12의 rasterization cache에 이어 immutable Picture 잎을 실제 화면 frame 자원으로 연결했다. 전체 native layer tree와 raster cache의 완료를 뜻하지 않는다. 증거 키는 `w7-native-frame-pictures-20261012`, 현재 인계는 `.tmp/work7/retained/checkpoint.json`·`resume-progress.md`다.

`hosting/pictures`의 앱별 FramePictureService를 SDK startup/View에 제공하고 FrameworkRoot가 사용한다. 직접 Canvas/SceneBuilder에는 `context.pictures`를 명시하며 기본값은 기존 CPU 명령 캡처다. 실제 native SkPicture를 frame의 `drawPicture` 자원 참조로 재생한다. 부모 transform·clip·leader/follower·hit/annotation/semantics는 공유 layer 트리에서 계산한다. 배경 clear는 직접 frame 명령으로 유지해 불필요한 native 기록을 만들지 않는다. 실제 Root의 반복 frame과 부모 이동은 같은 native 잎을 재사용하고 추가 컴파일이 없다.

cache64개·live128개·native Picture/CPU 복구 기록 합계32MiB로 제한한다. Picture API dispose와 LRU 퇴출은 cache producer를 놓으며 command/frame/GPU lease가 native Picture와 입력 image/font·CPU capture를 유지한다. native 해제가 실패하면 입력 기록/lease를 보존하고 새 기록을 막는다. 앱 종료는 cache producer를 놓고 renderer drain 후 원본 자원을 해제한다. context loss 이후 CPU 기록에서 native 객체를 재컴파일하며 RN은 context generation과 복원 memory budget을 검사한다. 다른 앱 또는 CPU SceneBuilder로 옮긴 layer는 owner에 맞게 EngineLayer snapshot을 다시 만든다. dynamic codec/image/raster/Picture ID는 앱 registry에서 frame만 유지 중인 자원까지 보고 충돌을 피한다.

**wire8/opcode35, native ABI1.** core/Web/RN/C ABI·provider/schema/native manifest가 일치한다. native preflight가 Picture ID/generation/reserved fields를 검사하고 replay는 native 참조를 잡는다. 이전 wire1..7 입력을 유지하며 이번에는 각 legacy wire의 clear GPU replay를 확인했다. 전체 이전 opcode 재수락을 뜻하지 않는다. RN은 실제 native wire8을 확인한 뒤 renderer를 configure한다. native cull은 멀리 떨어진 음수 좌표를 누락하지 않는다.

| 현재 증거 (`.tmp/work7/retained/`) | 결과와 범위 |
| --- | --- |
| `contracts-result.json`, `backend-contracts-result.json` | PASS — core 수명·두 frame/GPU lease·LRU·foreign owner/CPU capture·API dispose·closed Canvas·ID 충돌·실패 보존9개, 실제 RN translator 제어된 binding fault/context 재컴파일/복원 memory/native wire guard10개. native backend mock은 설치형 RN 실행 증거가 아님 |
| `web-result.json` | PASS — 실제 SDK bootstrap/View/FrameworkRoot native Picture frame·반복·부모 이동·context 복원·종료. 첫 native 잎 compile1회, 반복/이동은 추가 compile0. 복원과 별도 음수 좌표 사례를 포함해 총3회. 종료 시 native Picture/CPU recipe/cache/image bytes0. software WebGL2 범위 |
| `native-result.json`, `*-native.*` | PASS — 실제 Windows offscreen Graphite/Vulkan과 Web의 initial/repeat/moved/restored/displaced5개 premultiplied RGBA delta0. 원본 image producer map 제거와 자식 Picture ID 제거 후에도 native 기록 재생. stale wire/generation/ID/flags/color/padding/reserved/wrong-thread8개 거부·checked close. -9000에 기록한 뒤+9000 이동한 내용 확인 |
| compiler/type/import·Metro/Hermes·`regression/` | PASS — core/SDK/root types·strict emitted 소비자와 negative3개·direct 첫 import5개. Metro와 실제 Windows Hermes source/optimized HBC99에서 native frame Picture owner/wire8/두 frame lease 결과 일치. 기존 compositing20/annotation10 계약은 현재 별도 출력 경로에서 확인 |
| `windows-rn-wire/supplier/inputs.json` | PASS-scoped — 현재 RN/JSI wire8 source compile·supplier 구성, source147·library18·file1795. **Windows/Android/Web 설치 cohort와 실제 RN native image/codec/Picture host 실행은 다음 통합 작업**. 앞선 wire7 공급본은 현재 입력이 아님 |
| `adoption-result.json`, `audit-result.json`, `final-verification.json` | 선정8 모두 기존 partial 유지·destination/exportSource286 갱신·291 bindings/module9/type-only11 확인. 과거50 envelope와 직전 artifact45 보존. product188 해시. 합계74,297: missing67,182 / partial1,940 / adapted5,157 / implemented7 / notApplicable11, evidence51 |

모든 검증은1,200초 timeout을 사용했다. fixture의 resourceKey 표기·frame-count 가정·native BGRA readback을 보정했고 raw 실패/log를 보존했다. pinned Git blob3개를 대조했다. 이전 fractional1.5 nearest 경계116 pixels/max255 및 타원 AA 차이는 **PARTIAL 그대로**이며 이번 정수 배치의 delta0으로 덮지 않는다. 실제 Web/native 화면을 확인했다. 모든 소유 browser/server/Metro/Hermes/C ABI/native supplier 작업은 종료했고 기존 emulator는 조작하지 않았다. Apple/Linux target-native build/run/harness는 `SKIPPED (사용자 지정)`, provider는 `notVerified`다.

**다음 통합:** wire8 core/SDK/renderer·현재 native supplier로 Windows/Android/Web 설치형 image/layer/Picture 후보를 묶어 공급·실행한다. 버전/CLI/template/runner/archive identity를 함께 갱신하고 설치형 증거를 얻기 전 기존 공급/실행 결과를 현재 수락으로 쓰지 않는다. 전체 native layer tree/raster cache·backdrop/shader-mask/texture/platform-view·deferred sync/TargetPixelFormat/wide gamut·full pipeline/lifecycle/OS services 및 W7-03..14는 계속 남는다. 물리 input/IME/reader/scanout/FPS·driver-loss·서명/clean-machine 수락도 미완료다.

`retained/adopt.mjs`는 성공한 일회성 스크립트이므로 재실행하지 않는다. `retained/finalize.mjs`는 현재 제품 identity를 assert하고 이 phase의 증거만 확인한다. 기존 dirty 작업·cache/packages/raw 증거는 보존했으며 commit/push·정리는 하지 않았다.

### 9.14 W7-02 통합 진행 — 설치형 Windows·Android·Web의 Picture 캡처와 이미지 수명

**실제 결과:** sample의 Drawing lab에서 Picture를 그려 이미지로 캡처하고, 원본 Picture를 교체·해제한 뒤에도 캡처 이미지를 표시한다. PNG·3-frame GIF 표시, 화면 복귀·재진입·재캡처까지 실제 설치 Windows RNW/Hermes/Graphite, Android RN/Hermes/Dawn, Web CanvasKit에서 확인했다. 전체 native layer tree·raster cache와 I1/W7 전체 완료를 뜻하지 않는다. 증거 키는 `w7-wire8-installed-image-picture-cohort-20261012`, 최신 인계는 `.tmp/work7/integration/checkpoint.json`·`resume-progress.md`다.

core **0.10.0**, SDK **0.12.0**, Skia RN/Web·Metro·CLI **0.2.0**으로 dependency/provider/schema/CLI/template/lock을 함께 이행했다. wire8/native ABI1을 유지한다. CLI main의 오래된 기본 core/SDK version도 실제 생성 경로에 맞게 고쳤다. 기존 Windows·Android·Web runner를 재사용했고 content-addressed app-owned 공급 archive와 설치 파일 **7,779개**를 대조했다. Apple/Linux는 source/template 구성을 갱신했으며 전용 native 검증은 수행하지 않았다.

실제 설치 Web의 풍부한 home 화면에서 종전 live128 Picture 상한이 실패했다. Scene의 GPU admission 전 snapshot도 잎을 소유하므로 frame 명령 상한4,096에 맞춰 구성 중1 frame·admitted2 frame·LRU64개를 합친 **live12,352개**, LRU64개·native/CPU 복구 기록 합계32MiB로 보정했다. C ABI native Picture table도 같은 상한으로 맞췄다. 무제한으로 바꾸지 않았으며 GPU lease가 유지하는 자원은 cache 퇴출로 해제하지 않는다. RN native source147개는 변경되지 않아 직전 wire8 supplier를 재사용했다. C ABI만 변경 후 다시 빌드했다.

| 현재 증거 (`.tmp/work7/integration/`) | 결과와 범위 |
| --- | --- |
| `packed-result.json`, `supply-result.json`, `installed-result.json`, `identity-result.json` | PASS — 6개 archive, Windows/Android 각각3,019·Web1,741 설치 파일, public runtime/version/provider identity·이전 SDK/core range/wire7 거부. sample 보정 뒤 CLI만, 실제 상한 실패 뒤 core만 다시 공급했으며 다른 archive bytes는 유지. rejected archive/초기 실행 증거도 보존 |
| `picture-contracts-result.json`, `native-capacity-result.json` | PASS — core 수명 계약10개와 단일350-leaf Scene; 실제 C ABI 동시 native SkPicture350개·한 번의2×2 GPU clear/readback·checked close. 350회 반복 또는350-Picture frame 성능 수락이 아님 |
| `web-ui-result.json` | PASS — 설치 `web-budget`의 실제 pointer 캡처/교체/해제·GIF3색·route 재진입. DPR1의 live/captured128×96 RGBA delta0, browser error0. software WebGL2 범위이며 browser 종료 자체를 최종 app-owner drain 증거로 삼지 않음 |
| `windows-ui-result.json` | PASS — 설치 `windows-budget`의 실제 RNW/Hermes/native Graphite, DPI2 자동 pointer·캡처/원본 교체·GIF3색·재진입, cooperative owned-window close와 process exit. host의 closed/drained/noConsumers/noViews gate 뒤 device.close 경로를 함께 확인. 선정 색상 probe이며 전체 raster parity·SystemNavigator.pop·물리 입력 수락은 아님 |
| `android-ui-result.json`, `cleanup-result.json` | PASS-scoped — 설치 `android-native-access`, API33/x86_64 emulator·density2.75 adb pointer·동일 이미지/GIF/route 흐름. home hardware Back 뒤 Activity가 foreground를 떠남. **JS runtime/GPU graceful drain은 notVerified**. 증거 수집 후 소유 앱만 force-stop했고 기존 emulator5554는 계속 실행 중 |
| build/types·`check-*-installed.log` | PASS — build:sdk, 상한 보정 core build, root check:types, 3개 설치 runner strict types, 현재 Windows/Android/Web 후보 build. Windows native input `22880652…`의147 source/18 library/1,795 file을 대조. Windows HBC99와 Android HBC96을 각각 해당 공급 cohort로 검증 |
| `adoption-result.json`, `audit-result.json`, `final-verification.json` | 선정12 모두 기존 partial 유지, 현재12 bindings/public module10 확인. product217·현재 artifact53·과거 artifact142 해시, 과거51 envelope 보존, evidence52. 합계74,297: missing67,182 / partial1,940 / adapted5,157 / implemented7 / notApplicable11. manifest 선택 변경0·diff check PASS |

테스트 timeout은1,200초이며 같은 시나리오 반복은30회 이내다. Android Studio JBR25는 command-local `JAVA_TOOL_OPTIONS=--enable-native-access=ALL-UNNAMED`가 필요했고 초기 AGP 경고 실패를 보존했다. sample의 타입/scroll 생성 오류, identity fixture의 비공개 package.json import, Windows hidden/auxiliary HWND·좌표·중복 title 선택, 최종 검증 fixture의 비공개 CLI 경로 오류를 보정했다. 실패한 보조 HWND 화면은 앱 GPU 증거에 포함하지 않았다. 최종 Windows는 PID/title/control type으로 앱을 선택하고 정상 종료했다. 실제 Windows·Android 화면을 확인했다.

**남은 작업:** 실제 native layer tree/raster cache·backdrop/shader-mask/texture/platform-view와 넓은 painting/Canvas/Path/Color·pipeline/lifecycle/OS services, W7-03~14를 계속 구현한다. deferred sync/TargetPixelFormat/wide gamut, FileImage/Image.file native IO(기존 asset-root 경계 유지), HTML 전략·binding/accessibility/reassemble·전역 PaintingBinding/cache post-frame 등도 남는다. 직전 fractional1.5 nearest 경계116 pixels/max255·타원 AA **PARTIAL은 유지**한다. Android/browser 최종 app-owner retirement·물리 IME/reader/scanout/FPS·driver loss·ARM64/device·외부 소비/서명/clean-machine 수락은 별도다. Apple/Linux 전용 native build/run/harness는 사용자 지정 `SKIPPED`, provider `notVerified`다.

`integration/adopt.mjs`·prepare/refresh 공급 스크립트는 성공한 일회성이므로 재실행하지 않는다. `integration/finalize.mjs`는 이 phase의 현재 identity 확인용이며 후속 제품 변경 뒤에는 과거 증거다. 이전 retained finalizer도 새 제품에 재적용하지 않는다. 모든 소유 build/UI/browser/server 작업은 종료했고 원래 실행 중인 emulator는 유지했다. 기존 dirty 작업·cache/packages/raw 실패를 보존했으며 commit/push·정리는 하지 않았다. **전체 목표 ACTIVE/PARTIAL**을 유지한다.

### 9.15 W7-03 진행 — 실제 본문 선택·복사·배율과 앱 소유권

**실제 결과:** 읽기 전용 본문을 mouse로 드래그해 선택 영역을 그리고, Ctrl/Meta+A/C와 앱별 clipboard로 복사한다. 배율 변경은 선택을 유지하고 본문 교체는 선택을 초기화한다. shared sample의 **Text lab**에 전체 선택·복사·크기 변경·본문 교체·Back을 연결했다. 실제 **workspace Web**에서 이 흐름을 확인했으며 새 source/sample/template를 설치형 native cohort에 공급한 수락은 아직 아니다. 전체 W7-03 typography와 W7-02 native compositor/raster cache·W7-01..14는 계속 **ACTIVE/PARTIAL**이다. 최신 증거는 `.tmp/work7/text/checkpoint.json`·`resume-progress.md`, key는 `w7-body-selection-scaling-copy-20261012`다.

`framework/painting/text-scaler`의 TextScaler는 linear/사용자 정의 font-size별 scale과 source clamp 합성을 제공한다. Text·SelectableText의 명시적인 textScaler는 inherited 배율보다 우선하고 textScale과 동시 지정은 거부한다. 기존 유효 font-size1..512 budget은 유지한다. `text-selection-controller`는 불변 UTF-16 anchor/focus·본문 교체·전체 선택·snapshot 복사와 한 mounted 본문 소유권을 제공한다. widget이 controller를 소유하거나 앱 controller를 빌리며 unmount 후 해제한다.

`framework/widgets/selectable-text`와 `rendering/selectable-paragraph`는 실제 paragraph의 range/hit/grapheme bounds·direction을 사용한다. controller와 paragraph producer를 교체·해제해도 이미 제출된 frame lease는 유지한다. mouse/pen·가로 touch drag는 기존 gesture arena에 참여하고 세로 touch 이동은 scroll에 양보한다. 제거/본문 교체는 진행 중인 drag를 취소하며 붙어 있는 RenderObject의 잘못된 dispose는 controller 소유권을 놓지 않는다. 전체 long-press·handle/toolbar·caret/word/line 이동·SelectionArea·RichText/WidgetSpan·native accessibility는 아직 남는다. TextPainter의 기존 service/registry 및 layout(input) API를 유지하며 metrics·hit·선택 boxes를 추가했다. 반환 타입과 backend layout width는 전체 원본 TextPainter/TextBox/LineMetrics 계약과 구별한다.

키의 handled 결과를 FrameworkRoot→ViewRuntime→browser input으로 전달해 처리한 Ctrl+A/C의 browser 기본 동작 충돌을 막았다. FocusManager의 `skipRemainingHandlers`는 이후 framework handler만 중단하고 플랫폼 기본 동작은 허용한다. 기존 handleKeyEvent의 stop flag는 유지하고 별도 dispatch 결과로 이 차이를 보존했다. pin focus_manager.dart의 설명과 Node·Metro/Hermes 계약을 확인했다. Tab의 선언된 focus action도 실제 focus로 연결했다. 전체 hardware keyboard/focus traversal 완료로 확대하지 않는다.

| 현재 증거 (`.tmp/work7/text/`) | 결과와 범위 |
| --- | --- |
| `contracts-result.json` | PASS — 서로 다른 계약11개: nonlinear/linear/clamp, UTF-16/불변 controller·copy/error·단일 host, 실제 render/arena 선택·scroll 경쟁/취소, 측정/paragraph frame lease, 본문/semantics 교체, attached dispose 거부, handled/skip/ignored native-default 구분. 제어된 text backend이며 native shaping/GPU 증거는 아님 |
| `web-result.json`, `selected-web.png`, `sample-text-lab-web.png` | PASS-scoped — Chromium147·실제 CanvasKit/software WebGL2·NotoSansKR·DOM canvas mouse 선택, highlight1,834 interior pixels, app messenger→실제 navigator.clipboard write/read·Ctrl+C/A, font-size24→36, 본문/controller/owned-controller 교체·제거/재진입. 실제 shared sample TextLab의 SelectAll/Copy/size22→33/ChangeDocument/Back도 확인. 명시적인 SDK app.dispose 뒤 framePictures/pictureBytes/dynamicImageBytes0 |
| `web-result.json`의 glyph/clipboard 원본 값 | **PARTIAL 유지** — 단일 NotoSansKR provider의 emoji·히브리어 unresolved glyph6개는 실제 화면에서 누락된다. 문자열 선택·복사 PASS가 fallback·emoji/RTL glyph 표시 수락은 아님. Windows browser clipboard의 LF→CRLF 반환을 raw로 남겼고 제품에서 줄바꿈을 강제 변환하지 않음 |
| build/types·`consumer.mts`·`metro-result.json`·`hermes-result.json` | PASS — core/SDK build·root types·strict NodeNext emitted 선언과 negative2개, 현재 직접 공개 경로의 Metro·실제 Windows Hermes source/optimized HBC99. 마지막 key policy 변경 후 core/영향 계약/Web·Metro/Hermes를 재확인. native bridge·설치형 Windows/Android 선택 실행은 별도 |
| `adoption-result.json`, `review-key-policy-result.json`, `audit-result.json`, `final-verification.json` | 선정18 모두 partial(새 missing17개만 partial), 최초 destination451 갱신·key policy follow-up65 갱신. 현재534 bindings/public module8/type-only24 확인. product228·현재 artifact31·직전 artifact53 해시와 과거52 envelope 보존. evidence53, 합계74,297: missing67,165 / partial1,957 / adapted5,157 / implemented7 / notApplicable11. 새 manifest class 선택2개·diff check PASS |

source pin의 class/member 의미를 검토하고 이 phase가 인용하는 exact Git blob4개를 보존했다. 테스트는1,200초 timeout, 같은 시나리오 반복은30회 이내다. fixture의 UTF-8 HTTP charset·명시적인 app platform message port 누락·async clipboard polling·Windows CRLF 기대, sample Scaffold 괄호 오류를 보정했고 raw 실패를 보존했다. 실제 선택 및 sample 화면을 확인했다. 모든 소유 build/Metro/Hermes/browser/server 작업은 종료했으며 이번에는 native app/emulator를 조작하지 않았다.

**다음:** W7-02 실제 native compositor/raster cache/effects와 W7-03 TextStyle/InlineSpan/RichText/WidgetSpan·font fallback/features/variations·Strut/HeightBehavior·전체 선택/접근성을 관련 사용자 흐름으로 계속 연결한다. 현행9.14 설치 archive는 정확한 **당시** Picture/image/codec 증거로 남으며 이번 core/SDK/sample/template source를 포함하지 않는다. 따라서 다음 설치 통합 때 변경 package만 source identity에 맞게 묶어 공급한다. 새 Text lab을 오래된 설치 archive로 실행해 현재 PASS로 처리하지 않는다. wire8/native ABI1·RN147-source supplier는 변경되지 않아 불필요한 native 재빌드/전체 공급은 하지 않았다.

이전 fractional1.5 nearest116 pixels/max255·타원 AA PARTIAL, Android graceful app-owner drain 및 물리 IME/reader/scanout/FPS·driver loss·외부/배포/clean-machine 경계는 유지한다. Apple/Linux는 실제 코드 구성이 필요하며 전용 native build/run/harness는 사용자 지정 SKIPPED/provider notVerified다. `text/adopt.mjs`와 `review-key-policy.mjs`는 성공한 일회성이므로 재실행하지 않는다. 이전 phase finalizer는 후속 source에 적용하지 않는다. 기존 dirty 작업·raw/cache/packages를 보존했고 commit/push·정리는 하지 않았다.

### 9.16 W7-03 진행 — RichText·실제 inline 위젯·다중 폰트와 가변 굵기

TextStyle/StrutStyle·FontWeight/Feature/Variation/Decoration/HeightBehavior, InlineSpan/TextSpan/PlaceholderSpan/WidgetSpan, RichText/DefaultTextStyle/Text.rich를 실제 paragraph에 연결했다. RenderRichParagraph는 하나의 SkParagraph와 inline RenderBox의 측정·baseline·그리기·hit·semantics 좌표를 공유하며 ellipsis 뒤 child는 제외한다. Text.rich는 inherited style/MediaQuery를 소비하는 Widget factory adapter이고, 직접 RichText는 명시적인 style/기본14px·scale1을 쓴다. 기존 scalar RenderParagraph와의 완전한 통합·rich selection/registrar/recognizer/overlay·전체 source API는 남으므로 선정 항목은 모두 partial이다.

Web/RN은 앱에 선언한 폰트들을 live paragraph 사이에서 공유하고 frame/GPU lease가 끝날 때까지 입력을 유지한다. backing-source128MiB budget은 전체 native font/atlas memory 측정이 아니다. 해제 실패는 입력을 보존하고 재입장을 거부한다. RN은 native text-style binding1을 폰트 등록 전에 요구한다. variation clone 등 출처가 확인되지 않은 native glyph는 진단값 unknown으로 보고한다. FontWeight가 암묵적인 wght 축을 제공하고 명시적 variation이 우선한다. wire8/opaque ABI1은 유지한다.

sample/Text lab과 CLI template에 실제 inline action 및 Noto emoji·Arabic·Hebrew·Roboto Slab variable 폰트를 추가하고 원본 byte·전체 copyright/license를 보존했다. Slab은 Apache2.0, 선정 Noto는 OFL1.1이다. 네이티브 bootstrap asset map도 생성했다. 설치 artifact의 font notice 포함은 다음 공급 때 확인하며, 오래된9.14 설치본을 현재 source의 수락으로 사용하지 않는다.

| 증거 (`.tmp/work7/typography/`) | 결과와 범위 |
| --- | --- |
| `contracts-result.json`, `regression-text-result.json` | PASS — 서로 다른 rich style/span/inline geometry/provider lease·실패 보존/native guard 계약11개 및 기존 plain selection 계약11개. 제어된 backend는 native GPU 증거가 아님 |
| `web-result.json`, `initial-web.png`, `sample-rich-web.png` | PASS-scoped — 실제 Chromium/CanvasKit/software WebGL2·선언 폰트5개에서 unresolved glyph0, Hebrew bidi boxes·5 UTF16-unit emoji cluster. 명시적 wght100→900은4,611 pixels·blue ink595→1,986, 암묵적 FontWeight는7,749 pixels 변경. inline72×28→108×42·pointer·RTL/resize·ellipsis paint/hit/semantics 제외·shared sample 진입/Back 확인. 명시적 SDK app.dispose 뒤 paragraph/provider/sourceBytes/framePicture0 |
| build/types/consumer/import·Metro/Hermes logs | PASS — core/SDK/root types, strict emitted consumer negative3·새 direct module8개 독립 첫 import, Metro와 실제 Windows Hermes source/optimized HBC99 결과 일치 |
| `windows-rn-fonts/supplier/inputs.json` | PASS-scoped — 현재 font arguments/parser·textStyleVersion1의 Windows 네이티브 빌드, source147/library18/file1,795 대조. **현재 typography의 설치형 Windows/Android native text 실행은 아직 미검증** |
| `adoption-result.json`, `audit-result.json`, `final-verification.json` | 선정105 모두 partial·변경 destination461 갱신·현재567 bindings/module16/type-only28 확인. product273·현재 artifact31·직전 artifact31·과거53 envelope 보존, evidence54. 합계74,297: missing67,061 / partial2,061 / adapted5,157 / implemented7 / notApplicable11. 기존 manifest schema/primary destination을 보존하고 class adoptionIds를 확인했으며 diff check PASS |

exact pin 원본11개를 보존했다. raw CanvasKit 등록 폰트 weight만으로 굵기가 바뀌지 않던 경계 probe를 보존하고 pin의 암묵적 wght 계약을 두 backend에 적용해 실제 Web와 portable 경로를 재확인했다. 첫 font notice 추출의 Slab 라이선스 가정 오류·fixture/private import·intrinsic 이름 충돌 등 raw 실패도 남겼다. timeout1,200초·같은 시나리오 반복 대부분30회 이내를 유지했다. owned build/browser/server/Metro/Hermes 작업은 종료했고 native GUI는 실행하지 않았으며 기존 emulator는 그대로 유지했다.

**다음:** 변경 core/SDK/Skia/CLI/template/range와 matching native supplier를 묶은 Windows/Android/Web 설치 typography 수락을 수행하고 font notice 포함을 확인한다. 이어 native layer compositor/raster cache/effects·rich selection/전체 typography·W7-01 잔여와 W7-04~14를 진행한다. 기존 fractional nearest/ovalAA PARTIAL·Android graceful owner drain·물리 IME/reader/scanout/FPS·복구/외부/배포 경계는 유지한다. Apple/Linux 코드 구성은 필요하지만 전용 native build/run/harness는 사용자 지정 SKIPPED/provider notVerified다. 전체 목표는 **ACTIVE/PARTIAL**이다.

최신 인계는 `typography/checkpoint.json`·`resume-progress.md`다. 성공한 prepare/adopt/review-metadata는 재실행하지 않는다. finalizer는 이 phase의 정확한 bytes 확인용이며 다음 source 변경 후에는 과거 증거다. commit/push·정리는 하지 않았다.

### 9.17 W7-01/03 진행 — 설치형 풍부한 본문·폰트 notice·Windows clipboard 오류 복구

**현재 공급:** core0.11.0 / SDK0.13.0 / Skia-RN·Web·Metro·CLI0.3.0, coreRange `>=0.11.0 <0.12.0`, wire8/opaque ABI1/native text-style1로 관련 package/provider/schema/template/range/lock을 함께 이행했다. SHA-qualified archive6개를 기존 Windows·Android·Web runner에 설치했다. 최신 증거는 `.tmp/work7/typography-installed/checkpoint.json`·`resume-progress.md`이며 key는 `w7-installed-rich-typography-notices-clipboard-20261012`다. I1과 전체 W7은 계속 **ACTIVE/PARTIAL**이다.

shared Text lab의 다국어·가변 폰트 rich body/실제 inline 버튼, **plain 본문** 전체 선택·복사·1.5배율·문서 교체/선택 초기화·Back/재진입을 세 설치본에서 확인했다. rich body 자체의 범위 선택·registrar/overlay·caret/word/line/toolbar·전체 native typography 수락은 남는다. Windows/browser는 실제 OS clipboard payload도 읽어 비교했고 browser CRLF 원본을 보존했다. Android는 native clipboard method 완료만 확인했으며 OS payload의 독립 readback은 아니다.

AppAsset의 선택적 `notice: {path,sha256}`를 깊이 snapshot하고 Metro에서 별도 app-relative regular file·해시·notice1MiB/공통 입력64MiB 상한을 확인한다. 출력 ancestor/broken symlink도 복사 전에 거부한다. Windows Assets/licenses와 Android APK assets/배포 licenses에 선언한 전체 notice를 포함하며 Web는 실제 assets를 배포한다. Apple/Linux 코드·template도 공통 notice 검증/복사를 소비한다. 이것은 선정 폰트 notice 전달이며 전체 third-party license inventory 완료는 아니다.

초기 Windows 후보에서 선택 강조 뒤 Copy 주변의 실제 fatal exit2건을 발견했다. 설치한 pin RNW Clipboard 구현의 WinRT UI callback에는 예외가 밖으로 나갈 수 있는 경로가 있었다. SDK는 완료·오류를 Promise로 전달하는 자체 Windows clipboard port를 요구하고 UI/async HRESULT·표준/기타 예외를 잡는다. 이전 native host는 명시적으로 거부한다. **디버거 없이** 다른 프로세스가 clipboard를 점유하면 오류를 반환하고 앱을 유지하며, 해제 뒤 재시도하면 정확한 문자열 복사가 성공했다. 이 재현 경로의 수락이며 모든 Windows COM/OS 오류 해결로 확대하지 않는다. RN 구조화 rejection의 상세 message 정규화는 잔여다.

| 증거 (`.tmp/work7/typography-installed/`) | 결과와 범위 |
| --- | --- |
| `installed-result.json`, `identity-result.json`, `native-overload-result.json`, `metro-output-guard-result.json` | PASS — 처음 전체 설치 ordinary file8,124개, 후속 변경 SDK1,203개·Metro72개만 재대조. 마지막 SDK archive 차이는 Windows native Promise overload header1개뿐이며 Android/Web 사용 입력은 exact equal. Metro는 notice 출력 guard만 달라 runtime/bundle/configuration 파일은 동일. 무효화되지 않은 Android/Web 빌드/UI를 반복하지 않음 |
| `web-ui-result.json`, `web-selected.png`, `web-scaled-rich.png` | PASS-scoped — 현재 static Metro/CanvasKit/software WebGL2·canvas pointer·inline132.984375→199.484375px·실제 clipboard·배율/문서 교체/재진입. browser/server 종료는 명시적 SDK app-owner drain과 구별 |
| `windows-without-debug-result.json`, `windows-close-result.json`, `windows-native-debug-fixed.log` | PASS-scoped — RNW/Hermes HBC99/native Graphite·DPI2, inline266→399 physical px, 선택 blue sample210→24,420, 실제 clipboard payload·점유 오류/복구·재진입. 별도 native log에서 closed views0/consumers0/gpuDrained1·INSTANCE_DESTROYED·process exit0 확인. glyph 화면은 확인했으나 전체 native text raster parity/Typeface 출처는 아님 |
| `android-ui-result.json`, `android-selected.png`, `android-scaled-rich.png` | PASS-scoped — API33/x86_64·density2.75·RN/Hermes HBC96/Dawn Graphite, inline366→549px·touch pointer·선택·clipboard method 완료·배율/교체/재진입. hardware Back 뒤 foreground 이탈 확인 후 소유 앱만 force-stop. **graceful runtime/GPU owner drain은 notVerified** |
| `notice-contracts-result.json`, `clipboard-contracts-result.json`, `artifact-notices-result.json` | PASS — notice 입력/불변성·복사와 negative4개, 제어된 clipboard 완료/오류/대기 close/old-host5 계약. 폰트5개의 exact bytes 및 전체 notice가 Windows/Web·Android APK/배포에 포함됨을 확인. mock 계약과 native OS 실행 증거는 분리 |
| build/types·`adoption-result.json`, `audit-result.json`, `final-verification.json` | PASS — 관련 build·현재 SDK 영향 검사·root types/설치 runner3 types·CLI/Metro 선언. 선정12 기존 partial 유지, destination refresh0, 현재13 bindings/module13. product285·현재 artifact54·직전 artifact31·과거54 envelope 보존, evidence55. 합계74,297: missing67,061 / partial2,061 / adapted5,157 / implemented7 / notApplicable11. manifest 변경0·diff check PASS |

Windows 최종 후보는 `windows-clipboard-native`, Android는 `android-clipboard`, Web는 `web-clipboard`다. `packages-final`의 정확한 archive identities와 후보별 source-input 동등성은 checkpoint에 기록했다. 기존147-source/18-library/1,795-file native font supplier는 재사용하고 실제 변경 SDK native host만 빌드했다. exact pin source를 보존했으며 최종 hash는 `final-verification.json`이 기준이다. 테스트 timeout1,200초·같은 시나리오 반복 대부분30회 이내를 유지했다.

실제 초기 fatal events·native HRESULT overload 컴파일 오류·bootstrap 인수·혼합 설치 타입·fixture getter·startup activation/layout 좌표 실패는 raw로 남겼다. native 화면을 확인했다. 모든 소유 build/UI/browser/server/debug 작업은 종료했고 Android 앱 PID는 없으며 원래 emulator는 유지했다. commit/push·파일 정리·외부 메시지·memory 쓰기는 하지 않았다. 성공한 prepare/adopt/공급 refresh 스크립트는 재실행하지 않는다.

**다음:** W7-03 rich 본문 선택·탐색/toolbar/semantics·전체 typography와 legacy RenderParagraph 통합, W7-02 실제 native compositor/raster cache/effects·W7-01 잔여 및 W7-04~14를 계속 구현한다. Android/static-browser 최종 app-owner drain, 이전 fractional nearest/ovalAA PARTIAL·물리 IME/reader/scanout/FPS·driver loss·외부/배포 경계는 유지한다. Apple/Linux 실제 코드 구성은 필요하며 전용 native compile/build/run/harness는 사용자 지정 SKIPPED/provider notVerified다.

### 9.18 W7-03 — rich TextSpan 선택·엔진 경계·키 탐색과 설치 통합 (2026-10-12 KST)

목표는 styled 본문의 논리 선택·복사를 실제 글자/단어/줄 경계와 키 이동에 연결하는 것이었다. **전체 W7-01~14는 ACTIVE/PARTIAL**이며 이 세로 흐름의 선정 수락이다. 증거는 `.tmp/work7/rich-selection`, 간단한 인계는 `resume-progress.md`, 현재 hash/후보는 `checkpoint.json`·`final-verification.json`이다. evidence는 `w7-rich-span-selection-utf16-navigation-20261012`다.

`SelectableText.rich(TextSpan, options)`가 스타일 run과 원래 논리 UTF-16 본문을 유지한다. pinned source의 계약대로 하위는 TextSpan이어야 하며 WidgetSpan 선택은 SelectionArea/Region 작업으로 남긴다. TextPainter의 `getOffsetAfter/Before`는 source의 scalar/surrogate 의미이고, 별도 grapheme helper는 실제 엔진 glyph range를 사용한다. word는 ICU/SkParagraph, line은 실제 metrics·newline 제외·upstream wrap affinity를 사용한다. Shift 확장·Ctrl-word·Home/End·문서·sticky-x 위아래 키를 mounted paragraph/controller/Focus에 연결했다. 좌우는 논리 문단 방향이며 완전한 visual mixed-bidi caret/affinity 정책은 아니다. 선택적 backend query가 없는 키 동작은 명시적으로 거절한다.

Web CanvasKit과 RN packet에 실제 glyph/word query를 연결하고 native UTF16 API·`nelyxTextBoundaryVersion1`을 추가했다. textStyle1도 유지하며 old binding은 provider 생성 전에 거절한다. Windows Skia exact pin의 Paragraph/ICU source를 qualification해 word/line index가 UTF16임을 확인했고, 실제 native emoji 선택으로 glyph 경로를 소비했다. FontWeight를 타입 값으로 검증·snapshot하고 sample/fixture의 잘못된 숫자 사용을 수정했다. source `.ts`/emitted `.js`·direct module 경계를 유지한다.

| 통합 증거 | 결과와 범위 |
| --- | --- |
| framework8·RN packet6·keyboard-host6 계약, typography11 회귀 | PASS — mounted rich 선택/교체/Focus·scalar/grapheme 구별·word/line/document·sticky-x·capability/old binding·typed weight. 제어된 계약과 실제 host 증거는 분리 |
| `web-result.json`, 화면·Metro·Hermes | PASS — workspace actual CanvasKit/softwareWebGL2 rich drag/copy·emoji5/e-combining2·키/word/line/vertical·scale/resize/RTL·교체/제거/재진입. explicit SDK dispose에서 paragraph/provider/source/frame-picture/image bytes0. Metro direct imports와 실제 Hermes source/optimized HBC99도 통과 |
| `installed-result.json`, `identity-result.json`, `keyboard-archive-result.json` | PASS — core0.12/SDK0.14/Skia·Metro·CLI0.4, native style1/boundary1, wire8/opaque ABI1. 정확한6 archive를 runner3에 설치하고 일반8,124 files 대조. 실제 Windows 실패 수정 후 SDK archive9 files만 교체, SDK1,203 files 재확인·나머지5 archive 동일. Metro는 이전0.3 대비 package.json만 변경 |
| `windows-ui-result.json`, `web-ui-result.json` | PASS-scoped — 설치본 rich TextSpan에서 한국어 word “본문을”·emoji “👩‍💻”를 실제 키로 선택·정확한 OS clipboard 값 확인. rich SelectAll/Copy·inline·배율/교체/재진입. Windows inline266→399px/DPI2, Web132.984375→199.484375. native text raster parity/완전한 bidi/reader/물리 입력은 아님 |
| Windows 실제 입력 실패와 수정 | custom RNW ComponentView의 기본 focusable=false/표준 key emitter 부재 때문에 첫 키 선택이 실패했다. 표준 RN View가 keyboard/focus를 소유하고 canvas down에서 native focus를 요청하도록 수정했다. native editor 자식의 key 중복 전달은 제외한다. 최종 debugger 없는 harness exit0 |
| `windows-close-result.json`·raw debug log | 현재 app views0/consumers0/GPU drained1·INSTANCE_DESTROYED·process0 확인. **debug capture PowerShell harness 자체는 PASS 출력 후0xe0434355로 종료해 instrumentation PARTIAL**로 보존. debugger 없는 UI 수락과 별도이며 전체 debug harness PASS로 승격하지 않음 |
| `android-ui-result.json`, 폰트 artifact 검사 | PASS-scoped — API33/x86_64/HBC96·새 binding compile/factory1 admission, rich SelectAll·clipboard method 완료·inline366→549px/density2.75·배율/교체/재진입·hardware Back foreground 이탈. Android key port 부재로 native word/glyph 키 소비는 미수락, OS clipboard 독립 readback·graceful owner/GPU drain은 notVerified. 폰트5개/full notice bytes는 Windows/Web/Android APK·배포에서 일치 |
| build/types·coverage/destination 감사 | PASS — core/SDK·root types·설치 runner3 types·strict emitted negative3·최종 SDK 변경 build. 선정8 partial·새6 missing→partial, destination refresh51·bindings57/modules4. product287·현재 artifact89·직전 artifact54·과거55 envelope 보존, 총56. 합계74,297: missing67,055 / partial2,067 / adapted5,157 / implemented7 / notApplicable11. manifest 변경0·diff check PASS |

최종 archive는 `packages-keyboard`, 후보는 `windows-keyboard`·`android-keyboard`·`web-keyboard`다. Windows native supplier는 `windows-rn-boundary-capability/supplier/inputs.json`의147-source/18-library/1,795-file 입력이며 이전 boundary supplier는 superseded다. SDK-only focus 수정에 Skia supplier를 재빌드하지 않았고 세 대상 패키지를 해당 SDK로 다시 만들었다. 이전 archive/증거와 raw fixture·metadata/lock·키 전달·startup/maximize·browser scale race 실패를 보존했다. 성공한 prepare/adopt/공급 refresh/finalizer는 재실행하지 않는다.

현재 소유 build/UI/browser/server 작업은 종료했다. Windows host는 닫혔고 Android 앱만 force-stop/PID 부재 확인, 원래 emulator는 유지했다. timeout1,200초·같은 시나리오 반복 대부분30회 이내를 지켰다. commit/push·파일 삭제·외부 메시지·memory 쓰기는 하지 않았다.

**다음:** SelectionArea/Region·WidgetSpan 선택·caret/visual bidi/affinity·toolbar/long press/recognizer·전체 typography/legacy paragraph 통합과 W7-04 Android/Apple/Linux 실제 key port를 계속 구현한다. W7-02 native compositor/raster cache/effects·W7-01 잔여와 W7-05~14도 남는다. 이전 fractional nearest/ovalAA PARTIAL과 physical IME/reader/scanout/FPS/device/ARM64/loss·외부/서명/clean-machine 경계, Apple/Linux 코드 구성 및 전용 native 검사 SKIPPED/provider notVerified를 유지한다.

### 9.19 W7-03/04 — Android key 처리 응답·canvas/native editor focus 연결 (2026-10-12 KST)

Android의 실제 입력 포트 누락을 구현해 canvas의 키 선택과 native editor 사이를 연결했다. **전체 W7-01~14는 ACTIVE/PARTIAL**이다. 증거는 `.tmp/work7/android-keyboard`, 현재 후보/hash는 `checkpoint.json`·`final-verification.json`, 인계는 `resume-progress.md`다. evidence는 `w7-android-canvas-keyboard-ack-editor-focus-20261012`다.

SDK의 `NelyxKeyboardHost`가 RN View의 layout/children을 유지하며 canvas native focus를 소유한다. sequence·logical key·modifier/repeat·raw Android keyCode/scanCode/device/source/time/cancel을 non-coalesced event로 전달하고, JS가 실제 `ViewRuntime.dispatchKey` 결과를 응답한다. 닫힌/교체된 owner와 잘못된 packet을 거절하고 consumer 오류에도 응답한다. native editor focus의 key/IME와 system key는 Android 경로를 유지한다. 기존 NelyxEditingPackage에 manager를 등록하고 common surface·touch focus·샘플/template의 선택 텍스트 표시를 함께 연결했다.

실제 일반 방향키가 touch mode를 끝낼 때 canvas host에서 첫 접근성 proxy로 focus가 이동하는 실패를 재현했다. [Android 13 ViewRootImpl 원본](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android-13.0.0_r1/core/java/android/view/ViewRootImpl.java)의 `leaveTouchMode` 분기와 trace를 대조해 `FOCUS_AFTER_DESCENDANTS`를 원인으로 확인하고 `FOCUS_BEFORE_DESCENDANTS`로 수정했다. 명시적인 native editor focus는 계속 허용한다. Core/glyph backend를 변경하거나 segmentation을 추측해 우회하지 않았다. 이 Android source pin은 emulator framework binary 전체의 byte 일치 증거는 아니다.

생산 Kotlin queue를 별도 클래스로 연결해 응답 순서가 바뀌어도 입장 순서대로 한 번 처리한다.64-entry·1초 policy에서 timeout/late reply·clear/close·focus/window 상실·detach를 처리하며, 포화 때 이미 받은 `handled=true`를 덮어쓰던 부분도 수정했다. 미처리 event의 root 재전달은 identity marker로 재진입을 막는다. **bounded timeout/overflow·canvas 전용 정책은 timeout이 없는 pinned Flutter embedding과 다르며**, 전체 hardware key state/shortcut 정책의 완료가 아니다.

| 통합 증거 | 결과와 범위 |
| --- | --- |
| `contracts-result.json`, `queue-contracts-result.json` | PASS — JS7: owner·처리/미처리·오류 응답·중복/불량 packet·touch focus·old/mismatched host. 실제 생산 Kotlin queue의 JVM5: 응답 역순·timeout/late reply·포화 중 true 보존·해제/close·재진입 clear. controlled clock/finish이며 Android OS timed overload를 강제한 증거는 아님 |
| `android-ui-result.json`·화면 | PASS-scoped — 현재 API33/x86_64·RN/Hermes HBC96/Dawn Graphite, legacy Tab 이동·반복 Enter의 Counter 단일 활성화, “본문을” word·e+combining2·emoji5 선택·배율1.5, OS clipboard를 읽어 native editor에 emoji 표시, native 입력 “👩‍💻Z” 한 번·CtrlA 교체 “Q”, editor→canvas 재진입·system Back foreground 이탈. **adb 주입이며 물리 keyboard/한국어 IME/reader 증거는 아님** |
| `windows-ui-result.json`, `web-ui-result.json`, target input delta | PASS-scoped — 현행 SDK15 common source의 Windows/Web word·emoji·복사·배율/교체/재진입. 이후 Android Kotlin-only와 CLI newline-only 수정은 두 대상이 사용한 JS/native header를 바꾸지 않아 재빌드/UI를 반복하지 않았다. Windows는 cooperative process close이며 새 checked GPU drain으로 확대하지 않음 |
| 설치·cohort·폰트 | PASS — Core0.12/SDK0.15/Skia0.4/Metro·CLI0.5, wire8/opaqueABI1/textStyle1/boundary1과 독립 keyboard host1. Core/Skia3 archive는 정확히 재사용·Skia supplier 재빌드0. 일반8,142 files 설치본 대조 후 SDK-only queue 변경1,224 files 재확인, 현재8,145. 폰트5개/full notice가 현재 Android APK/배포·Windows/Web에서 일치 |
| build/types·source/coverage 감사 | PASS — SDK·root types·설치 runner3 types·현재 Android Kotlin/배포. APK DEX에 host/manager/queue3 class 확인. 기존4 class partial 유지·destination refresh0·bindings4/modules3. product290·현재 frozen artifact69·직전89 artifact·과거56 envelope 보존, 총57. 합계74,297: missing67,055 / partial2,067 / adapted5,157 / implemented7 / notApplicable11. manifest 변경0·diff check PASS |

최종 archive는 `packages-queue`, 후보는 `android-final`·`windows-final`·`web-final`이다. Windows supplier는 직전 `rich-selection/windows-rn-boundary-capability/supplier/inputs.json`의147-source/18-library/1,795-file 입력을 유지한다. Core/Skia source·dist·archive가 그대로라 Core archive 내 coverage는 과거 scoped snapshot이며 이번 SDK/runtime envelope는 workspace 기록에만 추가했다. 작은 로그 갱신 때문에 Core를 다시 공급하지 않았다.

초기 Android public SDK의 recycle/dead-key flag 컴파일 차이, native focus trace15개 prefix 사례, npm의 CLI bin shebang 줄바꿈 정규화 byte 차이, offscreen Pasted label·3-Tab 순서 가정 fixture 실패를 보존했다. 실제 clipboard는 이미 native editor에 반영됐으며 최종 검사는 그 값을 직접 확인한다. 현재 legacy fallback은 scroll semantic action을 먼저 방문하므로 완전한 source FocusTraversal의 수락으로 확대하지 않는다. 과거 Windows debug capture PowerShell0xe0434355 instrumentation PARTIAL도 그대로 남는다.

소유 command/UI/browser/server 작업은 종료했다. Windows host는 닫혔고 Android 앱만 force-stop/PID 부재 확인, 원래 emulator5554는 유지했다. force-stop은 graceful app/GPU drain이 아니다. cleanup receipt에서 현재 Windows process close와 과거 checked GPU close를 섞은 문구만 검토 갱신했고 이전 receipt를 보존했다. 성공한 prepare/cohort/공급 refresh/finalizer/scope correction은 재실행하지 않는다. 테스트 timeout1,200초·대부분 같은 시나리오30회 이내를 유지했으며 commit/push·파일 삭제·외부 메시지·memory 쓰기는 하지 않았다.

**다음:** W7-04 HardwareKeyboard·logical/physical/pressed-state·Actions/Shortcuts·focus traversal/highlight와 native editor/global shortcut 정책·Apple/Linux 실제 key code를 계속 구현한다. W7-03 SelectionArea/Region/WidgetSpan 선택·caret/visual bidi/affinity·toolbar/recognizer·전체 typography, W7-02 compositor/cache/effects·W7-01 잔여 및 W7-05~14도 남는다. Android OS timed overload·native ack 역순/queue drain 독립 관찰·물리 입력/IME/reader·scanout/FPS/device/ARM64/loss/서명/외부/clean-machine·Android/static owner drain은 미수락이며, Apple/Linux 전용 native 검사 SKIPPED/provider notVerified와 이전 fractional nearest/ovalAA PARTIAL을 유지한다.


### 9.20 W7-04 — typed keyboard identity·Actions/Shortcuts·focus event 경계 (2026-10-12 KST)

**전체 W7-01~14는 ACTIVE/PARTIAL**이다. 증거는 `.tmp/work7/keyboard-actions`, 현재 hash/후보는 `checkpoint.json`·`final-verification.json`, 재개 기록은 `resume-progress.md`다. 새 evidence는 `w7-key-identities-actions-shortcuts-20261012`이며 **Windows native editor의 route 복귀 focus 실패가 남아 이 묶음도 PARTIAL**이다.

Flutter pin `71e4717a61786faab4c7aa39825989305ed29e8a`의 services/widgets·Android/Web engine·engine LICENSE12개를 qualification했다. Logical444·Physical269의713 상수와 Android scan232/key260·Web logical301/physical231/location table을 연결했다. KeyboardKey·immutable value-equality set, KeyDown/Up/RepeatEvent·HardwareKeyboard pressed/lock/handler 상태, ServicesBinding 소유·focus-loss 해제·다중 root 전환을 구현했다. 전체 class/type38개는 partial을 유지하고713 literal field만 adapted로 분류한다. 원본 diagnostics·Dart operator/hash·전체 locale/dead-key/startup/device 정책의 완료가 아니다.

canonical `widgets/actions`의 명시적 Intent constructor token·Action/ContextAction/CallbackAction·dispatcher·listener·가장 가까운 disabled mapping의 outer 차단, `widgets/shortcuts`의 LogicalKeySet/SingleActivator/CharacterActivator·manager/widget·trigger 우선순위·value-map equality·modal skip을 연결했다. legacy string adapter는 유지한다. MaterialApp의 Tab/ShiftTab·Enter/NumpadEnter/Space, FilledButton의 Focus/outline/disabled state와 route별 FocusScope를 공유 샘플·template의 Keyboard lab에서 소비한다. source `.ts`/emitted `.js`·직접 module import를 유지한다.

실제 Android 첫 Tab이 editor로 가는 실패에서 Stateful 자식의 늦은 Focus 등록이 widget 배치 순서를 바꾸는 것을 확인했다. 단순 traversal은 매번 현재 Element 순서를 해석하며 keyed move·inactive context를 처리한다. 이어서 한 JS turn에 묶인4 Tab이 첫 대상만 고르는 실패를 재현해 FrameworkRoot가 다음 transport 전에 대기 focus를 적용하도록 수정했다. 이미 primary인 node의 native focus 확인도 다른 대기 요청을 취소한다. **명시적인 Nelyx host timing/confirmation adaptation**이며 전체 Flutter traversal policy/group/order/directional 구현은 아니다.

Android host protocol2는 physical metadata·실제 character/lock snapshot과 순서가 있는 focus-loss를 전달한다. 기존 FIFO queue는 그대로이며 JavaScript에서 stale focus/owner를 거절한다. Windows는 React state/ref를 유지하는 표준 View로 self-focus 동안 plain/Shift Tab만 native routed 처리한다. 초기 Tab이 native Back proxy로 이동하던 실패를 수정했으나 **동적 native 처리 응답이나 모든 timing/modality 정책의 완료가 아니다**.

| 통합 증거 | 결과와 범위 |
| --- | --- |
| `contracts-result.json`, `burst-focus-result.json` | PASS — 실제 Core/mounted Widget 계약17개와 한 JS turn의4 transport focus0→1→2→3. key equality/synonym·handler mutation/error/lifetime·regularization/lock·Actions shadow/dispatcher·Shortcuts priority/modal/map equality·disabled scope/reverse·늦은 State mount/keyed move/native focus 확인. OS/native acceptance와 별도 |
| `native-contracts-result.json`, `windows-key-contracts-result.json` | PASS — Android protocol2 JS7·Windows helper5. 이전 생산 Kotlin queue JVM5는 source hash가 그대로여서 재사용하며 OS timed overload/ack 역순을 새로 강제한 증거로 확대하지 않음 |
| `android-ui-result.json`·현재 APK·화면 | PASS-scoped — API33/x86_64/RN/Hermes HBC96/Dawn Graphite. 초기4 Tab·반복 Enter의 Counter1·NumpadEnter Counter2, nested CtrlK/disabled/modal/forward/reverse/wrap/재진입/keys 해제. “본문을”·e+combining2·emoji5 선택·배율1.5·OS clipboard readback “👩‍💻”, native 입력 “👩‍💻Z” 한 번·CtrlA “Q”, editor→canvas 복귀·system Back foreground 이탈. adb 주입이며 물리 keyboard/IME/reader/GPU drain 증거가 아님 |
| `web-ui-result.json` | PASS-scoped — 현재 설치 Metro/CanvasKit/softwareWebGL2, pressed/repeat·typed Actions/Shortcuts·modal·traversal/active route·DOM blur state 해제·재진입과 rich word/emoji/복사·inline·배율/교체. 마지막 Core focus 경계까지 실제 재빌드/실행. browser close는 명시적인 SDK owner drain이 아님 |
| `windows-ui-prefix-result.json`·`windows-ui-boundary.log` | **PARTIAL** — 현재 RNW/Hermes HBC99/Graphite의 right Control·Numpad 활성화·typed keyboard lab·Tab/ShiftTab/Enter/Space·route wrap/reset 및 rich word/emoji/OS clipboard·배율/교체/재진입 prefix는 통과. 이어 native editor pointer focus/“Q”에서 실패하여 native editor Tab/ShiftTab·canvas 복귀 tail은 미수락. fresh UIA/pointer 입력은 되며 route 후 enabled/focusable/readOnly=false/정상 bounds인데 focus 유지가 실패. periodic diagnostic App rerender가 실패를 가려 진단 성공을 제품 수락으로 승격하지 않음 |
| source/coverage 감사 | PASS — current destination1,140·public modules33·exact constant713·type anchor22·private binding4. historical57 envelope와 직전69 artifact 보존, 총58. 선정751·product312·현재 frozen artifact508. 합계74,297: missing66,307 / partial2,102 / adapted5,870 / implemented7 / notApplicable11. manifest selections595·diff check PASS |
| build/types·cohort·설치 | PASS-scoped — Core0.13/SDK0.16/Skia0.4.1/Metro·CLI0.6, wire8/opaqueABI1/textStyle1/boundary1 유지. Core/SDK·current root types·설치 runner3 types·CLI types. 최종 Core focus 변경의 emitted declaration은 이전 통과본과 동일. 현재 일반8,271 files 전체 대조 후 CLI-only 단계마다681 files 재확인·나머지5 archive exact. Skia0.4.1은 package.json만 바뀐 metadata patch이고 authoritative supplier147-source/18-library/1,795-file을 재사용 |
| `cli-defaults-result.json`, `engine-notices-result.json`·폰트 | PASS-metadata/package — 이전 기본 생성 버전 참조를 고쳐 installed Core/SDK와 현행 runner template에서 cohort를 읽는다. --packages 없는 Web/Windows/Android 생성 manifest 확인이며 registry install 증거는 아님. Web/Windows nested notice와 Android APK runtime license 복사·Gradle input 추적을 보완해 정확한 engine2013 BSD notice가 현재3 배포/APK에 도달. 폰트5개/full notice bytes 일치. 전체 third-party inventory 수락은 별도 |

최종 archive는 `packages-notice-inputs`, 실제 후보는 `android-notices`·`web-focus-boundary`·`windows-notices`다. Windows notice-only repack은 실제 helper를 사용해 이전 payload1,093 files를 그대로 유지하고48 notice files를 추가했으며 재컴파일/새 UI 수락으로 확대하지 않는다. Core archive의 coverage는 runtime 수락 전 source snapshot이고 최종 runtime envelope는 workspace에만 기록해 로그 때문에 Core를 다시 공급하지 않았다. 공급 말단 npm 종료 실패1회는 archive를 다시 만들지 않고 supply만 재개해 해결했다.

처음의 Skia0.4→Core0.12 dependency/SDK peer 불일치·npm404, source span LF/CRLF·typed fixture·old installed identity 실패, Windows native Tab·editor 실패, Android 초기 focus/burst·body 재focus/scroll·Android13 clipboard preview가 Back을 가린 검사 실패와 raw 자료를 보존했다. 최종 Android 검사는 focus를 뺏은 size 버튼 뒤 본문을 다시 누르고 clipboard preview/IME를 닫은 뒤 이어간다. temporary diagnostic App source는 원래 bytes로 복원했다. Windows trace는 RNW0.83.2 설치 source intent이며 실제0.83.4 binary의 byte 동일성 증거가 아니다.

소유 command/UI/browser/server 작업은 끝났고 Windows process 부재·Android 앱만 force-stop·emulator5554 유지 확인. current GPU/SDK owner drain을 새로 주장하지 않는다. timeout1,200초·같은 시나리오 반복 대부분30회 이내를 유지했으며 commit/push·파일 정리/삭제·외부 메시지·memory 쓰기는 하지 않았다. 이전 Windows debug capture instrumentation PARTIAL과 fractional nearest/ovalAA PARTIAL도 유지한다.

**다음:** 먼저 timer workaround 없이 Windows native editor remount/focus를 해결한다. 최소 stock RNW의 조건부 TextInput 제거/복귀와 focusable View를 구성해 framework/Skia 유무를 분리하고, 안정적인 native overlay parent 구조 및 public TextInput focus/ref/lifecycle를 비교한다. 이후 W7-04 전체 keyboard/traversal/Actions/registrar/detector/menu·Apple/Linux 실제 keyboard code, W7-03 SelectionArea/WidgetSpan/caret/toolbar, W7-02 compositor/cache/effects·W7-01 잔여와 W7-05~14를 계속한다. Apple/Linux 전용 native compile/build/run/harness는 SKIPPED/provider notVerified이며 물리 IME/reader/scanout/FPS/device/ARM64/loss/서명/외부/clean-machine은 미수락이다.


### 9.21 W7-04 — Windows native editor 재진입·UIA Invoke action 수명 (2026-10-13 KST)

화면 복귀 뒤 native editor가 focus/입력을 받지 못하던 경계와 Move-editor-right InvokePattern을 해결했다. **이번 선정 흐름은 PASS-scoped이며 전체 W7-01~14는 ACTIVE/PARTIAL**이다. 증거는 `.tmp/work7/windows-editor-focus`, 현재 상태는 `checkpoint.json`·`final-verification.json`, 인계는 `resume-progress.md`다. 새 evidence는 `w7-windows-native-editor-focus-uia-lifetime-20261013`이며 새 Flutter API status 승격은 없다.

framework/Skia/periodic App rerender가 없는 stock RNW fixture에서 focusable canvas host 아래의 TextInput은 route 복귀 후 실패하고, 형제 배치에서는 통과했다. SDK Windows surface의 native control을 canvas keyboard host의 형제로 옮겼다. `NativeButton`에 Windows `onAccessibilityTap`을 연결해 InvokePattern을 제공하며, paint마다 교체되는 semantics snapshot을 exact-frame identity로 거절하던 action 경계는 살아 있는 같은 id/role의 token으로 구분한다. 최신 enabled/action 상태를 사용하고 제거·재사용·role 변경·서비스 종료 이후의 callback은 거절한다. 기존 exact-frame `isCurrentNode` 의미는 유지한다. Android hierarchy·native ABI1·frame wire8·textStyle1·boundary1·keyboard host2는 유지한다.

| 확인 | 결과와 범위 |
| --- | --- |
| Windows 실제 설치 후보 | PASS-scoped — HBC99/RNW/Graphite. keyboard lab/right Control/keypad·Tab/ShiftTab/Enter/Space·route reset, word/emoji/OS clipboard·배율/문서 교체·재진입을 통과. 이어 UIA Move editor right/left 왕복, editor Q/R 입력·Tab/ShiftTab·canvas 복귀까지 통과. 자동 owned-window pointer/key/UIA이며 물리 keyboard·Narrator·IME·GPU drain 수락은 아님 |
| Android·Web 실제 후보 | PASS-scoped — Android API33/x86_64/HBC96 emulator의 반복 Enter1/keypad2, keyboard lab, word/combining/emoji·배율/clipboard, native editor emojiZ 한 번·CtrlA Q·canvas 복귀·system Back 이탈 통과(132.53초). Web softwareWebGL2의 keyboard/DOM blur·rich 선택·복사/배율/교체/재진입 통과. 물리 기기·IME/reader·scanout/FPS 증거가 아님 |
| action 수명·build/types·설치 | 실제 SDK controlled7 scenarios, SDK build·workspace types·설치 runner3 types 통과. SDK0.16.1/Metro·CLI0.6.1을 공급하고 Core0.13/Skia0.4.1 archive3개는 exact 재사용. 일반8,271 installed files 대조. 마지막 영·한 README만 정정한 SDK archive는 별도 content hash로 보존·공급하고1,239 SDK files를 재대조; 나머지5 archives와 runtime/source/provider/native bytes는 동일하여 build/UI를 반복하지 않음 |
| 출처·보존·notice | product314·현재 frozen artifact205·이전508 artifacts와58 envelopes 보존, 총59. coverage74,297 상태와 manifest595 selections는 유지. 현재3 배포/APK의 engine2013 notice와 font5개 full notices 확인. whole third-party inventory는 PARTIAL |

초기 `actual-split`/`actual-actions`의 dist-only 진단은 Windows가 설치 `src`를 선택해 새 구현을 소비하지 않았으므로 **수정 소스 수락 근거로 superseded** 처리했다. 단순 cache 초기화도 이 module 선택을 바꾸지 않는다. 최종 production package의 portable Metro snapshot은 Windows src3·Android emitted dist3가 workspace와 정확히 같음을 확인했고, 실제 UIA 동작을 다시 수락했다. 원래 App bytes는 복원했다. 설치 RNW0.83.2 source의 InvokePattern 조건을 참고했으나 Microsoft.ReactNative0.83.4 binary와 source byte 동일성은 주장하지 않는다.

Android 기본 GraalVM의 jlink 실패·JBR25의 restricted native method 실패와 중간 검사 자료를 보존했다. 현재 후보는 설치된 Temurin21로 Release build했고 signing은 local development다. 최종 후보는 `windows-candidate`·`android-temurin21`·`web-candidate`, archive는 `packages-final-docs`다. authoritative Skia supplier147-source/18-library/1,795-file은 유지하고 Windows host는 재빌드했다. 현행 후보 inventory/HBC identity와 owned process 부재·Android fatal filter0·기존 emulator5554 유지 확인. Windows cooperative exit·Android force-stop·browser close는 SDK/GPU owner drain의 새 증거가 아니다. timeout1,200초·같은 시나리오 반복 대부분30회 이내를 유지했고 commit/push·파일 삭제·외부 메시지·memory 쓰기는 하지 않았다.

**다음:** W7-04의 keyboard locale/device/dead-key/startup sync, ordered/group/directional traversal·highlight, Actions overrides/prioritized/registrar/detector/menu와 Apple/Linux keyboard 코드로 이어간다. W7-03 SelectionArea/WidgetSpan/caret/toolbar·전체 typography, W7-02 compositor/cache/effects·W7-01 잔여와 W7-05~14도 남는다. Apple/Linux 전용 native compile/build/run/harness는 SKIPPED/provider notVerified이며 물리 IME/reader·scanout/FPS/device/ARM64/loss/서명/외부/clean-machine·whole notices와 이전 fractional nearest/ovalAA/debug capture PARTIAL을 유지한다.


### 9.22 W7-04 — 그룹·reading/명시 순서·방향 focus 이동 구현 (2026-10-13 KST, 세션 진행 중)

여러 control 그룹을 Tab·Shift+Tab·방향키로 이동하는 흐름을 Core와 공통 앱까지 연결했다. **source 개발 확인은 통과했지만 세션 수락은 아직 PARTIAL/진행 중**이다. 출처/coverage adoption·template/공급·Windows/Android/Web 실제 실행이 남아 있고 전체 W7-01~14도 ACTIVE/PARTIAL이다. 현재 인계는 `.tmp/work7/focus-traversal/resume-progress.md`·`checkpoint.json`, 중간 확인은 `interim-verification.json`이다. 이전 §9.21 설치 후보의 PASS를 새 traversal 구현에 승계하지 않는다.

새 직접 모듈 `focus-traversal-policy`·`focus-traversal-group`·`focus-traversal-order`에 ReadingOrder/WidgetOrder/Ordered 정책, Numeric/LexicalFocusOrder, Directional mixin factory와 group/order widgets를 구현했다. 정책 엔진은 widget 생성 모듈을 import하지 않도록 내부 marker 모듈로 연결해 기존 `focus-traversal` intents/actions 경로를 유지했다. 실제 Element 순서와 global RenderBox geometry, 혼합 LTR/RTL band, 그룹별 독립 정렬, scope stop/closedLoop/parentScope/leave 경계, 방향 이동의 beam/edge 선택과 역방향 이력·scroll owner를 처리한다. scope 이동은 descendant 이력도 해제한다. FocusNode의 next/previous/directional 공개 API는 살아 있는 widget/group을 요구하고 기존 FocusManager.next의 무그룹 호스트용 widget-order 호환 경로는 유지한다.

Material 기본 Actions/Shortcuts에 방향 이동과 기본 reading group을 연결했다. FocusScope/FocusScopeNode에 일반·방향 edge 설정을 추가하고 Directionality·scroll owner와 기본 reveal 경로를 연결했다. `Traversal lab`은 숫자/문자 그룹·2D grid·order 반전·RTL·비활성화/탐색 제외·edge 전환·활성화 결과·화면 복귀를 공통 앱에 제공한다. home의 네 번째 navigation button이 추가되어 기존 counter 도달은 Tab5다. template 동기화는 아직 미실행이다.

확인된 범위는 실제 BuildOwner/RenderBox layout의 traversal20 cases, 기존 keyboard17 cases, 한 JS turn의 실제 FrameworkRoot Tab down/up4개, Core ESM/declarations/build·workspace types·sample types·ESM 초기화·diff check다. 실제 viewport의 마지막 control 노출과 첫 control wrap, GlobalKey group scope 이동, stale history 제거를 포함한다. geometry fixture의 active host 재사용 오류는 이동 control의 GlobalKey를 유지해 수정했고, 이전 burst fixture에는 reading 정책이 요구하는 실제 layout을 추가했다. 실패 log는 보존했다. 새 native/DOM 입력·reader·physical keyboard의 증거는 아직 없다.

고정 Flutter71e4717의 focus_traversal/focus_manager/focus_scope/app 원본4개를 캡처했다. 현재 제품 snapshot320 files와 이전 frozen205 artifacts 보존을 확인했다. **coverage는 이전59 envelopes/74,297 records·manifest595 selections 그대로이며 새 변경의 destination hash 재검토/adoption은 미반영**이다. default traversal callback은 현재 RenderObject 최소 노출 경로이며 원본의 전체 Scrollable alignment/duration/Curve 결합을 완료로 처리하지 않는다. 새 공개 class의 남은 API/차이도 출처 review에서 partial로 구분해야 한다.

설치 cohort와 실제 후보는 여전히 §9.21의 Core0.13/SDK0.16.1/Skia0.4.1/Metro·CLI0.6.1이다. 새 API가 있는 workspace 개발 bytes를 같은 version의 새 archive로 공급하지 않았다. 다음 통합에서 정확한 dependency를 확인해 Core0.14/SDK0.17/Skia0.4.2 metadata patch/Metro·CLI0.7 이행을 한 번 묶을 계획이며 아직 version/range/lock 변경이나 pack/install/native build는 하지 않았다. native ABI1·wire8·textStyle1·boundary1·Android keyboard2와 기존 Skia supplier는 변경하지 않았다. 소유 native/browser 프로세스를 새로 시작하지 않았고 commit/push·삭제·외부 메시지·memory 쓰기도 하지 않았다.

**즉시 재개:** default reveal callback 및 남은 source 의미를 검토하고 coverage/import mapping·관련 기존 destination을 갱신한다. template·문서·6 package/provider/range/lock을 한 번 이행한 뒤 현존 Windows/Android/Web runner에 공급하고 실제 Traversal lab과 기존 keyboard/selection/editor/UIA 흐름을 수락한다. stop/leave edge에서는 framework Focus 표시뿐 아니라 실제 OS focus와 이어지는 activation도 확인한다. 이후 전체 W7 잔여를 계속한다. Apple/Linux 전용 native 검사는 계속 SKIPPED/provider notVerified다.

### 9.23 W7-04 포커스 정책·탐색 그룹 통합 수락 — 전체 ACTIVE / PARTIAL

9.22의 진행 중 snapshot을 이어 `.tmp/work7/focus-traversal`에서 선정 흐름을 수락했다. Core0.14의 policy/group/order 직접 module과 Material 기본 reading group·방향 Actions, 공유/CLI template Traversal lab을 연결했다. SDK0.17·Skia0.4.2·Metro/CLI0.7·provider/range/runner refs/root lock·영한 안내를 함께 이행했다. Skia는 이전0.4.1과 비교해 package.json만 달라 native/runtime 파일은 동일하다.

Windows·Android·Web 최종 설치 후보에서 숫자 B D A C/문자 alpha beta·역방향 Tab·geometry/역방향 이력·order 반전·비활성/탐색 제외·유효 이력 복원·closedLoop/stop·RTL·15회 정확한 activation·화면 복귀가 PASS다. stop 뒤 Windows native canvas/Web DOM canvas focus와 후속 Enter를 확인했고 Android도 후속 Enter가 같은 control을 활성화했다. Web height500에서 마지막 control y424/h54가 viewport 안으로 노출되고 실제 Enter로 활성화됐다. 전체 Scrollable alignment/duration/Curve·nested animation과 leaveFlutterView의 실제 OS 경계는 완료하지 않았다.

실제 실패에서 scope의 마지막 B를 화면 밖 focus 상태에서 비활성화하면 재진입이 막히는 경로를 수정했다. 유효하지 않은 remembered child를 거르고 현재 정렬 대상에서 고른다. pinned requestTab과 달라지는 robustness adaptation 및 별도 원본 FocusScopeNode의 invalid-history 정리 경로를 출처에 명시하고 정책 class/member 전체는 partial로 유지한다. 기존20 mounted 계약·keyboard17·동일 JS turn burst4에 disabled-history reentry1을 추가했다. 빌드/4 workspace package types와 설치 후 sample types가 PASS다. 초기 old installed identity 오류 및 후보·overlay·fixture 실패는 보존했다.

기존 keyboard/actions/pressed-state/repeat/전파와 rich selection·word/combining/emoji·clipboard·scale·문서 교체·재진입도 최종 후보에서 PASS다. Windows UIA Move editor 왕복 및 Q/R native editor Tab/ShiftTab·canvas 복귀를 포함한다. 추가 navigation으로 홈이 길어져 실제 휠로 UIA 버튼을 노출했다. resize/RTL/pointer 후 새 표시와 canvas native focus를 기다린 선정 흐름이며 빠른 native focus timing stress 증거는 아니다. Android는 원래 emulator5554/API33/x86_64의 adb 주입이며 물리 입력/전체 IME/reader 수락이 아니다.

최종 packages-final-reentry의 Core0.14 수정은 policy source/js/map·출처 review4 files이고 다른5 archives와 public dts는 동일하다. 설치8334 ordinary files가 archive와 일치해 development overlay를 해소했다. windows-final-reentry1146/HBC99, android-final-reentry836/HBC96/APK536entries·12libs, web-final-reentry556을 확인했다. Windows Core dist/SDK src, Android·Web emitted dist의 변경/인접 module 및 sample15 snapshots씩이 현재 bytes와 일치한다. 기존 supplier147source/18libs/1795files·ABI1/wire8/textStyle1/boundary1/keyboard2를 유지하고 엔진2013 notice·5 font notice가3 배포본/APK에서 동일하다.

출처145 records와 관련 기존165 destinations를 검토했고 새60번째 envelope를 추가하며 이전59개를 보존했다. coverage74,297은 missing66,162 / partial2,235 / adapted5,882 / implemented7 / notApplicable11, manifest618 selections다. 제품321 hashes와 현재 세션 artifacts를 checkpoint에 동결하고 이전205 artifacts도 보존했다. Core archive는 runtime 수락 전 source-reviewed partial metadata snapshot이며 최종 runtime receipts는 workspace envelope에만 추가했다. 소유 Windows/Web 종료·Android 앱 force-stop과 원래 emulator 보존은 독립 GPU drain 증거가 아니다.

**다음:** W7-04의 Actions override/prioritized/shortcut registrar·focus highlight/detector/menu·device/startup/locale/dead-key와 Apple/Linux 실제 code, W7-03 고급 선택/편집·W7-02 compositor/cache·W7-01 잔여·W7-05..14 전체를 계속한다. Apple/Linux 전용 native build/run/harness는 SKIPPED/provider notVerified다. 물리 입력/reader·성능/scanout·ARM64/device/loss·서명/외부 소비/clean-machine/전체 notices는 미수락이다. 이번 선정 흐름 수락은 전체 W7-04나 work7 목표 완료가 아니다.

### 9.24 W7-04 Actions 재정의·우선순위 흐름 구현 중 — 전체 ACTIVE / PARTIAL

9.23의 선정 탐색 수락을 동결한 뒤 `.tmp/work7/actions-overrides`에서 다음 연관 작업을 시작했다. Action.overridable/callingAction과 contextual default adapter를 연결해 상위 override가 기본 동작을 호출할 수 있게 했다. enabled/consumesKey·현재 ancestor mapping·wrapper 재생성·예외 후 호출 상태 복원을 처리하고 기본 ContextAction의 invocation context를 보존한다. PrioritizedIntents/PrioritizedAction은 앱의 현재 focus에서 첫 enabled candidate를 고르고 해당 invocation context로 호출한다. process-global primaryFocus 대신 owner/supplier를 사용하며 source와 달라지는 강한 예외/재귀 guard 및 immutable list는 후속 출처 review에 명시할 대상이다.

실제 BuildOwner/Focus/Actions mounted 계약과 laid-out FrameworkRoot의 Ctrl+K override → 비활성화 → Ctrl+P priority fallback을 포함한10 cases 및 Core ESM/declarations build가 PASS다. 이는 새 설치본/native/DOM 수락이 아니다. 현재는 actions.ts 한 제품 파일만 달라졌고 Core0.14의 workspace development bytes다. 9.23의 최종 설치 archive/후보는 그대로 유지했다. pin71e4717의 actions/shortcuts/focus_manager3개를 캡처했다.

제품321 provisional hashes와 이전 frozen323 artifacts 보존을 확인했다. coverage60 envelopes·manifest618 selections는 이전 bytes 그대로이며 바뀐 Actions의 기존 destination hash는 이번 연관 작업의 source review/adoption에서 갱신할 예정이다. 이 중간 snapshot은 새 세션 완료·출처 완료가 아니다.

**즉시 재개:** ShortcutRegistry/Entry/Registrar와 focus highlight/FocusableActionDetector·공통 KeyboardLab 흐름을 함께 구현하고 출처·문서·공급·실제 입력을 세션 통합 지점에 묶는다. source shortcut registry의 post-frame 통지·token 수명·activator 값 동등성은 기존 scheduler/Shortcuts와 연결해야 한다. 전체 W7-01..14 및 Apple/Linux 실제 code 범위는 유지하고 해당 플랫폼 전용 native 검증은 SKIPPED/provider notVerified다.

### 9.25 W7-04 등록부·표시 모드·mouse 영역·공통 흐름 구현 중 — 전체 ACTIVE / PARTIAL

9.24의 Actions 작업에 ShortcutRegistry/Entry/Registrar와 실제 post-frame 통지·activator 값 동등성·등록 token 수명을 연결했다. 중복 등록/교체는 기존 값을 보존해 거부하고 caller map은 snapshot으로 소유한다. standalone registry에는 소유 scheduler를 명시하며 Registrar는 owner.postFrame을 사용한다. 실제 종료 검증에서 scheduler가 먼저 닫힌 뒤 자식 등록 해제가 통지를 요청하는 오류를 찾아 닫힌 root의 post-frame 요청을 차단했다.

FocusHighlightMode/Strategy·counted listener·앱별 pointer/key 표시 모드와 Android virtual/soft-key provenance를 연결했다. MouseRegion/RenderMouseRegion/MouseTracker는 겹침·local transform·진입/이탈 순서·정지 포인터의 layout 재검사·제거된 annotation/숨겨진 View 수명을 처리한다. FocusableActionDetector는 Focus/Actions/Shortcuts와 hover를 조합하고 directional navigation에서 비활성 focus를 허용한다. 일반 navigation으로 돌아갈 때 표시 callback이 남는 실제 오류는 마지막 보고 상태를 기준으로 고쳤다. 숨김 때 exit callback이 실패해도 모든 mouse stream과 눌린 키를 해제하는 계약도 확인했다. source와 다른 강한 guard/snapshot/callback 보정은 후속 review에서 명시할 대상이다.

SDK Web·desktop RN의 pointerleave와 Android host의 optional flags/SDK 검증을 추가했다. protocol2·native ABI1/wire8/textStyle1/boundary1·Skia supplier는 유지한다. Android adb의 deviceId -1은 원본 정책상 virtual input이므로 물리 키보드 표시 모드 증거로 바꾸지 않는다. MouseCursor/OS cursor port·전체 pointer event hierarchy/물리 device identity·Android/iOS hover·native semantic overlay의 전역 입력/표시 경로와 early/late/startup/locale/dead-key는 여전히 미완료다. cursor 옵션을 빈 동작으로 제공하지 않았다.

공통 Keyboard lab 안에 Actions and focus 패널을 연결했다. 기본/재정의 호출·priority fallback·단축키 교체/해제/재등록·Enter/Space·focus/hover·강제 표시 모드·disabled directional navigation을 실제 Web workspace 개발 연결에서 실행해 PASS, 오류0·target activation10·재진입 reset을 확인했다. screenshot도 검토했다. 제어 검사는 Actions10 + Registry7 + highlight/mouse13 + Android flags3, 총33 cases다. Core/SDK build와 sample source types가 PASS다. 전체 sample types의 이전 설치본 nominal identity 오류는 새 cohort 공급에서 해소할 대상이며 숨기지 않았다. Web UI snapshot 이후 추가한 visibility 오류 정리 변경은13 targeted 계약으로 확인했고 최종 후보에서는 전체 현재 bytes를 다시 검증해야 한다.

이전 설치 패키지를 덮어쓰지 않고 isolated Web runner의 React/CanvasKit과 workspace Core/SDK dist를 resolver로 연결했다. selected39 installed files가 이전 archive와 같은 것도 확인했다. 새 pack/install/native 실행이나 version/provider/template 이행은 아직 없다. 현재327 provisional hashes, 기존15 files 변경/새6 files와 이전 frozen323 artifacts 보존을 기록했다. pin10 source files를 캡처했고 coverage60 envelopes/manifest618은 이전 bytes 그대로라 새 source review/adoption·기존 destination 재연결이 남아 있다. 이번 세션은 아직 OPEN이다.

**즉시 재개:** 출처 review와 남은 cursor 의존 범위를 구분하고 문서·sample3 mirrors·정확한 버전/peer/provider/lock 이행을 묶은 뒤 최종 Windows·Android·Web 공급/실제 입력을 수락한다. Keyboard lab은 launch button 추가로 Tab wrap6이며 Enter로 실제 target을 확인한다. Home counter 도달은 여전히 Tab5다. 전체 W7-01..14를 유지하고 Apple/Linux 실제 code는 계속 구현하되 전용 native 검증은 SKIPPED/provider notVerified다.

### 9.26 W7-04 Actions 출처·공급·Web/Android 통합 — Windows hover 수정 진행 중

원본208 records와 기존420 destinations를 검토하고 이전60 evidence envelopes를 보존했다. 총61 envelopes/manifest641이며 coverage74,297은 missing65,954·partial2,436·adapted5,889·implemented7·notApplicable11이다. 새 class 전체를 완료로 올리지 않고 cursor·diagnostics·전체 pointer/keyboard API와 source 차이를 명시했다. contextual default adapter의 listener 전달 누락도 보완해 제어 검사는34개다. Registry static class block은 실제 Windows/Android Metro가 지원하지 않아 private constructor와 module 내부 Symbol factory로 바꾸고 Registry7을 다시 확인했다.

Core0.15/SDK0.18/Skia0.4.3 metadata/MetroCLI0.8·정확한 dependency/provider/range/lock·sample3 mirrors·영한 안내를 이행해 기존3 runner에 공급했다. Skia는 package.json만 달라 native/runtime payload가 동일하다. 초기8412 installed files를 대조했고 Core/CLI 보정 뒤에는 변경4467 files만 재확인해 나머지4 archives를 그대로 재사용했다. root sample의 Core 해석을 workspace dist로 통일해 nominal type 중복을 고쳤으며 세 installed runner의 독립 types도 PASS다. template에는 저장소 전용 경로를 내보내지 않도록 sync-template 구성만 보강했고 실제 prune/sync는 실행하지 않았다.

현재 설치 Web·Android 후보에서 Actions default/override/alone·priority fallback·동적 shortcut 등록/교체/해제·target 활성화10회·강제 표시 모드·disabled directional focus·재진입 초기화와 기존 traversal15회·6-stop keyboard·rich word/combining/emoji·clipboard/배율/문서 교체가 PASS다. Android는 native editor emojiZ 한 번→CtrlA Q·canvas 복귀·system Back까지 포함하며 API33/x86_64/adb 가상 입력이다. deviceId -1 입력이 touch 표시를 유지했고 실제 Kotlin flags source/compileReleaseKotlin도 확인했다. soft IME flag2를 실제 주입하거나 물리 입력/reader를 수락한 것은 아니다. adb daemon 단절 실패와 같은 emulator에서 복구한444초 실행을 별도로 보존했다.

Windows release 후보는 build/HBC99·아카이브 소스 소비를 확인했으나 실제 포인터 이동 후 hover가 꺼져 전체 native 흐름은 PARTIAL이다. 긴 패널의 화면 밖 strategy control은 wheel fixture로 노출했고, Outer/Inner 버튼의 Enter 콜백이 빈 동작인 점은 실제 흰 focus 테두리와 후속 CtrlK로 검사하도록 고쳤다. 이어 SDK surface의 Windows 포인터 수신부를 표준 WindowsKeyboardHost View로 옮기고 custom SkiaView에는 wheel port를 유지하는 workspace 수정을 개발했다. packageRoots만으로는 설치 SDK를 대체하지 못한 사실을 snapshot에서 확인해 해당 개발 UI를 수정 코드 수락 근거로 쓰지 않았다. 명시적인 direct-export resolver의 세 번째 native build는 현재 SDK sourceContent와 HBC99가 일치한다. 외부 workspace 경로를 포함한 portable package는 기존 app 소유 경계에서 거절됐으며 guard를 완화하지 않고 raw native output을 개발 확인에 사용한다.

이후 실제 현재 소스를 소비한 raw Windows 실행도 hover에서 실패해, 표준 host로 옮긴 실험을 별도 보존한 뒤 원복했다. SDK를 다시 빌드해 workspace SDK413 files가 b157 archive와 정확히 일치한다. raw Windows 개발 UI 결과와 다음 SDK 공급/설치·현재 native 후보 수락을 구분해야 하며 이번 세션은 아직 OPEN이다. 이전 frozen323 artifacts·실패 후보·source/native/runtime logs를 보존했고 임시 Metro 설정은 원래 bytes로 복원했다. 엔진2013·font5 notice는 현재3 배포/APK에서 동일하다. 전체 W7-01..14는 ACTIVE/PARTIAL이며 Apple/Linux 실제 code·전용 native 검증 SKIPPED/notVerified 경계와 물리 입력/IME/reader·성능/scanout·배포·독립 GPU drain 미수락을 유지한다.

9.26의 추가 진단에서 실제 native pointer callback은 down/up 뒤 같은 내부 좌표의 leave였고, 네 위치로 포인터를 옮겨도 move callback은 기록되지 않았다. UI의 focus:on/hover:off도 함께 캡처했다. 이는 다음 Windows native hover/move ingress 수정의 근거이며 기존 down/up 좌표는 scale2의 논리 좌표와 맞아 무조건 재배율하지 않는다. 임시 input logger와 Metro resolver는 정확히 복원했다. diagnostic PowerShell은 관찰 저장 뒤0xe0464645로 끝났으므로 진단은 PARTIAL이며 native process exit0을 제품 수락/GPU drain으로 바꾸지 않는다. 현재 raw windows/x64/Release 출력에는 실험/logger가 있으므로 최종 제품 후보로 사용하지 않는다. 보존한 windows-final 설치 후보의 hover는 미수락이며 native 이벤트 경계 수정·공급·현재 Windows 실행을 계속해야 한다.


## 9.27 Windows native pointer port1 통합 — OPEN / 전체 PARTIAL

SDK0.19 / Skia0.5 / Metro·CLI0.9로 Windows custom view의 native press/move/hover/up/cancel/leave를 연결했다. Core0.15 archive는 그대로 승계하며 ABI1·wire8·text1·boundary1·Android keyboard2는 유지한다. 논리 좌표·surface 세대·pointerVersion1을 검사하고 SDK monotonic 수신 clock을 사용한다. capture 손실·layout·retire의 눌린 포인터 취소와 실제 ContentIsland 이탈, 늦은 mount callback의 세대/weak 수명 보호를 함께 처리한다. 전체 event hierarchy·cursor·device/capture·editor overlay 의미는 여전히 partial이다.

37개 선정 계약과 공통/세 설치 runner types, 첫 cohort의 실제8412 파일 대조가 통과했다. Windows 기본 Actions10 활성화와 실제 move-only hover/after-up 유지/영역 이탈은 통과했지만 title-bar 이탈이 실패해 세션을 닫지 않았다. ContentIsland 초기 연결의 startup AV와 dispatcher 타입 compile 실패를 보존했다. PDB 심볼로 확인한 AV 원인은 weak reference를 지원하지 않는 `InputPointerSource`의 `auto_revoke`였다. 초기 island 할당 순서는 crash 원인으로 확인되지 않았다. 명시적인 source 소유와 event token 등록·transactional 해제로 startup과 실제 title-bar 이탈·재진입·after-up hover를 확인했다. native Q/R 1회 입력과 양방향 Tab도 통과했으나 편집기에서 canvas로 돌아오는 첫 클릭은 실패했다. window 전체 capture 손실을 own view로 좁힌 후보에서도 실패가 남아 원인으로 단정하지 않는다. 원복한 임시 controller/debugger 추적에서 동일 xy·viewport/native2의 `down → cancel → leave → up`을 확인했다. generic 이탈을 point/null 두 경로 모두 hover-only로 분리한 `windows-pointer-hover`는 native build와 Q 1회 입력을 통과했지만 첫 canvas 클릭 실패는 남았다. 따라서 generic 이탈만이 취소 원인이라는 해석은 확정하지 않으며, own capture 손실·unmount/retire·실제 cancelled packet의 native 호출 지점을 직접 추적할 작업을 이월한다. 전체 세션은 OPEN이다. 새 Web 후보는 Actions2·hover·reset·TextLab inline/return/errors[]를, Android 후보는 원래 API33/x86_64 emulator에서 Actions2·virtual-touch mode·reset을 통과했다. Windows header만 바뀐 후속 수정 때문에 Android/Web 전체 UI를 반복하지 않는다.

현재 출처 audit는208 선정 binding/8341 destination/156 exportSource/60 과거 envelope/323 frozen artifacts를 보존했다. 패키지/소스/실행 세부 범위는 `.tmp/work7/actions-overrides/checkpoint.json`, `pointer-hover-packed-result.json`, `pointer-order-observation-result.json`, `pointer-source-audit-result.json`, `web-ui-pointer/result.json`, `android-ui-pointer/result.json`과 실패 원본에 기록한다. 물리 입력·reader·scanout·성능·독립 GPU drain이나 W7 전체 완료를 뜻하지 않는다.

## 9.28 Windows 편집기 → canvas 첫 클릭 취소 수정 — 선정 흐름 수락 / 전체 PARTIAL

현재 hover-only 소스를 임시 계측한 native 진단에서 `down(source8/self8) → Unmounted → lifetime-leave-all → cancel(active1) → up(source8/self8)`을 확인했다. Root의 좌표640,249.5·viewport/native2·크기는 일정했다. 실제 취소 호출은 `ComponentView.Unmounted`였으며 generic island 이탈만을 원인으로 본 이전 해석은 폐기한다. 진단용 app/native header는 finally에서 원본 해시로 복원했고 진단 process도 exit0으로 종료했다. 진단 실행 자체는 제품 수락으로 사용하지 않는다.

RNW는 surviving child를 remove/reinsert할 때도 Unmounted를 알린다. native island 구독은 즉시 해제하되 UI 작업이 반환된 뒤에도 같은 view가 unmounted인 경우 포인터를 취소하도록 수정했다. 같은 input owner에서 재삽입된 view는 진행 중 press를 유지하며, 다른 input owner·Destroying·layout·binding retirement·own capture loss의 취소는 유지한다. RN0.5 archive61a602의 변경은 Windows header 한 파일이고 다른5 archives는 정확히 재사용했다. 공급 참조만 갱신하고 설치를 빠뜨린 첫 빌드는 해시 불일치로 제외·보존했으며, 명시적인 npm install 뒤 세 runner8412 files를 다시 대조했다.

현재 `windows-pointer-transaction-installed` Release2a5d46/HBC99·1151 files와 portable source26/Android27/Web25·동일 supplier147 sources/18 libraries/1795 files·엔진2013/font5 notices를 확인했다. 계측하지 않은 현재 Windows 후보에서 native Q 1회 입력 뒤 Keyboard lab **한 번 클릭**으로 이동했다. move-only hover·실제 title-bar 이탈/재진입·up 뒤 hover 유지·pointer/Enter/Space 각 활성화·current-focus contextual compose·priority fallback·canvas Tab/Shift+Tab·route owner 초기화도 PASS-scoped다. 현재 Windows 결과는 `windows-ui-pointer-transaction/result.json`, 출처/공급/후보 기록은 `pointer-transaction-*-result.json`, 직접 원인 진단은 `pointer-reasons-observation-result.json`에 있다.

선정 Actions/표시/입력 흐름의 수정과 통합 확인은 여기서 닫는다. 이전 Windows Actions10·strategy/disabled·두 native editor Tab과 Web/Android의 넓은 흐름은 해당 후보 범위를 유지하며 새 후보에서 전부 다시 실행했다고 쓰지 않는다. 이후 Windows header 변경은 Android/Web 실행 코드를 바꾸지 않아 앞선 현재 후보의 선정 수락을 승계한다. 전체 W7-01..14와 keyboard early/late·batch/raw/startup/device/locale/deadkey/menu·cursor/event hierarchy·고급 편집/renderer·Apple/Linux 실제 코드·물리 입력/IME/reader·성능/scanout·배포·독립 GPU drain은 ACTIVE/PARTIAL이다. owned Windows 앱만 정상 종료했고 기존 emulator5554와 모든 실패/과거 증거를 보존했다.

## 9.29 Keyboard early/late·정규화 message 배치 — 관련 세션 OPEN / 전체 PARTIAL

`framework/widgets/focus`에 OnKeyEventCallback·combineKeyEventResults와 FocusManager early/late 등록·해제 네 API를 구현했다. HashedObserverList의 중복 등록 횟수와 고유 callback 1회 호출, 단계별 snapshot·callback-major batch·handled 우선 결과 합성을 유지한다. pin의 실제 early skip은 focus tree를 계속 방문하며, node skip 뒤에도 late handler가 처리할 수 있다. 이 동작은 원본 일부 공개 주석과 달라 실제 코드를 기준으로 기록했다. app-local owner와 삼중 결과를 이용한 legacy/native 기본 동작 구분, 폐기된 manager/node 접근 차단은 Nelyx adaptation이다.

HardwareKeyboard의 `handleTransportMessage`와 FocusManager의 `dispatchKeyEvents`는 한 native 입력에서 생성한 정규화 event를 실제 배치로 연결한다. HardwareKeyboard observer는 event별 incremental state를 보지만 focus는 완성된 pressed state와 하나의 경로 snapshot을 본다. synthesized modifier의 handled 결과도 누적하고, focus loss의 key-up 정리를 message 뒤로 미루며 재진입은 owner 변경 전에 거부한다. FrameworkRoot에서 이 경로를 소비하고 sample/template의 Keyboard lab → Keyboard dispatch에 Ctrl+E 전역 capture·Ctrl+K focused 처리·Ctrl+L fallback·등록 해제/재진입 화면을 연결했다.

신규 의미 사례16·이전 keyboard/Actions 회귀17·Core ESM/declaration build·공통 types가 PASS다. 현재 workspace Core/SDK direct export로 만든 실제 Chromium/CanvasKit UI에서 capture·focus·fallback·disable/re-enable·owner 초기화·기존 shortcut/Actions compose가 PASS-development-scoped이며 errors[]다. 처음 Web 회귀는 Actions 화면 mount 전 키를 보낸 실패였고 화면 상태를 기다린 재실행과 실패 원본을 별도로 보존했다. 실제 source snapshot에서 변경 Core3 modules/sample2 files를 대조했다. 새로운 native 실행/physical/IME/reader 수락이나 이전 설치 archive와의 동일성은 주장하지 않는다.

git pin의 raw bytes 두 파일과 source span/AST를 검토해13 bindings를 갱신했고 기존101 destinations를 현재 anchor/hash로 재확인했다. 과거61 evidence envelopes는 그대로이며 현재62 envelopes/643 selections·8353 destination hashes·156 exportSource hashes다. 74,297 rows의 상태는 missing65,942·partial2,446·adapted5,891·implemented7·notApplicable11이다. 전체 class나 keyboard 완료로 올리지 않았다.

관련 세션은 `.tmp/work7/keyboard-dispatch/checkpoint.json`·`resume-progress.md`에서 계속한다. 이번 normalized adapter를 deprecated RawKeyEvent/KeyMessage/KeyEventManager의 대체 stub으로 채택하지 않았으며 해당 공개 class는 missing 상태를 유지한다. 실제 raw/channel/global registration·startup/device/layout/locale/deadkey/menu·Apple/Linux 코드와 관련 keyboard native/cohort 통합은 남는다. 기존 설치 Core0.15/Windows2a5d46 후보는 이전 byte 범위의 증거이고, 새 workspace 변경의 공급은 관련 구현을 묶은 다음 session/I2 통합에서 수행한다. 전체 W7-01..14와 W7-13/14 물리/배포/독립 GPU drain 경계는 계속 PARTIAL이다.

## 9.30 Raw keyboard 계열·실제 채널·deprecated Focus 경로 — 관련 세션 OPEN / 전체 PARTIAL

고정 원본의 RawKeyEventData 공통 계약과 Android/Fuchsia/Web/macOS/iOS/Linux/Windows data, GTK/GLFW helper, RawKeyEvent/RawKeyboard/KeyMessage/KeyEventManager 및 엔진 KeyData를 15개 직접 module로 추가했다. 원본 플랫폼 map 25개/2,969 entries와 modifier/side·numpad·unknown-plane·value equality·repeat/layout·raw pressed 동기화·IME down/up paired skip·raw-only/KeyData-then-raw 전환을 실제 처리한다. ServicesBinding은 앱별 raw/modern keyboard와 manager를 소유하고 `flutter/keyevent` JSON BasicMessageChannel을 등록·응답·해제한다. FocusNode/Focus의 deprecated onKey는 실제 KeyMessage.rawEvent로 normalized callbacks 뒤 호출하며 virtual Android 입력의 표시 모드를 보존한다. 빈 raw-only message도 callback을 방문한다.

원본 iOS packed UTF-16 logical ID를 legacy transport label로 투영하다 key-up이 RangeError로 중단되는 문제를 실제 probe에서 확인했다. canonical ID와 공개 keyLabel 정책은 유지하고 compatibility label만 유효 Unicode scalar 범위에서 투영하도록 수정했다. 실패 원본과 관측 receipt를 보존했다. 앱 timestamp(milliseconds)/명시적인 lifetime·값 동등성·const collection·Dart VM hash와 JavaScript hash 차이는 source envelope에 명시한다. 기존 helper adapter를 새 공개 class의 stub으로 바꾸지 않았다.

Core 제어 계약26, 이전 dispatch16·keyboard/Actions17 회귀, Core ESM/declarations와 공통 types가 PASS다. 실제 BinaryMessenger/ChannelBuffers/codec의 handled reply 및 dispose 후 handler 해제를 검사했다. 현재 workspace를 소비하는 Chromium147/CanvasKit 화면의 기존 입력7 흐름·startup/errors[]가 PASS-development-scoped다. 현재 브라우저 입력은 이전 modern adapter이므로 이 Web 실행을 자동 raw ingress 수락으로 쓰지 않는다. Apple/Linux data의 Windows Node 공통 Core 검사는 해당 플랫폼 전용 native harness/build/run 증거가 아니며 그 전용 검증은 SKIPPED/provider notVerified다.

원본13 framework files·엔진 key.dart dependency의 exact git bytes와 source span/compiler anchor를 검토했다. 선정366 bindings와 기존150 destination 갱신 뒤 independent audit에서 현재8,717 destination hashes·182 exportSource hashes·15 emitted direct modules를 확인했다. 이전62 evidence envelopes는 보존했고 현재63 envelopes/692 manifest selections다. 전체74,297 rows는 missing65,578·partial2,680·adapted6,021·implemented7·notApplicable11이며 class 전체나 W7-04 완료로 올리지 않는다. source/제어/Web 증거는 `.tmp/work7/keyboard-dispatch/raw-review-audit-result.json`, `raw-family-contracts-result.json`, `raw-prior-*-result.json`, `web-raw-ui-result.json`에 있다.

다음은 SDK 실제 raw ingress·활성 View와 manager 소유권·global registration/PlatformDispatcher key callback·startup/device/layout/locale/deadkey/menu 및 native/cohort 통합이다. FrameworkRoot 자동 raw routing은 아직 없고 제어 검사에서는 명시적으로 KeyMessage handler를 연결했다. 새 source 공급/버전 변경/세 runner native 검증은 연관 keyboard 구현을 묶은 session/I2 지점에서 수행하며 기존 설치 Core0.15와 Windows2a5d46 증거를 새 코드로 승격하지 않는다. 전체 W7-01..14·고급 선택/편집/renderer·Apple/Linux 실제 code와 물리 입력/IME/reader·성능/scanout·배포/서명/clean-machine·독립 GPU drain 경계는 ACTIVE/PARTIAL이다.

## 9.31 Web 실제 raw 입력·활성 View·startup/KeyData 채널 — 관련 세션 OPEN / 전체 PARTIAL

Web SDK가 실제 DOM key/code/location/keyCode/modifier를 ViewRuntime → FrameworkRoot → 동일 KeyEventManager의 동기 raw entry로 전달한다. 공개 async raw 채널 entry도 같은 processor를 사용한다. Core Root는 ServicesBinding의 단일 기본 KeyMessage router에 등록되며 View focus/down/key에서 소유권을 선택한다. 사용자 KeyMessage/legacy RawKeyboard handler를 등록 때 덮어쓰지 않고, 이전 View의 held key를 정리하며 focus loss/retire 뒤 다른 View로 임의 fallback하지 않는다. standalone Root도 실제 raw/manager를 소유한다. raw listener·모든 normalized callback·Focus를 하나의 HardwareKeyboard message 경계로 묶어 재진입을 상태 변경 전에 거절하고, focus loss의 raw/queued/modern 정리를 메시지 뒤로 미룬다. 기존 transport compatibility flags와 실제 Web key label도 유지한다. sample/template의 deprecated onKey와 Raw down callbacks 표시를 실제 연결했다.

HardwareKeyboard.syncKeyboardState는 실제 optional `flutter/keyboard` StandardMethodCodec getKeyboardState를 사용한다. 원본처럼 snapshot을 기존 pressed map에 추가하고 미지원 null은 보존한다. 잘못된 snapshot의 원자적인 검증과 늦은 owner 응답 거부는 adaptation이다. ServicesBinding은 이 동기화 뒤 raw 채널/PlatformDispatcher.onKeyData를 등록한다. onKeyData는 실제 ChannelBuffers `flutter/keydata` listener로 고정 원본의 little-endian 여섯 word header와 UTF-8을 해독하고 한 byte handled 응답을 보낸다. 원본이 읽지 않는 header word48은 유지하며 deviceType을 추측하지 않는다. DataView offset·exact-number domain·malformed packet·오류 false 응답과 callback context 차이를 명시했다. SDK Windows/Android의 focus gained 전달은 구현·typecheck했지만 native raw metadata 입력은 아직 미연결이다.

새 Core 계약13, raw26·dispatch16·keyboard/Actions17 회귀, Core/SDK build와 공통 types가 PASS다. 실제 Chromium147/CanvasKit UI에서 DOM raw → deprecated Focus callback count와 기존7 입력 흐름/errors[]를 확인했고 현재 Core dispatcher/ViewRuntime/SDK browser module 및 sample snapshot을 대조했다. 마지막 engine listener 변경 뒤 새 Web 후보를 다시 빌드해 검증했다. 초기 제어 fixture의 any-side modifier 수와 KeyData 필수 field 오류는 별도 실패 log로 보존하고 원본에 맞게 fixture를 고쳤다. native 실행/physical/IME/reader 증거로 올리지 않는다.

startup2 source bindings와 현재35 compiler anchors를 검토하고 independent audit에서 현재8,719 destination hashes·182 exportSource hashes·engine dispatcher/endianness exact Git bytes·직접 emitted raw15 modules·sample/template mirror를 확인했다. 과거63 envelopes는 그대로이며 현재64 envelopes/692 selections다. 74,297 rows는 missing65,576·partial2,681·adapted6,022·implemented7·notApplicable11이다. 새 class 전체나 W7-04 완료로 올리지 않았다. 증거는 `.tmp/work7/keyboard-dispatch/raw-ingress-contracts-result.json`, `raw-ingress-*-regression-result.json`, `web-raw-keydata-ui-result.json`, `raw-ingress-audit-result.json`과 checkpoint/resume에 기록했다.

다음은 실제 Windows/Android raw native fields·SDK route와 startup snapshot provider, global pointer/semantics 등록·device/layout/locale/deadkey/menu 및 related native/cohort 통합이다. 공개 FocusManager.registerGlobalHandlers 전체를 keyboard-only adapter로 대체하지 않았다. 이전 설치 Core0.15/Windows2a5d46은 과거 byte 범위이며 새 관련 source 공급·세 runner 설치 검증은 연관 구현을 묶은 session/I2 지점에서 수행한다. 전체 W7-01..14와 Apple/Linux 실제 native code·전용 native 검증 SKIPPED/provider notVerified, 물리 입력/reader/성능/scanout/배포/서명/clean-machine/독립 GPU drain 미수락 경계를 유지한다.

## 9.32 Android 실제 raw protocol3·modern 배치·native 개발 흐름 — 관련 세션 OPEN / 전체 PARTIAL

Android native host protocol3에 실제 getUnicodeChar()/getUnicodeChar(0)·scan/key/device/source/flags·vendor/product/availability와 두 문자 projection을 연결했다. 고정 엔진 CharacterCombiner를 앱 소유 Kotlin helper로 이식하고, 원본 raw는 down/up·modern은 down에서만 독립적으로 진행하는 차이와 Java Character의 UTF-16/NUL 동작을 유지한다. native focus gained/lost를 같은 sequence에 전달하고 focus/retire 때 두 combiner와 대기 입력을 초기화한다. source raw의 scanCode0 ID 충돌은 유지하며, 원본 modern responder처럼 keyCode opaque physical identity로 구분한다. 실제 RawKeyEvent와 modern host 정규화를 한 KeyMessage로 묶었고 한 번만 사용할 수 있는 message scope로 상태 갱신·전파·focus loss 정리를 연결했다. old protocol2 snapshot은 수신 전에 거부하며 raw를 지원하지 않는 기존 controller에는 실제 기존 transport를 전달한다.

Core/SDK 계약9와 고정 Java 원본 대비 JVM combiner 제어9·Core13/raw26/dispatch16/keyboard17 회귀가 PASS다. Core/SDK build·공통 types와 현재 shared Core의 Web7 흐름이 통과했다. 실제 Android development APK(HBC96/808 source)의 Core/SDK/sample JS9 hashes 및 Kotlin6 inputs, native helper/fields와 Engine2013 notice를 대조했다. APK SHA는 `4c9fbcb5dfa6359c5a8294dd87fb7494cd268a9e735b985543c946a1ee81d0f1`이다. 원래 emulator5554/API33/x86_64에서 raw callback count·가상 scanCode0 CtrlK·early/focus/late·capture toggle·route reset·기존 Actions/Enter·virtual touch 표시가 PASS-development-native-scoped이며 오류 log가 없다. 실제 screenshot을 확인했다. 물리 키보드/dead-key/keymap/IME/reader나 독립 GPU drain 수락은 아니다.

처음 Gradle 개발 override는 included build에 app이 없어 실패했고, 이후 Java/Kotlin source root 변경도 설치 SDK source를 함께 수집해 duplicate declaration으로 실패했다. 실패 로그를 보존하고 해당 runner의 KeyboardHost 및 새 helper 두 파일만 allowlist로 임시 교체했다. 기존 native5 files를 모두 backup/hash 대조하고 빌드 뒤 정확히 복원·새 helper만 제거했다. 현재 설치 archive는 과거 SDK0.19/protocol2이며 이번 APK의 명시적인 workspace development 소비와 구별한다. SDK 자체에도 exact2013 Engine license와 inventory를 추가했고 APK에는 동일한 Core notice가 이미 포함돼 있다. 새 버전/provider/range/template/lock·정식 공급은 관련 Windows/native 통합과 함께 수행한다.

출처 검토는 source3 records와 현재22 anchors를 갱신했고, 현재65 envelopes/692 selections·8,720 destination hashes·182 exportSource hashes다. 이전64 envelopes는 보존했다. 전체74,297 rows는 missing65,575·partial2,681·adapted6,023·implemented7·notApplicable11이며 class 전체나 W7-04 완료로 올리지 않는다. current proof는 `.tmp/work7/keyboard-dispatch/android-review-result.json`, `android-raw-character-contracts-result.json`, `android-character-contracts-result.json`, `android-raw-candidate-result.json`, `android-raw-ui/result.json`, overlay restoration과 checkpoint에 있다.

다음은 Windows 실제 native key/character pairing과 startup snapshot provider, global pointer/semantics 등록·device/layout/locale/deadkey/menu 및 related cohort 통합이다. RNW public ComponentView의 KeyDown/KeyUp/CharacterReceived와 실제 parent canvas focus 경계를 사용해야 하며 native 문자·scan/device를 JS에서 추정하지 않는다. 현 Windows pointer port1/header/supplier는 이번에 변경하지 않았다. 전체 W7-01..14·Apple/Linux 실제 native code와 전용 native 검증 SKIPPED/provider notVerified·고급 선택/편집/renderer·물리/reader/성능/scanout/배포/서명/clean-machine/전체 notices/독립 GPU drain은 ACTIVE/PARTIAL이다. 소유 Android 앱만 force-stop했고 기존 emulator와 모든 실패/과거 증거를 보존했다.

## 9.33 Windows 실제 raw key/character·scanCode0 modern 입력·native 개발 흐름 — 관련 세션 OPEN / 전체 PARTIAL

RNW의 실제 focused canvas parent KeyDown/KeyUp/CharacterReceived와 focus gained/lost를 native keyboardVersion1으로 연결했다. 실제 OriginalKey·scan/extended/repeat·modifier down state·lock toggle과 UTF-16 문자 pairing을 전달하며 focus/retire 때 대기 입력을 버린다. key/focus는 View generation과 같은 sequence를 사용하고 SDK는 stale/reordered packet을 거부한다. standard JS key callback은 raw canvas에서만 꺼 중복을 막으며 native editor sibling과 Tab 정책을 유지한다. pointer port1의 실제 owner transient Unmounted/remove-reinsert 보존과 strong input source/token 수명을 유지했다. native handled/redispatch/menu 정책 전체는 아직 미구현이다.

고정 엔진 Windows source7 files와 physical157/logical121/scan override18의296 entries를 직접 module로 연결했다. 실제 Windows 자동 CtrlE에서 scanCode0/modifiers0x18이 관측됐고 고정 원본 fallback의 Windows-plane0 physical 충돌 때문에 modern tap sequence가 ControlLeft로 남는 문제가 재현됐다. 공개 raw data와 정확한 engine lookup은 유지하며 modern host adapter의 scan0에만 Windows-plane+실제 keyCode opaque ID를 사용했다. 원본 Windows native fallback과 다른 adaptation이며 USB 위치를 추정하지 않는다. Shift의 native scan 매핑 실패 시 실제 OriginalKey를 보존한다. native DeviceId가 빈 RNW 구현에서 hardware ID를 만들어 넣지 않았다.

Core/SDK 제어9·실제 제품 C++ pairing kernel MSVC8·공통 Core13/raw26/dispatch16/keyboard17 회귀와 build/common types가 PASS다. 현재 개발 Windows EXE SHA `80c41b212bd5fdb167bea9a005cb72bca29b684cb37317eb1b4a677c7c15a02c`는 실제 C++ 재컴파일/link·Hermes99/809 sources 및 JS8/native headers2 hashes를 대조했다. 실제 앱의17 관측 흐름에서 q/ShiftQ·Ctrl early/focus/late·capture 해제·route reset/minimize-restore 후 단일 CtrlK·editor q/첫 canvas 클릭·Actions override/Enter/Space/pointer/hover/titlebar exit/Tab/reentry를 확인했다. screenshot을 직접 확인했고 접근성 assertions와 image hashes를 검사했다. capture 해제와 focus restore의 두 snapshot은 접근성 텍스트가 직전 Control edge를 표시했으므로 최종 상태는 screenshot 관측으로 명시했다. held-key focus-loss native 동작·물리 키보드/layout/dead-key/IME/reader 수락으로 확대하지 않는다.

개발 빌드는 explicit workspace Metro roots와 native 두 header allowlist overlay를 사용했고 매번 원본 Metro/header bytes를 복원하고 소유 added helper만 제거했다. 초기·진단·수정 후보와 모든 실패 기록을 보존했다. `portable-metro-map`의 explicit workspace 경로 inventory 거부를 stack으로 확인했고 guard를 완화하지 않았다. 따라서 개발 EXE 증거이며 supplied archive/cohort/portable 수락이 아니다. Core/RN 자체 package에 정확한 Engine2013 notice를 보존했다. 소유 Windows 앱은 정상 종료했고 원래 emulator와 다른 앱은 유지했다. 프로세스 종료는 GPU drain 증거가 아니다.

현재30 compiler anchors와8,720 destination hashes·182 exportSource hashes를 independent audit했다. 이전65 evidence envelopes를 보존하고 현재66 envelopes/692 manifest selections이며 engine-only 작업에 가짜 framework row를 추가하지 않았다. 전체74,297 rows의 missing65,575·partial2,681·adapted6,023·implemented7·notApplicable11은 그대로다. class 전체·W7-04·관련 세션 전체 완료로 올리지 않았다. 증거는 `.tmp/work7/keyboard-dispatch/windows-zero-scan-contracts-result.json`, `windows-key-kernel-result.json`, `windows-qualified-native-result.json`, `windows-raw-ui/result.json`, `windows-review-result.json`, `windows-audit-result.json`과 checkpoint/resume에 있다.

다음은 native startup snapshot providers와 공개 KeyboardListener/RawKeyboardListener, 실제 global pointer/semantics registration·device/layout/locale/deadkey/menu를 연결하는 것이다. keyboard-only registerGlobalHandlers를 전체 원본 이식으로 표시하지 않는다. 새 Core/SDK/Skia API·native protocol을 related session/I2에서 version/dependency/provider/range/template/lock/sixarchives 및 세 runner 설치 증거와 묶어 이행한다. 현재 version tag와 이전 supplied Windows2a5d46/Android/Web 증거는 이전 byte 범위이며 새 workspace 수락과 구별한다. 전체 W7-01..14와 고급 선택/편집/renderer·Apple/Linux 실제 native code(전용 native build/run/harness SKIPPED/provider notVerified)·물리/reader/성능/scanout/서명/배포/clean-machine/전체 notices/독립 GPU drain은 ACTIVE/PARTIAL이다.

## 9.34 공개 KeyboardListener/RawKeyboardListener·앱 소유 raw state — 관련 세션 OPEN / 전체 PARTIAL

고정 원본의 두 listener 위젯과 private raw state 수명을 직접 module로 이식했다. KeyboardListener는 실제 StatelessWidget/Focus wrapper이고 modern focus event를 관찰한 뒤 항상 ignored를 반환한다. deprecated RawKeyboardListener는 실제 StatefulWidget으로 FocusNode.hasFocus 동안 앱 raw keyboard를 구독하고 node 변경 시 notification을 재연결하며 현재 callback을 사용하고 dispose 때 해제한다. raw callback은 modern focus 전 실행되므로 early/focused handler가 소비한 메시지도 관찰한다. source의 initState/didUpdateWidget은 즉시 focus 상태를 다시 대조하지 않는 시점을 보존했다. KeyEvent/RawKeyEvent는 직접 service module로 import하며 Dart reexport facade를 만들지 않았다.

BuildOwner가 ServicesBinding의 RawKeyboard를 빌리거나 standalone raw 하나를 소유하고 FrameworkRoot가 같은 instance를 사용하도록 연결했다. widget이 process default ServicesBinding에 의존하지 않으므로 standalone Root와 여러 앱을 구분한다. Root는 private manager를 먼저 닫고 widget/global-key 정리 뒤 BuildOwner가 private raw를 닫으며 borrowed 앱 raw는 View가 닫지 않는다. sample/template의 실제 두 listener가 `Listener raw`·`modern` 계수를 표시한다.

현재 emitted Core6의 observer ignored/ancestor 전파·raw-before-modern 순서·focus attach/detach·새 closure callback/노드 교체·제거·독립 Root/앱 격리·borrowed owner 유지와 기존 Core13/raw26/dispatch16/keyboard17 회귀가 PASS다. Core build/common types도 통과했다. 실제 Chromium147/CanvasKit 개발 Web9 흐름과 source snapshots17개를 대조했다. q의 raw1/modern1, early/focused 소비 뒤 raw/modern 계수 차이, route dispose/reentry 및 기존 Actions를 확인했고 오류가 없으며 screenshot도 확인했다. 잘못된 fixture focus context·receipt 출력·약한 callback capture를 수정한 로그를 보존했다. Windows EXE80c41b/Android APK4c9fbc는 이 shared owner/sample 변경 전의 byte 범위로 보존하고 현재 native listener 수락으로 확대하지 않는다.

exact Git 두 source files/29 public-private bindings와272 기존 compiler anchors를 검토했다. 과거 상속 target94개의 선언 소유자가 모호했으므로 변경 전 framework.ts bytes를 explicit patch의 역변환으로 복원하고 checkpoint SHA `5649ef865195f17494d31e9c0fb947ad9c8903aab4b36bc4f942a74c23741369` 일치를 확인한 뒤 실제 inherited owner/현재 AST 위치를 명시했다. 원래 source binding과 runtime 경계는 유지했다. independent audit에서 current8,749 destinations/182 exportSource hashes·두 direct emitted modules·template/Web17 hashes를 확인했다. 이전66 envelopes는 그대로이고 현재67 envelopes/695 manifest selections다. 전체74,297 rows는 missing65,546·partial2,684·adapted6,049·implemented7·notApplicable11이며 public/private class 전체·W7-04·관련 세션 완료로 올리지 않는다. 증거는 `.tmp/work7/keyboard-dispatch/listener-contracts-result.json`, `listener-core-regressions-result.json`, `web-listener-ui-result.json`, `listener-review-result.json`, `listener-audit-result.json`과 checkpoint/resume에 있다.

다음은 실제 native startup snapshot provider, global pointer/semantics registration·device/layout/locale/dead-key/menu·native handled/redispatch 정책과 related cohort 통합이다. 여전히 새 버전/provider/range/template/lock/sixarchives·세 runner current 설치 수락은 관련 구현을 묶어 session/I2에서 수행한다. 전체 W7-01..14 및 Apple/Linux 실제 native code·전용 native build/run/harness SKIPPED/provider notVerified·고급 선택/편집/renderer·물리/IME/reader/성능/scanout/배포/서명/clean-machine/전체 notices/독립 GPU drain 범위는 유지한다. 새 native 빌드/설치와 archive 반복을 이 작은 후속 단계마다 재실행하지 않았다.

### 9.35 W7-04 native 관찰 상태 조회·현재 3 runtime 연결 — 전체 ACTIVE / PARTIAL

Windows React property bag과 Android React module에 focused canvas별 관찰 registry를 연결했다. 실제 keyCode/scanCode를 기록하고 focus 이관·늦은 이전 owner 입력·첫 down의 layout·복사 snapshot·1024개 한도·retire를 처리한다. SDK는 ServicesBinding.ready 전에 실제 `flutter/keyboard` StandardMethodCodec provider를 등록하고 Core 직접 key-map으로 변환한다. OS 전체 held-key나 엔진 전체 critical-key/pressing-goal 알고리즘은 이식 완료로 표시하지 않았다. 같은 RN 컨텍스트를 공유하는 다수 SDK bootstrap 격리는 미수락이다.

실제 C++7/Kotlin7 kernel과 실제 built-in plugin/codec/Core startup9 제어 검사, Core/SDK build 및 common types가 PASS다. Windows EXE5fc2e65a(HBC99/812sources)는 현재 JS15/header5와 연결되며 실제 native query0·q/ShiftQ·capture/focus/fallback·해제 뒤 query0·route reset/reentry·Actions/Enter11 흐름을 확인했다. Android APK33d27383(HBC96/813sources)는 현재 JS15/Kotlin7과 연결되며 원래 emulator5554/API33/x86_64의 query0·listener/phase·capture toggle/reset·Actions/Enter9 흐름과 filtered pid log를 확인했다. Web10 흐름/17현재 source hashes는 optional query unavailable과 기존 listener/Actions를 통과했다. 화면도 검토했다. native UI의 nonempty held-state와 물리 입력 수락은 없으며 nonempty는 제어 검사 범위다.

Windows header5/Metro와 Android original5 files를 정확히 복원하고 추가 helper를 제거했다. 초기 Android Gradle 경로 오류는 native compile 전 실패였고 고친 고유 retry가 통과했다. nativeLocale 없는 SDK fixture 실패와 기존 원본/실패 로그·backup·retained EXE/HBC는 보존했다. Windows portable map guard의 workspace 경로 거부를 완화하지 않아 development native 증거이며 supplied archive 수락이 아니다. 소유 Windows 앱 종료/Android 앱 force-stop/Web 종료와 원래 emulator 보존은 GPU drain 증거가 아니다.

고정 pin의 엔진11 files를 재확인하고 기존67 envelopes/695 selections/8749 destinations/182 export anchors를 유지한 채 provider partial envelope68을 추가했다. framework 행 상태는 바꾸지 않아 missing65546·partial2684·adapted6049·implemented7·notApplicable11이다. Core/SDK 영한 안내와 Windows native 안내, sample/template를 동기화했다. 새 버전·provider/range/peer/lock·6 archives 공급은 연관 세션/I2에 묶는다. 현재 package tags는 이전 supplied 범위다.

**다음:** 실제 global pointer/semantics registration과 pointer event/router 의존성·device/layout/locale/dead-key/menu/full native handled/redispatch, Apple/Linux 실제 code 및 W7-01..14 잔여를 계속한다. Apple/Linux 전용 native build/run/harness는 SKIPPED/provider notVerified다. 세션은 OPEN이며 물리/IME/reader·성능/scanout·서명/외부 소비/clean-machine/전체 notices·독립 GPU drain과 전체 W7 완료는 미수락이다.

### 9.36 W7-04 실제 global 입력 등록·semantics action·DOM focus 연속성 — 전체 ACTIVE / PARTIAL

PointerRouter의 pointer별/global snapshot·즉시 remove·다음 event부터 add·변환·오류 격리를 구현하고 실제 Root pointer/cancel 경로에 연결했다. transport PointerEvent의 x/y·delta 변환이며 전체 source event 계층은 남는다. caller matrix capture/all-mode guard/debug count와 source helper 결합을 adaptation으로 명시했다. SemanticsAction26 IDs·fromIndex·원본 values 순서/고정 길이, copyWith의 omitted/null/undefined 구분을 갖는 SemanticsActionEvent와 실제 semantics listener/ByteData dispatcher를 직접 module로 추가했다. 기존6개 transport action string은 별도 계약으로 유지한다. full SemanticsBinding의 enablement/features/builders는 미구현이며 class는 partial이다.

FocusManager.registerGlobalHandlers는 명시적인 View port로 실제 keyboard/pointer/semantics 세 경로를 등록하고 실패 rollback·독립적인 retire를 수행한다. Root는 실제 앱 keyboard delegate와 연결해 기존 tri-state/native fallback 및 사용자 handler patch를 유지한다. Focus widget의 semantics callback은 global dispatcher를 거쳐 focus를 요청한다. SDK native control의 실제 pointer/touch와 노출된 custom accessibility focus action은 살아 있는 현재 node/geometry/owner를 확인하고 observer로 전달하며 canvas hit-test를 중복 실행하지 않는다. 물리 device identity나 일반 native focus의 IME/accessibility 원인을 추정하지 않는다.

Web 실제 DOM focus 뒤 keyboard가 빠지는 오류를 찾았다. canvas와 semantics control의 부모가 달라 첫 부모 listener가 입력을 받지 못했다. 공통 입력 영역과 실제 element membership으로 고쳐 다른 소유자의 control을 거른다. native text-field focus/편집은 별도 editing 경로다. 실제 Chromium147/CanvasKit에서 DOM semantics focus → touch 표시 → q/traditional → CtrlK Actions, 같은 영역의 foreign control 무시 → 소유 control 복귀 단일 호출을 포함한14 흐름/23현재 source hashes·오류0과 screenshot을 확인했다. 초기 잘못된 button role fixture와 실제 lost-keyboard 실패를 보존했다.

새 계약13 cases와 기존 Core raw/modern/listener/highlight/mouse91 cases, Core/SDK build·common types가 PASS다. 원본7 files/선정87 records/기존152 anchors를 독립 감사했다. 기존68 envelopes를 보존하고69번째를 추가했으며 manifest700·8834 destinations/182 exports다. coverage74,297은 missing65,461·partial2,686·adapted6,132·implemented7·notApplicable11이다. source class는 모두 partial이며 source _k bit constants/argument sentinel/helper 결합과 source binding lookup의 owner-port 이행을 명시했다.

370 이전 제품을 보존하고 새 direct modules/native control helper/기존 Android editor 소비 파일까지375 hashes를 checkpoint에 기록했다. 현재 package tags와 이전 Windows5fc2e65a/Android33d27383 native UI는 이번 Root/focus/SDK 변경 전 범위다. 이번 변경의 current native-control/reader/physical 및 새 cohort/archive 수락으로 확대하지 않는다. helper마다 native build·6 archives를 반복하지 않고 다음 연관 입력/장치 통합에 묶는다.

**다음:** 전체 pointer event/gesture binding·device/cursor/semantics enablement 의존성과 keyboard layout/locale/dead-key/menu/full native handled/redispatch, Apple/Linux 실제 code 및 W7-01..14 잔여를 계속한다. 관련/I2에서 versions/provider/range/peer/template/locks/6 archives와 현재 Windows·Android·Web 설치 통합을 수행한다. Apple/Linux 전용 native build/run/harness SKIPPED/provider notVerified, 물리/IME/reader·성능/scanout·배포/서명/clean-machine/전체 notices·독립 GPU drain은 미수락이다. 세션 OPEN/전체 ACTIVE·PARTIAL을 유지한다.

### 9.37 W7-04 concrete pointer 계층·물리 데이터 변환·현재 Web wheel 응답 — 전체 ACTIVE / PARTIAL

15 concrete contact/hover/enter/exit/signal/panzoom class와2 abstract bases,3 UI enums·PointerData/packet,DeviceGestureSettings·20 constants·Converter·SignalResolver를 실제 code로 추가했다. global position/delta와 lazy local coordinates/canonical original·변환 교체·copy/factory field 생략·responder receiver를 보존한다. Dart private transformed/copy mixins는 실제 public prototype factory/WeakMap state·concrete copy method로 접으며 inherited getter owner를 명시했다. matrix snapshot·53-bit button mask·milliseconds/문자 View ID·packet batch snapshot·stable local hash·subclass-safe freeze와 resolver reentry/finally 강화를 adaptation으로 기록했다. 원본 VM62/web32 bitfield 파일도 보존하며 같은 수치 의미로 주장하지 않았다.

Root/Focus/PointerRouter·MouseTracker/MouseRegion의 실제 소비를 Source class로 이행했다. `.kind`는 device enum, `.position`은 global, `.localPosition`은 변환된 좌표다. 기존 logical DTO는 별도 adapter로 받고 hit entry가 global position/local transform/View ID를 보존한다. native metadata가 없으면 source default를 유지하며 physical device/pressure 관찰을 발명하지 않는다. Core/SDK 문서에 external API migration을 명시했으며 새 cohort 공급은 아직 없다.

실제 Sourceevent14 cases·data/converter/resolver12 cases·global13 cases·기존 영향 회귀91, Core/SDK build·common types와 strict direct dts 소비가 PASS다. 일반 exact instance만 freeze해 source subclass의 field 추가를 막는 오류도 보완했다. Converter는13 source branches, lazy repeatable iteration, 실제 DPR/radius/pan/scroll scaling, missing View/unknown signal/invalid scroll 정책과 callback owner를 확인했다. 이는 native raw packet codec/관찰 수락이 아니다. Resolver는 실제 canonical first-registration-wins/default 응답/오류 후 해제를 확인했으나 전체 GestureBinding 연결은 남는다.

현재 Chromium147/CanvasKit16 흐름·29 exact source inputs와 errors0을 확인했다. DOM focus/외부 owner 격리/기존 raw/Actions에 더해 trusted 실제 wheel에서 미처리 이벤트는 native default 허용, viewport resize 뒤 Root가 실제 scroll한 event는 default 차단을 확인했다. screenshot도 검토했다. Root의 기존 handled-wheel Boolean bridge이며 source signal resolver/전체 GestureBinding 통합이나 native wheel ack 수락으로 확대하지 않는다. 초기 source constant-count·direct diagnostic import/optional type/FlagProperty 오류와 release-mode 진단 fixture 실패를 보존했다.

원본9 files/선정395 records와 기존167 anchors를 독립 감사했다. 기존69 envelopes 보존/current70·manifest804·9224 destinations/182 exports다. coverage74,297은 missing65,071·partial2,740·adapted6,468·implemented7·notApplicable11이며 class/mixin/enum은 partial이다. engine2013 notice SHA89519eca…를 유지하고 license inventory의 UI key/pointer/semantics scope를 보강했다. 375 이전 제품과 새7 module을 포함한382 현재 hashes를 기록했다.

**다음:** actual raw native packet/platform dispatcher·전체 GestureBinding/Listener/recognizers/resampling/signal routing·device/cursor/gesture settings와 semantics enablement, keyboard layout/locale/dead-key/menu/full native handled/redispatch·Apple/Linux 실제 code 및 전체 W7-01..14를 계속한다. 관련/I2에서 version/provider/range/peer/template/lock/6 archives/현재 WindowsAndroidWeb 설치를 통합한다. Windows5fc2e65a/Android33d27383 native UI는 이전 byte 범위다. Apple/Linux 전용 native build/run/harness SKIPPED/provider notVerified, 물리/IME/reader·성능/scanout·서명/배포/clean-machine/전체 notices·독립 GPU drain은 미수락이다. 세션 OPEN/전체 ACTIVE·PARTIAL을 유지한다.

### 9.38 실제 Pointer dispatch·Listener·resampling·signal·앱 View packet 묶음

**목표 결과:** 실제 contact/hover/signal이 `HitTestResult → Listener/render target → Binding 최종 target → global route/arena/signal resolver`로 이어진다. Root의 별도 보관 path를 제거하고 GestureBinding 하나가 입력 큐·lock·경로 보관/변환·cancel·owner 종료를 소유한다. 이 선택된 세션 목표는 완료했으며 **전체 W7 ACTIVE/PARTIAL**이다.

**구현:** direct `framework/gestures/hit-test`·`resampler`·`binding`·`framework/rendering/pointer-listener`·`framework/widgets/listener`를 추가했다. HitTestResult의 wrap-shared 변환 스택과 frozen path snapshot, 실제 marker mixin, SourcePointerEventResampler의 보간·future/early-up/hover-buttons/stop quirks, source -38ms/16.667ms clock·scheduler·timer 연결을 구현했다. Root는 down path/transform을 유지하고 target을 먼저 호출한 뒤 전역 route를 전달한다. BuildOwner는 실제 Root binding을 빌리며 standalone owner가 비어 있는 View provider를 만들지 않는다. 기존 GestureDetector/recognizers는 명시적 logical DTO 어댑터를 사용하고 MouseRegion hover는 실제 source handleEvent를 받는다.

`Listener(child, {behavior: HitTestBehavior.opaque, onPointerDown, onPointerSignal, …})`와 RenderPointerListener의 구체 callback·hit behavior·no-child layout·진단/갱신을 연결했다. SingleChildScrollView/LazyList는 이동 가능성을 먼저 검사하고 resolver가 선택한 뒤에만 스크롤하므로 가까운 Listener가 우선할 수 있다. 기존 gesture-detector Listener와 사용자 Boolean wheel callback은 deprecated/synchronous compatibility 경로이며 Source signal API와 동일하다고 주장하지 않는다.

logical touch의 공개 physical device는 관찰하지 않은 기본값0을 유지하고 내부 opaque stream key로 독립 resampling한다. 프로그램 cancelPointer도 기존 stream key와 source 기본 timestamp0을 사용한다. 원래 키가 빠져 sampler/timer가 남을 수 있었던 경로를 수정했고 native up·owner dispose 없이 두 contact 취소 후 timer가0임을 확인했다. hide/dispose는 unsampled admissions를 버리고 살아 있는 경로를 취소하며 queued frame/timer 재시작과 오래된 dispatch slot을 막는다. target/renderer detach와 hidden View 입력도 차단한다. signal 처리 중 오류 reporter가 던져도 해당 canonical signal의 선택을 정리한다.

PlatformDispatcher의 typed `onPointerDataPacket`·`onHitTest`와 HitTestRequest/Response를 앱 ServicesBinding에 연결했다. 실제 View delegate와 DPR를 admission 때 capture해 A1→B1→A2 순서, 중간 retire/같은 ID 재등록 거부, nested packet queue, 공개 callback 교체 보존을 구현했다. HitTestView는 실제 ID를 가진 최소 port이고 전체 FlutterView는 아니다. HitTestEntry의 실제 native marker 결과를 확인하며 **native binary PointerData codec/생산자는 미연결**이다. public packet/hit request/response subclass가 추가 field를 초기화하도록 정확한 기본 instance만 freeze하고 packet batch snapshot은 유지했다.

**검증:** Core dispatch/transform/sampler17 + mounted Root/app packet12 + cancel/API4 + public UI subclass1 = **34** 제어 groups, current global13과 이전 영향 회귀91이 PASS다. Core/SDK build·공통 types·strict NodeNext direct declaration 소비가 PASS다. 실제 Chromium147.0.7727.15/CanvasKit **24 flows/40 exact current source inputs**, errors[]에서 target-before-global, 영역 밖 release, 두 browser touch의 sampling/release, 첫 signal 소비/부모 scroll, 종료·재진입과 기존 raw/modern/Actions/DOM owner/휠 기본 동작을 확인했다. 결과 screenshot을 시각 확인했다. 마지막 public UI freeze refinement 전33-case snapshot은 보존했고 별도 현재 subclass/admission 증거와 현재 Web40로 constructor delta를 확인했다.

초기 Core timer-global compile, source timing/order/response fixture, 없는 npm script, 복사 fixture/oracle 누락, 서로 다른 View에 같은 ID를 준 이전 keyboard fixture, Actions→Keyboard lab→home navigation 실패는 보존했다. 테스트는1200s timeout을 사용했고 같은 시나리오 수백 회 검증은 하지 않았다. Source/API가 바뀐 영향 범위만 재확인했으며 native/6 archive를 helper마다 재공급하지 않았다. 모든 실행 handle은 terminal이고 owned browser/server는 종료했다. 원래 emulator5554와 이전 native 후보/실패 binary/overlay 복구 증거를 보존했다.

**출처·현재 상태:** pin71e4717a…의 source6 파일과 **179 exact public/private spans**, 현재 AST/helper/inherited owner를 검토하고 **544 기존 anchors**를 갱신했다. 바뀐 inherited destinations445개는 실제 TypeScript checker의 선언 owner를 따라가며 이전 export 이름을 가짜 body로 만들지 않았다. abstract interface ctor3개와 process singleton2개는 missing으로 남겼다. 독립 감사에서 **71 envelopes / 838 manifest selections / 9,395 current destination hashes / 181 export-source hashes**가 일치했고 이전70 envelopes/804 manifest prefix를 그대로 보존했다. 총74,297 rows는 missing64,900 / partial2,756 / adapted6,623 / implemented7 / notApplicable11이다. 모든 class/mixin/enum은 partial이다. Core/SDK 양 언어 API·owner·증거 안내를 갱신하고388 현재 제품 hashes를 checkpoint에 기록했다. full2013 engine notice와 기존 source/supplier 기록을 보존했다.

**이어서:** 실제 native PointerData 생산자/codec, 전체 pinned arena/recognizers/GestureDetector·cursor/device/settings·semantics enablement/accessibility, keyboard native handled/redispatch/layout/IME/menu, Source singleton/BindingBase/debug margin 및 전체 W7-01..14를 계속한다. 관련/I2에서 versions/provider/range/peer/template/locks/sixarchives와 현재 WindowsAndroidWeb 설치를 통합한다. Core0.15/SDK0.19/Skia0.5/MetroCLI0.9 supplied tags와 Windows5fc2e65a/Android33d27383 native receipts는 이전 범위다. Apple/Linux 실제 code는 필요하며 전용 native build/run/harness SKIPPED/provider notVerified다. 물리/reader/timing/FPS/scanout·서명/배포/clean-machine/전체 notices·독립 GPU drain은 미수락이다. 이전 checkpoint는 frozen이고 이 세션의 `checkpoint.json`·`resume-progress.md`가 현재 resume 지점이다.

### 9.39 실제 Flutter arena·team·debug와 tap/drag 소비 연결

**목표 결과:** 이전 Doroti의 동기/Boolean arena를 고정 Flutter의 실제 GestureDisposition·GestureArenaEntry·GestureArenaManager로 바꾸고 같은 Root/BuildOwner manager를 기존 실제 소비 경로에 연결했다. `GestureArenaTeam`과 debug flags도 실제로 동작한다. 선택된 세션 목표는 완료했으며 **전체 W7 ACTIVE/PARTIAL**이다. 전체 Source recognizer/GestureDetector 구현 완료로 확대하지 않는다.

**구현:** close의 단일 후보는 microtask에서 승리하고 hold는 sweep만 지연한다. sweep의 winner-before-losers와 explicit/eager의 losers-before-winner 순서, eager rejection, closed 후보 해소를 보존했다. entry/default callback은 실제 arena identity를 capture하여 같은 pointer/member가 재등록되어도 이전 경쟁을 건드리지 않는다. Bool resolve는 deprecated adapter이며 새 공개 소비는 GestureDisposition을 사용한다. View cancel/dispose는 소유권을 먼저 제거하고 callback 오류가 있어도 남은 rejection을 수행한다. normal source resolution 오류 순서는 보존한다.

direct `framework/gestures/team`의 실제 owner arena 주입과 first/explicit/captain/outside 경쟁을 구현했다. captain은 등록 member일 필요가 없고 첫 acceptance 때의 captain capture를 보존한다. concrete team entry는 실제 resolver-backed Entry를 상속하며 source private storage/interface 차이는 명시적인 captured resolver로 대응한다. outer winner 처리 중 loser 예외로 arena가 먼저 제거된 뒤 남는 combiner도 team.dispose에서 닫고 모든 member를 reject한다. 별도 가짜 manager나 GestureBinding singleton은 만들지 않았다.

direct `framework/gestures/debug`의 GestureDebug static fields는 Dart mutable global의 ESM adapter다. 실제 arena·Binding hit/hover/resampling margin이 flags를 소비하며 release/profile에서는 출력과 member formatting side effect가 없다. `debugAssertAllGesturesVarsUnset`은 고정 원본이 hover flag를 검사하지 않는 동작을 보존했다. margin 출력은 명시적 milliseconds text다. recognizer callback trace는 실제 flag/reset assertion까지 제공하며 invokeCallback 소비는 다음 recognizer 범위다.

기존 TapDragRecognizer는 accepted와 dragging을 분리했다. arena 기본 승리 뒤 작은 움직임을 tap으로 유지하고 실제 slop을 넘기 전 drag/fling을 호출하지 않는다. Root의 nested tap/parent drag가 하나의 실제 arena에서 경쟁한다. sample에 Gesture arena 화면을 추가하여 tap/drag slop, first/B/captain/outside 승패·순서와 종료·재진입을 공개 API로 소비한다. Core/SDK 두 언어 문서에 API·owner·compatibility·증거 경계를 반영했다.

**검증:** pin의 변경하지 않은 arena/team/debug class/function body를 원래처럼 분리된 Dart library에서 실행했다. Dart3.12.2 Windows VM assertions on/off 각각 **14 항목**이 TS debug/release의 callback trace와 formatting side effect와 일치했다. foundation 출력/오류·binding context는 명시적 standalone fixture이며 full Flutter/engine/native 수락이 아니다. 처음 세 body를 한 library로 합친 oracle는 private interface field 규칙으로 올바르게 compile 실패했고 실패물은 보존했다. 분리 후 원본 body suffix/hash와 library 경계를 독립 감사했다. 원본 Dart 실행은 재사용하고 최종 TS 출력만 다시 비교했다.

**12 owner/실제 소비 groups**, 영향 pointer/Root/app/cancel/global **46 groups**, current Core build·공통 types·strict direct declaration 소비가 PASS다. 실제 Chromium147.0.7727.15/CanvasKit **32 flows/45 exact current inputs**, errors[]에서 microtask 기본 승리 뒤 작은 이동/tap, slop 이후 drag/end1, team first/B/captain/outside 실제 포인터 선택, 재진입과 이전 pointer/keyboard/DOM 흐름을 확인했다. current screenshot을 시각 확인했다. duplicate apply_patch 검증 실패와 sample toString excess-property type 실패도 보존했다. 정상 winner 처리 예외 후 team retirement 보완은 별도1 group과 마지막 현재11 group 재확인으로 기록했다. 테스트 timeout은1200s이며 native/6archives는 helper마다 재공급하지 않았다.

**출처·현재 상태:** original source4 파일(3 arena/team/debug + 바뀐 Binding 소비), **68 exact spans / 47 refreshed anchors**를 검토했다. abstract GestureArenaMember의 비어 있는 constructor body는 만들지 않고 missing으로 남겼으며 모든 class/mixin/enum은 partial이다. 독립 감사에서 **72 envelopes / 852 manifest selections / 9,449 current destination hashes / 181 export-source hashes**가 일치했고 이전71 envelopes/838 manifest prefix를 보존했다. 74,297 rows는 missing64,846 / partial2,752 / adapted6,681 / implemented7 / notApplicable11이다.391 current products를 checkpoint에 기록했다. full2013 engine notice와 frozen source/supplier/native/실패 binary·원래 emulator5554를 보존했다. 실행 handle은 terminal이고 owned browser/server는 종료했다.

**이어서:** 전체 Source GestureRecognizer/OneSequence/PrimaryPointer/tap/drag/velocity/RawGestureDetector/GestureDetector와 실제 소비, native PointerData producer/codec·cursor/device/settings·semantics enablement/accessibility·keyboard native handled/redispatch/layout/IME/menu·singleton/BindingBase와 전체 W7-01..14를 계속한다. 관련/I2에서 versions/provider/range/peer/template/locks/sixarchives 및 현재 WindowsAndroidWeb 설치를 통합한다. supplied Core0.15/SDK0.19/Skia0.5/MetroCLI0.9와 Windows5fc2e65a/Android33d27383 native receipts는 이전 범위다. Apple/Linux 실제 code는 필요하며 전용 native build/run/harness SKIPPED/provider notVerified다. 물리/reader/timing/FPS/scanout·서명/배포/clean-machine/전체 notices·독립 GPU drain은 미수락이다. 이전 pointer-dispatch checkpoint는 frozen이며 이 세션 checkpoint/resume이 현재 지점이다.


### 9.40 W7-04 실제 source recognizer·tap/drag/velocity·Raw 위젯·접근성 소비

**상태:** 이 관련 세션은 완료, 전체 목표는 **ACTIVE / PARTIAL**이다. `.tmp/work7/gesture-recognizers/checkpoint.json`과 `resume-progress.md`가 현재 재개 지점이다. 이전 source/runtime/checkpoint·native binary·overlay·실패 증거는 frozen으로 보존했다.

Flutter pin의 실제 GestureRecognizer/OneSequence/PrimaryPointer, 세 enum·OffsetPair·PositionedGestureDetails와 primary/secondary/tertiary tap down/up/cancel/move를 추가했다. 실제 View binding·router·arena·team과 one-shot deadline timer를 사용한다. global strict slop·100ms deadline·primary pointer 유지 등 원본 상태 규칙을 보존하고 invokeCallback의 실제 오류 보고/debug trace를 연결했다. 종료 시 route/arena/timer를 독립 정리하며 callback/reporting 실패·callback 안의 dispose 뒤 후속 호출·stale timer를 차단한다. 원본 allocation tracing은 가짜 hook 없이 미구현/partial이다.

실제 QR least-squares·PolynomialFit과20-sample/100ms/40ms/min3 velocity history, iOS/macOS 가중치 추정을 구현했다. DragGestureRecognizer/Horizontal/Vertical/Pan은 down/start origin·axis projection·fling clamp·threshold·panzoom·latest/sum/average-boundary 다중 pointer를 처리한다. 실제 View clock/frame epoch를 주입한다. private enum은 실제 state-machine tagged union, private 상수/helper는 소비되는 알고리즘으로 접었으며 차이를 기록했다. Duration은 milliseconds다.

RawGestureDetector·constructor-token factory·state가 실제 recognizer를 같은 type/owner로 유지·초기화하고 제거/실패 시 정리한다. TS의 factory `createRecognizer()`는 Dart의 `constructor()` 명명 차이다. 실제 Source Listener가 down/panzoom을 admit하고 Binding 마지막 router가 recognizer를 호출한다. GestureDetector를 실제 tap/axis/pan 구성으로 바꾸고 기존 onDrag/onDragEnd는 pan details에 연결했다. 빈 child는 Source deferToChild에 따라 명시적 opaque가 필요하다. 실제 semantics gesture renderer·custom delegate·tap/axis/pan 기본 delegate·4방향 scroll/filter를 retained semantics와 Root action notification에 연결했다. Source SemanticsConfiguration ABI와 default long-press handler는 미구현이며 해당 범위는 partial/missing이다.

실제 Web UI에서 기존 position-only logical producer의 delta 생략으로 drag update가 누락되는 문제를 확인했다. 공통 Root에서 같은 device/viewport epoch의 관측 접촉 위치 차이로 생략된 delta만 계산한다. explicit global/per-axis delta를 유지하고 up/cancel/hide/dispose/epoch mismatch 때 이전 위치를 폐기한다. physical metadata를 만들지 않았다. Gesture recognizers 예제를 추가해 실제 button·tap details·취소·방향 drag·pan·비활성화·재진입을 소비하고 Core/SDK 두 언어 문서를 갱신했다.

**검증:** 변경하지 않은 원본 lsq_solver/velocity_tracker 알고리즘 body를 import/export directive만 교체한 별도 Dart library에서 실행했다. foundation/value/clock은 명시적 fixture다. Dart3.12.2 Windows VM assertions on/off 각각 **29 cases**가 TS debug/release와1e-8 tolerance로 일치했다. rank/confidence/weight/ring/horizon/stopped/zero-clamp NaN과 Apple 전용 수치 알고리즘을 포함하며 Apple native 수락은 아니다. 원본 body/import 차이와 pinned precisionErrorTolerance를 독립 감사했다.

현재 **25 recognizer +8 retirement/frame +4 logical ingress =37 groups**, 영향 pointer/Root/global/cancel **46 groups**, Core/SDK build·공통 types·strict direct declaration 소비가 PASS다. 실제 Chromium147.0.7727.15/CanvasKit **40 flows /54 exact current runtime inputs**, errors[]가 PASS이며 screenshot을 시각 확인했다. PositionedGestureDetails는 structural declaration 계약으로 별도 검사하고 runtime bundle 소비로 주장하지 않는다. debug-mode/부모 rebuild/float/admission 시점 등 fixture 실패, callback 이름과 State.update 충돌 type 실패, 실제 delta 누락 UI 실패, type-only snapshot 목록 실패를 모두 보존했다. 모든 실행 handle은 terminal이고 owned browser/server는 종료했다.1200s timeout과 관련 session batch를 유지하고 native/6archives를 helper마다 재공급하지 않았다.

**출처·현재 상태:** original9 source files에서 **494 exact spans /198 refreshed anchors**를 검토했다. 미구현39 후보를 missing으로 남기고 모든 class/mixin/enum은 partial이다. 독립 감사에서 **73 envelopes /912 manifest selections /9,939 current destination hashes /180 export-source hashes**가 일치하며 이전72 envelopes/852 manifest prefix를 보존했다.74,297 rows는 missing64,356 /partial2,821 /adapted7,102 /implemented7 /notApplicable11이다. 새 direct modules9개와401 current products를 checkpoint에 기록했다. full2013 engine notice3개와 frozen supplier/native binaries·실패물·원래 emulator5554를 보존했다.

**이어서:** double-tap/long-press/scale/force 등 실제 gesture family·device/cursor/settings·implicit MediaQuery/ScrollConfiguration, native binary PointerData·semantics enablement/accessibility와 전체 W7-01..14를 계속한다. related/I2에서 versions/providers/ranges/peers/template/locks/sixarchives 및 현재 WindowsAndroidWeb 설치를 통합한다. 기존 supplied Core0.15/SDK0.19/Skia0.5/MetroCLI0.9와 native Windows5fc2e65a/Android33d27383은 이전 증거 범위다. Apple/Linux 실제 code 필요, 전용 native build/run/harness SKIPPED/provider notVerified다. 물리/IME/reader/performance/FPS/scanout·배포/외부 소비/clean-machine·전체 notices·독립 GPU drain은 미수락이다.


## 9.41 실제 double/long/multi/serial/force/scale와 접촉 수명 — 세션 수락 / 전체 ACTIVE·PARTIAL

**목표 결과:** actual GestureDetector에서 double tap·long press·pinch를 사용하고 Raw factory에서 독립 multi/serial tap을 사용한다. 재사용되는 native device ID와 각 Source 접촉 identity를 구분하며, callback dispose·화면 이동에서도 보류 arena와 timer/route를 정리한다. `.tmp/work7/gesture-families/checkpoint.json`을 현재 checkpoint로 사용한다. 전체 W7-01..14 완료가 아니다.

새 direct module4개 `force-press`, `long-press`, `multitap`, `scale`에 원본 details/callback과 실제 recognizer state machine을 연결했다. LongPress는 primary/secondary/tertiary21callbacks와 실제 Primary500ms deadline·source origin/local velocity를 사용한다. DoubleTap/MultiTap/SerialTap은 실제 router/arena·40ms minimum/300ms window·held first arena·source callback 순서를 사용한다. CountdownZoned는 Dart Zone ABI 대신 실제 취소 가능한 owner timer/guarded closure로 대응한다. Scale은 원본 focal/span·raw atan2 rotation·구성 변경 end/start·fling/scale velocity·trackpad panzoom/2finger/exp factor를 사용한다. Force는 pressureMax<=1·NaN·strict threshold·squared delta 대 unsquared hit-slop·eager peak/update의 원본 특성을 유지한다. 현재 logical producer에는 raw force range가 없어 force hardware/provider를 주장하지 않는다.

GestureDetector의 source factory 순서와 pan/scale/both-axis 충돌 조건을 연결했다. 한 방향 axis와 pan은 원본처럼 허용된다. 실제 long-press 기본 semantics가 down/start/press/end/up을 생성한다. Source SemanticsConfiguration ABI·implicit MediaQuery/ScrollConfiguration·allocation tracing은 남아 있다. Root는 reusable native ID마다 접촉별 양수 Source ID를 배정하고 legacy DTO/mouse에는 native ID를 유지한다. hover/signal/orphan·native control 관측은 Source0이다. sampled copy의 실제 stream token을 복원하며 이전 접촉 cancel이 재사용된 새 접촉을 폐기하지 않는다. physical/logical allocator 혼합 cohort는 미수락이다.

In-flight owned tracker 집합을 별도로 유지해 up/cancel callback의 self-dispose에서도 detached tracker·minimum countdown·serial/double timer·held first arena를 dispose 반환 전에 정리한다. 오류 뒤에도 독립 정리를 시도하고 aggregate failure를 보고한다. source 정상 상태/순서는 유지하며 강화된 예외 정리는 adaptation으로 기록했다.

**검증:** 원본14개 별도 Dart library body는 import/export directive만 변경했다. foundation/event/value/null-transform/clock/timer/binding은 명시적 fixture이며 원본 base/Primary/arena/team/router를 실행한다. debug/release 각각24개 공유 state 시나리오가 현재 TS와1e-8 tolerance로 일치한다. 실행된 최종 bytes는 `source-oracle-qualified-inputs.json`으로 고정했고 초기 isolated metadata/fixture 실패는 과거 기록으로 보존했다. events의3개 slop helper는 exact 원본이다. Flutter engine/native/Widget runtime 실행 증거는 아니다.

현재 **family35+ownership10+영향 pointer/Root/global/cancel/recognizer/retirement/logical83=128 groups**, Core/SDK build·공통 types·strict direct declarations가 PASS다. direct fixture의 필수 kind 생략 type 오류를 실제 source-required touch kind로 수정했고 실패 log를 보존했다. Chromium147.0.7727.15/CanvasKit **49 flows /59 exact runtime inputs /errors[]**에서 기존40개 흐름과 single fallback·double suppress·long press/move/end/early cancel·두 손가락 scale2.50·동시 multi tap·serial3·pending deadline 화면 이동·재진입9개 흐름을 확인했다. Screenshot을 시각 검토했다. Force는 controlled-only다. owned browser/server와 모든 실행 handle을 종료했다. native/6archives는 helper마다 반복하지 않았다.

**출처:** source16개가 pin과 일치하며 새/변경 후보 **415 exact spans /54 refreshed anchors**를 검토했다. private enum 생성자2개는 missing, class/enum 전체는 partial이다. 독립 감사에서 이전73 envelopes/912 manifest prefix를 보존하고 **74 envelopes /962 selections /10,317 current destination hashes /180 export-source hashes**를 확인했다. 전체74,297 rows는 missing63,978 /partial2,847 /adapted7,454 /implemented7 /notApplicable11이다.406 current products와 Core/SDK 두 언어 문서를 갱신하고 full2013 engine notice3개·supplier·native binary/overlay/failure/source·emulator5554를 보존했다.

**이어서:** 실제 multi-drag/TapRegion/dragdrop/cursor/settings·implicit inherited settings, binary PointerData·semantics/provider와 나머지 전체 W7-01..14를 진행한다. related/I2는 versions/providers/peers/ranges/template/locks/sixarchives/current WindowsAndroidWeb 설치를 통합한다. 이전 supplied tags/native binaries는 당시 증거다. Apple/Linux 실제 code는 필요하고 전용 native build/run/harness SKIPPED/provider notVerified다. 물리·IME·reader·performance/FPS/scanout·배포/외부소비/clean-machine·전체 notices·독립 GPU drain은 미수락이다.

## 9.42 실제 multi-drag·TapRegion·cursor·Overlay·drag/drop — 세션 수락 / 전체 ACTIVE·PARTIAL

**목표 결과:** Gesture surfaces 화면에서 독립 drag/drop·거절·axis·long press·eager·그룹 tap·외부 소비·stationary cursor를 사용한다. 실제 View router/arena/timer, bounded retained Overlay/MetaData, 같은 View의 semantics rect와 선정 Navigator route visibility, inherited MediaQuery settings를 함께 연결했다. 현재 checkpoint는 `.tmp/work7/gesture-surfaces/checkpoint.json`이다. W7-01..14 전체 완료는 아니다.

**구현:** direct module8개와 sample을 추가했다. MultiDrag는 원본 initial global position/pending delta·move-only velocity·strict slop·delayed500ms를 따른다. TapRegion은 converted Source entry에 실제 retained down path를 연결하고 up에서도 그 경로를 사용한다. Draggable은 필수 runtime data guard·actual hit path·feedback Overlay를 소비하며 owner 종료 시 active avatar/client를 취소한다. Overlay는 bounded View의 opaque/maintainState/paint/hit/semantics/ticker를 처리한다. Cursor36개 상수와 실제 per-View device/kind MethodChannel, browser canvas style 수명 및 stationary 갱신을 연결했다. Native cursor/provider·DOM control 범위, custom-equality group key, content Overlay/Portal/LookupBoundary/rearrange, full ModalRoute/semantics/ScrollConfiguration은 남아 있다.

**수명 수정:** State.mounted가 true여도 Element가 detaching 중일 수 있어 실제 context.mounted도 확인한다. Completion options는 detach 후 허용된 callback을 위해 보존한다. Hidden Root는 semantics rect/action을 정리한다. 소비 surface는 tap demo 영역으로 한정해 제어 버튼이 동작한다. 실패한 fixture/import/type/owner/browser bundle과 진단 instrumentation은 보존하며 최종 bundle에는 instrumentation이 없다.

**검증:** surface20+owner/provider15+영향 회귀83=118 groups, Core/SDK build·공통/strict direct declarations PASS. 원본14개 library body를 import/export만 바꾸어 보존하고 실제 executed entry closure는13개를 로드했다(tap.dart는 captured-only). Assertions-on/off 각각18개 상태 사례가 TS debug/release와 일치한다. 이 정밀 범위는 `source-oracle-consumption-audit.json`에 기록했고 이전 originalLibraries:14 필드를 덮어쓰지 않았다. Chromium147.0.7727.15/CanvasKit63flows/75exact runtime inputs/errors[] PASS, screenshot 시각 검토 완료. controlled style fixture와 실제 canvas CSS 관측을 구별한다. Browser의 basic/disappearing 처리에는 원본 default/removeProperty 대비 차이가 남아 있어 다음 관련 묶음에서 수정한다.

**출처:** source14개와 추가 Web engine cursor가 pin과 일치한다.492 exact spans/687 refreshed anchors/58명시적 missing 후보, 이전74 envelopes/962manifest prefix를 보존했다. 독립 감사75 envelopes/1,027selections/10,761current destination hashes/193export-source hashes PASS. 전체74,297 rows는 missing63,534/partial2,997/adapted7,748/implemented7/notApplicable11이며 모든 class/enum은 partial이다.415current products·Core/SDK 두 언어 문서를 갱신했다. Supplier/full2013engine notice3개/native binaries/overlays/실패/source/emulator5554를 보존했고 owned process/browser/server handle은 닫았다.

**이어서:** cursor default/disappearing correction·실제 native cursor/DOM control/settings와 custom-equality groups·나머지 gesture/Overlay/입력부터 관련 묶음으로 계속한다. W7-01..14, related/I2 versions/providers/peers/ranges/template/locks/sixarchives/current native installs와 최종 수락은 남아 있다. Apple/Linux 실제 code는 필요하며 전용 native build/run/harness SKIPPED/provider notVerified다. Source/controlled/Web 증거를 물리·IME·reader·FPS/scanout·전체 플랫폼 수락으로 확대하지 않는다.

## 9.43 실제 cursor owner·native hover·physical settings·text 교체 — 범위별 수락 / 전체 ACTIVE·PARTIAL

**목표 결과:** canvas/실제 DOM control/editor의 cursor 수명을 묶고, 동등 TapRegion group·native hover·Android physical slop와 작은 화면 재진입을 연결했다. 현재 체크포인트는 `.tmp/work7/cursor-owners/checkpoint.json`이다. W7-01..14 전체 완료는 아니다.

**구현:** Web35CSS map의 basic/unknown/disappearing은 inline 제거, none은 숨김이다. Editor 재연결 전에 이전 cursor owner를 제거하고 소유 style/priority만 복원한다. 실제 KeyMap은 custom equals/hashCode와 plain object identity를 구별한다. direct ui/gesture-settings의 값·copyWith·동등성·local hash와 Android ViewConfiguration physical slop/DPR/MediaQuery를 연결했다. Sample은 scroll·상단 Back·반응형 버튼·enter/hover/exit를 제공한다.

**Native:** protocol1 actual JSI version·per-View channel/React prop·native View identity·Windows cursor interop/Android backing PointerIcon/AppKit/UIKit/GTK handler와 hover 수명 코드를 구현했다. Source map35Web/33Android/26Windows/21macOS+none/35Linux가 pin과 일치한다. Android OS SOURCE_MOUSE InputManager injection은 Java/direct event/SDK/실제 MouseRegion을 거친다. Logical hover DTO이며 full binary PointerData/button/pressure/clock 계약은 남아 있다. Channel 성공은 React prop staging이지 native 적용 완료 확인이 아니다. Apple/Linux 전용 native build/run/harness SKIPPED/provider notVerified를 유지한다.

**실패와 수정:** native JSI version 메서드를 분리 호출해 receiver가 사라진 오류를 실제 Android log에서 발견했고 ViewApi receiver를 유지하도록 수정했다. 첫 native overlay의 오래된 Kotlin keyboard host는 protocol3 검사로 거절되어 전체 현재 SDK Kotlin cohort를 연결했다. Phone DOM note의 viewport 밖 대기·Android accessible child label·scroll down/up 알림을 검증기에 반영했다. Windows COM interop은 inspectable.h를 명시했다. Windows JS-only 증분 빌드는 EXE가 바뀌지 않는 것이 정상이라 잘못된 mtime 검증 실패를 보존하고 동일 native byte/current fresh HBC로 확인했다. 모든 실패·overlay backup·이전/현재 APK/EXE/source/supplier를 보존했다.

**Text 자원:** 실제 browser phone resize에서 resident64 제한이 UI producer와 정상 retained/GPU holder를 혼동한 실패를 수정했다. Steady producer64·동기 교체/probe reserve1·resident256 hard bound를 나누며 exact old layout identity로 atomic 교체한다. Construction/limit 실패 시 이전 paragraph와 미반환 lease를 보존한다.9controlled capacity/ownership groups는64개의 서로 다른 setup resource를 쓰는 경계 시나리오이며 같은 UI를64번 반복한 것이 아니다. 잘못된 JSON resource-key 진단도 별도 correction receipt로 남겼다.

**검증:** 기록된 stage의 surface34+owner19groups, text9groups, unchanged 원본 GestureSettings class6cases/mode, Core/SDK/SkiaRN/SkiaWeb build·공통/strict direct declarations PASS. Browser75flows/81inputs는 hover note 이전 sample byte를 보존하며 현재 sample-only 변경은 focused9flows/9inputs/errors[]로 확인했다. 안정 시 paragraph/producers58→56→58은 peak memory/FPS가 아니다. 현재 Android APK e71f8e7e…는 API33/x86_64에서16flows·clean PID log·Touch slop8/source native를 통과했다. 초기/drag/settled PNG에서 title/Back·source/target·mode button 영역의 pixel 일치와 counter 변경도 확인했다. Windows EXE78b82bea…/현재 HBC99 bundle17652cdb…/858sources는 현재 native byte와 수정된 JS를 확인했다. Computer Use native pipe가 복구 절차 후에도 연결되지 않아 현재 Windows UI/cursor application은 notVerified이며 이전 UI 증거를 현재로 확대하지 않는다.

**출처·감사:** source11개 pin 재대조,9exact spans/143refreshed anchors, 이전75envelopes/1,027manifest prefix를 보존했다. 독립 감사76envelopes/1,028selections/10,770destination hashes/193export-source hashes PASS. 전체74,297rows는 missing63,525/partial2,998/adapted7,756/implemented7/notApplicable11이다. 모든 새 class 전체 계약은 partial이다.434current products·Core/SDK 양언어 문서를 갱신하고 original supplier/full2013engine notice3개와 emulator5554를 유지한다.

**이어서:** Windows UI 연결 복구 후 현재 cursor/hover/native application 관측, exact pointer-icon state·native binary PointerData/buttons/clock·나머지 입력/스크롤/Overlay/semantics와 W7-01..14를 계속한다. related/I2 versions/providers/peers/ranges/template/locks/sixarchives/current installations와 최종 물리/IME/reader/performance 수락도 남아 있다. Source/controlled/emulator/browser/build 증거를 전체 제품 완료로 확대하지 않는다.

## 9.44 실제 scroll physics·metrics·finite viewport 수명 — 세션 수락 / 전체 ACTIVE·PARTIAL

**목표 결과:** 새 Scroll motion 화면이10,000고정 행의 clamp/bounce/fast·drag/fling/wheel·content 축소·정책/controller 교체·화면 종료/phone 재진입을 소비한다. 현재 체크포인트는 `.tmp/work7/scroll-motion/checkpoint.json`이다. 일반 sliver 및 W7-01..14 전체 완료가 아니다.

**구현:**11새 direct export에 실제 Simulation·Friction/Bounded/Gravity/Clamped·SpringDescription/Type/Simulation/ScrollSpring과3개 private 해, painting enum/direction, ScrollMetrics/Fixed, Bouncing/ClampingScrollSimulation, ScrollPhysics의 parent/factory/range/friction/ballistic/threshold/momentum/update 및 pinned2013 ui/math.clampDouble을 연결했다. 기존 Tolerance는 named options와 positional 호환을 제공한다. Duration 경계는 integer milliseconds다. 원본의10Newton iterations·constant decel·position-only bound/done·spring discriminant·snap-both 대비 ScrollSpring x-only·negative transfer min quirks를 유지한다. 기존 physics/spring.ts는 변경하지 않은 호환 adapter이며 새 원본 구현으로 확대하지 않는다. Deprecated global tolerance getter는 실제 WidgetsBinding/global View가 없어 missing이다.

**연결과 수명:** finite vertical ScrollPosition/Controller는 실제 viewport/DPR와 정책을 소비하고 frame/owner epoch·postframe dimensions 보정/restart·listener가 시작한 새 ticker 보호·독립 해제를 제공한다. 실제 isScrollingNotifier는 activity 교체 뒤 최종 scrolling 상태를 발행한다. SingleChildScrollView/고정 LazyList가 실제 layout에서 RawGestureDetector factory를 교체하고 inherited GestureSettings/physics fling threshold를 사용하며 short/Never에서는 recognizer를 제거한다. Controller 교체는 이전 tracker를 먼저 해제한다. allowImplicit/semantics scroll 정책도 소비한다. 한 controller 한 viewport와 clamped programmatic jump는 명시적 adapter 범위이며 전체 ScrollActivity/notification/multi-position, 일반 가변/mixed/grid/reverse/anchor/sliver는 남는다.

**실패와 수정:** 원본 비교에서 Bouncing.shouldUpdate의 Dart covariant 타입 거절과 TS 통과 차이를 찾아 all-mode TypeError 검사를 추가했다. 실제 browser에서 offset이 같은 stop의 stale 활동 표시와 자식 build 뒤의 stale 생성 수를 확인해 isScrollingNotifier와 coalesced postframe count로 수정했다. 정책 교체 시 retained Widget이 새 RenderBox로 바뀌면서 layout 없이 paint된 오류는 제한된 모든 live 고정 행에 유효한 geometry를 주어 수정했다. Original Gravity 생성자에 없는 tolerance를 넘긴 fixture, 새 ticker 첫 tick의elapsed0 기대, leading edge 음수 clamp fling 기대, ambient React DOM type 검사, Core/SDK inventory 구조를 동일하게 가정한 writer 실패를 보존했다. Inventory writer는 Core 갱신 후 SDK에서 실패해 재실행하지 않았으며 새 recovery가 완료된 Core 변경과 unchanged SDK bytes를 확인한 뒤 qualification만 마쳤다. SDK에 존재하지 않는 직접 math port 출처를 만들지 않았다.

**검증:** 원본13개 별도 Dart library의 declaration/algorithm body는 import/export/part directive와 line ending만 조정했다.17captured source를 pin에서 독립 재조회했고13개 모두 실행 closure에 포함된다. annotation/diagnostics/TextDirection/controlled physical-size context는 명시적 fixture이며 global native DPR은 거절한다. Assertions-on/off 각각49distinct scalar/metric/policy 사례가 TS debug/release와1e-8 tolerance로 일치한다. 실제 controller/Ticker/FrameScheduler/notifier20groups와 current Core/SDK build·공통 types·strict direct declarations PASS다. Chromium147.0.7727.15/CanvasKit16flows/25exact runtime inputs/errors[] PASS, wide/phone screenshot을 시각 확인했다. Native/archive를 helper마다 재공급하지 않았으며 이전 Windows/Android 증거는 당시 byte 범위다. 모든 owned browser/server/test handle은 종료하고 emulator5554·전체 실패/source/native binary/supplier/overlay를 보존했다.

**출처:**280exact spans·19refreshed anchors·7explicit missing 후보,77envelopes/1,066selections/11,019current destination hashes/193export hashes를 독립 감사했다. 이전76envelopes와1,028manifest prefix를 보존한다. 전체74,297rows는 missing63,276/partial2,996/adapted8,007/implemented7/notApplicable11이며 모든 class/mixin/enum 전체는 partial이다.446current product source hashes와 Core/SDK 양언어 문서를 기록했고3개 full2013engine notice와 original supplier를 유지했다. ClampDouble 출처는 실제 port 소유자인 Core inventory에 추가했다.

**이어서:** W7-06 일반 sliver/Viewport/offset/child manager·가변/fixed/prototype/grid/mixed/cache/key/KeepAlive/PageStorage·motion/animation과 W7-07 고급 scroll, 나머지 전체 W7-01..14를 계속한다. Windows UI는 native pipe가 복구된 뒤 현재 cursor/hover/application을 확인한다. related/I2 versions/providers/peers/ranges/template/locks/sixarchives/current native installs, 최종 물리/IME/reader/performance/FPS/scanout·배포/외부 소비·독립 GPU drain은 남아 있다. Apple/Linux 실제 code는 필요하며 전용 native build/run/harness SKIPPED/provider notVerified다.

## 9.45 W7-06 일반 sliver·scroll owner·공개 List/Grid·shrinkWrap — 중간 마무리 / PAUSED·PARTIAL

**중단 지점:** 2026-10-13 KST, 사용자 요청으로 구현을 즉시 멈추고 현재 증거와 계획을 정리했다. 현재 제품 소스 **478개**, 앞선 scroll-motion 이후 **31개 새 direct module export**, pin에서 확보한 원본 **44개**다. 제품 478개 및 최신 receipt가 기록한 source/runtime 입력 해시는 중단 시점과 일치한다. `MatrixUtils` 원본을 44번째로 확보한 뒤 제품 변경은 없으며 `matrix-utils.ts`는 아직 만들지 않았다. 전체 W7-01~14와 이번 일반 sliver 세션은 **PARTIAL**, `sessionComplete:false` / `wholePlanComplete:false`다.

**구현한 소비 경로:** 실제 `SliverConstraints/Geometry`·`ViewportOffset`·`RenderSliver`·일반/축소 Viewport와 logical/physical parent data·paint/hit 변환을 연결했다. 가변 measured List, fixed/varied/prototype extent List, Grid의 원본 layout·child manager·cache·correction·key reorder·KeepAlive·selection registrar·notification 경로가 실제 Element/RenderObject를 사용한다. `PrimaryScrollController`, `ScrollView/CustomScrollView/ListView/GridView`의 공개 생성 경로와 reverse/RTL/center/anchor/padding/shrinkWrap을 연결했다. 기존 finite `widgets/scroll.ts` adapter는 별도 범위다.

**스크롤·애니메이션 수명:** canonical `ScrollPosition/ScrollPositionWithSingleContext`·multi-position `ScrollController/TrackingScrollController`·Idle/Hold/Drag/Ballistic/Driven activity·`ScrollContext/Scrollable/ScrollConfiguration`·PageStorage를 실제 per-View scheduler/Ticker/raw gesture/signal/metrics/semantics action에 연결했다. Canonical `animation/animation-controller.ts`는 취소 future·repeat/fling·resync와 해당 View의 `MediaQuery.disableAnimations`를 소비한다. 후보 position 생성/onAttach 실패 시 기존 activity·등록부를 복원하고 후보를 해제하며, detach callback 오류에도 독립 종료한다. 실제 application MediaQuery fixture는 native 접근성 provider 수락과 구별한다.

**최신 shrinkWrap 범위:** 실제 `RenderShrinkWrappingViewport`와 widget branch, unbounded main-axis 측정·finite cross-axis 조건·empty viewport의 physical size/offset dimension 차이, intrinsic 진단과 debug intrinsic cache 억제를 연결했다. 원본의 무제한 correction loop는 child당 10회(최소 10회) all-mode 수렴 상한으로 적응했다. live node 상한 256은 유지한다. unbounded 대형 shrinkWrap은 원본처럼 전체 측정을 요구하므로 이 상한을 넘을 수 있다. bounded 10,000항목 경로는 lazy다. measured 10,000행 왕복의 선정 size-only 검사에서 peak user Row State/active render는 6, sampled inactive/final owner는 0이며 JS 시간은 FPS나 native text 성능 증거가 아니다.

**현재 검증:** 최신 제품 bytes에서 **30 groups = 실제 mounted Root 28 + 직접 rendering/protocol 2**, 모두 PASS다.

| 묶음 | groups | 현재 receipt |
| --- | ---: | --- |
| shrinkWrap·4축 hit·intrinsic·수렴·safe-area | 7 (Root 5 + direct 2) | `shrink-wrapping-current-root-result.json` |
| 공개 List/Grid/Custom·Primary·key/semantics·focus dismiss | 7 Root | `public-views-current-shrink-root-result.json` |
| scroll owner·10k·wheel/drag/animation·PageStorage·흡수/종료 | 9 Root | `scroll-owner-current-shrink-root-result.json` |
| attach/constructor/detach 오류·Tracking rollback·자원 종료 | 4 Root | `scroll-owner-current-shrink-failure-root-result.json` |
| 실제 복수 View·live reduced motion·TickerFuture resync | 3 Root | `scroll-owner-current-shrink-accessibility-root-result.json` |

모든 receipt는 `.tmp/work7/sliver-viewport/` 아래에 있다. Core/SDK build·공통 types·strict 실제 package direct declarations는 최신 shrinkWrap stage에서 관측한 exit 0을 유지한다. 공유 ScrollMetrics 변경 후 원본 13개 library 기반 debug/release 각각 49 distinct 사례·tolerance 1e-8 비교도 PASS이며 이후 해당 metrics bytes는 변경하지 않았다. 중간 마무리는 metadata/hash 검증만 수행했고 build/runtime/oracle를 불필요하게 반복하지 않았다. 이전 protocol/selection/keep-alive/mixed 등의 receipt는 각 기록 bytes 범위이며 전부 최신 제품으로 재실행했다고 표시하지 않는다.

**아직 수락하지 않은 범위:** 이번 일반 sliver cohort의 exact source span 검토·adoption·destination hash/public coverage 갱신·독립 감사, 새 Curve/sliver/layout 원본 Dart oracle, 실제 mixed 가변 목록+grid 통합 browser 장면은 PENDING이다. checkpoint의 `sourceReview/sourceAudit`는 frozen 선행 scroll-motion 증거이며 이번 cohort 수락으로 승계하지 않는다. §9.44의 77 envelopes/74,297 rows는 마지막 감사 기준이고 이번 코드 증가를 새 coverage 완료로 환산하지 않는다. 모든 class/mixin/enum 전체 계약은 계속 PARTIAL이다. 이번 단계에서 native/archive/version 재공급은 하지 않았다.

**보존·인계:** [현재 중간 checkpoint](.tmp/work7/sliver-viewport/pause-checkpoint.json), [최신 resume 기록](.tmp/work7/sliver-viewport/resume-progress.md), `pause-verification-20261013.json`과 dirty inventory를 남겼다. 기존 `checkpoint.json`도 PAUSED로 갱신하며 변경 전 checkpoint·계획·resume bytes는 별도로 보존한다. `before-viewport-reveal/`의 현재 source/JS/maps/declarations 105개, 44개 qualified source, 실패/수정 전 fixture와 one-shot writer/log·stale-runtime 제외 감사·모든 native binary/supplier/overlay 및 기존 emulator5554를 유지한다. material/lock을 포함한 다른 dirty 작업은 변경하거나 정리하지 않는다. 완료된 capture/checkpoint/recovery/adopt/audit writer를 재실행하지 않는다.

**재개 순서:**

1. pause checkpoint·dirty inventory·현재 diff를 읽고 제품/receipt 입력의 변경 여부부터 확인한다. `before-viewport-reveal/`와 44번째 `qualified-source/43-matrix_utils.dart`가 다음 구현의 기준이다.
2. 실제 `MatrixUtils` → `RenderAbstractViewport/RevealedOffset` → viewport `getOffsetToReveal/scrollOffsetOf/maxScrollObstructionExtentBefore/showInViewport` → `ScrollPosition.ensureVisible/Scrollable.ensureVisible`를 연결한다. 현재 `RenderObject.showOnScreen(rect)`와 finite scroll override/EditableText 호출의 호환을 먼저 읽는다. Root focus reveal은 render layout만 dirty인 경우도 layout flush하도록 연결할 필요가 있으며 아직 수정하지 않았다.
3. default RawScrollbar/overscroll chrome·restoration·selection auto-scroll와 나머지 animation listener/Tween/Sequence/Curve2D·implicit/explicit transition을 구현한다. 현재 fixture는 `scrollbars:false, overscroll:false`; 미구현 default chrome branch와 non-null restorationId는 명시적으로 거절하며 native reader collection metadata도 미수락이다.
4. 실제 mixed 10,000 가변 목록+grid에서 fling/animation 중 추가·삭제/크기 변경/key·State·위치 보존/resize/hidden-resume/route close를 묶어 확인하고, 원본 비교·출처 adoption/독립 감사·wide/phone browser 재진입 수락을 수행한다.
5. W7-01~14 잔여와 related/I2 versions/providers/peers/ranges/template/locks/6 archives/current Windows·Android·Web 설치 및 최종 외부 소비·물리 IME/reader·성능/FPS/scanout·배포/서명/clean-machine·전체 notices·독립 GPU drain을 계속한다. Windows 현재 UI는 Computer Use native pipe 복구 후 확인하며 이전 UI 증거를 새 bytes로 확대하지 않는다. Apple/Linux 실제 코드는 필요하고 전용 native build/run/harness는 SKIPPED/provider notVerified를 유지한다.
