# W18 — TypeScript UI Runtime·공통 Engine·Host 기반 개편 요약

원문: `work18.md` · 작성일: 2026-10-25 KST · 마지막 구현/검증 기록: 2026-10-26 KST · 아카이브: 2026-10-27 KST

원문 마지막 상태: **실행 IN_PROGRESS / 구현 PARTIAL / 제품 PARTIAL**. `performanceAccepted=false`, `physicalInputAccepted=notVerified`, `displayed=unobserved`. 이 문서는 당시 결과와 잔여를 보존한 이력이며 새 실행 계획이나 완료 판정이 아니다.

## 방향과 소유권

W17을 종료하고 Nelyx의 상태·트리·layout·text·scene·자원을 보유하고 갱신하는 기반을 개편했다. TypeScript 앱/Widget·State와 자체 layout·Hermes 중심 방향을 유지하면서 내부 클래스·자료구조·native ABI·공급은 교체할 수 있도록 했다. layout 전체의 C++ 이전은 확정하지 않았다.

| owner | 책임 |
| --- | --- |
| TS UI Runtime/Core | Widget·State·Element identity, dependency/reconciliation, RenderObject layout/hit/gesture·논리 semantics |
| Core ui/hosting 계약 | versioned frame/text/resource/geometry, owner/generation/lease의 단일 정의 |
| 공통 native Engine/Skia | font/image/path/paragraph/picture·recording·GPU 제출/retirement |
| SDK Runtime/Host | VM·event loop·clock·surface·입력/IME/UIA·OS 서비스·AppSession 조립 |
| 앱/디자인·tooling | 공개 API 소비·theme/control과 target별 pin/ABI/package/설치 closure |

공유 mutable 기준·중복 snapshot/projection·전역 탐색·반복 freeze/replay/encode를 줄인다. 사용자 getter/Proxy/iterator/subclass·State/Key·custom layout의 관찰 순서·오류/rollback과 외부 snapshot 불변성은 유지한다.

## 메모리 정책

cache/pool/arena·retained scene·native 자료 보유는 목적·owner·실제 이득·수명·축소/폐기 방법을 설명하면 허용한다. process private·VM live/capacity·native/Skia/UIA/Vulkan과 같은 완료 작업량의 GC/frame 지연을 구분한다.

W17의 private1GiB/Vulkan512MiB·마지막3회 plateau/순증가·count0 한계는 **필수 기준에서 퇴역**했고4MiB 대체 한계나 강제30% 할당 감소도 두지 않았다. 종료 owner의 lease/callback 미반환·설명되지 않는 반복 누적·stale 접근·OOM/압박·종료 실패는 계속 검증한다. 과거 관찰만으로 누수 없음이나 driver residency를 수락하지 않는다.

## 진행 상태

| 단계 | 원문 마지막 판정과 구현 |
| --- | --- |
| W18-00 | **COMPLETE, inventory/비교 기반 범위**. 현재 공급·두 모드 실행·기존 실패 구분 |
| W18-01 | **PARTIAL**. 공통 계약·scene/text ABI·최종 지원/퇴역 설계 잔여 |
| W18-02 | **SELECTED/PASS-scoped**. 대표 cold/revisit paired trial 비용 목표·retained guard·선정 자원 수명 통과. 전체 fast/제품 수락과 별도 |
| W18-03 | **IN_PROGRESS/PARTIAL**. dependency/dirty owner·Element/focus·GlobalKey 실패 복구·nominal class/factory/tree/inline-text owner 이전 |
| W18-04 | **IN_PROGRESS/PARTIAL**. layout admission/body 실패 복구·detached batch 거부. 전체 geometry/Sliver 이전 잔여 |
| W18-05 | **IN_PROGRESS/PARTIAL**. captured font catalog·RichText/WidgetSpan·source TextPainter·편집 metric/font 통합 |
| W18-06/08 | **PARTIAL**. 공통 native Skia·scene encoder/packet·FrameRecording·SDK asset capture·VM/Host ABI와 close/admission 경계 추출 |
| W18-07 | **IN_PROGRESS/PARTIAL**. CPU geometry/semantics publication·failed/closing View 입력/query/action fence·완료 receipt |
| W18-09/10 | **IN_PROGRESS/PARTIAL**. 실제 앱/API 이전·현재 제품 공급/플랫폼 회귀. 최신 UIA·ZIP·전체 catalog/확장점 잔여 |
| W18-11/12 | **NOT_STARTED**. 최종 성능/메모리/물리 수락·기본 전환/퇴역 |

Windows 기본값은 **RNW / Hermes optimized**로 유지했다. 직접 host 기본 전환은 최종 gate 뒤의 일이다. architecture/engine/memory/platform은 **notAccepted**, performance는false다.

## 구현과 선정 검증

- Runtime의 intrusive dirty scheduling·dependency scope와 child/render owner, GlobalKey rollback·nominal 선언/enum factory·tree/RichText/WidgetSpan의 실제 소비를 보강했다.
- `@nelyx/skia-native`로 renderer/text/resource/JSI 공통 구현을 추출하고 canonical C++와 RN adapter를 분리했다. 직접 host는 RN package·Node-API JSI adapter를 resolve하지 않는 경로로 검증했다.
- Core FrameRecording·native Picture/raster의 단일 packet·resource binding/capture와 geometry publication 경계를 연결했다. capture/packet 거부 시 이전 scene·lease를 유지한다.
- 동일 ViewRuntime 상태가 Root input/query/semantics action·EditableText·Web/native binding을 통제한다. 종료/실패 시 새 입력은 거부하되 이미 보낸 편집 교체/조합 취소 receipt는 완료할 수 있게 했다.
- SDK direct/RN close는 native drain을 기다리기 전에 View admission을 닫고 재진입 전에 같은 close Promise를 게시한다. submit 중 close·오류·late callback·자원 보존 회귀를 연결했다.
- RenderRichParagraph·RenderEditable·TextPainter를 source InlineSpan/ParagraphContext 단일 경로로 이전했다. 중복 transport painter·raw 입력/JSON key·별도 geometry 저장을 제거하고 같은 문단에서 paint/hit/caret/query를 얻는다.
- strut-only 갱신에서 metric24px가40px를 반영하지 않던 실패와 font 변경26→29px 미반영을 재현·수정했다. State-owned metric painter와 View의 font notifier를 통해 교체/close·복수 View listener/문단 회수를 확인했다.
- 최종 source 묶음 **114 modules/882개**,10 workspace types와 graph944 files/7,703 edges/**7 runtime SCC 잔여**·design0/errors0가 통과했다. 겹치는 이전 묶음 수는 합산하지 않는다.

paint geometry prefix cache·render transaction admission·semantics annotation owner 후보 등은 원문에서 **REJECTED/REMOVED**로 구분했다. 이전 후보·실패·계측의 수치를 최신 제품 성능으로 합치지 않는다.

## 마지막 공급과 실제 제품 확인

원문 §8.59의 Core archive `58789365091132b4c3218132d754d7cee4d8f79efbb0f80ed8cae18cad3c76a8`를 Windows/Web/Android에 공급했다. Core3,110/SDK560/CLI66/Metro32개 src/dist와 source-map guard를 대조했다. 이후 Web 전용 CLI/Metro와 Windows 전용 native 공급은 아래처럼 추가 갱신됐다.

| 범위 | 마지막 기록의 결과·한계 |
| --- | --- |
| Windows 직접 host 두 모드 | 최신 §8.62 bytecode153/Static156 files. FIRST_FRAME·title/HWND·Responding·loaded79/80·noRN/noNodeAPIJSI·협력적 exit0/forced=false 확인. Static37,186 native functions는 compile 분류이며 app.hbc 없음 |
| 외부 focus/range UIA | 마지막 입력 포함 검증은 **§8.57의 이전 Core 공급 4회**. §8.59 text/font와 §8.62 native 공급의 새 UIA 수락으로 승계하지 않음 |
| Web | §8.59 Chrome 편집/catalog4개 PASS. §8.61에서 개발/정적 HTML·surface 높이를 부모100%/flex로 바꾸고 DPR1/1.25·3 viewport의12조건에서 바깥 scroll0·canvas pointer/wheel 확인 |
| Android | §8.59의 기존 APK `79ce6349c49654dc88ef1856e3824932b35518cabf62ec56c66db979c911ff45` 유지. §8.63 Temurin21/x86_64 Release build·연결 emulator-5554 시작/RESUMED·한국어/아이콘 화면·fatal0 확인. 물리 기기·IME·정상 drain 수락은 별도 |
| RNW | §8.59 Release build·응답 창·수동작 없는 UIA 버튼 조회·exit0 PASS. 과거 AV/VM PC 원인의 해결 증거는 아님 |
| ZIP | 이전 공급 PASS와 구별해 **최신 공급 round-trip notVerified** 유지 |

Android 빌드의 기본 GraalVM jlink 실패는 빌드 자식 프로세스에 Temurin21 `JAVA_HOME/Path`를 지정해 해결하고 README를 보완했다. 시스템 Java 설정·제품 코드는 바꾸지 않았다. 당시 앱은 사용자 확인용으로 실행 상태에 두었으며 이번 아카이브에서는 프로세스 상태를 새로 확인하거나 종료하지 않았다.

## 마지막 Windows 그림자 수정

All components 카드가 소수점 스크롤 위치에서 깜빡이는 문제를 실제 Vulkan으로 재현했다. 두 열용 임시 layer 수정은 한 열에서 실패해 후속 §8.62로 대체했다.

최종 Graphite 경로는 평평한 Z·방향성·affine 조건에서 device CTM 이동을 빼고 spot mesh를 만든 뒤 원래 이동으로 배치한다. 미지원/perspective·생성 실패는 기존 Skia 경로를 사용한다. ambient/tonal·DPR/elevation·occluder·부모 matrix/clip·Picture 수명은 유지하고 임시 layer/filter는 제거했다.

두 폭·DPR·직접/중첩 Picture 등 실제 GPU 회귀28조건과 관련14개가 통과했다. 앱 네 가지 폭의30개 위치 readback도 확인했지만 물리 scanout·CPU/GPU 성능·메모리 증감은 수락하지 않았다. 최신 Windows native/RN archive는 `ab6568d2…` / `8bb56e23…`, host EXE는 `7dce42a6…`, Static DLL은 `605be444…`다. 다른 플랫폼의 새 native 변경 실행은 추가 수락하지 않았다.

## 남은 작업과 다시 확인할 경계

1. `FrameworkRoot.frameSubmitted()`의 scheduler first-frame marker와 ViewRuntime의 실제 accepted token을 대조해 text/layout/query의 논리 geometry와 frame/surface 연관을 명시한다. GPU busy/zero-size에서 허용하는 기존 강제 논리 geometry 계약은 유지한다.
2. retained scene·남은7 runtime SCC·공통 text/geometry ABI·SDK async startup/close·전체 catalog/custom 확장점과 마지막 소비자의 중복 경로를 마무리한다.
3. 최신 제품의 외부 입력 UIA·ZIP, 변경 영향을 받는 native/Web/Android 공급과 지원 중인 V8/JSC·RNW 경로를 실제 identity별로 확인한다.
4. RNW AV·과거 종료/VM PC 문제와 자원 owner·압박/회수·late callback을 해결하거나 지원/퇴역 결정을 소비자 이전까지 명시한다. 단순 기본값 변경으로 실패를 퇴역 처리하지 않는다.
5. 동일 부하의 두 Hermes 모드·기본/최대화·cold/revisit/retained/fast/resize를 비교하고 실제 표시·precision/IME/reader를 확인한 뒤 최종 전환을 판단한다.

R3는 실제 refresh 예산 B=1000/Hz에서 CPU p95≤0.75B/p99≤B/max<50ms, oldest input→surface p95≤2B/max<50ms다. R4의 실제 표시·물리 입력, R5의 owner/메모리/안정성, R6 공급·R7 플랫폼을 포함한 **R0~R7 전부는 아직 미수락**이다. 자동화·CPU·GPU readback·응답 창을 물리 표시 수락으로 확대하지 않는다.

당시 최신 ZIP 실행, 검증 EXE/obj와 실패 Android package 빈 폴더 삭제는 자동 승인 검토가 실행 전에 거부해 미수행으로 남겼다. 삭제 완료나 ZIP PASS로 바꾸지 않으며 이번 작업에서 재시도하지 않았다. 삭제된 checkpoint/receipt·옛 cleanup script 복구도 필요하지 않다.

[전체 이력](../../../README.md) · [W17](work17-summary.md) · [현재 사용 안내](../../../../README.ko.md)
