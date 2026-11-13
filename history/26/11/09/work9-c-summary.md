# Work9-c — Range/editor·종료 수정·날짜 선택기·성능 잔여 요약

원문: 루트 `work9-c.md` · 작성: **2026-11-09 KST** · 갱신·종료: **2026-11-10 KST** · 보관: **2026-11-13 KST**

문서: **CLOSED / work10 이관** · 전체: **PARTIAL**. W9C-00의 부분 기능·검증을 보존하며 **W9C-01은 미착수**였다. 이후 미완료 의무는 [work10 대응표](../11/work10-summary.md#work9-잔여-의무-이관)로 이어진다.

## Range/editor와 종료 결함 수정

[work9-b](work9-b-summary.md)의 Source/dist 불일치·Curve 선언 실패를 새 Core build로 해소했다. Custom Range track/thumb/tick/overlay/indicator 등록·method identity·shared painter 정책·paragraph 수명을 연결하고 고정 divisions **127** 제한을 제거해 **200 divisions** Demo를 확인했다. 임의 callback/subclass 전체 호환은 아니다.

Curve **19종×9지점**의 Source/C++ 수치, 최대 **32 nodes/depth16**·잘못된 데이터, 기존 **56-byte** scroll 명령/curve tail과 duration **0~60000ms**, 명령 ID별 cancel·supersede·timeout·controller/hide/input/close를 확인했다. Web Chrome/Edge × 두 profile과 Windows 일반/독립 설치 CLI의 custom Range·curved editor·Focus·한글/emoji·resize·종료를 구간 PASS했다. 최초 Web busy(23)·반복 탐색 timeout은 당시 별도 실패로 보존했다.

Windows 자동 종료는 하나의 원인이 아니었다.

- **eventOverflow(30):** 매 ACK의 전체 execution JSON을 동기 stdout에 쓰다 App가 막히는 경로를 6초 출력 보류로 재현했다. Counter·명시 stats는 유지하고 상시 대량 출력을 제거했다.
- **Source mailbox/입력 starvation:** scene ACK/retirement마다 입력 checkpoint를 열고 geometry 조회 완료까지 유지했다. Queue 증설·입력 폐기로 해결하지 않았다.
- **0xC0000005:** editor/Focus 전환의 fault stack에서 `Interaction::sync`의 singular Prepared map iterator 역참조를 확보했다. 일치하는 Prepared의 shared owner·paragraph 조회와 UIA context 수명을 수정했다. ASAN 영향 회귀는 PASS지만 최초 무스택 실패까지 소급 확정하지 않는다.
- **별도 후속 실패:** 물리 입력에서 listSeek busy(23), transaction budget(19), 상단 복원/메뉴 지연을 추가 확인했다. 정상 end의 deferred 목적지 보존·viewport별 입력 중단·같은 stream update 병합·overflow 진단과 Range overlay의 retired Element 접근을 수정했다. 자동 메뉴/Range PASS는 물리 성능 수락이 아니다.

## 11월 9일 구조 수정과 증분 캡처

원문 §3.1.4–3.1.6의 과거 `problem.md` 절 참조는 당시 기록이며, 이후 다시 작성된 [problem.md](../../../../problem.md)의 동일 절 번호를 뜻하지 않는다.

- Core가 변경된 builder subtree의 continuation·부모/완료 형제·preparation identity를 조건부 보존하고, Source 중복 builder·동일 설정 인코딩·관측 검색을 줄였다.
- RenderObject local/descendant dirty·역방향 참조·정적 subtree 재사용과 입력 우선 전달을 구현했다. 결정적 캡처 검사 **501개 중 2개 재캡처/499개 재사용**를 확인했으나 모든 동적 노드/전체 diff 제거를 뜻하지 않는다.
- Web의 Content quota·heap 성장 전 admission·FontCollection 재사용·오래된 candidate/record 회수로 장시간 전환 메모리를 보강했다. App **320 MiB**, CanvasKit **128/256 MiB**, 총 **768 MiB** 한도를 늘리지 않았다. 이전 threaded 장시간 budget 실패는 별도 기록이다.
- Native/CanvasKit physical RRect와 ink clip을 보존하고 Windows stable shadow를 연결했다. GPU/CPU·DPR/elevation·retained replay 검사는 통과했지만 전체 시각/scanout 수락은 아니다.
- 비동기 bounded GPU slot·완료/lease, 이벤트 wake·작은 상태/입력 조회 우선 전달, Core/SDK 인덱스·불변 관측/paragraph 값 재사용을 단계적으로 보강했다.

## 11월 10일 입력·준비·날짜 선택기

불필요한 AppFrame paint/관측·full records/문단 재기록·동기 console/JS 실행 비용을 줄이고, timer wake·완료 mailbox·상태 조회를 보강했다. 관성 속도 이력·coverage 대기/재개·기본 cache 범위·이동 중 builder continuation·속도별 lookahead도 수정했다. **사용자 평가는 일부 감소 후에도 큰 끊김 잔존**이었으며 App **34~50ms** 등의 표본을 60fps 수락으로 바꾸지 않았다.

Flutter pin **`71e4717a…`**의 날짜/월/연도·입력 검증·Dialog/restoration·기본 지역화 **75개 선언**을 analyzer IR→TS emitter로 생성했다. 범위는 **Material 3 / US-English 단일 날짜 선택기**이며 Cupertino/범위 선택기·전체 카탈로그 완료가 아니다. 당시 fresh 재생성·Dart oracle·compiler 부정/identity 검사와 실제 Windows/Web 선택·입력/확인/취소를 통과했다.

첫 월의 0번 page→seek→재준비를 제거하고 Content viewport 폭으로 초기 page를 적용했다. 첫 게시 뒤 인접 월 준비·반복 월 이동/resize anchor·builder 일괄 응답·retained 자식 재사용을 보강했다. 빠른 왕복의 **contentUnavailable(31)→semantics 1028/1024 초과**는 offscreen KeepAlive의 State와 native geometry/semantics를 분리하고 stale window를 재요청하도록 수정했다. 예산을 다시 늘려 숨기지 않았다.

이후 과거 월 이동의 **`Native ink reference is not mounted`**는 메모리 초과가 아니라 App paint-reference 수명 결함이었다. Parked page의 자식 제외·live Material ink invalidation·generation 복원을 맞추고 과거 방향 Web 24회 및 live ink 회귀를 확인했다. Windows native spread/rest는 채택했지만 클래스 전환은 mixin 초기화 호환 실패로 철회했다.

## 검증의 한계와 종료·이월

각 공급의 native/Wasm·Core/SDK·Web 두 profile·Windows 일반 CLI·일부 설치/ASAN 흐름을 분리해 확인했다. 정상 종료의 예약/메모리 **0**·worker join은 자원 회수 근거이며 display/scanout·물리 입력 지연의 증거가 아니다. 초기 `52e4be1e…/schema70183166`부터 후반 `dea64e1f…/schema2570296319`까지의 PASS를 마지막 모든 소스/기능의 재검증으로 합치지 않는다.

종료 직전 사용자는 **종료 없이 이동하지만 새 월 준비가 여전히 너무 느림**을 확인했다. 새 월·빠른 다중 월 이동·전체 records/동적 구성·GC·Source/Content 왕복은 미해결이며 W9C-01로 자동 진행하지 않았다. `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리/display/scanout **notVerified**, Android **stale/notVerified**, Linux·iOS/macOS **DEFERRED**를 유지한다.

W9C-01~08의 Core/디자인·실제 OS 소스 이식·SDK/CLI·전체 앱·기술/제품 gate·기본값/레거시 제거와 날짜 선택기 생성 출처는 [work10](../11/work10-summary.md)에 이월했다. 당시 승인 거부된 임시 자료는 정리 미완료였으며 이후 상태는 [work11의 후속 정리 기록](../../../../work11.md#183-후속-요청에-따른-구형-출력일회성-검사-정리)과 구분한다.

[work9 보관 목차](../05/work9-summary.md) · [work9-b](work9-b-summary.md) · [이력 목록](../../../README.md)
