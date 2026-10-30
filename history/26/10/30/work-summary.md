# 2026-10-30 — Windows 리사이즈·스크롤 개선과 코드 품질 정리 요약

보관일: **2026-10-30 KST** · 원문: 루트 `work.md` · 작업 기록 범위: **2026-10-27~30 / 원문 §1~25**

Windows 창 크기 조절, All Components 스크롤·hover, SDK 자동 갱신, oxlint·Oxfmt 작업의 결과를 주제별로 정리했다. 수치·검증·제품 지문은 원문에 기록된 당시 결과이며, 이번 문서 보관에서 빌드·앱 실행·성능 측정을 다시 수행하지 않았다. 중간 중단점의 미반영 상태는 후속 완료 기록과 구분했다.

## 최종 상태

| 항목 | 원문 최종 결과 | 남은 경계 |
| --- | --- | --- |
| ListView 트랙패드 | 시작·10초 이상 연속 이동·손을 뗀 뒤 재접촉에 대한 사용자 확인 **PASS-scoped** | 다른 장치·장시간 재발까지 배제하지 않음 |
| All Components 두 열 스크롤·hover | 최신 AOT에서 사용자가 **“직전 빌드보다 더 부드러움”** 확인, 체감 개선 **PASS-scoped** | 잔끊김 완전 해소·cold 진입·전체 표시 성능은 **PARTIAL** |
| Windows 리사이즈 | Static AOT 10사례·1,533캡처의 정합성 검사 통과 | 목표 51 geometry/s·CPU p95 10ms 미달, **`resizePerformanceAccepted=false`** |
| SDK 자동 갱신 | 일반 Windows 실행에서 내용 비교→빌드·공급·설치→기존 구성 재빌드·실행 확인 | 명시적 `--package`는 선택한 패키지 검증·실행 유지 |
| oxlint 정리 | 1,733파일·95개 활성 규칙, 오류 0·경고 0 | 소스·로컬 SDK 출력 범위 |
| Oxfmt 적용 | JS/TS 1,733파일·설정 2파일 검사 통과 | 플랫폼 공급·AOT/앱 재실행·물리 입력 재검증은 수행하지 않음 |

물리 IME, 표시 FPS·scanout, 전체 제품 성능 수락은 **`notVerified` / 미수락**을 유지한다. 기존 W18의 `performanceAccepted=false`도 이번 기록으로 완료 처리하지 않는다.

## Windows 리사이즈와 공통 프레임 처리

원문 §1~8·§10의 핵심은 실제 창 크기 변화의 처리량 개선이다. owner/view/viewport/surface 세대와 실제 extent가 일치하는 prepared frame만 표시하고, deadline 초과 시 기존 rect와 canonical metrics로 복귀한다. 취소된 작업도 GPU upload·retirement와 자원 해제를 끝낸다. GPU copy retirement→pre-geometry clock→실제 geometry→WinUI/native commit 완료→`DwmFlush`의 동기화 순서를 유지했다.

- immutable primitive 명령과 같은 resource owner를 가진 batch의 Picture를 재사용하고, viewport 변경은 bounds metadata를 갱신한다. 변경 batch의 균형 잡힌 하위 scope도 재사용하되 구조·명령·owner/generation 변경은 재기록한다. 이미 제출된 프레임은 독립 hold를 유지하며 layer 퇴역·실패 시 정리한다.
- save/restore와 검증된 불변 transform을 공유하고 composition metadata를 약한 참조로 관리한다. 외부 frozen 배열·stateful iterator·custom hook은 별도로 캡처·검증한다. source recipe의 명령 감소나 V8 할당 표본을 Hermes·GPU·제품 FPS 개선율로 승계하지 않는다.
- `requestFrameAt`으로 semantics deadline 이전의 불필요한 Root 실행을 줄였다. redraw·action·forced 요청은 앞서 실행될 수 있고, 숨김·종료·실패·제출 예외에서는 callback을 해제한다. 이 변경만의 native FPS 개선은 입증하지 못했다.
- Root paint 재사용·admission 기반 제출 생략은 두 번째 제출 누락(`1 !== 2`)으로 철회했다. 실제 요청 프레임마다 paint→compose→capture→submit하며 paint 중 무효화도 보존한다. native commit 대기 제거의 11px, `DwmFlush` 제거의 6/4px 등 과거 marker 실패도 성공 결과로 덮지 않는다.

2026-10-28의 **Static Hermes / optimized / x64 Release**, 주 모니터 2560×1600·165Hz·DPI 192, AMD Radeon 780M, semantics **50ms**, 요청 **61Hz·4초 왕복** 조건의 기록이다. 이후 Gallery의 semantics 설정은 300ms로 바뀌었으므로 아래 값을 새 설정의 재측정으로 보지 않는다.

| 장면 / 모서리 | 실제 입력 Hz | geometry/s | desktop 변화/s | geometry 간격 p95 | resize CPU p95 |
| --- | --- | --- | --- | --- | --- |
| Material / 우하단 | 60.99 | 19.95 | 19.71 | 54.99ms | 22.34ms |
| Material / 좌상단 | 60.98 | 20.00 | 19.76 | 55.00ms | 23.85ms |
| ListView / 우하단 | 60.97 | 19.29 | 19.04 | 60.31ms | 25.41ms |
| ListView / 좌상단 | 60.99 | 19.36 | 19.11 | 60.39ms | 26.98ms |
| Cupertino / 우하단 | 60.99 | 20.10 | 19.85 | 55.27ms | 23.13ms |
| Cupertino / 좌상단 | 60.98 | 19.18 | 18.93 | 60.69ms | 26.60ms |

기본 6·최소 계측·width/height QPC·600px breakpoint의 **10사례 / 5개 프로세스가 exit 0**이었다. capture on 7사례의 **1,533개**에서 배경 노출·glyph 변형/누락·marker·geometry/generation·origin 오류가 없었고, 10사례의 준비 timeout·제안 거절도 0건이었다. capture off 3사례는 화면 **`notObserved`**다. 최소 계측은 **19.68 geometry/s·CPU p95 26.05ms**, breakpoint는 **18.58 geometry/s·CPU p95 58.97ms**였다. breakpoint 218캡처의 padding 전환 origin 오차는 0px지만 18px short header 범위이며 큰 제목 28/36px 전환은 미검증이다.

QPC에서 width metrics **82/82**, height **103/103**이 기존 예약과 합쳐졌다. width Root build는 93개, metrics→build p95 **8.78ms**, metrics→copy retirement **36.20ms**, exact Root **24.28ms**, paint **9.11ms**였다. height build는 211개이며 첫 build와 prepared-copy 연결은 **102/103**이었다. height metrics→copy retirement p95 **24.90ms**, geometry **25.47/s**, UI prepare 중앙값 **17.10ms** 뒤 clock **3.64ms**, WinUI commit **0.43ms**, native commit completion **6.90ms**, `DwmFlush` tail **5.78ms**를 각각 관찰했다. 중첩 구간을 합산하거나 native 완료를 실제 표시 receipt로 취급하지 않는다.

성능 목표는 `R=min(표시 주사율,60)`, `B=1000/R`에서 geometry `0.85R` 이상, 간격 p95 `2B` 이하, 입력→actual geometry p95 `3B` 이하, metrics→ready p95 `B` 이내, CPU p95 `0.6B` 이내다. 60Hz 기준 **51 geometry/s·CPU p95 10ms**에 미달했다. 단계 상태는 **S0 DONE-scoped / S1·S2·S3·S5 PARTIAL / S4 CONDITIONAL**이며 CPU·native 동기화의 시간 분해와 성능 수락이 남았다.

## 트랙패드·입력·종료 경합

원문 §9~11에서는 반복 스크롤 중단과 약 0.7~1초 끊김을 조사했다. 처음 정상 확인과 자동 휠 통과 뒤에도 사용자가 재발을 보고했으며 Explorer 독립 실행에서도 재현됐다. CLI 출력 pipe나 접근성 포커스 하나로 원인을 확정하지 않았다.

- 좌표 매퍼 생성마다 DirectManipulation이 등록돼 부팅 중 객체가 17개 생기던 구조를 고쳤다. 실제 `WindowsSkiaViewState`가 입력 객체 **1개**를 소유하고 좌표 독자는 이를 공유한다. passive semantics 갱신은 포커스를 다시 가져오지 않으며 실제 논리 focus·명시적 UIA action은 유지한다.
- interaction 중 READY 취소·reset을 미루는 중간 보강 뒤에도 재현됐고, 합성 reset이 실제 start/update/end로 새는 회귀도 발견했다. 최종적으로 활성 입력의 **14ms HWND timer**와 **DWM 주기·QPC phase 기반 취소 가능한 고해상도 frame timer**를 적용했다. DWM 정보를 얻지 못하면 60Hz를 사용한다. reset serial과 실제 Update 완료로 합성 callback을 억제하며 nonidentity native transform 회귀를 추가했다.
- Cupertino 종료의 `Windows UI requires its active JS platform` / `REACT_ERROR`로 세 화면 검사가 한 번 실패했다. closing/closed/failed UI에서 남은 JS frame batch를 시작하지 않도록 보강하고 이미 승인된 GPU producer의 drain은 유지했다. 종료 전용 검사와 뒤이은 원래 세 화면 검사에서 오류가 재현되지 않았다.
- Windows nonvisual 입력은 필드 이동마다 전체 호스트 store를 다시 발행하지 않는다. TSF 좌표·bounds·configuration·수명 알림은 유지한다. 필드 4개·24프레임 CPU fixture의 발행 **120→24회**는 진단 결과이며 제품 FPS 개선율이 아니다.

10월 28일 실제 AOT의 Material·ListView·Cupertino 양방향 연속 OS 휠과 입력 직후 닫기는 PASS였다. 최대 화면 변화 간격은 각각 **144.88/115.09/115.01ms**, 세 프로세스는 exit 0 및 `views=0 consumers=0 gpuDrained=1 inputRetired=1`이었다. Material 최대화·복원의 기존 `actual-frame`·`actual-commit` timeout 각 2회는 남았다. 이어 사용자가 ListView의 **“시작·연속·재접촉 모두 정상”**을 확인했다. 같은 실행의 native→SDK→Core 입력 2,590건 일치는 입력 보존 관찰이며 전체 scanout 수락이 아니다.

진단 도구 `windows-input-trace.ps1`·`windows-scroll-observer.ps1`는 bounded RAM 관찰을 제공한다. native ring은 숫자 최대 **8,192개**, 기본 16회당 표본 하나이며 `NELYX_WINDOWS_INPUT_TRACE_FULL=1`도 같은 ring을 쓴다. `frameGaps`는 실제 연속 submission 공백과 표본 누락을 구분한다. DirectManipulation을 OS mouse-wheel count로 대신 판정하거나 end/cancel을 물리 손 떼기의 증거로 해석하지 않는다. 축소 화면 hash·native surface update·retirement도 표시 FPS·scanout receipt가 아니다.

## All Components·접근성·hover 비용 개선

원문 §13~23의 주 재현 조건은 **최대화한 All Components 두 열**, 버튼·텍스트필드 위 포인터와 트랙패드 스크롤이다. 중간 source/native 통과 뒤에도 동일하거나 더 끊긴다는 사용자 피드백이 있었고, 최종 체감 개선까지 후속 수정했다.

- Gallery 접근성 위치 갱신은 1000ms 실험 뒤 최종 **300ms**, 정지 후 **100ms** quiet deadline으로 조정했다. 300ms 제품 반영이 중단된 시점도 있었으나 §15 이후 AOT에 포함됐다. 값·focus·활성 상태·접근성 action은 즉시 반영하고, 지연 edit/selection/range 요청은 최신 revision·owner·privacy·visibility를 재검사한다. IME/TSF geometry commit은 매 프레임 유지한다.
- 재귀 visibility 조회를 줄이고 실제 `paintsChild`·offstage·keep-alive 상태를 확인해 화면 밖 editor의 glyph/selection 질의와 geometry를 철회한다. Core가 검증·deep capture한 geometry만 SDK에서 재사용하며 외부 frozen/mutable 값은 다시 검증한다. paragraph의 dry 크기·기준선은 최대 두 너비 geometry를 공유하고 editor는 실제 표시 문단을 먼저 layout한다.
- bounded sliver는 목록별 `capacity: 0..8`을 지원하고 Gallery는 **`capacity: 2, preparation: 'disabled'`**를 사용한다. View 전체 optional child 16·Element 2,048과 편집기 keep-alive를 유지했다. 29개 Material 섹션의 두 열/한 열 탐색에서 producer peak **92**, resident paragraph peak **114~115**로 기존 128/256 목표 안이었다. 복잡한 최초 생성은 demand-driven으로 남았다.
- Windows Vulkan의 프레임별 예산 계산을 **40→48 bytes/physical pixel**로 바꿔 큰 scratch 할당 반복을 줄였다. Context **96~192MiB**, Graphite allocator **256MiB** 상한과 backing 변경·retirement 정책은 유지했다. warmed 92프레임의 신규 allocator 할당 0회·recording insert p95 0.331ms는 bytecode·계측·프로그램 스크롤 진단이다.
- `InputDecorator`·Material physical shape의 색·border·elevation·shadow 애니메이션은 paint notifier와 실제 renderer를 갱신한다. 같은 layout·editor Widget을 재사용하고 TextField·ButtonStyleButton을 RepaintBoundary로 분리했다. border 두께·gap·style·shape/direction 등 실제 layout/clip 변경과 사용자 override는 반영하며 notifier·ticker는 종료 시 해제한다.
- 값이 같은 Semantics wrapper와 focus delegate를 재사용하고 scroll/follower의 위치 변경은 기존 geometry 큐로 보낸다. label/action·extent·visibility·실제 focus owner 변경은 즉시 갱신하고 이전 snapshot action을 폐기한다. source 24프레임의 hover snapshot **10→2회**는 계산량 진단이다.
- immutable retained recording 전체를 app-local Picture에 한 번 캡처한다. 기존 **64-entry / 32MiB** 예산, 이전 프레임의 독립 hold, 마지막 참조 해제와 compile 실패 rollback을 유지한다. editor의 local geometry만 재사용하며 부모 transform·clip·입력 geometry는 매 프레임 반영한다. native 계측의 All Components no-hover CPU p95 **23.21→15.95ms**, field hover **22.97→19.18ms**는 단일 전후 진단이다.
- hit test는 이미 캡처한 sliver 변환 snapshot을 Root까지 보존하고 MouseTracker가 실제 소비하는 transform만 읽는다. cursor-only 중복 이벤트 생성과 private affine 결과의 재복사·검증도 줄였다. 외부 entry·mutable/frozen 행렬·변경 callback은 보수 경로를 유지하며 전체 16 lane·signed zero·연산 순서·enter/exit 전달을 보존한다. 추가 admission 배열 복사는 같은 owned 연산 24개에서 **24→0회**였다.

최종 §23 source 회귀는 **286 PASS·1 optional profile SKIP·0 FAIL**, 전체 workspace typecheck·Core build PASS였다. 수정 전후 native Gallery는 각각 **12구간 PASS·exit 0·정상 drain**이었다. `Input.hitTest` p95는 **1.220→1.001ms**였지만 p99는 **3.64→4.65ms**로 늘었고 cold 최대 **245.87ms**도 남았다. 서로 다른 호스트 빌드의 component 진단을 전체 FPS·물리 표시 수락으로 환산하지 않는다.

최종 AOT의 버튼 실행, 양방향 OS 휠, 편집 중 왕복 휠 뒤 재클릭 없이 추가 입력, caret·문서·focus 보존과 runner exit 0을 확인했다. 진단 환경변수 없이 다시 연 같은 제품에서 사용자는 **“거의 줄었지만 더 줄이면 좋을듯”**이라는 이전 피드백에 이어 **“직전 빌드보다 더 부드러움”**을 확인했다. 해당 물리 입력 경로의 체감 개선만 **PASS-scoped**이며 잔끊김 완전 해소·IME 조합·표시 FPS 수락은 남는다.

## Windows 실행의 SDK 자동 갱신

원문 §12에서 Testbed 실행은 저장소와 설치된 Nelyx 패키지 내용을 비교하고, 오래된 TypeScript 출력만 빌드한 뒤 공급·설치하도록 바뀌었다. 설치 뒤 새 CLI를 로드한다. 공통 RNW 실행은 설치 내용 SHA-256과 앱 manifest의 `sdkInputsSha256`을 비교해 변경·지문 누락 시 마지막 패키지의 엔진·AOT/bytecode·compiler profile·Debug/Release를 유지한 채 재빌드한다.

같은 버전·mtime의 소스/JS/header 교체와 추가·삭제도 감지한다. 지문은 generated header와 native build acknowledgement에 연결해 재컴파일을 확인한 뒤 패키지를 발행한다. 빌드·설치 실패나 빌드 중 입력 변경은 앱 실행을 중단하며, 변경이 없으면 공급·설치·native/AOT 재빌드를 건너뛴다. 명시한 `--package`는 해당 패키지를 검증·실행한다. 실행 회귀 **15/15**, 교체·rollback **16/16**, 실제 일반 명령의 자동 재빌드·재실행 생략을 확인했다.

```powershell
npm.cmd run run:windows --workspace @nelyx/testbed-2
```

실행·진단 방법은 [Testbed 한국어 안내](../../../../sample/nelyx-testbed-app-2/README.ko.md)와 [영문 안내](../../../../sample/nelyx-testbed-app-2/README.md)에 둔다.

## 10월 30일 oxlint·Oxfmt 정리

원문 §24의 **oxlint 1.90.0** 최종 결과는 **1,733파일·95개 규칙·오류 0·경고 0**이다. 최초 경고 994건은 구문 정리 738건, 관례에 맞춘 설정 153건, 이유를 적은 국소 예외 103건/80줄로 처리했다. 미사용 import 445개는 필요한 부작용 초기화를 보존하며 제거했고, 순회 99곳은 스냅샷 시점·순서·콜백 중 변경 격리를 유지했다. getter 효과·signed zero·NaN/Infinity·명시적 then·정리 실패 전파·conformance fixture를 보존하고 옛 ESLint 예외 15개를 제거했다. Dart 생성기의 중복 break·버리는 표현식·import 출력도 정리했다.

원문 §25의 **Oxfmt 0.75.0**은 JS/TS **1,733파일·설정 2파일**을 검사했고 JS/TS 1,711파일과 기존 린트 설정의 포맷을 정리했다. 기준은 2칸·printWidth 100·작은따옴표·세미콜론·LF다. import/패키지 JSON 정렬·내장 언어 포맷은 끄고 속성 키 표기·태그 템플릿·native 패치 문자열·import 평가 순서를 보존했다. C++/C#/Dart·과거 데이터 JSON은 대상이 아니다. 재적용의 소스 변경은 0개였다.

- 정규화 구문 트리 1,721파일 일치, 나머지 12파일은 논리 연산자 결합 괄호·JSX 공백의 실행 동등성을 별도 확인했다. 국소 예외 80곳은 줄바꿈 후에도 같은 구문을 감싸도록 disable/enable 범위로 바꿨다.
- wire 버전 추출과 Windows animation fixture의 마지막 최상위 등록 호출 치환이 공백·여러 줄을 허용하도록 보완했다. 최초 SDK 빌드 실패를 수정한 뒤 같은 `build:sdk` 전체 명령을 다시 통과했다.
- lint 단계의 generated 17개, formatting 단계의 13개를 adopted로 보호했다. 포맷 후 현재 소유권 SHA 99개·productHash 39개를 동기화했지만 **기존 baseHash·fingerprint·registry previous는 보존**했다. 기존부터 달랐던 현재 지문도 구분해 갱신했으며 과거 recipe/native 검증을 재수락하지 않는다.

| 단계 | 당시 검증 결과 |
| --- | --- |
| oxlint 정리 | SDK 전체·Core 빌드와 workspace/CLI/Metro/변환 도구 타입 검사 PASS. Material 전체·Core 23개 파일 exit 0, 추가 13개 파일 **83 PASS·1 SKIP**, 생성기 **5 PASS** |
| 포맷 최종 | `format:check`·`lint`·`build:sdk`·전체 타입 검사·`git diff --check` PASS. Material **271 PASS**, Core/layout **289 PASS**, 공급/VM/Metro **31 PASS·1 조건부 native-cache SKIP**, 생성기 **5 PASS** |
| 경계·소유권 | 945파일·7,616 runtime edge·design cycle 0. 디자인 소유권 56 moved·8 adopted·11 managed owner 범위 **PASS-scoped** |

모든 테스트 timeout은 **20분**이었다. 단계별 검사는 중복되므로 합산하지 않는다. 루트 `npm.cmd run lint`, `npm.cmd run format`, `npm.cmd run format:check`와 한/영 README·변환 도구 README에 사용법을 반영했다. 이 두 작업은 저장소 소스·로컬 SDK 출력 검사이며 **플랫폼 runner 공급/설치·AOT/앱 재실행·물리 입력/표시 성능 재검증은 수행하지 않았다.**

## 마지막으로 전달·확인한 Windows 제품

아래는 **2026-10-29 원문 §23**의 Static Hermes AOT / optimized / x64 Release 제품 기록이다. 10월 30일 소스 정리를 반영한 새 제품 지문이 아니다. 당시 소스·설치본 패키지 9개, 제품 1,782파일 inventory/runtime/locator, generated header·build acknowledgement와 portable source map 1,386모듈을 확인했다. 변경 Core 5개 모듈의 패키지 JS→저장소 JS→원본 TS 연결도 일치했다.

| 식별자 | SHA-256 |
| --- | --- |
| SDK 지문 | `0cd34baf964d3435c0434ef4124310c53e7b901ce346ce79ae260802e76b326b` |
| native inputs | `65a93f4652c6f653b9a8cfaf6c69192cc3bf9c7ab1a002d1050fb2807725926e` |
| 제품 manifest | `cbb64bd17312312e304c94de9db0411149fd51c990e35a078879260a5c60b6a8` |
| EXE | `7e96e08ab524b7f82edcc386f700c5f13a346c53ac374a0d969bb4eb873dabb8` |
| AOT DLL | `f92470f483e963b63a807584afc1fec94e4ad5b3773a2828f1d8ef8a6382c63f` |
| AOT 소스 | `cd741b383b252299780f39450d406b3ad975162deccc230623af9c382f70e040` |

## 남은 작업과 정리 경계

- **성능:** width layout/paint, height 추가 프레임 요청의 원인과 native 동기화 중첩, cold 섹션 생성/layout의 긴 프레임이 남았다. 후속 수정은 같은 AOT·재현 조건의 시간 분해와 사용자 피드백을 기준으로 한다.
- **화면·입력:** source frame→commit→desktop frame 연결, 큰 최대화/복원 timeout, 큰 제목 전환, 물리 DPI·IME, 다른 장치·장시간 트랙패드와 전체 scanout은 미검증이다. 자동 OS 휠·native surface update를 사용자 체감이나 표시 완료로 대체하지 않는다.
- **정리 이력:** 새 fixture·생성 runner·supply/AOT staging은 실행별 finally에서 정리했고 마지막 기록상 검증용 compiler/InputSurface·생성 runner는 0개였다. 제품은 `Release`, 공급 archive는 패키지별 현재 파일만 유지했다. 이는 당시 기록이며 현재 실행 중인 앱/PID의 확인이 아니다.
- **기존 삭제 차단:** `%TEMP%/nelyx-windows-input-surface-DkFyS3`, `%TEMP%/nelyx-windows-animation-zkq0ti`, `windows/x64/Release/.nelyx-sh-mfB4Na`는 과거 자동 승인 검토의 `blocked by policy` 기록을 유지했다. 마지막 staging의 잔여 7파일이 제품 inventory 1,782개에 포함된 사실도 남긴다. 이번 문서 보관에서 해당 경로의 삭제를 시도하지 않았다.

[10월 27일 선행 요약](../27/work-summary.md) · [W18 기반 개편](../25/work18-summary.md) · [Windows 입력·합성 계약](../../../../Nelyx/skia/packages/rn/native/windows/README.md) · [제품 사용 안내](../../../../README.ko.md)
