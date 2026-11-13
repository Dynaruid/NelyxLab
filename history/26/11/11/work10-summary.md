# Work10 — 변경분 전달·데이터 공유 중심 엔진 v2 개편 요약

원문: 루트 `work10.md` · 작성·갱신 표기: **2026-11-11 KST** · 실행 기록: **11-10~12** · 후속/중간 마무리 갱신: **11-13** · 보관: **2026-11-13 KST**

원문 상태: **OPEN / Windows 후속 work10-a1**, 구현·제품 **PARTIAL**. 11월 13일 Windows 후속은 **PAUSED / PARTIAL**이며 다른 API·플랫폼 의무는 존속한다. 작성일 표기를 우선해 11월 11일에 배치하고, 11월 10일 첫 구현 기록과 파일 수정일을 별도로 구분한다. 이번 보관을 구현 완료나 새 제품 검증으로 해석하지 않는다.

## 목표와 소유권 계약

**JSI를 유지하고 TS의 변경 기록으로 기존 C++ retained scene을 갱신**한다. Widget/Element/State·Material/Cupertino 정책·controller/callback은 TS, 최종 layout/geometry/hit/gesture/편집·scene과 자원은 C++에 남긴다. 기존 Document/Scene/Frame·App/Content/Render를 발전시키며 새 렌더러를 병렬로 만들지 않는다.

전체 트리 해시·노드별 HostObject 호출·FFI 전면 교체·모든 플랫폼의 단일 공유 버퍼는 주 경로로 채택하지 않았다. 영속 generational binding·dirty journal·묶음 commit·불변 snapshot 구조 공유·관찰 version/delta·blob ID와 **플랫폼별 실제 buffer 소유권**을 채택했다. Timeout은 terminal이 아니며 살아 있는 reader/GPU holder의 credit을 먼저 회수하지 않는다.

개발 우선 대상은 **Windows App SDK / Web single-worker·threaded**다. Android 공통 wire 영향·공급 갱신과 실제 실행을 구분하며 Linux/Apple은 후속이다. 원래 날짜 선택기 생성 출처·200ms animation·coverage·ACK/publication fence를 유지한다.

## 챕터와 채택한 구현

| 챕터 | 구현·실제 소비자와 남은 한계 |
| --- | --- |
| W10-00 계측/기준선 | request→Source build/capture/scene→Content→게시와 방문·복사/transfer·clone/검증·queue/lease를 bounded 집계. cold/warm/evicted·물리/scanout·전체 인과 성능 수락은 미완료 |
| W10-01 TS 변경 기록 | retained capture/RecordPatch·registry·children/layout/paint/semantics/interaction/resource revision·역방향 참조와 등록 수명. ACK/NACK·진행 중 새 변경·park/Ink/자원 보호. 모든 동적 projection/중간 트리·전체 setter journal 제거는 아님 |
| W10-02 Core 구조 공유 | **64-slot page / 16-page directory**·불변 child block·Node clone-once·영향 부모/형제와 local/content 증분 검증. topology/graphics 등은 안전한 전체 validator를 계속 사용 |
| W10-03 관찰 delta | role별 base/next·order/tombstone/resync·불변 row/blob·old snapshot 보존, 실제 변경 journal·observer 등록 인덱스. accepted/active/published·metrics/device/font/세대 fence 유지 |
| W10-04 buffer 소유권 | Windows vector+ExternalLease→JSI MutableBuffer holder로 추가 응답 memcpy 제거·GC pressure advice, Web owned packet transfer/detach. 요청 보호·Wasm 입출력·공개 snapshot의 필수 복사는 유지 |
| W10-05 불변 데이터 | command **39/40/41** register/use/release와 observation blob **35/36/37**, 정확한 byte 충돌 비교·owner/generation·quota·provisional rollback. release 후 old reader의 정규화 값 보존 |
| W10-06 준비/Source | builder 예약/부모 우선·geometry 공유·live paint/동일 제약 metadata의 제한된 준비 재사용, 상태 조회 큐·provider frame/preparation delta·중복 decode/record 제거를 진행. 새 월 전체 지연은 미해결 |
| W10-07 통합/수락 | 같은 공급의 설치·Windows/Web 기능·오류/pressure/resize/종료를 범위별 확인. 전체 API·물리/표시·성능·제품 전환을 완료로 체크하지 않음 |

## 11월 10~11일 주요 개편과 검증

- 국소 paint의 무관한 subtree **8/96개**에서 record visit **2**, allocation visit **3**, command **1**, 무변경 transaction **0**을 확인했다. Core 무관한 node **64/2048개**에서도 같은 node 3회 수정의 clone/page/directory copy는 각각 **1**, child-block copy **0**이었다. 전체 동적 비용이 모두 변경량 비례라는 증명은 아니다.
- 일반 관찰의 작은 변경 후보는 **64/2048개에서 2개 이하**와 full oracle을 대조했다. 큰 응답/quota 거부 후 base·old reader 보존과 미발급 frame hold 회수를 고쳤다. Web 모달은 완료 promise의 lost wake와 ACK 전 semantic source lookup에 따른 입력 누락을 결정적 회귀로 수정했다.
- Browser 전용 projection·semantic index·동일 DOM 속성 쓰기 생략·새 노드 depth 재사용을 연결했다. renderer payload를 브라우저 입력/ARIA 관측과 분리했으며 App delta 사전을 섞지 않았다.
- 이미 답변한 LayoutBuilder의 stale frame callback을 취소하고 부모 우선으로 처리했다. 빈 Picture 생략은 두 Web profile의 갤러리/달력/월 이동/resize **각 4장면 PNG bytes 동일**로 대조했다. 기존 LayoutWork 내부의 exact identity geometry 공유와 제한된 live paint 활성화도 old reader·전체 oracle·fence/ledger로 검증했다.
- 작은 state/input 조회가 provider 큐를 기다리지 않도록 직접 Core 경로를 연결했다. Core lock·owner/schema·ACK 의미는 유지한다. Frame의 기존 slot:generation index를 input 좌표·이전 geometry 비교에 재사용했다.
- Web Render **takeFrame delta**와 Content **preparationScene delta**를 App 구독과 분리했다. frame/preparation candidate·이전 전달 base·취소/퇴거/resync·reader credit·DPR2 surface 교체를 검증하고, 실제 크기 기반 capacity와 원자적 working headroom admission을 적용했다. 고정 대형 pool이나 driver 메모리 무관측을 숨기지 않았다.
- 같은 공급의 진단 소표본에서 preparation 전송은 전체 **1.167~2.344MB**에서 delta **0.223~0.260MB**, decode/record도 줄었다. 하지만 월 ready는 약 **0.4~0.5초**로 남았고 single-worker의 일관된 전체 지연 개선은 입증하지 못했다. 다른 owner/중첩 시간을 합산하거나 소표본을 제품 p95로 만들지 않는다.

기능/설치·native/Wasm·Web extended·pressure/DPR2·precision/resize·Windows OS 입력과 정상 close는 **각 공급·기능 범위**의 PASS다. Android는 초반 x86_64 실제 설치/첫 frame·정상 drain 이후 후반 차수는 주로 두 ABI compile/hash까지였고 Windows 후속의 최신 Android 공급/실행은 미검증이다. 원래 **4 packages / 834 subpaths** 전체 호환과 같은 의미가 아니다.

## 철회·실패와 Windows 후속

- 광범위 PaintUpdate/geometry 우회, 별도 visible/prefetch 분리 큐, provider decode/hash cache·lazy row prototype은 일관된 전체 개선이 없거나 메모리/추가 transaction 비용으로 철회했다. 제거한 hook/fixture를 현재 제품 기능으로 열거하지 않는다.
- §22의 Source capture/게시 대기 생략 실험은 Windows에서 grid/header·인접 월 불일치를 관측해 **모두 철회**했다. 최종 capture/ACK/publication fence를 보존했다.
- 마지막 Web 재확인은 DPR1 두 profile PASS 뒤 **DPR2 threaded의 `Native scroll failed (27=stale)` FAIL**이었다. 뒤의 DPR2 single-worker·강화된 최종 왕복은 미실행이다. 초기 semantic/Navigation 입력 미전달 등 재현되지 않은 오류도 원인 해결로 승격하지 않는다.
- §23은 빈 paint clip subtree 생략·Snapshot 예외·path/layer/mask 예약·불필요한 paragraph paint·font/preparation 캐시 수명을 **소스 수정만 한 시점**이다. 당시 build/run 중단·dist 불일치를 보존하며 이 변경만으로 날짜 픽셀/성능 해결을 주장하지 않았다.
- 사용자 재빌드 후에도 약 **1초 내외 멈춤**이 남아 [Windows work10-a1](work10-a1-summary.md)로 이관했다. 이는 멈춤 지속시간 보고이며 매 1초 주기의 timer 원인이라는 뜻이 아니다.

11월 12일 후속은 Source payload/기본 명령·DateTime·자식 재사용, 취소된 page 준비 복구, PageView 논리/표시 위치·contact coverage, 원본 날짜 격자의 Source 왕복 제거로 이어졌다. 마지막 기록은 engine **`d900a3719162f865b9672ee7a2fd532a8e7790dc2514077965e5d29f90b321d9` / ABI 2 / schema 313408118**, App JS **`3f1a0dab…`**, HBC **`302c88e1…`**다. [최종 Windows 기록](work10-a1-summary.md#최종-공급과-windows-통합-검증)의 연속 12개월 offset 공백 **279ms**, 빠른 24개월 **403ms**·각 ≥500ms **0회**는 부분 진전이며 물리/표시 수락은 아니다.

## work9 잔여 의무 이관

원문 §8의 실행 backlog를 보존한다. 성능 개편 한 챕터의 선행 조건으로 전체 플랫폼 완료를 요구하지 않되, 성능 부분 PASS로 아래 의무를 완료 처리하지 않는다.

| ID | 미완료 범위·완료 기준 |
| --- | --- |
| **W10-R01 Core·공개 실행 계약** | 모듈 소유 설정/invalidation/parent data·동기 constraints/geometry·custom layout/paint/hit/delegate·PlatformView/rasterizer·scroll/sliver/pan-zoom·editor physics/behavior·TapRegion 동기 재진입, 마지막 TS 실행 소비자/중앙 분기 정리 |
| **W10-R02 디자인·접근성·입력** | 원래 theme/painter·InkSparkle/shader·custom shape/border·controls/form/route/localization/assets·전체 catalog, controlled callback·임의 semantics key/delegate/병합/역할/action·focus/range·OS feature ingress·UIA/reader·국제 key/dead key/IME. 날짜 선택기 생성 출처 보존 |
| **W10-R03 OS 소스·SDK·수명** | RNW 입력/capture/focus/IME/UIA/환경·서비스 실제 수정 이식/소비자 교체, font/image/asset/network·VM 언어 의미·session/view/visibility/loss/reload/close·미확정 ACK/GPU holder, 공개 SDK AppDefinition/React/Renderer 주입 계약 |
| **W10-R04 CLI·설정·공급** | nelyx.app/1·target descriptor·config/template 통합, 구 VM/renderer/config 명시 거부, ambient 분리·독립 설치 create/doctor/build/run/dev/pack·Metro/compiler/asset helper·출처/notice |
| **W10-R05 전체 앱 소비자** | Testbed/Demo 전체 catalog·상세/drawer·navigation/form/modal·theme/font/image, data Testbed/list/graphics·축소 /v2 디자인/구 runner 실제 이관, Android sample 잔여 |
| **W10-R06 전체 기술 gate** | 원래 **4 packages / 834 subpaths**·서명 분모를 유지한 API 대응, 설치 strict 선언/graph/native run·복구/종료·Windows/Web 두 profile 전체 관련 흐름, 명시 계약 변경/미지원 판정 |
| **W10-R07 제품 전환·삭제** | 대상별 기술/API·설치/복구·물리/표시/성능 수락 뒤 일반 CLI/sample/template 기본값 전환. 중복 Widget/State·축소 /v2·구 TS/RN renderer/SDK/backend/runner·export/dependency는 마지막 소비자 이후 삭제 |
| **W10-R08 후속 플랫폼·전역 종료** | Android RN·Linux RNL·iOS RN·macOS RNM 실제 소스 이식·host/input/접근성/배포, Android 두 ABI 최신 공급·설치/run, 대상별 기술/제품 gate·지원 범위, legacy/생성 소유권/license/README/help 정합성 |

Windows는 App SDK 하나, Web은 두 profile, 후속 차수는 Android/Linux→iOS/macOS다. 플랫폼 API는 **원본 고정→실제 수정 이식→소비자 교체→일반 앱 동작**으로 추적하며 사례 참고나 자체 구현만으로 완료하지 않는다. Range/editor의 이미 완료된 구간을 미착수로 되돌리지 않고 [work9 보관 목차](../05/work9-summary.md)의 당시 증거·미완료를 함께 유지한다.

## 성능·검증 한계와 현재 후속

새 월 **p95 100ms**는 초기 목표이지 달성값이 아니다. Accepted/activated/published·GPU 완료·display/scanout, 게시 gap·실제 offset 진행 gap·최종 월 도달을 구분한다. `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리/display/scanout **notVerified**를 유지한다. 전체 lint의 당시 생성 날짜 파일 미사용 매개변수 오류도 관련 변경 검사 PASS와 구분했다.

11월 13일 Source/직접 투영·helper·Hermes 등의 후속과 현재 공급은 [work11](../../../../work11.md)에 있다. **PAUSED / PARTIAL**이며 자동 재개하지 않는다. 당시 삭제 차단/이후 별도 정리 이력과 이번 요청의 원문 보관은 구분한다. 이번에는 문서·날짜·링크·삭제 범위만 확인하며 제품 빌드/runtime/API/성능을 재검증하지 않았다.

[Windows work10-a1](work10-a1-summary.md) · [work9 종료 기록](../09/work9-c-summary.md) · [이력 목록](../../../README.md)
