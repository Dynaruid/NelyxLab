# W6 — Flutter 참조 기능 확장과 플랫폼 기반 요약

원문: `work6.md` · 작성일: 2026-10-11 KST · 중단·종료: 2026-10-12 KST · 아카이브: 2026-10-27 KST

상태: **CLOSED / SUPERSEDED BY W7**. 종료 전 실행 **PAUSED/PARTIAL**, 전체 기능 미완료.

## 구현과 운영

- W5의 선정 화면에서 일반 framework·rendering·text/input·sliver·앱 시스템·디자인 패키지·플랫폼 공급으로 범위를 확장했다. W6-00~30의 API·기능·실제 환경 수락을 분리했다.
- GlobalKey/Inherited·scheduler/Ticker·ParentData·기본/intrinsic layout, geometry/Matrix/vector/RTL·clip/paint·visibility/stack·LayoutBuilder와 진단 기반을 순차 보강했다.
- foundation platform·conditional import·basic types/print·diagnostics·serialization·message/method codecs를 실제 Core/SDK 소비에 연결했다.
- 마지막 선정 묶음은 Basic/Method/Optional/EventChannel, lazy typed cast, broadcast·profiling/default binding과 SDK retirement였다. 앱별 default owner와 concurrent 명시 messenger, cancel admission·late reply·종료 실패 시 자원 보존을 구분했다.

## 마지막 선정 수락

원본 채널 **498 groups**·buffer/messenger **483 groups**, 실제 SDK **65 expectations**·owner **120 expectations**와 이전 serialization/진단/frame 회귀가 통과했다. fresh ESM/types·세 first-import 순서·Metro·Windows Hermes source/optimized HBC99도 해당 범위에서 PASS였다.

당시 core **0.9.0**/SDK **0.11.0**, 여섯 archive **2,667 files**와 Android/외부 설치 bytes/listing을 대조했다. 선정 원본 119개 중 **118 adapted / native external 선언 1개 missing**이었다. coverage의 review/ref/envelope 수는 기능 완료율이나 native 플랫폼 수락 수가 아니다. 마지막 묶음에 새 native build/run은 없었다.

## 미완료와 이관

- built-in Web/native PlatformMessagePort·plugin bridge·typed OS service와 ServicesBinding/background/worker 소유권은 남았다. embedding messenger 성공을 실제 OS bridge 성공으로 올리지 않았다.
- rendering/layer/text/gesture/focus/editing/sliver/semantics/app·전체 디자인 family와 여섯 target의 잔여를 W7로 넘겼다.
- Windows/Android/Web 물리 IME·reader·FPS/scanout·복구·서명/clean-machine은 미수락이다. Apple/Linux는 코드 범위를 유지하되 전용 native 검증을 **SKIPPED/provider notVerified**로 두었다.
- 중간 마무리는 기존 결과·hash 일치 확인이며 재실행이 아니었다. 당시 `.tmp/work6` checkpoint/receipt를 다시 만드는 것은 현재 정책이 아니다.

[전체 이력](../../../README.md) · [W7 세션 단위 구현](../12/work7-summary.md)
