# Work9 1부 — 범위·Windows 호스트·공통 경계 요약

원문: 루트 `work9-1.md` · 작성: **2026-11-05 KST** · 갱신·종료: **2026-11-10 KST** · 보관: **2026-11-13 KST**

문서: **CLOSED / work10 이관** · 구현: **PARTIAL**. 원문 §1–4·§7의 범위·work8 기준선·Windows App SDK/RNW·공통 embedder 계약을 보존한다.

## 범위와 소유권

- 1차는 Windows App SDK + C++/WinRT·Graphite/Vulkan과 Web single-worker/threaded다. Android/Linux 2차, iOS/macOS 3차의 준비를 1차 선행 조건으로 요구하지 않는다. Android는 11월 7일 사용자 지정으로 선행 부분 착수했다.
- Material/Cupertino는 **원래 TypeScript Widget/State·theme·컴포넌트 정책·callback**을 실행한다. Framework는 canonical identity·설정·명령을 연결하고, C++는 최종 layout/편집/gesture·scene·렌더링을 수행한다. 디자인 패키지에 C++ Widget 사본이나 native binary를 넣지 않는다.
- UI/App/Content/Render owner, versioned wire·mirror/ACK·세대·자원 ledger·늦은 callback 차단과 비동기 close/drain을 유지한다. UI/Content가 App callback의 동기 응답을 기다리는 우회는 금지한다.

## Windows host와 실제 소스 이식

11월 8일 교정은 **App SDK 단일 제품 host**와 **RNW 실제 소스 수정 이식**이다. 독립 `windows-hwnd` executable/profile·선택/fallback은 제거하되 App SDK의 HWND interop와 공통 Core/provider는 유지한다.

RNW의 입력/IME·focus/capture·UIA·clipboard·설정/lifecycle 중 필요한 구현을 선별하고 ReactContext/tag/Promise를 owned view·DispatcherQueue·값/handle·Core port로 치환한다. 원본 revision/hash·수정·license·기존 소비자 교체·실제 앱 동작을 함께 확인한다. Android/iOS RN·macOS RNM·Linux RNL에도 같은 원칙을 적용한다. [실제 단일화와 첫 이식 근거](../09/work9-b-summary.md#app-sdk-단일화와-rnw-실제-이식)를 전체 OS API 완료로 확대하지 않는다.

## 기준선과 11월 7일 당시 구현

Work8의 마지막 Core **214/214**, API gate **inputValid=false / compatible=false**, 기존 HWND·Web 구간 구현을 출발점으로 삼았다. 원래 공개 표면 **4 packages / 834 subpaths**를 고정하고 미지원 항목을 빼서 분모를 줄이지 않는다.

11월 7일 공급 `175c55c6…`, ABI **2 / schema 2844160510**, manifest **349 files**에서 다음을 연결했다. 이는 이후 App SDK 단일화나 마지막 공급의 결과가 아니다.

- 두 SDK App 모델의 canonical root/PlatformAssetBundle·DefaultAssetBundle·NetworkAssetBundle, 읽기 전 credit·크기/hash 검사·취소·HTTP callback terminal.
- ImmutableBuffer→ImageDescriptor/Codec→Image의 독립 수명, 큰 이미지의 bounded chunk 전송·Scene backing, RawImage/RenderImage·ImageProvider/캐시와 Core 이미지 시계.
- Source FontLoader·동적 font cohort와 이전 recording 보존, App bootstrap 취소·실패·늦은 Wasm 초기화 차단, DOM ambient가 없는 Native strict 선언.
- Native asset **7읽기/52 bytes = SDK**, RawImage의 두 Web profile 각 **574명령 = SDK**, 실제 픽셀/이전 reader 보존과 정상 actor 종료 뒤 예약 **0**을 확인했다. Caller ByteData credit은 논리적 close가 아니라 실제 realm 종료까지 유지한다.
- 당시 Core **419/419**, 통합 **53/53**, Source/수명 등 **108/108**, 도구/API/supply **32/32** PASS. 전체 API는 **inputValid=true / compatible=false**였고 `loadBuffer` 추가 2건의 구조적 타입 승인은 남았다.

CanvasKit **128/256 MiB**, App **320 MiB**, ledger **768 MiB / GPU 128 MiB**는 소유 예약 정책이며 RSS/driver VRAM hard cap이 아니다. 이후 공급·기능 상태는 [work9-b](../09/work9-b-summary.md)와 [work9-c](../09/work9-c-summary.md)로 구분한다.

## 미완료·이월

동기 geometry/custom hook·원래 전체 API/디자인, OS font 알림·전체 image/Canvas·stream 복구, RNW 전체 소스 이식·reload/loss·전체 설치 행렬과 W9-13/14는 남았다. Native UIA 오류·물리 입력·display/scanout은 당시 **notVerified**이며 `performanceAccepted=false`, `resizePerformanceAccepted=false`다. 후속 의무는 [work10 대응표](../11/work10-summary.md#work9-잔여-의무-이관)에 유지한다.

[work9 보관 목차](work9-summary.md) · [2부](work9-2-summary.md) · [이력 목록](../../../README.md)
