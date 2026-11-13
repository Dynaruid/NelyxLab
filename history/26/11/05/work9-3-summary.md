# Work9 3부 — 구현 순서·통합 검증·공급 요약

원문: 루트 `work9-3.md` · 작성: **2026-11-05 KST** · 갱신·종료: **2026-11-10 KST** · 보관: **2026-11-13 KST**

문서: **CLOSED / work10 이관** · Windows/Web: **PARTIAL**. 원문 §12–14의 W9-00~14·의존성·공급·기술/제품 수락 경계를 보존한다.

## 단계와 차수 전환

| 묶음 | 원래 책임·의존 관계 |
| --- | --- |
| W9-00 → 06-A | source/dist·공급·API 입력과 원래 동기 실행 모델을 먼저 판정 |
| W9-01 → 02-A/B | 최소 embedder·App SDK 단일 Windows host·Web 두 profile 수직 연결. 기본 예산/clock·초기 설치도 함께 확인 |
| W9-06-B·05 → 07 | 원래 Widget 수명과 필요한 graphics/text부터 layout·gesture/scroll·편집·semantics·목록으로 확장 |
| W9-08 | 원래 TS Material/Cupertino와 SDK의 theme·State·controller/callback·form/route/localization/서비스 연결 |
| W9-09-A/B·10-A/B·11 | 기본 수명/예산·clock 후 실제 재사용/pressure·frame 개선·필수 animated/외부 콘텐츠. 필수 콘텐츠에 재사용 최적화 전체 완료를 불필요하게 선행시키지 않음 |
| W9-12-A | Windows/Web generation reload·device/context loss·실패 교체·late callback·drain 통합 |
| W9-13 → 14 | 대상별 전체 API·설치/공급·host/복구의 기술 gate 후 물리·표시·성능·기본값 전환을 별도 수락 |
| 후속 W9-12-B·03·04 | Android RN/Linux RNL 2차, iOS RN/macOS RNM 3차의 실제 소스 이식·host·배포 및 대상별 W9-13/14 |

다음 차수의 착수 기준은 앞선 차수 **모든 대상의 W9-13 기술 완료**다. W9-14 미수락과 기술 gate를 섞지 않는다. 11월 7일 Android 선행 착수는 사용자 지정 예외이며 다른 플랫폼 완료를 뜻하지 않는다. 11월 8일의 App SDK 단일화·첫 RNW 이식은 [W9B-00-H 기록](../09/work9-b-summary.md#app-sdk-단일화와-rnw-실제-이식)으로 따로 보존한다.

## 당시 구현·검증과 잔여 작업

11월 7일 canonical asset/font/buffer/image/network·App bootstrap/실제 actor 종료, 동적 font recording, RawImage/RenderImage·ImageProvider/캐시·Core clock을 구현했다. 원래 Material 버튼·Checkbox/Radio 등 구간별 연결과 전체 디자인/API 완료는 구분한다. 상세 API/소유권은 [1부](work9-1-summary.md)·[2부](work9-2-summary.md)에 둔다.

- 공급: `175c55c6…`, ABI **2 / schema 2844160510**, manifest **349 files**, App service **12**·image/HTTP service **2**. 당시 두 Windows host의 PASS는 이후 App SDK 단일화의 근거로 재사용하지 않는다.
- 당시 검사: Core **419/419**, 통합 **53/53**, Source/수명/편집/캐시 **108/108**, 도구/API/supply **32/32**, geometry **2/2·7/7** PASS. 실제 C++/SDK 작업 수·픽셀·caller/Scene holder와 마지막 종료 예약 **0**을 확인했다.
- 실제 설치 TypeScript **7.0.2** strict 입력·CLI build/verify·Web 두 profile 실행도 확인했다. 원래 **4 packages / 834 subpaths**·hash **16개**를 유지했고 전체 API는 **inputValid=true / compatible=false**다. `loadBuffer` 추가 2건의 구조적 호환 승인은 남았다.
- 이미지 stream visibility/유한 반복·Canvas/추가 readback, OS font 알림·전체 text/선택·custom paint/layout/hit·동기 geometry·keyboard/IME/reader·디자인 전체·서비스/복구와 W9-06/07/08/13/14는 미완료였다.

## 검증·공급 운영과 판정

source identity·ABI/schema·runtime/compiler·Skia/CanvasKit·SDK·설치본·실행 bundle과 실제 C++ 작업을 함께 대조한다. 과거 PASS나 fallback 상수·첫 frame만으로 전체 API/제품을 승인하지 않는다. accepted·prepared·published·GPU 완료·display/scanout은 서로 다른 증거다.

챕터의 구현·실제 소비자 연결을 모은 뒤 통합 확인하고, 실패를 원인별로 수정해 영향 범위만 재검증한다. 테스트 timeout **20분**, 임시 설치/로그·archive·이전 dist/staging은 실행 종료 시 회수한다. 11월 7일 폐기한 독립 `test/audit/experiment` 명령은 과거 기록이지 현재 실행 지시가 아니다.

종료까지 `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리/display/scanout **notVerified**다. Windows/Web 전체 기술·제품 gate, Android **stale/notVerified**, Linux/Apple **DEFERRED**, 기본값 전환·마지막 소비자 이후 레거시 삭제를 [work10 잔여 의무](../11/work10-summary.md#work9-잔여-의무-이관)로 이월했다.

[work9 보관 목차](work9-summary.md) · [2부](work9-2-summary.md) · [4부](work9-4-summary.md) · [이력 목록](../../../README.md)
