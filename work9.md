# work9 — Flutter 아키텍처를 계승한 Nelyx 구현·컴파일 계획

> 2026-10-19 긴급 정리: 이 문서의 보고서·validator·재개 지시는 과거 이력이다. 현재 계획·짧은 진행 상태·재개 기준은 [work12.md](work12.md)를 따르며 실행은 PAUSED다. 필요한 생성 입력/소유권과 라이선스는 유지한다. 과거 checkpoint/handoff·receipt·복구 archive는 삭제했으며 재개 조건으로 요구하거나 복구·재생성하지 않는다.

작성일: **2026-10-14 KST**, 최근 수락 반영 **2026-10-16 KST / §9.39**, 중간 중단 **§9.40**. 상태: **서비스/worker·native 복원/OS URI·image readback·명시적 owner 회복 PASS-scoped / 전체 PARTIAL**. 현재 증거는 controls 수락 (보관된 과거 기록 `w9-scroll-controls-acceptance.json`), 스크롤 수락 (보관된 과거 기록 `w9-scroll-header-acceptance.json`), 편집·자동완성 수락 (보관된 과거 기록 `w9-editing-autofill-acceptance.json`), animation 수락 (보관된 과거 기록 `w9-animation-runtime-acceptance.json`), bitmap/native 수락 (보관된 과거 기록 `w9-bitmap-retirement-acceptance.json`), §9.30~9.34와 handoff (당시 기록, 긴급 정리로 삭제됨)다. 실제 복사 Windows/Android에서 앱 복원·custom URI·all5 image format과 주입한 미확인의 native 완료/종료를 후보별로 수락했다. **나머지 W9-03·04·06~10 및 접근성·임베딩 후속은 미완료**다. 물리 IME/FPS·wide-gamut 출력·전체 native loss/drain·production signing은 미검증이다. 실행 순서는 계속 **§0.4·§5·§10.5**를 따른다. 기존 pause checkpoint는 byte 단위로 보존했다.

**기존 설계·구현 이력(§9.23~9.25):** 아키텍처는 Flutter에서 계승하고 내부 구현은 TypeScript·Hermes/Deno에 맞게 독립 설계한다. 공개 API는 Nelyx에 필요한 호환 범위를 정하고, 최종 합격 기준은 **Nelyx 자체 기능·성능·안정성 명세**로 전환한다. Dart→TypeScript 컴파일·자동생성은 계속 활용하며, 생성 소스에 원본 Dart 숫자 타입을 주석으로 보존한다. §9.23의 계획 개정 후 이번 **W9-02 구현 요청으로 §5.3의 1~4를 완료**했다. 8배치의 Nelyx 계약·독립 수락 gate·숫자 주석 생성과 공개 `.d.ts` 보존을 검증했다. 상세 증거는 §9.24이며 접근성은 이번 W9-03 요청으로 §9.25에서 재개했다. 과거 pause·플랫폼 공급 이력은 유지한다.

목표는 [work8.md](work8.md)에서 이어온 앱 기능·패키지 분리·실제 환경 수락을 Nelyx 제품 계약에 맞게 완성하는 것이다. 기능을 사용자 흐름 단위로 묶고, 필요한 컴파일 규칙과 내부 구현을 함께 연결하며, 같은 후보의 산출물·증거를 재사용한다. Flutter 내부를 그대로 재현하기 위한 예외 처리·추상화·우회 계층이 제품 구현을 지배하지 않도록 한다.

**적용 우선순위:** 실행 순서는 §0.4·§5.4·§10.5를 우선한다. 이 문서의 §0.1~0.3·§7이 W8/W7의 전면 호환·원본 동등성·inventory 전수 구현 조건보다 우선한다. W8 §3~9와 §7 이관표는 기능 후보·의존성·출처를 찾는 자료로 참조한다. §1·§8·§9.1~9.22 및 기존 receipt는 당시 정책과 후보의 이력으로 보존하며 새 명세의 PASS로 바꾸지 않는다. 이전 W9-01의 03-S→06-S→01-B 의존 순서와 수락은 유지한다. §5.3의 1~4는 §9.24에서 수락했다. 5는 §9.25의 접근성 Nelyx 계약에 적용했으며 이후 기능에서도 계속 적용한다.

## 0. 다음 작업을 위한 요약

| 항목 | 실행 기준 |
| --- | --- |
| 재개 위치 | **사용자 요청으로 중간 중단 / §9.40**. 새 명시적 재개 요청 전 추가 구현·검증을 진행하지 않는다. 마지막 scoped 수락은 §9.39이며 현재 소스는 advanced scroll WIP로 변경되었다. **전체 요청 / §9.39·§10.5**. Refresh/dismiss/reorder/sheet 및 선택된 Android producer 정책을 scoped 수락했다. 편집 설정·조합 안전한 AutofillGroup/서비스·실제 Android 제공자/저장/취소·native Copy API·Windows/Android 편집 해제까지 scoped 수락. 다음은 나머지 native 입력/메뉴·편집·scroll, wide-gamut/paint·typography/input/animation 및 우선 범위. §10.6~10.8과 후속 A·B를 유지 |
| 착수 전 | 서비스·복원 수락 (보관된 과거 기록 `w9-service-restoration-acceptance.json`)·handoff·관련 입력 hash·현재 diff·작업 트리 확인. §9.25·9.27·9.28 및 기존 native 공급은 당시 후보 이력으로 보존. 완료한 전체 inventory·과거 검증·6 target 공급부터 다시 실행하지 않음 |
| 단계 간 의존성 | §5.1 선택 선행과 §9.24 자동생성 수락 유지. 03~10의 우선 범위를 먼저 수락하고 접근성·네이티브뷰 잔여는 §5.4에서 이어감. 후속 항목은 우선 범위의 착수·종료 gate에서 분리 |
| 작업 단위 | Nelyx 기능 명세·선택한 공개 API·Core/SDK/디자인·실제 사용 장면을 함께 닫는 묶음. 필요한 원본 library는 재사용 입력 |
| 검증 시점 | 구현 중에는 불확실한 위험 경계 확인, 묶음 종료에 변경 패키지 빌드·Nelyx 명세 테스트·실제 통합 흐름 실행. Flutter 비교는 필요한 알고리즘·호환 항목의 참고 자료 |
| 재실행 조건 | 코드·의존성·fixture·도구·환경·공급 입력 변경, 실패 수정, 누락된 필수 수락. 이유 없는 동일 검증 반복 금지 |
| 공급 시점 | 영향 backend의 실제 기능 확인 때 해당 target만, 패키지 구조 전환·최종 후보에서 전체 공급 |
| 기록 | 하나의 현재 handoff와 기존 배치 state, immutable receipt 링크. 세부 선언마다 새 보고서·checkpoint를 만들지 않음 |
| 전체 범위 | 기존 기능 후보를 §0.2에 따라 검토. 접근성·네이티브뷰 요구는 삭제하지 않고 후속으로 이관. 나머지 기능·locale·플랫폼·품질 요구는 우선 처리 |

### 0.1 설계 원칙과 합격 기준

| 구분 | 앞으로 적용할 원칙 |
| --- | --- |
| 아키텍처 계승 | `Widget → Element → RenderObject`, 제약 기반 레이아웃, 선언적 UI, 컴포지팅을 핵심 구조로 유지. 각 구조의 상태 갱신·레이아웃·paint 책임과 수명을 Nelyx 계약으로 명시 |
| 독립 내부 구현 | Scheduler·이벤트 처리·접근성·메모리 소유권·플랫폼 추상화는 TypeScript와 Hermes/Deno에 맞게 설계. callback/async 순서, 취소, 오류, View 격리, native 자원 해제를 직접 정의 |
| 필요한 공개 호환 | 익숙한 이름·구성 방식과 실제 앱에 필요한 API를 유지. Flutter의 복잡한 예외 동작·deprecated API·VM 전용 의미·불필요한 추상화를 일괄 복제하지 않음. 차이는 사용자가 의존할 동작과 이전 방법을 문서화 |
| Nelyx 명세로 수락 | 기능·성능·안정성 테스트가 최종 gate. Flutter 원본 비교는 알고리즘 이해·이식 오류 발견·선택한 호환성 검토에 활용. 의도적으로 다른 구현이 원본과 다르다는 이유만으로 실패시키지 않음 |

컴파일과 자동생성은 재사용 가능한 코드·데이터를 가져오는 수단으로 계속 사용한다. 공통 규칙이 여러 실제 기능에 도움을 주면 lowering을 확장하고, Flutter 내부 재현 때문에 복잡해지면 **Nelyx 구현 + 명시적 API/adapter mapping**을 선택한다. 원본 의미를 보존해 가져온 부분과 독립 설계한 부분을 구분한다. 컴파일러가 필요한 동작을 구현하지 못했는데 `any`·빈 구현·항상 성공하는 결과로 통과시키는 것은 허용하지 않는다. 적용하지 않는 원본은 이유와 대체 경로를 남긴다.

### 0.2 기능 범위·호환성·출처의 관리

다음 구현 묶음을 시작할 때 해당 기능의 **Nelyx 계약/ID, 공개 API·호환 범위, 필요한 의존성, 의도적 차이·제외 이유, 수락 테스트**를 기존 문서·배치 mapping에 연결한다. 분류는 `호환 유지 / Nelyx 방식으로 대체 / Nelyx 전용 / 지원 제외`로 명시하며, 이는 실행 결과 상태와 별도인 설계 결정이며, §9.24에서 recipe의 `contract.classification`에 각각 `compatible / nelyx-replacement / nelyx-only / excluded`로 연결했다. 변경량이 큰 공개 API는 실제 consumer 영향과 이전 경로를 함께 검토한다.

Flutter inventory/SCC·원본 pin·license·origin·hash는 출처·변경 영향 추적에 계속 사용한다. 원본의 `required`·`missing`·`partial`을 제품 완료율로 사용하거나 숫자를 줄이기 위해 일괄 `notApplicable`로 바꾸지 않는다. **Nelyx 필수 요구와 그 의존성의 미구현/미검증이 0인지**를 별도로 판단한다. coverage의 원본 집계는 Flutter 기준으로 유지하며, §9.24에서 현재 8배치·39 origin에 별도 `nelyxContract` 결과를 연결했다. 과거 evidence의 의미를 바꾸거나 이미 제거한 selection API를 자동 복원하지 않는다. 기존 여섯 target·선택한 locale·배포·접근성 요구는 이 원칙만으로 자동 제외되지 않는다.

### 0.3 컴파일 결과의 Dart 숫자 타입 주석 — 신규 요구

Dart→TypeScript 생성기의 **resolved 타입 정보**로 원본 숫자 타입을 남긴다. `number`로 합쳐져도 `int`·`double`·`num`을 구분하고, 입력에 있으면 `BigInt`, nullability(`int?` 등), 컬렉션 내부 숫자 타입(`List<int>`, `Map<int, double>` 등), 숫자 bound를 가진 generic의 원래 타입과 bound도 보존한다. 명시 타입과 analyzer가 추론한 타입을 구분하며 이름·값의 모양으로 타입을 추측하지 않는다.

| 생성 위치 | 주석 규칙 |
| --- | --- |
| 필드·상수·지역변수·의미 있는 생성 임시변수 | 선언 바로 위 `@dartType`에 원본 타입 표기. 여러 변수의 타입이 다르면 각 선언에 귀속 |
| 함수·메서드·생성자 인자 | 선언 JSDoc의 `@dartParam <이름> <원본 타입>`에 기록. named 인자를 options 객체로 합쳐도 원래 인자 이름과 타입 유지 |
| 함수·메서드 반환값·getter | `@dartReturn <원본 타입>`에 기록. nullable·generic 정보를 함께 보존 |
| 수치 표현 변환 | 필요한 경우 `@nelyxNumeric`에 실제 표현·범위·단위 정책을 기록. 원본 타입 주석과 런타임 검사/변환은 별도 계약 |

주석 형식 예시다(추가 Origin 태그는 생략). §9.24에서 resolved 타입 기반 생성과 공개 선언 보존을 수락했으며, 실제 숫자 표현은 recipe의 명시적 mapping을 따른다.

```ts
/** @dartType int */
const count: number = 3;

/**
 * @dartParam value double
 * @dartReturn num
 */
function identity(value: number): number { return value; }

/** @dartType int? */
const selectedIndex: number | null = null;
```

주석은 generated base→effective merge→제품 `.ts`에서 결정적으로 유지하고, `.d.ts`에는 공개 선언의 태그를 보존한다. 배포 JS의 주석 보존은 빌드 최적화 정책을 따른다. 주석 자체는 런타임 wrapper·type token·Dart 숫자 ABI 재현을 요구하지 않는다. 실제 값 표현은 Nelyx 명세에 따라 선택하며, 정밀도·정수 범위·반올림·나눗셈/나머지·비트 연산·non-finite·native 경계에서 기능상 필요한 의미를 별도로 검증한다. 주석을 붙였다는 이유로 정밀도 손실을 허용하거나 수치 검증을 통과한 것으로 보지 않는다.

### 0.4 실행 범위 분리 — 접근성·네이티브뷰는 후속

사용자 요청에 따라 **나머지 기능 구현 → 해당 범위의 실제 환경 수락·감사·공급 → 접근성·네이티브뷰 후속 → 전체 통합 수락** 순서로 진행한다. 이 절은 과거 이력과 handoff에 남아 있는 접근성 우선 지시보다 우선한다.

| 구분 | 범위와 처리 |
| --- | --- |
| 우선 작업 | 공통 서비스·Scheduler·이벤트·렌더링/복구·입력/animation, 편집/Form/scroll/IME, 앱 흐름·복원·locale, 디자인·locale 공급, 플랫폼 runtime/tooling 분리, 개발 갱신·inspector, 해당 기능의 실제 환경 검증·감사·공급 |
| 후속 A — 접근성 | semantics 값/트리·bridge·collection metadata·action·reader, 접근성 OS 설정 producer와 실제 View/MediaData 연결, tree 제출/해제 acknowledgement·실패 cleanup owner 회복, 관련 UIA/OS 알림·물리 reader 수락. §9.25까지의 구현·증거는 보존 |
| 후속 B — 네이티브뷰 | PlatformView 및 native/HTML view 임베딩, 해당 ViewApi/header·전용 texture 연동, 생성/부착/배치/합성·clip/transform/z-order·입력/focus 전달·분리/종료·복구와 실제 플랫폼 수락 |
| 유지할 native 범위 | 일반 앱/View host, Skia 렌더링·공통 texture/자원 수명, Windows/Android runtime·runner/tooling·공급, IME/keyboard/menu 등 나머지 기능에 필요한 OS 연결·실제 검증은 우선 작업에 포함. `native` 또는 `View`라는 이름만으로 모두 후속 처리하지 않음 |

기존 접근성·네이티브뷰 구현을 제거하거나 빈 성공 구현으로 바꾸지 않는다. 우선 작업이 공유 계약을 변경하면 기존 소비와 수명 안전성을 보존하는 데 필요한 접점 수정·영향 회귀만 수행하고, 후속 기능 전체 구현·수락으로 확대하지 않는다. 분리할 수 없는 의존성이 발견되면 해당 기능의 의존 경계와 미완료 이유를 기록하고 독립적인 나머지 작업을 계속한다. 의존성이 남은 기능을 완료로 처리하지 않는다.

**우선 범위 완료와 전체 완료를 구분한다.** 후속 미완료는 우선 범위의 수락을 막지 않으며, 전체 W9 상태는 후속과 통합 수락까지 PARTIAL이다. 후속은 `후속 이관 / 미완료`로 기록하고 PASS·지원 제외·SKIPPED로 치환하지 않는다.

## 1. 최초 계획의 출발점과 증거 경계

최초 계획 작성 시 HEAD는 **`891760f`**, tracked 변경은 없고 `work9.md`만 빈 미추적 파일이었다. W8 제품 소스 기준 `3992130` 이후 당시 HEAD까지의 변경은 W8 문서와 pause/selection checkpoint뿐이다. **아래 표는 최초 계획 당시의 기록**이며, 현재 구현·수락 증거는 §9.25와 handoff, 실행 계획은 §9.26·§0.4를 따른다. 이 표의 WIP·notVerified·drift 수치를 최신 상태로 사용하지 않는다.

| 항목 | 확인한 상태 | W9 처리 |
| --- | --- | --- |
| 제품·도구 입력 | selection-progress (보관된 과거 기록 `selection-progress.json`)의 제품 **68개**, 도구 **34개** SHA-256이 현재 파일과 모두 일치 | 이번 확인은 파일 일치이며 build/runtime 재검증이 아님. 다음에는 이후 변경 범위를 먼저 확인 |
| 고정 원본 | `.tmp/work6/flutter-source` HEAD가 **`71e4717a61786faab4c7aa39825989305ed29e8a`**와 일치 | pin 유지. inventory의 `localSnapshotMatchesPin:false`를 임의로 true로 바꾸지 않음 |
| 최신 재개 기준 | pause-checkpoint (보관된 과거 기록 `pause-checkpoint.json`), selection-progress, W8 §0·10.23 | 이전 strict checkpoint·handoff의 ACTIVE 문구를 현재 상태로 사용하지 않음 |
| 선택 기능 증거 | pause 기록상 scoped proof **25개**, 직접 입력 기준 유효 **24개**, 과거 overlay Root 증거 **1개** | 이번에 25개 runtime을 재실행한 것은 아님. 직접 입력 일치만으로 전체 의존성·플랫폼 수락을 확정하지 않음 |
| DOM 메뉴 | View-owned 계약·Core render binding·SDK DOM/channel/bootstrap 초안, **runtime notVerified** | drain 전에 ingress 차단, 재진입·부분 bind 실패·실제 DOM/Root 통합부터 마무리 |
| 자동생성 | **6개 recipe / 36개 origin**의 반영 기록. matrix·tween-sequence-item의 `ui/types.ts` 의존 drift 기록 | 바뀐 배치와 dependent를 재수락. 등록된 6개 재실행을 전체 Flutter 이식 진척으로 세지 않음 |
| 출처·공급 | 수동 origin **10개** drift, 새 selection public exports·외부 소비·coverage·archive 연결 미완료 | 선택 묶음 종료 때 정합성 회복. 이전 archive 증거를 현재 소스에 복사하지 않음 |
| native 계약 | `wordBoundaryVersion:2`, `textBoxVersion:1`, draw wire **9** | 새 boundary/box header build/runtime은 notVerified. W9-01부터 영향 Windows/Android 경계를 앞당겨 확인 |
| 패키지 | 선정 Material/Cupertino 분리 완료. 전체 family·localizations와 여섯 host/tool 패키지 분리 미완료 | 이미 끝낸 이동을 반복하지 않고 남은 구현·소유권·소비를 연결 |
| 전체 수락 | Windows/Android/Web 필수 실제 수락 OPEN. iOS/macOS/Linux 전용 native 검증은 사용자 지정 SKIPPED | 여섯 target 구현 의무 유지. SKIPPED와 provider notVerified를 PASS로 바꾸지 않음 |

W8의 마지막 coverage 집계는 missing 62,153 / partial 5,641 / adapted 6,494 / implemented 1 / notApplicable 8, required 74,297이다. 이후 selection/DOM 변경이 완전히 반영된 집계가 아니므로 **현재 완료율이나 남은 시간 추정에 사용하지 않는다.**

## 2. 오래 걸린 이유와 바꿀 운영 방식

정확한 세션별 시간 계측은 없으므로 비용 비율이나 예상 단축 배수를 단정하지 않는다. 아래는 W8 실행 기록과 현재 스크립트에서 확인되는 반복 구조다. 기존 원본 비교가 찾은 오류와 수명 검증은 보존하되, 앞으로 필수 gate는 Nelyx 계약을 검증하도록 정리한다.

| 관찰한 구조 | 비용이 커지는 이유 | W9에서 적용할 변경 |
| --- | --- | --- |
| W8 §10.11~22가 delegate → fragment → Text → scroll → recognizer → 값 → overlay → Region → shortcut으로 세분화됨 | 같은 선택 흐름이 완성되기 전에 공통 build/types·인접 회귀·증거 갱신이 여러 번 발생 | 의존성 분석은 묶음 시작에, 구현은 연결된 기능 전체로 진행. Nelyx 기능·실제 Root/UI 수락은 묶음 종료에 통합 |
| root `build:sdk`가 core·designs·Skia·SDK·provider/CLI 준비를 포함 | core만 바뀌어도 이를 습관적으로 호출하면 무관한 빌드·native 준비를 동반 | 변경 package와 필요한 consumer만 빌드. 전체 SDK 빌드 직전/직후 `build:core`를 중복 호출하지 않음 |
| [build-packages.mjs](Nelyx/eng/build-packages.mjs)는 호출마다 TS program 생성·검사·emit·dist 교체를 수행 | 파일 하나마다 호출하면 같은 패키지를 다시 컴파일 | 기능 묶음의 실행 후보를 한 번 만들고 같은 dist로 관련 검증을 순서대로 실행 |
| [batch.ts](tools/Nelyx.FrameworkToTypeScript/src/batch.ts)의 `resume all`은 등록된 recipe를 순회 | 전체 inventory의 아직 recipe가 없는 SCC까지 자동 구현하지 않음 | Nelyx 필수 closure를 등록·반영. 반복 blocker의 규칙 확장과 독립 구현 mapping 중 단순하고 유지 가능한 경로 선택 |
| 입력 drift·source/dist 불일치·receipt 덮어쓰기 보정 이력이 있음 | 기능 구현 외에 증거 복구·과거 후보 재수락 작업이 추가됨 | 실행 전에 source/dist 현재성 확인, receipt는 처음부터 불변 경로로 기록, stale 범위를 즉시 표시 |
| 최신 pause와 과거 strict checkpoint·handoff·장문 이력이 함께 존재 | 세션마다 전체 이력을 다시 해석하면 재개 비용과 잘못된 writer 실행 위험이 생김 | 현재 handoff 한 개에서 다음 목표·파일·receipt만 찾게 하고 과거 기록은 링크로 참조 |

**핵심 변경은 “세션 끝에 검증”이라는 구호를 반복하는 것이 아니라, 빌드 범위·재실행 조건·기능 종료 조건·기록 위치를 고정하는 것이다.**

## 3. 한 기능 묶음을 진행하는 절차

### 3.1 시작: 읽기와 영향 분석을 한 번만

1. `.github/copilot-instructions.md`, 현재 handoff, 이 문서의 해당 W9 행, `git status --short`와 직전 기준 이후 diff를 읽는다.
2. Nelyx 명세로 입력·관찰 결과·오류/수명·필요 성능 기준을 정하고, 이번 결과를 한 문장으로 적는다. 예: “여러 문단을 선택하고 스크롤한 뒤 Web 우클릭 메뉴를 사용하고 View를 닫아도 지연 입력이 남지 않는다.”
3. 호환할 공개 API·독립 구현 접점·제품 파일·backend·검증 family를 정한다. 원본을 재사용하는 부분의 source library·private/conditional/external dependency만 실제 소비 범위로 연결한다. 과거 모든 원본과 109 MB 규모 coverage를 대화에 출력하지 않는다.
4. 기존 구현·recipe·fixture를 재사용하고 source oracle은 선택한 참고 비교에 활용한다. 새 helper를 만든다는 이유만으로 별도 oracle/harness/장문 문서를 만들지 않는다.
5. 현재 입력이 달라진 증거만 stale로 표시한다. source pin·lock·frontend/schema가 같으면 resolved inventory를 재사용한다.

일반 재개 탐색은 **약 10분 안에 첫 수정 대상을 확정하는 운영 목표**로 삼는다. 시간만 맞추려고 불확실한 출처나 의존성을 생략하지 않는다. 더 걸리면 부족한 자료·구체적인 blocker를 현재 handoff에 남겨 다음 세션의 동일 탐색을 없앤다.

### 3.2 구현: 관련 계층을 함께 연결

- 한 번에 하나의 기능 묶음을 주 작업으로 삼는다. 값·알고리즘·Widget·RenderObject·SDK bridge·최소 사용 장면을 연결하고, 중간 단계마다 전체 수락을 실행하지 않는다.
- 의미가 불확실한 변환, ABI, 자원 해제 순서처럼 뒤늦게 발견하면 손실이 큰 경계는 먼저 좁은 probe로 확인한다. 단순 getter·타입·상수마다 테스트를 새로 쓰지 않는다.
- 같은 unsupported 원인이 여러 Nelyx 기능에 반복되면 lowering/mapping을 한 번 고친다. 재사용 이익보다 예외 처리·우회 비용이 큰 원본 내부 구조는 독립 구현으로 바꾸고 실제 계약·호환 차이를 기록한다. OS/engine 결합은 Nelyx host adapter로 연결한다.
- 범용 Dart compiler·VM 호환을 선행 gate로 만들지 않는다. 생성하는 부분에는 검토한 변환 규칙과 숫자 타입 주석을 적용하고, 미지원 부분은 독립 구현·명시적 mapping·지원 제외 중 결정한 경로와 담당을 남긴다.
- 자동 반영에는 effective-package typecheck·Nelyx 명세 fixture·3-way merge·반영 직전 hash 재검사를 유지한다. §9.24에서 현재 8배치의 필수 gate를 Nelyx 명세로 전환했고 source comparison은 별도 참고 결과로 기록한다. 자동화 수락과 같은 검증을 상위 wrapper에서 다시 수행하지 않는다.
- 순수 분석·서로 다른 출력의 실행만 제한적으로 병렬 처리할 수 있다. 동일 dist·coverage·lock·제품 반영을 쓰는 명령은 순차 실행하고 writer는 하나로 유지한다. 별도 에이전트 도입을 효율화의 필수 조건으로 삼지 않는다.

### 3.3 종료: 후보 하나를 만들고 필요한 검증만

1. 연결된 구현이 준비되면 변경 package와 필요한 dependent를 빌드한다. 실행 JS/map과 현재 source가 일치하는 guard를 통과시킨다.
2. 바뀐 Nelyx 계약의 기능·성능·안정성 및 실제 Root 사용자 흐름·수명·오류 회귀를 묶어 실행한다. Flutter 원본 비교는 관련 알고리즘/호환성을 확인할 때만 추가하고 차이는 설계 결정과 대조한다.
3. DOM/native/API가 바뀌었다면 영향 backend 실제 실행을 같은 묶음에서 확인한다. Web hook·CPU receiver만으로 실제 DOM/native 수락을 대신하지 않는다.
4. exports·package 구조가 바뀐 묶음은 외부 packed 소비를 포함한다. Nelyx 요구→구현→테스트·receipt 연결과 출처·배치 정합성을 한 번 갱신한다. Flutter coverage 수치는 출처 추적 결과로 따로 기록한다.
5. 모든 필요한 검증이 끝났으면 기능 작업을 계속 진행한다. 더 많은 PASS 수치를 만들기 위한 반복·새 harness·추가 장문 보고는 하지 않는다.

실패 후에는 원인과 수정 범위를 확인하고 **실패한 검증 + 그 수정으로 무효화된 인접 검증**만 다시 실행한다. 원인 변화 없이 같은 명령을 연속 재시도하지 않는다. 두 차례 같은 실패가 이어지면 로그·입력·환경을 좁혀 조사하고, 영향을 받지 않는 준비된 작업은 계속한다.

### 3.4 기능 묶음과 대화 세션은 별개

W9 단계 하나가 반드시 대화 한 번에 끝난다고 가정하지 않는다. 큰 단계는 **실제 동작하는 API family/의존성 closure**로 나누되 파일·member마다 세션 목표를 만들지 않는다. 중간 대화가 끝나면 같은 묶음을 이어가고, 다음 세션에서 이전 분석·빌드·검증을 처음부터 반복하지 않는다.

중간 저장은 컴파일 가능한 연결 지점을 우선한다. 미완료 상태라면 `PARTIAL`과 정확한 다음 수정 위치를 남긴다. 임의로 묶음 완료나 전체 완료로 표시하지 않는다. 세션 길이·파일 개수·출력 토큰을 채우기 위한 작업 분할도 하지 않는다.

## 4. 검증·빌드·공급 선택표

| 변경 또는 시점 | 실행할 최소 범위 | 전체 검증으로 확대하는 조건 |
| --- | --- | --- |
| 계획·설명 문서만 변경 | 링크·구조·diff/whitespace 확인 | 제품 build/runtime은 실행하지 않음 |
| core 내부 구현 | core build, 영향 consumer 타입, Nelyx 계약·Root·수명 회귀 | 공통 공개 타입·scheduler/owner·여러 family로 영향이 넓어짐 |
| SDK/DOM·input·bootstrap | 최신 dependency dist + SDK build, 실제 Root와 Web 입력·종료 흐름 | 공통 host 계약·다른 backend도 영향받음 |
| 자동생성 규칙·recipe | generate/compose/validate/promote, Nelyx 명세 fixture·타입 주석·재생성/수정 보존 회귀 | frontend/IR schema·공통 emitter 변경은 그 영향을 받는 모든 배치 재수락 |
| exports·소유 package·resolver | 해당 package/dependent build, direct ESM/declaration·단일 core identity·packed 소비 | 디자인/host/tool 분리 통합 지점에서 관련 소비 조합 전체 |
| native header·wire·ABI·ownership | 대응 native build, 설치 artifact 식별, 경계 호출·해제·오류 실제 실행 | 영향 Windows/Android/Web을 모두 포함. Apple/Linux 전용 native는 기존 SKIPPED 정책 |
| 기능 통합 후보 | 공통 types + 필요한 build, 해당 앱 흐름, 변경 배치/origin 정합성 | 실제 변경 영향이 넓으면 이를 이유로 범위 확대 |
| 최종 후보 | 전체 build/types·Nelyx 필수 요구 감사·패키지/6 target 공급·외부 소비·필수 실제 환경 | W9-10의 전체 완료 조건 적용 |

현재 존재하는 명령을 아래처럼 선택한다. 아래 블록은 **전부 연속 실행할 체크리스트가 아니다.** 새 스크립트나 옵션은 구현 전까지 존재하는 명령으로 안내하지 않는다.

```powershell
# core 실행 산출물이 필요한 경우
npm.cmd run build:core

# 필요한 의존성 dist가 현재 후보로 준비된 뒤 SDK만 변경/검증하는 경우
npm.cmd run build --workspace @nelyx/sdk

# 전체 SDK 통합 후보일 때: core/design/Skia/SDK/provider/CLI 준비 포함
npm.cmd run build:sdk

# 공통 공개 계약 또는 기능 통합 후보의 타입 검사
npm.cmd run check:types

# 실제 CLI/Metro 변경 시 추가
npm.cmd run check:cli-types
npm.cmd run check:metro-types

git diff --check
```

package build도 TS 진단을 수행하지만 root `check:types`의 다른 workspace/sample까지 자동 검사하는 것은 아니다. 중복되는 compile 범위와 별도 consumer 검사를 구분한다. 반대로 SDK만 빌드하면서 바뀐 core·Skia dist를 방치해서도 안 된다.

테스트 timeout은 저장소 지침대로 **각 테스트 명령 20분(1,200초)**이다. 현재 `.tmp/work8/run.mjs`가 이 상한을 적용한다. 구현 때 재사용 여부와 자식 프로세스 종료를 확인하고, 다른 실행 경로에도 같은 제한을 적용한다. 한 wrapper에 모든 검증을 넣어 전체가 20분에 끊기게 하지 않는다. 같은 시나리오 반복은 대부분 30회 이내이며, Unicode 표처럼 서로 다른 입력의 전체 적합성 corpus와 동일 시나리오 반복을 구분한다.

### 4.1 증거를 재사용할 조건

- Git HEAD만 같다는 이유로 재사용하지 않는다. Nelyx 명세/호환 정책·source·transitive dependency·recipe/mapping·manual input·fixture·compiler/runtime/config·실행 JS/map·필요한 native/supply artifact가 같은지 확인한다. 명세가 달라지면 같은 제품 byte의 과거 PASS도 새 수락으로 자동 승계하지 않는다.
- 재개 때는 Git diff와 기존 manifest로 후보 범위를 줄인다. untracked/ignored 입력·외부 tool/환경·설치 artifact는 Git으로 보장되지 않으므로 해당 입력도 확인한다.
- 의존 관계가 기록되지 않아 영향이 불확실하면 관련 family를 넓혀 확인한다. 직접 파일 hash 일치만으로 transitive proof를 새 후보에 승계하지 않는다.
- 바뀐 증거는 즉시 stale로 남긴다. 최종 수락까지 기다렸다가 과거 PASS가 현재 것처럼 보이게 하지 않는다.
- source/dist guard와 immutable receipt writer는 유지한다. 과거 receipt가 없어졌다면 unavailable로 보존하고, 제품 진행과 무관한 과거 후보 재현은 현재 gate의 필수 여부를 먼저 판단한다.
- 줄바꿈만 달라도 raw hash와 Git blob hash의 차이를 기록한다. 이를 무시하거나 hash만 바꾸어 과거 runtime을 새 후보의 실행 증거로 만들지 않는다.

### 4.2 무거운 작업을 실행하는 조건

| 작업 | 실행 조건 |
| --- | --- |
| 전체 Dart inventory 재분석 | source pin·frontend/analyzer lock·schema 변경 또는 resolved cache 손상. 동일 입력의 최종 감사는 캐시를 검증·재사용할 수 있음 |
| 전체 coverage 재작성 | 기능 묶음/통합 후보에서 필요한 compiler identity·exports·출처 반영, 최종 전체 감사. 파일마다 수행하지 않음 |
| 영향 밖 과거 oracle | 선택한 호환/알고리즘의 오류 조사가 필요할 때. Nelyx가 의도적으로 대체한 내부 동작의 원본 동등성 재수락은 필수 아님 |
| cache 없는 base 재현 | 새 tool/recipe 기준을 통합 수락할 때와 최종 후보. 같은 기준을 세부 수정마다 독립 checkout에서 재실행하지 않음 |
| native build·설치 | 영향 native 계약 변경 또는 해당 실제 기능/최종 후보 수락 |
| 여섯 target 재공급 | host/tool 분리·호환 cohort 전환·최종 후보. 개발 중에는 현재 코드 실행에 필요한 target만 |
| 외부 앱 재생성 | template/초기 생성 경로가 바뀌었을 때·최종 clean consumer 수락. 평소에는 기존 격리 consumer를 재사용하고 archive 식별 확인 |

현재 coverage 도구에 빠른 부분 갱신이 있다고 가정하지 않는다. 지원되지 않으면 변경 origin 목록과 stale 상태를 작은 handoff에 모으고 묶음 종료에 기존 전체 writer를 한 번 실행한다. 출처 반영을 모든 구현이 끝날 때까지 미루지는 않는다.

### 4.3 Nelyx 명세 기반 검증

아래 접근성·네이티브뷰 전용 수락은 §0.4에 따라 후속에 적용한다. 우선 범위는 그 밖의 기능과 공유 접점의 영향 회귀를 검증한다. 명세는 구현을 사후 설명하는 문서가 아니라 실행 전에 정한 관찰 가능한 계약이다. 기존 기능 문서와 테스트 family에 계약 ID·허용 차이·환경·합격 기준을 연결하고 별도 대형 관리 시스템을 만들지 않는다.

- **기능:** Widget/Element 상태·재사용/해제, 제약→크기/배치, 합성·입력·선택/편집·앱 흐름·접근성의 입력과 관찰 결과. 원본 fixture를 활용하더라도 기대값은 Nelyx 계약으로 설명할 수 있어야 한다.
- **안정성:** frame/event 순서·재진입·callback 교체/취소·오류 전파, 앱/다중 View 격리, listener/timer/native 자원 소유권과 종료·실패·복구. 접근성은 선택한 role/state/action·OS 연결과 실제 reader 수락을 포함한다.
- **성능:** 해당 기능의 대상 환경·workload·frame/응답 지연·메모리/자원 사용·cold/warm 조건·허용 기준을 후보 수락 전에 명시하고 측정한다. 측정 대상 밖 플랫폼·물리 FPS/scanout을 추정 PASS로 바꾸지 않는다.
- **컴파일/공급:** 생성 코드와 source/dist·type declaration 정합성, 숫자 주석 정확성, 재생성 결정성·수정 보존·직접 소비·영향 native/패키지 경계. typecheck만으로 기능·성능·안정성을 수락하지 않는다.

Flutter 비교 실패가 나면 먼저 **Nelyx 계약 위반 / 의도적 차이 / 비교 fixture 문제**를 구분한다. 계약 위반은 수정하고, 의도적 차이는 명세·API 차이 문서와 Nelyx 테스트에 연결한다. 알려진 실패를 숨기거나 기존 receipt를 덮어써서 정책 전환을 대신하지 않는다.

## 5. 남은 작업의 실행 순서와 종료 조건

현재 **PARTIAL**이며, W9-00·01 및 **W9-02 후속(§9.24) 완료**, W9-03·04·05·06은 진행 중이다. W9-01의 최신 수락은 §9.21이며 W9-03은 §9.25·9.27, W9-04는 §9.28, W9-05는 §9.29의 scoped 수락과 잔여를 따른다. 나머지 4단계는 미수락이다. 구체적인 현재 증거와 다음 수정 위치는 selection-progress의 `w9`와 §9에 연결한다. W8에서 이미 통과한 세부 항목은 유효 증거를 연결해 재사용하며 처음부터 다시 구현하지 않는다. **단계 번호는 소유 범위이며, 모든 단계를 번호순으로 완결해야 한다는 의미가 아니다.** 선행 기능을 그 담당 단계에서 먼저 구현하고 소비 기능을 수락한다. 이를 같은 작업의 중복 구현이나 두 단계의 전체 완료로 세지 않는다.

| 단계 | 함께 처리할 범위 | 묶음 종료 시 확인할 결과 | 의존·W8 대응 |
| --- | --- | --- | --- |
| **W9-00 재개 기준 정리** | 현재 diff·pause·pin, 남은 기능과 배치 담당, 현재 handoff 위치와 필요한 검증 목록 확인 | 첫 수정 파일·사용자 결과·검증 명령·유효/무효 증거가 정해짐. 새 관리 시스템 구축으로 확대하지 않음 | 최초 한 번. W8-00·03 |
| **W9-01 선택 기능 실제 연결** | §9.19의 DOM/registry·선정 선택 흐름은 **W9-01-A 수락 범위**로 보존. **W9-01-B §9.21 수락:** 기본 확대경·정식 선택 controls/toolbar·theme/localizations를 SelectionArea 기본 경로와 연결하고 공개 소비·출처·공급 수락 | 문단/WidgetSpan 선택→핸들/확대경→스크롤/keyboard/우클릭→복사/메뉴→View 종료. 기존 원본 비교·플랫폼 흐름 수락은 §5.1의 이력으로 보존. 이후 변경은 Nelyx 선택 API·override·수명/오류 계약으로 검증 | 00 및 **03-S·06-S 선행**. 필요한 02 규칙은 해당 작업에 포함. W8-04·05·06·09 일부 |
| **W9-02 컴파일·자동생성 후속 — §9.24 완료** | §9.22의 8배치/39 origin 보존. Nelyx 명세/호환 mapping과 수락 fixture 연결, Dart 숫자 타입 주석, generated/adopted 소유권과 재생성 보존. 실제 기능에 이익이 있는 lowering만 추가 | Nelyx 명세 기반 generate→compose→validate→promote 및 주석의 `.ts`/공개 `.d.ts` 보존·결정성·수정 보존 수락. 원본 차이는 별도 기록. §5.3의 1~4 수락. 5는 다음 기능 단계에 적용 | 기존 컴파일 수락을 다시 구현하지 않음. 03~07의 필요한 규칙을 공급. W8-02·03의 전면 이식 목표는 §0으로 대체 |
| **W9-03 공통 서비스·렌더링·기본 입력 잔여** | **03-S 먼저:** RawMagnifier·장식/clip·backdrop filter/layer와 공통 paint 명령·backend 수명. 이후 Nelyx Scheduler·이벤트·owner·platform/service adapter, paint/layer/filter/shader/image/asset·복구, typography/font, pointer/gesture/focus/key·animation/transition | 03-S는 실제 배경 픽셀 확대·transform/clip·합성 순서·자원 해제까지 닫아 06-S에 공급. 나머지는 TypeScript/Hermes/Deno에 맞는 계약으로 서비스→합성/본문→입력→재배치/복구 수락. 03-S 통과가 W9-03 전체 완료는 아님 | 03-S는 **01 전체 완료와 독립**. 필요한 02 규칙과 함께. 접근성 잔여는 §5.4 후속 A. W8-04·05 |
| **W9-04 편집·Form·scroll 통합** | EditableText/RenderEditable·controller/delta·formatter/undo/autofill/toolbar/caret reveal·IME, Nelyx sliver layout·measured first seek, scrollbar/restoration customization, Page/Nested/header/refresh/reorder/dismiss/sheet/wheel/2D/tree/zoom | 여러 필드 입력/검증/제출, 선택/편집 중 scroll·키/State·복원, mixed 10,000 list/grid mutation·fling·resize·hidden/resume·close. 실제 IME는 기능별로 관찰하고 성능은 측정한 항목만 수락 | 01·03의 관련 의존성. W8-04·06 |
| **W9-05 앱 흐름·복원 / 접근성은 후속** | WidgetsApp/route/router/deep link/Back, Overlay/Hero·restoration·async/state, locale resolution. semantics bridge/collection metadata는 후속 A | 우선: link→nested route/form/list→dialog→Back/복원→locale/환경 변경. 접근성 action·bridge·reader 연결은 후속 A | 관련 03·04. W8-07 |
| **W9-06 디자인·전체 locale 공급** | **06-S 먼저:** 선택 기능의 canonical theme/localizations 필수 의존성, Material/Cupertino magnifier·handle·adaptive toolbar family. 이후 Nelyx가 제공할 theme·control/form·복합 UI/adaptive와 지원 locale·icon/font/data/asset/notice | 06-S는 원본 기본값·플랫폼 선택·위치/overflow·문구/방향·수명과 독립 package 소비를 닫아 01-B에 공급. 이후 Nelyx 디자인/API·지원 locale 목록에 명시한 업무 흐름과 데이터 공급을 수락; 기존 전체 locale 요구는 목록 검토 없이 삭제하지 않음 | **03-S → 06-S → 01-B**. 06-S가 01·04·05 전체 완료를 기다리지 않음. 나머지는 준비된 02~05와 연결. W8-01·08 |
| **W9-07 여섯 플랫폼 runtime/tooling 분리** | host-*·tool-* 실제 이동, SDK/CLI/Metro 선택형 provider, 일반 native header·Skia 단일 소유권·공통 texture/menu·OS 잔여, 여섯 runner/template·배포 코드. native/HTML view와 임베딩 전용 ViewApi/header/texture는 후속 B | Windows/Android/Web 실제 composition·입력·수명·오류. 선택 target만 설치·로드하고 runtime/tooling 역의존 없음. 여섯 target 공급 구성이 새 구조와 일치 | 관련 기능 API가 안정된 뒤. W8-09 |
| **W9-08 개발 갱신·inspector** | state-preserving reassemble/hot reload, 필요한 remount, inspector/source map/preview/service extension·진단, native reload 공급·cleanup | 최종 패키지 구조에서 Web 실제 수정과 State 유지, Windows/Android reload·자원 해제 관찰. typecheck/build만으로 HMR 수락하지 않음 | 06·07 통합 후보. W8-10 |
| **W9-09 필수 실제 환경 수락** | Windows/Android/Web 우선 기능·물리 IME/keyboard·성능/FPS·복구, 연속 resize·hidden/resume·GPU loss·종료, 필요한 기기별 차이. 접근성/reader·네이티브뷰 전용 검증은 후속 | 환경·입력·artifact·측정 방법이 연결된 실제 증거. 자동화/emulator/CPU receiver·submit/retire와 물리 입력/scanout/FPS를 분리 | 앞 단계에서 누적하고 최종 기능 후보에서 정리. W8-11 |
| **W9-10 최종 감사·공급·정리** | Nelyx 필수 명세→구현→테스트 및 호환/제외 결정·출처 감사, package version/range/lock·archive·6 target 공급, 외부 consumer·배포/signing/clean-machine·license/notice·재현 | 우선 후보는 §7의 우선 범위 완료 조건, 후속 통합 후보는 전체 완료 조건 충족. 해당 범위의 기능/의존성·실제 환경·배포 미완료는 담당 단계로 반환. Flutter 전수 동등성은 gate가 아님 | 02~09 결과. W8-12의 공급·출처 의무 승계 |

§9.21의 **01-A → 03-S → 06-S → 01-B** 수락은 보존한다. 앞으로는 02의 필요한 규칙과 **03 우선 잔여 → 04·05의 준비된 우선 흐름 → 06 우선 잔여 → 07 우선 분리 → 08 → 09 우선 수락 → 10 우선 감사·공급**을 진행한다. 각 단계의 접근성·네이티브뷰 잔여와 전용 수락은 §5.4로 이관하며, 이를 먼저 끝내야 다음 우선 단계로 갈 수 있다는 gate를 두지 않는다. 09의 실제 환경 증거는 각 기능에서 누적한다. 우선 범위를 닫은 뒤 **후속 A·B → 09·10의 후속 및 전체 통합 수락**을 수행한다. 기존 단계 번호는 유지하고 우선 범위 완료를 상위 단계 전체 완료로 세지 않는다.

### 5.1 W9-01 선행 작업과 완료 조건

기본 확대경에는 W9-03의 렌더링이, 정식 선택 UI에는 W9-06의 theme/localizations·controls가 필요했다. **이번 W9-01 요청에 이 선행 작업을 포함했고 §9.21에서 최종 통합까지 수락했다.** 아래 표와 실행 순서는 **당시 완료한 묶음의 범위·의존성·수락 기준을 보존하는 이력**이다. 앞으로 같은 기능을 수정할 때는 §0·§4.3·§7의 Nelyx 계약을 적용한다.

| 세부 작업 / 담당 | 현재 상태·시작 위치 | 연결할 구현과 선행 조건 | 종료 조건 |
| --- | --- | --- | --- |
| **W9-01-A 기존 선택 통합 / 01** | **PASS-scoped**, §9.19. DOM ingress·registry/reset/testing·다중 View·선정 controls·3환경 흐름·외부 소비 | 현재 소스/도구/산출물 입력을 먼저 대조. 변경하지 않은 기능을 다시 구현하지 않음 | 기존 원본/Root/브라우저/packed/native receipt를 해당 후보의 증거로 보존. 이후 변경으로 무효화된 범위만 01-B에서 재검증 |
| **W9-03-S 확대 렌더링 기반 / 03** | **PASS-scoped / §9.21 수락**. [Core magnifier](Nelyx/src/framework/widgets/magnifier.ts), [layer](Nelyx/src/framework/rendering/layer.ts), [PaintingContext](Nelyx/src/framework/painting/context.ts), [scene](Nelyx/src/ui/scene.ts), [paint 계약](Nelyx/src/ui/types.ts) | 고정 원본의 RawMagnifier·MagnifierDecoration과 필수 shape/clip/filter 의존성, backdrop 합성·transform·opacity·그림 순서·retained owner를 연결. Web/RN/각 native decoder·supplier의 실제 지원을 조사하고 필요한 구현을 함께 반영. wire/ABI 변경이 필요하면 producer·decoder·version gate·기존 packet 호환을 같은 묶음에서 처리 | 앞서 그린 콘텐츠의 **실제 픽셀 확대** 확인. 자기 장식이 확대 영상에 재포함되지 않는 순서, transform/clip, View 격리, 반복 show/hide·실패·종료의 owner 해제. receiver만으로 backend 수락을 대체하지 않음 |
| **W9-06-S 선택 디자인 기반 / 06** | **PASS-scoped / §9.21 선택 의존성 수락**. [SelectionArea](packages/material/src/selection-area.ts), [adaptive toolbar](packages/material/src/adaptive-text-selection-toolbar.ts), [Material controls](packages/material/src/text-selection.ts), [Cupertino controls](packages/cupertino/src/text-selection.ts) | 03-S를 소비. 먼저 선택 API가 실제 참조하는 canonical theme/localizations와 필수 내부·외부 의존성을 정리한 뒤 Material/Cupertino magnifier positioner·animation/controller, handle·adaptive toolbar 전체 선택 family를 연결. 신규 magnifier/theme/localization 파일은 구현 시 소유 package에 추가 | 원본 플랫폼 기본값·선택 색상·문구/방향·toolbar overflow/anchor·magnifier 화면 경계/행 이동/핸들 표시 정책·listener/timer 해제 확인. 기존 AppTheme/영어 fallback/기본 disabled를 미구현 대체물로 남기고 수락하지 않음. 실제 의존하는 locale 데이터도 공급·출처 확인 |
| **W9-01-B 기본 경로 통합·최종 수락 / 01** | **PASS-scoped / §9.21 완료**. 03-S·06-S와 SelectionArea/Region/overlay/sample 및 동일 archive 수락 | 기본 magnifier configuration과 정식 controls/toolbar를 연결. 사용자 지정 controls·contextMenuBuilder·magnifierConfiguration 및 명시적 disabled 선택은 보존. public direct exports·단일 Core identity·source/dist·origins/coverage·영향 배치를 정합화 | 아래 사용자 흐름과 현재 공급 수락을 모두 통과했을 때만 **W9-01 완료**. 중간 하위 묶음 PASS가 상위 단계 완료로 자동 승격되지 않음 |

**작업 범위와 소유권:** 기존 MagnifierInfo·TextMagnifierConfiguration·MagnifierController와 수락한 handle 구현은 재사용한다. 03-S·06-S가 만든 공통 API는 각 담당 단계의 실제 진척으로 한 번 기록하고 01-B가 같은 결과를 소비한다. 선택 기능과 무관한 전체 디자인 family/locale 잔여는 W9-06에 유지하되, 선택에 필요한 필수 의존성을 나중 단계로 넘겨 01을 먼저 완료하지 않는다. W9-03의 AccessibilityFeatures/OS producer WIP는 03-S와 별개다. 필요 API가 겹치면 기존 WIP를 보존한 채 그 접점만 확인하며 OS 설정 묶음 전체 수락으로 확대하지 않는다.

**W9-01-B 필수 수락 흐름:**

1. 실제 Root에서 여러 문단·WidgetSpan을 선택하고 핸들을 끌며 확대경의 실제 내용·초점·화면 경계·행 전환을 관찰한다. 스크롤/자동 스크롤·text scale·resize 후 선택과 overlay 위치가 유지되어야 한다.
2. Material/Cupertino의 원본 플랫폼 선택 정책, desktop/Web의 확대경 표시/비표시 정책, 명시적 disabled와 사용자 builder override를 비교한다. theme·locale·LTR/RTL 변경, 좁은 폭의 toolbar overflow·copy/select-all·keyboard/우클릭을 함께 확인한다.
3. 확대경·메뉴가 열린 상태에서 route Back·View 종료·다중 View 전환과 실패/재진입을 확인한다. 입력 차단 → drain → 자원 해제를 유지하고 지연 callback·listener/timer·layer/paragraph/overlay owner가 남지 않아야 한다. drain 실패 시 살아 있는 native 자원을 조기 반환하지 않는다.
4. 변경 패키지와 필요한 dependent를 한 번 빌드하고 해당 후보로 원본 의미·영향 Region/overlay/shortcut·실제 Web·Windows·Android 검증을 묶는다. Android 실제 native 실행에서 기본 모바일 확대경을 확인하고, Cupertino는 고정 원본/Root 및 공통 코드·타입 경로로 확인한다. iOS/macOS/Linux 전용 native는 기존 **SKIPPED / provider notVerified** 정책을 유지하며 모사 플랫폼 검사를 실제 Apple native 증거로 쓰지 않는다.
5. 출처·coverage·변경 배치를 갱신한 **동일 archive 후보**로 외부 4조합 소비와 영향 target 공급·실행·종료를 연결한다. §9.19의 `supply-C1NQSI`는 기존 후보의 증거이며 새 확대경 후보로 자동 승계하지 않는다. source/fixture/tool/environment가 같은 과거 검증은 §4.1 기준으로 재사용한다.

03-S의 새 렌더링/ABI처럼 위험이 큰 경계는 초기에 좁은 실제 probe로 확인한다. 모든 하위 작업마다 전체 패키징·3환경 UI 검증을 반복하지 않고, 최종 연결 후보에서 통합 수락한다. 실제 확인이 막히면 항목·환경·재개 조건을 적고 해당 수락은 notVerified로 남긴다. 물리 IME/reader/FPS·전체 앱의 native retirement·최종 6 target 공급은 W9-09·10에서 별도로 닫으며, 선택 기능이 새로 소유한 자원의 해제는 01-B 자체 완료 조건이다.

### 5.2 누락 방지와 자동화 우선순위

- W8-00 승계는 이미 완료한 기반으로 보존한다. W8-01은 06·07, 02~03은 02, 04는 01·03·04, 05는 01·03, 06은 01·04, 07은 05, 08은 06, 09는 01·07, 10은 08, 11은 09, 12는 10이 담당한다.
- W8/W7/W6의 기능 후보와 inventory의 원본 required/dependencies는 추적 자료로 보존한다. 실제 구현 의무는 Nelyx 기능/호환 계약으로 정한다. deprecated·private·조건부·외부 의존성은 선택한 API가 실제 소비하는 범위를 구현/대체하고, 제외 항목은 근거를 남긴다.
- 배치 우선순위는 **현재 사용자 흐름을 막는 의존성 → 여러 family에 반복되는 blocker → 지원 규칙으로 바로 반영 가능한 closure → 단독 수동 adapter** 순서로 판단한다. 쉬운 상수 생성 개수만 늘리는 것을 진척으로 삼지 않는다.
- recipe가 없는 SCC는 Nelyx 기능과의 관계를 먼저 확인한다. 필요한 부분은 생성/독립 구현 담당에 연결하고, 미채택 원본은 근거를 남긴다. 기존 `planned / blocked-semantic / manual-port-required`와 새 설계 분류의 저장 방식은 §5.3에서 연결하며 `resume all`을 전체 SCC 완료로 해석하지 않는다.
- 공통 blocker 수, 새로 닫힌 사용자 흐름, 실제 반영한 closure, 필수 미완료 요구를 진척으로 사용한다. 선언 수만으로 퍼센트를 계산하지 않는다.

### 5.3 W9-02 후속: 명세 기반 컴파일과 숫자 타입 주석

§9.22의 기존 완료 묶음을 보존하고 추가한 **같은 W9-02 단계의 새 요구**다. 아래 1~4는 §9.24에서 구현·검증을 완료했으며 5는 후속 기능 단계의 실행 정책으로 유지한다.

1. **기존 배치에 Nelyx 계약 연결:** 현재 8배치부터 생성 유지/독립 구현 경계, 공개 호환 범위, 필수 기능·수치 계약과 테스트를 명시한다. 기존 state/recipe/evidence 구조를 최소 확장해 Nelyx 수락과 Flutter 참고 비교를 구분한다. 전체 74,297개 원본 재분류를 첫 구현의 선행 gate로 두지 않는다.
2. **검증 gate 전환:** [batch.ts](tools/Nelyx.FrameworkToTypeScript/src/batch.ts)의 수락 fixture와 [batch-evidence.ts](tools/Nelyx.FrameworkToTypeScript/src/batch-evidence.ts)·coverage 연계를 검토한다. Nelyx 명세 PASS와 원본 비교 결과가 독립적으로 기록되도록 하고, Flutter 비교가 없는 독립 구현을 자동 `adapted`/원본 동등으로 표기하지 않는다. 과거 receipt는 그대로 보존한다.
3. **타입 정보 전달·출력:** [body_ir.dart](tools/Nelyx.FrameworkToTypeScript/dart/bin/body_ir.dart) → [body-ir.ts](tools/Nelyx.FrameworkToTypeScript/src/body-ir.ts) → [dart-emitter.ts](tools/Nelyx.FrameworkToTypeScript/src/dart-emitter.ts)에서 §0.3의 타입/추론/nullable·generic 정보를 유지하고 주석을 방출한다. 생성 파일에 수동으로 주석만 붙이는 방식으로 끝내지 않는다.
4. **한 후보로 재생성·수락:** int/double/num, nullable·추론·인자/반환/지역변수·숫자 컬렉션의 주석 정확성과 다중 선언 귀속, public `.d.ts`, 동일 입력 재생성 결정성, 직접 수정/주석 보존·충돌을 기존 fixture에서 확인한다. 선택한 수치 표현의 기능 테스트와 관련 Core/consumer 빌드·타입 검사를 함께 통과시킨다. 주석 전용 변경과 실행 의미 변경의 영향은 구분한다.
5. **후속 기능에 적용:** 03~07에서 원본 내부 재현이 어려우면 Nelyx 구현과 mapping을 선택한다. Scheduler/async·이벤트·접근성·자원 소유권의 정책을 §4.3으로 검증하고, 신규 공개 동작·성능·안정성 요구와 실제 공급을 연결한다.

**종료 조건:** 위 1~4의 도구/대표 배치가 새 계약으로 실제 반영되고, 숫자 주석과 제품 동작·재생성 안전성이 검증되어야 W9-02 후속을 완료한다. 5는 각 기능 단계가 이어받는다. 코드 없는 정책 문서나 컴파일 성공만으로 완료 표시하지 않는다.

### 5.4 후속 작업 — 우선 범위 수락·공급 이후

아래는 기존 단계에서 이관한 범위이며 새 상위 단계가 아니다. 각 단계의 나머지 구현·검증은 이 목록을 기다리지 않고 진행한다.

| 후속 묶음 | 원래 담당 | 남겨둘 구현·수락 |
| --- | --- | --- |
| **A 접근성 설정·서비스·트리** | W9-03·05, 관련 04·06·07 | §10.2 잔여, native tree acknowledgement·실패 owner 회복, OS 설정→실제 View/MediaData, Apple/Linux producer 코드, semantics metadata/action/bridge와 관련 위젯·디자인 접근성 통합 |
| **B 네이티브뷰 임베딩·합성·수명** | W9-07, 관련 03·04·05·08 | §0.4의 native/HTML view·전용 texture/ViewApi 계약, 입력·focus·route/scroll/overlay·reload 연동, 실제 생성/합성/해제·실패/복구 |
| **후속 실제 환경·최종 통합** | W9-09·10 | reader·OS 접근성 action/알림, 네이티브뷰 실제 환경·자원 해제, 변경된 공유 기능 회귀·archive/외부 소비/영향 target 재공급·출처 감사. 전체 완료는 §7 적용 |

후속 시작 때 §9.25의 수락·계약과 당시 이후의 입력 drift를 대조한다. 과거 receipt는 보존하고 변경으로 무효화된 범위를 재검증한다. Apple/Linux 전용 native SKIPPED/provider notVerified 정책은 그대로 유지한다.

## 6. 기록·도구에 쓰는 비용 제한

### 6.1 기존 도구를 우선 사용

재사용할 기반은 `tools/Nelyx.FrameworkToTypeScript`의 batch/cache/3-way merge·source/dist guard·immutable receipt, `archived record: work8`의 recipes/state/origins/ownership, 기존 Root checks와 필요한 source 비교다. 명세·호환·주석 정보는 이 구조에 최소로 연결한다. W9라는 이름 때문에 경로를 모두 복사하거나 `.tmp/work8`을 지우지 않는다.

첫 실행에서는 **검증 목록과 시작/종료·소요시간 기록을 작은 실행 목록으로 정리하는 수준**으로 시작한다. 자동 선택이 실제로 반복 비용을 줄이는 데 필요할 때만 기존 도구에 영향별 실행·receipt 재사용을 최소 확장한다. 새 대시보드·별도 작업 관리 서버·범용 dependency engine을 선행 개발하지 않는다. 영속화가 필요한 도구는 추적 파일로 만들고 scratch one-shot 스크립트를 계속 늘리지 않는다.

### 6.2 현재 handoff는 하나

W9 구현을 시작할 때 기존 handoff.json (당시 기록, 긴급 정리로 삭제됨)을 과거 checkpoint 링크를 보존한 **현재 진입점**으로 갱신한다. 기존 소비 schema를 먼저 확인하고 `activePlan`·현행 checkpoint 포인터를 명시한다. 이번 계획 작성에서는 이 파일을 바꾸지 않는다.

선택 작업 상세는 기존 selection-progress, 배치 상세는 기존 state/origins가 계속 소유한다. handoff에 같은 파일 hash 배열과 전체 실행 이력을 다시 복제하지 않고 해당 기록을 참조한다. W8 pause/strict checkpoint와 receipt는 역사적 증거로 보존한다. 오래된 one-shot checkpoint writer를 새 현재 상태를 만드는 용도로 실행하지 않는다.

기능 묶음 종료 또는 실제 중단 시 아래 정보를 한 번 기록한다.

```text
목표/W9 단계·W8 담당 / 상태:
Nelyx 명세 ID·공개 호환/의도적 차이·필수 품질 기준:
기준 source/tool/pin·현재 후보·변경 범위:
이번에 연결한 사용자 결과 / 미완료 요구:
검증: Nelyx 명세 결과 / Flutter 참고 비교 / 명령·환경·소요시간·receipt:
재사용한 증거와 입력 기준 / stale·FAIL·notVerified·SKIPPED:
다음 수정 파일·symbol / 필요한 원본·검증 / blocker:
보존할 scratch·서버/프로세스 상태 / supply·origin 갱신 여부:
```

### 6.3 효율을 측정하고 조정

첫 두 기능 묶음에서 **탐색·구현·build/test·공급·기록에 쓴 시간**, 같은 입력의 build/test 호출 수, source/dist·receipt 보정에 쓴 시간을 기존 로그에 간단히 남긴다. 자동화 처리 시간과 실제 elapsed를 구분하고 병렬 시간을 중복 합산하지 않는다.

- 같은 입력을 같은 이유로 다시 검사한 횟수의 목표는 **0회**다. 필요한 재검증은 변경/실패/환경 원인을 함께 적는다.
- 첫 관찰 가능한 기능 연결까지의 시간을 줄이고, 검증·기록 때문에 새 사용자 흐름 연결이 계속 미뤄지면 다음 묶음의 범위를 조정한다.
- 동일 빌드가 여러 fixture에서 호출되면 한 후보 빌드로 합치고, 명령이 내부에서 build/supply를 수행하는지도 확인한다.
- 전체 체크가 실제 영향 때문에 필요하면 실행한다. 성능 목표를 맞추기 위해 안전·정합성 gate를 생략하지 않는다.
- 측정 전 “몇 배 빨라진다” 또는 “몇 세션이면 끝난다”는 약속을 하지 않는다. 범위가 큰 만큼 순서를 개선해도 실제 기능 구현·native/물리 수락 시간은 필요하다.

## 7. 완료 판정

**우선 범위 완료:** §0.4에서 후속으로 분리한 항목을 제외한 W9-03~10의 구현·실제 환경·감사·공급 조건을 충족하면 `우선 범위 완료 / 전체 PARTIAL`로 기록한다. 접근성·네이티브뷰와 그 전용 reader/합성/수명 검증은 이 판정의 gate에서 제외하고 §5.4에 남긴다. 일반 native runtime·IME·렌더링·공급 검증은 유지한다. 후속이 남은 상위 단계의 전체 체크는 미완료로 두며, 후속 수락 뒤 영향 통합·공급을 갱신해야 아래 전체 완료를 선언할 수 있다.

**기능 묶음 완료:** Nelyx 명세로 정한 사용자 결과·필수 의존성·공개 호환 범위가 구현되고, 현재 후보의 기능·필요 성능·안정성·Root/실제 backend·공개 소비 수락이 끝나야 한다. 명세/테스트·출처·배치·artifact를 연결하고 Flutter 비교는 참고 결과로 구분한다. 컴파일만 통과한 중간 저장은 PARTIAL이다.

**단계 간 선행 작업:** W9-01-A, W9-03-S, W9-06-S, W9-01-B는 상위 단계의 일부다. W9-01은 §5.1의 선행 작업과 최종 통합이 모두 닫혀야 완료다. 03-S·06-S를 수락해도 W9-03·06의 나머지 필수 범위는 계속 OPEN이며, 상위 단계 수·완료 개수에 하위 묶음을 중복 합산하지 않는다.

**W9 전체 완료:** Nelyx 필수 기능/API·지원 locale·플랫폼·품질 명세가 확정되어 있고, 그 범위의 미구현·미검증 요구와 미연결 필수 의존성이 0이어야 한다. 호환/대체/지원 제외 결정에 근거와 consumer 영향이 기록되어야 하며, Flutter inventory의 missing/partial 0은 완료 조건에서 해제한다. 출처·license·pin·재현과 기존 여섯 target 코드·패키지·runner/template·공급 의무는 유지한다. Windows/Android/Web의 필수 실제 기능·IME·reader·성능/안정성/복구·개발 갱신·외부 소비·배포/notice를 수락하고, W9-02의 숫자 타입 주석과 검증 gate 전환도 완료한다. 범위 분류만으로 선택한 제품 기능의 실패·미검증을 지우지 않는다.

iOS/macOS/Linux는 기존 사용자 결정대로 전용 native build/run·물리 입력·서명·전용 harness를 **SKIPPED**, provider를 **notVerified**로 기록하고 공통 TS·코드 구성은 완료한다. 필요한 장비·권한·서명 환경이 없으면 해당 요구와 재개 조건을 남긴다. 접근 가능한 구현을 계속하되, 미완료 요구가 있는 전체 계획을 완료 처리하지 않는다.

`PASS / PARTIAL / FAIL / SKIPPED / notVerified`를 유지한다. 자동생성량·타입 검사·CPU raster·emulator·과거 설치본·hash 일치가 각각 무엇을 증명하는지 구분한다. 정리는 최종 증거·재현 입력을 보존한 뒤 명시한 소유 경로에만 수행한다.

## 8. 최초 계획 작성의 확인 범위

- 현재 저장소 지침, W8 계획·최근 실행 이력, pause/selection/과거 handoff, batch/build 명령 구현을 읽어 계획을 작성했다.
- 현재 Git 기준과 제품·도구 입력 102개 hash, Flutter pin을 확인했다. runtime·native·browser·전체 coverage 재분석은 수행하지 않았다.
- 변경 대상은 `work9.md` 하나다. W8 구현과 기존 checkpoint·공급 상태는 그대로 유지한다.

## 9. 구현 진행 — 2026-10-14 KST

W9-00은 HEAD `1ada7b5`의 clean 작업 트리와 Flutter pin을 확인하고 완료했다. 기존 handoff를 W9 현재 진입점으로 갱신하고, W8 pause checkpoint는 보존했다. 첫 변경 이후 이전 증거는 현재 코드의 전체 수락으로 승계하지 않는다.

W9-01 **PARTIAL**: DOM host의 동기 `stop`을 bootstrap 정상/실패 종료의 drain 앞에 연결했다. 부분 bind 실패·콜백 재진입·다중 View의 Range/stylesheet 해제와 Core hit-test를 보강했고, pointer capture 해제 뒤 중복 cancel 및 focus-loss 종료 재진입을 방지했다. Material SelectionArea·선택 핸들·선정 toolbar, Cupertino 핸들, direct exports와 sample의 **Select text** 화면을 연결했다.

- [실제 Chromium/CanvasKit/DOM/Root 17그룹](.tmp/work8/selection-context-menu/result-1791974613400.json) **PASS**: 드래그·단축키/clipboard·우클릭/Range·toolbar Copy·transform/clip/가림·wheel·WidgetSpan·두 View·종료. 실제 MaterialApp Overlay, 전체 sample route와 native semantics action 경로도 포함한다. native action 검사의 렌더링은 브라우저이며 Windows 실행 증거가 아니다. drain 실패와 구독 재등록 검사는 제어 receiver다.
- [핸들 원본 비교](.tmp/work8/selection-design/result-1791971099661.json) **PASS**: 고정 Dart 메서드/화가의 18개 입력 × assertions on/off. [외부 packed 소비](.tmp/work8/selection-packages/candidate-sV9PwZ/consumer-result.json) **PASS**: core-only/Cupertino/Material/both, direct ESM/declarations·단일 core identity, WordBoundary 직접 모듈 경로. 이후 공급 archive identity는 별도로 유지한다.
- 공통 `check:types`, Region Root 9그룹, overlay 값 21개/controls 12개 × 2모드, 기본 shortcut Root 10그룹 **PASS**. 실행기는 [run-check.mjs](tools/Nelyx.FrameworkToTypeScript/checks/run-check.mjs)로 20분 상한과 자식 프로세스 트리 종료를 적용한다.
- Windows native v2 boundary/box 바인딩 **PASS-build**: [supplier 입력](.tmp/work8/selection-native-windows/supplier/inputs.json). [현재 공급 후보](.tmp/work8/selection-subscriber-supply.json)를 Windows/Android/Web에 공급하고 Windows/Android 설치·앱 빌드를 완료했다. [native 관찰](.tmp/work8/selection-native-runtime-current.json)은 **PARTIAL**이다. Windows 단어 선택·메뉴·OS clipboard의 정확한 `Select` 문자열·스크롤은 확인했으나 Back 이후 Hermes 실행이 멈추지 않아 정상 종료도 실패했다. 두 실패 후보는 관찰을 보존한 뒤 강제 종료했다.
- Android **PASS-scoped**: Pixel_5 API33 x86_64 에뮬레이터에서 WidgetSpan 단어 선택·Material 핸들·메뉴 Copy·스크롤·Back·Activity 종료를 확인했다. ReactNativeJS/AndroidRuntime 오류 로그는 비어 있다. 실제 clipboard payload, 물리 기기/IME/reader/FPS, 모든 native owner 해제는 별도 미검증이다. 작업용 emulator-5554는 실행 중이다.
- `WordBoundary` 재수출을 직접 모듈로 정리하고 원본 경계 비교 24입력 × 2모드와 고정 Unicode property 표 검사를 통과했다. 패키지 manifest 변경으로 무효화된 [기존 6개 배치](.tmp/work8/selection-direct-batch-requalification.log)를 재수락했다. 이는 새로운 closure 이식 진척이 아니다. [coverage 갱신](.tmp/work8/selection-coverage-adoption.json)은 missing **61,812**, partial **5,982**, adapted **6,494**, implemented **1**, notApplicable **8**이며 원본 identity·pin·기준 차이와 `localSnapshotMatchesPin:false`를 유지한다.

필수 잔여는 Windows/Hermes Back·종료 실패, source platform-view registry/reset/testing API, canonical theme/localizations·기본 모바일 magnifier·전체 adaptive/legacy toolbar, 과거 수동 origin 10개의 stale 수락이다. 신규 origin 10개는 근거와 잔여를 명시한 **PARTIAL**이며 adapted로 승격하지 않았다. W9-02~10과 전체 필수 실제 환경 수락도 계속 OPEN이다. desktop toolbar layout delegate의 superclass·값 동등성 lowering은 아래 W9-02 첫 확장에서 구현했다.

실제 앱 확인에서 MaterialApp에 canonical Overlay가 없어 선택 메뉴가 표시되지 않는 통합 누락을 수정했다. fixture가 자체 Overlay를 제공해 가렸던 문제이므로 fixture 없는 MaterialApp 검사를 추가했다. sample은 상태 표시 갱신이 WidgetSpan을 교체하지 않도록 subtree identity를 유지한다. native semantics 알림의 live Set 순회도 동기 구독 재등록에서 반복 호출되는 결함을 재현해 snapshot 순회로 수정했으나, 이것이 Windows Back 실패까지 해결한 것은 아니다. 원인 없는 동일 native 후보 재실행 대신 현재 handoff의 진단 위치에서 이어간다.

테스트 fixture의 HTTP UTF-8 누락으로 WidgetSpan 문자가 깨졌던 실패는 서버 headers/meta를 수정해 해소했다. 제품 코드를 우회 수정하지 않았으며 실패 receipt도 보존했다. 같은 후보의 성공 검증은 변경·실패·누락 수락이 생길 때만 다시 실행한다.

W9-02 첫 확장 **PASS-scoped / 단계 전체 PARTIAL**: [desktop toolbar recipe](tools/Nelyx.FrameworkToTypeScript/data/work8/recipes/desktop-selection-toolbar-layout.json)로 원본 전체 선언을 생성·반영하고 Material toolbar의 실제 desktop 위치 계산에 연결했다. superclass는 원본의 명시적 type/constructor identity와 검토된 무인자 host 계약이 있는 경우에만 허용한다. 필수 super 인자·명시적 super initializer·상속 저장소 가림·derived assertion/named constructor·mixin은 계속 차단한다. 값 동등성은 resolved `==`에 매핑하고 nullable 비교는 차단한다.

- [원본 비교](.tmp/work8/batches/desktop-selection-toolbar-layout/5dd569bd380c724333b1f0a864eb3b8a1e19b3ddf0fa3be04d7abd3533f313f4/original-comparison.json): 위치 9개·제약 2개·동등성 5개 × 2모드, lowering 차단 6개 **PASS**. Dart geometry/base는 제어 receiver이며 TypeScript는 실제 layout base를 사용한다.
- [현재 브라우저 17그룹](.tmp/work8/selection-context-menu/result-1791975145346.json), [외부 소비 4조합](.tmp/work8/selection-packages/candidate-NZcpUE/consumer-result.json), 공통 types **PASS**. [등록된 7배치](.tmp/work8/desktop-toolbar-all-batch-requalification.log)를 수락했으며 이전 6배치의 제품 본문은 바뀌지 않았다.
- [현재 coverage](.tmp/work8/desktop-toolbar-coverage-adoption.json)는 missing **61,806**, partial **5,987**, adapted **6,495**, implemented **1**, notApplicable **8**이다. class 비교 수락만으로 member/dependency의 partial을 일괄 승격하지 않는다. 원본 pin·identity·기준 차이와 `localSnapshotMatchesPin:false`는 유지한다.

W9-03 첫 연결 **PASS-scoped / 단계 전체 PARTIAL**: `InlineSpan`/`TextSpan`/`WidgetSpan`의 깊은 비교·UTF16/affinity 탐색·Accumulator와 TextScaler 값 비교를 연결했다. `RenderRichParagraph`는 같은 내용·metadata·paint·layout 변경을 구별해 선택 fragment와 이전 frame의 paragraph lease를 보존한다. TextSpan recognizer·cursor·hover를 실제 glyph hit와 sliver 경로에 연결했으며, closest glyph는 Web 엔진 질의와 기존 native packet을 사용한다. native C++ ABI를 추가하지 않았다.

- [고정 원본 18개 span 비교](.tmp/work8/inline-spans-result.json) 19입력 × 2모드, [실제 paragraph Root](.tmp/work8/paragraph-selection-root-result.json) 8그룹, [paragraph picture](.tmp/work8/paragraph-pictures-result.json) 10그룹, [inline intrinsic 원본](.tmp/work8/paragraph-inline-source-result.json) **PASS**.
- [caret/closest](.tmp/work8/text-caret-result.json) 19설정 × 2모드와 [native TS adapter](.tmp/work8/text-boxes-native-result.json) 8그룹 **PASS**. 후자는 제어 native packet receiver이며 C++ 실행 증거가 아니다. 기존 WordBoundary 비교 receipt는 바뀐 fixture 이전의 역사적 증거다.
- [브라우저](.tmp/work8/selection-context-menu/result-1791977725720.json) 19그룹 **PASS**: 실제 link recognizer·hover·자식 텍스트 비전파, 전체 sample에서 선택 유지·부분 스크롤·Back을 포함한다. [외부 packed 소비](.tmp/work8/selection-packages/candidate-0ZnqHn/consumer-result.json) 4조합 **PASS**. 소비 검사에서 드러난 TextPosition 공개 경로 누락을 수정하고 TextRange/TextBox도 직접 모듈 경로로 공개했다. 공통 types **PASS**.
- 마지막 UI export 변경 뒤 [7배치](.tmp/work8/inline-final-batch-requalification.log)를 재수락하고 [coverage](.tmp/work8/inline-coverage-adoption.json)를 갱신했다. required 74,297의 원본 identity·의존성·pin·기준 차이는 유지하며 missing **61,736**, partial **6,057**, adapted **6,495**, implemented **1**, notApplicable **8**이다. `localSnapshotMatchesPin:false`이며 전체 완료율로 해석하지 않는다.
- [현재 기능 공급](.tmp/work8/inline-spans-supply.json)으로 Windows 진단 후보와 Android 일반 Release를 빌드했다. Android 실제 에뮬레이터에서 선택·Copy·스크롤·Back·Activity 종료와 빈 오류 로그를 확인했다. clipboard payload와 물리 입력/reader/FPS는 미검증이다. 공급 archive는 마지막 UI export 추가 이전 manifest이며 동작 소스가 같아도 최종 package identity 수락으로 승계하지 않는다.
- Windows 실패를 [분리 관찰](.tmp/work8/inline-windows-burst-observations.json)했다. 스크롤 없는 Back은 선택 유무와 관계없이 정상이다. **선택·메뉴·Copy 없이 휠 한 번만 돌려도** CPU가 계속 사용되고 Back에 응답하지 않는다. 따라서 기존의 “선택 해제/Back 실패”보다 앞선 Windows 스크롤 경로가 현재 조사 대상이다. rebuild·focus 재진입/반복 microtask·부모 순환 진단은 발동하지 않았다. 임시 계측은 제품 코드에서 제거하고 입력·복원 hash를 보존했다.

Inline semantics/locale/spellOut·diagnostics/equality/hash와 전체 paragraph builder/renderer API는 OPEN이다. 수동 origin 5개를 잔여 명시 **PARTIAL**로 추가했으며 기존 stale origin 10개는 별도다. 현재 다음 작업은 Windows 스크롤 정지 위치 진단과 inline 잔여 closure다. 진행 상태·current receipt·공급 경계는 handoff와 selection-progress에 함께 기록한다.

### 9.1 사용자 요청 중간 마무리 — 2026-10-14 KST

**PAUSED / PARTIAL**, `sessionComplete:false`, `wholePlanComplete:false`. 구현·검증 입력과 실패 증거를 보존했다. W9 checkpoint (보관된 과거 기록 `w9-pause-checkpoint.json`), handoff (당시 기록, 긴급 정리로 삭제됨), selection-progress (보관된 과거 기록 `selection-progress.json`)의 W9 항목이 현재 진입점이다. 기존 W8 pause checkpoint와 과거 receipt는 변경하지 않았다.

- 현재 확인된 진척은 W9-01의 DOM/선택 흐름, W9-02의 첫 desktop delegate 자동 생성, W9-03의 inline 비교·glyph 입력·paragraph 갱신이다. §9에 링크한 원본·Root·브라우저 19그룹·외부 소비 4조합·공통 types·7배치와 coverage 결과를 보존한다. 전체 단계 수락이나 물리/native 전체 수락은 아니다.
- Windows **미해결**: [일반 Release 후보](.tmp/work8/inline-windows-normal-observations.json)는 선택 없이 휠 120을 한 번 입력해도 마지막 스크롤 화면에서 멈추고 Back에 응답하지 않는다. CPU 사용 증가를 확인하고 정확한 후보 경로를 확인한 뒤 강제 종료했다. 선택·메뉴·Copy는 재현에 필요하지 않다.
- [전체 JS loop 계측](.tmp/work8/inline-windows-loop-observations.json), [Nelyx 패키지 계측](.tmp/work8/inline-windows-loop-core-observations.json), [framework 한정 계측](.tmp/work8/inline-windows-loop-framework-observations.json)은 휠→Back과 정상 창 닫기가 가능했다. 반복 한도 초과/오류 보고는 없었다. **코드 생성·심볼 배치·타이밍 차이를 분리하지 못했으므로 제품 수정으로 수락하지 않는다.** 기존 native busy stack은 Hermes 내부 주소만 확인했으며 정확한 JS 위치는 미확정이다. 동일 일반 후보를 이유 없이 반복 실행하지 않는다.
- 임시 runner `App.tsx`·`babel.config.cjs`를 원래 byte hash로 복원했다. [loop](.tmp/work8/inline-windows-loop-inputs.json), [Nelyx](.tmp/work8/inline-windows-loop-core-inputs.json), [framework](.tmp/work8/inline-windows-loop-framework-inputs.json)의 계측 스크립트·복원 기록과 생성 bundle을 유지한다. 작업용 Windows 프로세스와 Pixel_5 `emulator-5554`는 종료했다.
- 현재 공급 archive는 마지막 UI export 추가 이전 manifest다. 최종 공급 수락 때 현재 package manifest와 archive를 다시 연결해야 한다. Inline semantics/locale/spellOut·전체 builder/renderer, platform-view registry, theme/localizations/magnifier/toolbar, stale origin 10개, W9-02~10의 나머지와 W8/W7 승계 요구는 계속 OPEN이다. iOS/macOS/Linux 전용 native는 기존 결정대로 SKIPPED/provider notVerified다.

재개 시 checkpoint hash와 diff를 먼저 확인하고 Windows 정지 원인의 JS/엔진 경계를 좁힌다. 계측으로 증상이 사라지는 현상을 해결책으로 남기지 않는다. 독립적으로 진행할 다음 제품 위치는 `painting/inline-span.ts`, `painting/text-span.ts`, `widgets/widget-span.ts`, `rendering/paragraph.ts`의 source API 잔여다. 문서·체크포인트 저장을 마친 뒤 새로운 구현이나 native 빌드는 시작하지 않았다.

### 9.2 재개·Windows Hermes 휠 정지 해결 — 2026-10-14 KST

HEAD `99000da`의 clean 작업 트리에서 W9 pause의 파일·산출물 **98개 hash**와 Flutter pin을 확인하고 재개했다. 이전 pause 파일은 그대로 유지한다. 현재 상태는 **ACTIVE / PARTIAL**이며 다음 구현 위치는 W9-03 inline semantics/locale/spellOut·source API 잔여다.

Windows 정지는 고정 Hermes **`94aa5e1d`의 `-O` bytecode 생성 결함**으로 좁혔다. 동일한 제품 `Cubic` 선언을 단독 실행해 첫 `.05` 입력에서 정지를 재현했다. 최적화 IR의 분기는 정상이나 bytecode가 `estimate < t` 분기 전에 `start = midpoint`를 수행해 `end`를 바꾸는 경로에서 두 구간값이 함께 좁혀진다. 타이머만 추가하거나 widgets/rendering/gestures만 계측한 후보는 계속 실패했으며, 카운터를 추가하면 증상이 사라진 과거 결과를 제품 수정으로 사용하지 않았다. 실패 로그와 IR/bytecode는 [runtime receipt](.tmp/work8/windows-wheel-runtime-result.json)에 해시로 연결했다.

- Windows sample·생성 template의 Hermes compiler flag를 **`-Og`**로 명시했다. CLI build acknowledgement와 package에 flag를 기록하고 누락되거나 다른 flag인 이전 package를 거부한다. 기존 runner는 새 `build.mjs` 적용 후 재빌드해야 한다. native Debug/Release 구성과 고정 runtime은 유지한다. core 알고리즘에 계측·반복 제한을 추가하지 않았다.
- [compiler 원본 비교](.tmp/work8/windows-hermes-compiler-result.json) **PASS**: 4개 곡선 × 6개 입력의 제품 선언, 고정 Dart 원본 assertions on/off, Node, x64 `-O0`·x64/x86 `-Og`의 실제 precompiled bytecode 결과 일치. CLI 선언 타입과 새 package identity·과거 unsafe package 거부·계측 제거 확인 **PASS**.
- [계측 없는 Windows Release](.tmp/work8/windows-wheel-runtime-result.json) **PASS-scoped**: 복사된 EXE에서 선택 없이 휠→Back, 재진입→`Select` 단어 선택→메뉴 Copy→실제 OS clipboard 정확한 문자열→선택 유지 스크롤→Back, 창 Close 후 정상 프로세스 종료를 확인했다. 실패 후보는 증거 보존 후 정확한 PID/경로를 확인해 종료했고 작업용 프로세스는 남지 않았다.
- **증거 한계:** `-Og`의 성능 영향·FPS는 미측정이다. 물리 IME/reader·모든 native owner counter·최종 clean consumer/공급은 미수락이다. 사용한 공급 archive의 UI export manifest 경계는 §9.1 그대로이며 최종 package 수락으로 승격하지 않는다. 이번 변경은 Windows build/tooling이므로 변경하지 않은 Core/Web/Android 원본 검사·전체 coverage·6 target 공급은 재실행하지 않았다.

### 9.3 Inline semantics·Locale·공급 연결 — 2026-10-14 KST

`Locale`의 원본 alias 표·값 API, `StringAttribute`/`AttributedString`, inline semantics 수집·결합과 locale/spellOut 상속을 구현했다. `RenderRichParagraph`는 의미 label 길이에 맞춘 UTF16 속성 범위, WidgetSpan 사이의 읽기 순서, 별도 링크 action과 metadata 갱신을 연결한다. DOM은 속성 구간별 `lang`·철자 읽기 metadata를 보존하고, React Native는 링크 역할과 identifier를 전달한다. Text lab의 실제 inline 링크가 State를 갱신하며 recognizer는 화면 종료 때 해제된다. 상속 가능한 값 객체는 파생 클래스 필드 초기화를 허용하면서 원본 final 필드를 보호한다.

- [원본 비교](.tmp/work8/inline-spans-result.json) **PASS**: 기존 19입력, semantics 12트리, Locale 88입력 각각 assertions on/off. [paragraph Root](.tmp/work8/paragraph-selection-root-result.json) 9그룹과 [실제 Chromium/CanvasKit/DOM](.tmp/work8/selection-context-menu/result-1791984900417.json) 21그룹 **PASS**. semantic-only 갱신의 paragraph 유지, link action·stale action 거부, 전체 Text lab의 State·스크롤·Back을 포함한다. Core/SDK build와 공통 types도 통과했다.
- [공급](.tmp/work8/inline-semantics-supply-result.json)은 Windows/Android/Web의 동일 후보 archive와 manifest/lock을 연결한다. [외부 소비 4조합](.tmp/work8/selection-packages/candidate-L3AUvy/consumer-result.json)은 **실제 공급 archive**로 direct ESM/declarations·상속·단일 core identity를 확인했다. 마지막 UI export가 빠졌던 이전 공급 경계는 이 후보에서 해소했다. Web static build는 PASS이며 packed Web 실행은 별도 수락이다.
- [Windows 현재 실행](.tmp/work8/inline-semantics-windows-runtime.json) **PASS-scoped**: 복사된 일반 Release, Hermes `-Og`, 링크 역할/id·`Inline link 1`·스크롤·Back, 단어 선택·Copy·OS clipboard 정확한 `Select`·휠·Back·정상 종료. 임시 loop 계측은 없다. 이후 SDK 변경은 아래 Android bridge에 한정하며 Windows/Web 이전 실행을 새 archive의 전체 수락으로 바꾸지 않는다.
- [Android 현재 실행](.tmp/work8/android-semantics-runtime-result.json) **PASS-scoped**: SDK 소유 `NelyxSemantics` protocol1으로 기존 Android의 좌표 기반 재정렬을 바로잡고 논리적 자식 순서·구조 그룹의 읽기 대상 제외·UTF16 `LocaleSpan`/`TtsSpan`을 연결했다. 별도 검증 APK가 실제 `AccessibilityNodeInfo`의 속성 범위와 `ACTION_CLICK → Inline link 1`을 확인했다. 일반 앱에서도 WidgetSpan 선택·Copy·스크롤·Back·Activity 종료, 빈 오류 로그와 설치 APK hash 일치를 확인했다. 검증 APK는 제거했고 작업용 에뮬레이터도 종료했다. 물리 전화기는 건드리지 않았다. raw XML의 비포커스 구조 노드 존재와 실제 `importantForAccessibility` 읽기 대상은 구분한다.
- Android의 첫 GraalVM JDK 빌드는 `JdkImageTransform`에서 실패했으며 Temurin JDK **21.0.11+10**을 명령별로 선택해 해결했다. 원래 실패 로그와 읽기 순서가 틀렸던 후보는 [PARTIAL 이력](.tmp/work8/inline-semantics-android-runtime.json)으로 보존한다. 새 bridge를 사용하려면 JS 패키지와 SDK native 소스를 함께 빌드해야 한다. Android 전용 수정 뒤에는 Android archive 하나만 갱신했고 Core·원본·브라우저·7배치·coverage를 이유 없이 반복하지 않았다.
- 12개 수동 origin을 잔여가 명시된 **PARTIAL**로 등록/갱신했다. 공개 manifest·UI 타입 변경으로 영향받은 7개 기존 recipe를 한 번 재수락했다. [coverage](.tmp/work8/inline-semantics-coverage-adoption.json)는 missing **61,676**, partial **6,117**, adapted **6,495**, implemented **1**, notApplicable **8**이다. required 74,297의 원본 identity·의존성·pin과 `localSnapshotMatchesPin:false`는 유지한다. 새 자동 closure 완료로 세지 않는다.

다음 구현은 **WidgetSpan 추출·scaling wrapper와 연결된 paragraph API**다. 전체 ParagraphBuilder/renderer API, 완전한 diagnostics/hash 원본 비교는 여전히 OPEN이다. Windows range별 언어·spellOut 전달과 실제 reader 발음, 물리 IME/FPS·모든 owner 해제는 미검증이다. DOM의 CSS/metadata나 Android native span/action을 실제 reader 수락으로 승격하지 않는다. W9-01의 registry/theme/localizations/magnifier/toolbar, 과거 stale origin 10개와 W9-02~10의 필수 잔여는 계속 유지한다.

### 9.4 WidgetSpan 추출·배율 연결 — 진행 중

`WidgetSpan.extractFromInlineSpan`의 preorder·글꼴 크기 상속 stack, parent data의 span, `SemanticsTag`/placeholder index tag와 실제 자식 배율 wrapper를 연결했다. RichText의 자식 크기·intrinsic/dry/baseline·hit transform과 retained TransformLayer가 wrapper를 사용하며 문단에서 중복 배율을 적용하지 않는다. 원본 비교에서 드러난 글꼴 크기 0 거부도 수정했다. 현재 내부 `InlineSpanBuilder`를 canonical ParagraphBuilder로 전환하는 작업과 전체 paragraph API는 계속 진행한다.

- 기존 inline 원본 family에 추출 **8트리 × 2모드**를 추가해 통과했다. 실제 Root **10그룹**은 비선형 배율·태그·hit·이전 frame 보존·변환 layer 해제·0 크기를 포함하며, picture **10그룹**, [브라우저 **21그룹**](.tmp/work8/selection-context-menu/result-1791987947856.json), Core build·공통 types도 PASS다. 자세한 receipt와 로그는 selection-progress의 `w9.inline.extraction`에 있다.
- **PARTIAL 경계:** 전체 scaling wrapper 원본 oracle·ParagraphBuilder/PlaceholderDimensions·renderer API와 origin/영향 배치/coverage/packed/native 수락은 묶음 종료 때 연결한다. §9.3의 native 실행·공급과 coverage는 이전 Core 후보의 증거이며, 이번 Core 수정에 자동 승계하지 않는다. 과거 pause와 검증 이력은 유지한다.

### 9.5 ParagraphBuilder·Paragraph와 소유 Web 엔진 — 2026-10-15 KST

`ParagraphBuilder`, `Paragraph`, `ParagraphConstraints`, `LineMetrics`, `GlyphInfo`, `PlaceholderDimensions`를 직접 모듈 경로로 연결했다. `TextSpan.build`·`WidgetSpan.build`와 RichText의 기록 경로가 같은 builder를 사용하며, 잘못된 UTF16의 오류 보고·대체 문자, placeholder 기본 baseline offset과 배율을 보존한다. 실제 layout에는 앱별 `ParagraphContext`를 명시한다. font/image 입력은 builder에서 Paragraph로 이전되고, 이전 frame의 그리기 참조는 재레이아웃과 dispose 뒤에도 유지된다. `Canvas.drawParagraph`도 이 소유권을 사용한다. 호스트의 text/run/line 한도는 계속 명시적이며, 무제한 줄 요청을 128줄로 조용히 자르지 않고 초과 시 이전 layout을 유지한 채 거부한다.

- [Dart 원본 비교](.tmp/work8/paragraph-api-source-result.json) **PASS**: 값 객체 전체 선언 4개와 builder/span/boundary 메서드 6개, assertions on/off. span 6트리·placeholder 8입력·경계 15위치의 affinity를 포함한다. Dart geometry/style/native receiver는 제어 입력이며 전체 Dart UI 엔진 실행은 아니다.
- [실제 Paragraph API](.tmp/work8/paragraph-api-result.json) **12그룹 PASS**, [picture](.tmp/work8/paragraph-pictures-result.json) **10그룹 PASS**, [Root](.tmp/work8/paragraph-selection-root-result.json) **10그룹 PASS**. 무한 폭·UTF16/방향·줄/글자 조회·full metrics·soft hyphen 실제 픽셀·font/image 수명·실패한 재레이아웃·최종 해제를 확인했다. 기존 inline intrinsic 원본과 공통 types도 통과했다. RN TS packet **8그룹**, paint **12그룹**은 제어 native receiver이며 JSI C++ 실행으로 세지 않는다.
- stock CanvasKit 0.41.0이 제공하지 않는 `unscaledAscent`·soft hyphen switch를 소스 바인딩에 추가했다. 고정 Skia **`61e7ca4e...`**, Emscripten **4.0.7**, [원본/패치 lock](Nelyx/skia/eng/source-build/canvaskit.lock.json), [fresh patch](.tmp/work8/paragraph-canvaskit/fresh-patch-result.json), [실제 source build](.tmp/work8/paragraph-canvaskit/runtime-m153-v1/nelyx-build.json)를 연결한다. 빌드는 약 427초로 20분 상한 내 완료했다. WSL `/tmp` 삭제와 supplier의 누락된 standalone build 설정 실패는 로그로 남겼고 영구 캐시·명시적 target/emsdk 설정으로 해결했다. 전역 emsdk 활성화는 하지 않는다.
- **`m153-nelyx-paragraph.1`**을 기본 Web package의 `generated/runtime`에 포함한다. [외부 Web/Metro archive](.tmp/work8/paragraph-web-runtime-package-result.json)에서 실제 WASM 초기화·hash 변조 거부·primary notice 유지 **PASS**. SDK의 실제 fetch/hash/protocol/cache 경로를 거친 [Chromium/CanvasKit 22그룹](.tmp/work8/selection-context-menu/result-1791991176358.json)도 **PASS**다. 최종 sample runner archive 공급·packed app 실행은 아직 별도다.
- 원본 Flutter 엔진의 hinting off·탭 치환·rounding hack off를 Web/RN 변환에 반영했다. **RN은 paragraph API1 native 바인딩을 요구하므로 기존 runner에 새 JS만 공급하지 않는다.** Windows/Android C++ 재빌드·일반 앱 실행은 다음 작업이다. 이 Skia의 `fUnscaledAscent`는 원본 구현 자체에서 ascent와 같으며 그 실제 값을 전달한다. soft hyphen은 줄 metrics가 같아도 픽셀이 달라지는 것으로 검증했다. 잘못된 테스트 기대값을 고친 이력도 보존한다.

소유 runtime의 JS hash는 `cc0c8868...`, WASM은 `0bf2d5bc...`이며 전체 값은 manifest/receipt에 있다. WSL 재사용 위치는 `/home/parti/.cache/nelyx/w9-canvaskit-m153`; Windows 검증 복사본은 `.tmp/work8/paragraph-canvaskit/runtime-m153-v1`이다. [prepare-web-runtime](Nelyx/skia/eng/prepare-web-runtime.mjs)은 source receipt와 lock·산출물을 확인한 뒤 공급하며 앱 시작 때 다운로드하지 않는다.

**남은 범위:** 전체 TextPainter/RenderParagraph·scaled wrapper 원본 수락, 관련 origin/영향 배치/coverage·Core/design 외부 소비와 최종 Windows/Android/Web 공급을 연결한다. Web 엔진 전체 dependency notice inventory는 PARTIAL이다. §9.3의 coverage/native 실행은 이전 후보의 증거로 유지하며 W9-01 나머지, W9-02~10과 W8/W7 필수 잔여를 축소하지 않는다.


### 9.6 Paragraph 현재 공급·실제 앱 수락 — 2026-10-15 KST

동일 [공급 후보](.tmp/work8/paragraph-api-supply-result.json) `supply-pEh69x`를 Windows·Android·Web에 설치하고 archived CLI로 일반 앱을 빌드했다. [Core/design 외부 소비 4조합](.tmp/work8/selection-packages/candidate-FDy5QL/consumer-result.json), 공통 types, [브라우저 23그룹](.tmp/work8/selection-context-menu/result-1791991795796.json) PASS다. sample과 생성 template에 직접 Paragraph API를 사용하는 preview를 추가했다. soft hyphen 표시/숨김, 줄 baseline·첫 glyph bounds를 그리고 즉시 Paragraph를 dispose하므로 실제 frame이 보유한 참조도 함께 사용한다.

- [현재 앱 실행](.tmp/work8/paragraph-cohort-runtime-result.json) **PASS-scoped**: 새 paragraph API1 C++를 Windows와 Android에 재빌드했다. 복사된 Windows EXE와 Android APK에서 preview·1.5배 글자/WidgetSpan·inline link·스크롤·Back을 확인했다. Windows는 `-Og` 일반 후보이며 선택→Copy의 OS clipboard가 정확히 `Select`, 선택 후 wheel→Back→정상 Close와 프로세스 소멸까지 확인했다. 종료 코드는 별도 캡처하지 않았다. Android는 설치 APK SHA 일치·빈 오류 로그·Activity 종료를 확인했고 별도 검증 APK와 작업용 에뮬레이터를 종료/제거했다.
- [Android 실제 native 검사](.tmp/work8/paragraph-android-native-probe-v2/result.json)는 `LocaleSpan`/`TtsSpan`의 UTF16 범위·논리적 읽기 순서·`ACTION_CLICK → Inline link 1`과 clipboard의 정확한 `Select`를 확인했다. preview 추가로 상태 문구가 화면 아래에 있어 첫 probe가 실패했고, 실제 scroll로 노출한 뒤 동일 assertion을 통과했다. 첫 실패는 보존했다. 에뮬레이터 입력·native 속성의 증거이며 물리 기기나 TalkBack 발음 수락은 아니다.
- [복사된 Web 패키지](.tmp/work8/paragraph-packed-web-runtime-result.json)는 archived CLI 서버·SDK runtime loader를 거쳐 실제 포인터 링크 클릭, preview·배율 변경·scroll·Back을 통과했다. 두 줄 링크의 접근성 합집합 사각형 중앙은 글자 사이 빈 공간이었다. 검사 좌표를 관찰한 실제 glyph로 정정했으며 제품을 우회 수정하지 않았다. 초기 실패 receipt와 로그는 보존한다. software WebGL2이며 FPS/scanout 증거가 아니다.
- 공개 export 여섯 개의 manifest 조건을 기존 `default` 형식에 맞추고 실제 private wrapper 및 public/native Paragraph owner의 제한된 coverage mapping을 연결했다. [수동 origin 18개](.tmp/work8/paragraph-origins-result.json)는 잔여가 명시된 **PARTIAL**이다. [기존 7배치](.tmp/work8/paragraph-api-batch-requalification.log)를 재수락했고 [coverage](.tmp/work8/paragraph-coverage-adoption.json)는 missing **61,537**, partial **6,256**, adapted **6,495**, implemented **1**, notApplicable **8**이다. required 74,297의 identity·의존성·pin과 `localSnapshotMatchesPin:false`를 보존했다. 새로운 자동 closure 완료로 세지 않는다.

현재 작업은 full TextPainter/RenderParagraph와 scaled wrapper 원본 비교다. 이번 Windows 관찰 중 접근성 도구의 tree는 이전 Text lab 문구를 유지하는 반면 화면·입력은 정상 갱신됐으므로 Windows 접근성 갱신 수락은 하지 않았다. range별 언어/spellOut·실제 reader/IME/FPS·모든 native owner 해제와 Web 전체 dependency notice inventory도 OPEN이다. 기존 W9-01·02~10/W8/W7 잔여와 stale origin 10개를 유지하며 전체 작업 상태는 **ACTIVE / PARTIAL**이다.


### 9.7 WidgetSpan 배율 wrapper 원본 비교 — 2026-10-15 KST

[고정 private class 전체 원본 비교](.tmp/work8/receipt-history/c629b5aec555eddce0a6509987990292a5920ff7fd2320541b6aea0ffeb8d9d0-widget-span-wrapper-source-result.json) **8입력 × assertions on/off PASS**를 추가했다. intrinsic·dry/wet 크기·baseline·0 배율·자식 없음·hit·retained paint 재사용/해제와 setter의 같은 값·layout invalidation·debug/release assertion을 비교한다. Dart의 RenderBox/Matrix4/PaintingContext는 제어 receiver이고 TypeScript는 공개 extraction을 거쳐 얻은 실제 private wrapper다. 자식 없는 원본 wet layout이 size를 설정하지 않는 경로는 host의 `constraints.smallest` fallback과 구분해 제외했다.

첫 비교에서 좌표 변환의 Z축 배율 누락을 재현했다. 원본 `applyPaintTransform`의 X/Y/Z 배율을 host child transform에 연결하고, paint와 hit의 2차원 평면 계약은 유지했다. 수정 뒤 [실제 Root 10그룹](.tmp/work8/receipt-history/4ed0a85c7a5f1446094d2eb75dca7f5739e12027afb214c403882abd70670f72-paragraph-selection-root-result.json)·[picture 10그룹](.tmp/work8/receipt-history/ccc67ba96ae78eacfe499c3a93e90a6a7f7e3f555f4edfee40df5f690058965d-paragraph-pictures-result.json), inline extraction/build 원본과 Core build PASS다. Root 검사는 이제 소유 `m153-nelyx-paragraph.1`을 로드하고 실제 manifest를 기록한다. 이전 Root receipt가 명시한 stock 0.41.0 실행은 이력으로 보존한다.

같은 파일의 수동 origin 4개를 현재 비교 증거로 갱신하되 **PARTIAL**을 유지했다. 공개 API/coverage 개수·기존 자동 recipe는 이 작은 변환 수정으로 변경하지 않았다. §9.6의 완료한 공급 후보와 native 실행은 정확한 이전 hash로 보존했으며, 이번 Z축 수정이 그 바이너리에 포함됐다고 주장하지 않는다. 다음 TextPainter/renderer 묶음을 연결한 뒤 영향 공급을 한 번 갱신한다. 현재 다음 위치는 **canonical TextPainter 생성자·속성·layout/paint와 RenderParagraph API**이며 전체 작업은 계속 **ACTIVE / PARTIAL**이다.


### 9.8 TextPainter 원본 API·StrutStyle 연결 — 2026-10-15 KST

TextPainter의 `InlineSpan` options 생성자와 명시적 앱 `ParagraphContext`, 속성·placeholder 치수·폭/정렬 cache·layout/paint·LineMetrics/GlyphInfo·정적 측정·scalar helper·debug box·dispose를 연결했다. paint-only 변경은 기존 geometry를 유지하고 실제 paint 때 새 Paragraph를 만든다. 이전 frame은 painter dispose 뒤에도 보유한 입력/문단을 사용할 수 있다. 잘못된 custom span 비교가 paint-only로 크기를 바꾸면 debug 검사가 거부하며, 해제 오류가 생겨도 template와 본문 양쪽의 정리를 시도한다.

- [실제 소유 SkParagraph 검사](.tmp/work8/receipt-history/a0439db16c7c9ca6a9d44333ee79f9c0dffe3e587c9e6a6521af924b5b4861bf-text-painter-canonical-result.json) **11그룹 PASS**: 독립된 직접 Paragraph와 12개 방향/정렬/유한·무한 폭 raster 비교, 폭 cache·배율/template·placeholder·paint-only 지연·이전 frame·실패한 relayout/paint·정적 측정·정리 오류를 포함한다. CPU 엔진이며 native 앱 수락은 아니다.
- [고정 원본 속성 비교](.tmp/work8/receipt-history/6623aa881c607483645dfc6dc62e0f87179e2bfc7c25cf96bfef239300402889-text-painter-properties-source-result.json) **25변경 + StrutStyle 8입력 × assertions on/off PASS**. 생성자·속성 구간·markNeedsLayout·dispose 원문을 사용하고 Dart span/cache/owner receiver의 범위를 명시한다. 여기서 StrutStyle의 공개 값 속성·동등성 누락과 template→본문 해제 순서 차이를 발견해 수정했다. StrutStyle의 fromTextStyle/inherit/merge/package 처리도 전체 원본 class와 비교했다. TextHeightBehavior에 동등성·hash·문자열·flag encoding을 연결하고, RichText 경계는 transport DTO에서 값 객체를 복원한다. 상세 diagnostics/encoding edge case는 별도다.
- [caret 원본 19설정 × 2모드](.tmp/work8/text-caret-result.json), Root **10**, picture **10**, [실제 브라우저 23그룹](.tmp/work8/selection-context-menu/result-1791995701737.json), 기존 TextStyle 원본 **30입력 × 2모드**, Core build·공통 types PASS. caret 참조 엔진의 예전 rounding 기본값을 고정 Flutter의 세 flag 및 소유 runtime으로 정정했으며 허용 오차를 늘리지 않았다. native TS packet **8**과 resource admission **8**은 제어 receiver 검사다.

**진행 경계:** 새 canonical TextPainter의 layout/cache/paint 원본 비교와 전체 RenderParagraph API·renderer 전환은 계속 OPEN이다. 기존 renderer의 `(service, resources)` 생성자 및 captured input 경로는 명시적인 내부 adapter로 유지했고 public closest glyph는 원본 GlyphInfo 계약으로 변경했다. 관련 origin·영향 배치·coverage와 최종 archive/native 공급은 연결된 renderer 묶음에서 갱신한다. §9.6 공급 후보는 그대로이며 이번 코드가 포함됐다고 승계하지 않는다. 전체 목표는 **ACTIVE / PARTIAL**이고 W9-01~10 및 W8/W7 필수 잔여는 유지한다.


### 9.9 Canonical RenderParagraph·원본 layout cache 연결 — 2026-10-15 KST

`Text`와 `RichText`가 canonical `TextPainter`를 사용하는 공개 `rendering/paragraph.RenderParagraph`로 연결됐다. 원본 형태의 생성자·속성, 실제/dry/intrinsic layout과 baseline, inline parent data, paint-only 정렬, overflow/fade·ellipsis를 사용한다. 측정용 Paragraph는 질의가 끝날 때 해제해 기존 64개 live producer 한도에서도 하나의 transient probe로 동작한다. `SelectableText`의 편집용 transport renderer는 별도 이식 대상으로 남긴다.

- [고정 layout/cache/paint 원본 비교](.tmp/work8/text-painter-layout-source-result.json) **16개 span·6방향/정렬 시퀀스 × assertions on/off PASS**. private layout/cache 전체 선언과 선택 메서드를 사용하며 유한/무한 폭, 재사용, 폭 기준 변경, paint-only rebuild, metrics/placeholder offset을 비교한다. Dart Paragraph와 canvas는 제어 receiver다.
- [canonical renderer 실제 엔진](.tmp/work8/receipt-history/ed1fba0720f630784ea6a88fa56839a15afb1a0661b4a0ce0e91ebab4ac553e7-render-paragraph-canonical-result.json) **5그룹**, TextPainter **11**, Paragraph API **13**, Root **10**, picture **10**, [실제 브라우저 23그룹](.tmp/work8/selection-context-menu/result-1791997728180.json), properties/Strut source와 common types **PASS**. fade probe를 layout 때 캐시하고, context 복사에서 font owner sidecar를 보존한다. native TS packet **9**, paint **12**는 소유 Web 엔진 위 제어 native receiver 검사다.
- 무제한 `maxLines: null`을 128로 바꾸면 SkParagraph의 ellipsis가 한 줄 대신 여러 줄이 되는 차이를 재현했다. 이제 엔진에는 무제한을 보존하고 128줄 host 한도는 결과 검증에 적용한다. ellipsis의 정상 overflow는 허용하며, 생략 없는 무제한 초과는 계속 거부한다.
- native 공통 코어가 양의 무한 너비를 거부하던 문제를 수정하고 **native paragraph API2**로 계약을 갱신했다. JSI는 float 변환 전 큰 유한 값도 거부한다. Web API는 기존 **1**을 유지한다. 첫 Windows 빌드는 오래된 generated core를 사용해 수락에서 제외했다. 빌드 도구에 mirror 일치 검사를 추가해 stale 입력 거부를 확인하고, 동기화 뒤 [v2 native 입력](.tmp/work8/render-paragraph-native-windows-v2/supplier/inputs.json)을 재빌드했다. ABI1·wire9는 유지한다.
- [수동 origin 7개](.tmp/work8/render-paragraph-origins-result.json)는 **PARTIAL**이며, 기존 [7배치](.tmp/work8/render-paragraph-batch-requalification.log)를 재수락했다. [coverage](.tmp/work8/render-paragraph-coverage-adoption.json)는 missing **61,427**, partial **6,366**, adapted **6,495**, implemented **1**, notApplicable **8**이다. 전체 74,297의 identity·required·의존성·pin과 `localSnapshotMatchesPin:false`를 보존했다. 현재 파일 hash가 다른 수동 origin은 **17개**이며 단순 hash 교체로 수락하지 않았다.
- [동일 공급 후보](.tmp/work8/render-paragraph-supply-result.json) `supply-nE8HB7`을 Windows·Android·Web에 설치했다. [외부 소비 4조합](.tmp/work8/selection-packages/candidate-43MNq1/consumer-result.json)에서 canonical API의 direct ESM/declarations와 core identity **PASS**다. [복사된 Web 앱](.tmp/work8/render-paragraph-web-observations/result.json)은 실제 링크 클릭·배율/preview·scroll·Back을 통과했고 화면도 확인했다. software WebGL2이며 FPS/물리 입력 증거는 아니다. Windows/Android 일반 앱 build/run도 아래와 같이 확인했다.

전체 renderer 원본 알고리즘·mixin public API·diagnostics/semantics·system-font integration, 편집용 renderer 전환과 필수 전체 native/물리 수락이 남아 있다. §9.6·9.7·9.8의 receipt는 기록된 hash와 일치하는 history 경로로 보존했다. 현재 native API2 공급과 과거 API1 실행 증거를 혼합하지 않는다. W9-01~10 및 W8/W7 필수 잔여를 유지하며 전체 목표는 **ACTIVE / PARTIAL**이다.


[현재 native 앱 수락](.tmp/work8/render-paragraph-cohort-runtime-result.json) **PASS-scoped**: Windows API2 일반 EXE에서 링크 1·1.5배 글자/WidgetSpan·preview·wheel·Back과 단어 선택→Copy의 정확한 OS clipboard `Select`를 확인했다. 선택 후 wheel→Back→제목 표시줄 Close로 **종료 코드 0**을 캡처했고 프로세스도 소멸했다. 이번 관찰의 접근성 tree는 새 route·배율·선택 상태로 갱신됐지만 전체 UIA freshness와 range 언어/spellOut·reader는 별도다. EXE SHA는 `cd343c2b...`이며 전체 값은 receipt에 있다.

Android API2 x86_64 Release APK도 같은 후보로 재빌드했다. Pixel_5 API33 software 에뮬레이터에서 실제 touch 링크·배율·선택/Copy·scroll·Back을 확인했고, [별도 native 검사](.tmp/work8/render-paragraph-android-native-probe/result.json)가 실제 clipboard `Select`, LocaleSpan/TtsSpan 범위·논리 순서·ACTION_CLICK을 통과했다. 설치 APK SHA `7ebcd415...`가 복사본과 일치한다. 오류 로그는 비었고 Activity 종료·probe 제거·소유 에뮬레이터 종료를 확인했다. 복사된 Windows 1,349·Android 1,039·Web 755개 manifest 파일의 hash도 확인했다. [여섯 target 공급·runner 타입 검사](.tmp/work8/render-paragraph-six-target-supply-result.json)도 PASS다. iOS/macOS/Linux의 전용 native 수락은 SKIPPED, provider는 notVerified로 유지한다. macOS npm ci의 generated cache ENOTEMPTY 실패는 보존하고 기존 lock으로 npm install을 완료했으며 세 대상의 외부 의존성 lock이 동일함을 확인했다. 생성 template README의 오래된 버전/계약 표기는 소스에서 정정했으며, 이 문서 두 개의 변경은 다음 CLI archive에 포함한다.

### 9.10 Inline child 원본 계약·읽기 전용 선택 renderer — 2026-10-15 KST

`TextParentData`, `ContainerParentDataMixin`, `RenderInlineChildrenContainerDefaults`와 `ChildLayoutHelper`의 실제 공개 모듈을 연결했다. nullable offset, sibling 연결/제거, 실제 baseline만 사용하는 치수, 앞에서부터 paint/hit하는 순서, 생략된 자식의 4×4 zero transform을 적용했다. 원본 비교가 batch 자식 제거 때 sibling을 먼저 끊지 않던 오류를 찾아 수정했다. `RenderParagraph`의 속성 invalidation·semantics-only 갱신·fade 해제 순서·진단 API·root style 제거도 보완했다.

- [inline/container 전체 선언 비교](.tmp/work8/paragraph-inline-source-result.json)는 **10입력 × assertions on/off PASS**다. 기존 intrinsic/overflow 비교도 유지한다. [renderer 생성자·속성 비교](.tmp/work8/receipt-history/a1f98a57c99a5fffbd08075e707500c55131012796672cfc19f5025dbfd51f2e-render-paragraph-properties-source-result.json)는 **30변경 × native/web × assertions on/off PASS**다. Dart framework/Paragraph/owner는 제어 receiver이며 자동 system-font 통지나 전체 Flutter renderer 실행의 증거가 아니다.
- 읽기 전용 `SelectableText`를 canonical RenderParagraph/TextPainter로 옮겼다. grapheme 이동·directional highlight·배율 변경 시 선택 유지·이전 frame 보존을 연결했다. [실제 canonical 엔진 7그룹](.tmp/work8/receipt-history/6f8acda5feeeb325ea44a886213c86831716654a77035d107a1fe4e86493bcd9-render-paragraph-canonical-result.json), [Root 12그룹](.tmp/work8/receipt-history/7209568f858a7326db175d1dad9bcdf18f201ffb50fa828445a764db7d35244e-paragraph-selection-root-result.json), [picture 10그룹](.tmp/work8/receipt-history/e09564695970cc91073b144d9bba5b8b432c05ef6815595b2ee5a0b1803a9839-paragraph-pictures-result.json), [브라우저 24그룹](.tmp/work8/selection-context-menu/result-1792002514509.json), wrapper 원본·공통 types **PASS**다. 이 구현은 기존 Core의 읽기 전용 host adapter이며 전체 Material SelectableText/EditableText/RenderEditable 이식이나 최종 패키지 소유권 수락은 아니다.
- 첫 공급 `supply-QU3Nur`의 Windows 앱에서 실제 마우스 선택과 Close가 실패했다. [실패 후보](.tmp/work8/render-inline-container-runtime-result.json)를 보존하고 정확한 PID/경로로 정리했다. Root 재현에서 저장한 arena `resolve`가 수신 객체를 잃는 오류를 확인했고, 바인딩만 고친 뒤에도 native 장치 ID와 원본 접촉 ID가 달라 선택이 실패했다. renderer를 원본 `handleEvent` 경로로 연결했다. mouse/touch/pen에서 native ID 0/1을 재사용하는 6접촉, 키보드 포커스, cancel·진행 중 접촉 종료가 모두 통과한다. 단일 첫 클릭의 성공으로 반복 입력을 수락하지 않는다.
- 수정한 [현재 공급](.tmp/work8/render-inline-pointer-supply-result.json) **`supply-Pj2b3P`**의 정확한 archive로 [외부 소비 4조합](.tmp/work8/selection-packages/candidate-ihY9nh/consumer-result.json)과 Windows/Android/Web runner 타입 검사를 통과했다. 변경 없는 native 소스 **147개**는 §9.9 v2 supplier와 두 설치본의 hash가 같다. native paragraph API2·Web API1을 유지하며 기존 라이브러리를 재사용했다. 이전 후보를 현재 수락으로 바꾸지 않았다.
- [복사된 앱 수락](.tmp/work8/render-inline-pointer-runtime-result.json) **PASS-scoped**: Windows에서 본문 드래그 `and`→Shift+Left/Ctrl+C의 실제 clipboard `an`→Shift+Right/Ctrl+C의 `and`, wheel·1.5배 변경 후 선택 유지·Back·Close **exit 0**·프로세스 소멸을 확인했다. EXE는 변경 없는 native 코드이며 **bundle SHA `f4cf753c...`**로 새 JS를 구분한다. Android는 터치 포커스·키보드 단어 선택/복사 `and`, 배율/scroll/Back과 [실제 native 속성·action·clipboard 검사](.tmp/work8/render-inline-pointer-android-native-probe/result.json)를 통과했다. 설치 APK SHA **`4ae72643...`** 일치, 빈 오류 로그·Activity 종료·probe 제거·소유 emulator 종료도 확인했다. Windows 1,350·Android 1,040·Web 756개 manifest 파일 hash를 검증했다. [packed Web](.tmp/work8/render-inline-pointer-web-observations/result.json)의 링크·배율·preview·scroll·Back과 화면 확인도 PASS다. software GPU이며 물리 입력/reader/FPS 수락은 아니다.
- [원본 provenance 8개](.tmp/work8/render-inline-container-origins-result.json)와 [선택 renderer 후속 정정](.tmp/work8/render-inline-pointer-origin-result.json)은 **PARTIAL**이다. [7배치](.tmp/work8/render-inline-container-batch.log)를 재수락하고 [coverage](.tmp/work8/render-inline-container-coverage-adoption.json)를 갱신했다. missing **61,403**, partial **6,390**, adapted **6,495**, implemented **1**, notApplicable **8**이다. 74,297개 identity/required/의존성/pin과 `localSnapshotMatchesPin:false`를 유지한다. 마지막 포인터 수정은 compiler 매핑/공개 export를 바꾸지 않아 coverage를 다시 생성하지 않았다. stale 수동 origin **17개**는 그대로 미수락이다.

다음 구현은 **자동 system-font 변경의 앱/View 수명 연결, 전체 RenderParagraph layout/paint·semantics·diagnostics 원본 잔여, Material SelectableText/EditableText/RenderEditable와 패키지 소유권**이다. 원본 font mixin은 attach/detach listener와 다음 transient frame에서 한 번만 실행하는 통지가 필요하며 현재 `systemFontsDidChange()` 직접 호출 비교만으로 통합 완료라 하지 않는다. iOS/macOS/Linux runner는 §9.9의 이전 공급을 유지하며 전용 native는 SKIPPED/provider notVerified다. 전체 engine notice, Windows range 언어/spellOut·reader/IME/FPS·모든 native owner 수락과 W9-01~10/W8/W7의 필수 잔여도 유지한다. 현재 snapshot은 `w9.inline.inlineContainer`이며 이전 snapshot·pause 파일을 보존했다. 전체 목표는 계속 **ACTIVE / PARTIAL**이다.

### 9.11 System-font 통지·앱/View 수명 연결 — 2026-10-15 KST

앱별 `PaintingBinding.systemFonts`와 원본 `RelayoutWhenSystemFontsChangeMixin`을 실제 renderer에 연결했다. SDK bootstrap이 앱 messenger를 소유한 PaintingBinding을 만들고, `ServicesBinding.handleSystemMessage`가 `flutter/system` 메시지를 override 경로로 전달한다. 각 PipelineOwner는 해당 앱의 signal과 해당 View의 scheduler를 받는다. font 변경은 진행 중인 입력/layout을 즉시 무효화하지 않고 다음 transient frame에서 합쳐 처리한다. scheduler 종료·View 이동·앱 종료 때 대기 callback과 listener를 정리한다.

- [원본 전체 선언 비교](.tmp/work8/system-fonts-source-result.json) **render 7 + notifier 7 시나리오 × assertions on/off PASS**다. 중복 통지, transient/persistent 중 통지, attach/detach assertion, 중복 listener·제거·throw·순회 중 변경·재진입을 비교한다. Dart owner/scheduler는 제어 receiver이고 TypeScript는 실제 factory/PipelineOwner/FrameScheduler/notifier다. 앱 종료와 명시적 View 이동은 원본의 process singleton과 구별한 수명 확장으로 별도 검증했다.
- [실제 Root 13그룹](.tmp/work8/receipt-history/c79bdd2de93ce630ae0e0e3474e3246dad2708d42faab5bf1393ca0a068f7a04-paragraph-selection-root-result.json) **PASS**다. 실제 SDK port·채널을 통해 두 앱·세 View에 통지하고, 다른 앱 격리·View별 transient 갱신·숨긴 View 종료·대기 callback이 있는 앱 종료를 확인했다. 소유 엔진의 실제 paragraph resource가 교체되며, 이전 frame의 문단은 invalidation과 Root 종료 뒤에도 같은 픽셀로 재생되고 마지막 lease를 놓으면 정리된다.
- [실제 브라우저 25그룹](.tmp/work8/selection-context-menu/result-1792003580117.json) **PASS**다. 실제 FontFace를 로드한 `FontFaceSet.loadingdone`이 SDK OS-service→system channel→PaintingBinding→transient frame을 거쳐 SkParagraph를 교체했고 선택 `Select`를 유지했다. 이 검사는 브라우저 통지·문단 재생성의 증거이며 native OS font 설치/제거 통지나 물리 font fallback 결과를 증명하지 않는다.
- 기존 renderer properties **30 × native/web × 2모드**, 실제 renderer **7그룹**, Core·SDK 개별 build·공통 types와 [새 공개 모듈/믹신의 외부 소비 4조합](.tmp/work8/selection-packages/candidate-p5QOdn/consumer-result.json) **PASS**다. source-map 검사로 현재 Core 415·SDK 81개 모듈이 소스와 일치함을 확인했다. native 라이브러리는 바꾸지 않았으며 이번 작은 묶음에서 native 앱을 다시 공급하지 않았다. §9.10의 archive와 copied 앱은 그 당시 hash의 역사적 수락이다.
- [출처 4개](.tmp/work8/system-fonts-origins-result.json)는 **PARTIAL**이고, 공개 class·실제 private notifier·mixin 내부 runtime class만 compiler identity에 연결했다. [7배치](.tmp/work8/system-fonts-batch.log) 재수락 후 [coverage](.tmp/work8/system-fonts-coverage-adoption.json)는 missing **61,387**, partial **6,406**, adapted **6,495**, implemented **1**, notApplicable **8**이다. required 74,297의 identity·의존성·pin과 `localSnapshotMatchesPin:false`를 보존했으며 새 자동 closure 완료로 세지 않는다. 이번 공통 파일 변경을 포함해 stale 수동 origin은 **20개**다.

**남은 범위:** 전체 RenderParagraph layout/paint·semantics·diagnostics 원본 수락, PaintingBinding의 image-cache/codec/evict/shader-warm-up·BindingBase 계약, 동적 FontLoader와 native OS font 변경 producer, Material SelectableText/EditableText/RenderEditable 및 패키지 소유권을 연결한다. 브라우저 observer는 `loadingdone`을 관찰하며 FontFaceSet 삭제/clear와 모든 시스템 font 변경 감지를 완료했다고 주장하지 않는다. 최종 archive/native 공급·물리 IME/reader/FPS·engine notice와 W9-01~10/W8/W7의 필수 잔여도 유지한다. 현재 snapshot은 `w9.inline.systemFonts`이며 전체 목표는 **ACTIVE / PARTIAL**이다.

### 9.12 RenderParagraph layout·paint 원본 비교와 offset/측정 수정 — 2026-10-15 KST

공개 `paint(context, offset)`이 offset을 무시하는 오류와 layout이 필요한 상태에서 문단 질의를 허용하는 차이를 실제 엔진 검사로 재현해 수정했다. `paintLocal`을 통해 일반/읽기 전용 문단의 텍스트·inline child·선택·overflow에 같은 offset을 적용하며 canvas 상태를 복원한다. source `hitTestChildren` 경로도 독립 메서드로 연결했다. debug 문단 질의는 layout이 필요하면 거부하고 paint-only 정렬 변경은 즉시 측정할 수 있다.

- [원본 layout·paint 비교](.tmp/work8/render-paragraph-layout-source-result.json) **18개 원문 메서드/getter·20조건 × assertions on/off PASS**다. intrinsic/dry/wet width 전달, placeholder dimensions, baseline, overflow/fade 결정과 offset을 적용한 clip/layer/text/child/selection/handle 순서, 질의 전 재측정을 비교한다. 양쪽 painter·child·canvas는 제어 receiver이며 실제 shaping은 별도다. 비교에서 무한 폭 intrinsic-height의 `minWidth`를 0으로 바꾸던 차이를 발견해 원본의 Infinity를 보존했다.
- [실제 소유 엔진 10그룹](.tmp/work8/receipt-history/dfe5e28538f54f407e33aa0d38ae7a31d23ebee6ecedbf02b3773de6940f552b-render-paragraph-canonical-result.json) **PASS**다. 두 방향×네 overflow 모드에서 offset 그림을 독립적인 canvas 이동 결과와 비교하고, layout-dirty 질의 6개 거부·paint-only 갱신·두 방향/start-center의 무한 폭 intrinsic height를 확인했다. 이전 frame 보존·inline 자식 생략·cross-owner 거부도 유지한다.
- RTL fade의 임시 TextPainter는 무한 폭 정렬을 위해 두 번 layout한다. 기존 admission은 transient와 replacement를 동시에 거부해 실패했다. 이제 **같은 서비스의 정확한 live layout** 교체를 허용한다. 교체 후 producer 한도는 일반 **64**, 동기 측정 1개를 포함하면 **65**이고 resident **256** 한도는 유지한다. 교체 중 이전/새 producer가 한 번 겹칠 수 있다. 실제 엔진과 [RN TS packet 10그룹](.tmp/work8/text-boxes-native-result.json)에서 64개 문단 옆의 RTL 측정·반복 relayout, 추가 producer/복제 replacement 거부·정리를 확인했다. 엔진 검사에는 실패한 relayout 뒤 이전 문단 보존도 있다. RN 검사는 실제 C++/JSI 실행이 아닌 소유 CPU 엔진 위 제어 native receiver다.
- [Root 13그룹](.tmp/work8/receipt-history/14ad68f2ad1889f16b58bcaf16055663b694cf9de317a2fe14a320d13c21e2dd-paragraph-selection-root-result.json), [picture 10그룹](.tmp/work8/paragraph-pictures-result.json), [브라우저 25그룹](.tmp/work8/selection-context-menu/result-1792005024960.json), Core build·공통 types와 [외부 소비 4조합](.tmp/work8/selection-packages/candidate-fO40hV/consumer-result.json) **PASS**다. 실패 로그는 [offset/query 초기 재현](.tmp/work8/render-layout-paint-before.log), [RTL transient 재현](.tmp/work8/render-layout-paint-engine-v1.log), [intrinsic 원본 차이](.tmp/work8/render-layout-paint-source-v1.log)로 보존했다. 중간 검사의 과도한 폭 기대값은 TextPainter cache가 실제 엔진을 호출하지 않아 잘못됐으므로 Paragraph 엔진 relayout 호출로 고쳤다. 허용 오차나 제품 width 정책을 완화하지 않았다.
- [출처 3개](.tmp/work8/render-layout-paint-origins-result.json)는 **PARTIAL**이다. [기존 7배치의 입력 유효성](.tmp/work8/render-layout-paint-batch-reuse.json)을 확인해 불필요한 재실행을 생략했다. [coverage](.tmp/work8/render-layout-paint-coverage-adoption.json)는 missing **61,386**, partial **6,407**, adapted **6,495**, implemented **1**, notApplicable **8**이다. 74,297 identity/required/의존성/pin과 `localSnapshotMatchesPin:false`를 유지했고, 새 `hitTestChildren` identity만 partial로 연결했다. stale 수동 origin은 **20개**다.

다음은 원본 **SemanticsConfiguration·SemanticsNode·child-configuration result/builder**, 문단의 `describeSemanticsConfiguration`·`assembleSemanticsNode`·child cache·showOnScreen·clearSemantics 연결이다. 현재 `framework/semantics/semantics.ts`에는 tag와 host snapshot helper가 있으며 원본 구성/노드 class는 없다. 이 의존성을 건너뛰어 host `collectSemantics`를 전체 원본 수락으로 바꾸지 않는다. RenderParagraph의 debug rainbow/character-box 분기와 전체 owner 계약, PaintingBinding 이미지/codec·FontLoader/native font producer, Material 편집 API·패키지 소유권, 최종 공급/물리 수락·engine notice 및 W9-01~10/W8/W7의 필수 잔여는 유지한다. 새 native 앱 공급은 하지 않았으며 §9.10의 정확한 바이너리 수락은 역사적 증거다. 현재 snapshot은 `w9.inline.rendererLayoutPaint`, 전체 목표는 **ACTIVE / PARTIAL**이다.


### 9.13 Semantics 값·구성 객체 원본 계약 — 2026-10-15 KST

원본의 상태/flag 값, 정렬 키·custom action·hint, `SemanticsConfiguration`과 자식 구성 결과 builder를 공개 모듈에 연결했다. 병합 시 방향 문자와 UTF-16 attribute 범위를 보존하고, tag의 값 동등성·순서와 copy의 공유/누락 계약을 유지한다. 구성 객체는 기존 `ui/semantics-action`의 action singleton을 사용한다. 아직 문단 renderer의 describe/assemble 경로에는 연결하지 않았다.

- [값 원본 13선언](.tmp/work8/receipt-history/f77ba74d05f31a35268de14931b5dbceb38ff0e22ef9d9cf0b83045f8a44a287-semantics-values-source-result.json)은 flag 27입력·CheckedState 16쌍·Tristate 9쌍, lookup 목록의 고정 길이, 잘못된 입력, 정렬/custom/hint를 debug/release에서 통과했다. 비교 중 release의 covariant 정렬 인수 검사를 보완했다. native flag 초기화만 제어 no-op이며 engine 제출/reader 수락은 아니다.
- [구성 원본 전체 선언](.tmp/work8/receipt-history/eff1e3943cb7243ff78944cb48dcfcb2677f7fe421e236f356bb62718209f5a9-semantics-configuration-source-result.json)은 속성 **66개**, 병합 **27가지**, 일반 action **25개**와 custom action·tag·builder를 **native/web × debug/release PASS**했다. 순회 자식 ID를 먼저 채워 부모 ID가 사라지는 순서 오류를 재현해 수정했다. Dart UI 값/diagnostics는 제어 receiver이며 Uri는 기존 host 문자열 표현이다. 전체 Dart Uri/collection 계약과 SemanticsNode/Owner는 별도다.
- coverage 검토에서 기존 action 클래스의 중복 정의를 발견했다. [기존 SemanticsActionEvent의 handler 조회 실패](.tmp/work8/semantics-configuration-action-identity-before.log)를 보존하고 중복을 제거한 뒤 [같은 검사 PASS](.tmp/work8/semantics-configuration-action-identity-after.log), 두 원본 비교·공통 types·[실제 archive 외부 소비 4조합](.tmp/work8/selection-packages/candidate-uRjxFt/consumer-result.json)을 다시 통과했다. 기존 action 구현과 이전 adapted 출처를 재사용한다.
- [수동 origin 18개](.tmp/work8/semantics-configuration-origins-result.json)는 **PARTIAL**, stale origin은 **20개**다. 공개 export 추가로 package manifest가 바뀌어 [기존 7배치](.tmp/work8/semantics-configuration-batch.log)를 **171.3초**에 재실행했고 현재 입력 일치도 검증했다. [coverage](.tmp/work8/semantics-configuration-coverage-adoption.json)는 missing **60,932**, partial **6,861**, adapted **6,495**, implemented **1**, notApplicable **8**이다. 74,297 identity·required·의존성·pin과 `localSnapshotMatchesPin:false`를 보존했으며 새로운 자동 closure 완료로 세지 않는다.

다음은 원본 SemanticsData/SemanticsNode와 owner 의존성, RenderParagraph의 describe/assemble·stable cache·숨김 bounds·showOnScreen·clearSemantics, 현재 View 전송과의 연결이다. §9.12 브라우저와 §9.10 native 앱 증거는 정확한 과거 후보로 유지한다. 이번 새 API를 해당 앱에서 실행했다고 주장하지 않는다. 전체 W9-01~10 및 W8/W7 잔여를 유지하며 목표는 **ACTIVE / PARTIAL**이다.


### 9.14 Semantics 노드·문단 조립·View 수집 연결 — 2026-10-15 KST

SemanticsData/Node/Owner와 순회·병합·역할 검증을 연결했다. update builder는 입력 배열을 복사하고 build 뒤 재사용을 막는 명시적 host adapter다. RenderParagraph의 describe/assemble·자식 구성 delegate·stable cache·showOnScreen·clearSemantics를 연결했으며, 일반 View에서 링크나 식별자가 있는 문단은 새 source 조립을 사용한다. 기존 inline widget 전송 데이터와 action singleton을 유지한다.

- [노드 원본](.tmp/work8/receipt-history/b8f4314f297e46eb822667a12fd1f21cbd222e9b7391b77ab173de7ab503c4ed-semantics-node-source-result.json) **24시나리오 × native/web × debug/release**, [역할 원본](.tmp/work8/receipt-history/551e0eb927a4c94ce4f7984d52d5edf0aedd0581d0122c4e7a3f60941405cb30-semantics-roles-source-result.json) **29그룹 × 2모드 PASS**다. attach/detach·충돌 ID·dirty·병합·변환·traversal ID·custom action과 제출 시 역할/부모 관계·숫자·확장 상태를 비교한다. Dart vector_math는 실제 패키지이고 geometry/diagnostics/update receiver는 제어 객체다. fixture와 참조 패키지 hash를 기록한다.
- [Data·진단 값](.tmp/work8/receipt-history/76526c3a468dfcac7262760549985f78208dbd69ed4b09729cc01bc5d93348d9-semantics-data-source-result.json) **20입력 + attributed 8 + transform 3 × 2모드 PASS**다. source의 legacy flag 동등성, locale 비교 제외, collection 참조 공유와 JSON transform 복사를 보존한다. host builder의 배열 snapshot·기본값·one-shot·dispose를 별도로 확인했으며 native FFI/float narrowing 수락으로 세지 않는다.
- [문단 source semantics](.tmp/work8/receipt-history/9915601f2f0c9b7880ea31df30fdfb9447a4b1415ead41d24a27d056218513dd-render-paragraph-semantics-source-result.json) **20입력 × 2모드**, [실제 소유 엔진](.tmp/work8/receipt-history/095af133eb1c20c732e9e22bd52fe452e68e0d306a2447b17b7026ae3ca9c33f-render-paragraph-canonical-result.json) **11그룹**, [Root](.tmp/work8/receipt-history/b8b1c933399951d55f9ccc01be52acc67aa14ab7d7769bc8de3a3854b64f9a54-paragraph-selection-root-result.json) **13**, [실제 브라우저](.tmp/work8/receipt-history/326c3f9bc9d8e1cf621254934c87537192352538014d1d5e94f2b2e284f2c9dc-result-1792018456078.json) **25그룹 PASS**다. UTF-16 attributes·placeholder tag 소유권/잘림·노드 재사용·숨겨진 노드의 원래 bounds·현재 rect로 showOnScreen·clear와 오래된 action 제거를 확인한다. host overlay는 기존 clipping을 유지한다.
- Core build·공통 types·[외부 archive 소비 4조합](.tmp/work8/receipt-history/77de7472ffcb08fc04f5912154c0aca992ddc1dc5c510eca16cfb4c0aa8af960-consumer-result.json) PASS다. [수동 origin 34개](.tmp/work8/receipt-history/693b9929c01accce48064f9cfc915632503fa2d5cabed024c65513bad7f14db5-semantics-nodes-origins-result.json)는 **PARTIAL**, stale origin은 **25개**다. RenderObject 변경으로 무효화된 toolbar recipe 하나만 **37.1초**에 재실행했고 [기존 7개 입력](.tmp/work8/receipt-history/b05426834ce18cb79afeea4570ca73b2677f46fd635890c57c83ac5481f39d08-semantics-nodes-batch-current.json)을 확인했다. [coverage](.tmp/work8/receipt-history/bdd026cf246dc89ea87b03180038d4b8a410b2f82594333ca6591e2d1a2e6e0b-semantics-nodes-coverage-adoption.json)는 missing **60,721**, partial **7,072**, adapted **6,495**, implemented **1**, notApplicable **8**이다. 새 211개는 partial mapping이며 74,297 identity·의존성·pin과 `localSnapshotMatchesPin:false`를 보존했다.

남은 경계는 Node 진단/event 전송, 전체 _RenderObjectSemantics/PipelineOwner/View owner와 placeholder-only child 구성 병합이다. 현재 View binding은 transport dispatcher이며 plain/explicit-child 연결만으로 전체 source semantics 트리가 완성됐다고 세지 않는다. 이번 브라우저는 현재 코드지만 §9.10의 native/packed runner는 정확한 과거 후보다. 기존 renderer/debug paint·PaintingBinding·편집·패키지·필수 물리 수락 및 W9-01~10/W8/W7 잔여를 유지한다. 현재 snapshot은 `w9.inline.semanticsNodes`, 목표는 **ACTIVE / PARTIAL**이다.


**중간 기록 — Node 진단/event(아래 §9.15에서 묶음 갱신):** SemanticsNode의 속성 진단·차단 action 표시와 sendEvent, 여섯 event class·Assertiveness를 구현했다. owner의 앱별 messenger로 accessibility 채널을 선택하고 detach 뒤 전송을 중단하며, 비동기 실패를 source FlutterErrorDetails 형태로 보고한다. [원본 비교](.tmp/work8/receipt-history/30004433dd75f223721928b42047bdc083440fd533d31d9e1a782cd950fb25e9-semantics-node-diagnostics-events-source-result.json)는 진단 **16**, event **8**, 잘못된 입력 **6**을 debug/release에서 통과했다. 실제 TS codec·앱별 messenger 격리와 실패 객체 identity도 확인했다. Core **417모듈** build와 [노드 24시나리오 × 4모드](.tmp/work8/receipt-history/6d4e33dfba6abfacb30e9053fe56600c1b3d5b557ffba815a59b7398862c22df-semantics-node-source-result.json) PASS다. 제어 채널 비교이며 DOM/native event delivery나 전체 진단 트리 문자열 수락은 아니다.

현재 작업은 **전체 RenderObject/PipelineOwner/View semantics 파이프라인 연결 중**이며, 입력·다음 source 구간은 `w9.inline.semanticsViewPipeline`에 기록했다. §9.14는 직전 완료 묶음의 불변 증거다. 새 export로 영향받는 배치·공통 types·외부 소비·origin/coverage는 연결된 묶음 종료 때 갱신하며 아직 현재 수락으로 승계하지 않는다. 목표는 계속 **ACTIVE / PARTIAL**이다.


**진행 중 보충 — renderer semantics core:** 구성 provider·parent data·fragment·형제 충돌/병합·geometry·노드 생성과 PipelineOwner flush 큐를 구현했다. Core **418모듈** build와 [고정 전체 helper 선언/flush 비교](.tmp/work8/receipt-history/c0a282403793bd08a8435af9e78d34d1e0c24fa60ad01b5361e610b0825807d3-render-semantics-pipeline-source-result.json) **24시나리오 × native/web × debug/release PASS**다. 실제 TS RenderBox layout/attach와 source Node/Owner를 사용하며, Dart render/geometry/update/timeline은 제어 receiver다. 기존 fixture의 null/identity 행렬 비교 차이를 발견해 실제 고정 matrixEquals 원문을 참조에 넣었으며 초기 실패는 보존했다. 이 단계에서는 owner를 명시적으로 활성화할 수 있었으며 실제 View 연결 전이었다. 다음은 기존 render별 semantics 정책·stable ID/action을 source 구성과 View 전송에 연결하고 child PipelineOwner 수명을 완성하는 작업이다. 묶음 상태는 **IN_PROGRESS**, 전체 목표는 **ACTIVE / PARTIAL**이다.


**진행 중 보충 — 실제 View 연결:** FrameworkRoot가 source owner를 활성화·flush하고 source 노드에서 host snapshot을 전송하도록 바꿨다. renderer별 ID/action·숨김·클립·tag·scroll·custom painter 정책을 source 구성에 연결했다. WidgetSpan-only 텍스트는 source delegate를 통해 문단에 병합되며 tag는 출력 노드가 아닌 실제 child 구성에서 검증한다. 목록은 explicit child 구성을 유지한다. attach 중 구성이 필요해진 Semantics renderer를 생성 시 초기화하고, CustomPaint의 의미 갱신/paint 순환을 분리했다.

[현재 Root](.tmp/work8/receipt-history/fbac95260fb6011d17b209b2ce5a1366fce01a36db26c56d5ba41c6ae7d293c3-paragraph-selection-root-result.json) **15그룹**, [실제 브라우저](.tmp/work8/selection-context-menu/result-1792021076608.json) **25그룹**, Core **419모듈** build와 공통 types PASS다. 새 Root 검사는 이전 snapshot action 차단·IgnorePointer/ExcludeSemantics·opacity/offstage·custom painter cache·마지막 source root detach를 확인한다. source 파이프라인 **24 × 4모드**, 문단 **20 × 2모드**, 실제 엔진 **11그룹**도 기록된 입력에서 통과했다. 마지막 private disabled-action guard 이후에는 Core와 Root/browser를 다시 확인했다. 현재 남은 연결은 child PipelineOwner·manifold·handle 수명이며, 기존 7배치·외부 소비·origin/coverage는 이 묶음 종료 때 갱신한다. native 실행은 계속 §9.10의 역사적 후보이며 전체 상태는 **ACTIVE / PARTIAL**이다.


### 9.15 실제 View source semantics·manifold·핸들 수명 — 2026-10-15 KST

FrameworkRoot가 source 구성·fragment·geometry·SemanticsOwner를 통해 트리를 만들고, 해당 노드에서 host snapshot을 전송한다. WidgetSpan-only 문단도 source delegate로 병합된다. View가 자체 semantics 요청 하나를 소유하고 manifold로 PipelineOwner에 연결하며, 자식 PipelineOwner의 layout/semantics 순서와 attach/detach·adopt/drop을 구현했다. 종료 뒤 남은 외부 핸들을 해제해도 소유자가 다시 생성되지 않는다.

- [파이프라인 원본](.tmp/work8/receipt-history/5810ccfd583119a6381f99ea08061f28ee2ba435fcb410bf5f9495e036ad9665-render-semantics-pipeline-source-result.json) **24 × native/web × debug/release**, [핸들·소유자 원본](.tmp/work8/receipt-history/87051f072024e0ea186a3d080068bebd91b6cc2fa218c82f54854af1d1b7d4a4-semantics-lifetime-source-result.json) **18 × debug/release + 실제 통합 5그룹 PASS**다. 원본 detach가 소유자를 유지하는 동작과 live handle의 비멱등 해제를 보존한다. 실제 중첩 renderer, 부모 갱신/자식 목록 변경 제한과 View 종료 확장을 별도로 검증했다.
- [Node 진단/event](.tmp/work8/receipt-history/fa1215d070ba321d0978ac6c5b77b6af6455ab2fd9456699d6f003e27001f962-semantics-node-diagnostics-events-source-result.json) **진단 16·event 8·잘못된 입력 6 × 2모드**, [노드](.tmp/work8/receipt-history/f61b1f8c78f4a3bbb104425002e67bffa374d4126f7f02b1ad8c20ac894a0b7a-semantics-node-source-result.json) **24 × 4모드**, [역할](.tmp/work8/receipt-history/0ca961ec22f47112f60c2a9b2ad71959757eebf87778ea08bd2b53ed02d2580b-semantics-roles-source-result.json) **29 × 2모드 PASS**다. 앱별 messenger·codec·비동기 오류 객체를 확인했다. source receiver와 host channel 검증이며 실제 platform reader 전송 수락은 아니다.
- [문단](.tmp/work8/receipt-history/6a0a9f9f816ecd082da013708813da57eb0617a1e01c87700a6dc761a966a911-render-paragraph-semantics-source-result.json) **20 × 2모드**, [실제 엔진](.tmp/work8/receipt-history/8da8d0e897882c67f2d71d5c49550aeee7084b76266e8a748e911eec76663ecd-render-paragraph-canonical-result.json) **11**, [Root](.tmp/work8/receipt-history/af3d6f8ac7cd537e1af98e1f96595f44c05bb8680292362888925356fd830860-paragraph-selection-root-result.json) **15**, [브라우저](.tmp/work8/receipt-history/fdd777c57397a5f73594a16d44195f02064a72d2d5f68ae83866cd8a187d2f40-result-1792021987320.json) **25그룹 PASS**다. stable ID/이전 action 차단, hidden/Exclude/IgnorePointer, custom painter cache와 View 종료 시 외부 핸들 3개 해제를 포함한다.
- Core **419모듈** build·공통 types·[외부 archive 소비 4조합](.tmp/work8/receipt-history/66af706f2a09aad1cfaf3fd59d1ededad2690adb9ecd3117ab8d94fdc6465d7a-consumer-result.json) PASS다. event/binding/manifold/owner의 공개 export와 ESM/class identity를 확인했다. package 변경으로 영향받은 [7배치](.tmp/work8/receipt-history/e6fa730fd3816544156328ab4dd3aac21a1f3a291c4168f4ade7db25e2a669e8-semantics-view-batch-current.json)를 **178.6초**에 재검증했다. [수동 origin 29개](.tmp/work8/receipt-history/e65713fc6b24262192dfedff6994853edde409997eefbd43206ca375d56290a7-semantics-view-origins-result.json)는 **PARTIAL**이며 stale origin은 **37개**다.
- [coverage](.tmp/work8/receipt-history/2d8b9461957dc08ef997280e39654a2d363167498191d5b2da3e94118da79bd7-semantics-view-coverage-adoption.json)는 missing **60,640**, partial **7,206**, adapted **6,442**, implemented **1**, notApplicable **8**이다. 새 매핑 **81개**를 partial로 추가했다. CustomPaint 26·pointer blocking 10·opacity 4·semantics gesture handler 13개는 실제 파일 변경으로 과거 adapted 근거가 무효화되어 **53개를 partial로 내렸다**. 현재 좁은 View 검사로 과거 전체 멤버 수락을 승계하지 않는다. 74,297 identity·required·의존성·pin과 `localSnapshotMatchesPin:false`는 보존했다.

다음은 SemanticsService·실제 accessibility event 전달과 View identity 연결이다. 전체 source SemanticsProperties/Widget, Scrollable two-pane 조립, RendererBinding/multi-View, renderer debug paint·PaintingBinding·편집·패키지 잔여와 위 stale 출처를 계속 처리한다. §9.10 native/packed runner는 역사적 증거이며 새 코드의 native·reader·물리 IME/FPS 수락으로 승계하지 않는다. W9-01~10 및 W8/W7 필수 잔여를 유지하며 현재 snapshot은 `w9.inline.semanticsView`, 전체 목표는 **ACTIVE / PARTIAL**이다.


**진행 중 보충 — SemanticsService·실제 Web 전달:** 원본 서비스 메서드와 앱별 messenger, 실제 SDK View 등록/해제 및 implicit View 선택을 연결했다. 문자열 host owner와 별도로 숫자 View identity를 제공하며, 이 포트가 전체 FlutterView의 geometry/rendering API를 구현했다고 세지 않는다. 브라우저 accessibility 채널은 source 방식의 polite/assertive live region·동일 문구 NBSP·다음 event-loop 갱신·300ms 복원을 수행한다. modal 검색은 해당 View 내부로 제한했다.

[서비스 원본](.tmp/work8/receipt-history/bb78a7eaf9439cdde9b5071bdd77b0b199e42cf24444fabac942826a0c566dca-semantics-service-source-result.json) **10 × debug/release + 앱/수명 통합 5그룹**, [Root](.tmp/work8/receipt-history/1f01ee1eeddcd74aac97bd322f2b7184f20b58ba9a50f71d2fcead1a7b2ce21a-paragraph-selection-root-result.json) **15**, [브라우저](.tmp/work8/receipt-history/bdbdbfaec5e0e211299267e2fc7fcc20086edcd5e77c16e44e6edf0807d313cd-result-1792022953740.json) **26그룹 PASS**다. 진행 중 요청을 drain하며 종료 콜백 재진입 오류를 보존하고, 앱 stop에서 View identity와 announcement 타이머를 동기 해제한다. 공통 types와 Core/SDK build도 통과했으며 마지막 본문 변경 뒤 SDK·서비스·Root/browser를 다시 확인했다. 다음은 실제 native View/node 대상 event와 해제 acknowledgement, Web 원본 알고리즘 비교 및 full View 계약이다. 연결된 묶음 종료 때 origin/coverage·외부 소비·7배치를 갱신하며, §9.15는 직전 완료 묶음의 정확한 증거로 유지한다. 전체 목표는 **ACTIVE / PARTIAL**이다.


**중간 기록 — native event 연결과 실제 순서 회귀(아래 §9.16에서 해결):** source 숫자 node ID를 host 문자열 ID와 분리하고 실제 Android control ref로 native tag를 찾도록 연결했다. Android는 announce/tap/longPress/focus/tooltip, Windows는 해당 View의 announce를 처리한다. UI 스레드 실행 acknowledgement를 기다려 종료 drain에 포함한다. [채널 비교](.tmp/work8/receipt-history/4ef628ffc53e1dfa697fb1c0ecdb66515ec246f6e9dc6467cadd6b54e3997567-native-accessibility-channel-result.json)는 고정 Android Java handler **12입력**, Windows 정책 **12입력**, host 수명 **7그룹 PASS**다. Core/SDK·공통 types·Root **15**·브라우저 **26**도 통과했다.

현재 후보 `supply-PYLeFC`에서 Windows C++와 Android Kotlin/C++ 빌드가 통과했다. Windows는 [별도 디렉터리에 1,358파일 복사](.tmp/work8/receipt-history/73708d5492523b50c79c178fd9cf4a9e0c623f25a506204c36ee93fa92197b4a-native-accessibility-windows-package-result.json)했으나 아직 실행하지 않았다. Android는 JBR25/CMake와 GraalVM21/jlink 실패를 보존하고 기존 검증과 같은 Temurin21로 성공했다. [실제 Android probe](.tmp/work8/receipt-history/2a4d9affb2ac310af4a5008cc093af64870495162413556e29699d3c7c7fdef4-result.json)는 **FAIL**이다. inline 읽기 순서가 `Inline link → Inline action → API → tail`로 바뀌어 기존 논리 순서 검사가 실패했고, 새 announcement assertion에는 도달하지 않았다. [전체 native tree/좌표](.tmp/work8/receipt-history/6a5717d6e0c7976033c045f099a2e19985dd2cc67f98c5d5cc08bbb50be417a3-native-accessibility-android-tree.json)를 캡처했으며, Rich body의 큰 rect·placeholder와 OrdinalSortKey 그룹의 source traversal을 재현해 수정하는 것이 다음 작업이다. 테스트 기대값만 완화하지 않는다. 검증 APK를 제거했고 작업 소유 emulator의 종료 응답과 프로세스 소멸을 확인했다. origin/coverage·외부 소비·7배치와 native 수락은 이 연결 묶음이 닫힐 때 갱신한다. 전체 목표는 **ACTIVE / PARTIAL**이다.


### 9.16 SemanticsService·실제 OS 알림과 inline 읽기 순서 — 2026-10-15 KST

SemanticsService의 announce/sendAnnouncement/tooltip과 실제 앱 View identity를 연결했다. 앱별 messenger가 같은 숫자 View ID를 사용해도 서로 격리되고, 폐기된 View나 다른 messenger로 전송하지 않는다. Web은 View 소유 live region과 타이머를 stop 시점에 제거한다. Android는 현재 root/노드 React ref를 확인해 UI 스레드에서 event를 발생시키고, Windows는 해당 View의 실제 island provider로 UIA 알림을 보낸다. native 작업의 UI acknowledgement까지 drain에 포함한다. PlatformViewIdentity는 전체 FlutterView 렌더링 API가 아니다.

- [Service 원본](.tmp/work8/receipt-history/54b6af663d4ed9aee09d0df8965f6401f0384e69388587c6e1d3b3f1d5d12af5-semantics-service-source-result.json) **10입력 × 2모드 + 수명 5그룹**, [Web 원본](.tmp/work8/receipt-history/e3e5ef294684a83a30a10d2e1177e772a422963e3c9f8402969d47214b4bd1b5-browser-accessibility-source-result.json) **16입력**, [native channel](.tmp/work8/receipt-history/a93fbca50b56f8ab9c2bd682e33c2cc08f858406e8528afea5d7a6580c536cf6-native-accessibility-channel-result.json) **Android Java 12·Windows 정책 12·통합 7그룹 PASS**다. Web 원본 비교가 소수 assertiveness의 정수 변환과 잘못된 message 타입 처리 차이 3건을 찾아 수정했다. 원본의 겹친 타이머·modal 복귀·반복 NBSP 동작을 보존한다. 실제 reader 발화는 별도다.
- Android의 이전 순서 실패는 [고정 원본과 실제 캡처 좌표 비교](.tmp/work8/receipt-history/792eb91d766d85ff4045ddc4b93edffaea7cb8849db6f73c03431f35103c70bf-result.json)에서도 재현됐다. 큰 본문 rect와 WidgetSpan의 겹침, placeholder에 없는 정렬 키가 원인이었다. 원본 순회 코드를 바꾸지 않고 Semantics의 source sortKey/container를 연결하여 샘플 inline 컨트롤에 **2.5**를 명시했다. [Root 16그룹](.tmp/work8/receipt-history/194eb81681107c9d66044c118565feedb855414c59ee5ae4c9683955692e7038-paragraph-selection-root-result.json)에서 줄바꿈·1/1.5배·정렬 키 갱신·오래된 action 차단을 확인했다.
- [동일 native 후보 실제 수락](.tmp/work8/receipt-history/26c1f398775ad6bb8a9de6bea5f1e959fa0b57db16106704bdd8ea823bdd55fb-accessibility-native-runtime-result.json) **PASS-scoped**: 공급 `supply-S9K5WH`의 Android x86_64 Release APK SHA `d7b6bea515d3fbe48636ef558674fce5486ec7bd3b5ee4f5cf83589cebcecbbe`가 설치본과 같다. API33 host-Vulkan 에뮬레이터에서 LocaleSpan/TtsSpan, **link→API→Inline action→tail**, ACTION_CLICK 및 OS **TYPE_ANNOUNCEMENT 16384**의 `Text lab announcement`를 확인했다. Activity 종료·probe 제거·소유 에뮬레이터 종료도 확인했다.
- 같은 공급의 **복사된 Windows EXE/bundle**에서 inline UIA 순서·wheel·알림 버튼·Back을 확인하고, 실제 앱 프로세스의 **UIA Other/ImportantMostRecent** 알림을 수신했다. 첫 종료 감시기의 exitCode null은 수락하지 않았으며, 두 번째 실행에서 native process handle로 **Close exit 0·프로세스 소멸**을 확인했다. 복사 파일 **1,358개**의 hash를 검증했다. 두 native 설치본의 Core dist **1,680개**가 현재 코드와 같고 SDK dist **332개** 중 차이는 이후 Web 수정의 JS·두 map **3개**뿐이다. 이 후보를 최신 Web 수정이나 갱신된 coverage metadata가 포함된 최종 archive로 간주하지 않는다.
- [실제 브라우저 26그룹](.tmp/work8/receipt-history/d7d16afded867d8f1904be8c8a727412167259d719cca40ed3fab821be6f0727-result-1792025043836.json), 공통 types와 [같은 공급 Core/design 외부 소비 4조합](.tmp/work8/receipt-history/7db12dead6eeed57fb1691b6e342c310bea98814ba59ded252681118e620041b-consumer-result.json) PASS다. 새 공개 Service/View API와 Semantics 정렬 옵션을 외부 NodeNext 선언·ESM에서 확인했다. 변경된 Semantics 값·구성·Data·Node·진단·role 원본 비교도 다시 PASS다.
- [출처](.tmp/work8/receipt-history/1eae8250ba17bec6493a985655760fad1cf66e61c2c49e1480811ca4212ba58f-accessibility-origins-result.json) **10개 갱신 + 오래된 Semantics 출처 20개 재검증**, 남은 stale **25개**다. 모든 수동 출처는 **PARTIAL**을 유지한다. [7배치](.tmp/work8/receipt-history/19152f4d975d2964e4b1b3184f3d7e71baad37ea4080b6b3cec99156cd031450-accessibility-batch-current.json)를 193.7초에 재수락했다. [coverage](.tmp/work8/receipt-history/31f5b73e22b485bc1ff7df23117d17fe9c905136149ac27927bcd07a32f9c97c-accessibility-coverage-adoption.json)는 missing **60,633**, partial **7,225**, adapted **6,430**, implemented **1**, notApplicable **8**이다. 새 API 7개를 partial에 추가하고 dispatcher 파일 변경으로 기존 pointer/hit-test 12개를 adapted에서 partial로 내렸다. 74,297 identity/required/의존성과 pin, `localSnapshotMatchesPin:false`를 유지한다.

다음은 **source SemanticsProperties→RenderSemanticsAnnotations→Semantics 위젯·Scrollable two-pane 조립**과 실제 native node tap/longPress/focus event 경로다. 전체 FlutterView/RendererBinding/features·native SemanticsUpdate, renderer/painting/편집·디자인/locale·패키지/최종 공급·engine notice와 W9-01~10/W8/W7 잔여를 유지한다. 실제 reader 발화·물리 IME/FPS·전체 native 자원 해제는 notVerified, iOS/macOS/Linux 전용 native는 SKIPPED/provider notVerified다. 현재 snapshot은 `w9.inline.accessibilityService`, 전체 목표는 **ACTIVE / PARTIAL**이다.


**진행 중 보충 — source Semantics annotations:** 원본 `SemanticsProperties` **78개 속성**과 고정 callback **23개**를 가진 `SemanticsAnnotationsMixin`, box/sliver renderer, Semantics/SliverSemantics·Merge/Block/Exclude 위젯을 연결했다. 기존 host ID 사용부도 같은 renderer를 사용한다. [원본 전체 선언](.tmp/work8/receipt-history/f7761340902a69e30df24a66d0364eada16383cd2518739fdb52d4d1184e7e44-semantics-annotations-source-result.json) **22입력 × debug/release**, [실제 Root](.tmp/work8/receipt-history/6f7ce831d74028a904727a46aa01980df5caaac559411e87e7b315009e2b90d4-paragraph-selection-root-result.json) **19그룹 PASS**다. nullable/default/assertion·진단 원본의 value 표기 quirks, 현재 속성으로 callback 전환·제거, 방향/locale 상속·병합/제외/형제 차단과 실제 sliver viewport의 scroll/속성 갱신을 확인했다. Core **421모듈** 빌드도 통과했다.

이 묶음은 아직 **IN_PROGRESS / PARTIAL**이다. 다음은 CustomPainterSemantics의 원본 속성·node 갱신, Scrollable two-pane와 viewport tag 연결 및 실제 native node event다. painter 원본 helper가 attributed text/custom action 속성을 적용하지 않는 차이도 별도로 보존해야 한다. 새 export로 배치 envelope가 무효화됐으며 브라우저·외부 소비·출처/coverage/배치·native 후보는 연결된 구현 종료 때 갱신한다. §9.16 native 수락은 이전 후보의 scoped 증거로 유지한다. 현재 재개점은 [annotations checkpoint](.tmp/work8/semantics-annotations-checkpoint.json)와 `w9.inline.semanticsAnnotations`다.


## 9.17 Source annotations·painter/two-pane·Feedback native 연결 — scoped 수락

`SemanticsProperties` 78속성, 고정 callback 23개의 mixin, box/sliver annotations와 Semantics/SliverSemantics·Merge/Block/Exclude를 연결했다. CustomPainter는 원본 prefix/suffix/keyed node 재사용과 callback 갱신을 사용한다. Scrollable은 원본 two-pane·viewport/cache clip·제외 tag·첫 visible index를 실제 owner에 연결한다.

- [원본 annotations](.tmp/work8/receipt-history/f7761340902a69e30df24a66d0364eada16383cd2518739fdb52d4d1184e7e44-semantics-annotations-source-result.json) **22입력 ×2**, [painter/scroll](.tmp/work8/receipt-history/4ed975b57d50651793fd33a6619a2df889d7cef3390e525a284e177b238e8f9b-painter-scroll-semantics-source-result.json) **13/10 + visit4/clip8/gesture5 ×2**, [fragment pipeline](.tmp/work8/receipt-history/ae9373005ca9a8508dfa19bbaa527a87f478954f620a5a5d30a273edc44debf2-render-semantics-pipeline-source-result.json) **26 ×native/web ×2** PASS다. 원본 painter helper의 attributed/custom-action 누락과 IndexedSemantics 아래 explicit boundary가 viewport tag를 받지 않는 동작을 그대로 비교했다. source fixture는 제어 receiver이고 실제 Root 검증과 구분한다. 이 세 receipt의 직접 입력 hash는 현재와 일치하며 Feedback export 추가 뒤 같은 검사를 반복하지 않았다.
- [Feedback·service](.tmp/work8/receipt-history/70049049bbc00cf27b516fc2383186ac6640d521d6ad71c667d87f749fc37f3c-semantics-service-source-result.json)는 **Feedback24 + sound/haptic11 + SemanticsService10 ×2** 및 service 수명5 PASS다. 이벤트를 먼저 보내는 순서, nullable wrapper, sync/async 오류, iOS 두 요청 drain과 첫 오류를 보존한다. 앱별 messenger를 사용하며 Android root UI-thread 호출과 Web duration mapping을 연결했다. 다른 native sound/haptic provider는 OPEN이다.
- [실제 Root](.tmp/work8/receipt-history/c20d5b75384526de9b47aaab05b2550b3b2523bec786c2b258c857125e10b7bc-paragraph-selection-root-result.json) **22그룹**, [브라우저](.tmp/work8/receipt-history/f503f3e4f4b53a64546a003fe19a84efaecec2485c2bf00ffd1122b21a1ede28-result-1792028685198.json) **26그룹**, [외부 packed 소비](.tmp/work8/receipt-history/76c9567a3843dba305cada9b1d8897d75f15ca84ce3d61a52b82dbe5653735d7-consumer-result.json) **4조합**, Core **425**·SDK **83모듈** build와 공통 types PASS다. 실제 two-pane의 fixed 제외·숨긴 cache·index 0→2·내부 node 재사용/해제, Feedback의 현재 context/source ID·이전 action 차단을 확인했다. 브라우저 첫 실패는 새 버튼 뒤 상태 문구가 고정 scroll 거리 밖에 있었던 fixture 문제이며 제한된 대상 reveal로 고쳤다.
- [동일 native 후보](.tmp/work8/receipt-history/75655dc463a23b3c3573de7bea8758786a6ad515c96c1a866a42a0602426d387-annotations-native-runtime-result.json) **PASS-scoped**다. `supply-cNhRnf`의 복사 APK SHA `2538a92f42053c2440494af56a04a19ea6c800d7acd2865db17d660b9785bdea`가 설치본과 같다. Android13/API33 x86_64 host-Vulkan에서 실제 touch tap·long press와 focus 요청이 **1/2/8** OS 이벤트로 같은 Feedback control에 전달됐다. 알림 **16384**, LocaleSpan/TtsSpan·inline 순서·action도 유지했다. probe·Activity·소유 emulator는 종료했다.
- Windows 복사 파일 **1,363개** hash, 실제 **UIA Other/ImportantMostRecent** 알림, wheel·feedback 요청·Back·제목 표시줄 Close **exit0**를 확인했다. Windows node 이벤트는 고정 원본 정책상 무시하므로 focus 요청 상태를 native focus 전달로 세지 않는다. 두 target의 Core dist **1,700개**, SDK dist **332개**가 현재 컴파일 출력과 byte 단위로 같다. 이후 coverage·문서 변경은 이 archive에 포함되지 않는다.
- [출처](.tmp/work8/receipt-history/a42745cf9d911726bd78b722e7f0a48e1d8070d3b8ad702c0f77f1f71201c998-annotations-origins-result.json) **23개 + event 증거7개**를 갱신했고 stale **58개**를 남겼다. [7배치](.tmp/work8/receipt-history/b9313cefd2ddb685ce881e45566614250451f84780bbe24dafcfd8c0a6c4393f-annotations-batch.log) 재수락 후 [coverage](.tmp/work8/receipt-history/90245f7a37a2452981dfebccd41c7d72532f3eb4d38236b222b3db485370b20d-annotations-coverage-adoption.json)는 missing **60,480**, partial **7,378**, adapted **6,430**, implemented **1**, notApplicable **8**이다. 새 partial153이며 필수74,297 identity·의존성·pin 및 `localSnapshotMatchesPin:false`를 보존한다. 완전 구현이나 전체 Flutter 이식 완료로 올리지 않는다.

다음은 **AccessibilityFeatures→PlatformDispatcher 변경 통지→SemanticsBinding·실제 View→SDK OS 설정 관찰**이다. 전체 RendererBinding/View·native SemanticsUpdate/collection metadata·renderer/painting/편집·디자인/locale·패키지/최종 공급과 W9/W8/W7 잔여를 유지한다. 물리 reader/IME/FPS·sound/vibration·전체 native 자원 해제는 notVerified, iOS/macOS/Linux 전용 native는 SKIPPED/provider notVerified다. 현재 재개점은 [annotations checkpoint](.tmp/work8/semantics-annotations-checkpoint.json)와 `w9.inline.semanticsAnnotations`, 전체 목표는 **ACTIVE / PARTIAL**이다.


## 9.18 사용자 요청 중간 마무리 — PAUSED / PARTIAL

사용자의 **“일단 작업을 중간 마무리해줘”** 요청으로 구현을 중단했다. 재개 기준은 W9 pause checkpoint (보관된 과거 기록 `w9-pause-checkpoint.json`), [현재 feature WIP](.tmp/work8/accessibility-features-checkpoint.json), handoff (당시 기록, 긴급 정리로 삭제됨)다. §9.17은 마지막으로 닫은 scoped 묶음이며 현재 feature 후보의 native·브라우저 증거로 재사용하지 않는다. 사용자 재개 요청 전에는 후속 구현을 시작하지 않는다.

- **구현 저장:** AccessibilityFeatures 11개 getter·값 동등성/표기, dispatcher 설정·semantics-enabled·action 콜백, 플랫폼 요청 handle, 앱별 dispatcher 공유와 View별 post-frame 설정/종료를 연결했다. 실제 Root의 MediaData와 numeric source node action/rect 경로를 연결했다. OS environment에 지원 feature mask를 추가했고 Web reduced-motion→disableAnimations/reduceMotion 및 forced-colors→highContrast를 연결했다.
- **현재 PASS:** Core **427**·SDK **83모듈** build, [공통 types](.tmp/work8/receipt-history/0872137526a731b0d77caedaeb6b3ff9d22b3112339bf5e49ccbaf279ecff03f-accessibility-features-pause-types.log), diff. [원본 비교](.tmp/work8/receipt-history/36b75e29edf3210ede4fbf8dbee2d5a6a599bbf2cd96da066700586f52f1fb70-accessibility-features-source-result.json) **값20·binding13·dispatcher8 ×debug/release**, [실제 Root](.tmp/work8/receipt-history/b54b4d54410ec818a2e8e0f362a75b991315287456283f7f103f26caee2658bd-paragraph-selection-root-result.json) **23그룹**, [기존 수명](.tmp/work8/receipt-history/79013f5e7e0c9401dc84b53be238b7e62ddc58966c86b60eb848416b0e926b72-semantics-lifetime-source-result.json) **18×2 +5 integration**. 두 앱·세 View, 실제 build/post-frame 시점, 다른 앱 격리, source ID action/rect, 제거된 View·종료 callback 차단을 확인했다. Dart notifier/codec/native tree·scheduler는 제어 receiver이며 JS callback context는 명시적 adapter다.
- **미완료:** 실제 브라우저 환경 설정 변경·listener 종료 검증, Android/Windows OS feature producer와 semantics tree 요청의 native 소유권, callback 교체/초기화·정리 실패 통합, 새 export 외부 소비·origins/coverage/배치·현재 native 후보. 새 export 이후 배치 envelope는 stale이며 현재 수동 origin stale는 **61개**다. Coverage는 §9.17의 역사적 집계이며 이번 WIP를 반영하지 않았다.

재개하면 체크포인트 hash·diff를 확인한 뒤 **같은 feature 묶음의 Web 통합 및 실제 OS producer**부터 이어간다. 모든 W9-01~10·W8/W7 잔여와 physical reader/IME/FPS·전체 native retirement 조건을 유지한다. 전체 작업은 완료되지 않았고 상태는 **PAUSED / PARTIAL**이다.

### 9.19 W9-01 registry 잔여·현재 공급 선택 흐름 — 2026-10-15 KST

HEAD `d9d4727`의 clean 작업 트리에서 시작했다. 이전 pause의 변경 입력 **191개**는 일치했고, 이후 체크리스트가 추가된 `work9.md`만 달랐다. Flutter pin은 유지했다. **W9-01 전체는 PARTIAL**이며, 이번 registry와 선정 선택 통합은 [현재 수락 기록](.tmp/work8/w9-01-acceptance.json)의 **PASS-scoped**다.

- `RegisterViewFactory`, `debugOverrideRegisterViewFactory`, `debugResetRegistry`를 공개했다. 실제 DOM factory는 문서별·reset generation별로 한 번 등록된다. reset은 활성 client·기존 binding/Range를 보존한다. 실패 재시도·재진입·등록 중 host 종료를 처리하며, 선택 이벤트나 내용 조회 중 detach/같은 client의 다른 View 재연결은 지연 텍스트를 게시하지 않는다. Core가 DOM을 소유하지 않아 **생성자 대신 첫 live View build에서 등록**하는 차이는 명시적 adapter다.
- [고정 원본 + Chromium/CanvasKit/Root](.tmp/work8/selection-context-menu/result-1792038853721.json) **27그룹 PASS**. 수정하지 않은 Web 원본 전체 선언을 제어 Dart DOM/framework receiver에서 실행한 **8관찰 × assertions on/off**를 실제 browser factory/Range와 비교했다. 문서 격리·reset 후 기존 binding·실패/종료 경합과 기존 선택·키보드·가림/clip·WidgetSpan·다중 View·drain을 포함한다. [디자인 핸들 원본 18입력 × 2모드](.tmp/work8/selection-design/result-1792038924840.json), Core/SDK build와 [최종 공통 types](.tmp/work8/w9-01-final-types.log)도 PASS다.
- **같은 `supply-C1NQSI` archive**를 Windows/Android/Web에 공급·설치했다. [저장소 밖 packed 소비 4조합](.tmp/work8/selection-packages/candidate-UwZAFs/consumer-result.json)은 registry public type/API·direct ESM/declarations·단일 Core identity를 통과했다. 설치된 14 package/target 조합의 모든 dist bytes가 현재 dist와 일치했다. [실제 Web 배포본](.tmp/work8/w9-01-packed-web-v5/result.json)의 단어 선택→정확한 `Select` clipboard→우클릭 Range→선택 유지 wheel→Back/재진입 **5흐름 PASS-scoped**. 초기 harness의 note/list selector와 Escape가 선택을 지우는 기대 오류를 수정했으며 제품 회귀로 기록하지 않았다.
- **Windows PASS-scoped:** 현재 복사된 Release EXE에서 WidgetSpan 문단 단어 선택·정확한 OS clipboard `Select`·선택 유지 wheel·Back을 확인했고 [창 Close exit 0](.tmp/work8/w9-01-windows-exit.json)으로 종료했다. **Android PASS-scoped:** 복사한 x86_64 Release APK의 설치 hash가 일치한다. 소유한 Pixel_5 API33 에뮬레이터에서 long press·Material 핸들/Copy·스크롤·Back을 확인하고 [별도 native probe](.tmp/work8/w9-01-android/probe/result.json)로 clipboard `Select`와 Activity 종료를 확인했다. 오류 로그는 비어 있고 probe와 작업용 에뮬레이터를 정리했다. 기존 boundary v2/box v1/API2 native 공급의 header bytes를 대조했으며, 새 ABI는 추가하지 않았다.
- [7개 배치 재수락](.tmp/work8/w9-01-batches.log), registry 관련 origin **8개** 갱신. [coverage 갱신](.tmp/work8/w9-01-coverage-adoption.json)은 missing **60,445**, partial **7,413**, adapted **6,430**, implemented **1**, notApplicable **8**이다. `missing→partial` 35개 중 registry 6개, 기존 AccessibilityFeatures WIP 공개 선언 29개다. 원본 identity/필수 범위/의존성·pin 및 `localSnapshotMatchesPin:false`를 유지하며 WIP를 구현 수락으로 승격하지 않는다. 무관한 수동 origin **61개** stale는 남아 있다.

**W9-01 종료 조건의 잔여:** 기본 모바일 확대경은 여전히 disabled이며 `RawMagnifier`/backdrop rendering부터 Material·Cupertino positioner/수명 연결이 필요하다. canonical theme/localizations, 전체 adaptive/legacy toolbar family도 OPEN이다. `packages/material/src/selection-area.ts`, `adaptive-text-selection-toolbar.ts`, 두 디자인 `text-selection.ts`, Core `magnifier.ts`가 다음 위치이며 관련 W9-03 렌더링·W9-06 디자인 의존성을 함께 닫아야 한다. 이번 결과로 이 항목이나 W9-01 전체를 완료 표시하지 않는다. 물리 IME/reader/FPS·모든 native owner counter·최종 6 target 공급은 미수락이다. W9-03 OS 설정 WIP와 기존 pause 증거도 그대로 유지한다.

### 9.20 W9-01 확대경·선택 디자인·공급 — 레거시 제거 전 수락 이력

HEAD `42b3fe0`의 clean 작업 트리에서 시작했다. 이전 선택 수락 직접 입력 6개는 일치했고, 별도 접근성 pause 입력은 178개 일치·14개 차이로 직전 registry/공급/계획 변경을 포함했다. Flutter pin과 접근성 pause 파일을 보존했다. [최종 수락 기록](.tmp/work8/w9-01-magnifier-acceptance.json)은 **W9-01 COMPLETE / PASS-scoped**, [현재 체크포인트](.tmp/work8/w9-01-magnifier-progress.json)는 이번 요청 완료·전체 계획 PARTIAL을 구분한다.

- **03-S 수락:** RawMagnifier·MagnifierDecoration, retained BackdropFilterLayer/SceneBuilder/Canvas, Web/RN replay와 공통 native decoder를 연결했다. draw wire **10**의 backdrop opcode와 기존 1~9 호환, source clip/transform·장식 순서·opacity를 구현했다. [Root/CanvasKit 픽셀 6장면](.tmp/work8/magnifier-rendering/result.json), [Windows offscreen Graphite/Vulkan 6장면·잘못된 패킷 8개·wire 1~9](.tmp/work8/magnifier-rendering/native-result.json), [별도 owner·실패 복원·반복·해제 5가지](.tmp/work8/magnifier-rendering/lifetime-result.json)가 PASS다.
- **06-S 수락:** Material/Cupertino 확대경 위치·animation/controller, handle와 adaptive/legacy toolbar family, overflow·paging·anchor·RTL·선택 theme 필드 및 Material 116개/Cupertino 115개 pinned ARB locale 데이터를 연결했다. [위치 원본 14입력 × 2모드](.tmp/work8/magnifier-design-source/result.json), [Root notifier·행 이동·재생성·종료](.tmp/work8/magnifier-rendering/design-root-result.json), [superellipse 경로 11입력 × 2모드](.tmp/work8/superellipse-source/result.json), [layout/AnimatedSize 원본 21입력 × 2모드](.tmp/work8/selection-toolbar-source/result.json), [toolbar Root 9조합 — adaptive motion/입력/종료 5가지와 legacy clipboard/callback/listener 해제 4종](.tmp/work8/receipt-history/d1ec33fff03a68ffb75d0342ec9cc7c74642ad9193fe7609290e79fd3ae3a172-toolbar-root-result.json), [theme·고대비·locale Root 8가지](.tmp/work8/magnifier-rendering/theme-root-result.json)가 PASS다.
- **01-B 수락:** SelectionArea 기본 확대경과 정식 controls/toolbar를 연결했고 사용자 override·명시적 disabled를 보존했다. [실제 Chromium 픽셀·touch 10가지](.tmp/work8/magnifier-web/result.json), [선택 브라우저 27그룹](.tmp/work8/selection-context-menu/result-1792051369913.json), 공통 types와 변경 package/dependent build가 PASS다. 브라우저 Android/iOS 정책 모사는 Apple native 증거가 아니다.
- **동일 공급:** 최종 `supply-7UFIC0` archive 8개의 hash를 [외부 소비 4조합](.tmp/work8/selection-packages/candidate-2PE3F0/consumer-result.json), [영향 3 target의 설치 모듈 15조합](.tmp/work8/w9-01-magnifier-supply-result.json), 복사된 Windows EXE·Android APK·Web 패키지에 연결했다. 이전 후보는 역사적 기록이다. 원본 출처 45개 추가/갱신과 기존 handle 출처 6개 재검토, 7배치 수락, coverage **missing 60,089 / partial 7,769 / adapted 6,430 / implemented 1 / notApplicable 8**를 반영했다. required 74,297개·pin·dependency를 유지했고 새 356개 mapping은 partial이다. 무관한 기존 stale origin 61개는 계속 OPEN이다.
- **실제 앱:** [packed Web 5흐름](.tmp/work8/w9-01-magnifier-packed-web-v3/result.json), Windows 단어 선택→Shift+Right→정확한 `Select ` 복사→한국어 메뉴→wheel→Back→[exit 0](.tmp/work8/w9-01-magnifier-windows-v3/verified-exit.json), Android emulator의 long-press→[기본 확대경 실제 글자 확대](.tmp/work8/w9-01-magnifier-android-v3/magnifier-held.png)→드래그 중 Back→재진입·복사·touch scroll→확대경이 열린 Activity 종료를 확인했다. [별도 native probe](.tmp/work8/w9-01-magnifier-android-v3/probe/result.json)는 ClipboardManager의 정확한 `Select`와 Activity.finish를 확인했다. 현재 APK 설치 hash가 일치하며 native 오류 로그는 비었고 probe·소유 emulator·Windows 프로세스를 정리했다. Android task removal은 전체 native drain/allocation counter 측정이 아니다.
- **수정 중 발견한 문제:** 버튼 semantics 누락·여백 hit 누락, TextSelectionTheme의 DefaultSelectionStyle 전달, ThemeData 밝기 copyWith를 수정했다. Windows는 현재 헤더로 native binding을 재빌드했고 Android는 GraalVM jlink 실패 후 설치된 Temurin JDK 21로 검증했다. Windows UI 도구의 활성화/좌표 오류와 보조 watcher의 exitCode null은 제품 종료 수락에 사용하지 않았으며, 주 검증은 보유 Process.Handle의 exit 0으로 확인했다.

**남은 경계:** 상위 W9-03·06의 나머지 필수 API와 전체 ThemeData·ColorScheme·locale의 비선택 family, 일반 button/icon/font·편집 구현은 계속 OPEN이다. 선택에 사용한 host adapter와 class별 PARTIAL 출처를 전체 Flutter API 완료로 승격하지 않는다. iOS/macOS/Linux 전용 native는 SKIPPED/provider notVerified, physical IME/reader/FPS·전체 native retirement·최종 6 target 공급은 W9-09·10의 잔여다. 별도 접근성 OS 설정 WIP와 기존 pause를 유지한다. 이번 요청 W9-01은 완료했으며 다른 단계의 구현은 재개하지 않았다.

### 9.21 W9-01 후속 — 레거시 선택 API 제거

사용자의 **“레거시는 없에줘”** 요청에 따라 선택 기능의 구형 API를 제거했다. §9.20은 제거 전 `supply-7UFIC0` 수락 이력이며, 현재 후보는 [제거 수락 기록](.tmp/work8/w9-01-no-legacy-acceptance.json)과 [체크포인트](.tmp/work8/w9-01-no-legacy-progress.json)를 따른다. W9-01 후속 요청은 완료했고 전체 계획은 PARTIAL이다.

- **제거:** Material/Cupertino 모바일·데스크톱 구형 controls 4종과 singleton 4개, Core `buildToolbar`·`canCut/Copy/Paste/SelectAll`·`handleCut/Copy/Paste/SelectAll`, 구형 marker/mixin과 판별 함수, overlay의 delegate·clipboard·toolbarLocation 및 별도 toolbar entry를 없앴다. `AdaptiveTextSelectionToolbar`의 positional 호환 생성자도 제거했다. 핸들 controls는 geometry/painting만 제공하며 메뉴는 `contextMenuBuilder`로 통일했다. 구형 이름의 호환 alias는 남기지 않았다.
- **검증:** Core/Cupertino/Material/SDK build와 [전체 types](.tmp/work8/w9-01-no-legacy-types.log) PASS. [값·anchor 21입력 × 2모드](.tmp/work8/selection-overlay-values-result.json), [overlay 원본 11입력 × 2모드](.tmp/work8/selection-overlay-source-result.json), [실제 Root 수명 9그룹](.tmp/work8/selection-overlay-root-result.json), [Region 원본 24입력 × 2모드](.tmp/work8/selectable-region-source-result.json), [핸들 원본 18입력 × 2모드](.tmp/work8/selection-design/result-1792053506195.json), [toolbar Root 5흐름](.tmp/work8/magnifier-rendering/toolbar-root-result.json), [브라우저 선택 27그룹](.tmp/work8/selection-context-menu/result-1792053598000.json)이 PASS다. 원본 비교는 현행 context-menu 경로를 대상으로 하며, 의도적으로 제거한 API의 동등성을 주장하지 않는다. 핸들이 없는 메뉴의 rebuild·확대경 전환·종료도 별도로 확인했다.
- **패키지:** [저장소 밖 소비 4조합](.tmp/work8/selection-packages/candidate-H45SOh/consumer-result.json)에서 현행 direct ESM·declarations·단일 Core identity와 제거한 export의 부재를 확인했다. `supply-Evjcze`의 Core/두 디자인 archive는 이 소비 검증 archive와 byte hash가 같다. Windows·Android·Web runner에 공급·설치했고 [15 package/target의 dist 7,332개 파일 일치](.tmp/work8/w9-01-no-legacy-supply-result.json)를 확인했다.
- **출처·범위:** 구형 class origin 4개를 [retirements](tools/Nelyx.FrameworkToTypeScript/data/work8/manual-retirements.json)에 이관했고 현행 handle/adaptive origin 7개를 갱신했다. [명시적 제거 목록](tools/Nelyx.FrameworkToTypeScript/data/work8/selection-api-retirements.json)의 source API 46개를 향후 자동생성으로 복원하지 않는다. 원본 identity·required 74,297개·pin·의존성은 유지했다. [coverage](.tmp/work8/w9-01-no-legacy-coverage-adoption.json)는 의도적 제거 46개가 partial→missing으로 바뀌어 **missing 60,135 / partial 7,723 / adapted 6,430 / implemented 1 / notApplicable 8**이며, 이 숫자를 구현 향상으로 표시하지 않는다.

**실행 증거 경계:** 이번 후보는 source/Root/browser/외부 소비와 설치 archive까지 검증했다. 새 Windows EXE·Android APK는 재빌드·재실행하지 않았으며 현재 native 실행은 **notVerified**다. §9.20의 native PASS는 이전 후보의 증거로 보존한다. W9-03 접근성 OS 설정 WIP와 원래 pause 파일은 그대로 유지했다.

### 9.22 W9-02 자동생성 처리량 확대 — 2026-10-15 KST

**W9-02의 명시된 묶음 종료 조건을 완료했다.** [수락 기록](.tmp/work8/w9-02-acceptance.json), [현재 입력 검증](.tmp/work8/w9-02-final-validation.json), 현재 handoff (당시 기록, 긴급 정리로 삭제됨)를 진입점으로 사용한다. 시작 HEAD `522fc5b`의 작업 트리는 깨끗했고 이전 checkpoint의 94개 입력과 source pin이 모두 일치했다. 별도 중단한 접근성 설정 checkpoint의 hash는 변경하지 않았다.

- **새 자동 반영 family:** [simulation-wrappers recipe](tools/Nelyx.FrameworkToTypeScript/data/work8/recipes/simulation-wrappers.json)가 고정 원본 `GravitySimulation`·`ClampedSimulation`의 전체 선언을 생성·합성·검증해 실제 Core 파일에 반영한다. 공통 IR/emitter는 일반/혼합 인자, private final 필드, 순서 있는 field initializer·assertion을 처리하며 검토된 무인자 `super()` 전에 식을 평가한다. 명시적 superclass identity, `this` 접근 금지, 필드당 정확히 한 초기화와 host의 derived-state 비관찰 계약을 유지한다. `ClampedSimulationOptions` 공개 이름은 추적 manual input으로 보존했다. `TweenSequenceItem`도 같은 규칙으로 재생성되어 assertion이 필드 저장보다 먼저 실행된다.
- **처리량·계획 연결:** 등록 배치는 **7→8**, 정확한 자동 origin은 **37→39**다. inventory-plan (보관된 과거 기록 `inventory-plan.json`)은 기존 **74,297 required / 763 libraries / 155 SCCs**를 재사용하며 recipe·선언 ID·목적지·의존 ID·component를 연결한다. 누락/중복/다른 pin을 차단하고 미선정 record와 담당은 보존한다. [계획 검증](.tmp/work8/w9-02-plan-result.json) PASS. SCC 전체를 recipe 등록만으로 생성 완료 처리하지 않는다.
- **의미·통합·재생성 검증:** 새 family는 13개 simulation 설정·7개 시점 × debug/release, 생성자 순서/실패 7경계, 잘못된 lowering 5경계와 실제 `AnimationController`/`Ticker`/`FrameScheduler`의 초↔밀리초·clamp·완료·취소를 통과했다. [기존 수명 검증](.tmp/work8/batch-lifecycle-result.json) 6그룹은 동일 입력 재사용·직접 수정 보존·충돌·base 유실·source drift·반영 중 편집 보호를 확인했다. 첫 lifecycle 명령의 exit 2는 별도 SpringDescription 방어 fixture가 새 ordered IR을 함께 갱신하지 않은 오류였다. fixture를 고쳐 실패한 배치만 다시 실행했고 [최종 8배치 수락](.tmp/work8/w9-02-batch-final.log)은 exit 0이다. [Core build](.tmp/work8/w9-02-core-build.log), [도구 types](.tmp/work8/w9-02-tool-types.log), [공통 types](.tmp/work8/w9-02-common-types.log), 현재 dist/source-map·direct ESM 검증도 PASS다. 테스트 명령은 1,200초 상한을 적용했다.
- **출처·coverage:** [갱신 수락](.tmp/work8/w9-02-coverage-adoption.json)에서 원본 identity·required·dependency·pin과 `localSnapshotMatchesPin:false`를 유지했다. 두 class만 새 자동 근거로 partial→adapted이며, 변경된 제품 byte에 대한 예전 member 수락 19개는 adapted→partial로 되돌렸다. 현재 **missing 60,135 / partial 7,740 / adapted 6,413 / implemented 1 / notApplicable 8**이다. class 수락으로 member 검증을 일괄 승계하지 않는다.

**남은 경계:** explicit/super-formal 생성자, mixin, runtime generic token, async/collection·무제한 numeric 및 아직 매핑되지 않은 외부/conditional 의미는 후속 W9-03~07의 실제 기능 closure와 W9-10 감사에서 계속 처리한다. 이는 이 단계의 조건인 “새 family·여러 대상의 공통 blocker·남은 SCC 연결”을 넘는 전체 compiler/SCC 완료 주장이 아니다. 새 tool revision의 Git 특정 base 재현도 최종 재현 작업에 남기고 기존 `tool-base.json`은 역사적 기록으로 유지한다. 이번 순수 Core/생성기 변경에는 새 browser/native 실행·runner 공급을 수행하지 않았으며 이전 W9-01 증거는 그 cohort에 한정한다. W9-03 접근성 WIP, 전체 W9/W8/W7 잔여와 실제 환경 수락은 **PARTIAL/notVerified**를 유지한다.

### 9.23 계획 개정 — Nelyx 독립 구현·자체 명세·숫자 타입 주석

**2026-10-15 KST / 문서만 변경.** 사용자의 설계 방향에 따라 §0·3~7·10을 개정했다. Flutter의 Widget→Element→RenderObject·제약 레이아웃·선언적 UI·컴포지팅은 계승하고, Scheduler/이벤트/접근성/소유권/플랫폼은 TypeScript·Hermes/Deno에 맞게 독립 설계한다. 필요한 공개 호환 범위를 명시하고 최종 gate를 Nelyx 기능·성능·안정성 명세로 전환한다. 원본 inventory 전수 구현·예외 동작 재현은 제품 완료 조건에서 해제하되 출처·license와 선택한 기능의 필수 의존성·품질·플랫폼 수락은 유지한다.

Dart 숫자 타입 주석의 위치·형식·정보 보존·재생성 수락 조건은 §0.3·§5.3에 추가했다. §9.22의 W9-02 완료는 기존 simulation 묶음의 수락이며, **새 명세 gate·숫자 주석 후속 작업은 미착수**다. 이번에는 생성기·제품·배치 상태·coverage·handoff·pause checkpoint를 변경하지 않았고 build/runtime도 실행하지 않았다. 기존 tool이 새 정책과 주석을 이미 지원한다고 해석하지 않는다. 다음 구현 시 이 계획을 우선 읽고 현재 입력을 확인한 뒤 기존 기록에 새 수락을 연결한다.

### 9.24 W9-02 후속 완료 — Nelyx 계약 gate·Dart 숫자 주석

**2026-10-15 KST / COMPLETE-scoped, 전체 제품 PARTIAL.** 수락 기록 (보관된 과거 기록 `w9-02-followup-acceptance.json`), 현재 handoff (당시 기록, 긴급 정리로 삭제됨). 시작 HEAD `42fea9c`의 깨끗한 작업 트리와 8배치 제품·도구 해시를 확인했다. §9.22의 수락은 보존하고 §5.3의 **1~4**를 이번 후보로 완료했다. 5의 기능별 명세·adapter 선택은 03~07에서 이어간다.

- **계약·gate:** 기존 8 recipe에 계약 ID, 선택 공개 API, 호환 분류, generated/adopted 소유권, 필수 동작·수치 정책·의도적 차이·성능 조건을 연결했다. 필수 `validation`은 Dart 실행에 의존하지 않는 [Nelyx fixture](tools/Nelyx.FrameworkToTypeScript/checks/nelyx-batch.ts)다. 기존 fixture는 별도 `sourceComparison`으로 실행한다. 명세 실패는 반영을 차단하며 참고 비교는 PASS/FAIL/notRun을 독립 기록한다. 참고 입력 drift는 stale로 표시하고, 비교 없는 독립 구현의 Nelyx PASS를 원본 `adapted`로 승격하지 않는다. 제외된 계약·소유권 불일치도 반영을 차단한다.
- **숫자 정보:** analyzer → resolved IR → TS AST emitter에서 int/double/num/BigInt, nullable, 추론/명시, List/Map의 숫자 인자와 numeric generic bound를 전달한다. 필드·상수·각 지역 선언·초기화 임시값에 `@dartType`, 원래 인자 이름에 `@dartParam`, 반환/getter에 `@dartReturn`을 생성한다. Origin 태그와 `@dartBound`로 추론 여부·bound를 보존한다. 무타입 반환이 실제로 dynamic으로 해석되면 값 모양으로 추측하지 않고 계속 차단한다.
- **실제 재생성:** **8배치 / 9개 모듈 / 39 origin**을 새 계약으로 반영했다. 현재 모든 배치의 Nelyx 명세와 별도 원본 비교가 PASS다. generated/effective/제품 해시가 일치하며 public **37개 선언**의 숫자 태그가 Core `.d.ts`에 보존된다. 제품 변경은 주석뿐이고, 주석 제거 후 TS transpile 결과가 시작 HEAD와 동일함을 검사했다.
- **안전성·기능:** [숫자 fixture](tools/Nelyx.FrameworkToTypeScript/checks/numeric-provenance.ts)의 실제 Dart 선언 18개(17개 생성·dynamic 1개 차단), 결정성·다중 선언 귀속·options/getter/temp·nullable/collection/bound·BigInt identity·safe integer 경계 PASS. [lifecycle](tools/Nelyx.FrameworkToTypeScript/checks/batch-lifecycle.ts) **10개**와 수동 선언 보존 **3개**, coverage evidence **10개** 검사 PASS. compose probe가 바꾼 effective draft도 마지막 명시적 promote로 복원·재검증했다. BigInt 산술·범용 Dart 숫자 ABI를 지원한다고 확장하지 않는다.
- **빌드·소비·성능:** Dart frontend analyze, 도구 타입, Core build, 전체 공통 types, 현재 workspace public exports의 NodeNext 타입·Node ESM 실행, source/map guard PASS. 각 배치의 Bun warm kernel은 20회 warm-up 후 2,000개 연산을 5,000ms 미만에 마치는 명세를 통과했다. 이는 호스트 kernel 회귀 예산이며 native FPS/scanout 증거가 아니다.
- **출처:** 전체 analyzer 재분석 없이 기존 resolved inventory를 재사용했다. 74,297개 source identity/required/dependency와 기존 구현 상태를 그대로 보존하고 39개 origin에 Nelyx 계약 결과를 추가했다. recipe hash·fixture 경로를 기존 inventory-plan에 갱신했다. Flutter 집계를 Nelyx 완료율로 사용하지 않는다.

[후보 검증](.tmp/work8/w9-02-followup-validation.json), [coverage 반영](.tmp/work8/w9-02-followup-coverage-adoption.json), [lifecycle 실행](.tmp/work8/w9-02-followup-lifecycle.log), [Core build](.tmp/work8/w9-02-followup-core-build.log), [공통 types](.tmp/work8/w9-02-followup-common-types.log). 숫자 fixture·각 배치 receipt·입력 해시는 영속 수락 기록에 연결했다. 테스트는 1,200초 timeout으로 실행했다.

**보존 경계:** 접근성 설정 pause checkpoint는 byte-for-byte 동일하다. 새 runner/archive 공급·브라우저/native·물리 IME/reader/FPS 검증은 이번 주석/도구 묶음에서 수행하지 않았다. 이전 W9-01 플랫폼 수락은 해당 후보 이력으로 유지한다. Git으로 고정한 새 도구의 독립 checkout 재현과 최종 6 target 공급은 W9-10 잔여이며, 전체 제품·나머지 W9 단계는 PARTIAL이다.

### 9.25 W9-03 접근성 설정·서비스 수명 — Nelyx 계약과 현재 native 후보

**2026-10-15 KST / PASS-scoped, W9-03·전체 PARTIAL.** [기능 계약](tools/Nelyx.FrameworkToTypeScript/data/work8/w9-03-accessibility-contract.json), 수락·입력 해시 (보관된 과거 기록 `w9-03-acceptance.json`). 시작 HEAD `25763aec`의 clean 작업 트리와 과거 pause 192파일을 확인했다. 171개는 동일하고 21개는 이후 수락한 선택·자동생성/공급 변경이다. 접근성 핵심 파일은 중단 시점과 같았다. 기존 pause checkpoint는 그대로 보존했다.

- **Core/서비스 수명:** 앱의 공개 dispatcher callback과 framework 구독을 분리하여 callback 교체·오류가 다른 View의 설정 전달을 끊지 않도록 했다. build/layout/paint/semantics 중 변경은 View마다 post-frame 한 건으로 합치고 최신 snapshot을 읽는다. plugin listener 등록 실패는 되돌려 재시도할 수 있으며 OS observer는 stop에서 동기 차단·해제한다. 부분 native 등록 실패, 여러 cleanup 오류, 초기화 중 재진입 종료도 검증했다.
- **OS producer:** Web reduced-motion→disableAnimations/reduceMotion, forced-colors→highContrast의 지원 mask는 **52**다. Android는 실제 AccessibilityManager와 animator duration 설정을 읽는 **21**, Windows는 실제 client-area animation/high-contrast를 읽는 **52**다. native는 앱별 기존 locale watcher에 설정 관찰을 합쳐 **1초 poll**하며 종료 후 남지 않는다. Windows `SPI_GETSCREENREADER`는 Narrator를 검출하지 않으므로 semanticsEnabled를 null로 유지한다. 미지원 producer·잘못된 protocol/mask·OS 오류를 빈 성공 값으로 바꾸지 않는다.
- **계약·회귀:** 독립 Nelyx 계약 **9그룹**, 실제 Chromium 두 앱의 설정 변경 **8경우**, 실제 Root **23그룹**, 기존 semantics 수명 **18×2+5 통합**, native channel, Core/SDK build·공통 types PASS. Web에서는 각 View와 MediaData 반영, 한 앱 종료 뒤 다른 앱 갱신, 마지막 media-query listener **0개**를 확인했다. Flutter 참고 비교는 프레임 중 중복 통지를 한 건으로 합치는 의도적 차이로 **FAIL**이다. debug 비교가 여기서 중단했으며 두 모드 전체 원본 동등성 PASS로 기록하지 않는다.
- **같은 공급·실제 실행:** 최종 `supply-PiJGWm`의 외부 packed 소비 **4조합**에서 새 observer API와 callback 교체/해제를 실행했다. Windows/Android 설치 Core **1,732파일**, SDK **336파일**이 현재 dist와 byte 단위로 같고 native producer 파일도 일치한다. Android API33 x86_64 host-Vulkan 에뮬레이터의 복사 APK/설치본 SHA `64b25cc7…89de9`가 같다. 실행 중 native 모듈에서 실제 OS animator **0→1 / features 20→0**과 AccessibilityManager 상태를 확인하고 설정을 복원했다. OS 이벤트 **1/2/8/16384**, inline 읽기 순서·LocaleSpan/TtsSpan·action PASS. probe와 소유 emulator를 종료했다. Windows는 복사 **1,388파일**을 검증하고 실제 Text lab·wheel120/800·알림 완료 UI·Back·Close를 실행했다. 첫 종료 계측은 코드값을 얻지 못했으므로 별도 재실행에서 OS process handle을 보존해 **exit0**를 확인했다.
- **출처·배치:** 8배치 현재성/영향 재수락 PASS. 3개 수동 origin은 기존 수락을 historicalAcceptance로 보존하고 새 좁은 Nelyx 계약을 연결했다. 다른 stale origin **58개**는 갱신하지 않았다. cached inventory로 74,297 source identity·required·dependency와 모든 implementation 상태를 보존하며 목적지/배치 evidence를 갱신했다. 집계는 missing **60,135**, partial **7,740**, adapted **6,413**, implemented **1**, notApplicable **8**로 유지된다. 새 생성 코드가 없어 숫자 주석 lowering을 추가하지 않았다.

**아직 닫지 않은 W9-03:** native semantics tree 제출/해제 acknowledgement와 실패한 정리의 owner 회복, Windows OS 설정 변경→실제 View 및 Android OS 설정→렌더된 MediaData 검증, iOS/macOS/Linux 설정 producer, 공통 서비스·paint/layer/image/asset 복구·입력/animation 전체의 Nelyx 명세 감사. Android native 모듈 관찰을 JS→실제 View 전 구간 검증으로 확대하지 않는다. Windows 새 실행은 UIA notification event 자체를 계측하지 않았다. 물리 reader/IME/FPS는 W9-09, 전용 Apple/Linux native는 SKIPPED/provider notVerified를 유지한다. **W9-03 전체 체크는 계속 미완료**다.

### 9.26 계획 개정 — 접근성·네이티브뷰 후속 이관

**2026-10-15 KST / 문서만 변경.** 사용자 요청으로 §0·§4.3·§5·§7·§10의 실행 순서·담당 범위·완료 gate를 조정했다. W9-03의 공통 서비스·렌더링/복구·기본 입력부터 시작해 나머지 기능과 runtime/tooling·개발 갱신·실제 환경·감사·공급을 먼저 닫는다. 접근성과 native/HTML view 임베딩·합성·수명은 §5.4의 후속 A·B로 이관했다. 일반 native host/Skia·IME·Windows/Android 실행·공급은 우선 범위에 유지한다.

§9.25까지의 구현·수락 이력과 미완료 상태는 보존한다. 우선 범위 완료를 전체 완료로 승격하지 않으며 후속 통합까지 전체 PARTIAL이다. 이번 변경은 `work9.md`에 한정하며 제품 코드·배치·coverage·handoff·pause checkpoint는 변경하지 않았다. 기존 handoff의 접근성 우선 next보다 §0.4·§10.5가 우선하며 다음 구현 시작 때 현재 입력을 대조하고 handoff를 갱신한다. build/runtime 검증은 수행하지 않았다.

### 9.27 W9-03 공통 런타임·이미지·마스크·입력 종료

**2026-10-15 KST / PASS-scoped, W9-03·전체 PARTIAL.** [Nelyx 기능 계약](tools/Nelyx.FrameworkToTypeScript/data/work8/w9-03-common-contract.json), 수락·입력 해시·immutable 증거 (보관된 과거 기록 `w9-03-common-acceptance.json`). HEAD `9e73569`의 clean 작업 트리에서 시작했고 기존 접근성 수락의 제품 입력 9개를 대조했다. 접근성·임베딩 네이티브뷰는 재개하지 않았으며 공통 dispatcher 변경에 필요한 수명 회귀만 확인했다.

- **Scheduler·서비스:** host 프레임 요청 실패 시 callback·endOfFrame·Ticker.start를 되돌려 재시도할 수 있게 했다. 제거된 observer와 닫힌 owner의 후속 통지를 차단하고, 재진입으로 갱신된 환경에 오래된 snapshot이 뒤늦게 전달되지 않게 했다. 비동기 keyboard 초기화는 사용자가 설정한 callback을 보존하며 public key listener는 transport 종료 전에 해제한다. 일부 unregister 실패가 나머지 해제를 건너뛰지 않도록 했다.
- **이미지·메모리:** 실패한 asset 문자열 cache는 재시도하고, NetworkImage headers는 cache identity와 함께 고정한다. ResizeImage fit의 최소 크기는 1px이며 취소 뒤 progress·동기 frameClock lease 유출을 막았다. SDK bootstrap에서 앱별 PaintingBinding에 image owner를 등록하여 memory pressure가 image/asset cache를 비우되 사용 중인 image handle은 보존한다.
- **FileImage·ShaderMask:** `FileImage`·`Image.file`·`loadFileRequest`를 공개했다. percent-encoded `file:///` 전용 native reader는 기존 asset 경로 제한과 분리되며 regular file·nonempty·16 MiB 제한, 오류·취소·owner completion을 적용한다. 오래된 native supplier와 Web의 미지원은 명시적으로 실패한다. `ShaderMask`·`RenderShaderMask`는 기존 saveLayer/drawRect wire로 child-local mask를 합성하며 retained child·layout/hit test·paint 실패 복구를 보존한다. callback Shader는 호출자 소유다.
- **기본 입력·렌더링:** mouse enter에서 View를 hide/close해도 이후 enter가 호출되지 않고, 진입하지 않은 annotation에 exit를 보내지 않는다. 실제 FrameworkRoot에서 pointer 취소·hide/resume·viewport/renderer generation·AnimationController 종료와 mask 갱신을 검증했다.
- **검증:** 공통 런타임 **19그룹**, 실제 SDK bootstrap/제어 native adapter **4**, 실제 CanvasKit CPU 렌더링 **7**, Chromium WebGL/ANGLE SwiftShader **6경우**, Windows C++ 파일/owner queue **20**, 현재 native Graphite/Vulkan offscreen mask **DPR 1·2·3** PASS. Root **23**, shortcut **10**, font **14×debug/release**, 공유 semantics 수명 **18×2+5** 회귀 및 Core/SDK/Skia build·공통 types·외부 packed 소비 **4조합**도 통과했다. 브라우저 입력은 fixture adapter 경로이며 full SDK DOM ingress·물리 GPU/FPS 수락과 다르다.
- **실제 native와 HTTP:** 최종 `common-fFTbQV` 공급의 현재 dist와 설치본 및 새 native header를 대조했다. 복사 Windows EXE는 **1,206파일** 검증, 48×48/150-byte 이미지 decode·취소 차단·mask 프레임 제출·HTTP POST·**exit0** PASS. 복사/설치 SHA가 같은 Android API33 x86_64 Release APK도 같은 이미지·프레임·HTTP 결과를 확인하고 Back 후 fatal log가 없었다. Android 전체 graceful drain·scanout/pixel·물리 IME/FPS는 이 결과로 수락하지 않는다. 사용자 허용에 따라 **테스트베드 앱 manifest만 Debug/Release HTTP 허용**으로 변경했다. 초기 Android 실패는 ADB가 만든 shell-owned 770 테스트 폴더의 접근 거부였으며 fixture 권한/복사를 고친 뒤 통과했다. native 오류는 원래 예외 메시지를 전달한다. 검증용 sample App 소스는 원본 hash로 복원했다.
- **출처·배치:** 고정 Git 원본과 span을 대조한 origin 및 공유 dispatcher 총 **10개**에 좁은 계약을 연결하고 기존 수락은 보존했다. 다른 stale origin **59개**는 자동 갱신하지 않았다. 8배치 재수락과 기존 생성 제품 hash를 확인했다. source identity·required·dependency를 보존한 coverage는 **22 missing→partial**, 바뀐 목적지의 이전 근거 **12 adapted→partial**이며 missing **60,113**, partial **7,774**, adapted **6,401**, implemented **1**, notApplicable **8**이다. 제품 완료율이나 새 자동생성 진척으로 해석하지 않는다. 새 lowering은 없다.

**남은 우선 작업:** 나머지 service/platform/worker owner 수명, rawUnmodified·wide gamut·raster cache의 지원 계약/구현, typography/font·pointer/gesture/focus/key·animation 전체 API 감사와 backend 복구·제품 흐름 수락이다. 이번 7개 기능 계약을 W9-03 전체 완료로 승격하지 않는다. 접근성·임베딩 native/HTML view는 §5.4의 후속으로 남고, 최종 여섯 target 공급·물리 환경·서명/배포는 해당 09·10 범위를 유지한다.

### 9.28 W9-04 편집·Form·Page·mixed sliver 흐름

**2026-10-15 KST / PASS-scoped, W9-04·전체 PARTIAL.** Nelyx 기능 계약·지원 차이 (보관된 과거 기록 `w9-04-contract.json`), 수락·현재 입력·immutable 증거 (보관된 과거 기록 `w9-04-acceptance.json`). HEAD `24ffc46`의 clean 작업 트리에서 시작했고 직전 공통 수락의 파일 참조 **72개**를 대조했다. 새 기능은 기존 Nelyx host·sliver·physics owner 위의 수동 TypeScript 구현이며 새 Dart lowering·자동생성 진척으로 계산하지 않는다.

- **Controller·편집 정책:** 불변 selection snapshot, surrogate 경계를 검증하는 exact-text delta, Unicode scalar 길이 제한·predicate formatter, 최대 1000개/default 100개의 undo/redo 이력과 reset을 추가했다. 조합 중에는 rewrite를 금지하고 확정 입력을 한 undo 묶음으로 처리한다. Native formatter 응답 전 제출을 미루고, reset 이력도 authoritative 응답 때 비운다. 늦은 clipboard 완료·이전 controller lease·종료된 binding callback을 차단한다. 조합 활동/range를 관찰하지 못하는 host의 formatter 요청은 명시적으로 실패한다. DOM 조합 활동은 정확한 조합 range와 별도 계약이다.
- **Form·TextFormField:** 필드 등록/해제, 명시 검증·자동 검증, 유효한 Form만 save/submit, reset, 외부/소유 controller 교체·수명, GlobalKey 재배치 때 Form 소속 이전을 연결했다. 오류 표시가 생겨도 기존 입력 DOM·focus·session을 보존한다. `next/previous`는 별도 FocusTraversalGroup이 없는 화면에서도 현재 View 순서를 따른다.
- **RenderEditable·DOM:** 기존 host-control render box를 공개 `RenderEditable`로 정리했다. Core는 제약·배치·focus·ancestor caret reveal을 맡으며 글자/IME는 OS/DOM 소유다. 연결 실패 rollback과 전체 cleanup을 보강했다. Chromium 실제 입력·두 필드 이동/검증/제출/reset, synthetic composition과 실제 Ctrl-Z/Shift-Z, 종료 후 지연 이벤트를 확인했다. 물리 OS IME 수락은 아니다.
- **Page·sliver:** `PageController`·`PageView`·`PageScrollPhysics`를 기존 lazy ListView/ScrollPosition/activity와 연결했다. 초기 페이지·jump/animate·가로/세로·fraction·ballistic snap, resize/controller 교체 때 논리 페이지 보존, PageStorage remount 복원을 검증했다. 지원 fraction은 **(0,1]**, builder는 유한 itemCount 계약이다. 10,000페이지 흐름에서 생성한 cell은 가로 **13**, 세로 **16**개였다. 기존 measured list 5,000 + grid 5,000의 첫 seek·mutation·fling·resize·hidden/resume·close에서는 State **10,063개 생성/해제**가 일치했다. 최종 CPU fixture 첫 seek 관측은 약 **1,063ms**이며 패키지 소비 검증과 병행한 실행이다. 중간 행을 측정하는 비용을 숨기지 않으며 native FPS·상수 시간 seek·성능 목표 달성을 주장하지 않는다.
- **검증·공개 소비:** 편집/Form/실제 Root/제어 native adapter **19그룹**, Page/mixed scroll **5**, Chromium **4**, 기존 scroll action **6**·shortcut **10** 회귀 PASS. Core/SDK build·공통 types PASS. 현재 Core tarball을 workspace 밖에 offline 설치해 새 공개 API의 NodeNext 선언과 runtime 소비를 확인했다. 이 과정에서 누락된 `framework/rendering/editable` export를 추가했다. 기존 native runner 공급은 갱신하지 않았고 이전 증거를 현재 편집 수락으로 승격하지 않았다.

**남은 W9-04:** autofill configuration/group/service, native keyboard/undo/toolbar/clipboard 및 실제 IME·caret geometry, multiline/read-only/obscure/style/선택 toolbar와 나머지 편집 API, Nested/header·refresh/reorder/dismiss/sheet/wheel/2D/tree/zoom, scrollbar customization·cold restoration·확대된 keyed State/selection 수락, 실제 SDK bootstrap 및 복사 Windows/Android 실행·공급이 남았다. Core-only packed 소비와 제어 native port는 이 조건들을 완료하지 않는다. 기존 출처/coverage 기록을 일괄 갱신하지 않았으며 W9-03·접근성/네이티브뷰 후속·W9-09/10 잔여도 유지한다.

### 9.29 W9-05 앱 흐름·Router·Back·복원·locale

**2026-10-15 KST / PASS-scoped, W9-05·전체 PARTIAL.** Nelyx 기능 계약·API 차이 (보관된 과거 기록 `w9-05-contract.json`), 현재 입력·수락·immutable 증거 (보관된 과거 기록 `w9-05-acceptance.json`). HEAD `24ffc46` 위의 **W9-04 미커밋 변경을 보존**하고 시작했으며 직전 수락 참조 **27개**가 일치했다. 새 동작은 기존 Elements·Focus·Overlay·Ticker·sliver·codec/host 위의 독립 TypeScript 구현이다. Dart lowering·생성 소스는 바꾸지 않았다.

- **Navigator·Back:** 한 controller의 중복 mount를 거부하고 공개 route stack·JSON arguments를 불변 snapshot으로 만들었다. named stack 저장/복원은 최대 32 route·2 Mi UTF-16 units 계약이다. `PopScope`의 비동기 확인 중 새 route가 열리면 오래된 Back이 다른 화면을 pop하지 않는다. 가려진 nested Navigator는 system Back·ticker/focus 대상에서 빠지고, route builder에서 `Navigator.of`를 사용할 수 있다. 종료/초기화 실패의 listener·controller lease 정리와 route result settlement를 보강했다.
- **Router·platform:** `RouteInformation`·provider/parser/delegate·`Router`·`NavigatorRouterDelegate`를 추가했다. 최신 parse만 commit하고, URL Back/Forward에서는 같은 name/arguments의 공통 route prefix를 유지한다. 초기 복원 통지는 새 URL parse를 취소하지 않으며 늦은 history 응답이 새 link를 덮어쓰지 않는다. `ServicesBinding`은 `pushRoute`/`pushRouteInformation`을 현재 observer 역순으로 처리한다. Web 초기 URI·history를 연결했고 Native Linking initial URL/event·listener epoch·해제를 추가했다. 멈춘 native initial-URL query가 logical shutdown을 붙잡지 않도록 했으며 OS query 자체의 취소를 주장하지 않는다.
- **WidgetsApp·dialog/Hero·async:** View별 MediaQuery/theme/Localizations/Directionality/Overlay와 선택적 RootRestorationScope를 조합했다. locale은 language/script/region·alias와 지원 목록 순서로 결정하며 script-aware 방향을 적용한다. dialog는 non-opaque route로 Back/result/focus를 공유한다. Hero는 명시적 visual shuttle builder로 실제 Overlay rect flight를 만들고 원래 route State를 유지하며 중간 픽셀·완료/종료 해제를 확인했다. Future/Stream 교체·오류·완료·close를 generation으로 분리하고, 오래된 stream 완료가 새 subscription을 해제하지 않도록 했다. `null` rejection도 오류로 관찰된다.
- **복원:** `RestorationMixin`·typed primitive property, Navigator별/route별 bucket과 기존 Scrollable offset을 연결했다. 저장 전송을 순서대로 실행하고 실패 시 dirty 상태를 재시도할 수 있게 했으며 오래된 queued generation은 전송하지 않는다. 잘못된 초기 restoration 응답이 영원히 대기하지 않도록 처리하고 오류를 보고한다. Web 기본 application composition은 app ID별 **sessionStorage / 최대 4 MiB** 경로를 공급한다. Native `flutter/restoration` 영속 producer는 아직 없으며 explicit manager/Core bucket만으로 native 재시작 복원을 수락하지 않는다.
- **실제 Chromium 흐름:** `/form` cold link → Form 입력/목록 offset **350** → dialog → browser Back/Forward → local pop → `languagechange` **ar** → 실제 reload에서 텍스트/offset 복원 → 저장된 form stack보다 명시적 `/` link 우선까지 PASS. 실제 DOM keyboard/ServicesBinding/history/sessionStorage 경로이며 렌더링은 CPU CanvasKit fixture다. 전체 sample SDK bootstrap·copied native 또는 물리 OS 입력/FPS의 수락과 구분한다.
- **검증·공급:** 앱 흐름 **15그룹**, SDK/제어 native Linking **4**, Chromium **5** PASS. 공통 runtime **19**·편집/Form **19**·기존 Overlay **9** 회귀, Core/SDK build·공통 types PASS. 현재 Core tarball을 workspace 밖에 offline 설치해 새 앱 API의 NodeNext 선언과 runtime 소비를 확인했다. Native Linking의 `ios` 테스트 분기는 제어 모듈이며 iOS OS 실행이 아니다. 기존 native 공급·출처/coverage 수락을 일괄 갱신하거나 전체 호환으로 승격하지 않았다.

**남은 W9-05:** Windows/Android native restoration 저장 producer·실제 process recreation, 앱의 URI scheme/app-link 설정과 OS 링크/Back/locale/복원·종료, 현재 복사 EXE/APK/SDK 공급 및 W9-09/10 실제 환경·성능·최종 감사다. 접근성 bridge/collection metadata·action/reader와 임베딩 native/HTML view는 기존 후속 A·B를 유지한다. 명시적 Hero shuttle/rect flight·JSON route state·PromiseLike/WidgetStream 등 지원 차이는 계약 파일에 기록했으며 Flutter의 전체 Route/Router/Hero API 복제를 완료했다고 주장하지 않는다.

### 9.30 공통 서비스/worker 종료·native 복원 저장 producer — 2026-10-16 KST

**PASS-scoped / W9-03·05 및 전체 PARTIAL.** 시작 HEAD `ef92f293`의 clean 트리와 관련 실행 상태를 확인했다. 계약 (보관된 과거 기록 `w9-service-restoration-contract.json`), 현재 후보·검증 (보관된 과거 기록 `w9-service-restoration-acceptance.json`). 기존 Core·compiler·recipe/coverage 및 pause checkpoint를 변경하지 않았다. 기존 원본·native 수락은 당시 후보의 범위로 보존하며 제거한 legacy selection API는 복구하지 않았다.

- **서비스·worker:** 부분 listener/start/ready 실패 rollback, 닫는 중 재진입·잘못된 packet 이후 동기 admission 차단, 비동기 응답 실패의 자동 peer 종료, 전체 drain/cleanup 시도와 오류 집계. Plugin의 소유 서비스는 이미 받은 작업/응답 이후 해제하며 공유 owner를 한 번만 정리한다. 무응답 host event는 stop에서 논리 완료하고 늦거나 중복된 응답은 재완료하지 않는다. Android Back은 비동기 drain 전에 차단하고 등록 실패는 앱 claim을 되돌린다.
- **복원 producer:** Windows/Android 일반 surface에서 `definition.id`를 정확한 UTF-8→SHA-256 key로 연결했다. protocol1 저장·읽기·확정 응답, 순서·취소·실패 재시도 및 4 MiB 제한을 적용했다. 다른 plugin 및 worker 채널의 기존 1 MiB 제한은 유지한다. Windows는 사용자 app-data의 versioned 파일 flush·원자적 교체, Android는 앱 전용 SharedPreferences commit을 사용한다. 앱 종료로 저장을 지우지 않으며 Apple/Linux producer를 구현한 것으로 세지 않는다.
- **현재 후보 검증:** 소유권 **26**, SDK 복원 **7**, 실제 Chromium DedicatedWorker **2**, 실제 Chromium 앱 route/Form/list/dialog/Back/locale/reload **5**, SDK bootstrap **4**, 제어 native 메시지 **4**, 기존 접근성 접점 회귀 **9** PASS. Windows 파일 helper **10그룹**과 별도 seed/verify 프로세스의 저장 복원·잠긴 target 실패/이전값 보존 PASS. **Android Release Kotlin**과 **Windows RNW ClCompile** PASS이며 installed native overlay는 원래 bytes로 복원했다. 후자는 bundle/link/run 수락이 아니다.
- **빌드·소비:** 최종 SDK build·공통 types PASS. 한 immutable Core/SDK archive 쌍의 새 offline 외부 설치에서 strict NodeNext 서비스/worker 선언, 실제 MessagePort와 native 저장 adapter cold manager PASS. [archive/소비 receipt](.tmp/work8/w9-03-service-packages-result.json). Core/도구/배치 입력을 바꾸지 않아 8배치와 전체 native 공급을 다시 실행하지 않았다. 모든 테스트 명령은 1,200초 상한이다.
- **수정한 검증 실패:** 첫 UTF-8 private import는 공개 StringCodec으로 고쳤다. RNW 직접 project 검사의 solution·bundle·autolink 실행 문맥을 고쳐 compile-only 범위를 정확히 실행했고 기존 로그를 보존했다. 잘못된 harness의 HBC→JS 해석 실패를 새로운 Hermes 문제로 일반화하지 않는다. 첫 packed native mock의 필수 locale 누락도 고쳐 새 archive 후보에서 통과했다. 고정 Hermes의 기존 `-Og` 정책은 유지하며 성능을 새로 수락하지 않았다.

**다음 범위:** §10.6 공통 서비스의 일반 실패 owner 회복·image/paint·typography/input/animation 감사, 실제 현재 공급 Windows/Android 앱의 저장→process recreation/OS URI/Back/종료와 §10.7~10.8 잔여, §10.5의 디자인/플랫폼 분리/개발 갱신/물리 수락/최종 공급. ADB 연결은 되었으나 확인 당시 연결 기기는 없었고 emulator는 시작하지 않았다. 물리 IME/reader/FPS는 미검증이며 접근성·임베딩 후속 및 전체 W9는 계속 PARTIAL이다. iOS/macOS/Linux 전용 native는 기존 SKIPPED/provider notVerified 정책을 유지한다.

### 9.31 실제 native 앱 복원·Android URI — 2026-10-16 KST

**PASS-scoped / W9-03·05 및 전체 PARTIAL.** 현재 후보·입력·수락 (보관된 과거 기록 `w9-native-flow-acceptance.json`). §9.30의 미커밋 변경을 보존했다. Native initial URI가 없는 경우 `/`를 새 입력으로 처리해 저장 route를 지우던 Router 결함을 수정했다. 명시 URI의 우선순위는 유지하며 새 회귀 **3**, 기존 앱 **15**, 실제 Chromium **5**가 통과했다.

- **Windows:** 현재 Core/SDK 공급으로 링크·복사한 EXE **1,276파일**의 hash를 확인했다. 서로 다른 PID **19164→37116**에서 Korean text·Form/dialog route·offset **350**을 복원했고 controller Back과 두 번의 **exit0**를 확인했다. Windows OS URI·hardware Back은 아직 미검증이다.
- **Android:** API33 x86_64의 복사 APK와 설치본 identity, 별도 process 복원·ADB native Back·실제 앱 locale **en→ar**와 State 보존을 확인했다. 이 실행의 뒤쪽 VIEW 단계는 registration 부재로 실패했으므로 receipt 전체 FAIL을 보존하고 앞 **6 event만 수락**했다. sample-owned `nelyx-testbed` scheme filter를 추가한 후보에서 implicit resolver·cold 명시 root 우선·warm Linking event·Back→root→Activity 종료 PASS. HBC와 두 dex가 이전 후보와 같아 복원 흐름을 다시 반복하지 않았다. APK SHA `f7493dba…e32a65`.
- **증거·fixture:** 비동기 native edit 확정 전에 old text를 저장하던 fixture와 RNW HTTP response cache를 수정하고 실패 기록을 보존했다. 제품 editing/Hermes 결함으로 일반화하지 않는다. [재사용 검사](tools/Nelyx.FrameworkToTypeScript/checks/native-app-flow/README.md)를 추가했다. 현재 source overlay·소유 emulator/server는 다음 검사에 사용 중이며 hash를 대조해 원상복원할 예정이다.

**남은 작업:** Windows URI producer/OS activation·OS Back, 일반 owner 회복·이미지/paint/input 감사, W9-04 및 06~10 우선 범위와 후속 A·B 전체. HTTPS verified app links·물리 IME/keyboard·FPS·GPU loss·Android 전체 graceful drain·production signing은 미검증이며 Apple/Linux 전용 native는 SKIPPED/provider notVerified다. 이번 앱 복원을 전체 완료로 승격하지 않는다.

### 9.32 Windows OS URI 전달 — 2026-10-16 KST

**PASS-scoped / 전체 PARTIAL.** 입력·검증·현재 공급 (보관된 과거 기록 `w9-windows-uri-acceptance.json`). 공개 host activation 경로가 없는 현재 unpackaged RNW host에 SDK native navigation protocol1을 연결했다. 앱이 등록한 command의 `--nelyx-uri "%1"`를 검증해 전달하고, 일반 시작의 URI 부재는 null로 유지한다. 인자 모호성·16,384 UTF-16 unit 제한·scheme/제어문자·잘못된 surrogate를 거부한다. 구형 host의 RN Linking fallback은 유지한다.

Parser **12그룹·실제 command line 4**, SDK **5**, 기존 Linking **4**, SDK build PASS. Windows SDK만 갱신해 링크·복사한 **1,276파일**을 검증했고, 실제 ShellExecuteEx의 고유 HKCU scheme으로 Form 링크→저장 dialog→새 root 링크 우선과 PID **26340/30976**, 두 번의 **exit0**를 확인했다. EXE SHA `07429349…594ab`. 검사 전용 등록은 해제했다. URI마다 독립 process를 여는 정책이며 기존 process로의 warm broker·production installer를 구현한 것으로 기록하지 않는다.

Sample entry와 임시 두 fixture의 hash를 확인하고 원본 entry SHA `df8ffbfd…90db8`로 복원했다. 실행 fixture는 evidence 폴더에 보존했다. 소유 emulator5584·localhost server58236은 후속 검사용으로 유지한다. Windows OS Back·물리 입력/FPS/복구 및 나머지 전체 체크는 계속 미완료이며 다음은 §10.6 이미지/paint·일반 owner 회복이다.

### 9.33 Image rawUnmodified·저장 형식·GPU 복구 readback — 2026-10-16 KST

**PASS-scoped / W9-03·전체 PARTIAL.** 계약 (보관된 과거 기록 `w9-image-readback-contract.json`), 현재 입력·수락 (보관된 과거 기록 `w9-image-readback-acceptance.json`). codec·Picture raster 출력의 미구현 `rawUnmodified`를 실제 native metadata로 연결했다. RGBA/BGRA·alpha·색 공간을 유지하고 독립 bytes를 반환한다. Native ImageInfo·Web ColorSpace/명시 할당은 성공·null·오류 뒤 해제하며 이중 오류를 보존한다. 기존 나머지4 format도 같은 reader로 통합했다.

- **실제 Web:** 고정 CanvasKit CPU **8그룹**에서 RGBA/BGRA/gray/alpha/F16/P3-F32·alpha 변환·PNG·byte view·cleanup을 확인했다. Chromium WebGL2/ANGLE SwiftShader **4흐름**은 GPU raster/all5 format·picture 재사용·실제 context loss 후 CPU image read·복구 재생성·cache/자원 해제 PASS. P3 저장 bytes는 wide-gamut 화면 출력 수락이 아니다.
- **동일 공급 native:** 새 SDK/Skia-RN 후보의 복사 Windows **1,208파일**, EXE `a7eb9154…811e46`에서 raster·PNG codec 왕복·반복·RawImage clone과 **exit0** PASS. Android API33 x86_64 Release **898파일**, 복사/설치 APK `4e46217b…bd3155a`도 같은 흐름·Activity 종료·fatal log 없음 PASS. `rawUnmodified` 실제 layout은 Windows **BGRA premul**, Android **RGBA premul**이다. scanout·물리 FPS·Android 전체 graceful drain은 별도다.
- **빌드·소비:** RN/Web/SDK build, 공통 types, 기존 SDK **4그룹**, 같은 immutable Core/SDK/Skia-RN archive의 외부 offline strict NodeNext·packed 내부 codec/memory 경로 PASS. 첫 외부 검사의 private factory import를 fixture에서 바로잡았으며 공개 API를 불필요하게 늘리지 않았다. 초기 gray fixture rowBytes 오류·명령 오류도 보존했다. Android fresh CMake는 JDK25/Prefab2.1.0/JNA 경고로 실패해 **설치된 JDK21.0.11**로 성공했다. 새 설치·global 설정 변경은 없고 실패 후보를 삭제하지 않았다.

Sample fixture hash 확인·archive 후 원본 entry를 복원했다. 소유 emulator5584/server58236은 후속 검사용이다. **남은 우선 범위:** 일반 실패 owner 회복·wide-gamut 전체 rendering/output·bitmap raster-cache 계약/구현·typography/input/animation 감사 및 W9-04·06~10. 이번에 검증한 cache는 native display-list 재사용/무효화이며 bitmap cache로 승격하지 않는다. Apple/Linux 전용 native는 SKIPPED/provider notVerified, 접근성·임베딩 후속과 전체 체크는 계속 PARTIAL이다.

### 9.34 명시적 owner 회복·native 완료·Android Activity finish — 2026-10-16 KST

**PASS-scoped / W9-03·05·전체 PARTIAL.** 계약 (보관된 과거 기록 `w9-owner-recovery-contract.json`), 입력·수락·후보별 증거 (보관된 과거 기록 `w9-owner-recovery-acceptance.json`). `PendingDisposalError`·`DisposalSequence`, 앱의 `shutdownStatus`/`retryDispose`를 연결했다. 실패한 owner가 명시한 완료 callback만 재시도하고, 완료한 binding/startup/plugin/서비스는 반복하지 않는다. GPU 미확인 동안 input/capture/temporary를 유지하며 cleanup 시작 뒤의 불확실한 삭제 오류는 일반 재시도로 바꾸지 않는다.

- **공통·host:** plugin→native bytes→앱→surface/Web 등록의 후속 해제를 보존한다. Surface/host 경계는 안전한 callback을 최대 **2번** 이어가고 지속 실패는 보존한다. 회복 **15그룹**, effect/Windows-host **5**, 실제 SDK Chromium **2**, 기존 service/Node worker **26**, 실제 browser worker **2**, SDK **4**, Android/Windows pop **3** PASS. 일반 critical drain 실패는 종속 owner를 유지하며 독립 cleanup 오류는 모아 보고한다. 초기화/stop·임의 native 삭제·지속 hardware fault의 회복까지 수락한 것은 아니다.
- **실제 native:** 복사 Windows **1,210파일**, EXE `135fd6ed…f2beed`에서 all5 format·native 제출 뒤 주입한 완료 미확인→실제 fence **3회째 확인**·temporary 정리 **1회**·**exit0** PASS. Android의 기존 BackHandler pop은 task만 background로 보내 정리 ack가 없었고 그 실행은 FAIL로 보존했다. 명시 SystemNavigator 요청을 UI Activity.finish로 연결한 새 복사/설치 APK `d2121abe…49c39a0` **900파일**에서 같은 native fence/정리 ack·Activity 종료·fatal log 없음 PASS. OS Back의 기본 task 정책은 유지한다. JS로 주입한 미확인을 실제 GPU 고장/물리 성능으로 일반화하지 않는다. Android 공유 runtime/process 전체 drain은 미검증이다.
- **선언·소비:** 외부 strict 소비에서 발견한 getter·5개 native asset API·Web definition의 workspace 상대 선언 경로를 공개 Core 타입으로 고쳤다. 실행 JS가 같은 것을 byte로 대조했고, SDK **86 선언파일·114 상대 참조·미해결0**과 같은 공급 archive의 strict NodeNext/API/byte-owner 소비 PASS. 올바른 `.tsx→.d.ts` 치환은 실제 TypeScript resolver로 감사했다. Windows native 후보는 원래 archive로 보존하고 이후 Android 전용 runtime 변경·type-only 차이는 별도 reuse receipt로 제한했다. Core/SDK/Skia-RN build·최종 공통 types PASS. Native ABI·Dart lowering·coverage는 바꾸지 않았다.

Sample overlay의 hash를 확인해 원본 entry로 복원했고 소스·실패 후보·로그를 보존했다. 소유 emulator5584/server58236은 후속 검사용이다. **다음:** cache/retirement 실패 감사·wide-gamut 전체 output·bitmap raster-cache·typography/input/animation 및 나머지 W9-04·06~10. 실제 hardware loss/물리 IME/FPS/최종 공급·signing, 접근성·임베딩 후속은 계속 미완료이며 Apple/Linux 전용 native는 SKIPPED/provider notVerified다.

### 9.35 bounded bitmap 결과 재사용·picture 미확인 삭제 경계

**PASS-scoped / W9-03·전체 PARTIAL.** 계약 (보관된 과거 기록 `w9-bitmap-retirement-contract.json`), 입력·수락·후보 (보관된 과거 기록 `w9-bitmap-retirement-acceptance.json`). Native display-list cache가 삭제 실패 뒤 새 작업을 받거나 같은 native 삭제를 반복하던 결함을 재현하고 수정했다. RN/Web recorder·picture 정리의 완료가 불확실하면 wrapper와 필요한 입력 recipe/lease를 유지하고 owner를 닫는다. 명시적 GPU 완료 재조회와 임의 삭제 재시도를 구분한다.

앱 `RasterizationService`에 실제 **Picture.toImage 결과 bitmap cache**를 연결했다. 불변 recording identity·정확한 pixel 크기로 찾고 독립 Image handle을 반환한다. **64개/32MiB LRU**, 초과 출력 bypass, recording 종료·앱 종료 시 해제, `bitmapCache:false`와 `debugBitmapCacheStats`를 제공한다. Core 소유권 **9**, native display-list 실패 **9**, compiler/picture 수명 **6**, 기존 명시적 owner 회복 **15**·paragraph picture **10**, 외부 strict NodeNext consumer·공통 타입이 PASS다.

- 실제 Chromium GPU **5흐름**: all5 bytes·한 bitmap 재사용·실제 context loss 뒤 CPU image 유지·복구 뒤 cached bitmap 재사용·새 recording의 GPU 생성 PASS.
- 복사 Windows **1,211파일**, PID **16316**, EXE `fcddac5882ebb60f1eacf4d5cd81842caeb449a52347ed360698a8aad70a4eb4`: bitmap hit1·BGRA premul/all5·주입한 미확인 완료 뒤 실제 세 번째 fence ack·cleanup1·**exit0**.
- 복사 Android **901파일**의 설치 hash 일치, bitmap hit1·RGBA premul/all5·동일 fence3/cleanup1·Activity 종료/no fatal을 수락했다. 전체 shared process/runtime drain·물리 GPU/FPS는 미검증이다.

Sample overlay는 hash 확인·보관 후 원본 entry로 복원했다. CPU-restorable sRGB bitmap의 명시적 결과 재사용이며 **wide-gamut 화면 출력·자동 composited-layer cache의 수락으로 승격하지 않는다**. 남은 wide-gamut/paint·typography/input/animation과 W9-04·06~10, 접근성·임베딩 후속을 계속한다. Apple/Linux 전용 native는 SKIPPED/provider notVerified다.

### 9.36 animation finite/reentry·움직이는 control geometry

**PASS-scoped / W9-03·전체 PARTIAL.** 계약·입력·수락 (보관된 과거 기록 `w9-animation-runtime-acceptance.json`). 유한 repeat의 마지막 끝값·역방향 속도/종료 status, 동일 bounds의 0ms 완료, finite 입력의 사전 검증을 수정했다. simulation/direction/value callback이 새 값을 요청하거나 종료하면 이전 tick·0ms 전환이 덮어쓰지 않는다. 잘못된/throwing sample은 View scheduler를 통해 한 번 취소·보고한다. 공개 형태를 유지하며 NaN clamp·유한 repeat의 끝값은 명시한 Nelyx 안정성 계약을 따른다.

실제 scheduler/controller **10그룹**, 실제 Root/Element·implicit widget **14그룹**, 실제 Chromium **3흐름**이 PASS다. LTR·RTL로 움직인 DOM editor의 중간/종료 bounds와 정확한 **`한글 😀`** 입력, 종료 후 늦은 입력 차단·유한 reverse-repeat를 확인했다. 첫 browser fixture의 UTF-8 메타데이터 누락은 별도 교정했고 Node에서도 정확한 문자열을 검사한다.

영향 회귀가 발견한 host bounds 지연은 **변경 전 archive에서도** 재현됐다. 실제 render offset30/host bounds10이었으며 child offset의 geometry dirty 입력을 연결해 LTR30/RTL130으로 맞췄다. 효과가 없었던 private geometry 비교 변경은 제거했으며 기존 semantics private 알고리즘은 유지했다. 이는 현재 일반 control/입력 배치의 필수 접점이며 접근성 reader/tree-ack 후속 재개가 아니다.

이번 JS/geometry 묶음에서 native ABI·SDK host를 변경하거나 native 설치/여섯 target 공급을 반복하지 않았다. §9.35의 native 후보는 그 입력의 증거로 보존하며 **최신 animation native 수락으로 전용하지 않는다**. 다음 기능 후보에서 영향 native 통합을 수행한다. 전체 animation/API·typography/input·wide-gamut 및 W9-04·06~10, 접근성·임베딩 후속은 남아 있다.

### 9.37 편집 설정·조합 안전한 자동완성·실제 제공자/종료

**PASS-scoped / W9-04·전체 PARTIAL.** 계약 (보관된 과거 기록 `w9-editing-autofill-contract.json`)과 수락 (보관된 과거 기록 `w9-editing-autofill-acceptance.json`)에 source/archive/fixture/실제 실행 hash를 연결했다. Multiline·readOnly·obscure·keyboard/capitalization/suggestion/hints, 조합 확정 후 mode/action/그룹 교체, AutofillGroup의 nested/sibling/GlobalKey 수명과 HTML section, app-owned 서비스·명시적 finish/cancel을 구현했다. 기본 group dispose는 metadata 해제만 하는 Nelyx 정책이며 OS 요청 승인과 제공자의 저장 결과를 구분한다. Android ABI2는 실제 KeyboardHost 신원·focused descendant·Activity owner를 검증한다.

Core/SDK11, 설정7, 실제 Chromium 그룹7·설정6, 기존 Form19, 엄격한 외부 NodeNext 소비와 공통 types13.804s가 통과했다. 같은 Core/SDK archive로 Windows1245 복사 파일은 Root/편집 해제 ack0group0client와 exit0, Android935는 APK install/pull 일치·실제 제공자 dataset 채움→변경→OS Save UI→가짜 값 저장/별도 프로세스 읽기→취소(추가 저장 없음)→Core Clipboard 읽기→해제 ack/Activity 종료를 확인했다. 실제 native bounds의 40logical 이동은 density204에서 51px이었다. 고정 Hermes -Og와 JDK21을 유지했고 실제 FPS를 추론하지 않는다.

검사 오류도 보존했다. 초기 fixture의 startup controller dispose가 Root보다 빨라 발생한 종료 오류는 통합 수락에서 제외하고 State 소유권으로 수정했다. readonly metadata/메뉴 탐색은 실제 선택의 대리 지표가 아니었고 원래 View의 직접 touch 선택·Copy API/clipboard는 통과했다. 추측한 setter 순서 수정은 철회해 원래 archive와 소스를 복원했다. 당시 전역 OS touch/메뉴는 미수락으로 유지했고, 아래 추가 probe로 readonly의 해당 경로만 좁게 수락했다. 독립 View의 native 실제 격리, 물리 IME/keyboard/FPS·production provider·전체 Android shared runtime drain도 미수락이다. Apple/Linux 전용 native는 기존 SKIPPED/provider notVerified, 공통 구현·공급 의무는 유지한다.

임시 sample 소스를 원래 SHA로 복원했고 제공자 설정은 정확히 복원, 테스트 제공자/instrumentation은 제거했다. 다음은 native OS 입력/메뉴의 좁은 진단과 나머지 편집·scroll 사용자 흐름이며 §10.5·후속 A/B·최종 감사/6 target 공급을 계속 수행한다.

**추가 입력 probe:** 같은 설치 APK를 재빌드/재설치하지 않고 OS 화면 좌표 touchscreen down/up→readonly range0..8→별도 floating 메뉴의 Copy click→실제 Android clipboard를 확인했다([receipt](.tmp/work8/w9-editing-native/pointer-inspector/runtime-result.json)). 단일 root UI dump는 별도 메뉴를 놓쳤고, 중복 검사 touch는 선택을 접는 fixture 문제였다. 제품 수정은 없다. API33 자동 주입의 해당 readonly 흐름만 PASS-scoped이며 물리 입력·reader·전체 native toolbar/keyboard를 수락하지 않는다. 이제 persistent/pinned/floating header와 나머지 scroll/편집 흐름을 이어간다.

### 9.38 Header·겹침·단일 body Nested scroll

**PASS-scoped / W9-04·전체 PARTIAL.** Nelyx 계약/선택 호환 (보관된 과거 기록 `w9-scroll-header-contract.json`), 동일 후보 수락 (보관된 과거 기록 `w9-scroll-header-acceptance.json`). Persistent/pinned/floating header, finite fill, View별 overlap owner, 실제 두 viewport의 외부 먼저 축소/내부 먼저 역방향 이동과 하나의 ballistic/driven ticker를 구현했다. Header의 현재 child 좌표로 caret을 reveal하고, 닫힌 Element에 종료 알림을 보내지 않도록 분리된 context의 ticker를 해제한다. 살아 있는 화면의 종료 알림은 유지한다. 단일 body/명시적 controller·overlap, 정확한 child extent와 clamped bounds 등 Nelyx 차이를 문서화했으며 Flutter의 자동 floating 우선순위/snap 정책을 약속하지 않는다.

Core header **9**·fill/overlap **7**·Nested **8**, 실제 Chromium header **4**·nested 조합/Unicode/caret/해제 **3**, 기존 action **6**·Page/mixed10,000 **5**, 공통 types와 같은 불변 archive의 외부 strict 소비가 통과했다. 복사 Windows **1,286파일**은 프로그램으로 이동/편집 전달·제거/재생성·owner0/종료 ack·exit0, Android **976파일**은 설치/복사 APK 일치·실제 native 높이128→61px·Unicode와 본문 gap·OS 주입 swipe·이동 중 해제/Activity 종료를 확인했다. Native 10,000-row body는 lazy build이며 전 항목의 native mutation/FPS 검증으로 확대하지 않는다.

첫 native fixture의 Directionality 누락으로 시작이 실패한 기록을 보존했다. 수정 후 npm archive는 그대로 재사용하고 fixture bundle만 다시 빌드했다. DOM 상대 top을 화면 좌표로 비교했던 fixture와 외부 Size 타입/공개 render 조회 오류도 구분했다. 고정 Windows Hermes -Og와 프로세스 범위 JDK21을 유지했고 sample은 원래 SHA로 복원했다. 물리 IME/FPS·Windows OS wheel/별도 text read·cold restoration·실제 multi-View/native 전체 process drain·최종 공급/signing은 미수락이다. Apple/Linux 전용 native는 SKIPPED/provider notVerified이며 공통 구현/공급 의무는 유지한다.

다음은 refresh/reorder/dismiss/sheet·wheel/2D/tree/zoom/custom scrollbar/cold 복원 및 나머지 편집/§10.5 우선 범위다. 후속 A·B와 전체 통합까지 계속 OPEN이다.


### 9.39 Refresh·dismiss·reorder·sheet 및 선택된 Android producer — scoped 수락

수락 (보관된 과거 기록 `w9-scroll-controls-acceptance.json`)·계약 (보관된 과거 기록 `w9-scroll-controls-contract.json`)을 연결했다. Refresh는 coalesced callback/host-neutral 취소·오류·clamped/bouncing/Nested leading drag, dismiss는 keyed 확인/취소/slide-collapse·부모 모델 제거, reorder는 명시적 handle·목록 안의 live keyed 배치·장식 피드백·keep-alive/edge scroll, sheet는 한 body controller의 fraction/본문 분배·snap·motion 취소를 제공한다. 기존 KeepAlive export는 유지하며 ESM 순환 초기화를 분리했고, 제거된 키의 옛 sliver 슬롯과 살아 있는 이동 키를 구분했다.

Core controls **39**, Nested **8**, sliver 회귀 **5**, Chromium **4**, producer policy **7**, 공통 types·외부 strict packed 소비가 통과했다. Chromium은 실제 DOM 부모/포커스/조합 유지와 `한😀` 확정을 확인했다. 복사 Windows **1,293파일**, 편집 세션 **7/7**·행 State **17/17** 해제와 **exit0**; Android **984파일**·설치 APK SHA 일치, 실제 OS refresh/reorder·native Unicode/필드 top **158→321**, 편집 **8/8**·행 **30/30** 해제·Activity 종료를 확인했다. sheet OS 검사는 초기 크기 이상만 보던 약한 조건을 수락에서 제외했다. 같은 설치 APK에서 실제 짧은 View 안의 드래그로 **.75→.9**, 새 종료 응답과 편집 **3/3** 해제를 별도 확인했다.

Android의 선언된 supplier **5a1485/bytecode96**, Windows-host compiler SHA **5cba2482…**에서 동일 제품 easing 직접 호출이 기본 `-O`로 멈추고 `-Og`로 Node와 정확히 같은 5개 값을 반환함을 실제 Android VM에서 비교했다. 이에 app/템플릿·CLI를 선택된 supplier 정책, 실행 시 Gradle acknowledgement·compiler/Gradle SHA와 portable 검증으로 연결했다. Windows **94aa5e1d -Og**와는 별도 근거이며 모든 Hermes 버전이나 성능 결과로 일반화하지 않는다. compiler-only `hermesc -exec` 시도는 INCONCLUSIVE로 보존했다. Core/SDK archive는 그대로 재사용하고 CLI만 새 cohort로 공급했다. 변하지 않은 Windows producer/runtime 근거를 재사용하고 변경된 Android만 빌드했다. 원본 sample entry는 정확히 복원했고 승인되지 않은 외부 게시/push/배포는 하지 않았다.

**전체 work9는 계속 PARTIAL**이다. wheel·2D/tree/zoom·custom scrollbar/cold 복원, 나머지 편집/렌더링·디자인/locale·platform/runtime/dev tooling·실제 성능/공급 감사, 후속 A/B와 전체 통합이 남는다. 물리/native IME·전체 multi-View/native drain·FPS·생산 signing은 미수락이며 Apple/Linux 전용 native는 SKIPPED/provider notVerified다. 공통 구현·공급 의무는 유지한다.

### 9.40 사용자 요청에 따른 중간 마무리 — PAUSED / 전체 PARTIAL

사용자의 “일단 현재 작업중인거 중간마무리하게 하자” 요청을 우선해 추가 구현·새 단계·장시간 전체 검증을 중단했다. 중간 중단 기록 (보관된 과거 기록 `w9-middle-pause.json`)과 handoff (당시 기록, 긴급 정리로 삭제됨)가 현재 재개 지점이다. **§9.39는 마지막 공급 포함 scoped 수락이고, 그 뒤 바뀐 소스는 새 수락 후보가 아니다. 전체 work9는 계속 PARTIAL이며 자동 재개하지 않는다.** 기존 사용자 변경과 모든 작업 파일을 보존했고 commit/push/외부 게시/배포는 하지 않았다.

현재 WIP에는 TreeNode/TreeModel·TreeController·TreeView, ListWheelScrollView·FixedExtentScrollController/Physics, 고정 셀 TwoDimensionalScrollView/Controller, 유한 painted-content InteractiveViewer/TransformationController가 있다. 같은 크기의 transform 변경 때 cached node geometry를 갱신하고, 명시적 controller의 실제 ScrollPosition을 기준으로 scrollbar 알림을 걸러 양축 metrics 혼선을 수정했다. 이 문서의 broad 접근성/임베딩 완료를 뜻하지 않는다.

실제 Core CPU CanvasKit Root 검사는 tree **11**, wheel **10**, 2D **12**, viewer **12**, 커스텀 scrollbar **5**, 총 **50 PASS-scoped**다. lazy seek·키/State·pan/wheel/tap/pinch/trackpad·resize/mutation·취소·observer/callback 종료·제어된 cold snapshot을 해당 범위에서 확인했다. Tree의 10,000개 자식 직접 reveal, wheel의 10,000항목 직접 이동, 2D의 논리 10,000×10,000 셀 직접 이동은 bounded State 생성을 확인한 CPU fixture 결과이며 실제 플랫폼 FPS/전체 성능으로 일반화하지 않는다. 마지막 Core ESM/선언/source-map 빌드는 PASS다.

**실패·미검증:** 연결된 Chromium 검사는 viewer의 `Viewer updates actual DOM editor bounds` 조건에서 실패했다(`.tmp/work8/w9-advanced-browser-first.log`, 실행 1.476초, exit1). 변환된 편집기의 full bounds와 clip된 visible bounds 계약 또는 실제 결함인지는 미분류다. 이 검사에 PASS receipt는 없다. 앞선 좁은 DOM 관찰에서 transform geometry 복원·동일 Element/DOM/포커스/조합은 확인했지만 scale2에서 글꼴은18px로 남아 typography 확대는 OPEN이다. 최신 advanced 소스의 strict packed 소비·공통 types 별도 gate·browser 최종 수락·native/cold app 복원·공급은 실행하지 않았다. 기존 §9.39 Windows/Android 근거를 최신 소스 검증으로 재사용하지 않는다. 추가 브라우저 진단 실행은 중단 요청 이후 검증을 계속한다는 이유로 자동 승인 검토가 거부했으며, 재시도/우회하지 않았다.

작업 소유 fixture 서버 **PID33472/127.0.0.1:58236**과 읽기 전용 emulator **emulator-5584/PID16332, child14404**를 종료했고 남은 소유 프로세스/서버 listener는0이다. 테스트 앱은 force-stop했고 sample entry는 원래 SHA로 복원된 상태다. 타 작업·공유 ADB/Gradle 서비스는 종료하지 않았다. 프로세스별 근거는 `.tmp/work8/w9-middle-pause/owned-process-retirement.json`에 보존했다. 예전 pause-checkpoint는 변경하지 않았다.

**다음 명시적 재개 시:** 현재 diff·중단 기록·입력 hash를 먼저 확인한다. `advanced-scroll-browser.mjs`의 마지막 viewer case와 `interactive-viewer.ts` → `semantics-pipeline.ts` → DOM editing bounds/clip 경계부터 좁혀 실패를 분류한다. 글꼴/style 확대 미완료도 유지한다. 수정된 입력과 관련 회귀만 검증한 다음 아직 공급하지 않은 advanced 묶음의 strict 소비·browser/native cold restore를 기능 단위로 연결한다. 현재는 새 구현·공급을 시작하지 않는다. 나머지 편집/렌더링·디자인/locale·platform/runtime/dev·실제 성능·감사/최종 공급, 후속 A/B·전체 통합, 물리 IME/FPS/signing 미검증과 Apple/Linux 전용 native SKIPPED/provider notVerified를 그대로 유지한다.

## 10. 전체 작업 체크리스트

**2026-10-15 KST / §9.29 구현 증거·§9.26 실행 순서 기준:** 전체 11단계 중 **완료 3개(W9-00·01·02), 진행 중 4개, 미수락 4개 — 완료까지 8단계 잔여**다. §9.22의 기존 수락과 §9.23의 계획 이력을 보존하고 W9-02 새 요구를 수락했다. 전체는 **PARTIAL**이며, 접근성은 §9.25의 부분 수락을 보존하고 잔여를 후속으로 이관했으며, 네이티브뷰 잔여도 후속으로 분리했다. 아래 전체 체크와 별도로 §10.5의 우선 실행 목록을 따른다. 체크는 §5의 단계별 종료 조건과 §7의 완료 기준을 충족했을 때만 표시한다. 미수락 단계에도 이미 구현·검증한 세부 기능이 있으며, 단계마다 작업량이 달라 이 개수를 완료율로 환산하지 않는다.

### 10.1 단계별 완료 목록

- [x] **W9-00 재개 기준 정리 — 완료:** diff·pause·source pin·handoff와 첫 구현 대상·검증 범위 정리.
- [x] **W9-01 선택 기능 실제 연결 — 완료:** 01-A 이력을 보존하고 §9.20에서 **03-S·06-S 선택 선행 및 01-B**를 같은 archive의 원본/Root/브라우저/외부 소비/영향 native 수명까지 수락. §9.21의 사용자 요청으로 레거시 선택 API를 제거했다. 전체 제품·물리 플랫폼 수락은 별도다.
- [x] **W9-02 컴파일·자동생성 후속 — §9.24 완료:** 8 recipe/39 origin의 Nelyx 명세·호환 mapping, 독립 수락/원본 참고 비교, Dart 숫자 주석과 공개 `.d.ts`, 결정성·직접 수정/수동 구현 보존·충돌·실패 gate를 검증. 이후 기능별 lowering은 03~07이 이어받음.
- [ ] **W9-03 공통 서비스·렌더링·기본 입력 잔여 — 진행 중:** **03-S는 §9.20, 접근성 설정은 §9.25, 공통 런타임·이미지·ShaderMask·입력 종료는 §9.27 scoped 수락**. native tree acknowledgement·남은 설정 통합은 후속 A. Nelyx Scheduler·이벤트·owner·platform/plugin, paint/layer/image/asset·복구, typography/font·pointer/gesture/focus/key·animation 잔여 계약을 우선 처리.
- [ ] **W9-04 편집·Form·scroll 통합 — 진행 중:** §9.28의 controller/delta/formatter/undo·Form/TextFormField·RenderEditable·Page 및 mixed 10,000 sliver 흐름 scoped 수락. autofill·native 편집/실제 IME·나머지 편집 API·복합 scroll·cold 복원·성능/플랫폼 수락은 §10.7 잔여.
- [ ] **W9-05 앱 흐름·복원 — 진행 중:** §9.29의 WidgetsApp·route/Router/Back·dialog/Hero·async/restoration/locale 및 Chromium 통합 scoped 수락. §9.30에서 native 저장 producer·SDK·native 컴파일을 수락했으며 실제 OS 링크/Back/재시작 복원·현재 공급 수락은 §10.8 잔여. semantics bridge/collection metadata와 실제 접근성 action·reader는 후속 A.
- [ ] **W9-06 디자인·전체 locale 공급 — 진행 중:** **06-S 선택 theme/localizations·magnifier·handle·adaptive toolbar는 §9.20 수락**. 그 뒤 Nelyx의 Material/Cupertino 호환 범위·theme/control/form·adaptive UI, 명시한 지원 locale·icon/font/asset/notice와 선택 설치·독립 소비 수락. 선택 선행의 실제 수락이며 W9-06 전체 완료는 아님.
- [ ] **W9-07 여섯 플랫폼 runtime/tooling 분리 — 미수락:** host-*/tool-* 이동, SDK/CLI/Metro 선택형 provider, 일반 native·Skia 소유권과 OS 기능 잔여, 여섯 runner/template·배포 구성 및 실제 수명 수락 우선. native/HTML view·임베딩 전용 ViewApi/texture는 후속 B.
- [ ] **W9-08 개발 갱신·inspector — 미수락:** State 보존 hot reload/reassemble·필요한 remount, inspector/source map/preview/service extension, Web·Windows·Android 실제 갱신·자원 해제 수락.
- [ ] **W9-09 필수 실제 환경 수락 — 미수락:** Windows/Android/Web 우선 기능·물리 IME/keyboard·FPS, resize·hidden/resume·GPU loss·복구·종료와 해당 native 자원 해제 검증. 접근성/reader·네이티브뷰 전용 검증은 후속.
- [ ] **W9-10 최종 감사·공급·정리 — 미수락:** Nelyx 필수 명세의 미구현/미검증·필수 dependency 해소, 공개 호환/대체/제외 근거, 숫자 주석·source provenance·package/archive·6 target 공급·외부 소비·배포/signing/clean-machine·license/notice·재현 수락. Flutter coverage 전수 0은 요구하지 않음.

세부 요구사항은 §0·§5·§7의 Nelyx 기준을 따른다. W8/W7에서 가져온 기능 후보·호환 범위·지원 locale는 명시적으로 검토하며 기존 제품·플랫폼 요구를 조용히 삭제하지 않는다. iOS/macOS/Linux 전용 native 검증은 §7에 따라 **SKIPPED / provider notVerified**로 기록하며, 여섯 target의 공통 TS·코드·패키지 구성 의무는 유지한다.

### 10.2 후속 A — 접근성 설정 묶음의 잔여 목록

아래는 **우선 범위 수락·공급 이후 진행할 W9-03/W9-05의 후속 세부 작업**이며, 위 11단계에 추가되는 별도 단계가 아니다. §9.18의 PASS는 당시 후보의 증거로 보존하고 이번 후보는 §9.25의 Nelyx 계약·현재 입력을 따른다. 이 목록은 03-S 선택 렌더링 선행 작업과 구분한다. 재개 때 callback/feature/tree 소유권은 Nelyx 접근성 명세로 정하고 Flutter 내부 순서를 그대로 재현할 의무로 해석하지 않는다.

- [x] **실제 Web 설정 변경·종료 검증 — §9.25:** 두 앱의 reduced-motion/forced-colors→View/MediaData 반영, 종료 뒤 listener 0개와 남은 앱 갱신.
- [ ] **Android/Windows OS 연결:** producer·지원 mask/정책·빌드와 Android 실제 설정→native 모듈은 §9.25 수락. native 설정→렌더된 View와 semantics tree 소유권·acknowledgement는 남음.
- [x] **callback·오류 통합 검증 — §9.25:** 공개 callback 교체/throw, 다중 View·다른 앱 격리, post-frame coalescing, 등록 실패 rollback·cleanup 오류 보고·초기화 중 종료. 실패한 native cleanup owner 회복은 별도 잔여.
- [ ] **현재 후보 수락·기록 갱신:** §9.25에서 외부 소비 4조합·8배치·coverage 정합성과 복사 Windows/Android 실행을 수락. 직접 영향 origin 3개를 연결했으며 다른 stale origin **58개**와 native tree/설정 전체 흐름은 남음.

접근성 후속의 증거 진입점은 **§9.25**다. 전체 작업 요청의 현재 재개 위치는 **§9.36·§10.5의 우선 잔여**이며 handoff (당시 기록, 긴급 정리로 삭제됨)도 현재 서비스·복원 후보로 갱신했다. W9-03·04 잔여는 §10.6·10.7, §9.18과 W9 pause checkpoint (보관된 과거 기록 `w9-pause-checkpoint.json`)는 과거 중단 이력으로 보존한다.

### 10.3 W9-01 실행 목록 — §9.20 수락

아래는 §5.1의 **당시 수락 이력**이다. 기존 11단계 안의 세부 묶음이며 상위 단계 총수는 그대로다. 이후 변경은 §0·§4.3·§7의 Nelyx 기준을 따른다. §9.19와 별도 접근성 pause를 보존하고 이 순서로 실행해 §9.20에서 수락했다.

- [x] **01-A 수락 기록 보존:** §9.19의 registry·선정 선택·외부 소비·3환경 실행 결과. 이번 계획 개정에서 runtime을 다시 실행한 것은 아님.
- [x] **03-S / 첫 수정 대상 확정:** Core magnifier·layer·scene/paint 계약과 각 backend의 backdrop 지원을 대조하고 원본 필수 의존성·영향 protocol·검증 범위를 정함. 필요한 02 규칙은 이 묶음에 포함.
- [x] **03-S / 구현·경계 수락:** 실제 픽셀 확대·합성 순서·clip/transform·자원 수명 연결. 변경한 wire/ABI가 있으면 대응 producer/decoder/version gate와 영향 native 실행까지 확인.
- [x] **06-S / 필수 디자인 의존성:** 선택 기능이 사용하는 canonical theme/localizations·필수 locale 데이터와 내부·외부 의존성을 구현. 무관한 디자인/locale 잔여는 06의 기존 목록에 유지.
- [x] **06-S / 전체 선택 family:** Material/Cupertino magnifier·positioner/animation·handle·adaptive toolbar의 원본 기본값·overflow·플랫폼 정책·수명 연결.
- [x] **01-B / 기본 경로 연결:** SelectionArea 기본 확대경과 정식 controls/toolbar를 적용하고 사용자 override·명시적 disabled·keyboard/우클릭·다중 View 동작을 보존.
- [x] **01-B / 현재 후보 수락:** §5.1의 원본·Root·영향 실제 backend·owner 해제, 출처/coverage·변경 배치·동일 archive 외부 소비·공급·종료를 완료한 뒤 W9-01 상위 체크를 갱신.

**계획 개정 당시의 범위(이력):** 저장소 지침·현재 handoff·selection-progress·실제 magnifier/SelectionArea/toolbar 소스를 확인하고 순서·소유 단계·완료 조건을 수정했다. 당시는 `work9.md`만 변경했다. 이후 이번 W9-01 실행의 제품·검증·공급·수락은 §9.20이며 OS 설정 WIP는 계속 중단 상태다.

### 10.4 W9-02 새 후속 실행 목록 — §9.24 완료

- [x] 현재 8배치의 Nelyx 계약·공개 호환 범위·독립 구현 mapping·수치 정책과 필수 테스트 연결.
- [x] batch/evidence 수락을 Nelyx 명세 결과와 Flutter 참고 비교로 분리. 과거 receipt와 원본 coverage 의미 보존.
- [x] resolved Dart 숫자 타입·nullable·추론·컬렉션/generic 정보 전달 및 `@dartType`·`@dartParam`·`@dartReturn` 주석 방출.
- [x] generated/effective/제품 `.ts`와 공개 `.d.ts` 주석, 결정적 재생성·직접 수정 보존·충돌 검증.
- [x] 영향 배치의 기능·수치·안정성 및 필요한 성능/소비 검증 후 현재 handoff 갱신. §9.24의 현재 후보 증거와 연결.

### 10.5 현재 우선 실행 목록 — 접근성·네이티브뷰 제외

다음 구현은 **1번의 §10.6 잔여**부터 이어간다. 각 묶음의 필요한 02 lowering/숫자 주석·출처·영향 검증을 함께 처리하며, §10.1은 전체 범위의 체크로 보존한다.

1. [ ] **W9-03 우선 잔여:** Scheduler·이벤트·공통 서비스/owner/platform/plugin, paint/layer/image/asset·복구, typography/font·pointer/gesture/focus/key·animation의 Nelyx 계약과 구현·수락.
2. [ ] **W9-04·05 준비된 흐름:** 편집/Form/IME·scroll/sliver·앱 route/Back·Overlay/Hero·복원·locale 통합. 접근성·네이티브뷰 전용 통합은 §5.4로 이관.
3. [ ] **W9-06 우선 잔여:** Material/Cupertino theme/control/form·adaptive UI, 지원 locale·icon/font/asset/notice·독립 소비. 접근성 전용 요구는 후속 A.
4. [ ] **W9-07 우선 분리:** 여섯 host/tool·SDK/CLI/Metro·provider·runner/template·공급 구조, 일반 native/Skia·OS 기능과 자원 수명. 임베딩 전용 ViewApi·native/HTML view는 후속 B.
5. [ ] **W9-08 우선 개발 흐름:** State 보존 hot reload/reassemble·inspector/source map/preview와 Web/Windows/Android 갱신·cleanup. 후속 기능 전용 연동은 해당 후속에서 수락.
6. [ ] **W9-09 우선 실제 환경:** 위 기능의 Windows/Android/Web·물리 IME/keyboard·FPS·복구·종료 수락. reader/접근성·네이티브뷰 전용 수락은 제외.
7. [ ] **W9-10 우선 감사·공급:** 우선 필수 계약/의존성·숫자 주석·출처·재현·6 target 구성/공급·외부 소비·배포/signing/clean-machine·license/notice 수락. §7에 따라 `우선 범위 완료 / 전체 PARTIAL` 기록.
8. [ ] **그다음 후속 A·B 및 전체 통합:** §10.2 접근성 잔여와 §5.4 네이티브뷰를 구현·검증하고 영향 회귀·09 실제 환경·10 감사/공급을 갱신한 뒤 전체 체크 재판정.

### 10.6 W9-03 공통 런타임 묶음 — §9.27

- [x] Scheduler/frame 요청 실패 rollback·재시도와 Ticker 시작/종료.
- [x] service observer 제거·재진입 환경 순서·keyboard callback 보존·종료 해제.
- [x] asset 실패 재시도·image 취소/progress·cache identity·앱 memory pressure 연결.
- [x] FileImage/Image.file 전용 bounded native IO와 ShaderMask/RenderShaderMask 공개 API.
- [x] mouse hide/close 재진입·Root pointer/animation·CPU/WebGL/native offscreen mask 검증.
- [x] 현재 공급 Windows/Android 복사 probe에서 decode·취소·mask frame·HTTP 결과. Windows exit0, Android Back/no fatal log를 각각 기록.
- [x] 8배치·외부 소비·origin/coverage 정합성, 공통 types, 임시 sample 소스 복원과 handoff 갱신.
- [x] **§9.30 서비스/worker 묶음:** 부분 등록 rollback·동기 admission 차단·pending plugin 이후 서비스 해제·오류 cleanup·Back claim 회복과 현재 SDK/Node/Chromium/외부 소비.
- [x] **§9.34 명시적 완료 회복:** GPU query·plugin/native bytes·앱·surface/host·Web 등록의 단계 보존/재시도와 실제 후보의 주입 미확인 수락.
- [x] **§9.35 cache/recording 묶음:** display-list admission/폐기 실패·compiler owner/input 유지와 bounded Picture.toImage bitmap의 실제 Chromium/Windows/Android 수락.
- [ ] 나머지 service/platform/worker·초기화/stop·cache/retirement 실패 감사와 지속 오류 회복/실제 backend 계약.
- [x] **§9.33 rawUnmodified·all5 format:** native metadata·저장 byte order/alpha·Web cleanup·실제 GPU loss readback 및 현재 복사 EXE/APK·외부 archive 소비.
- [ ] wide gamut 전체 rendering/output·bitmap raster cache 등 잔여 이미지/paint 지원 계약과 구현.
- [x] **§9.36 animation 묶음:** finite repeat·callback 교체/실패·0ms 및 움직이는 DOM control geometry/입력 수락.
- [ ] typography/font·pointer/gesture/focus/key·animation 전체 공개 API 감사 및 남은 제품 흐름.
- [ ] 실제 backend 복구·전체 native drain·필수 실제 환경 수락. 물리 IME/FPS는 W9-09와 연결.
- [ ] W9-03 우선 범위 전체 수락. 접근성·임베딩 네이티브뷰는 후속 A·B로 유지.

### 10.7 W9-04 편집·Form·scroll 묶음 — §9.28

- [x] 불변 controller snapshot·UTF-16 delta·길이/predicate formatter·bounded undo/redo/reset 및 늦은 clipboard/session 차단.
- [x] 관찰 가능한 IME 조합 중 rewrite 차단, 확정 시 formatter, native 응답 이후 제출/이력 변경. 관찰 불가 host의 formatter 명시적 실패.
- [x] Form/FormField/TextFormField 등록·자동/명시 검증·save/submit/reset·controller 소유권·GlobalKey Form 이전.
- [x] 공개 RenderEditable·ancestor caret reveal·실패 rollback/cleanup, Chromium 두 필드 실제 입력·focus·오류 UI·키보드 undo·종료.
- [x] PageView/PageController/PageScrollPhysics: lazy 10,000 페이지·fraction·jump/animate/snap·resize/controller 교체·PageStorage 논리 페이지 복원.
- [x] mixed measured list/grid 10,000개의 mutation·fling·resize·hidden/resume·State 해제 및 fixture 시간 관측.
- [x] 편집/Root/native adapter 19그룹·scroll 5·Chromium 4, 기존 scroll/shortcut 회귀, Core/SDK build·공통 types·Core packed 외부 소비.
- [x] **§9.37 편집/자동완성 묶음:** bounded configuration·composition-safe mode/group·AutofillGroup/service·Android ABI2/실제 제공자 저장/취소·native Copy API/Core Clipboard·복사 앱 해제.
- [ ] native OS touch/menu·keyboard/undo/toolbar·물리 IME/caret와 실제 multi-View/provider 잔여.
- [x] Multiline/read-only/obscure와 keyboard/suggestion 설정 및 조합 확정 후 변경.
- [ ] style/선택 toolbar 등 나머지 편집 공개 API 및 grapheme 길이 정책.
- [x] **§9.38 selected Nelyx scroll:** persistent/floating/pinned header·finite fill/overlap·단일 body Nested scroll, 실제 Root/DOM/복사 Windows·Android 해제 수락.
- [x] **§9.39 selected controls:** Refresh·reorder·dismiss·draggable sheet, 실제 Root/Chromium/복사 Windows·Android, 선택된 Android producer -Og 정책·응답·해제 수락.
- [ ] Nested/controls의 나머지 복원·변환/zoom 통합·물리 IME 및 확대된 실제 앱 요구.
- [ ] Wheel·two-dimensional/tree/zoom 기능과 실제 사용자 흐름.
- [ ] Scrollbar customization·cold restoration·확대된 keyed State/selection 유지 및 첫 seek 성능 요구.
- [ ] 현재 SDK bootstrap/복사 Windows·Android 앱·native 입력·성능/공급 수락. 기존 native receipt와 synthetic composition은 대체 증거가 아님.
- [ ] W9-04 전체 종료 조건 수락. W9-03 잔여와 접근성·네이티브뷰 후속을 유지.

### 10.8 W9-05 앱 흐름·복원 묶음 — §9.29

- [x] 불변/bounded named route stack·결과·저장/원자적 복원·controller mount 소유권.
- [x] 비동기 PopScope·오래된 Back 차단·가려진 nested Navigator의 Back/ticker/focus 격리.
- [x] 최신 Router parse만 commit·공통 route State 유지·history 직렬화·오래된 응답 차단·cold explicit link 우선.
- [x] WidgetsApp의 MediaQuery/theme/locale/direction/Overlay 조합·지원 locale 해석 및 State 유지.
- [x] Non-opaque dialog·실제 Overlay Hero shuttle/rect flight·종료 시 entry/ticker 해제.
- [x] Future/Stream stale value/error/completion 차단·동기 stream admission·구독 해제.
- [x] Route-local restoration·typed property·기존 scroll offset·전송 순서/재시도·Web app-ID sessionStorage 공급.
- [x] Chromium 실제 link→Form/list→dialog→Back/Forward→locale→reload 복원과 명시 URL 우선 수락.
- [x] SDK/제어 native Linking initial URL/event·listener epoch·종료 연결 및 미완료 query의 logical drain.
- [x] 앱 15·platform 4·Chromium 5, 기존 runtime/편집/Overlay 회귀 47, Core/SDK build·공통 types·Core packed 외부 소비.
- [x] **§9.30 Windows/Android `flutter/restoration` 저장 producer:** app-ID namespace·4 MiB·commit/순서/실패 재시도/종료 drain, SDK·native 컴파일 및 Windows helper의 별도 프로세스 복원.
- [x] **§9.31 실제 현재 복사 EXE/APK의 process recreation 복원.** Korean text·Form/dialog route·offset350, Windows exit0와 Android Back/locale를 후보별 범위로 수락.
- [x] **§9.34 Android 명시 SystemNavigator Activity.finish:** native producer·채널·실제 종료 중 raster/image 완료 ack. OS Back의 기본 background 정책과 구형 host fallback은 구별.
- [ ] 실제 OS URI/app-link·Back·nested Form/list/dialog·locale/복원/종료 전체 및 현재 최종 복사 EXE/APK 수락. §9.31~9.34의 scoped native 흐름을 재사용하며 Windows OS Back/locale·전체 Android runtime drain 등 잔여를 유지.
- [ ] 영향 SDK/native 공급 및 W9-09/10 실제 입력·성능·origin/coverage·재현/최종 감사.
- [ ] W9-05 전체 종료 조건 수락. 접근성/임베딩 native view 후속과 W9-03·04 잔여를 유지.
