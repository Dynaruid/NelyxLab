# Work9 2부 — 공개 API·렌더링·입력·Web 요약

원문: 루트 `work9-2.md` · 작성: **2026-11-05 KST** · 갱신·종료: **2026-11-10 KST** · 보관: **2026-11-13 KST**

문서: **CLOSED / work10 이관** · 전체 호환: **PARTIAL / compatible=false**. 원문 §8–10·§11의 공통/Web 계약을 보존한다. Android/iOS와 Linux/macOS의 실제 host 구현은 [4부](work9-4-summary.md)·[5부](work9-5-summary.md)로 구분한다.

## 공개 API 호환과 소유권

- 기준은 **원래 import·생성자·동작**, Widget/Element/State/BuildContext·Inherited/GlobalKey·parent data·수명/재진입과 동기 controller/custom RenderObject 의미다. 비동기 snapshot·이름 alias·AppDrivenBoundary를 원래 동기 계약의 대체 완료로 세지 않는다.
- 원래 **4 packages / 834 subpaths**·서명 hash를 보존한다. 실제 설치 consumer의 export condition·compiler·module resolution·lib/types로 입력을 구성하고 `inputValid=true`와 `compatible=true`를 분리한다. 미이식 API나 환경 오류를 이유로 분모를 줄이지 않는다.
- W9-00 직후 **W9-06-A 실행 모델 판정**을 수행한다. 원래 호출·즉시 반환/읽기·listener 순서·실행 owner·ACK 전후/거부 값을 비교해 보존 가능/명시 경계 필요/미해결을 구분한 뒤 W9-06-B 이식을 넓힌다.
- Material/Cupertino의 원래 TS State·theme/default·form·route·controller/callback은 유지한다. C++는 전달된 설정으로 공통 layout·text·gesture·paint를 수행하며 디자인 Widget 사본이나 adapter 전용 상태 기계를 만들지 않는다.

## 렌더링·입력의 계획상 의무

| 축 | 보존한 구현·검증 의무 |
| --- | --- |
| Graphics/text | Canvas/Paint·shader/filter/blend·rich paragraph·font/locale·placeholder·caret/selection·UTF-16/RTL을 provider별 실제 pixel/geometry·오류 회수로 대조 |
| 재사용·예산 | Picture/paragraph/image의 revision별 재사용·취소/retire, pressure·damage·cache·GPU/외부 consumer hold를 같은 ledger와 수명에 연결 |
| Frame clock | 단일 frame 수요/credit·display/rAF timing·input wake·idle/숨김 복귀. App Ticker와 독립 compositor 진행을 구분하며 callback 수나 present 완료를 FPS/scanout으로 바꾸지 않음 |
| Input/editing | gesture/scroll·capture·focus/IME·semantics·lazy list·원래 controller 즉시 읽기·거부/취소/재진입. OS mirror와 게시 geometry·focus/edit revision을 혼합하지 않음 |
| 콘텐츠·복구 | animated codec·texture/platform view의 fence·입력/접근성·재등록, generation reload·device/context loss·late callback·close/drain |

Native 플랫폼 API는 11월 8일 교정에 따라 RNW/RN/RNM/RNL의 **실제 수정 소스**를 소비해야 한다. 기존 자체 구현이나 사례 참고만으로 완료하지 않는다. 원본·수정·dependency·license·소비자 대응과 OS 실행이 gate다.

Web은 DOM/Worker·owned CanvasKit의 **single-worker/threaded 두 profile**을 유지한다. Non-shared 환경의 기능 경로와 `contentIndependent=false`, worker/heap·transfer·새 canvas/context 재생성·reload/close를 profile별로 확인한다. 다른 heap/handle을 임의 공유하거나 Main을 Content의 동기 실행자로 만들지 않는다.

## 11월 7일 당시 부분 구현·검증

AssetBundle·NetworkAssetBundle/WinHTTP·ImmutableBuffer·FontLoader/cohort·ImageDescriptor/Codec·큰 encoded 이미지·RawImage/RenderImage·ImageProvider/캐시·Core clock을 canonical API와 공통 App 서비스에 연결했다. Caller bytes·Scene·recording·pending IO의 holder를 분리하고 마지막 실제 reader/realm 종료까지 credit을 유지했다.

당시 source `175c55c6…` / ABI **2 / schema 2844160510**, App service **12**, image/HTTP service **2**에서 Core **419/419**, 통합 **53/53**, Source/수명/편집/캐시 **108/108**, 도구/API/supply **32/32** PASS다. TypeScript **7.0.2**의 실제 설치 선언과 Web 두 profile 실행·픽셀/정상 종료도 확인했지만 전체 API는 **inputValid=true / compatible=false**다. `loadBuffer` 추가 두 건의 `structuralCompatibility=notApproved`를 기능 PASS로 승인하지 않았다.

이미지 stream visibility/복구·Canvas/추가 형식·OS font 알림·전체 text/디자인/keyboard/IME/reader·custom hook·동기 geometry는 남았다. 이후의 [work9-b](../09/work9-b-summary.md)·[work9-c](../09/work9-c-summary.md) 부분 개선과 이 시점의 수치를 혼합하지 않는다. `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리/display/scanout **notVerified**와 [work10 잔여 의무](../11/work10-summary.md#work9-잔여-의무-이관)를 유지한다.

[work9 보관 목차](work9-summary.md) · [1부](work9-1-summary.md) · [3부](work9-3-summary.md) · [이력 목록](../../../README.md)
