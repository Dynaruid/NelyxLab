# C++ 배치·Scene·Semantics와 Windows 입력·시각 회귀 요약

원문: 루트 `work3.md` · 작성·실행: **2026-11-02~03 KST** · 보관: **2026-11-04 KST**

상태: **C0~C5·D0~D6·E0~E4 구현·재현·평가·정리 종료 / 제품 PARTIAL**. Windows 입력·준비 조건을 갖춘 최대화 시각 검증은 **PASS-scoped**, 성능 후보는 기본 비활성이다. `performanceAccepted=false`, `resizePerformanceAccepted=false`를 유지하며 이후 개선은 [work4](../03/work4-summary.md)로 이관했다. 이번 보관에서 제품을 재실행하지 않았다.

## 구현한 C++ 경계

| 단계·모듈 | 구현·범위와 판정 |
| --- | --- |
| C0~C5 input geometry | 숫자 kernel·JSI·SDK 연동과 회귀 구현. 초기 대표 화면은 **TS fallback**으로 C++ 성능 비교 불성립, 기본 주입 철회 |
| D1/D2 Path·clip/Paint batch | 별도 scene packet v2의 숫자 table을 native에서 검증·복사·생성/replay. display-list v1과 독립 resource hold 보존 |
| D3 Scene composition | 불변 recording의 ID·scope·range·자식 순서를 create/update/remove transaction으로 적용하고 native에서 replay 순서 생성. TS source lookup·resource replay는 유지 |
| D4 Semantics geometry | 표준 숫자 좌표·clip·hidden 계산을 native로 처리. endpoint당 한 query이며 label/merge/order/focus/action·custom hook은 TS 유지 |
| D5 producer 완료 대기 | import·replay/submit·완료 대기·cleanup 구간을 관찰. GPU/driver의 독립 원인 미확정, queue·fence·compiler 정책 변경 없음 |

모듈들은 frame/owner·viewport/renderer/context/surface 세대를 검증하고 stale·오류·close 때 discard/회수한다. Scene은 live **8,192 nodes/depth 128/4MiB** 등 기존 한도를 유지했다. native kernel fixture와 실제 Testbed 실행의 증거를 구분했다.

Path/Paint·Scene·Semantics 개별·결합 후보는 구현·비교했으나 일관된 총경로 이득이 없어 **NO_ADOPTION**이다. 한 결합 공급에서 GPU allocation 오류가 관찰됐고 후속 현재 native의 3 fresh owners·mixed 왕복 9회에서는 재현되지 않았다. **과거 오류의 원인을 확정하거나 GPU 수정 완료로 선언하지 않았다.**

## 실행 증거의 후속 정정

11월 3일 재감사에서 초기 input geometry의 `available=true/executed=true`는 **직접 API smoke**였고 대표 화면 실행은 TS fallback임을 확인했다. Path/clip/Paint의 source-stage 항목은 native submit 전 TS 준비 집계이며 독립 C++ counter가 아니다. Scene/Semantics도 해당 source 진단의 근거를 다른 package의 일반 FPS owner 전체로 확대하지 않았다.

따라서 과거 mode별 FPS를 C++ 자체 효과의 확정값으로 재사용하지 않는다. 후보별 재분류·독립 native 집계를 갖춘 재실험은 [work5 요약](../03/work5-summary.md)에 이어진다. 기존 실패와 NO_ADOPTION은 유지한다.

## E1 — 전체 범위 복귀 입력과 실제 IME

일반 제품의 range 복귀에서 **`Native printable key lacks its owning TSF character observation`**을 재현했다. 관측 결과 기존 helper의 이동 버튼 Invoke가 focus를 실제로 버튼으로 옮겼고, 편집기 focus 보존 스크롤과 혼동되고 있었다.

- 기본 helper를 실제 OS wheel의 마지막→첫 행 복귀로 바꾸고, 복귀 후 재클릭·SetFocus 없이 value·focus·collapsed selection을 검사했다. 기존 버튼 왕복은 별도 검사로 남겼다.
- 제품의 text insertion 소유 판단은 살아 있는 native client/Core focus intent를 사용한다. 소유자 없는 버튼/canvas key도 Core에 전달하되 문자 삽입으로 만들지 않는다. 살아 있는 편집기에 필요한 strict TSF proof는 완화하지 않았다.
- 일반 제품에서 3 fresh wheel owners 각각 왕복 3회, 별도 button owner의 왕복 3회, 첫/마지막 send/count/clear를 통과했다. Korean HKL `0x04120412`에서 OS key injection으로 **`ㅎ→하→한→한 `**, clear/undo도 관찰했다.
- 최종 scoped 재검증도 wheel/button **1/1 test PASS**, 최대 IME ack **143.741/140.420ms**, 정상 drain·forced=false·exit 0이었다. 물리 키보드·트랙패드 직접 조작 수락과 구분한다.

## E2 — 최대화 Gallery의 약 1초 정지 해석

과거 정적 픽셀 구간을 native/Core frame·wheel 방향과 결합하니, helper가 맨 위에서 위쪽 wheel 80개를 보내는 동안 offset도 0이었다. 요청한 4ms packet 간격도 실제 전송 간격과 달랐다. 해당 끝점 대기를 GPU 정지로 확정하지 않았다.

측정 전에 반대 방향 OS wheel로 위치를 준비하도록 고치고 **80-packet 반전·5초 구간·350ms 기준은 유지**했다. `-Unprimed`는 과거 재현용으로 남겼다. 최종 일반 제품은 기본 4페이지와 최대화 3 owners의 시각 회귀 **2/2 tests PASS**였고, 최대화 primary gap은 owner별 두 방향 **61.030/54.856, 97.871/88.572, 59.876/54.972ms**였다. 이는 입력 준비 조건을 바로잡은 liveness 통과이며 renderer 속도 향상이나 smoothness 수락이 아니다.

## 최종 일반 성능·공급·잔여 작업

source probe·GDI·상세 native 진단 없이 같은 일반 제품의 mixed/Gallery fresh processes 각 3개를 측정했다(2560×1459/DPI 192). 6구간 평균은 mixed **49.430**, Gallery 좌 **58.254**, 우 **57.260 surface FPS**로 **지속 60fps 미달**이다. cadence-only의 drain/desktop pixels는 unobserved이며 별도 기능 owner의 관측과 구분한다.

| 당시 최종 일반 공급 | SHA-256 |
| --- | --- |
| manifest | `ae084a4b50ae9d102f77a977b32503d163dedaddfa643c869232afa3fbc7d1eb` |
| native inputs | `32d160b77d22012fc10fb6a478391a9435cdf1d494413500a32a2d571ad21777` |
| SDK inputs | `b2713a79bc2c76005676b58a55470adc8e2737786fde2bf79ae7b9e797893548` |

9개 공급 패키지·source/dist/설치본·archive/lock integrity·native canonical **175 files**·실행 package **1,794 files**를 대조했다. Hermes bytecode/optimized/Release와 기존 no-CFG compiler policy, 일반 App의 후보 비활성을 유지했다. 최종 관련 source/native **104/104 tests**, 전체 타입·lint/format·parser·diff 검사가 통과했다. 중복 묶음을 합산하지 않는다.

진단 App·fixture·소유 process는 정리했다. E0~E4의 Windows 변경을 Android/Web에서 새로 검증한 것으로 쓰지 않으며 앞선 플랫폼 증거는 당시 공급 범위로만 유지한다. **지속 60fps·resize, 과거 다른 native의 allocation 원인, 후보 순이득, 물리 입력·screen reader·scanout·Apple/Linux·새 Static AOT runtime 수락은 미완료/notVerified**다.

[이력 목록](../../../README.md) · [선행 공통 비용 검토](work2-summary.md) · [다음: 반복 프레임 비용 감소](../03/work4-summary.md)
