# 엔진 v2 공통 C++ 백엔드 설계·구축과 work9 이월 요약

원문: 루트 `work8.md` · 설계: **2026-11-04 KST** · 구현 갱신·종료: **2026-11-05 KST** · 보관: **2026-11-05 KST**

문서 상태: **CLOSED / SUPERSEDED** · 구현 상태: **PARTIAL / 전체 공개 API gate FAIL**. `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 IME/reader/trackpad·display/scanout `notVerified`를 보존한다. 이 보관은 문서 정리이며 제품 빌드·runtime·성능을 재검증하지 않았다.

## 문서 구성과 날짜

원문 5개를 아래의 날짜별 요약으로 보존하고 루트 원문은 삭제했다. 1·2·3부와 목차는 원문 설계일 11월 4일, 2a는 작성일 11월 5일에 배치했다. 11월 5일의 실행·종료를 작성일과 혼동하지 않는다. 10월의 같은 이름 문서와는 별도 작업이다.

| 원문 | 원래 범위 | 보존 문서 |
| --- | --- | --- |
| `work8.md` | 전체 목차·진행·종료와 이월 | 이 요약 |
| `work8-1.md` | §1–7 구조·owner·상태·입력 | [1부 요약](work8-1-summary.md) |
| `work8-2.md` | §8–14 layout/text·graphics·편집/플랫폼·API | [2부 요약](work8-2-summary.md) |
| `work8-2a.md` | API gate·실행 계측·복합 종료·archive/npm·Flutter 비교 | [2a 최종 구현·검토 요약](../05/work8-2a-summary.md) |
| `work8-3.md` | §15–19 단계·검증·공급·완료/전환 | [3부 요약](work8-3-summary.md) |

## 주목표와 채택한 구조

TypeScript Widget/Element/State·Key·의존성 모델과 SDK를 C++의 장기 상태 엔진에 연결하는 것이 목표였다. C++ core는 render node·layout/query·editing·gesture/scroll/motion·retained scene·scheduler를 소유하고, graphics/text provider는 native Skia와 Web의 공식 npm CanvasKit을 사용한다. Platform UI·App Runtime·Content·Compositor/Render의 권한을 구분한다.

Document 승인과 scene 준비/활성화·host publication·GPU 완료·실제 표시를 구별한다. 진행 중 준비와 최신 다음 수요를 분리해 연속 commit의 starvation을 막고, ACK/NACK·멱등 재시도·PreparationId·세대·snapshot/ledger·bounded queue와 close/drain을 설계·구간 구현했다.

Web은 Emscripten threaded와 non-shared single-worker를 별도 빌드한다. 두 profile은 수정하지 않은 동일 npm CanvasKit 공급을 사용하며 자체 engine과 CanvasKit의 heap/handle을 공유하지 않는다. COOP/COEP가 없으면 `auto → single-worker`로 기능이 동작해야 한다. Single-worker는 `contentIndependent=false`, App 독립·Content 협력 실행/점유 후 회복을 명시한다.

## 구현 경과와 증거의 우선순위

11월 4일 공통 core/C ABI·TS entry·Windows 자체 HWND host와 두 Web profile의 최소 scene·화면·입력·owner·resize/close를 연결했다. 이후 layout/intrinsic/dry query·Widget diff·native editing·TSF/UIA·DOM/ARIA·lazy list/control·그래픽/일반 runner·통합 예산을 추가했다.

11월 5일 17:33의 중간 중단에서는 코어 193개 이후 provider/SDK 변경이 통합 미검증이고 dist도 이전 공급이었다. 이후 재개와 2a 검증이 있으므로 이 PAUSED 구간을 최종 상태로 사용하지 않는다. 69·117·184·193·211·242개 등의 숫자는 각 구간 기록이며 누적 완료율이나 마지막 소스의 통과 수가 아니다.

최종 근거는 **2a의 마지막 구현 기록**이다. Core **214/214**, API gate 자체 회귀 **7/7**, lifecycle **3/3**, host **5/5**, 일반 runner **8/8**을 보존했다. 실제 Testbed ACK 명령 **1210 = C++ transactionWork 1210**을 대조했다. 전체 공개 API gate는 계속 **exit 1 / inputValid=false / compatible=false**다. 공급 hash·세부 검사·API 발생 항목 수·이전 실패는 [2a 요약](../05/work8-2a-summary.md#현재-구현-현황)에 둔다.

자동 입력·SwiftShader·첫 frame·정상 종료는 물리 precision trackpad/IME/reader, hardware FPS나 scanout 수락을 대신하지 않는다. [선행 work7](work7-summary.md)의 사용자 물리 FAIL 뒤 수정 공급 재확인 대기도 유지한다.

## work9로 이월한 작업

| 작업 축 | 종료 시 미완료 범위 |
| --- | --- |
| API/P1–P3 | 원래 Widget/Element/State/GlobalKey/context·parent data, 동기 controller/custom RenderObject 의미, 전체 layout/gesture/editing/rich text/paint·Material/Cupertino·SDK API |
| 플랫폼·제품 공급/P4 | Android/Apple/Linux host, generation reload·device/context 복구, 전체 package/API/platform 조합·독립 설치·자원 회수 |
| 엔진 보강 | Canvas/Paint·rich paragraph 표현력, preparation 간 Picture/paragraph/image 재사용, display 연동 clock, cache/damage·animated/texture/platform view·semantics·OS pressure |
| 물리·성능/P5 | 실제 일반 실행과 입력 source별 조작·display/scanout·지속 frame/resize·메모리 수락 |

당시 후속 [work9](../05/work9-summary.md)의 Windows **Windows App SDK**, Linux **GTK4**, macOS **AppKit** host 계획과 모바일 RN 소스 재사용·Web DOM/Worker 방침은 보관 요약으로 이관했다. 이후 실제 소스 이식 교정과 잔여 의무도 그 요약에서 연결한다. 이는 닫힌 work8의 새 구현 실적으로 소급하지 않는다.

[이력 목록](../../../README.md) · [후속 work9 기록](../05/work9-summary.md)
