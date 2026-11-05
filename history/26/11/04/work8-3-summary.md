# 엔진 v2 3부 — 구현 단계·검증·완료 기준 요약

원문: 루트 `work8-3.md` · 설계: **2026-11-04 KST** · 구현 갱신·종료: **2026-11-05 KST** · 보관: **2026-11-05 KST**

문서: **CLOSED / SUPERSEDED** · 전체 W8: **PARTIAL / API 호환 FAIL**. §15–19의 단계·검증·공급·제품 전환 기준을 보존한다. 기준의 존재는 통과 증거가 아니며 이번 보관에서 빌드·runtime·물리 입력·성능을 검사하지 않았다.

## 16. 구현 순서와 단계별 완료 조건

| 원래 단계 | 작업과 당시 미완료 경계 |
| --- | --- |
| W8-00 | 범위·모듈·소유권·ABI/공급·API 의미/이식표 고정. Canonical schema·공급을 구현했으나 전체 API 의미/Android cohort는 PARTIAL |
| W8-01 | Common core/C ABI·transaction·lease/ledger·TS entry와 Native/두 Wasm 계약. 기능 구간 통과, 전체 gate PARTIAL |
| W8-02 | Windows·두 Web의 최소 box/text/image/clip·입력/surface/close. Android 최소 port는 미완료 |
| W8-03 | Retained scene·scheduler·credit·input/scroll/motion·게시 snapshot/coverage. 실제 owner/지연·bounded 진행 구간 확인, 전체 gesture/motion은 미완료 |
| W8-04 | Render node·layout/paragraph·invalidation·activation. 표준 layout/query 구간 구현, 전체 API/text/graphics 의미는 미완료 |
| W8-05 | Widget/Element·ACK diff·Key/State/reparent·lazy coverage/anchor. 구간 구현, 원래 lifecycle/resolver·모든 list 계약은 미완료 |
| W8-06 | Hit/focus/editing/semantics·TSF/UIA·DOM carrier/action. 구간 구현, 전체 bidi/IME/reader와 모바일은 미완료 |
| W8-07 | Control·motion·overlay/navigation·Material/Cupertino. 명시 v2 범위 구현, 전체 원래 API는 미완료 |
| W8-08 | 두 Web 통합·Android 최소 port·graphics 복구. Web 구간 검증, Android·동일 session 복구·전체 기능표는 미완료 |
| W8-09 | Testbed C++ 작업·요청 집계·정합성·수명. 마지막 증거는 [2a](../05/work8-2a-summary.md#이번-검증), 전체 필수 기능/API gate는 미완료 |
| W8-10 | SDK/CLI/template·현재 package·설치 소비·README. Windows/Web 구간 공급, 남은 host/reload·전체 소비 조합은 미완료 |

작은 수직 scene으로 core→TS→host→provider→입력/수명을 일찍 검증한 뒤 전체 기능으로 확장하는 순서였다. 실제 App/Content 50/100/200 ms 지연·연속 input/commit·renderer busy/credit 복구를 필수 기능 검사로 두며, 물리 trackpad나 FPS를 엔진 착수의 선행 조건으로 두지 않았다.

## 16.4 Web 비격리 배포와 profile 검증표

다음은 원래 필수 검증 조건을 요약한 것이다. [2a 마지막 기록](../05/work8-2a-summary.md#이번-검증)의 실행 범위 밖 항목까지 이미 통과한 것으로 읽지 않는다.

| 배포/요청·실패 경계 | 필수 결과 |
| --- | --- |
| 실제 page/worker isolation·shared/worker capability 충족 + auto | Threaded 선택·별도 owner/provider READY·C++ 작업·scene·입력·drain |
| COOP/COEP 없음, 한쪽만 있음 또는 실제 isolation=false + auto | **Non-shared single-worker 자동 선택 후 같은 필수 기능 실행**. Header 존재만으로 threaded를 고르지 않음 |
| 격리 환경의 forced single-worker | 실제 non-shared memory·하나의 engine worker에서 협력 진행/점유 후 회복 |
| 비격리 forced threaded 또는 contentIndependent 필수 | 명확한 capability 시작 실패, 부분 view/worker/pending 누수 없음 |
| Worker/CSP·OffscreenCanvas·worker WebGL2 부족 | 최소 환경 부족으로 실패. 격리 부재만으로 실패하는 경우와 구별 |
| 파일/HTTP/hash/ABI/cohort·초기화/OOM 오류 | 해당 공급/시작 오류로 실패. 다른 profile/TS renderer로 숨기지 않음 |
| Pthread pool/owner/provider 지연·실패 | 실제 Content/Render realm에서 비동기 READY, 동기 join 교착·UI draw proxy·시작 전 admission 없음 |
| 공식 npm CanvasKit·text/glyph/Picture/font/image 전달 | 같은 고정 원본/variant·module-local ID·복사 bytes/상한·import/release. 전용 paragraph 의미의 차이는 capability·corpus로 공개 |
| Canvas 이전·CSS/DPR/backing resize·zero-size/restore | Main은 CSS/metrics, Render가 OffscreenCanvas/surface 관리. 이전 metrics의 게시/입력/late worker를 차단하고 필요시 새 canvas/session 사용 |
| Flush/publication·GPU/표시 관측 | Submission credit·안전한 provider release·관측 수준을 구별. Flush/rAF/메시지를 GPU fence/scanout으로 세지 않음 |
| EditContext 없음·focus/clipboard·trusted activation 거부 | DOM carrier의 필수 편집·composition 종료 교섭과 명시적 권한/terminal. Worker 메시지를 trusted 입력으로 간주하지 않음 |
| Hide/resume·context loss·reload/close | Profile별 복구 또는 명시 실패 정책과 resource/publication/drain 정합성 |

Native/threaded는 준비 scene이 App/Content 지연 중 독립 진행해야 한다. Single-worker는 App 독립과 Content 협력 실행을 구분하고, 동기 Content 점유 구간의 정지는 허용하되 반환 뒤 최신 상태·순서·drain 회복은 필수다.

## 17.3 후속 제품 성능 비교 — 백엔드 완료와 별도 평가

Native/threaded의 제품 평가는 같은 모니터·해상도·배율·창 크기·Release/optimized·Hermes cohort·콘텐츠/기능/physics로 비교한다. V1 RNW와 v2 자체 host의 비교는 host 교체 효과까지 포함하며 engine 단독 효과로 단정하지 않는다. Single-worker의 비격리 기능 지원은 threaded와 같은 FPS를 전제로 하지 않고 성능/Content 점유 제한을 공개한다.

- [work6의 All components 조건](../03/work6-summary.md)에 따라 양 열 전체 예열·top→실제 bottom·중간 section coverage를 확인한다. 짧은 왕복이나 eager/무제한 keep-alive로 대체하지 않는다.
- Mixed 버튼/hover/focus·한국어 편집 복귀·일반 ListView/Cupertino, 정지→시작→10초 이상 연속→반전→관성→재접촉과 resize를 포함한다.
- 기준/후보 **3쌍**을 기본으로 하고 물리 precision trackpad와 OS wheel의 입력 source를 구별한다. 성능 실행과 빌드/다른 계측을 겹치지 않는다.
- Surface의 서로 다른 이동 상태 갱신·시간을 관측한다. Callback/wake/submit 수·동일 화면 반복을 60fps로 계산하지 않는다.
- Warm 일반 이동 60fps 기준과 새 콘텐츠 준비의 일시 jitter를 구분한다. 준비 뒤 지속 정지·입력 불응·지속 미달은 허용 예외가 아니다.
- 입력 수집→소비→property→submit→surface commit과 p95/p99/max·CPU/GPU는 원인 분석값이다. 미관측 scanout/GC 시각을 추정치로 채우지 않는다.
- Ledger와 process/GPU 관측을 구별하고 같은 예산·같은 장면/복귀로 비교한다.

실제 일반 사용 수락은 관측된 platform/scene/input source의 범위로 기록할 수 있다. 모든 내부 시각을 알아야 사용자 체감 수락을 기록할 수 있는 것은 아니며, 반대로 자동 수치가 좋아도 사용자의 물리 정지를 성공으로 덮지 않는다.

## 백엔드 완료·제품 전환과 공급

기술 완료는 공통 C++ core·versioned ABI/TS/SDK·Windows와 두 Web 필수 통합 기능·Android 최소 port·정합성/예산/hold·실제 설치/공급을 모두 요구했다. Apple/Linux의 당시 범위는 port 경계 설계였고 실제 host 공급은 후속이었다. Work9의 확대된 desktop/모바일 범위와 구분한다.

제품 기본값 전환은 대상별 구조·정확성·실제 입력/성능·공급·기존 앱/API 이식 gate 이후 별도로 판단한다. Gate 전에는 일반 App의 기존 기본값과 v1을 유지하며 사용 기능/제거 목록 확인 없이 일괄 삭제하지 않는다.

Source·ABI·runtime/compiler·Skia/CanvasKit·SDK·설치본·실행 bundle identity와 장면 안의 실제 C++ 작업을 대조한다. 작업0/notObserved·고정 fallback0·선택 옵션·build graph만으로 실행/성능을 인정하지 않는다. 테스트 timeout은 **20분**, 검증 임시·이전 dist/staging·설치본/receipt/log는 finally에서 정리하고 현재 공급만 유지한다.

최종 W8는 **PARTIAL**, API gate **FAIL**, `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 입력/표시 `notVerified`였다. [work9](../../../../work9.md)의 단계·대상별 gate가 이후 진행 기준이다.

[보관 목차](work8-summary.md) · [2부](work8-2-summary.md) · [2a 최종 기록](../05/work8-2a-summary.md)
